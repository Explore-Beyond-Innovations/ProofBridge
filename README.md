# ProofBridge

**ProofBridge** is a P2P cross-chain platform enabling direct peer-to-peer transactions and data exchange between blockchain networks. It leverages **zero-knowledge proofs (ZKPs)** and **user-driven consensus** to achieve trustless interoperability without relying on centralized relayers or custodians.

> ⚠️ **Note**: The **BLS verification library** for authentication proofs is currently under development. This component will allow ProofBridge to validate that two counterparties in a trade can act as the consensus layer, with ProofBridge serving as a neutral referee for settlement.

## 🚀 Overview

ProofBridge introduces a decentralized bridge infrastructure where **users form the consensus layer**. Instead of relying on validator committees or external relayers, counterparties themselves verify and agree on proof data.

Key primitives include:

- **Zero-Knowledge Proofs (ZKPs)**: Used to validate off-chain computation and generate proofs.
- **BLS Signatures** (in progress): Used to aggregate authentication proofs from both parties.
- **Consensus by Counterparties**: Trade participants themselves serve as lightweight validators.
- **Multi-chain Compatibility**: Designed for EVM chains and extensible to non-EVM networks.

This design enables **secure peer-to-peer asset transfers and data verification** across chains, minimizing trust assumptions and reducing the attack surface common in traditional bridge designs.

## ✨ Features

- 🔗 **Peer-to-Peer Cross-Chain Transactions** — Direct interaction between users without intermediaries.
- 🛡 **Zero-Knowledge Proof Validation** — Ensures correctness of computations and state transitions.
- 👥 **User-Driven Consensus** — Trade counterparties jointly form the verification mechanism.
- 🔑 **BLS Signature Verification (WIP)** — Aggregate proofs of agreement across participants.
- 📊 **Proof of Computation Validation** — Trustless execution of trade settlement logic.
- 🌉 **Multi-Chain Compatibility** — Supports Ethereum, EVM-compatible chains, and extensibility for non-EVM chains.
- ⚖️ **Trustless Operations** — Removes reliance on custodians, relayers, or centralized sequencers.

## 🛠 Architecture

The ProofBridge system is composed of four main layers, each working together to enable secure, peer-to-peer cross-chain transfers.

**For detailed architecture diagrams, component descriptions, and data flow, see [architecture.md](./architecture.md)**

### Contracts

- **AdManager (per chain):** Makers (liquidity providers) post and close liquidity ads on the origin chain. When a deposit is made, it is **appended as a new leaf in that chain’s Merkle Mountain Range (MMR) tree**. Each chain therefore maintains its own append-only Merkle structure, producing a verifiable root after every deposit. Assets are locked against signed **EIP-712 orders**, ensuring trade terms are cryptographically bound to a specific chain and contract.

- **OrderPortal (per chain):** Bridgers submit proofs to unlock liquidity on the destination chain. The portal validates these proofs by checking an inclusion proof against the **alternating chain’s Merkle tree root**. For example, a withdrawal on Chain B must prove that the corresponding deposit exists in Chain A’s tree. Once validated, funds are released, completing the cross-chain settlement without intermediaries.

### Proof Verifier Module

- **Merkle/Computation Validation:** Zero-knowledge proofs are used to attest that a claimed deposit exists in the Merkle tree of the opposite chain, while also enforcing trade constraints (validity of `orderHash`, amount bounds, expiry, and nullifiers). This ensures cross-chain state transitions are correct and non-replayable without exposing private data.

- **BLS Aggregation Layer (WIP):** In progress, this module will allow both Maker and Bridger to produce signatures over the same order or Merkle root. These signatures are aggregated into a single compact proof of agreement, ensuring both parties have explicitly authorized the trade before settlement.

### Relayer (Referee Node)

- **Current design:** The relayer is **stateful**, using a **pre-authorization (preauth)** model. This allows counterparties to delegate proof submission to a trusted node that maintains session state and enforces trade authorization. While this approach centralizes the relayer role, it simplifies coordination and ensures correctness while the BLS layer is still under development.

