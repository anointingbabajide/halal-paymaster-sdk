import { ChainKey } from "../backend/config/constants";

// ─── Table Configuration ──────────────────────────────────────────────────────
// allows users to map their existing DB columns to SDK expected columns
// if not provided SDK uses default column names
export interface WalletTableConfig {
  tableName?: string; // default: "wallets"
  addressColumn?: string; // default: "address"
  chainColumn?: string; // default: "chain"
  hdIndexColumn?: string; // default: "hd_index"
  isActiveColumn?: string; // default: "is_active"
}

export interface SweepHistoryTableConfig {
  tableName?: string; // default: "sweep_history"
}

export interface TableConfig {
  wallets?: WalletTableConfig;
  sweepHistory?: SweepHistoryTableConfig;
}

// ─── Database Config ──────────────────────────────────────────────────────────
export interface DatabaseConfig {
  url: string;
  type: "mysql" | "postgresql";
  tables?: TableConfig; // optional — only needed if column names differ
}

export interface KeysConfig {
  hdMnemonic: string;
  evmSignerKey: string;
  solanaFeePayerKey: string;
  tronFeePayerKey: string;
  pimlicoApiKey: string;
}

export interface HotWalletsConfig {
  evm: string;
  solana: string;
  tron: string;
}

export interface SweepCompleteEvent {
  address: string;
  chain: string;
  token: string;
  amount: string;
  txHash: string;
  timestamp: Date;
}

export interface SweepFailedEvent {
  address: string;
  chain: string;
  token: string;
  error: string;
  timestamp: Date;
}
export interface SweepLogEvent {
  chain: string;
  level: "info" | "warn" | "error";
  message: string;
  timestamp: Date;
  data?: any;
}

export interface HalalPaymasterConfig {
  database: DatabaseConfig;
  keys: KeysConfig;
  hotWallets: HotWalletsConfig;
  chains: ChainKey[];
  sweepInterval?: number;
  sweepThresholdUSD?: number;
  onSweepComplete?: (event: SweepCompleteEvent) => Promise<void>;
  onSweepFailed?: (event: SweepFailedEvent) => Promise<void>;
}
