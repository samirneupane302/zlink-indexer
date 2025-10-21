import { ethers } from "ethers";
import config from "../config";
import { proofHelper } from "../shared/helper";

const ZLINK_CONTRACT_ABI: string[] = [
  "function unshieldNative((uint256[2] pi_a, uint256[2][2] pi_b, uint256[2] pi_c) proof, uint256[7] publicSignals, bytes encryptedUTXOsUpdate) returns (bool)",
];

class ZLinkContract {
  private contract_address: string;

  constructor(_contractAddress: string) {
    this.contract_address = _contractAddress;
  }

  public async unshieldNative(
    proof: any,
    publicSignals: any,
    encryptedUTXOsUpdate: any
  ) {
    const contract = await this.getContract();
    if (!contract) return;

    try {
      // Use bracket notation to access the contract method
      const tx = await contract["unshieldNative"]!(
        proofHelper(proof),
        publicSignals,
        encryptedUTXOsUpdate
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
