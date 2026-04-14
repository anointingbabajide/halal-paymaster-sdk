import { EventEmitter } from "events";
import {
  HalalPaymasterConfig,
  SweepCompleteEvent,
  SweepFailedEvent,
  SweepLogEvent,
} from "./types";
import { DBAdapter } from "./db/adapter";
import { CHAIN_CONFIGS } from "../backend/config/chains";
import { ChainKey, ENTRY_POINT_ADDRESS } from "../backend/config/constants";
import { setDBAdapter } from "../backend/config/db.context";
import { isEVMConfig } from "../backend/config/chains";
import PAYMASTER_ABI from "../backend/contract/abi/HalalPaymasterAbi.json";
import ENTRY_POINT_ABI from "../backend/contract/abi/entryPointAbi.json";
import { ethers } from "ethers";

export class HalalPaymaster extends EventEmitter {
  // ← extend EventEmitter
  private config: HalalPaymasterConfig;
  private db: DBAdapter;
  private workers: Map<string, NodeJS.Timeout> = new Map();
  private running = false;

  // save original console methods for restore on stop
  private originalLog = console.log.bind(console);
  private originalError = console.error.bind(console);
  private originalWarn = console.warn.bind(console);

  private isLogging = false; // ← class property here

  constructor(config: HalalPaymasterConfig) {
    super(); // ← call super
    this.validateConfig(config);
    this.config = config;
    this.db = new DBAdapter(
      config.database.url,
      config.database.type,
      config.database.tables,
    );
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

    // in start():
    console.log = (...args: any[]) => {
      this.originalLog(...args);
      if (this.isLogging) return;
      this.isLogging = true;
      this.emit("log", {
        chain: "system",
        level: "info",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
      this.isLogging = false;
    };

    console.error = (...args: any[]) => {
      this.originalError(...args);
      if (this.isLogging) return;
      this.isLogging = true;
      this.emit("log", {
        chain: "system",
        level: "error",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
      this.isLogging = false;
    };

    console.warn = (...args: any[]) => {
      this.originalWarn(...args);
      if (this.isLogging) return;
      this.isLogging = true;
      this.emit("log", {
        chain: "system",
        level: "warn",
        message: args.join(" "),
        timestamp: new Date(),
      } as SweepLogEvent);
      this.isLogging = false;
    };

    await this.db.connect();
    this.running = true;
    const intervalMs = (this.config.sweepInterval ?? 300) * 1000;

    for (const chainKey of this.config.chains) {
      const chainConfig = CHAIN_CONFIGS[chainKey];
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
        await import("../backend/services/sweep.worker");
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

  async stop(): Promise<void> {
    if (!this.running) return; // ← guard against double stop

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

  async depositToPaymaster(
    chainKey: ChainKey,
    depositAmountEth: string,
    stakeAmountEth: string,
    unstakeDelaySec: number = 86400,
  ): Promise<{
    depositTxHash: string;
    stakeTxHash: string;
    currentBalance: string;
  }> {
    const chainConfig = CHAIN_CONFIGS[chainKey];
    if (!chainConfig) throw new Error(`Unknown chain: ${chainKey}`);
    if (!isEVMConfig(chainConfig))
      throw new Error(`depositToPaymaster only works for EVM chains`);
    if (!chainConfig.paymasterAddress)
      throw new Error(
        `No paymaster address configured for ${chainConfig.name}`,
      );

    const signerKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerKey) throw new Error("SIGNER_PRIVATE_KEY not set");

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const signer = new ethers.Wallet(signerKey, provider);
    const paymasterContract = new ethers.Contract(
      chainConfig.paymasterAddress,
      PAYMASTER_ABI,
      signer,
    );
    const entryPoint = new ethers.Contract(
      ENTRY_POINT_ADDRESS,
      ENTRY_POINT_ABI,
      provider,
    );

    console.log(
      `[${chainConfig.name}] Simulating deposit of ${depositAmountEth} ETH...`,
    );
    await paymasterContract.deposit.staticCall({
      value: ethers.parseEther(depositAmountEth),
    });
    console.log(`[${chainConfig.name}] Deposit simulation passed`);

    console.log(
      `[${chainConfig.name}] Depositing ${depositAmountEth} ETH into paymaster...`,
    );
    const depositTx = await paymasterContract.deposit({
      value: ethers.parseEther(depositAmountEth),
    });
    await depositTx.wait();
    console.log(
      `[${chainConfig.name}] Deposited ${depositAmountEth} ETH | tx: ${depositTx.hash}`,
    );

    console.log(
      `[${chainConfig.name}] Simulating stake of ${stakeAmountEth} ETH...`,
    );
    await paymasterContract.addStake.staticCall(unstakeDelaySec, {
      value: ethers.parseEther(stakeAmountEth),
    });
    console.log(`[${chainConfig.name}] Stake simulation passed`);

    console.log(`[${chainConfig.name}] Staking ${stakeAmountEth} ETH...`);
    const stakeTx = await paymasterContract.addStake(unstakeDelaySec, {
      value: ethers.parseEther(stakeAmountEth),
    });
    await stakeTx.wait();
    console.log(
      `[${chainConfig.name}] Staked ${stakeAmountEth} ETH | tx: ${stakeTx.hash}`,
    );

    const balance = await entryPoint.balanceOf(chainConfig.paymasterAddress);
    const currentBalance = ethers.formatEther(balance);
    console.log(
      `[${chainConfig.name}] Paymaster balance: ${currentBalance} ETH`,
    );

    return {
      depositTxHash: depositTx.hash,
      stakeTxHash: stakeTx.hash,
      currentBalance,
    };
  }

  async getPaymasterBalance(chainKey: ChainKey): Promise<string> {
    const chainConfig = CHAIN_CONFIGS[chainKey];
    if (!chainConfig || !isEVMConfig(chainConfig))
      throw new Error(`getPaymasterBalance only works for EVM chains`);
    if (!chainConfig.paymasterAddress)
      throw new Error(
        `No paymaster address configured for ${chainConfig.name}`,
      );

    const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
    const entryPoint = new ethers.Contract(
      ENTRY_POINT_ADDRESS,
      ENTRY_POINT_ABI,
      provider,
    );
    const balance = await entryPoint.balanceOf(chainConfig.paymasterAddress);
    return ethers.formatEther(balance);
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
