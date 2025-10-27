import { keccak256 } from "ethers";

class simulateZLink {
  private fieldModule =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  private paddingOutputCommit =
    "0x29454785535387a69486462c163062cec40e59bd0fa8abd5ce153a7a7271ac41";

  public async simulatePrivateTransfer(
    publicSignals: string[],
    encryptedData: string[]
  ) {
    //extract the encrypted data hash from public sinnals

    const PublicSignalsEncryptedDataHashes: bigint[] = [];
    const OutputCommitments: string[] = [];

    for (let i = 0; i < 20; i++) {
      const commitment = publicSignals[i + 10];
      const encryptedDataHash = publicSignals[i + 30];

      if (!encryptedDataHash)
        throw new Error(
          `Encrypted data hash not found in public signals Index ${i + 30}`
        );
      OutputCommitments.push(
        "0x" + BigInt(commitment!).toString(16).padStart(64, "0")
      );
      PublicSignalsEncryptedDataHashes.push(BigInt(encryptedDataHash));
    }

    const encryptedDataHashes = encryptedData.map((data) =>
      BigInt(this.hashEncryptedData(data))
    );

    for (let i = 0; i < 20; i++) {
      //don't check the padding output commitment
      if (OutputCommitments[i] === this.paddingOutputCommit) continue;

      if (
        !this.isEncryptedDataValid(
          PublicSignalsEncryptedDataHashes[i]!,
          encryptedDataHashes[i]!
        )
      ) {
        throw new Error(`Encrypted data hash is not valid in Index ${i}`);
      }
    }
  }

  private hashEncryptedData(encryptedData: string) {
    return keccak256(encryptedData);
  }

  private isEncryptedDataValid(
    publicSignalHash: bigint,
    encryptedDataHash: bigint
  ) {
    return (
      publicSignalHash % this.fieldModule ===
      encryptedDataHash % this.fieldModule
    );
  }
}

export default simulateZLink;
