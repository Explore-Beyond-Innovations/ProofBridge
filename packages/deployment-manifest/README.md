# @proofbridge/deployment-manifest

Shared schema for the per-chain deployment manifests emitted by
`contracts/<chain>/deploy/` and consumed by the backend-relayer seeder.

A manifest is the canonical answer to "where did I deploy ProofBridge on
chain X, and what tokens does that deployment know about?" — one file
per chain per environment.

## Manifest shape

```jsonc
{
  "version": 1,
  "chain": {
    "name": "Sepolia",
    "kind": "EVM",             // "EVM" | "STELLAR"
    "chainId": "11155111"      // decimal string
  },
  "contracts": {
    "verifier":      { "address": "0x…", "addressBytes32": "0x0000…" },
    "merkleManager": { "address": "0x…", "addressBytes32": "0x0000…" },
    "wNativeToken":  { "address": "0x…", "addressBytes32": "0x0000…" },
    "adManager":     { "address": "0x…", "addressBytes32": "0x0000…" },
    "orderPortal":   { "address": "0x…", "addressBytes32": "0x0000…" }
  },
  "tokens": [
    {
      "pairKey": "eth",            // pairs with the same key on the peer chain
      "symbol": "ETH",
      "name": "Ether",
      "address": "0xEeee…eEeE",
      "addressBytes32": "0x0000…EeEe",
      "kind": "NATIVE",            // NATIVE | ERC20 | SAC | SEP41
      "decimals": 18,
      "assetIssuer": null,         // Stellar SAC only
      "isTestToken": false
    }
  ],
  "meta": {
    "deployedAt": "2026-04-19T12:00:00.000Z",
    "deployer":   "0x…",
    "commit":     "abc1234",
    "env":        "testnet"
  }
}
```

Every address carries both the **human** form (`address`) and the
**canonical 32-byte** form (`addressBytes32`). Cross-chain linking
always reads the bytes32 form so the caller doesn't care whether the
peer chain is EVM or Stellar.

## Usage

```ts
import {
  ChainDeploymentManifestSchema,
  readManifest,
  writeManifest,
} from "@proofbridge/deployment-manifest";
```

Both `readManifest` and `parseManifest` throw on schema violations, so
a malformed manifest can never slip through into the seeder.
