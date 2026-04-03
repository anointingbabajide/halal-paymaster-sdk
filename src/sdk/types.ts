import { ChainKey } from "../backend/config/constants";

export interface DatabaseConfig {
  url: string;
  type: "mysql" | "postgresql";
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

export interface HalalPaymasterConfig {
  database: DatabaseConfig;
  keys: KeysConfig;
  hotWallets: HotWalletsConfig;
  chains: ChainKey[];
  sweepInterval?: number; // seconds, default 300
  sweepThresholdUSD?: number; // default 1
  onSweepComplete?: (event: SweepCompleteEvent) => Promise<void>;
  onSweepFailed?: (event: SweepFailedEvent) => Promise<void>;
}
