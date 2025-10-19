import { Request, Response } from "express";
import LeafCollection from "../shared/database/leaf-collection";

const getLeafs = async (req: Request, res: Response) => {
  try {
    const treeIndex = (req.params["treeIndex"] as string) || 0;

    if (isNaN(Number(treeIndex))) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Invalid tree index" });
    }

    const collection = await LeafCollection.initilize();

    const leaf = await collection.getLeaf(Number(treeIndex));

    const filteredLeaf = leaf.map((leaf) => {
      return [leaf.commitment];
    });

    if (!filteredLeaf.flat().length) {
      return res.status(200).json({
        isSuccess: false,
        message: "No leaf found",
      });
    }

    return res.status(200).json({
      isSuccess: true,
      data: filteredLeaf.flat(),
    });
  } catch (error) {
    return res
      .status(500)
      .json({ isSuccess: false, message: "Internal server error" });
  }
};

export default getLeafs;
