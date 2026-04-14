import { EventEmitter } from "events";
import {
  HalalPaymasterConfig,
  SweepCompleteEvent,
  SweepFailedEvent,
  SweepLogEvent,
} from "./types";
import { DBAdapter } from "../../sdk/db/adapter";
import { CHAIN_CONFIGS } from "../../backend/config/chains";
import { ChainKey } from "../../backend/config/constants";
import { setDBAdapter } from "../../backend/config/db.context";

export class HalalPaymaster extends EventEmitter {
  private config: HalalPaymasterConfig;
  private db: DBAdapter;
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;

  constructor(config: HalalPaymasterConfig) {
    super();
    this.validateConfig(config);
    this.config = config;
    this.db = new DBAdapter(config.database.url, config.database.type);
    setDBAdapter(this.db);
    process.env.HD_MNEMONIC = config.keys.hdMnemonic;
    process.env.SIGNER_PRIVATE_KEY = config.keys.evmSignerKey;
    process.env.SOLANA_FEE_PAYER_PRIVATE_KEY = config.keys.solanaFeePayerKey;
    process.env.TRON_FEE_PAYER_PRIVATE_KEY = config.keys.tronFeePayerKey;
    process.env.PIMLICO_API_KEY = config.keys.pimlicoApiKey;
    process.env.EVM_HOT_WALLET = config.hotWallets.evm;
    process.env.SOLANA_HOT_WALLET_ADDRESS = config.hotWallets.solana;
    process.env.TRON_HOT_WALLET_ADDRESS = config.hotWallets.tron;
    process.env.DATABASE_URL = config.database.url;
    process.env.SWEEP_THRESHOLD_USD = String(config.sweepThresholdUSD ?? 1);
  }

  private log(
    chain: string,
    level: "info" | "warn" | "error",
    message: string,
    data?: any,
  ): void {
    const event: SweepLogEvent = {
      chain,
      level,
      message,
      timestamp: new Date(),
      data,
    };
    this.emit("log", event);
    if (level === "error") console.error(`[${chain}] ${message}`);
    else if (level === "warn") console.warn(`[${chain}] ${message}`);
    else console.log(`[${chain}] ${message}`);
  }

  // everything else stays exactly the same
  private validateConfig(config: HalalPaymasterConfig): void {
    if (!config.database?.url)
      throw new Error("[SDK] database.url is required");
    if (!config.database?.type)
      throw new Error("[SDK] database.type is required");
    if (!config.keys?.hdMnemonic)
      throw new Error("[SDK] keys.hdMnemonic is required");
    if (!config.keys?.evmSignerKey)
      throw new Error("[SDK] keys.evmSignerKey is required");
    if (!config.keys?.solanaFeePayerKey)
      throw new Error("[SDK] keys.solanaFeePayerKey is required");
    if (!config.keys?.tronFeePayerKey)
      throw new Error("[SDK] keys.tronFeePayerKey is required");
    if (!config.hotWallets?.evm)
      throw new Error("[SDK] hotWallets.evm is required");
    if (!config.hotWallets?.solana)
      throw new Error("[SDK] hotWallets.solana is required");
    if (!config.hotWallets?.tron)
      throw new Error("[SDK] hotWallets.tron is required");
    if (!config.chains?.length)
      throw new Error("[SDK] at least one chain is required");
  }

  async start(): Promise<void> {
    if (this.running) {
      console.warn("[SDK] Already running");
      return;
    }

    const originalLog = console.log.bind(console);
    const originalError = console.error.bind(console);
    const originalWarn = console.warn.bind(console);

    console.log = (...args: any[]) => {
      originalLog(...args);
      this.emit("log", {
        chain: "system",
        level: "info",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
    };

    console.error = (...args: any[]) => {
      originalError(...args);
      this.emit("log", {
        chain: "system",
        level: "error",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
    };

    console.warn = (...args: any[]) => {
      originalWarn(...args);
      this.emit("log", {
        chain: "system",
        level: "warn",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
    };

    await this.db.connect();
    this.running = true;
    const intervalMs = (this.config.sweepInterval ?? 300) * 1000;
    for (const chainKey of this.config.chains) {
      const chainConfig = CHAIN_CONFIGS[chainKey as keyof typeof CHAIN_CONFIGS];
      if (!chainConfig) {
        console.warn(`[SDK] Unknown chain: ${chainKey}, skipping`);
        continue;
      }
      console.log(`[SDK] Starting sweep worker for ${chainConfig.name}`);
      await this.runSweepCycle(chainKey);
      const timer = setInterval(async () => {
        await this.runSweepCycle(chainKey);
      }, intervalMs);
      this.workers.set(chainKey, timer);
    }
    process.on("SIGINT", () => this.stop());
    process.on("SIGTERM", () => this.stop());
  }
  private async runSweepCycle(chainKey: ChainKey): Promise<void> {
    try {
      const { runSweepCycle } =
        await import("../../backend/services/sweep.worker");
      const chainConfig = CHAIN_CONFIGS[chainKey];
      await runSweepCycle(chainConfig, {
        onSweepComplete: async (event) => {
          await this.db.recordSweepSuccess(
            event.address,
            event.chain,
            event.token,
            event.amount,
            event.txHash,
          );
          // emit log event
          this.log(
            event.chain,
            "info",
            `Swept ${event.amount} ${event.token} from ${event.address}`,
            event,
          );
          this.emit("sweep:complete", event);
          if (this.config.onSweepComplete) {
            await this.config.onSweepComplete(event);
          }
        },
        onSweepFailed: async (event) => {
          await this.db.recordSweepFailure(
            event.address,
            event.chain,
            event.token,
            event.error,
          );
          // emit log event
          this.log(
            event.chain,
            "error",
            `Sweep failed for ${event.address}: ${event.error}`,
            event,
          );
          this.emit("sweep:failed", event);
          if (this.config.onSweepFailed) {
            await this.config.onSweepFailed(event);
          }
        },
      });
    } catch (err) {
      console.error(`[SDK] Sweep cycle error for ${chainKey}:`, err);
    }
  }

  private originalLog = console.log.bind(console);
  private originalError = console.error.bind(console);
  private originalWarn = console.warn.bind(console);

  async stop(): Promise<void> {
    console.log("[SDK] Stopping sweep workers...");
    this.running = false;

    for (const [chainKey, timer] of this.workers) {
      clearInterval(timer);
      console.log(`[SDK] Stopped worker for ${chainKey}`);
    }

    this.workers.clear();
    await this.db.disconnect();
    console.log("[SDK] All workers stopped");

    // restore original console
    console.log = this.originalLog;
    console.error = this.originalError;
    console.warn = this.originalWarn;
  }

  async getSweepHistory(address: string) {
    return this.db.getSweepHistory(address);
  }
}

export type {
  HalalPaymasterConfig,
  SweepCompleteEvent,
  SweepFailedEvent,
  SweepLogEvent,
} from "./types";