- **Future design:** Once the **BLS aggregation layer** is complete, the relayer can become **stateless and permissionless**. At that point, any honest actor can submit aggregated proofs to the destination chain’s `OrderPortal`. This change will allow multiple relayers to compete, improve liveness, and fully remove reliance on a single trusted node.

- **Planned extensions:** batching, fee markets, and cross-chain reconciliation listeners (marking ads as settled on Chain A after unlocks on Chain B).

### AI Layer

- **Maker support:** AI agents assist liquidity providers by **monitoring ads, deposits, and proofs in real time**. They can flag anomalies, recommend adjustments, or automatically trigger follow-up actions such as closing ads or rebalancing liquidity.

- **Order processing:** The AI layer helps makers **process incoming orders quickly**, reducing manual overhead. It can pre-validate order parameters, match ads with bridging demand, and optimize settlement flows.

- **Automation:** By handling routine checks and repetitive tasks, the AI layer frees up makers to focus on strategy while ensuring a faster, smoother experience for bridgers.

- **Future potential:** The AI layer will later expand to adaptive fee setting, predictive liquidity provisioning, and even operating as **co-pilot relayers** in a permissionless environment.

## 📖 Component Documentation

For detailed information about each component of the ProofBridge system, refer to the following documentation:

- **[Contracts](./contracts/README.md)** - Smart contract architecture, deployed addresses with explorer links, deployment guides, and cross-chain route configuration
  - [EVM Contracts](./contracts/evm/README.md) - Solidity/Foundry implementation (Ethereum)
  - [Stellar Contracts](./contracts/stellar/README.md) - Soroban/Rust implementation (Stellar)
- **[Proof Circuits](./proof_circuits/)** - Zero-knowledge proof circuits for cross-chain verification
  - [Auth Circuits](./proof_circuits/auth/README.md) - Authentication proof circuits using BLS signatures
  - [Deposit Circuits](./proof_circuits/deposits/README.md) - Deposit validation and Merkle proof circuits
- **[Backend Relayer](./apps/backend-relayer/README.md)** - Relayer setup, configuration, and operation instructions
- **[Frontend](./apps/frontend/README.md)** - User interface setup and development guide
- **[MMR Package](./packages/proofbridge_mmr/README.md)** - Merkle Mountain Range implementation and usage

## 📍 Roadmap

The protocol ships in tranches anchored to the SCF Build Award
plan. Each phase below is a concrete tranche with its own design
doc; the design docs are the source of truth for scope.

- **Phase 1 – Preauth Relayer (MVP, live on testnet):**

  - Stateful relayer with pre-authorization to bootstrap trust
  - On-chain MMR trees maintained per chain (Poseidon2 leaves)
  - ZK proof circuits for inclusion and trade constraint validation
  - Single relayer model for stability during early testing
  - Deployed Sepolia ↔ Stellar Testnet, real bridge transactions
    settling end-to-end through `OrderPortal` / `AdManager`

- **Phase 2 – BLS Authentication & Pre-Auth Retirement (T1):**

  - End-to-end BLS-from-zero on BLS12-381 (`noir_bls12_381_pairing`
    in-circuit, CAP-0059 / EIP-2537 native pairing on chain)
  - Both parties sign the canonical 15-field `Order` struct once;
    one aggregated signature gates both `unlock` calls
  - Pre-authorization manager-signing path removed entirely;
    relayer reduces to a stateless off-chain aggregator
  - MMR proof generation back to ≤30s on a reference machine
  - Route-commitment defense pinning each ad's route at creation
    time so admin-key compromise can't redirect existing ads
  - Pausability + two-step admin transfer + cascading route cleanup
  - Standalone Noir BLS auth circuit shipped as a building block
    for off-chain / agent-side proof-backed auth

