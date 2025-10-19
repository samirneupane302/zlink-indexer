# zLink Protocol Indexer

A production-ready blockchain indexer for the **zLink privacy protocol** - a zero-knowledge proof system enabling private ETH and ERC20 transfers on Ethereum without revealing sender addresses.

## 📋 Table of Contents

- [Overview](#overview)
- [What is zLink?](#what-is-zlink)
- [Features](#features)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [API Documentation](#api-documentation)
- [Production Features](#production-features)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The zLink Indexer is a critical infrastructure component that powers the zLink privacy protocol by maintaining a synchronized database of UTXOs (Unspent Transaction Outputs) and Merkle tree commitments. This indexer enables:

- **Fast UTXO Queries**: Instant access to available UTXOs for transaction construction
- **Commitment Tracking**: Maintain complete Merkle tree state for zero-knowledge proof generation
- **Privacy Preservation**: Index encrypted UTXO data without compromising user privacy
- **Protocol Support**: Provide essential data infrastructure for zLink wallets and applications

## 🔐 What is zLink?

**zLink** is a privacy-preserving protocol built on Ethereum that leverages zero-knowledge proofs to enable completely anonymous transfers of ETH and ERC20 tokens.

### Key Features of zLink Protocol:

- 🎭 **Anonymous Transfers**: Send ETH/ERC20 tokens without revealing your address
- 🔒 **Zero-Knowledge Proofs**: Cryptographically prove transaction validity without exposing details
- 💰 **UTXO Model**: Uses Bitcoin-style UTXOs for enhanced privacy on Ethereum
- 🌳 **Merkle Tree**: Maintains cryptographic commitments for proof generation
- 🔐 **Encrypted Data**: UTXO information encrypted, only decryptable by recipients

### How It Works:

1. **Shielding**: Users deposit ETH/ERC20 tokens into the zLink contract, creating UTXOs
2. **Private Transfer**: Generate zero-knowledge proofs to spend UTXOs without revealing sender
3. **Commitment**: Each UTXO gets a cryptographic commitment added to the Merkle tree
4. **Unshielding**: Withdraw funds back to a public Ethereum address when needed

### Why This Indexer is Needed:

The zLink protocol requires off-chain infrastructure to:

- **Track All UTXOs**: Users need to find their available UTXOs to spend
- **Maintain Merkle Tree**: ZK proofs require the complete tree state and paths
- **Provide Fast Queries**: Real-time access to commitments and tree indices
- **Support Multiple Users**: Centralized indexing serves all protocol participants

Without this indexer, users would need to scan the entire blockchain themselves, making the protocol impractical to use.

## ✨ Features

### Core Functionality

- **Real-time Blockchain Sync**: Continuously monitors and indexes new blocks from the zLink smart contract
- **Event Processing**: Decodes and indexes two critical zLink events:
  - `ShieldAssets`: Tracks public deposits (shielding) with token type, amount, and Merkle tree commitment
  - `UTXOsUpdate`: Indexes encrypted UTXO data for private transfers between users
- **UTXO Management**: Maintains a complete database of all UTXOs (both spent and unspent) for the protocol
- **Merkle Tree Synchronization**: Tracks all commitments and their tree indices for ZK proof generation
- **Checkpoint Management**: Automatic resume from last indexed block on restart (no data loss)
- **Batch Processing**: Configurable batch sizes for optimal performance and RPC efficiency

### Production-Ready Features

- ✅ **Graceful Shutdown**: SIGTERM/SIGINT handlers for safe termination
- ✅ **Error Recovery**: Automatic retry with exponential backoff
- ✅ **Data Integrity**: Checkpoint-first approach prevents duplicates
- ✅ **Database Indexes**: Optimized queries with compound unique indexes
- ✅ **Duplicate Prevention**: Unique constraints prevent reprocessing
- ✅ **Rate Limiting**: Configurable RPC request throttling
- ✅ **Health Monitoring**: HTTP health check endpoint

## 🏗️ Architecture

```
┌──────────────────────────────────────┐
│     zLink Smart Contract             │
│  (Ethereum Blockchain)                │
│                                       │
│  Events:                              │
│  - ShieldAssets (deposits)            │
│  - UTXOsUpdate (private transfers)    │
└────────────┬─────────────────────────┘
             │
             │ RPC Polling
             ▼
┌──────────────────────────────────────┐
│   BlockChainSync Service              │
│  - Monitors new blocks                │
│  - Fetches contract events            │
│  - Rate limiting & retry logic        │
└────────────┬─────────────────────────┘
             │
             │ Raw Event Logs
             ▼
┌──────────────────────────────────────┐
│   zLinkIndex Service                  │
│  - Decodes ShieldAssets events        │
│  - Decodes UTXOsUpdate events         │
│  - Extracts commitments & tree data   │
│  - Manages sync checkpoint            │
└────────────┬─────────────────────────┘
             │
             │ Structured UTXO Data
             ▼
┌──────────────────────────────────────┐
│      MongoDB Database                 │
│                                       │
│  Collections:                         │
│  - leafs (Merkle tree commitments)    │
│  - unspents (UTXO data)               │
│  - indexer_check_point (sync state)   │
└────────────┬─────────────────────────┘
             │
             │ Query Interface
             ▼
┌──────────────────────────────────────┐
│    REST API Server (Port 8323)        │
│                                       │
│  Endpoints:                           │
│  - GET /utxos (fetch UTXOs)           │
│  - GET /commitments/:treeIndex        │
│  - GET /treeIndex/:commitment         │
│  - GET /health (indexer status)       │
└────────────┬─────────────────────────┘
             │
             │ Used By
             ▼
┌──────────────────────────────────────┐
│   zLink Wallets & Applications        │
│  - Construct private transactions     │
│  - Generate zero-knowledge proofs     │
│  - Query available UTXOs              │
│  - Get Merkle tree paths              │
└──────────────────────────────────────┘
```

## 📦 Prerequisites

- **Node.js**: v16 or higher
- **MongoDB**: v6.0 or higher
- **Ethereum RPC**: Access to an Ethereum-compatible RPC endpoint
- **TypeScript**: v4.5 or higher

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd zlink-indexer
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## ⚙️ Configuration

Create a `.env` file in the root directory with the following variables:

```bash
# Blockchain Configuration
START_BLOCK=1                           # Starting block number for indexing
RPC_URL=https://your-rpc-endpoint.com  # Ethereum RPC endpoint
ZLINK_CONTRACT_ADDRESS=0x...           # zLink contract address

# Indexer Configuration
MAX_BLOCKS_PER_REQUEST=1000            # Blocks per batch (default: 1000)
BLOCK_DIFFERENCE=10                     # Minimum block difference to process
REQUESTS_PER_SECOND=5                   # RPC rate limit (default: 5)
MAX_RETRIES=3                           # Maximum retry attempts (default: 3)
RETRY_DELAY=1000                        # Delay between retries in ms (default: 1000)

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/zlink-index  # MongoDB connection string
```

### Configuration Parameters

| Parameter                | Description                         | Default  |
| ------------------------ | ----------------------------------- | -------- |
| `START_BLOCK`            | Block number to start indexing from | Required |
| `RPC_URL`                | Ethereum RPC endpoint URL           | Required |
| `ZLINK_CONTRACT_ADDRESS` | zLink smart contract address        | Required |
| `MAX_BLOCKS_PER_REQUEST` | Maximum blocks to fetch per batch   | 1000     |
| `REQUESTS_PER_SECOND`    | RPC request rate limit              | 5        |
| `MAX_RETRIES`            | Retry attempts on failure           | 3        |
| `RETRY_DELAY`            | Delay between retries (ms)          | 1000     |
| `MONGODB_URI`            | MongoDB connection string           | Required |

## 🎮 Usage

### Start the Indexer

```bash
npm run sync
```

The indexer will:

1. Connect to MongoDB and create necessary indexes
2. Load the last checkpoint (if exists)
3. Start syncing from the checkpoint or `START_BLOCK`
4. Launch the REST API server on port 8323
5. Continuously monitor for new blocks

### Graceful Shutdown

To stop the indexer gracefully:

```bash
# Ctrl+C or send SIGTERM
kill -SIGTERM <process_id>
```

The indexer will:

- Complete the current block processing
- Save the checkpoint
- Close database connections
- Exit cleanly

## 📡 API Documentation

The REST API runs on `http://localhost:8323` and provides essential data access for zLink wallets and applications.

### Health Check

**Endpoint**: `GET /health`

**Description**: Check indexer status and sync progress. Use this to ensure the indexer is caught up before generating zero-knowledge proofs.

**Response**:

```json
{
  "isSuccess": true,
  "data": {
    "lastIndexedBlock": 12345678,
    "latestBlock": 12345700,
    "difference": 22
  }
}
```

---

### Get UTXOs

**Endpoint**: `GET /utxos`

**Description**: Retrieve UTXOs for transaction construction. Wallets use this endpoint to fetch available UTXOs for spending in private transactions.

**UTXO Types**:

- **Encrypted UTXOs**: Created during private transfers (`UTXOsUpdate` events). Only the recipient can decrypt these using their private key.
- **Unencrypted UTXOs**: Created during shielding (`ShieldAssets` events). These contain public deposit information (token, amount, nonce).

**Query Parameters**:

- `start` (optional): Starting index for pagination (default: 0)
- `end` (optional): Number of records to fetch (default: 100)
- `utxos_type` (required): Type of UTXOs - `"encrypted"` or `"unencrypted"`

**Example Request**:

```bash
curl "http://localhost:8323/utxos?start=0&end=10&utxos_type=encrypted"
```

**Response**:

```json
{
  "isSuccess": true,
  "data": {
    "start": 0,
    "end": 10,
    "total": 150,
    "remaining": true,
    "result": ["0x1234...", "0x5678..."]
  }
}
```

**Notes**:

- Maximum limit: 1100 records per request
- Encrypted UTXOs return raw hex data
- Unencrypted UTXOs return JSON-encoded hex data

---

### Get Commitments by Tree Index

**Endpoint**: `GET /commitments/:treeIndex`

**Description**: Retrieve all commitment hashes at a specific tree index in the Merkle tree. Used by wallets to reconstruct Merkle tree paths required for zero-knowledge proof generation.

**Use Case**: When spending a UTXO, the wallet needs to prove that the commitment exists in the Merkle tree without revealing which commitment. This endpoint provides the data needed to construct that proof.

**URL Parameters**:

- `treeIndex`: Tree index number (level in the Merkle tree)

**Example Request**:

```bash
curl "http://localhost:8323/commitments/42"
```

**Response**:

```json
{
  "isSuccess": true,
  "data": ["0xabcdef123456...", "0x789012345678..."]
}
```

---

### Get Tree Index by Commitment

**Endpoint**: `GET /treeIndex/:commitment`

**Description**: Look up the tree index for a specific commitment hash. Used to verify if a commitment exists in the Merkle tree and find its position for proof construction.

**Use Case**: Before spending a UTXO, wallets need to find where the commitment is located in the Merkle tree. This endpoint performs a reverse lookup from commitment to tree index.

**URL Parameters**:

- `commitment`: Commitment hash (hex string with 0x prefix)

**Example Request**:

```bash
curl "http://localhost:8323/treeIndex/0xabcdef123456..."
```

**Response**:

```json
{
  "isSuccess": true,
  "data": {
    "treeIndex": "42"
  }
}
```

---

### Error Responses

All endpoints return standard error responses:

```json
{
  "isSuccess": false,
  "message": "Error description"
}
```

**Common HTTP Status Codes**:

- `200`: Success
- `400`: Bad request (invalid parameters)
- `404`: Route not found
- `500`: Internal server error

## 🔧 Production Features

### 1. Data Integrity

**Checkpoint-First Approach**:

- Checkpoint is saved **before** indexing data
- On crash/restart, blocks are skipped (duplicates prevented)
- Unique indexes ensure no duplicate records

```typescript
// Order of operations:
1. updateCheckPoint()  // Mark blocks as processed
2. index(data)         // Save data (duplicates ignored)
```

### 2. Error Handling

**Automatic Recovery**:

- Failed batches are automatically retried
- Exponential backoff prevents RPC overload
- Fatal errors are logged and recovered

**No Stack Overflow**:

- Loop-based error handling (no recursion)
- Infinite retry capability without memory leaks

### 3. Database Indexes

**Performance Optimization**:

**Leafs Collection**:

```javascript
{ txid: 1, index: 1, blockNumber: 1 }  // Unique, prevents duplicates
{ commitment: 1 }                       // Query by commitment
{ treeIndex: 1 }                        // Query by tree index
{ blockNumber: 1 }                      // Range queries
```

**Unspents Collection**:

```javascript
{ txid: 1, blockNumber: 1 }  // Unique, prevents duplicates
{ blockNumber: 1 }            // Range queries
{ isEncrypted: 1 }            // Filter by type
```

### 4. Monitoring

**Health Checks**:

- `/health` endpoint shows sync status
- Monitor `difference` field for lag detection
- Set up alerts when difference > threshold

**Logging**:

- Structured logging with levels (info, warn, error)
- Operation tracking with timestamps
- Error stack traces for debugging

## 🛠️ Troubleshooting

### Indexer Not Syncing

**Issue**: Indexer stuck or not processing blocks

**Solutions**:

1. Check RPC endpoint connectivity:

   ```bash
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     $RPC_URL
   ```

2. Verify MongoDB connection:

   ```bash
   mongosh $MONGODB_URI
   ```

3. Check logs for errors:

   ```bash
   npm run sync 2>&1 | tee indexer.log
   ```

4. Reset checkpoint (if corrupted):
   ```javascript
   // In MongoDB shell
   db.indexer_check_point.deleteOne({ id: "checkPoint" });
   ```

---

### Duplicate Key Errors

**Issue**: MongoDB throws duplicate key errors

**Cause**: Normal behavior when reprocessing blocks

**Solution**: Already handled! The indexer uses `ordered: false` and catches duplicate errors gracefully. No action needed.

---

### High Memory Usage

**Issue**: Indexer consuming too much memory

**Solutions**:

1. Reduce batch size in `.env`:

   ```bash
   MAX_BLOCKS_PER_REQUEST=500
   ```

2. Increase rate limiting:
   ```bash
   REQUESTS_PER_SECOND=3
   ```

---

### API Returns No Data

**Issue**: API endpoints return empty results

**Solutions**:

1. Check if indexer has synced:

   ```bash
   curl http://localhost:8323/health
   ```

2. Verify MongoDB collections:

   ```javascript
   // In MongoDB shell
   db.leafs.countDocuments();
   db.unspents.countDocuments();
   ```

3. Check contract address is correct in `.env`

---

### RPC Rate Limiting

**Issue**: RPC provider blocking requests

**Solutions**:

1. Reduce request rate:

   ```bash
   REQUESTS_PER_SECOND=2
   ```

2. Use multiple RPC endpoints (implement round-robin)

3. Contact RPC provider for higher limits

---

## 📊 Database Schema

### Collections

#### `leafs` - Merkle Tree Commitments

Stores all commitment hashes added to the zLink Merkle tree. Each commitment represents a UTXO in the privacy set.

```javascript
{
  _id: ObjectId,
  blockNumber: Number,     // Block when commitment was added
  index: Number,           // Log index in the block
  txid: String,            // Transaction hash
  commitment: String,      // Cryptographic commitment (hex string)
  treeIndex: BigInt        // Position in the Merkle tree
}
```

**Purpose**: Enable zero-knowledge proof generation by providing Merkle tree structure and paths.

---

#### `unspents` - UTXO Data

Stores UTXO information for both public (shielding) and private (transfer) transactions.

```javascript
{
  _id: ObjectId,
  blockNumber: Number,           // Block when UTXO was created
  txid: String,                  // Transaction hash
  isEncrypted: Boolean,          // true = private transfer, false = shielding

  // For encrypted UTXOs (private transfers)
  encryptedUTXO: String,         // Encrypted UTXO data (hex string)

  // For unencrypted UTXOs (shielding)
  UTXOs: {
    shield_address: String,      // Shield contract address
    amount: String,              // Token amount
    nonce: String,               // Unique nonce
    token: String                // Token contract address
  }
}
```

**Purpose**: Provide UTXO data for transaction construction. Wallets decrypt encrypted UTXOs to find their spendable funds.

---

#### `indexer_check_point` - Sync State

Tracks the indexer's synchronization progress with the blockchain.

```javascript
{
  _id: ObjectId,
  id: "checkPoint",            // Fixed identifier
  lastIndexedBlock: Number,    // Last fully processed block
  latestBlock: Number          // Latest known blockchain block
}
```

**Purpose**: Enable reliable restart and recovery without reprocessing all blocks.

---

## 🚀 Deployment

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "run", "sync"]
```

Build and run:

```bash
docker build -t zlink-indexer .
docker run -d --name zlink-indexer \
  --env-file .env \
  -p 8323:8323 \
  zlink-indexer
```

### Docker Compose

```yaml
version: "3.8"

services:
  mongodb:
    image: mongo:6
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  zlink-indexer:
    build: .
    depends_on:
      - mongodb
    env_file:
      - .env
    ports:
      - "8323:8323"
    restart: unless-stopped

volumes:
  mongodb_data:
```

---

## 🔒 Privacy & Security Considerations

### What This Indexer Knows

The indexer has access to:

- ✅ All UTXO commitments (but not which address owns them)
- ✅ Encrypted UTXO data (but cannot decrypt without recipient's private key)
- ✅ Public shielding events (token type, amount - this is visible on-chain)
- ✅ Timing information (when transactions occurred)

### What This Indexer Does NOT Know

The indexer cannot determine:

- ❌ **Who owns which UTXO** - Ownership is cryptographically hidden
- ❌ **Who sent to whom** - Sender and recipient addresses are anonymous
- ❌ **Transaction amounts in private transfers** - Amounts are encrypted
- ❌ **UTXO spending patterns** - Cannot link spends to specific users

### Privacy Model

The zLink protocol maintains privacy through:

1. **Commitment Scheme**: UTXOs are represented by cryptographic commitments, hiding ownership
2. **Zero-Knowledge Proofs**: Spending is proven valid without revealing the spender
3. **Encryption**: Private transfer amounts and recipients are encrypted
4. **Anonymity Set**: All commitments in the Merkle tree form the privacy set

**Important**: The indexer is a convenience service. Users could run their own indexer or scan the blockchain directly without compromising privacy.

---

## 🌐 Integration with zLink Ecosystem

### For Wallet Developers

```javascript
// Example: Fetching encrypted UTXOs for a user
const response = await fetch(
  "http://localhost:8323/utxos?start=0&end=100&utxos_type=encrypted"
);
const { data } = await response.json();

// Try to decrypt each UTXO with user's private key
for (const encryptedUTXO of data.result) {
  const utxo = tryDecrypt(encryptedUTXO, userPrivateKey);
  if (utxo) {
    // This UTXO belongs to the user!
    spendableUTXOs.push(utxo);
  }
}
```

### For ZK Proof Generators

```javascript
// Example: Getting Merkle tree data for proof generation
const commitment = "0xabc...";

// 1. Find tree index for the commitment
const { data: treeData } = await fetch(
  `http://localhost:8323/treeIndex/${commitment}`
).then((r) => r.json());

// 2. Get all commitments at that tree level
const { data: commitments } = await fetch(
  `http://localhost:8323/commitments/${treeData.treeIndex}`
).then((r) => r.json());

// 3. Construct Merkle proof path
const merklePath = constructMerklePath(commitments, commitment);

// 4. Generate ZK proof with the path
const proof = generateZKProof(utxo, merklePath, ...);
```

---

## 📊 Performance & Scalability

### Current Capabilities

- **Throughput**: Handles 1000+ blocks per batch
- **Storage**: Grows linearly with UTXO count (~1KB per UTXO)
- **Query Speed**: Sub-second responses with database indexes
- **Sync Speed**: Depends on RPC endpoint limits and batch size

### Scaling Recommendations

**For High Traffic**:

- Use MongoDB replica sets for read scaling
- Add connection pooling (currently single connection)
- Deploy multiple indexer instances behind a load balancer
- Consider caching frequently accessed data (Redis)

**For Large Datasets**:

- Implement pagination for all endpoints
- Add time-based queries (filter by block range)
- Archive old data to separate collections
- Use MongoDB sharding for multi-terabyte datasets

---

## 📝 License

[Specify your license here]

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

### Development Priorities

- [ ] WebSocket support for real-time updates
- [ ] GraphQL API for flexible queries
- [ ] Spent UTXO tracking (currently tracks all UTXOs)
- [ ] Multiple RPC endpoint failover
- [ ] Prometheus metrics export
- [ ] Docker image publication

---

## 📞 Support

For issues and questions:

- Open a GitHub issue
- Check existing documentation
- Review troubleshooting section

---

**Built with ❤️ for privacy-preserving transactions on Ethereum**

**Disclaimer**: This indexer is infrastructure for the zLink privacy protocol. It maintains privacy by design but should be operated by trusted parties or run locally for maximum security.
