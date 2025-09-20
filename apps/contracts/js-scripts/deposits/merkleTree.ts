import MemoryStore from "@accumulators/memory";
import Mmr from "@accumulators/merkle-mountain-range";
import { Fr } from "@aztec/bb.js";
import { Poseidon2Hasher } from "./Poseidon2Hasher";
import { assert } from "console";

export class MerkleTree {
  private store: MemoryStore;
  private hasher: Poseidon2Hasher;
  private mmr: Mmr;
  private elementIndexMap: Map<string, number> = new Map();

  constructor() {
    this.store = new MemoryStore();
    this.hasher = new Poseidon2Hasher();
    this.mmr = new Mmr(this.store, this.hasher);
  }

  async init(defaultLeaves: string[] = []) {
    for (const leaf of defaultLeaves) {
      await this.append(leaf);
    }
  }

  async append(value: string) {
    const x = this.mod(value);
    const { elementIndex } = await this.mmr.append(x.toString());
    this.elementIndexMap.set(x.toString(), elementIndex);
    return { elementIndex, x };
  }

  getIndex(value: string) {
    const x = this.mod(value);
    return this.elementIndexMap.get(x.toString())!;
  }

  async genProof(elementIndex: number, orderHash: string) {
    const x = this.mod(orderHash);
    const proof = await this.mmr.getProof(elementIndex);
    const isValid = await this.mmr.verifyProof(proof, x.toString());
    assert(isValid, "Invalid proof generated");
    return proof;
  }

  async getRoot() {
    return await this.mmr.rootHash.get();
  }

  private mod(n: string) {
    const buff = Buffer.from(n.replace(/^0x/i, ""), "hex");
    return Fr.fromBufferReduce(buff);
  }
}

export async function merkleTree(leaves: string[]) {
  const tree = new MerkleTree();

  // Initialize tree with no leaves (all zeros)
  await tree.init();

  // Insert some leaves (from input)
  for (const leaf of leaves) {
    await tree.append(leaf);
  }

  return tree;
}
