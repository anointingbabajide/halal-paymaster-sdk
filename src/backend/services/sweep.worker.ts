import {
  triggerTokenSweep,
  triggerNativeSweep,
  getTokensAboveThreshold,
  isNativeAboveThreshold,
  getAllWallets,
} from "./sweep.service";
import { ChainConfig } from "../config/chains";
import { TokenKey, SWEEP_INTERVAL_MS } from "../config/constants";
import { SweepCompleteEvent, SweepFailedEvent } from "../../sdk/types";

// ─── Callbacks ────────────────────────────────────────────────────────────────
export interface SweepCallbacks {
  onSweepComplete?: (event: SweepCompleteEvent) => Promise<void>;
  onSweepFailed?: (event: SweepFailedEvent) => Promise<void>;
}

const activeWorkers = new Map<string, () => void>();

export const startSweepWorker = (
  chainConfig: ChainConfig,
  callbacks?: SweepCallbacks,
) => {
  const chainKey = chainConfig.chainKey;

  if (activeWorkers.has(chainKey)) {
    console.log(`[${chainConfig.name}] Sweep worker already running`);
    return;
  }

  console.log(
    `Sweep worker started for ${chainConfig.name}: checking every ${SWEEP_INTERVAL_MS / 1000}s`,
  );

  const interval = setInterval(async () => {
    await runSweepCycle(chainConfig, callbacks);
  }, SWEEP_INTERVAL_MS);

  runSweepCycle(chainConfig, callbacks);

  const stop = () => {
    clearInterval(interval);
    activeWorkers.delete(chainKey);
    console.log(`Sweep worker stopped for ${chainConfig.name}`);
  };

  activeWorkers.set(chainKey, stop);
  return stop;
};

export const stopSweepWorker = () => {
  for (const stop of activeWorkers.values()) {
    stop();
  }
  activeWorkers.clear();
  console.log("All sweep workers stopped");
};

export const stopAllSweepWorkers = stopSweepWorker;

export const runSweepCycle = async (
  chainConfig: ChainConfig,
  callbacks?: SweepCallbacks,
) => {
  console.log(
    `[${chainConfig.name}] Running sweep cycle at ${new Date().toISOString()}`,
  );

  try {
    const wallets = await getAllWallets(chainConfig.chainType);

    console.log(
      `[${chainConfig.name}] Found ${wallets.length} wallets for chain type: ${chainConfig.chainType}`,
    );

    if (wallets.length === 0) {
      console.log(`[${chainConfig.name}] No active wallets found`);
      return;
    }

    console.log(
      `[${chainConfig.name}] Checking ${wallets.length} wallets sequentially`,
    );

    for (const walletAddress of wallets) {
      try {
        console.log(
          `[${chainConfig.name}] Processing wallet: ${walletAddress}`,
        );

        console.log(`[${chainConfig.name}] Checking tokens above threshold...`);
        const tokensToSweep = await getTokensAboveThreshold(
          walletAddress,
          chainConfig,
        );
        console.log(
          `[${chainConfig.name}] Tokens to sweep: ${JSON.stringify(tokensToSweep)}`,
        );

        for (const token of tokensToSweep) {
          await sweepWithRetry(walletAddress, chainConfig, token, callbacks);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }

        console.log(`[${chainConfig.name}] Checking native asset...`);
        const hasNative = await isNativeAboveThreshold(
          walletAddress,
          chainConfig,
        );
        console.log(
          `[${chainConfig.name}] Has native above threshold: ${hasNative}`,
        );

        if (hasNative) {
          await sweepNativeWithRetry(walletAddress, chainConfig, callbacks);
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } catch (err) {
        console.error(
          `[${chainConfig.name}] Error processing wallet ${walletAddress}:`,
          err,
        );
      }
    }

    console.log(`[${chainConfig.name}] Sweep cycle complete`);
  } catch (err) {
    console.error(`[${chainConfig.name}] Sweep cycle error:`, err);
  }
};

const sweepWithRetry = async (
  walletAddress: string,
  chainConfig: ChainConfig,
  token: TokenKey,
  callbacks?: SweepCallbacks,
  maxRetries = 3,
  attempt = 1,
): Promise<void> => {
  try {
    const result = await triggerTokenSweep(walletAddress, chainConfig, token);

    if (result.txHash === "") return;

    console.log(
      `[${chainConfig.name}] Sweep successful for ${walletAddress} (${token})`,
    );

    // fire callback
    if (callbacks?.onSweepComplete) {
      await callbacks.onSweepComplete({
        address: walletAddress,
        chain: chainConfig.chainKey,
        token,
        amount: result.amount,
        txHash: result.txHash,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    if (attempt < maxRetries) {
      const delay = attempt * 2000;
      console.warn(
        `[${chainConfig.name}] Sweep failed for ${walletAddress} (${token}) — retry ${attempt}/${maxRetries} in ${delay}ms`,
      );
      console.log("Error while sweeping:", err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await sweepWithRetry(
        walletAddress,
        chainConfig,
        token,
        callbacks,
        maxRetries,
        attempt + 1,
      );
    } else {
      console.error(
        `[${chainConfig.name}] Sweep failed for ${walletAddress} (${token}) after ${maxRetries} attempts:`,
        err,
      );

      // fire failed callback
      if (callbacks?.onSweepFailed) {
        await callbacks.onSweepFailed({
          address: walletAddress,
          chain: chainConfig.chainKey,
          token,
          error: err instanceof Error ? err.message : "Unknown error",
          timestamp: new Date(),
        });
      }
    }
  }
};

const sweepNativeWithRetry = async (
  walletAddress: string,
  chainConfig: ChainConfig,
  callbacks?: SweepCallbacks,
  maxRetries = 3,
  attempt = 1,
): Promise<void> => {
  try {
    const result = await triggerNativeSweep(walletAddress, chainConfig);

    if (result.txHash === "") return;

    console.log(
      `[${chainConfig.name}] Native sweep successful for ${walletAddress}`,
    );

    if (callbacks?.onSweepComplete) {
      await callbacks.onSweepComplete({
        address: walletAddress,
        chain: chainConfig.chainKey,
        token:
          chainConfig.chainType === "evm"
            ? "ETH"
            : chainConfig.chainType === "solana"
              ? "SOL"
              : "TRX",
        amount: result.amount,
        txHash: result.txHash,
        timestamp: new Date(),
      });
    }
  } catch (err) {
    if (attempt < maxRetries) {
      const delay = attempt * 2000;
      console.warn(
        `[${chainConfig.name}] Native sweep failed for ${walletAddress} — retry ${attempt}/${maxRetries} in ${delay}ms`,
      );
      console.log("Error while sweeping native:", err);
      await new Promise((resolve) => setTimeout(resolve, delay));
      await sweepNativeWithRetry(
        walletAddress,
        chainConfig,
        callbacks,
        maxRetries,
        attempt + 1,
      );
    } else {
      console.error(
        `[${chainConfig.name}] Native sweep failed for ${walletAddress} after ${maxRetries} attempts:`,
        err,
      );

      if (callbacks?.onSweepFailed) {
        await callbacks.onSweepFailed({
          address: walletAddress,
          chain: chainConfig.chainKey,
          token:
            chainConfig.chainType === "evm"
              ? "ETH"
              : chainConfig.chainType === "solana"
                ? "SOL"
                : "TRX",
          error: err instanceof Error ? err.message : "Unknown error",
          timestamp: new Date(),
        });
      }
    }
  }
};
