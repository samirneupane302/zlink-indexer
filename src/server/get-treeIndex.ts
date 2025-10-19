import { Request, Response } from "express";
import LeafCollection from "../shared/database/leaf-collection";

const getTreeIndex = async (req: Request, res: Response) => {
  try {
    const commitment = (req.params["commitment"] as string) || "";
    if (!commitment.length) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Commitment is required" });
    }

    const collection = await LeafCollection.initilize();

    const treeIndex = await collection.getCommitmentLeafIndex(commitment);

    if (!treeIndex) {
      return res
        .status(200)
        .json({ isSuccess: false, message: "No tree index found" });
    }

    return res
      .status(200)
      .json({ isSuccess: true, data: { treeIndex: treeIndex.treeIndex } });
  } catch (error) {
    return res
      .status(500)
      .json({ isSuccess: false, message: "Internal server error" });
  }
};

export default getTreeIndex;
