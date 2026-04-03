import {
  ChainConfig,
  EVMChainConfig,
  SolanaChainConfig,
  TronChainConfig,
  isEVMConfig,
  isSolanaConfig,
  isTronConfig,
} from "../config/chains";
import {
  TokenKey,
  SOL_MIN_SWEEP_THRESHOLD,
  SWEEP_THRESHOLD_USD,
  TRX_MIN_SWEEP_THRESHOLD,
} from "../config/constants";
import {
  sweepERC20,
  sweepNativeETH,
  getERC20Balance,
  getNativeETHBalance,
} from "./chains/evm.service";
import {
  sweepSPLToken,
  sweepNativeSOL,
  getSPLBalance,
  getNativeSOLBalance,
} from "./chains/solana.service";
import {
  sweepTRC20,
  sweepNativeTRX,
  getTRC20Balance,
  getTRXBalance,
} from "./chains/tron.service";
import { dbQuery } from "../config/db.context";

// ─── Get All Wallets ──────────────────────────────────────────────────────────
export const getAllWallets = async (chainType: string): Promise<string[]> => {
  const rows = await dbQuery<{ address: string }>(
    "SELECT address FROM wallets WHERE chain = ? AND is_active = true",
    [chainType],
  );
  return rows.map((r) => r.address);
};

// ─── Token Threshold Check ────────────────────────────────────────────────────
export const getTokensAboveThreshold = async (
  walletAddress: string,
  chainConfig: ChainConfig,
): Promise<TokenKey[]> => {
  const tokensToSweep: TokenKey[] = [];
  const threshold = BigInt(Math.floor(SWEEP_THRESHOLD_USD * 1_000_000));

  if (isEVMConfig(chainConfig)) {
    for (const token of ["USDC", "USDT"] as TokenKey[]) {
      if (!chainConfig.tokens[token]) continue;
      const balance = await getERC20Balance(walletAddress, chainConfig, token);
      if (balance >= threshold) tokensToSweep.push(token);
    }
  } else if (isSolanaConfig(chainConfig)) {
    for (const token of ["USDC", "USDT"] as TokenKey[]) {
      if (!chainConfig.tokens[token]) continue;
      const balance = await getSPLBalance(walletAddress, chainConfig, token);
      if (balance >= threshold) tokensToSweep.push(token);
    }
  } else if (isTronConfig(chainConfig)) {
    for (const token of ["USDC", "USDT"] as TokenKey[]) {
      if (!chainConfig.tokens[token]) continue;
      const balance = await getTRC20Balance(walletAddress, chainConfig, token);
      if (balance >= threshold) tokensToSweep.push(token);
    }
  }

  return tokensToSweep;
};

// ─── Native Threshold Check ───────────────────────────────────────────────────
export const isNativeAboveThreshold = async (
  walletAddress: string,
  chainConfig: ChainConfig,
): Promise<boolean> => {
  if (isEVMConfig(chainConfig)) {
    const balance = await getNativeETHBalance(walletAddress, chainConfig);
    return balance >= SWEEP_THRESHOLD_USD;
  } else if (isSolanaConfig(chainConfig)) {
    const balance = await getNativeSOLBalance(walletAddress, chainConfig);
    return balance >= SOL_MIN_SWEEP_THRESHOLD;
  } else if (isTronConfig(chainConfig)) {
    const balance = await getTRXBalance(walletAddress, chainConfig);
    return balance >= TRX_MIN_SWEEP_THRESHOLD;
  }
  return false;
};

// ─── Token Sweep Router ───────────────────────────────────────────────────────
export const triggerTokenSweep = async (
  walletAddress: string,
  chainConfig: ChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  if (isEVMConfig(chainConfig)) {
    return sweepERC20(walletAddress, chainConfig, token);
  } else if (isSolanaConfig(chainConfig)) {
    return sweepSPLToken(walletAddress, chainConfig, token);
  } else if (isTronConfig(chainConfig)) {
    return sweepTRC20(walletAddress, chainConfig, token);
  }
  throw new Error(`Unsupported chain: ${(chainConfig as any).chainKey}`);
};

// ─── Native Sweep Router ──────────────────────────────────────────────────────
export const triggerNativeSweep = async (
  walletAddress: string,
  chainConfig: ChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  if (isEVMConfig(chainConfig)) {
    return sweepNativeETH(walletAddress, chainConfig);
  } else if (isSolanaConfig(chainConfig)) {
    return sweepNativeSOL(walletAddress, chainConfig);
  } else if (isTronConfig(chainConfig)) {
    return sweepNativeTRX(walletAddress, chainConfig);
  }
  throw new Error(`Unsupported chain: ${(chainConfig as any).chainKey}`);
};
