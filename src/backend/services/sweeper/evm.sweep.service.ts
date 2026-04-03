import {
  sweepERC20,
  getPublicClient,
  sweepNativeETH,
} from "./../chains/evm.service";
import pool from "../../config/db";
import { parseAbi, parseEther } from "viem";
import { EVMChainConfig } from "../../config/chains";
import {
  TokenKey,
  SWEEP_THRESHOLD_USD,
  ETH_MIN_SWEEP_THRESHOLD,
} from "../../config/constants";
import { USDC_DECIMAL } from "../../contract/constant";

const TOKEN_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
]);

const SWEEP_THRESHOLD = BigInt(
  Math.floor(SWEEP_THRESHOLD_USD * 10 ** USDC_DECIMAL),
);

const ETH_SWEEP_THRESHOLD = parseEther(ETH_MIN_SWEEP_THRESHOLD);

const SUPPORTED_EVM_TOKENS: TokenKey[] = ["USDC", "USDT"];

export const triggerEVMTokenSweep = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
  token: TokenKey,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepERC20(walletAddress, chainConfig, token);
};

export const triggerEVMETHSweep = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
): Promise<{ txHash: string; amount: string }> => {
  return await sweepNativeETH(walletAddress, chainConfig);
};

export const getEVMTokensAboveThreshold = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
): Promise<TokenKey[]> => {
  const publicClient = getPublicClient(chainConfig);
  const tokensAboveThreshold: TokenKey[] = [];

  for (const token of SUPPORTED_EVM_TOKENS) {
    const tokenAddress = chainConfig.tokens[token];

    if (!tokenAddress || tokenAddress.includes("DUMMY")) continue;

    try {
      const balance = await publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: "balanceOf",
        args: [walletAddress as `0x${string}`],
      });

      if (balance >= SWEEP_THRESHOLD) {
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

export const isEVMETHAboveThreshold = async (
  walletAddress: string,
  chainConfig: EVMChainConfig,
): Promise<boolean> => {
  const publicClient = getPublicClient(chainConfig);

  try {
    const balance = await publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    return balance >= ETH_SWEEP_THRESHOLD;
  } catch (err) {
    console.error(
      `[${chainConfig.name}] Error checking ETH balance for ${walletAddress}:`,
      err,
    );
    return false;
  }
};
