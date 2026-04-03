import app from "./app";
import { connectDB } from "./config/db";
import { startSweepWorker, stopAllSweepWorkers } from "./services/sweep.worker";
import {
  startReserveMonitor,
  stopReserveMonitor,
} from "./services/reserve.monitor.service";
import { CHAIN_CONFIGS, isEVMConfig } from "./config/chains";
import { ChainKey, EVMChainKey } from "./config/constants";
import config from "./config/index";

const args = process.argv.slice(2);
const chainIndex = args.indexOf("--chain");
const chainArg = chainIndex !== -1 ? args[chainIndex + 1] : undefined;

if (!chainArg || !CHAIN_CONFIGS[chainArg as ChainKey]) {
  console.error(
    `Error: valid --chain argument is required. Options: ${Object.keys(CHAIN_CONFIGS).join(", ")}`,
  );
  process.exit(1);
}

const chainConfig = CHAIN_CONFIGS[chainArg as ChainKey];

const start = async () => {
  try {
    await connectDB();

    // sweep worker works for all chain types
    startSweepWorker(chainConfig);

    if (isEVMConfig(chainConfig)) {
      startReserveMonitor(chainArg as EVMChainKey);
    } else {
      console.log(
        `[${chainConfig.name}] Reserve monitor skipped — not an EVM chain`,
      );
    }

    app.listen(config.port, () => {
      console.log(
        `Server running on port ${config.port} | Chain: ${chainConfig.name}`,
      );
    });

    process.on("SIGTERM", () => {
      console.log("SIGTERM received, shutting down...");
      stopAllSweepWorkers();
      stopReserveMonitor();
      process.exit(0);
    });

    process.on("SIGINT", () => {
      console.log("SIGINT received, shutting down...");
      stopAllSweepWorkers();
      stopReserveMonitor();
      process.exit(0);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

start();
