import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  getAccount,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Mnemonic } from "ethers";
import { derivePath } from "ed25519-hd-key";
import { dbQuery } from "../../config/db.context";
import {
  TokenKey,
  HOT_WALLET_ADDRESS_SOLANA,
  SOL_MIN_SWEEP_THRESHOLD,
  SWEEP_THRESHOLD_USD,
} from "../../config/constants";
import { SolanaChainConfig } from "../../config/chains";

let feePayerKeypair: Keypair | null = null;

const getFeePayerKeypair = (): Keypair => {
  if (!feePayerKeypair) {
    const privateKeyBase58 = process.env.SOLANA_FEE_PAYER_PRIVATE_KEY;
    if (!privateKeyBase58) {
      throw new Error("SOLANA_FEE_PAYER_PRIVATE_KEY not set in .env");
    }
    const bs58 = require("bs58");
    feePayerKeypair = Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
  }
  return feePayerKeypair;
};

// ─── HD Derivation (ed25519 — Solana BIP44 path) ─────────────────────────────
const deriveSolanaKeypair = (hdIndex: number): Keypair => {
  const mnemonic = process.env.HD_MNEMONIC!;
  const seed = Mnemonic.fromPhrase(mnemonic);
  const seedBuffer = Buffer.from(seed.entropy, "hex");
  const path = `m/44'/501'/${hdIndex}'/0'`;
  const { key } = derivePath(path, seedBuffer.toString("hex"));
  return Keypair.fromSeed(key);
};

// ─── Connection ───────────────────────────────────────────────────────────────
export const getSolanaConnection = (
  chainConfig: SolanaChainConfig,
): Connection => {
  return new Connection(chainConfig.rpcUrl, "confirmed");
};

