import { ethers } from "ethers";
import { DecodeResult, MultiDecodeResult } from "../types";

interface CacheKey {
  hex: string;
  dataType: string | string[];
  options?: string; // stringified options for cache key
}

interface CacheEntry {
  result: DecodeResult | MultiDecodeResult;
  timestamp: number;
}

class EtherDecoder {
  private static abiCoder = new ethers.AbiCoder();

  // LRU Cache for decode results
  private static cache = new Map<string, CacheEntry>();
  private static maxCacheSize = 10000; // Configurable cache size
  private static cacheExpiryMs = 5 * 60 * 1000; // 5 minutes

  // Hex validation regex - pre-compiled for performance
  private static hexRegex = /^0x[0-9a-fA-F]*$/;

  // Common data type validation cache
  private static dataTypeCache = new Set([
    "address",
    "uint",
    "uint8",
    "uint16",
    "uint32",
    "uint64",
    "uint128",
    "uint256",
    "int",
    "int8",
    "int16",
    "int32",
    "int64",
    "int128",
    "int256",
    "string",
    "bytes",
    "bool",
  ]);

  /**
   * Creates a cache key from parameters
   */
  private static createCacheKey(
    hex: string,
    dataType: string | string[],
    options?: any
  ): string {
    const optionsStr = options ? JSON.stringify(options) : "";
    const dataTypeStr = Array.isArray(dataType) ? dataType.join(",") : dataType;
    return `${hex}:${dataTypeStr}:${optionsStr}`;
  }

