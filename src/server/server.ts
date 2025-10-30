import express from "express";
import cors from "cors";
import getLeafs from "./get-leafs";
import getUTXOs from "./get-utxos";
import getTreeIndex from "./get-treeIndex";
import { IndexerCollection } from "../shared/database/unspent-collection";
import { submitTX } from "./submit-tx";
import bodyParser from "body-parser";
import config from "../config";

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.route("/utxos").get(getUTXOs);
app.route("/commitments/:treeIndex").get(getLeafs);
app.route("/treeIndex/:commitment").get(getTreeIndex);
app.route("/health").get(async (req, res) => {
  const collection = await IndexerCollection.initilize();

  const checkPoint = await collection.getCheckPoint();

  if (!checkPoint) {
    return res
      .status(500)
      .json({ isSuccess: false, message: "Indexer not initialized" });
  }
  const data = {
    lastIndexedBlock: checkPoint.lastIndexedBlock,
    latestBlock: checkPoint.latestBlock,
    difference: checkPoint.latestBlock - checkPoint.lastIndexedBlock,
  };
  return res.status(200).json({ isSuccess: true, data: data });
});

//for relayer

app.route("/relayer/submit-proof/:methods").post(submitTX);

app.use((req, res, next) => {
  res.status(404).send("Route Not found");
});
app.listen(config.http_port, () => {
  console.log("Server is running on port 8323");
});
