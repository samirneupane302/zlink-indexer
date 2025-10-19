import Web3 from "web3";
import { logger } from "../shared/logger";
import { rateLimiter } from "../core/rate-limitter";
import { RpcEndpoint } from "../types";

class Web3Connector {
  private web3: Web3 | null = null;
  private currentEndpoint: RpcEndpoint | null = null;

  constructor(_rpcUrl: string) {
    this.currentEndpoint = {
      id: "default",
      url: _rpcUrl,
      isActive: true,
      failureCount: 0,
    };
  }

  async createConnection() {
    try {
      this.web3 = new Web3(this.currentEndpoint!.url);
      //get block number
      const blockNumber = await this.getBlockNumber();
      logger.info(
        `Web3 connection created to ${
          this.currentEndpoint!.url
        } at block ${blockNumber}`
      );
      return true;
    } catch (error) {
      logger.error("Failed to create Web3 connection", error);
      return false;
    }
  }

  async reconnect() {
    this.closeConnection();
    await this.createConnection();
  }

  closeConnection() {
    this.web3 = null;
    logger.info("Web3 connection closed");
  }

  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    return rateLimiter.executeWithRetry(operation, operationName);
  }

  async getBlockNumber(): Promise<number> {
    if (!this.web3) {
      throw new Error("Web3 connection not established");
    }

    try {
      const result = await this.executeWithRetry(
        () => this.web3!.eth.getBlockNumber(),
        "getBlockNumber"
      );

      return Number(result);
    } catch (error) {
      throw error;
    }
  }

  async getETHLogs(
    start_block: number,
    end_block: number,
    filter: { address?: string[]; topics?: string[][] } = {}
  ) {
    if (!this.web3) {
      throw new Error("Web3 connection not established");
    }

    try {
      const result = await this.executeWithRetry(
        () =>
          this.web3!.eth.getPastLogs({
            fromBlock: start_block,
            toBlock: end_block,
            address: filter.address,
            topics: filter.topics,
          }),
        `getETHLogs(${start_block}-${end_block})`
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getBlockByNumber(blockNumber: number) {
    if (!this.web3) {
      throw new Error("Web3 connection not established");
    }

    try {
      const result = await this.executeWithRetry(
        () => this.web3!.eth.getBlock(blockNumber, true),
        `getBlockByNumber(${blockNumber})`
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getTransactionReceipt(transactionHash: string) {
    if (!this.web3) {
      throw new Error("Web3 connection not established");
    }

    try {
      const result = await this.executeWithRetry(
        () => this.web3!.eth.getTransactionReceipt(transactionHash),
        `getTransactionReceipt(${transactionHash.substring(0, 10)}...)`
      );

      return result;
    } catch (error) {
      throw error;
    }
  }

  async getLatestBlockNumber(): Promise<number> {
    return await this.getBlockNumber();
  }

  async isConnected(): Promise<boolean> {
    try {
      if (!this.web3) return false;
      await this.web3.eth.getBlockNumber();
      return true;
    } catch (error) {
      logger.warn("Web3 connection check failed", error);
      return false;
    }
  }

  getCurrentEndpoint(): RpcEndpoint | null {
    return this.currentEndpoint;
  }

  getCurrentEndpointStats() {
    return this.currentEndpoint;
  }
}

export default Web3Connector;
