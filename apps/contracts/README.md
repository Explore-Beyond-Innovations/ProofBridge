# Proofbridge Contracts

A minimal pair of contracts for **peer-to-peer cross-chain settlement** using **zk proofs** and **EIP-712** order hashes.

* **AdManager** (destination chain): Makers (LPs) create “ads”, fund escrow, and lock liquidity against off-chain **orders**. When the proof verifies, funds are released to the order’s recipient on this chain.
* **OrderPortal** (source chain): Bridgers open **orders** by depositing the source token on this chain. The order hash is the canonical identifier shared across both sides.

The system uses a **minimal EIP-712 domain** (`name="Proofbridge"`, `version="1"`) and explicit chain/contract fields embedded in the struct to prevent replay.

## Contents

- [Proofbridge Contracts](#proofbridge-contracts)
  - [Contents](#contents)
  - [Architecture](#architecture)
  - [Contracts](#contracts)
    - [`AdManager`](#admanager)
    - [`OrderPortal`](#orderportal)
  - [Data Structures \& EIP-712](#data-structures--eip-712)
    - [Minimal domain (both contracts)](#minimal-domain-both-contracts)
    - [Order struct](#order-struct)
  - [Verifier public inputs](#verifier-public-inputs)
  - [Install \& Build](#install--build)
  - [Deploy](#deploy)
  - [Post-deploy configuration](#post-deploy-configuration)
  - [Security notes \& limits](#security-notes--limits)
    - [License](#license)

## Architecture

1. **Maker** creates an **Ad**, and funds it with the destination-chain token.
2. **Bridger** opens an **order** on **OrderPortal**, depositing the source-chain token.
3. The system relays the **order hash** to the maker off-chain; the maker locks an amount from the Ad against that order.
4. After the maker fulfills the user on the opposite chain, a **zk proof** is submitted to unlock:

   * On **OrderPortal**: release source-token to the **destination recipient** recorded in the order (if you route funds this way).
   * On **AdManager**: release **ad token** from escrow to the bridger’s designated recipient.

Replay is prevented via:

* **EIP-712 struct hash** that binds chain ids and contract addresses.
* A **nullifier** recorded once per successful proof.

## Contracts

### `AdManager`

* Makers **create/fund/close** Ads.
* **Route/chain checks**: verifies the source chain and OrderPortal, plus token routing (order token ↔ ad token).
* **`lockForOrder`**: reserves liquidity for a specific EIP-712 order hash.
* **`unlock`**: verifies proof via `IVerifier`, consumes nullifier, transfers ad token to the **orderRecipient**.

Key storage:

* `chains[orderChainId] → { supported, orderPortal }`
* `tokenRoute[adToken][orderChainId] → orderToken`
* `ads[adId] → { maker, token, balance, locked, open, … }`
* `orders[orderHash] → Status`
* `nullifierUsed[hash] → bool`

### `OrderPortal`

* Bridgers **createOrder** by depositing `token1` (this chain’s token).
* **Route/chain checks**: validates destination chain, counterpart AdManager, and token routing (`token1` → `token2`).
* **`unlock`**: verifies proof, consumes nullifier, transfers `token1` to the **dstRecipient**.

Key storage:

* `chains[dstChainId] → { supported, adManager }`
* `tokenRoute[token1][dstChainId] → token2`
* `orders[orderHash] → Status`
* `nullifierUsed[hash] → bool`

## Data Structures & EIP-712

### Minimal domain (both contracts)

* **Domain**: `EIP712Domain(string name, string version)`

  * `name = "Proofbridge"`
  * `version = "1"`

> **Note:** We do **not** include `chainId` or `verifyingContract` in the domain. Instead, those values are explicit fields in the struct.

### Order struct

```solidity
  struct Order {
      address orderToken;
      address adToken;
      uint256 amount;
      address bridger;
      uint256 orderChainId;
      address orderPortal;
      address orderRecipient;
      uint256 adChainId;
      address adManager;
      uint256 adId;
      address adCreator;
      address adRecipient;
      uint256 salt;
  }
```

Semantics (portal side):

* `token1`: source token (this chain)
* `token2`: expected destination token
* `srcChainId`: **this** chain id
* `srcOrderPortal`: **this** contract address
* `dstChainId`, `dstAdManager`: counterpart config on destination chain
* `dstAdId`, `dstAdCreator`, `dstRecipient`: destination details
* `srcRecipient`: informational field (e.g., maker’s recipient on order chain)
* `salt`: caller-controlled nonce

Semantics (ad side):

* `orderChainToken`: source token (order chain)
* `adChainToken`: token escrowed on this chain
* `orderChainId`, `orderPortal`: counterpart config of order chain
* `adChainId`: **this** chain id
* `adManager`: **this** contract address
* `orderRecipient`: recipient on this chain for portal-side payout logic (if mirrored)
* `adId`, `adCreator`, `adRecipient`: ad identity and payout details
* `salt`: caller-controlled nonce

## Verifier public inputs

The circuit accepts the following **public inputs**:

* **OrderPortal.unlock**:

  1. `adCreator's nullifierHash`
  2. `bytes32(uint160(adCreator))`
  3. `bytes32(uint160(bridger))`
  4. `orderHash`
  5. `bytes32(0)`

* **AdManager.unlock**:

  1. `bridger's nullifierHash`
  2. `bytes32(uint160(adCreator))`
  3. `bytes32(uint160(bridger))`
  4. `orderHash`
  5. `bytes32(1)`

## Install & Build

```bash
# clone & enter
git clone https://github.com/Explore-Beyond-Innovations/ProofBridge.git && cd ProofBridge/apps/contracts

# foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# deps
forge install

# build
forge build

## Testing

We use **Foundry**. Unit tests cover access/config, routing, order create/lock/unlock, and verifier behavior.

```bash
forge test -vvv
```

## Deploy

A single script deploys **Verifier**, **AdManager**, and **OrderPortal**.

`script/DeployProofbridge.s.sol`:

```bash
export PRIVATE_KEY=0xYOUR_KEY
# optional overrides:
# export ADMIN=0xAdminAddress
# export VERIFIER=0xExistingVerifierAddress

forge script script/DeployProofbridge.s.sol:DeployProofbridge \
  --rpc-url https://YOUR_RPC \
  --broadcast
```

> To verify on a scanner, set `ETHERSCAN_API_KEY` and pass `--verify`.

## Post-deploy configuration

Run these **admin** calls to connect chains and tokens.

**On OrderPortal (source chain):**

```solidity
// enable destination chain and its AdManager address
setChain(dstChainId, dstAdManager, true);

// route: token1 (this chain) -> token2 (destination)
setTokenRoute(token1, dstChainId, token2);
```

**On AdManager (destination chain):**

```solidity
// enable order chain and its OrderPortal address
setChain(orderChainId, orderPortal, true);

// route: adToken (this chain) -> orderToken (order chain)
setTokenRoute(adToken, orderToken, orderChainId);
```

## Security notes & limits

* **EIP-712 domain** is minimal. Replay protection relies on **explicit struct fields** (`*ChainId`, `*Manager/Portal`, `salt`).
* **Nullifier** is **unique per proof** for both the ad maker and the bridger.
* **Reentrancy**: guarded via non-reentrant methods and CEI pattern.
* **Routes** and **chain configs** are admin-controlled;

### License

SPDX-License-Identifier: MIT
