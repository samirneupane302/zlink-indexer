import { keccak256 } from "ethers";

class simulateZLink {
  private fieldModule =
    21888242871839275222246405745257275088548364400416034343698204186575808495617n;
  private paddingOutputCommit =
    "0x13f768915c1ecd8736e113be0807a9b322814b6d8657ea145a2a8a2e29eebc76";

  public async simulatePrivateTransfer(
    publicSignals: string[],
    encryptedData: string[]
  ) {
    //extract the encrypted data hash from public sinnals

    const PublicSignalsEncryptedDataHashes: bigint[] = [];
    const OutputCommitments: string[] = [];

    for (let i = 0; i < 5; i++) {
      const commitment = publicSignals[i + 20];
      const encryptedDataHash = publicSignals[i + 25];

      if (!encryptedDataHash)
        throw new Error(
          `Encrypted data hash not found in public signals Index ${i + 25}`
        );
      OutputCommitments.push(
        "0x" + BigInt(commitment!).toString(16).padStart(64, "0")
      );
      PublicSignalsEncryptedDataHashes.push(BigInt(encryptedDataHash));
    }

    const encryptedDataHashes = encryptedData.map((data) =>
      BigInt(this.hashEncryptedData(data))
    );

    for (let i = 0; i < 5; i++) {
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
