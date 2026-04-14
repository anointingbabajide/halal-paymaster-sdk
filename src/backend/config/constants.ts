import dotenv from "dotenv";
dotenv.config();

export type ChainType = "evm" | "solana" | "tron";
export type NetworkType = "testnet" | "mainnet";
export type TokenKey = "USDC" | "USDT" | "SOL" | "TRX";

export type EVMChainKey =
  | "sepolia"
  | "arbitrumSepolia"
  | "ethereumMainnet"
  | "arbitrumMainnet";
export type SolanaChainKey = "solanaDevnet" | "solanaMainnet";
export type TronChainKey = "tronShasta" | "tronMainnet";
export type ChainKey = EVMChainKey | SolanaChainKey | TronChainKey;

interface BaseChainDefinition {
  chainType: ChainType;
  name: string;
  networkType: NetworkType;
  rpcUrl: string;
  blockExplorer: string;
  tokens: Partial<Record<TokenKey, string>>;
}

export interface EVMChainDefinition extends BaseChainDefinition {
  chainType: "evm";
  chainId: number;
  bundlerRpc: string;
  entryPointAddress: string;
  paymasterAddress: string;
  simpleAccountFactory: string;
}

export interface SolanaChainDefinition extends BaseChainDefinition {
  chainType: "solana";
  cluster: "devnet" | "mainnet-beta";
}

export interface TronChainDefinition extends BaseChainDefinition {
  chainType: "tron";
  fullNodeUrl: string; // Tron has separate node types
  solidityNodeUrl: string;
  eventServerUrl: string;
}

export type ChainDefinition =
  | EVMChainDefinition
  | SolanaChainDefinition
  | TronChainDefinition;

const PIMLICO_KEY = process.env.PIMLICO_API_KEY!;

export const CHAIN_REGISTRY: Record<ChainKey, ChainDefinition> = {
  sepolia: {
    chainType: "evm",
    chainId: 11155111,
    name: "Sepolia",
    networkType: "testnet",
    rpcUrl: `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
    bundlerRpc: `https://api.pimlico.io/v2/sepolia/rpc?apikey=${PIMLICO_KEY}`,
    blockExplorer: "https://sepolia.etherscan.io",
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    paymasterAddress: "0x32999F27e86e1430B17693D7aB962B8B25c8fcBC",
    tokens: {
      USDC: "0xfB43078f982b6f03Fe4AACA547B8Decf889f216C",
      USDT: "0xea27F9E2395C62c553deCb990C24f07FfAFF15D9",
    },
    simpleAccountFactory: "0x1d2494E2E93460138F52E6D611b995C88072E5c2",
  },
  ethereumMainnet: {
    chainType: "evm",
    chainId: 1,
    name: "Ethereum Mainnet",
    networkType: "mainnet",
    rpcUrl: "https://eth.llamarpc.com",
    bundlerRpc: `https://api.pimlico.io/v2/ethereum/rpc?apikey=${PIMLICO_KEY}`,
    blockExplorer: "https://etherscan.io",
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    paymasterAddress: "", // deploy HalalPaymaster to mainnet first
    tokens: {
      USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    },
    simpleAccountFactory: "0x1d2494E2E93460138F52E6D611b995C88072E5c2",
  },

  arbitrumSepolia: {
    chainType: "evm",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    networkType: "testnet",
    rpcUrl: `https://arb-sepolia.g.alchemy.com/v2/eTFcSZE0epusuF3lJNwCV/${process.env.ALCHEMY_API_KEY}`,
    bundlerRpc: `https://api.pimlico.io/v2/arbitrum-sepolia/rpc?apikey=${PIMLICO_KEY}`,
    blockExplorer: "https://sepolia.arbiscan.io",
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    paymasterAddress: "0xCA8D59028F6EbE77CA141218011802042AC04227",
    tokens: {
      USDC: "0x3aD4e995499F590124b7C139BC52E4C7dF0B3c08",
      USDT: "0xdCFB5ca72A6dd3D69598844225C04D107121f0E1",
    },
    simpleAccountFactory: "0x1d2494E2E93460138F52E6D611b995C88072E5c2",
  },

  arbitrumMainnet: {
    chainType: "evm",
    chainId: 42161,
    name: "Arbitrum One",
    networkType: "mainnet",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    bundlerRpc: `https://api.pimlico.io/v2/arbitrum/rpc?apikey=${PIMLICO_KEY}`,
    blockExplorer: "https://arbiscan.io",
    entryPointAddress: "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    paymasterAddress: "", // no paymaster deployed on Arbitrum mainnet yet
    tokens: {
      USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    },
    simpleAccountFactory: "0x1d2494E2E93460138F52E6D611b995C88072E5c2",
  },

  solanaDevnet: {
    chainType: "solana",
    cluster: "devnet",
    name: "Solana Devnet",
    networkType: "testnet",
    rpcUrl: "https://api.devnet.solana.com",
    blockExplorer: "https://explorer.solana.com?cluster=devnet",
    tokens: {
      USDC: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
      USDT: "EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS",
      SOL: "So11111111111111111111111111111111111111112",
    },
  },
  solanaMainnet: {
    chainType: "solana",
    cluster: "mainnet-beta",
    name: "Solana Mainnet",
    networkType: "mainnet",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    blockExplorer: "https://explorer.solana.com",
    tokens: {
      USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      SOL: "So11111111111111111111111111111111111111112",
    },
  },

  tronShasta: {
    chainType: "tron",
    name: "Tron Shasta Testnet",
    networkType: "testnet",
    rpcUrl: "https://api.shasta.trongrid.io",
    fullNodeUrl: "https://api.shasta.trongrid.io",
    solidityNodeUrl: "https://api.shasta.trongrid.io",
    eventServerUrl: "https://api.shasta.trongrid.io",
    blockExplorer: "https://shasta.tronscan.org",
    tokens: {
      USDT: "TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs", // Shasta USDT (TRC-20)
      // USDC: "TFGBSrddnBULFDEvYxFMSYWBadijQsHZx5", // Shasta USDC (TRC-20)
      TRX: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", // native TRX
    },
  },
  tronMainnet: {
    chainType: "tron",
    name: "Tron Mainnet",
    networkType: "mainnet",
    rpcUrl: "https://api.trongrid.io",
    fullNodeUrl: "https://api.trongrid.io",
    solidityNodeUrl: "https://api.trongrid.io",
    eventServerUrl: "https://api.trongrid.io",
    blockExplorer: "https://tronscan.org",
    tokens: {
      USDT: "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t", // mainnet USDT TRC-20 (biggest)
      USDC: "TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8", // mainnet USDC TRC-20
      TRX: "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb", // native TRX
    },
  },
};

