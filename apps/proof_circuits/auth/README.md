# Auth Proof Circuit

This is a Noir proof circuit that proves a user is authorized to execute a trade intent **without revealing the signature itself**. The verifier only needs the **hash** of that secret signature.

* We bind authorization to a user’s **ECDSA key** (secp256k1).
* The *actual* trade-intent signature remains private; only its hash is provided publicly.
* This design avoids “passwords” and keeps the secret unique to the user.

## Inputs

### Public inputs

* `nullifier_hash: pub Field` — hash of the private signature/secret (prevents reuse, links proof to intent).
* `ad_creator: pub Field` — ad creator address.
* `bridger: pub Field` — bridger address.
* `msg_hash: pub [u8; 32]` — 32-byte message hash associated with the intent.
* `ad_contract: pub bool` — if `true`, the **bridger** provides `nullifier_hash`; if `false`, the **ad_creator** provides it.

### Private inputs

* `ad_creator_pub_key: [u8; 65]` — uncompressed secp256k1 pubkey: `0x04 || X(32) || Y(32)`.
* `ad_creator_sig: [u8; 64]` — ECDSA signature **RS** only (drop `V`).
* `bridger_pub_key: [u8; 65]` — uncompressed secp256k1 pubkey.
* `bridger_sig: [u8; 64]` — ECDSA signature **RS** only (drop `V`).

> ℹ️ If your tool returns a 64-byte public key (just `X||Y`), prepend `0x04` to make it 65 bytes.

## Prerequisites

* **Node.js** ≥ 18 and **pnpm**
* **Noir / Nargo** (Noir CLI)
* **Barretenberg CLI** (`bb`)

> Install Noir/Nargo and `bb` using the official instructions for your platform.
> After installing, you should have `nargo --version` and `bb --version` working.

## Install JS dependencies

```bash
pnpm install
```

## Build & Check the Circuit

This compiles the circuit and prepares the target artifacts. It also ensures your input schema is valid (and typically generates/refreshes `Prover.toml` if you use Noir’s input annotations).

```bash
nargo check
```

## Provide Inputs

We've included a helper and a human-readable reference:

* `./scripts/inputs.txt` — a readable checklist of the required inputs.
* `./generate-inputs.sh` — fills `Prover.toml` with values based of data in inputs.txt.

Run:

```bash
./scripts/generate-inputs.sh
```

You can edit `./scripts/inputs.txt` to point at your own generated pubkeys/signatures.

> The nullifier hash will be generated in the script based on the ad_contract value.

## Execute to Produce a Witness

This computes the witness using your `Prover.toml` values.

```bash
nargo execute
```

This will create a witness artifact in `./target/`, commonly `./target/<package>.gz`.

---

## Prove with Barretenberg

Use `bb` with the ACIR and the witness:

```bash
# ACIR bytecode (JSON) and witness (.gz) are produced in ./target by nargo
bb prove \
  -b ./target/proof_circuit.json \
  -w ./target/proof_circuit.gz \
  -o ./target
```

This writes a proof artifact (e.g., `./target/proof` or similar, depending on your `bb` version).

### Verify

Generate a verification key, then verify the proof:

```bash
# Write a verification key from the ACIR
bb write_vk -b ./target/proof_circuit.json -o ./target

# Verify the proof with the VK
bb verify -k ./target/vk -p ./target/proof
```

---

## Project Layout

```text
.
├─ src/
|  |─ main.nr               # proof circuit
│  └─ utils.nr              # helper mod to split publickeys
├─ scripts/
│  ├─ inputs.txt            # readable input 
|  |─ hash.ts               # helper script to hash nullifier
│  └─ generate-inputs.sh    # populates Prover.toml
├─ Nargo.toml               
```
