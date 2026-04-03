import { arbitrumSepolia, sepolia } from "viem/chains";
import dotenv from "dotenv";
import {
  ChainKey,
  EVMChainKey,
  TokenKey,
  ChainDefinition,
  EVMChainDefinition,
  SolanaChainDefinition,
  TronChainDefinition,
  CHAIN_REGISTRY,
  isEVMChain,
  isSolanaChain,
  isTronChain,
} from "./constants";

dotenv.config();

export interface EVMChainConfig extends EVMChainDefinition {
  chainKey: EVMChainKey;
  viemChain: any;
}

export interface SolanaChainConfig extends SolanaChainDefinition {
  chainKey: ChainKey;
}

export interface TronChainConfig extends TronChainDefinition {
  chainKey: ChainKey;
}

export type ChainConfig = EVMChainConfig | SolanaChainConfig | TronChainConfig;

const VIEM_CHAINS: Partial<Record<ChainKey, any>> = {
  sepolia,
  arbitrumSepolia,
  // solana and tron have no viem chain object
};

export const CHAIN_CONFIGS: Record<ChainKey, ChainConfig> = (
  Object.entries(CHAIN_REGISTRY) as [ChainKey, ChainDefinition][]
).reduce(
  (acc, [key, chain]) => {
    if (isEVMChain(chain)) {
      acc[key] = {
        ...chain,
        chainKey: key,
        viemChain: VIEM_CHAINS[key],
      } as EVMChainConfig;
    } else if (isSolanaChain(chain)) {
      acc[key] = {
        ...chain,
        chainKey: key,
      } as SolanaChainConfig;
    } else if (isTronChain(chain)) {
      acc[key] = {
        ...chain,
        chainKey: key,
      } as TronChainConfig;
    }
    return acc;
  },
  {} as Record<ChainKey, ChainConfig>,
);

export const isEVMConfig = (config: ChainConfig): config is EVMChainConfig =>
  config.chainType === "evm";

export const isSolanaConfig = (
  config: ChainConfig,
): config is SolanaChainConfig => config.chainType === "solana";

export const isTronConfig = (config: ChainConfig): config is TronChainConfig =>
  config.chainType === "tron";

export type { ChainKey, TokenKey };
