import { IndexerCollection } from "./shared/database/unspent-collection";
import config from "./config";
import BlockChainSync from "./core/blockchain-sync";
import { logger } from "./shared/logger";
import "./server/server";

let blockchainSync: BlockChainSync | null = null;
let isShuttingDown = false;

// Graceful shutdown handler
const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) {
    logger.warn("Shutdown already in progress...");
    return;
  }

  isShuttingDown = true;
  logger.info(`\n${signal} received. Starting graceful shutdown...`);

  try {
    if (blockchainSync) {
      logger.info("Stopping blockchain sync...");
      blockchainSync.stopSync();

      // Give it some time to finish current operations
      await new Promise((resolve) => setTimeout(resolve, 5000));
      logger.info("Blockchain sync stopped successfully");
    }

    logger.info("Shutdown complete. Exiting...");
    process.exit(0);
  } catch (error) {
    logger.error("Error during shutdown:", error);
    process.exit(1);
  }
};

// Register signal handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  gracefulShutdown("UNCAUGHT_EXCEPTION");
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  gracefulShutdown("UNHANDLED_REJECTION");
});

const Main = async () => {
  if (!config.enable_indexing) {
    logger.info("Indexing is disabled. Starting server...");
    return;
  }

  const address = [config.zlink_contract_address];
  logger.info(`Starting zLink UTXOs Indexer...`);

  try {
    //load the checkpoint from db if exists
    const indexerCollection = await IndexerCollection.initilize();
    const checkPoint = await indexerCollection.getCheckPoint();

    if (checkPoint) {
      config.start_block = checkPoint.lastIndexedBlock;
    }

    logger.info(
      `Starting blockchain synchronization from block ${config.start_block}`
    );
    blockchainSync = new BlockChainSync(config.start_block);
    await blockchainSync.startSync(address, []);
  } catch (error) {
    logger.error("Fatal error in Main:", error);
    process.exit(1);
  }
};

Main();
