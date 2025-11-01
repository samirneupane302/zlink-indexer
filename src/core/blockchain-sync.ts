import { ILogRawData, ITransactionRawData, TransactionData } from "../types";
import { rateLimiter } from "./rate-limitter";
import { logger } from "../shared/logger";
import { sleep } from "../shared/helper";
import Web3Connector from "./web3-connection";
import config from "../config";
import zLinkIndex from "./zlink-Index";

/**
 * Configuration constants for blockchain synchronization
 */
export const SYNC_CONFIG = {
  /** Maximum number of blocks to process in a single batch */
  MAX_BLOCKS_PER_BATCH: config.batchSize,
  /** Delay between sync cycles (ms) */
  SYNC_CYCLE_DELAY_MS: config.retryDelay,
  /** Number of characters to show in transaction hash logs */
  HASH_LOG_LENGTH: 10,
} as {
  CACCHING_BLOCK_SIZE: number;
  MAX_BLOCKS_PER_BATCH: number;
  SYNC_CYCLE_DELAY_MS: number;
  HASH_LOG_LENGTH: number;
};
const zLinkIndexer = new zLinkIndex();
/**
 * Real-time blockchain synchronization service
 * Handles continuous monitoring and processing of new blocks
 */
class BlockChainSync {
  private readonly web3Connector: Web3Connector;
  private latestBlockNumber: number = 0;
  private startBlockNumber: number = 0;
  private transactionData: ITransactionRawData[] = [];
  private logsData: any[] = [];
  private isClosed: boolean = false;
  private topics: string[] = [];
  private addresses: string[] = [];

  constructor(startBlockNumber: number) {
    this.web3Connector = new Web3Connector(config.rpc_url);
    this.startBlockNumber = startBlockNumber;
  }

  /**
   * Starts the blockchain synchronization process
   * Continuously monitors for new blocks and processes them
   */
  async startSync(addresses: string[], topics: string[]): Promise<void> {
    this.addresses = addresses;
    this.topics = topics;
    let erroCount = 0;

    while (!this.isClosed) {
      try {
        await this.initializeConnection();

        while (
          !this.isClosed &&
          this.startBlockNumber < this.latestBlockNumber
        ) {
          try {
            await this.runSync();

            // Save checkpoint BEFORE indexing to prevent duplicates on crash/restart
            // If we crash after this, on restart we skip these blocks
            // Duplicate inserts are prevented by unique indexes
            await zLinkIndexer.updateCheckPoint(
              this.startBlockNumber,
              this.latestBlockNumber
            );

            // Index data to DB (duplicates will be ignored by unique indexes)
            await zLinkIndexer.index(this.logsData as ILogRawData[]);

            this.logsData.length = 0; //reset transactions data

            logger.info(
              `Successfully indexed blocks up to ${this.startBlockNumber}`
            );
          } catch (error) {
            erroCount++;
            if (erroCount > 10) {
              logger.error("Too many errors, stopping sync");
              this.isClosed = true;
              break;
            }
            logger.error("Error in sync cycle, retrying:", error);
            // Wait before retrying the current batch
            await sleep(SYNC_CONFIG.SYNC_CYCLE_DELAY_MS * 2);
            // Don't increment startBlockNumber, will retry same range
            continue;
          }
        }

        // Wait for new blocks
        if (!this.isClosed) {
          await sleep(SYNC_CONFIG.SYNC_CYCLE_DELAY_MS);
        }
      } catch (error) {
        logger.error("Fatal error in sync process, retrying:", error);
        await sleep(SYNC_CONFIG.SYNC_CYCLE_DELAY_MS * 3);
      }
    }

    logger.info("Sync process stopped gracefully");
  }

  stopSync(): void {
    this.web3Connector.closeConnection();
    this.isClosed = true;
  }

  /**
   * Initializes the Web3 connection and sets initial block numbers
   */
  private async initializeConnection(): Promise<void> {
    try {
      if (!(await this.web3Connector.isConnected())) {
        await this.web3Connector.createConnection();
      }

      const latestBlockNumber = await this.web3Connector.getLatestBlockNumber();

      //no new blocks produced yet, so we can't sync
      if (
        this.startBlockNumber !== 0 &&
        latestBlockNumber <= this.startBlockNumber
      ) {
        return;
      }

      this.latestBlockNumber = latestBlockNumber;
      logger.info(`Current latest block: ${this.latestBlockNumber}`);
    } catch (error) {
      logger.error("Failed to initialize Web3 connection:", error);
      throw new Error(`Connection initialization failed: ${error}`);
    }
  }

  /**
   * Runs a single synchronization cycle
   */
  private async runSync(): Promise<void> {
    const blockRange = this.calculateBlockRange();

    if (blockRange.start > blockRange.end) {
      logger.info("No new blocks to process");
      return;
    }

    await this.processBlockRange(blockRange);

    logger.info(
      `Sync completed from  Block ${this.startBlockNumber} to ${blockRange.end}`
    );

    this.startBlockNumber = blockRange.end + 1;

    return;
  }

