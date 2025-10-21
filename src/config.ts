import { config as ConfigType } from "./types";
import dotenv from "dotenv";

dotenv.config();

if (
  !process.env["START_BLOCK"] ||
  !process.env["MAX_BLOCKS_PER_REQUEST"] ||
  !process.env["BLOCK_DIFFERENCE"] ||
  !process.env["RPC_URL"] ||
  !process.env["ZLINK_CONTRACT_ADDRESS"]
) {
  throw new Error("Missing environment variables");
}

const config: ConfigType = {
  start_block: parseInt(process.env["START_BLOCK"] || "1"),

  block_difference: parseInt(process.env["BLOCK_DIFFERENCE"] || "10"),
  rpc_url: process.env["RPC_URL"] as string,
  zlink_contract_address: process.env["ZLINK_CONTRACT_ADDRESS"] as string,

  requestsPerSecond: parseInt(process.env["REQUESTS_PER_SECOND"] || "5"),
  maxRetries: parseInt(process.env["MAX_RETRIES"] || "3"),
  retryDelay: parseInt(process.env["RETRY_DELAY"] || "1000"),
  batchSize: parseInt(process.env["MAX_BLOCKS_PER_REQUEST"] || "1000"),

  //logging
  logLevel: "info",
  enableDetailsLogging: true,

  //database
  mongodbURI: process.env["MONGODB_URI"] as string,
  private_key: process.env["PRIVATE_KEY"] as string,
  enable_indexing: process.env["ENABLE_INDEXING"] === "true",
};

export default config;

export const TOPIC_UTXOS_UPDATE =
  "0x6c4dbf3caba6334c79e9d1a8e9e2566f13e707f15c68cb872504e451219ef705";
export const TOPIC_SHIELD_ASSETS =
  "0x92b167eff0c8136c9019a881f06cad6738b847c189e77da5c89112642b8dfaee";
