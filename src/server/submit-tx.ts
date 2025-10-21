import { Request, Response } from "express";
import { SubmitTXRequest } from "../types";
import ZLinkContract from "../utils/zLink-Contract";
import config from "../config";

export const submitTX = async (req: Request, res: Response) => {
  try {
    if (!config.private_key) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Relayer is unavailable !!!" });
    }

    const methods = req.params["methods"] as string;

    if (methods !== "unshieldNative") {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Invalid method" });
    }
    const { proof, publicSignals, encryptedData } = req.body as SubmitTXRequest;

    if (!proof || !publicSignals || !encryptedData) {
      return res
        .status(400)
        .json({ isSuccess: false, message: "Invalid request" });
    }

    const zLinkContract = new ZLinkContract(config.zlink_contract_address);

    const proof_decoded = Buffer.from(proof, "base64").toString("utf-8");
    const publicSignals_decoded = Buffer.from(publicSignals, "base64").toString(
      "utf-8"
    );

    const txHash = await zLinkContract.unshieldNative(
      JSON.parse(proof_decoded),
      JSON.parse(publicSignals_decoded),
      encryptedData
    );

    if (!txHash) {
      return res
        .status(500)
        .json({ isSuccess: false, message: "Transaction failed" });
    }

    return res.status(200).json({ isSuccess: true, data: { txHash: txHash } });
  } catch (error) {
    console.log(error);
    return res
      .status(500)
      .json({ isSuccess: false, message: "Internal server error" });
  }
};
