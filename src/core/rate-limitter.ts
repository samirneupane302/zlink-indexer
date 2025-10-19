import config from "../config";
import { logger } from "../shared/logger";

/**
 * Enhanced Rate Limiter with RPC Endpoint Switching
 *
 * Features:
 * - Rate limiting with exponential backoff
 * - Automatic RPC endpoint switching on failures
 * - RPC switch statistics tracking
 * - Smart retry logic with endpoint evaluation
 *
 * Usage:
 * 1. Set RPC switch callback: rateLimiter.setRpcSwitchCallback(callback)
 * 2. Use executeWithRetry() for operations that need RPC switching
 * 3. Monitor statistics with getStats()
 */
class RateLimiter {
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestCount = 0;
  private resetTime = Date.now();
  private processingPromise: Promise<void> | null = null;
  private rpcSwitchCallback?: () => Promise<boolean>;
  private rpcSwitchCount = 0;
  private lastRpcSwitch = 0;

  // Method to set the RPC switch callback
  setRpcSwitchCallback(callback: () => Promise<boolean>): void {
    this.rpcSwitchCallback = callback;
  }

  // Get RPC switch statistics
  getRpcSwitchStats(): {
    totalSwitches: number;
    lastSwitchTime: number;
    timeSinceLastSwitch: number;
  } {
    const now = Date.now();
    return {
      totalSwitches: this.rpcSwitchCount,
      lastSwitchTime: this.lastRpcSwitch,
      timeSinceLastSwitch: now - this.lastRpcSwitch,
    };
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.requestQueue.length > 0) {
        const request = this.requestQueue.shift();
        if (!request) {
          continue;
        }

        try {
          await this.waitForRateLimit();
          await request();
          this.requestCount++;
        } catch (error) {
          logger.error("Request failed in rate limiter", error);
          throw error;
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset counter if a second has passed
    if (now - this.resetTime >= 1000) {
      this.requestCount = 0;
      this.resetTime = now;
    }

    // Check if we need to wait due to rate limit
    if (this.requestCount >= config.requestsPerSecond) {
      const waitTime = 1000 - (now - this.resetTime);
      if (waitTime > 0) {
        logger.logRateLimit("RPC request", waitTime);
        await this.delay(waitTime);
        // Recursive call to check again after waiting
        return this.waitForRateLimit();
      }
    }

    // Ensure minimum delay between requests
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minDelay = 1000 / config.requestsPerSecond;

    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest;
      await this.delay(waitTime);
    }

    this.lastRequestTime = Date.now();
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = "operation"
  ): Promise<T> {
    let lastError: any;
    let rpcSwitchAttempted = false;

    for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error;
        logger.logErrorWithRetry(
          operationName,
          attempt,
          config.maxRetries,
          error
        );

        // If this is the last attempt, don't retry
        if (attempt === config.maxRetries) {
          break;
        }

        // Try switching RPC endpoint on first failure or every 2nd attempt
        if (
          this.rpcSwitchCallback &&
          (!rpcSwitchAttempted || attempt % 2 === 0)
        ) {
          try {
            const switched = await this.rpcSwitchCallback();
            if (switched) {
              this.rpcSwitchCount++;
              this.lastRpcSwitch = Date.now();
              logger.info(
                `Switched RPC endpoint during retry for '${operationName}' (attempt ${attempt})`
              );
              rpcSwitchAttempted = true;
            }
          } catch (switchError) {
            logger.warn(
              "Failed to switch RPC endpoint during retry",
              switchError
            );
          }
        }

        // Calculate exponential backoff delay
        const delay = config.retryDelay * Math.pow(2, attempt - 1);
        logger.info(
          `Retrying '${operationName}' in ${delay}ms (attempt ${attempt + 1}/${
            config.maxRetries
          })`
        );
        await this.delay(delay);
      }
    }

    logger.error(`Operation failed after ${config.maxRetries} attempts`, {
      operationName,
      error: lastError.message,
    });

    // Throw a specific error for max retry failures
    const maxRetryError = new Error(
      `Operation '${operationName}' failed after ${config.maxRetries} retry attempts: ${lastError.message}`
    );
    (maxRetryError as any).isMaxRetryFailure = true;
    (maxRetryError as any).originalError = lastError;
    (maxRetryError as any).operationName = operationName;
    (maxRetryError as any).maxRetries = config.maxRetries;

    throw maxRetryError;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          const result = await operation();
          resolve(result);
        } catch (error) {
          logger.debug(
            `Operation failed with error: ${(error as Error).message}`
          );
          reject(error);
        }
      });

      this.requestQueue.map((q) => q.toString());

      // Ensure only one processing promise runs at a time
      if (!this.processingPromise) {
        this.processingPromise = this.processQueue().finally(() => {
          this.processingPromise = null;
        });
      }
    });
  }

  async executeBatch<T>(
    operations: Array<() => Promise<T>>,
    batchSize: number = config.batchSize
  ): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < operations.length; i += batchSize) {
      const batch = operations.slice(i, i + batchSize);

      const batchResults = await Promise.all(
        batch.map((operation) => this.executeWithRetry(operation))
      );
      results.push(...batchResults);

      logger.debug(
        `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          operations.length / batchSize
        )}`,
        {
          batchSize: batch.length,
          totalProcessed: results.length,
        }
      );
    }

    return results;
  }

  getQueueLength(): number {
    return this.requestQueue.length;
  }

  isIdle(): boolean {
    return this.requestQueue.length === 0 && !this.isProcessing;
  }

  // Get current rate limiting stats
  getStats(): {
    queueLength: number;
    isProcessing: boolean;
    requestCount: number;
    timeUntilReset: number;
    rpcSwitchStats: {
      totalSwitches: number;
      lastSwitchTime: number;
      timeSinceLastSwitch: number;
    };
  } {
    const now = Date.now();
    const timeUntilReset = Math.max(0, 1000 - (now - this.resetTime));

    return {
      queueLength: this.requestQueue.length,
      isProcessing: this.isProcessing,
      requestCount: this.requestCount,
      timeUntilReset,
      rpcSwitchStats: this.getRpcSwitchStats(),
    };
  }
}

export const rateLimiter = new RateLimiter();
