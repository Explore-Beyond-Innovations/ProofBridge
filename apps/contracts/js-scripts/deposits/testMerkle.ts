import MemoryStore from "@accumulators/memory";
import Mmr from "@accumulators/merkle-mountain-range";
import { Barretenberg, Fr } from "@aztec/bb.js";
import { Poseidon2Hasher } from "./Poseidon2Hasher";
import { toBeHex, zeroPadValue } from "ethers";

async function run() {
  const bb = await Barretenberg.new();

  const store = new MemoryStore();

  const hasher = new Poseidon2Hasher();

  const mmr = new Mmr(store, hasher);

  let lastElem = 0;
  let lastOrderHash = Fr.ZERO;
  for (let i = 0; i < 100000; i++) {
    let x = hex(i);
    let hash = await bb.poseidon2Hash([Fr.fromString(x)]);
    // console.log(hash.toString());
    const { elementIndex } = await mmr.append(hash.toString());
    if (elementIndex == 88929) {
      lastElem = elementIndex;
      lastOrderHash = hash;
    }
  }

  const proof = await mmr.getProof(lastElem);

  console.log(proof);

  const root = await mmr.rootHash.get();
  console.log("root: ", root);

  console.log(await mmr.verifyProof(proof, lastOrderHash.toString()));
}

const hex = (n: number) => {
  return zeroPadValue(toBeHex(n), 32);
};

(async () => {
  run()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
})();
