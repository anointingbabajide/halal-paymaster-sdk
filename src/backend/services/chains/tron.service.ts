import TronWeb from "tronweb";
import { HDNodeWallet, Mnemonic } from "ethers";
import { dbQuery } from "../../config/db.context";
import {
  TokenKey,
  HOT_WALLET_ADDRESS_TRON,
  SWEEP_THRESHOLD_USD,
  TRX_MIN_SWEEP_THRESHOLD,
} from "../../config/constants";
import { TronChainConfig } from "../../config/chains";

// ─── HD Derivation ────────────────────────────────────────────────────────────
const deriveTronPrivateKey = (hdIndex: number): string => {
  if (!process.env.HD_MNEMONIC) throw new Error("HD_MNEMONIC is not set");
  const master = HDNodeWallet.fromMnemonic(
    Mnemonic.fromPhrase(process.env.HD_MNEMONIC),
  );
  const purpose = master.deriveChild(44 + 0x80000000);
  const coinType = purpose.deriveChild(195 + 0x80000000);
  const account = coinType.deriveChild(0 + 0x80000000);
  const change = account.deriveChild(0);
  return change.deriveChild(hdIndex).privateKey.slice(2);
};

// ─── TronWeb Instances ────────────────────────────────────────────────────────
export const getTronWeb = (chainConfig: TronChainConfig): any => {
  return new TronWeb({
    fullHost: chainConfig.fullNodeUrl,
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || "" },
  });
};

const getFeePayerTronWeb = (chainConfig: TronChainConfig): any => {
  const privateKey = process.env.TRON_FEE_PAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error("TRON_FEE_PAYER_PRIVATE_KEY not set");
  return new TronWeb({
    fullHost: chainConfig.fullNodeUrl,
    headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY || "" },
    privateKey,
  });
};

