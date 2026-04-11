import { MerkleMountainRange } from "../src/MMR";
import { Poseidon2Hasher } from "../src/Hasher";
import LevelDB from "../src/LevelDB";
import { keccak256, toUtf8Bytes } from "ethers";

/**
 * Helper function to hash data using keccak256 (to match Solidity test)
 */
function hashData(data: string): string {
  const bytes = toUtf8Bytes(data);
  const hash = keccak256(bytes);
  return hash;
}

/**
 * Helper to convert Buffer to hex string with 0x prefix
 */
function toHex(buf: Buffer): string {
  return "0x" + buf.toString("hex");
}

/**
 * Test MMR
 */
async function testMerkleMountainRange() {
  console.log("\n=== TypeScript MMR Test ===\n");

  // Setup
  const db = new LevelDB("./test-mmr-data");
  await db.init();

  const hasher = new Poseidon2Hasher();
  const mmr = new MerkleMountainRange("test-mmr", db, hasher);
  await mmr.init();

  try {
    // Hash data before appending (MMR expects pre-hashed values)
    // NOTE: Using keccak256 to match Solidity test

    const hash1 = hashData("0x0001"); // stored at index 1
    await mmr.append(hash1);

    const hash2 = hashData("0x0002"); // stored at index 2
    await mmr.append(hash2);

    const hash3 = hashData("0x0003");
    await mmr.append(hash3); // stored at index 4

    const hash4 = hashData("0x0004");
    await mmr.append(hash4); // stored at index 5

    const hash5 = hashData("0x0005");
    await mmr.append(hash5); // stored at index 8

    const hash6 = hashData("0x0006");
    await mmr.append(hash6); // stored at index 9

    const hash7 = hashData("0x0007");
    await mmr.append(hash7); // stored at index 11

    const hash8 = hashData("0x0008");
    await mmr.append(hash8); // stored at index 12

    const hash9 = hashData("0x0009");
    await mmr.append(hash9); // stored at index 16

    const hash10 = hashData("0x000a");

    let lastIndex = await mmr.append(hash10); // stored at index 17

    console.log(`last index: ${lastIndex}`);

    // Get merkle proof for index 9
    const proof = await mmr.getMerkleProof(lastIndex);

    console.log("\n=== Proof for index 17 ===");
    console.log("Root:", proof.root);
    console.log("Width:", proof.width);

    console.log("\nPeaks:");
    for (let i = 0; i < proof.peaks.length; i++) {
      console.log(proof.peaks[i]);
    }

    console.log("\nSiblings:");
    for (let i = 0; i < proof.siblings.length; i++) {
      console.log(proof.siblings[i]);
    }

    const isValid = mmr.verify(
      proof.root,
      proof.width,
      lastIndex,
      hash10,
      proof.peaks,
      proof.siblings,
    );

    if (!isValid) {
      throw new Error("Proof verification failed");
    }
    console.log("\nProof verified successfully");

    await db.close();
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.close();
  }
}

// Run test
testMerkleMountainRange()
  .then(() => {
    console.log("\nTest complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  });
