import config from "../../config";
import { Db, MongoClient } from "mongodb";

if (!config.mongodbURI) {
  throw new Error("MONGODB_URI is not set");
}

let db: Db;

async function connectToDB() {
  if (db) return db;
  const client = new MongoClient(config.mongodbURI);
  try {
    await client.connect();
  } catch (error) {
    throw new Error("Failed to connect to MongoDB");
  }
  db = client.db("zlink-index");
  return db;
}

export default connectToDB;
