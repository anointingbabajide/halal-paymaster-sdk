import {
  sweepSPLToken,
  sweepNativeSOL,
  getSPLBalance,
  getNativeSOLBalance,
} from "../chains/solana.service";
import { SolanaChainConfig } from "../../config/chains";
import {
  TokenKey,
  SWEEP_THRESHOLD_USD,
  SOL_MIN_SWEEP_THRESHOLD,
} from "../../config/constants";

const SUPPORTED_SOLANA_TOKENS: TokenKey[] = ["USDC", "USDT"];
const SPL_SWEEP_THRESHOLD = BigInt(Math.floor(SWEEP_THRESHOLD_USD * 1_000_000));

export const triggerSolanaTokenSweep = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepSPLToken(walletAddress, chainConfig, token);
};

export const triggerSOLSweep = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepNativeSOL(walletAddress, chainConfig);
};

export const getSolanaTokensAboveThreshold = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
): Promise<TokenKey[]> => {
  const tokensAboveThreshold: TokenKey[] = [];

  for (const token of SUPPORTED_SOLANA_TOKENS) {
    if (!chainConfig.tokens[token]) continue;

    try {
      const balance = await getSPLBalance(walletAddress, chainConfig, token);
      if (balance >= SPL_SWEEP_THRESHOLD) {
        tokensAboveThreshold.push(token);
      }
    } catch (err) {
      console.error(
        `[${chainConfig.name}] Error checking ${token} balance for ${walletAddress}:`,
        err,
      );
    }
  }

  return tokensAboveThreshold;
};

export const isSOLAboveThreshold = async (
  walletAddress: string,
  chainConfig: SolanaChainConfig,
): Promise<boolean> => {
  try {
    const balance = await getNativeSOLBalance(walletAddress, chainConfig);
    return balance >= SOL_MIN_SWEEP_THRESHOLD;
  } catch (err) {
    console.error(
      `[${chainConfig.name}] Error checking SOL balance for ${walletAddress}:`,
      err,
    );
    return false;
  }
};