export const HOT_WALLET_ADDRESS_EVM =
  "0x0371868637b61F09D319A12Ebd7E314Af58A181e";
export const HOT_WALLET_ADDRESS_SOLANA =
  "8rarfJKzjd2Bk4GG6xjawCvAAh9zBKdAu7cdF8p6Ni4h";
export const HOT_WALLET_ADDRESS_TRON = "TEbGVgMKtcHYC21sysFnDgRmH51cMxvpX1";
export const ENTRY_POINT_ADDRESS = "0x0000000071727De22E5E9d8BAf0edAc6f37da032";

export const isEVMChain = (
  chain: ChainDefinition,
): chain is EVMChainDefinition => chain.chainType === "evm";

export const isSolanaChain = (
  chain: ChainDefinition,
): chain is SolanaChainDefinition => chain.chainType === "solana";

export const isTronChain = (
  chain: ChainDefinition,
): chain is TronChainDefinition => chain.chainType === "tron";

export const isEVMChainKey = (key: ChainKey): key is EVMChainKey =>
  key === "sepolia" || key === "arbitrumSepolia";

export const isSolanaChainKey = (key: ChainKey): key is SolanaChainKey =>
  key === "solanaDevnet" || key === "solanaMainnet";

export const isTronChainKey = (key: ChainKey): key is TronChainKey =>
  key === "tronShasta" || key === "tronMainnet";

export const getChain = (chainKey: ChainKey): ChainDefinition => {
  const chain = CHAIN_REGISTRY[chainKey];
  if (!chain) throw new Error(`Unknown chain: ${chainKey}`);
  return chain;
};

export const SWEEP_THRESHOLD_USD = 0.1;
export const SWEEP_INTERVAL_MS = 300_000;
export const SIGNATURE_EXPIRY_SECONDS = 300;
export const MAX_GAS_PER_OP = "10000000000000000";
export const ETH_MIN_SWEEP_THRESHOLD = "0.001";
export const SOL_MIN_SWEEP_THRESHOLD = 0.01;
export const TRX_MIN_SWEEP_THRESHOLD = 10; // minimum TRX to sweep

export const PAYMASTER_LOW_BALANCE_THRESHOLD = "0.1";
export const RESERVE_MONITOR_INTERVAL_MS = 600_000;
export const RESERVE_ALERT_THRESHOLD = 0.3;