- **Phase 3 – AI Agents & Dispute Resolution (T2):**

  - Soroban custom-account contracts with `__check_auth`-gated
    per-agent policies (allowed actions, token whitelist, per-order
    and per-window caps, expiry, revocation)
  - EVM-side mirror via per-maker Safe Modules using the same
    policy schema
  - Multi-key `BLSKeyRegistry v2` with monotonic stable slot IDs,
    `valid_until` per slot, and aggregator slot-hint at unlock —
    single-tx agent rotation without churning maker liquidity
  - Agent runtime replacing the manager-key auto-merchant-bot;
    each maker runs (or delegates) one agent against their own
    custom account
  - Order `deadline` field added to the signed struct
    (protocol-fixed per-route window); permissionless cancel paths
    after expiry
  - Full dispute path with bonded initiation, evidence submission,
    and arbiter resolution — `MutualRefund` / `TradeProceeds` /
    `BridgerForfeit` / `MakerForfeit` outcomes
  - 14-day public testnet stability run with proof-gen, settlement,
    and dispute metrics on a public dashboard

- **Phase 4 – Mainnet Launch (T3):**

  - Mainnet contract deployment on Stellar + Ethereum, gated by
    SCF Audit Bank engagement (audit-clean → deploy)
  - Admin handed off to multisig on each chain; `ArbiterRole` held
    by a 5-of-7 multisig (3 team + 4 ecosystem signers,
    constraint of ≥ 2 non-team for any decision)
  - 24-hour operational timelock on critical admin functions
    (route changes, fee parameters, role grants); pause / unpause
    exempt for emergency response
  - Protocol fee mechanism live — 20 bps to `protocol_fee_pool`,
    30 bps to maker as LP profit, deducted destination-side
  - Per-route bond config for disputes (USDC ↔ USDC at launch:
    `min_bond` floor + `bond_bps` ratio in the route's own token)
  - Single launch route: `USDC ↔ USDC` between Circle's existing
    Ethereum ERC-20 and Stellar SAC. ProofBridge does not issue
    wrapped assets; future routes wait for ecosystem partners to
    provide equivalent assets cross-chain.
  - Production-grade relayer infrastructure (HA pair, monitoring,
    alerting, runbook) and a public per-service status page
  - Cross-chain reconciliation listener watching both chains for
    settlement discrepancies
  - Developer SDK at `@proofbridge/sdk` and OpenAPI spec at
    `api.pfbridge.xyz/openapi.json`
  - 4-week post-launch operational hardening window

- **Phase 5 – Post-Mainnet Decentralization & Expansion
  (follow-up tranches, separately scoped):**

  - **DAO governance for `ArbiterRole`** — moves the dispute-
    resolution authority from the multisig to community-elected
    stake-weighted voting. Requires the ProofBridge token launch
    (its own initiative; not eligible for SCF Build funding).
  - **Slashing for misbehaving agents** — stake-and-slash penalty
    layer beyond the existing dispute path's punitive outcomes,
    calibrated against observed mainnet misbehavior data.
  - **Cross-chain expansion** — additional chains (Arbitrum, Base,
    Optimism, Polygon, Starknet, Solana) using the existing T1+T2
    contract suite plus per-chain circuit work where needed.
  - **Token route expansion** — RWA-specific routes (e.g.
    Franklin Templeton BENJI, Etherfuse CETES) and additional
    stablecoin pairs as ecosystem partnerships land.
  - **Iterative protocol enhancements** — per-route fee bps,
    cross-token dispute bonds via price oracle, auth-plus-deposit
    combined ZK proof for L2 batching once volumes justify the
    proof-system optimization.

## 📚 Documentation

Full technical specifications and developer guides are here in  [docs](https://docs.pfbridge.xyz).

## 👥 Team
- **Joseph Edoh** - Blockchain Developer,
- **Ugonna Dike** - Ecosystem,
- **Osaretin Frank** - Fullstack Developer.
- **Isaac Onyemaechi** - Ai Engineer

## 📜 License

This project is licensed under the [MIT License](LICENSE).

## 📬 Contact

For support, feature requests, or general inquiries:

- Open an issue on [GitHub](https://github.com/Explore-Beyond-Innovations/ProofBridge)
- Join the community discussions (coming soon in Discord/Telegram)
