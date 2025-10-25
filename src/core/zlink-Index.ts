import {
  IIndexDecodedResponse,
  ILogRawData,
  LeafCollectionDB,
  UTXOsCollectionDB,
} from "../types";
import EtherDecoder from "./decoder";
import { TOPIC_SHIELD_ASSETS, TOPIC_UTXOS_UPDATE } from "../config";
import LeafCollection from "../shared/database/leaf-collection";
import UnspentCollection, {
  IndexerCollection,
} from "../shared/database/unspent-collection";
import { logger } from "../shared/logger";

class zLinkIndex {
  private IndexerCollection: IndexerCollection | undefined;
  private LeafCollection: LeafCollection | undefined;
  private UnspentCollection: UnspentCollection | undefined;

  async index(logs: ILogRawData[]) {
    const results = await Promise.all(
      logs.map(async (log) => await this.processLog(log))
    );

    if (!results.length) return;

    const filteredResults = results.filter((result) => result !== undefined);

    await this.IndexOnDB(filteredResults);
  }

  public async updateCheckPoint(LastIndexedBlock: number, latestBlock: number) {
    if (!this.IndexerCollection) {
      this.IndexerCollection = await IndexerCollection.initilize();
    }

    await this.IndexerCollection.updateCheckPoint(
      LastIndexedBlock,
      latestBlock
    );
  }

  private async IndexOnDB(results: IIndexDecodedResponse[]) {
    //extract data,

    const Leafs: LeafCollectionDB[] = [];
    const Unspents: UTXOsCollectionDB[] = [];

    for (const result of results) {
      Leafs.push({
        blockNumber: Number(result.blockNumber),
        txid: result.txid,
        index: result.index,
        commitment: result.leaf.commitment,
        treeIndex: result.leaf.treeIndex,
      });

      if (result.type === "SHIELD_ASSETS") {
        Unspents.push({
          UTXOs: result.utxos,
          isEncrypted: false,
          blockNumber: Number(result.blockNumber),
          txid: result.txid,
        });
        continue;
      } else if (result.type === "UTXOS_UPDATE") {
        Unspents.push({
          encryptedUTXO: result.encryptedUTXO,
          isEncrypted: true,
          blockNumber: Number(result.blockNumber),
          txid: result.txid,
        });
      }
    }

    //push to db

    if (Leafs.length > 0) {
      logger.info(`Inserting ${Leafs.length} leaves into database`);
      if (!this.LeafCollection) {
        this.LeafCollection = await LeafCollection.initilize();
      }
      await this.LeafCollection.insertLeaf(Leafs);
    }

    if (Unspents.length > 0) {
      logger.info(`Inserting ${Unspents.length} unspent into database`);
      if (!this.UnspentCollection) {
        this.UnspentCollection = await UnspentCollection.initilize();
      }
      //only insert unspent from block 9486466 onwards (For testing purposes)
      const unspentsToInsert = Unspents.filter((d) => d.blockNumber >= 9486466);
      await this.UnspentCollection.insertUTXOs(unspentsToInsert);
    }
  }

  private async processLog(log: ILogRawData) {
    const topic = log.topics[0];

    switch (topic) {
      //abi = ShieldAssets(indexed address shield_address, indexed address commitment, indexed address token, uint256 amount, uint256 nonce, uint256 treeIndex)
      case TOPIC_SHIELD_ASSETS:
        return await this.decodeShieldAssetsEvent(log);
      //abi = ShieldUTXOsUpdate (indexed bytes32 commitment, bytes encryptedUTXO, uint256 treeIndex)
      case TOPIC_UTXOS_UPDATE:
        return await this.decodeUTXOsUpdateEvent(log);
      default:
        return;
    }
  }

  private async decodeUTXOsUpdateEvent(log: ILogRawData) {
    const commitment_hex = log.topics[1]!;
    const commitment = EtherDecoder.decode(commitment_hex, "bytes32");

    const dataDecoded = EtherDecoder.decode(log.data, ["bytes", "uint256"]);

    if (!commitment.success || !dataDecoded.success) {
      throw new Error("Faild to decode UTXOsUpdate log");
    }

    return {
      blockNumber: Number(log.blockNumber),
      index: Number(log.logIndex),
      txid: log.transactionHash,
      type: "UTXOS_UPDATE",
      encryptedUTXO: dataDecoded.data?.[0]?.result.data,
      leaf: {
        commitment: commitment.data,
        treeIndex: BigInt(dataDecoded.data?.[1]?.result.data),
      },
    } as IIndexDecodedResponse;
  }

  private async decodeShieldAssetsEvent(log: ILogRawData) {
    const shield_address_hex = log.topics[1]!;
    const commitment_hex = log.topics[2]!;
    const token_hex = log.topics[3]!;

    const shield_address = EtherDecoder.decode(shield_address_hex, "bytes32");
    const commitment = EtherDecoder.decode(commitment_hex, "bytes32");
    const token = EtherDecoder.decode(token_hex, "address");

    const data = EtherDecoder.decode(log.data, [
      "uint256",
      "uint256",
      "uint256",
    ]);

    const amount = String(data.data?.[1]?.result.data);
    const nonce = String(data.data?.[0]?.result.data);
    const treeIndex = String(data.data?.[2]?.result.data);

    if (
      !shield_address.success ||
      !commitment.success ||
      !token.success ||
      !data.success
    ) {
      throw new Error("Faild to decode ShieldAssets log");
    }

    const data_ = {
      shield_address: shield_address.data,
      commitment: commitment.data,
      token: token.data,
      amount,
      nonce,
      treeIndex,
    };

    return {
      blockNumber: Number(log.blockNumber),
      index: Number(log.logIndex),
      txid: log.transactionHash,
      type: "SHIELD_ASSETS",

      utxos: {
        shield_address: data_.shield_address,
        amount: data_.amount,
        nonce: data_.nonce,
        token: data_.token,
      },
      leaf: {
        commitment: data_.commitment,
        treeIndex: BigInt(data_.treeIndex),
      },
    } as IIndexDecodedResponse;
  }
}

export default zLinkIndex;