  /**
   * Manages cache size and expiry
   */
  private static manageCacheSize(): void {
    const now = Date.now();

    // Remove expired entries
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheExpiryMs) {
        this.cache.delete(key);
      }
    }

    // If still over size limit, remove oldest entries
    if (this.cache.size > this.maxCacheSize) {
      const entriesToRemove = this.cache.size - this.maxCacheSize;
      const keys = Array.from(this.cache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        this.cache.delete(keys[i]!);
      }
    }
  }

  /**
   * Fast hex validation without regex for common cases
   */
  private static isValidHex(hex: string): boolean {
    if (!hex || hex.length < 2) return false;
    if (hex.length === 2 && hex === "0x") return true;

    // Fast path for valid hex
    if (hex.startsWith("0x")) {
      const hexPart = hex.slice(2);
      if (hexPart.length === 0) return true;

      // Quick check for common case
      for (let i = 0; i < hexPart.length; i++) {
        const char = hexPart.charCodeAt(i);
        if (
          !(
            (char >= 48 && char <= 57) || // 0-9
            (char >= 65 && char <= 70) || // A-F
            (char >= 97 && char <= 102)
          )
        ) {
          // a-f
          return false;
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Decodes hex value to the specified data type(s) with caching
   * @param hex - The hex string to decode
   * @param dataType - The expected data type(s) - can be string or array of strings
   * @param options - Additional options for decoding (e.g., decimals for numbers)
   * @returns DecodeResult for single type or MultiDecodeResult for multiple types
   */
  static decode(
    hex: string,
    dataType: string | string[],
    options?: any
  ): DecodeResult | MultiDecodeResult {
    try {
      // Fast validation
      if (!hex || typeof hex !== "string") {
        return {
          success: false,
          error: "Invalid hex input: must be a non-empty string",
        };
      }

      // Normalize hex string - optimized
      const normalizedHex = hex.startsWith("0x") ? hex : `0x${hex}`;

      // Fast hex validation
      if (!this.isValidHex(normalizedHex)) {
        return {
          success: false,
          error: "Invalid hex format: must contain only hexadecimal characters",
        };
      }

      // Check cache first
      const cacheKey = this.createCacheKey(normalizedHex, dataType, options);
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
        return cached.result;
      }

      let result: DecodeResult | MultiDecodeResult;

      // Handle single data type
      if (typeof dataType === "string") {
        result = this.decodeSingleType(normalizedHex, dataType, options);
      } else if (Array.isArray(dataType)) {
        // Handle multiple data types
        result = this.decodeMultipleTypes(normalizedHex, dataType, options);
      } else {
        return {
          success: false,
          error: "Invalid dataType: must be string or array of strings",
        };
      }

      // Cache successful results
      if (result.success) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now(),
        });

        // Manage cache size periodically
        if (this.cache.size > this.maxCacheSize) {
          this.manageCacheSize();
        }
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: `Decoding error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Decodes hex to a single data type using ABI coder
   */
  private static decodeSingleType(
    hex: string,
    dataType: string,
    options?: any
  ): DecodeResult {
    try {
      // Handle method hash removal if needed
      let cleanHex = hex;
      if (
        options?.ignoreMethodHash &&
        hex.replace(/^0x/, "").length % 64 === 8
      ) {
        cleanHex = "0x" + hex.replace(/^0x/, "").substring(8);
      }

      // Validate hex length
      if (cleanHex.replace(/^0x/, "").length % 64 !== 0) {
        return {
          success: false,
          error:
            "The encoded string is not valid. Its length must be a multiple of 64.",
        };
      }

      // Use ABI coder for proper decoding
      const decoded = this.abiCoder.decode([dataType], cleanHex);
      let result = decoded[0];

      // Handle address formatting
      if (dataType === "address") {
        result = ethers.getAddress(result);
      }

      // Handle decimal formatting for numbers
      if (
        options?.decimals &&
        (dataType === "uint" ||
          dataType === "uint256" ||
          dataType === "int" ||
          dataType === "int256")
      ) {
        const decimals = options.decimals;
        const divisor = ethers.getBigInt(10) ** ethers.getBigInt(decimals);
        const integerPart = result / divisor;
        const decimalPart = result % divisor;
        result = `${integerPart.toString()}.${decimalPart
          .toString()
          .padStart(decimals, "0")}`;
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        error: `Decoding error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Decodes hex to multiple data types using ABI coder
   */
  private static decodeMultipleTypes(
    hex: string,
    dataTypes: string[],
    options?: any
  ): MultiDecodeResult {
    try {
      // Handle method hash removal if needed
      let cleanHex = hex;
      if (
        options?.ignoreMethodHash &&
        hex.replace(/^0x/, "").length % 64 === 8
      ) {
        cleanHex = "0x" + hex.replace(/^0x/, "").substring(8);
      }

      // Validate hex length
      if (cleanHex.replace(/^0x/, "").length % 64 !== 0) {
        return {
          success: false,
          error:
            "The encoded string is not valid. Its length must be a multiple of 64.",
        };
      }

      // Use ABI coder for proper decoding
      const decoded = this.abiCoder.decode(dataTypes, cleanHex);
      const results: Array<{ dataType: string; result: DecodeResult }> = [];

      for (let i = 0; i < dataTypes.length; i++) {
        const dataType = dataTypes[i];
        if (!dataType) continue;

        let result = decoded[i];

        // Handle address formatting
        if (dataType === "address") {
          result = ethers.getAddress(result);
        }

        // Handle decimal formatting for numbers
        if (
          options?.decimals &&
          (dataType === "uint" ||
            dataType === "uint256" ||
            dataType === "int" ||
            dataType === "int256")
        ) {
          const decimals = options.decimals;
          const divisor = ethers.getBigInt(10) ** ethers.getBigInt(decimals);
          const integerPart = result / divisor;
          const decimalPart = result % divisor;
          result = `${integerPart.toString()}.${decimalPart
            .toString()
            .padStart(decimals, "0")}`;
        }

        results.push({
          dataType,
          result: {
            success: true,
            data: result,
          },
        });
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error: `Decoding error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Optimized batch decode multiple hex values with intelligent grouping
   */
  static batchDecode(
    hexValues: Array<{
      hex: string;
      dataType: string | string[];
      options?: any;
    }>
  ): Array<DecodeResult | MultiDecodeResult> {
    if (hexValues.length === 0) return [];

    // Group by dataType for better cache utilization
    const groupedByDataType = new Map<
      string,
      Array<{
        index: number;
        hex: string;
        dataType: string | string[];
        options?: any;
      }>
    >();

    hexValues.forEach((item, index) => {
      const key = Array.isArray(item.dataType)
        ? item.dataType.join(",")
        : item.dataType;
      if (!groupedByDataType.has(key)) {
        groupedByDataType.set(key, []);
      }
      groupedByDataType.get(key)!.push({ ...item, index });
    });

    // Results array to maintain original order
    const results: Array<DecodeResult | MultiDecodeResult> = new Array(
      hexValues.length
    );

    // Process each group
    for (const group of groupedByDataType.values()) {
      group.forEach(({ hex, dataType, options, index }) => {
        results[index] = this.decode(hex, dataType, options);
      });
    }

    return results;
  }

  /**
   * High-performance batch decode for identical data types
   */
  static batchDecodeHomogeneous(
    hexValues: string[],
    dataType: string | string[],
    options?: any
  ): Array<DecodeResult | MultiDecodeResult> {
    if (hexValues.length === 0) return [];

    // Pre-validate data type once
    const dataTypeStr = Array.isArray(dataType) ? dataType.join(",") : dataType;
    const optionsStr = options ? JSON.stringify(options) : "";

    const results: Array<DecodeResult | MultiDecodeResult> = [];

    for (const hex of hexValues) {
      // Create cache key
      const normalizedHex = hex.startsWith("0x") ? hex : `0x${hex}`;
      const cacheKey = `${normalizedHex}:${dataTypeStr}:${optionsStr}`;

      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiryMs) {
        results.push(cached.result);
        continue;
      }

      // Decode if not cached
      const result = this.decode(hex, dataType, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Cache management and statistics
   */
  static getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    oldestEntry: number;
  } {
    const now = Date.now();
    let oldestTimestamp = now;
    let hits = 0;
    let total = 0;

    for (const entry of this.cache.values()) {
      total++;
      if (now - entry.timestamp < this.cacheExpiryMs) {
        hits++;
      }
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      hitRate: total > 0 ? hits / total : 0,
      oldestEntry: now - oldestTimestamp,
    };
  }

  /**
   * Clear the cache manually
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Warm up cache with common data types and values
   */
  static warmUpCache(commonHexValues: string[] = []): void {
    const commonDataTypes = ["address", "uint256", "bytes32"];
    const defaultHexValues = [
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    ];

    const hexValuesToWarm = [...commonHexValues, ...defaultHexValues];

    for (const hex of hexValuesToWarm) {
      for (const dataType of commonDataTypes) {
        this.decode(hex, dataType);
      }
    }
  }

  /**
   * Configure cache settings
   */
  static configureCacheSettings(maxSize?: number, expiryMs?: number): void {
    if (maxSize !== undefined && maxSize > 0) {
      this.maxCacheSize = maxSize;
    }
    if (expiryMs !== undefined && expiryMs > 0) {
      this.cacheExpiryMs = expiryMs;
    }

    // Clean up if new max size is smaller
    if (this.cache.size > this.maxCacheSize) {
      this.manageCacheSize();
    }
  }

  /**
   * Get supported data types
   */
  static getSupportedTypes(): string[] {
    return [
      "address",
      "uint",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "uint128",
      "uint256",
      "int",
      "int8",
      "int16",
      "int32",
      "int64",
      "int128",
      "int256",
      "string",
      "bytes",
      "bytes1",
      "bytes2",
      "bytes3",
      "bytes4",
      "bytes5",
      "bytes6",
      "bytes7",
      "bytes8",
      "bytes9",
      "bytes10",
      "bytes11",
      "bytes12",
      "bytes13",
      "bytes14",
      "bytes15",
      "bytes16",
      "bytes17",
      "bytes18",
      "bytes19",
      "bytes20",
      "bytes21",
      "bytes22",
      "bytes23",
      "bytes24",
      "bytes25",
      "bytes26",
      "bytes27",
      "bytes28",
      "bytes29",
      "bytes30",
      "bytes31",
      "bytes32",
      "bool",
    ];
  }

  /**
   * Validates data type efficiently
   */
  static isValidDataType(dataType: string): boolean {
    // Check cache first for common types
    if (this.dataTypeCache.has(dataType)) {
      return true;
    }

    // Pattern matching for dynamic types
    return (
      /^(uint|int)\d*$/.test(dataType) ||
      /^bytes\d*$/.test(dataType) ||
      dataType === "string" ||
      dataType === "bool" ||
      dataType === "address"
    );
  }
}

export default EtherDecoder;
