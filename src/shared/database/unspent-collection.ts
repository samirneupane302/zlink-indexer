import { Db } from "mongodb";
import connectToDB from "./conn";
import { IndexerCheckPoint, UTXOsCollectionDB } from "../../types";

class UnspentCollection {
  protected db: Db;

  constructor(_db: Db) {
    this.db = _db;
  }

  static async initilize() {
    const db = await connectToDB();
    const instance = new UnspentCollection(db);
    await instance.createIndexes();
    return instance;
  }

  private async createIndexes() {
    try {
      const collection = this.db.collection("unspents");

      // Create compound unique index to prevent duplicates
      await collection.createIndex(
        { txid: 1, blockNumber: 1 },
        { unique: true, name: "txid_block_unique" }
      );

      // Index for querying by block number
      await collection.createIndex(
        { blockNumber: 1 },
        { name: "blockNumber_idx" }
      );

      // Index for encrypted vs unencrypted UTXOs
      await collection.createIndex(
        { isEncrypted: 1 },
        { name: "isEncrypted_idx" }
      );
    } catch (error) {
      // Ignore duplicate key errors on index creation
      if ((error as any).code !== 11000) {
        throw error;
      }
    }
  }

  public async insertUTXOs(encryptedUTXO: UTXOsCollectionDB[]) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection("unspents");
      const insertResult = await collection.insertMany(encryptedUTXO, {
        ordered: false, // Continue on duplicate key errors
      });
      return insertResult.acknowledged;
    } catch (error) {
      // If some documents were inserted despite errors, consider it a success
      if ((error as any).code === 11000 || (error as any).writeErrors) {
        return true;
      }
      throw new Error("Failed to insert data into MongoDB");
    }
  }

  public async totalUTXOsCount(isEncrypted: boolean) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection("unspents");
      const count = await collection.countDocuments({
        isEncrypted: isEncrypted,
      });
      return count;
    } catch (error) {
      throw new Error("Failed to get total UTXOs count");
    }
  }

  public async getUTXOs(start: number, limit: number, isEncrypted: boolean) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection<UTXOsCollectionDB>("unspents");
      const utxos = await collection
        .find({ isEncrypted: isEncrypted })
        .skip(start)
        .limit(limit)
        .toArray();
      return utxos;
    } catch (error) {
      throw new Error("Failed to get UTXOs");
    }
  }
}

class IndexerCollection extends UnspentCollection {
  constructor(_db: Db) {
    super(_db);
  }

  static override async initilize() {
    const db = await connectToDB();
    const instance = new IndexerCollection(db);
    await instance.createCheckpointIndexes();
    return instance;
  }

  private async createCheckpointIndexes() {
    try {
      const collection = this.db.collection("indexer_check_point");

      // Ensure unique checkpoint ID
      await collection.createIndex(
        { id: 1 },
        { unique: true, name: "checkpoint_id_unique" }
      );
    } catch (error) {
      // Ignore duplicate key errors on index creation
      if ((error as any).code !== 11000) {
        throw error;
      }
    }
  }

  public async updateCheckPoint(LastIndexedBlock: number, latestBlock: number) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection("indexer_check_point");

      //fetch checkpoint first

      const checkPoint = await this.getCheckPoint();

      //create checkpoint if not exists
      if (!checkPoint) {
        await collection.insertOne({
          id: "checkPoint",
          lastIndexedBlock: LastIndexedBlock,
          latestBlock: latestBlock,
        });
        return;
      }
      //update checkpoint if exists
      const updateResult = await collection.updateOne(
        { id: "checkPoint" },
        {
          $set: {
            lastIndexedBlock: LastIndexedBlock,
            latestBlock: latestBlock,
          },
        }
      );
      return updateResult.acknowledged;
    } catch (error) {
      throw new Error("Failed to update check point");
    }
  }

  public async getCheckPoint() {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection<IndexerCheckPoint>(
        "indexer_check_point"
      );
      const checkPoint = await collection.findOne({ id: "checkPoint" });
      return checkPoint;
    } catch (error) {
      throw new Error("Failed to get check point");
    }
  }
}

export default UnspentCollection;
export { IndexerCollection };
