import { ethers } from "ethers";
import config from "../config";
import { proofHelper } from "../shared/helper";
import simulateZLink from "./compute-proof";

const ZLINK_CONTRACT_ABI: string[] = [
  "function unshieldNative((uint256[2] pi_a, uint256[2][2] pi_b, uint256[2] pi_c) proof, uint256[7] publicSignals, bytes encryptedUTXOsUpdate) returns (bool)",
  "function transferShieldedAssets((uint256[2] pi_a, uint256[2][2] pi_b, uint256[2] pi_c) proof, uint256[50] publicSignals, bytes[20] encryptedUTXOsUpdates, address receiver) payable returns (bool)",
];

class ZLinkContract {
  private contract_address: string;

  constructor(_contractAddress: string) {
    this.contract_address = _contractAddress;
  }

  public async transferShieldedNative(
    proof: any,
    publicSignals: any,
    encryptedUTXOsUpdates: any
  ) {
    const zlinkSimulator = new simulateZLink();
    await zlinkSimulator.simulatePrivateTransfer(
      publicSignals,
      encryptedUTXOsUpdates
    );

    const contract = await this.getContract();
    if (!contract) return;

    try {
      const tx = await contract["transferShieldedAssets"]!(
        proofHelper(proof),
        publicSignals,
        encryptedUTXOsUpdates
      );
      return tx?.hash ?? null;
    } catch (error: unknown) {
      //@ts-ignore
      console.log((error as Error).message);
      return null;
    }
  }

  public async unshieldNative(
    proof: any,
    publicSignals: any,
    encryptedUTXOsUpdate: any,
    receiver: string
  ) {
    const contract = await this.getContract();
    if (!contract) return;

    try {
      // Use bracket notation to access the contract method
      const tx = await contract["unshieldNative"]!(
        proofHelper(proof),
        publicSignals,
        encryptedUTXOsUpdate,
        receiver
      );
      return tx?.hash ?? null;
    } catch (error) {
      console.log(error);
      return null;
    }
  }

  private async getContract() {
    const provider = new ethers.JsonRpcProvider(config.rpc_url);
    const wallet = new ethers.Wallet(config.private_key!, provider);
    const contract = new ethers.Contract(
      this.contract_address,
      ZLINK_CONTRACT_ABI,
      wallet
    );
    return contract;
  }
}

export default ZLinkContract;
