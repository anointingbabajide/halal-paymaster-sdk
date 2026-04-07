import dotenv from "dotenv";
import {
  SWEEP_THRESHOLD_USD,
  SWEEP_INTERVAL_MS,
  SIGNATURE_EXPIRY_SECONDS,
  MAX_GAS_PER_OP,
  PAYMASTER_LOW_BALANCE_THRESHOLD,
  RESERVE_MONITOR_INTERVAL_MS,
  RESERVE_ALERT_THRESHOLD,
  HOT_WALLET_ADDRESS_EVM,
} from "./constants";

dotenv.config();

const config = {
  // server
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",

  // blockchain
  signerPrivateKey: process.env.SIGNER_PRIVATE_KEY!,
  hotWalletAddress: HOT_WALLET_ADDRESS_EVM,

  // database
  databaseUrl: process.env.DATABASE_URL!,

  // internal api
  // internalApiKey: process.env.INTERNAL_API_KEY!,

  // paymaster
  maxGasPerOp: MAX_GAS_PER_OP,
  signatureExpirySeconds: SIGNATURE_EXPIRY_SECONDS,

  // sweep
  sweepThresholdUsd: SWEEP_THRESHOLD_USD,
  sweepIntervalMs: SWEEP_INTERVAL_MS,

  // monitoring
  reserveAlertThreshold: RESERVE_ALERT_THRESHOLD,
  paymasterLowBalanceThreshold: PAYMASTER_LOW_BALANCE_THRESHOLD,
  reserveMonitorIntervalMs: RESERVE_MONITOR_INTERVAL_MS,
};

const required = [
  "SIGNER_PRIVATE_KEY",
  "DATABASE_URL",
  // "INTERNAL_API_KEY",
  "PIMLICO_API_KEY",
  // "HD_MNEMONIC",
];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export default config;
