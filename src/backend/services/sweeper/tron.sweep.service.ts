import {
  sweepTRC20,
  sweepNativeTRX,
  getTRC20Balance,
  getTRXBalance,
} from "../chains/tron.service";
import { TronChainConfig } from "../../config/chains";
import {
  TokenKey,
  SWEEP_THRESHOLD_USD,
  TRX_MIN_SWEEP_THRESHOLD,
} from "../../config/constants";

const SUPPORTED_TRON_TOKENS: TokenKey[] = ["USDC", "USDT"];
const TRC20_SWEEP_THRESHOLD = BigInt(
  Math.floor(SWEEP_THRESHOLD_USD * 1_000_000),
);

export const triggerTronTokenSweep = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepTRC20(walletAddress, chainConfig, token);
};

export const triggerTRXSweep = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepNativeTRX(walletAddress, chainConfig);
};

export const getTronTokensAboveThreshold = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
): Promise<TokenKey[]> => {
  const tokensAboveThreshold: TokenKey[] = [];

  for (const token of SUPPORTED_TRON_TOKENS) {
    if (!chainConfig.tokens[token]) continue;

    try {
      const balance = await getTRC20Balance(walletAddress, chainConfig, token);
      if (balance >= TRC20_SWEEP_THRESHOLD) {
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

export const isTRXAboveThreshold = async (
  walletAddress: string,
  chainConfig: TronChainConfig,
): Promise<boolean> => {
  try {
    const balance = await getTRXBalance(walletAddress, chainConfig);
    return balance >= TRX_MIN_SWEEP_THRESHOLD;
  } catch (err) {
    console.error(
      `[${chainConfig.name}] Error checking TRX balance for ${walletAddress}:`,
      err,
    );
    return false;
  }
};
