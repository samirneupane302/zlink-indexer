import { LeafCollectionDB } from "../../types";
import connectToDB from "./conn";
import UnspentCollection from "./unspent-collection";
import { Db } from "mongodb";

class LeafCollection extends UnspentCollection {
  constructor(_db: Db) {
    super(_db);
  }

  static override async initilize() {
    const db = await connectToDB();
    const instance = new LeafCollection(db);
    await instance.createLeafIndexes();
    return instance;
  }

  private async createLeafIndexes() {
    try {
      const collection = this.db.collection("leafs");

      // Create compound unique index to prevent duplicates
      await collection.createIndex(
        { txid: 1, index: 1, blockNumber: 1 },
        { unique: true, name: "txid_index_block_unique" }
      );

      // Index for querying by commitment
      await collection.createIndex(
        { commitment: 1 },
        { name: "commitment_idx" }
      );

      // Index for querying by treeIndex
      await collection.createIndex({ treeIndex: 1 }, { name: "treeIndex_idx" });

      // Index for querying by block number
      await collection.createIndex(
        { blockNumber: 1 },
        { name: "blockNumber_idx" }
      );
    } catch (error) {
      // Ignore duplicate key errors on index creation
      if ((error as any).code !== 11000) {
        throw error;
      }
    }
  }

  public async insertLeaf(leafs: LeafCollectionDB[]) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection("leafs");
      const insertResult = await collection.insertMany(leafs, {
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

  public async getCommitmentLeafIndex(commitment: string) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection<LeafCollectionDB>("leafs");
      const leaf = await collection.findOne({ commitment: commitment });
      return leaf;
    } catch (error) {
      throw new Error("Failed to get leaf from database");
    }
  }

  public async getLeaf(treeIndex: number) {
    try {
      if (!this.db) throw new Error("Database not initialized");
      const collection = this.db.collection<LeafCollectionDB>("leafs");
      const leaf = await collection
        .find({
          treeIndex: BigInt(treeIndex),
        })
        .toArray();
      return leaf;
    } catch (error) {
      throw new Error("Failed to get leaf from database");
    }
  }
}

export default LeafCollection;
