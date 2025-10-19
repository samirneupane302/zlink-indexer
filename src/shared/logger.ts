import config from "../config";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

class Logger {
  private logLevel: LogLevel;
  constructor() {
    this.logLevel = this.getLogLevelFromString(config.logLevel);
  }

  private getLogLevelFromString(level: string): LogLevel {
    switch (level.toLowerCase()) {
      case "debug":
        return LogLevel.DEBUG;
      case "info":
        return LogLevel.INFO;
      case "warn":
        return LogLevel.WARN;
      case "error":
        return LogLevel.ERROR;
      default:
        return LogLevel.INFO;
    }
  }

  private formatMessage(level: string, message: string, data?: any): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    if (data && config.enableDetailsLogging) {
      return `${baseMessage} ${JSON.stringify(data)}`;
    }

    return baseMessage;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  debug(message: string, data?: any): void {
    if (config.enableDetailsLogging && this.shouldLog(LogLevel.DEBUG)) {
      // console.debug(this.formatMessage("DEBUG", message, data));
    }
  }

  info(message: string, data?: any): void {
    if (config.enableDetailsLogging && this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage("INFO", message, data));
    }
  }

  warn(message: string, data?: any): void {
    if (config.enableDetailsLogging && this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage("WARN", message, data));
    }
  }

  error(message: string, error?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage("ERROR", message, error));
    }
  }

  // Specialized logging methods
  logBlockProcessing(
    blockNumber: number,
    transactionCount: number,
    duration: number
  ): void {
    this.info(`Block ${blockNumber} processed`, {
      transactionCount,
      duration: `${duration}ms`,
      tps: Math.round((transactionCount / duration) * 1000),
    });
  }

  logIndexingProgress(
    startBlock: number,
    currentBlock: number,
    latestBlock: number,
    processedBlocks: number
  ): void {
    const progress =
      ((currentBlock - startBlock) / (latestBlock - startBlock)) * 100;
    this.info(`Indexing progress`, {
      currentBlock,
      latestBlock,
      processedBlocks,
      progress: `${progress.toFixed(2)}%`,
    });
  }

  logErrorWithRetry(
    operation: string,
    attempt: number,
    maxRetries: number,
    error: any
  ): void {
    this.warn(`Retry attempt ${attempt}/${maxRetries} for ${operation}`, {
      error: error.message,
    });
  }

  logRateLimit(operation: string, delay: number): void {
    this.debug(`Rate limiting ${operation}`, { delay: `${delay}ms` });
  }

  // Clear progress bar and log a message
  logWithProgressClear(message: string, data?: any): void {
    this.info(message, data);
  }
}

export const logger = new Logger();