// ─── SPL Token Sweep ──────────────────────────────────────────────────────────
export const sweepSPLToken = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  const tokenMint = chainConfig.tokens[token];

  if (!tokenMint) {
    console.log(
      `[${chainConfig.name}] ${token} not configured, skipping ${walletAddress}`,
    );
    return { txHash: "", amount: "0" };
  }

  try {
    const rows = await dbQuery<{ hd_index: number }>(
      "SELECT hd_index FROM wallets WHERE address = ? AND is_active = true",
      [walletAddress],
    );

    if (rows.length === 0)
      throw new Error(`Wallet not found: ${walletAddress}`);

    const { hd_index } = rows[0];
    const userKeypair = deriveSolanaKeypair(hd_index);
    const feePayer = getFeePayerKeypair();
    const connection = getSolanaConnection(chainConfig);
    const mintPublicKey = new PublicKey(tokenMint);
    const walletPublicKey = new PublicKey(walletAddress);
    const hotWalletPublicKey = new PublicKey(HOT_WALLET_ADDRESS_SOLANA);

    const userTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey,
    );

    let tokenAccountInfo;
    try {
      tokenAccountInfo = await getAccount(connection, userTokenAccount);
    } catch {
      console.log(
        `[${chainConfig.name}] No ${token} token account for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    const balance = tokenAccountInfo.amount;
    const threshold = BigInt(Math.floor(SWEEP_THRESHOLD_USD * 1_000_000));

    if (balance < threshold) {
      console.log(
        `[${chainConfig.name}] ${token} balance too low for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} ${token} balance: ${balance}`,
    );

    const hotWalletTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      hotWalletPublicKey,
    );

    const transaction = new Transaction();
    transaction.feePayer = feePayer.publicKey;

    try {
      await getAccount(connection, hotWalletTokenAccount);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          feePayer.publicKey,
          hotWalletTokenAccount,
          hotWalletPublicKey,
          mintPublicKey,
        ),
      );
    }

    transaction.add(
      createTransferInstruction(
        userTokenAccount,
        hotWalletTokenAccount,
        walletPublicKey,
        balance,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );

    const txHash = await sendAndConfirmTransaction(
      connection,
      transaction,
      [feePayer, userKeypair],
      { commitment: "confirmed" },
    );

    const amountFormatted = (Number(balance) / 1_000_000).toFixed(6);

    console.log(
      `[${chainConfig.name}] Sweep complete: ${amountFormatted} ${token} → ${HOT_WALLET_ADDRESS_SOLANA}`,
    );
    console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.cluster, token, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    console.error(
      `[${chainConfig.name}] SPL sweep failed for ${walletAddress}:`,
      err,
    );

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, ?, '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.cluster,
        token,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Native SOL Sweep ─────────────────────────────────────────────────────────
export const sweepNativeSOL = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  try {
    const rows = await dbQuery<{ hd_index: number }>(
      "SELECT hd_index FROM wallets WHERE address = ? AND is_active = true",
      [walletAddress],
    );

    if (rows.length === 0)
      throw new Error(`Wallet not found: ${walletAddress}`);

    const { hd_index } = rows[0];
    const userKeypair = deriveSolanaKeypair(hd_index);
    const feePayer = getFeePayerKeypair();
    const connection = getSolanaConnection(chainConfig);

    const walletPublicKey = new PublicKey(walletAddress);
    const hotWalletPublicKey = new PublicKey(HOT_WALLET_ADDRESS_SOLANA);

    const balanceLamports = await connection.getBalance(walletPublicKey);
    const balanceSOL = balanceLamports / LAMPORTS_PER_SOL;

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} SOL balance: ${balanceSOL}`,
    );

    if (balanceSOL < SOL_MIN_SWEEP_THRESHOLD) {
      console.log(
        `[${chainConfig.name}] SOL balance too low for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    const rentExemptMinimum =
      await connection.getMinimumBalanceForRentExemption(0);
    const sweepAmount = balanceLamports - rentExemptMinimum;

    if (sweepAmount <= 0) {
      console.log(
        `[${chainConfig.name}] SOL balance insufficient after rent reserve for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    console.log(
      `[${chainConfig.name}] Sweeping ${sweepAmount / LAMPORTS_PER_SOL} SOL (keeping ${rentExemptMinimum} lamports for rent)`,
    );

    const transaction = new Transaction();
    transaction.feePayer = feePayer.publicKey;

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: walletPublicKey,
        toPubkey: hotWalletPublicKey,
        lamports: sweepAmount,
      }),
    );

    const txHash = await sendAndConfirmTransaction(
      connection,
      transaction,
      [feePayer, userKeypair],
      { commitment: "confirmed" },
    );

    const amountFormatted = (sweepAmount / LAMPORTS_PER_SOL).toFixed(9);

    console.log(
      `[${chainConfig.name}] SOL Sweep complete: ${amountFormatted} SOL → ${HOT_WALLET_ADDRESS_SOLANA}`,
    );
    console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, 'SOL', ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.cluster, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    console.error(
      `[${chainConfig.name}] SOL sweep failed for ${walletAddress}:`,
      err,
    );

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, 'SOL', '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.cluster,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Balance Checks ───────────────────────────────────────────────────────────
export const getSPLBalance = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
  token: TokenKey,
): Promise<bigint> => {
  const tokenMint = chainConfig.tokens[token];
  if (!tokenMint) return 0n;

  try {
    const connection = getSolanaConnection(chainConfig);
    const walletPublicKey = new PublicKey(walletAddress);
    const mintPublicKey = new PublicKey(tokenMint);
    const tokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      walletPublicKey,
    );
    const accountInfo = await getAccount(connection, tokenAccount);
    return accountInfo.amount;
  } catch {
    return 0n;
  }
};

export const getNativeSOLBalance = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
): Promise<number> => {
  try {
    const connection = getSolanaConnection(chainConfig);
    const lamports = await connection.getBalance(new PublicKey(walletAddress));
    return lamports / LAMPORTS_PER_SOL;
  } catch {
    return 0;
  }
};
