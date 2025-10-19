import { Request, Response } from "express";
import UnspentCollection from "../shared/database/unspent-collection";

const getUTXOs = async (req: Request, res: Response) => {
  try {
    const start = (req.query["start"] as string) || 0;
    const end = (req.query["end"] as string) || 100;
    const utxos_type = req.query["utxos_type"] as string | "encrypted";

    if (utxos_type !== "encrypted" && utxos_type !== "unencrypted") {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Invalid utxos type" });
    }

    const MAX_LIMIT = 1100;

    if (Number(start) - Number(end) > MAX_LIMIT) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Max limit exceeded" });
    }

    const collection = await UnspentCollection.initilize();

    const utxos = await collection.getUTXOs(
      Number(start),
      Number(end),
      utxos_type === "encrypted"
    );

    const totalData = await collection.totalUTXOsCount(
      utxos_type === "encrypted"
    );

    const onlyData = utxos
      .map((utxo) => {
        if (utxos_type === "encrypted") {
          if (!utxo.encryptedUTXO) return null;
          return utxo.encryptedUTXO;
        } else {
          if (!utxo.UTXOs) return null;
          return Buffer.from(JSON.stringify(utxo.UTXOs)).toString("hex");
        }
      })
      .filter((utxo) => utxo !== null);

    return res.status(200).json({
      isSuccess: true,
      data: {
        start: Number(start),
        end: Number(end),
        total: totalData,
        remaining: totalData - Number(end) > 0,
        result: onlyData,
      },
    });
  } catch (error) {
    return res
      .status(500)
      .json({ isSuccess: false, message: "Internal server error" });
  }
};

export default getUTXOs;