// ─── TRC20 ABI ────────────────────────────────────────────────────────────────
const TRC20_ABI = [
  {
    name: "balanceOf",
    inputs: [{ type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    name: "transfer",
    inputs: [{ type: "address" }, { type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// ─── Resource Delegation (Mainnet) ────────────────────────────────────────────
const delegateResources = async (
  userAddress: string,
  chainConfig: TronChainConfig,
): Promise<void> => {
  const feePayerTronWeb = getFeePayerTronWeb(chainConfig);
  const feePayerAddress = feePayerTronWeb.address.fromPrivateKey(
    process.env.TRON_FEE_PAYER_PRIVATE_KEY,
  );

  try {
    const energyTx = await feePayerTronWeb.transactionBuilder.delegateResource(
      100_000_000,
      userAddress,
      "ENERGY",
      feePayerAddress,
      false,
    );
    const signedEnergy = await feePayerTronWeb.trx.sign(energyTx);
    await feePayerTronWeb.trx.sendRawTransaction(signedEnergy);
    console.log(`[${chainConfig.name}] Delegated ENERGY to ${userAddress}`);

    const bandwidthTx =
      await feePayerTronWeb.transactionBuilder.delegateResource(
        100_000_000,
        userAddress,
        "BANDWIDTH",
        feePayerAddress,
        false,
      );
    const signedBandwidth = await feePayerTronWeb.trx.sign(bandwidthTx);
    await feePayerTronWeb.trx.sendRawTransaction(signedBandwidth);
    console.log(`[${chainConfig.name}] Delegated BANDWIDTH to ${userAddress}`);

    await new Promise((resolve) => setTimeout(resolve, 6000));
  } catch (err) {
    console.error(
      `[${chainConfig.name}] Failed to delegate resources to ${userAddress}:`,
      err,
    );
    throw err;
  }
};

const undelegateResources = async (
  userAddress: string,
  chainConfig: TronChainConfig,
): Promise<void> => {
  const feePayerTronWeb = getFeePayerTronWeb(chainConfig);
  const feePayerAddress = feePayerTronWeb.address.fromPrivateKey(
    process.env.TRON_FEE_PAYER_PRIVATE_KEY,
  );

  try {
    const energyTx =
      await feePayerTronWeb.transactionBuilder.undelegateResource(
        100_000_000,
        userAddress,
        "ENERGY",
        feePayerAddress,
      );
    const signedEnergy = await feePayerTronWeb.trx.sign(energyTx);
    await feePayerTronWeb.trx.sendRawTransaction(signedEnergy);

    const bandwidthTx =
      await feePayerTronWeb.transactionBuilder.undelegateResource(
        100_000_000,
        userAddress,
        "BANDWIDTH",
        feePayerAddress,
      );
    const signedBandwidth = await feePayerTronWeb.trx.sign(bandwidthTx);
    await feePayerTronWeb.trx.sendRawTransaction(signedBandwidth);

    console.log(
      `[${chainConfig.name}] Undelegated resources from ${userAddress}`,
    );
  } catch (err) {
    console.warn(
      `[${chainConfig.name}] Failed to undelegate from ${userAddress}:`,
      err,
    );
  }
};

// ─── Fee Strategy ─────────────────────────────────────────────────────────────
const prepareFees = async (
  userAddress: string,
  chainConfig: TronChainConfig,
): Promise<void> => {
  if (chainConfig.networkType === "testnet") {
    console.log(
      `[${chainConfig.name}] Testnet mode — user wallet pays own fees`,
    );
  } else {
    await delegateResources(userAddress, chainConfig);
  }
};

// ─── TRC-20 Token Sweep ───────────────────────────────────────────────────────
export const sweepTRC20 = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  const tokenAddress = chainConfig.tokens[token];

  if (!tokenAddress) {
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
    const userPrivateKey = deriveTronPrivateKey(hd_index);
    const tronWeb = getTronWeb(chainConfig);
    tronWeb.setAddress(walletAddress);

    const contract = await tronWeb.contract(TRC20_ABI, tokenAddress);
    const balance = await contract.balanceOf(walletAddress).call();
    const balanceBig = BigInt(balance.toString());
    const threshold = BigInt(Math.floor(SWEEP_THRESHOLD_USD * 1_000_000));

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} ${token} balance: ${balanceBig}`,
    );

    if (balanceBig < threshold) {
      console.log(
        `[${chainConfig.name}] ${token} balance too low for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    await prepareFees(walletAddress, chainConfig);

    const tx = await tronWeb.transactionBuilder.triggerSmartContract(
      tokenAddress,
      "transfer(address,uint256)",
      { feeLimit: 100_000_000, callValue: 0, from: walletAddress },
      [
        { type: "address", value: HOT_WALLET_ADDRESS_TRON },
        { type: "uint256", value: balanceBig.toString() },
      ],
      walletAddress,
    );

    if (!tx.result?.result) {
      throw new Error(
        `Failed to build transaction: ${JSON.stringify(tx.result)}`,
      );
    }

    const signedTx = await tronWeb.trx.sign(tx.transaction, userPrivateKey);
    const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

    if (!receipt.result) {
      if (chainConfig.networkType === "mainnet") {
        await undelegateResources(walletAddress, chainConfig);
      }
      throw new Error(`Transaction failed: ${JSON.stringify(receipt)}`);
    }

    const txHash = receipt.txid;
    const amountFormatted = (Number(balanceBig) / 1_000_000).toFixed(6);

    console.log(
      `[${chainConfig.name}] Sweep complete: ${amountFormatted} ${token} → ${HOT_WALLET_ADDRESS_TRON}`,
    );

    if (chainConfig.networkType === "mainnet") {
      await undelegateResources(walletAddress, chainConfig);
    }

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.name, token, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    console.error(
      `[${chainConfig.name}] TRC-20 sweep failed for ${walletAddress}:`,
      err,
    );

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, ?, '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.name,
        token,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Native TRX Sweep ─────────────────────────────────────────────────────────
export const sweepNativeTRX = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  try {
    const rows = await dbQuery<{ hd_index: number }>(
      "SELECT hd_index FROM wallets WHERE address = ? AND is_active = true",
      [walletAddress],
    );

    if (rows.length === 0)
      throw new Error(`Wallet not found: ${walletAddress}`);

    const { hd_index } = rows[0];
    const userPrivateKey = deriveTronPrivateKey(hd_index);
    const tronWeb = getTronWeb(chainConfig);

    const balanceSUN = await tronWeb.trx.getBalance(walletAddress);
    const balanceTRX = balanceSUN / 1_000_000;

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} TRX balance: ${balanceTRX}`,
    );

    if (balanceTRX < TRX_MIN_SWEEP_THRESHOLD) {
      console.log(
        `[${chainConfig.name}] TRX balance too low for ${walletAddress}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    const BANDWIDTH_FEE_SUN = 270_000;
    const keepSUN = 2_000_000;
    const sweepSUN = balanceSUN - keepSUN - BANDWIDTH_FEE_SUN;

    if (sweepSUN <= 0) {
      console.log(
        `[${chainConfig.name}] Not enough TRX to sweep after fees for ${walletAddress}`,
      );
      return { txHash: "", amount: "0" };
    }

    const tx = await tronWeb.transactionBuilder.sendTrx(
      HOT_WALLET_ADDRESS_TRON,
      sweepSUN,
      walletAddress,
    );

    const signedTx = await tronWeb.trx.sign(tx, userPrivateKey);
    const receipt = await tronWeb.trx.sendRawTransaction(signedTx);

    if (!receipt.result) {
      throw new Error(`Transaction failed: ${JSON.stringify(receipt)}`);
    }

    const txHash = receipt.txid;
    const amountFormatted = (sweepSUN / 1_000_000).toFixed(6);

    console.log(
      `[${chainConfig.name}] TRX Sweep complete: ${amountFormatted} TRX → ${HOT_WALLET_ADDRESS_TRON}`,
    );

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, 'TRX', ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.name, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    console.error(
      `[${chainConfig.name}] TRX sweep failed for ${walletAddress}:`,
      err,
    );

    await dbQuery(
      `INSERT INTO sweep_history 
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, 'TRX', '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.name,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Balance Checks ───────────────────────────────────────────────────────────
export const getTRC20Balance = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
  token: TokenKey,
): Promise<bigint> => {
  const tokenAddress = chainConfig.tokens[token];
  if (!tokenAddress) return 0n;

  try {
    const tronWeb = getTronWeb(chainConfig);
    tronWeb.setAddress(walletAddress);
    const contract = await tronWeb.contract(TRC20_ABI, tokenAddress);
    const balance = await contract.balanceOf(walletAddress).call();
    return BigInt(balance.toString());
  } catch (err) {
    console.error(
      `[${chainConfig.name}] getTRC20Balance error for ${walletAddress} ${token}:`,
      err,
    );
    return 0n;
  }
};

export const getTRXBalance = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
): Promise<number> => {
  try {
    const tronWeb = getTronWeb(chainConfig);
    const balanceSUN = await tronWeb.trx.getBalance(walletAddress);
    return balanceSUN / 1_000_000;
  } catch {
    return 0;
  }
};
