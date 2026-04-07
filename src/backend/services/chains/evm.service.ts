import {
  createPublicClient,
  http,
  encodeFunctionData,
  parseEther,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HDNodeWallet, Mnemonic } from "ethers";
import { createSmartAccountClient } from "permissionless";
import { toSimpleSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { entryPoint07Address } from "viem/account-abstraction";
import { EVMChainConfig, CHAIN_CONFIGS } from "../../config/chains";
import {
  TokenKey,
  HOT_WALLET_ADDRESS_EVM,
  ETH_MIN_SWEEP_THRESHOLD,
} from "../../config/constants";
import { dbQuery, getDBAdapter } from "../../config/db.context";
import { signUserOperation } from "../paymaster.service";
import ERC20_ABI from "../../contract/abi/ERC20Abi.json";

// ─── HD Wallet ────────────────────────────────────────────────────────────────
let masterWallet: HDNodeWallet | null = null;

const getMasterWallet = (): HDNodeWallet => {
  if (!masterWallet) {
    if (!process.env.HD_MNEMONIC) {
      throw new Error("HD_MNEMONIC is not set in environment variables");
    }
    masterWallet = HDNodeWallet.fromMnemonic(
      Mnemonic.fromPhrase(process.env.HD_MNEMONIC),
    );
  }
  return masterWallet;
};

const derivePrivateKey = (hdIndex: number): `0x${string}` => {
  return getMasterWallet().deriveChild(hdIndex).privateKey as `0x${string}`;
};

// ─── Wallet Lookup ────────────────────────────────────────────────────────────
const getWalletHdIndex = async (walletAddress: string): Promise<number> => {
  const adapter = getDBAdapter();

  const walletRow = adapter
    ? await adapter.getWalletByAddress(walletAddress)
    : (
        await dbQuery<{ hd_index: number }>(
          "SELECT hd_index FROM wallets WHERE address = ? AND is_active = true",
          [walletAddress],
        )
      )[0];

  if (!walletRow) throw new Error(`Wallet not found: ${walletAddress}`);
  return walletRow.hd_index;
};

export const getPublicClient = (chainConfig: EVMChainConfig) => {
  return createPublicClient({
    chain: chainConfig.viemChain,
    transport: http(chainConfig.rpcUrl),
  });
};

export const getSmartAccountClient = async (
  ownerPrivateKey: string,
  chainConfig: EVMChainConfig = CHAIN_CONFIGS.sepolia as EVMChainConfig,
) => {
  const publicClient = getPublicClient(chainConfig);
  const owner = privateKeyToAccount(ownerPrivateKey as `0x${string}`);

  const smartAccount = await toSimpleSmartAccount({
    client: publicClient,
    owner,
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const pimlicoClient = createPimlicoClient({
    transport: http(chainConfig.bundlerRpc),
    entryPoint: {
      address: entryPoint07Address,
      version: "0.7",
    },
  });

  const smartAccountClient = createSmartAccountClient({
    account: smartAccount,
    chain: chainConfig.viemChain,
    bundlerTransport: http(chainConfig.bundlerRpc),
    paymaster: {
      async getPaymasterStubData(userOperation) {
        const serializedUserOp = JSON.parse(
          JSON.stringify(userOperation, (_, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        );
        const paymasterData = await signUserOperation(
          serializedUserOp,
          chainConfig,
        );
        return {
          paymaster: chainConfig.paymasterAddress as `0x${string}`,
          paymasterData: paymasterData as `0x${string}`,
          paymasterVerificationGasLimit: 200000n,
          paymasterPostOpGasLimit: 100000n,
          isFinal: true,
        };
      },
      async getPaymasterData(userOperation) {
        const serializedUserOp = JSON.parse(
          JSON.stringify(userOperation, (_, value) =>
            typeof value === "bigint" ? value.toString() : value,
          ),
        );
        const paymasterData = await signUserOperation(
          serializedUserOp,
          chainConfig,
        );
        return {
          paymaster: chainConfig.paymasterAddress as `0x${string}`,
          paymasterData: paymasterData as `0x${string}`,
          paymasterVerificationGasLimit: 200000n,
          paymasterPostOpGasLimit: 100000n,
        };
      },
    },
    userOperation: {
      estimateFeesPerGas: async () => {
        const fees = await pimlicoClient.getUserOperationGasPrice();
        return fees.fast;
      },
    },
  });

  return smartAccountClient;
};

// ─── ERC-20 Token Sweep ───────────────────────────────────────────────────────
export const sweepERC20 = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  const tokenAddress = chainConfig.tokens[token];

  if (!tokenAddress || tokenAddress.includes("DUMMY")) {
    console.log(
      `[${chainConfig.name}] ${token} not configured, skipping ${walletAddress}`,
    );
    return { txHash: "", amount: "0" };
  }

  try {
    const hd_index = await getWalletHdIndex(walletAddress);
    const privateKey = derivePrivateKey(hd_index);
    const publicClient = getPublicClient(chainConfig);

    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    });

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} ${token} balance: ${balance}`,
    );

    if (balance === 0n) {
      console.log(
        `[${chainConfig.name}] Wallet ${walletAddress} has zero ${token}, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    const smartAccountClient = await getSmartAccountClient(
      privateKey,
      chainConfig,
    );

    const callData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [HOT_WALLET_ADDRESS_EVM as `0x${string}`, balance],
    });

    const userOpHash = await smartAccountClient.sendUserOperation({
      calls: [{ to: tokenAddress as `0x${string}`, value: 0n, data: callData }],
    });

    console.log(`[${chainConfig.name}] UserOperation submitted: ${userOpHash}`);

    const receipt = (await Promise.race([
      smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("UserOp receipt timeout after 60s")),
          60_000,
        ),
      ),
    ])) as any;

    const txHash = receipt.receipt.transactionHash;
    const amountFormatted = (Number(balance) / 1_000_000).toFixed(6);

    console.log(
      `[${chainConfig.name}] Sweep complete: ${amountFormatted} ${token} → ${HOT_WALLET_ADDRESS_EVM}`,
    );
    console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

    await dbQuery(
      `INSERT INTO sweep_history
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.chainId, token, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    const isSenderAlreadyConstructed =
      err?.shortMessage?.includes("Smart Account has already been deployed") ||
      err?.cause?.shortMessage?.includes(
        "Smart Account has already been deployed",
      ) ||
      err?.details?.includes("AA10") ||
      err?.cause?.details?.includes("AA10");

    if (isSenderAlreadyConstructed) {
      console.log(
        `[${chainConfig.name}] Wallet ${walletAddress} already deployed (AA10) — skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    await dbQuery(
      `INSERT INTO sweep_history
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, ?, '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.chainId,
        token,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Native ETH Sweep ─────────────────────────────────────────────────────────
export const sweepNativeETH = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  try {
    const hd_index = await getWalletHdIndex(walletAddress);
    const privateKey = derivePrivateKey(hd_index);
    const publicClient = getPublicClient(chainConfig);

    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });

    console.log(
      `[${chainConfig.name}] Wallet ${walletAddress} ETH balance: ${balance} wei`,
    );

    const MIN_ETH_THRESHOLD = parseEther(ETH_MIN_SWEEP_THRESHOLD);
    if (balance < MIN_ETH_THRESHOLD) {
      console.log(
        `[${chainConfig.name}] Wallet ${walletAddress} ETH balance too low, skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    const smartAccountClient = await getSmartAccountClient(
      privateKey,
      chainConfig,
    );

    const userOpHash = await smartAccountClient.sendUserOperation({
      calls: [
        {
          to: HOT_WALLET_ADDRESS_EVM as `0x${string}`,
          value: balance,
          data: "0x",
        },
      ],
    });

    console.log(
      `[${chainConfig.name}] ETH UserOperation submitted: ${userOpHash}`,
    );

    const receipt = (await Promise.race([
      smartAccountClient.waitForUserOperationReceipt({ hash: userOpHash }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("UserOp receipt timeout after 60s")),
          60_000,
        ),
      ),
    ])) as any;

    const txHash = receipt.receipt.transactionHash;
    const amountFormatted = formatEther(balance);

    console.log(
      `[${chainConfig.name}] ETH Sweep complete: ${amountFormatted} ETH → ${HOT_WALLET_ADDRESS_EVM}`,
    );
    console.log(`[${chainConfig.name}] Tx hash: ${txHash}`);

    await dbQuery(
      `INSERT INTO sweep_history
        (wallet_address, chain_id, token, amount, tx_hash, status, created_at)
       VALUES (?, ?, 'ETH', ?, ?, 'success', NOW())`,
      [walletAddress, chainConfig.chainId, amountFormatted, txHash],
    );

    return { txHash, amount: amountFormatted };
  } catch (err: any) {
    const isSenderAlreadyConstructed =
      err?.shortMessage?.includes("Smart Account has already been deployed") ||
      err?.cause?.shortMessage?.includes(
        "Smart Account has already been deployed",
      ) ||
      err?.details?.includes("AA10") ||
      err?.cause?.details?.includes("AA10");

    if (isSenderAlreadyConstructed) {
      console.log(
        `[${chainConfig.name}] Wallet ${walletAddress} already deployed (AA10) — skipping`,
      );
      return { txHash: "", amount: "0" };
    }

    await dbQuery(
      `INSERT INTO sweep_history
        (wallet_address, chain_id, token, amount, tx_hash, status, error, created_at)
       VALUES (?, ?, 'ETH', '0', NULL, 'failed', ?, NOW())`,
      [
        walletAddress,
        chainConfig.chainId,
        err instanceof Error ? err.message : "Unknown error",
      ],
    );
    throw err;
  }
};

// ─── Balance Checks ───────────────────────────────────────────────────────────
export const getERC20Balance = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
  token: TokenKey,
): Promise<bigint> => {
  const tokenAddress = chainConfig.tokens[token];
  if (!tokenAddress || tokenAddress.includes("DUMMY")) return 0n;

  try {
    const publicClient = getPublicClient(chainConfig);
    const balance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    });
    return balance as bigint;
  } catch (err) {
    console.error(
      `[${chainConfig.name}] getERC20Balance error for ${walletAddress} ${token}:`,
      err,
    );
    return 0n;
  }
};

export const getNativeETHBalance = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
): Promise<number> => {
  try {
    const publicClient = getPublicClient(chainConfig);
    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    return Number(formatEther(balance));
  } catch {
    return 0;
  }
};