  /**
   * Calculates the optimal block range for processing
   */
  private calculateBlockRange(): {
    start: number;
    end: number;
    difference: number;
  } {
    const startBlock = this.startBlockNumber;
    const endBlock = this.latestBlockNumber - config.block_difference;

    const difference = endBlock - startBlock;
    const end =
      difference > SYNC_CONFIG.MAX_BLOCKS_PER_BATCH
        ? Math.min(startBlock + SYNC_CONFIG.MAX_BLOCKS_PER_BATCH, endBlock)
        : endBlock;

    return { start: startBlock, end, difference };
  }

  /**
   * Processes a range of blocks
   */
  private async processBlockRange(range: {
    start: number;
    end: number;
    difference: number;
  }): Promise<void> {
    logger.info(
      `Processing blocks ${range.start} to ${range.end} (${range.difference} blocks behind)`
    );

    try {
      await this.getBlocksInBulk(range.start, range.end);
      logger.info(
        `Successfully processed blocks from ${range.start} to ${range.end}`
      );
    } catch (error) {
      logger.error(
        `Failed to process block range ${range.start}-${range.end}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Processes multiple blocks in parallel with rate limiting
   * @param startBlock - Starting block number
   * @param endBlock - Ending block number
   * @returns Array of processed transaction data
   */
  private async getBlocksInBulk(
    startBlock: number,
    endBlock: number
  ): Promise<void> {
    if (startBlock > endBlock) {
      throw new Error(
        `Invalid block range: start (${startBlock}) > end (${endBlock})`
      );
    }

    const blockPromises: Array<() => Promise<void>> = [];

    const logs = await this.web3Connector.getETHLogs(startBlock, endBlock, {
      address: this.addresses,
      topics: this.topics.map((topic) => [topic]),
    });

    this.logsData.push(...logs);

    //we are just saving the logs for now to track utxos
    return;
    // Create promises for each block
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
      blockPromises.push(async () => {
        try {
          //try to get block if cache if exist,,

          const blockTx = await this.processBlock(blockNumber);
          const Blocktransactions = blockTx
            .map((tx) => {
              const receipt = logs.filter(
                //@ts-ignore
                (log) => log.transactionHash === tx.hash
              );
              if (!this.isValidTransaction(tx, receipt)) return;
              const formated_tx = this.createTransactionData(tx, receipt);
              return formated_tx;
            })
            .filter((tx) => tx !== undefined);

          this.transactionData.push(...Blocktransactions);
        } catch (error) {
          console.log(error);
          logger.error(`Failed to process block ${blockNumber}:`, error);
        }
      });
    }

    try {
      await rateLimiter.executeBatch(blockPromises);
    } catch (error) {
      logger.error(
        `Failed to process block range ${startBlock}-${endBlock}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Processes a single block and returns its transaction data
   * @param blockNumber - Block number to process
   * @returns Array of processed transaction data for the block
   */
  private async processBlock(blockNumber: number) {
    try {
      const block = await this.web3Connector.getBlockByNumber(blockNumber);

      const transactions = block.transactions as TransactionData[];
      if (!transactions || transactions.length === 0) {
        logger.debug(`Block ${blockNumber} has no transactions`);
        return [];
      }

      return transactions.map((e) => {
        return {
          ...e,
          blockNumber: BigInt(block.number),
          timestamp: BigInt(block.timestamp),
        };
      });
    } catch (error) {
      logger.error(`Error processing block ${blockNumber}:`, error);
      throw error;
    }
  }

  /**
   * Validates if a transaction should be processed
   * @param transaction - Transaction data
   * @param receipt - Transaction receipt
   * @returns True if transaction is valid for processing
   */
  private isValidTransaction(
    transaction: TransactionData,
    receipt: any
  ): boolean {
    if (receipt && receipt.status === 0n) {
      logger.debug(
        `Skipping failed transaction ${transaction.hash.substring(
          0,
          SYNC_CONFIG.HASH_LOG_LENGTH
        )}...`
      );
      return false;
    }
    return true;
  }

  /**
   * Creates formatted transaction data object
   * @param transaction - Original transaction data
   * @param receipt - Transaction receipt
   * @returns Formatted transaction data
   */
  private createTransactionData(
    transaction: TransactionData,
    receipt: any
  ): ITransactionRawData | undefined {
    const logs = receipt
      ? receipt.map((log: any) => ({
          address: (log.address as string).slice(2),
          topics: log.topics?.map((topic: any) => topic.toString().slice(2)),
          data: (log.data as string).slice(2),
          logIndex: Number(log.logIndex),
        }))
      : [];

    if (!logs.length) return undefined;
    return {
      blockNumber: Number(transaction.blockNumber),
      timestamp: Number(transaction.timestamp),
      transactionIndex: Number(transaction.transactionIndex),
      transactionHash: transaction.hash,
      from: transaction.from as string,
      to: transaction.to as string,
      value: transaction.value?.toString() || "0",
      logs: Buffer.from(JSON.stringify(logs)).toString("base64"),
      gasUsed: 0,
      input: Buffer.from(transaction.input as string).toString("base64"),
      logbloom: "",
    };
  }
}

export default BlockChainSync;
