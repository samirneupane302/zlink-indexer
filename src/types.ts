import { Transaction } from "web3";

export interface config {
  start_block: number;
  chain_id: number;
  block_difference: number;
  rpc_url: string;
  zlink_contract_address: string;

  requestsPerSecond: number;
  maxRetries: number;
  retryDelay: number;
  batchSize: number;

  logLevel: string;
  enableDetailsLogging: boolean;

  mongodbURI: string;
  enable_indexing: boolean;
  private_key?: string;
}

export interface RpcEndpoint {
  id: string;
  url: string;
  name?: string;
  weight?: number; // For weighted load balancing
  maxConcurrentRequests?: number;
  timeout?: number;
  retryAttempts?: number;
  isActive: boolean;
  lastHealthCheck?: number;
  healthCheckInterval?: number;
  failureCount: number;
  lastFailure?: number;
  responseTime?: number; // Track response time for performance
  successRate?: number; // Track success rate
}
export interface ITransactionRawData {
  transactionIndex: number;
  transactionHash: string;
  from: string;
  to: string;
  value: string;
  logbloom: string;
  logs: string;
  gasUsed: number;
  input: string;
  blockNumber?: number;
  timestamp?: number;
}

export interface TransactionData extends Transaction {
  hash: string;
  transactionIndex: bigint | undefined;
  blockNumber: bigint | undefined;
  timestamp: bigint | undefined;
}

export interface ILogRawData {
  address: string;
  topics: string[];
  data: string;
  blockNumber: bigint | number;
  transactionHash: string;
  transactionIndex: bigint | number;
  blockHash: string;
  logIndex: bigint | number;
  removed: boolean;
}
export interface DecodeResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface MultiDecodeResult {
  success: boolean;
  data?: Array<{ dataType: string; result: DecodeResult }>;
  error?: string;
}

type UTXOs = {
  shield_address: string;
  amount: string;
  nonce: string;
  token: string;
};

export interface IIndexDecodedResponse {
  type: "SHIELD_ASSETS" | "UTXOS_UPDATE";
  blockNumber: number;
  index: number;
  txid: string;
  leaf: {
    commitment: string;
    treeIndex: bigint;
  };
  utxos?: UTXOs;
  encryptedUTXO?: string;
}
export interface UTXOsCollectionDB {
  blockNumber: number;
  txid: string;
  isEncrypted: boolean;
  encryptedUTXO?: string;
  UTXOs?: UTXOs;
}

export interface LeafCollectionDB {
  blockNumber: number;
  index: number;
  txid: string;
  commitment: string;
  treeIndex: bigint;
}

export interface IndexerCheckPoint {
  id: string;
  lastIndexedBlock: number;
  latestBlock: number;
}

export interface SubmitTXRequest {
  proof: string;
  publicSignals: string;
  encryptedData: string;
  receiver: string;
}
