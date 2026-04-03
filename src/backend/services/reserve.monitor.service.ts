import { ethers } from "ethers";
import { EVMChainConfig, CHAIN_CONFIGS } from "../config/chains";
import { EVMChainKey } from "../config/constants";
import {
  PAYMASTER_LOW_BALANCE_THRESHOLD,
  RESERVE_MONITOR_INTERVAL_MS,
} from "../config/constants";

const ENTRY_POINT_ABI = [
  "function balanceOf(address account) view returns (uint256)",
];

const LOW_BALANCE_THRESHOLD = ethers.parseEther(
  PAYMASTER_LOW_BALANCE_THRESHOLD,
);

let monitorInterval: NodeJS.Timeout | null = null;

const checkChainBalance = async (chainConfig: EVMChainConfig) => {
  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);

  const entryPoint = new ethers.Contract(
    ethers.getAddress(chainConfig.entryPointAddress.toLowerCase()),
    ENTRY_POINT_ABI,
    provider,
  );

  const balanceWei: bigint = await entryPoint.balanceOf(
    ethers.getAddress(chainConfig.paymasterAddress.toLowerCase()),
  );

  const balanceEth = ethers.formatEther(balanceWei);
  const isLow = balanceWei < LOW_BALANCE_THRESHOLD;

  return {
    chain: chainConfig.name,
    paymasterAddress: chainConfig.paymasterAddress,
    balanceEth,
    balanceWei,
    isLow,
  };
};

export const checkAllPaymasterBalances = async (chainKeys?: EVMChainKey[]) => {
  // only check EVM chains — filter out Solana and Tron
  const evmConfigs = Object.entries(CHAIN_CONFIGS)
    .filter(([_, config]) => config.chainType === "evm")
    .map(([_, config]) => config as EVMChainConfig);

  const chains = chainKeys
    ? chainKeys.map((key) => CHAIN_CONFIGS[key] as EVMChainConfig)
    : evmConfigs;

  const results = [];

  for (const chainConfig of chains) {
    try {
      const result = await checkChainBalance(chainConfig);
      results.push(result);

      if (result.isLow) {
        console.warn(
          ` [${result.chain}] Paymaster balance LOW: ${result.balanceEth} ETH — top up ${result.paymasterAddress}`,
        );
      } else {
        console.log(
          ` [${result.chain}] Paymaster balance: ${result.balanceEth} ETH`,
        );
      }
    } catch (err) {
      console.error(
        `[${chainConfig.name}] Failed to check paymaster balance:`,
        err,
      );
      results.push({
        chain: chainConfig.name,
        paymasterAddress: chainConfig.paymasterAddress,
        balanceEth: "error",
        balanceWei: 0n,
        isLow: true,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
};

export const startReserveMonitor = (chainKey?: EVMChainKey) => {
  console.log(
    `Reserve monitor started: checking every ${RESERVE_MONITOR_INTERVAL_MS / 1000 / 60} minutes`,
  );

  const check = () =>
    checkAllPaymasterBalances(chainKey ? [chainKey] : undefined);

  check();

  monitorInterval = setInterval(check, RESERVE_MONITOR_INTERVAL_MS);
};

export const stopReserveMonitor = () => {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("Reserve monitor stopped");
  }
};
