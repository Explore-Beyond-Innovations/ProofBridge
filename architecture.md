# ProofBridge Architecture

This document provides a comprehensive overview of the current ProofBridge system architecture, showing how all components interact and the data flow between them.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PROOFBRIDGE SYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────────────────────┘

                                  ┌─────────────────────┐
                                  │                     │
                                  │   FRONTEND (React)  │
                                  │   User Interface    │
                                  │                     │
                                  └──────────┬──────────┘
                                             │
                                    Wallet   │  API Requests
                                  Connections│  (Orders, Ads)
                                             │
                    ┌────────────────────────┴────────────────────────┐
                    │                                                  │
                    ▼                                                  ▼
    ┌────────────────────────────┐                    ┌────────────────────────────┐
    │   CHAIN A (Sepolia)        │                    │   CHAIN B (Stellar)        │
    │   Smart Contracts          │                    │   Smart Contracts          │
    ├────────────────────────────┤                    ├────────────────────────────┤
    │                            │                    │                            │
    │  ┌─────────────────────┐   │                    │  ┌─────────────────────┐   │
    │  │   AdManager         │   │                    │  │   AdManager         │   │
    │  │ (Create/Fund Ads)   │   │                    │  │ (Create/Fund Ads)   │   │
    │  └──────────┬──────────┘   │                    │  └──────────┬──────────┘   │
    │             │              │                    │             │              │
    │  ┌──────────▼──────────┐   │                    │  ┌──────────▼──────────┐   │
    │  │   OrderPortal       │   │                    │  │   OrderPortal       │   │
    │  │ (Create Orders)     │◄──┼────────────────────┼─►│ (Create Orders)     │   │
    │  └──────────┬──────────┘   │                    │  └──────────┬──────────┘   │
    │             │              │                    │             │              │
    │             │              │                    │             │              |
    │     Grants MANAGER_ROLE    │                    │     Grants MANAGER_ROLE    │
    │             │              │                    │             │              │
    │  ┌──────────▼──────────┐   │                    │  ┌──────────▼──────────┐   │
    │  │   MerkleManager     │   │                    │  │   MerkleManager     │   │
    │  │ (MMR Tree Storage)  │   │                    │  │ (MMR Tree Storage)  │   │
    │  └──────────┬──────────┘   │                    │  └──────────┬──────────┘   │
    │             │              │                    │             │              │
    │  ┌──────────▼──────────┐   │                    │  ┌──────────▼──────────┐   │
    │  │   Verifier          │   │                    │  │   Verifier          │   │
    │  │ (ZK Proof Check)    │   │                    │  │ (ZK Proof Check)    │   │
    │  └─────────────────────┘   │                    │  └─────────────────────┘   │
    │                            │                    │                            │
    │  ┌─────────────────────┐   │                    │  ┌─────────────────────┐   │
    │  │  wNativeToken(WETH) │   │                    │  │  XLM / SAC / SEP-41 │   │
    │  └─────────────────────┘   │                    │  └─────────────────────┘   │
    └───────────┬────────────────┘                    └───────────┬────────────────┘
                │                                                 │
             ┌────────────────────────────────────────────────────────┐ 
             │                      Events                            │
             │        (OrderCreated, AdCreated Unlocked)              | 
             │                                                        │
             └───────────────────┐              ┌─────────────────────┘
                                 |              |
                            User requests (callbacks)  
                                 │              │   
                                 ▼              ▼
                    ┌────────────────────────────────────────┐
                    │                                        │
                    │      BACKEND RELAYER (Node.js)         │
                    │   Stateful Pre-Authorization Model     │
                    │                                        │
                    │  • Pre-authorizes transactions         │
                    │  • Triggered by user request callbacks │
                    │  • Checks transaction confirmations    │
                    │  • Coordinates cross-chain flows       │
                    │  • Triggers proof generation           │
                    │  • Submits proofs to chains            │
                    │                                        │
                    └───────────────┬────────────────────────┘
                                    │
                   Proof Requests Generation Data (Order/Merkle)
                                    │
                                    ▼
                    ┌────────────────────────────────────────┐
                    │                                        │
                    │       PROOF CIRCUITS (Noir)            │
                    │                                        │
                    │  ┌──────────────────────────────────┐  │
                    │  │  Deposit Circuit                 │  │
                    │  │  • Validates order hash          │  │
                    │  │  • Checks MMR inclusion proof    │  │
                    │  │  • Verifies nullifiers           │  │
                    │  │  • Generates ZK proof            │  │
                    │  └──────────────────────────────────┘  │
                    │                                        │
                    │  ┌──────────────────────────────────┐  │
                    │  │  Auth Circuit (WIP)              │  │
                    │  │  • BLS signature aggregation     │  │
                    │  │  • Counterparty authentication   │  │
                    │  └──────────────────────────────────┘  │
                    │                                        │
                    └────────────┬───────────────────────────┘
                                 │
                                 |
                    Generated ZK Proofs (sent back to relayer)
                                 │
                                 ▼
                    ┌────────────────────────────────────────┐
                    │    Relayer submits proofs to           │
                    │    contracts for settlement            │
                    └────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════════════════
                                  DATA FLOW
═══════════════════════════════════════════════════════════════════════════════

  1.  Maker creates Ad on Chain A → AdManager locks liquidity
  2.  User requests pre-authorization from Backend Relayer
  3.  Relayer pre-authorizes transaction → Returns approval to user
  4.  Bridger creates Order on Chain B → OrderPortal locks deposit
  5.  OrderPortal adds order hash → MerkleManager (MMR tree on Chain B)
  6.  Maker locks in order on Chain A -> AdManager provisions for liquidity
  7.  Admanager adds order hash -> MerkleManager (MMR tree on Chain A)
  8.  User triggers relayer callback → Relayer checks transaction confirmation
  9.  Relayer fetches Merkle proof + order data from chains
  10. Relayer triggers Proof Circuit → Generates ZK proof
  11. Relayer submits proof to Chain A → AdManager.unlock()
  12. Verifier validates proof → Releases funds to bridger's recipient
  13. Relayer submits proof to Chain B → OrderPortal.unlock()
  14. Verifier validates proof → Releases funds to maker's recipient


┌─────────────────────────────────────────────────────────────────────────────┐
│                            TO BE ADDED (TBA)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  AI AUTOMATION LAYER                                               │     │
│  │  • Real-time monitoring of ads and orders                          │     │
│  │  • Anomaly detection and alerts                                    │     │
│  │  • Automated order matching and processing                         │     │
│  │  • Adaptive fee optimization                                       │     │
│  │  • Predictive liquidity provisioning                               │     │
│  │  • Co-pilot relayer capabilities                                   │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐     │
│  │  BLS SIGNATURE AGGREGATION                                         │     │
│  │  • Maker + Bridger signature collection                            │     │
│  │  • Compact proof of agreement generation                           │     │
│  │  • Stateless relayer support                                       │     │
│  │  • Permissionless proof submission                                 │     │
│  │  • Multi-relayer competition                                       │     │
│  └────────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### Frontend (React)

The user interface layer that allows users to:

- Connect their wallets
- Create and manage liquidity ads
- Submit cross-chain orders
- Monitor transaction status

### Smart Contracts

Deployed on both Ethereum Sepolia (EVM) and Stellar Testnet (Soroban):

#### AdManager

- Liquidity providers create and fund ads
- Locks liquidity against E
- IP-712 order hashes
- Validates proofs and releases funds to bridgers

#### OrderPortal

- Users create cross-chain orders by depositing tokens
- Submits order hashes to MerkleManager
- Validates proofs and releases funds to makers

#### MerkleManager

- Maintains Merkle Mountain Range (MMR) tree
- Stores order hash commitments
- Provides Merkle proofs for verification

#### Verifier

- Validates zero-knowledge proofs on-chain
- Uses UltraHonk proving system
- Ensures cryptographic correctness

#### wNativeToken

- On EVM: wraps native ETH on deposit and unwraps on withdrawal (ERC20-compatible)
- On Stellar: native XLM is handled directly; issued assets use Stellar Asset Contracts (SAC) and custom tokens use SEP-41 contracts

### Backend Relayer (Node.js)

Central coordinator operating on a **pre-authorization model**:

- **Pre-authorizes transactions** before users submit them on-chain
- **Triggered by user request callbacks** (not event monitoring)
- **Checks transaction confirmations** when users trigger callbacks after on-chain submission
- Coordinates cross-chain settlement flows
- Manages order lifecycle and state
- Triggers proof generation via circuits
- Submits proofs to destination chains

**Current Design:** The relayer is stateful and maintains pre-authorization state. Users request approval before creating orders, and then trigger the relayer via callback after their transaction is confirmed on-chain.

### Proof Circuits (Noir)

#### Deposit Circuit

- Validates order hash correctness
- Checks MMR inclusion proofs
- Verifies nullifiers to prevent double-spending
- Generates ZK proofs for settlement

#### Auth Circuit (Work in Progress)

- BLS signature aggregation
- Counterparty authentication
- Proof of agreement between maker and bridger

## Future Components (TBA)

### AI Automation Layer

Will provide:

- Real-time monitoring and alerting
- Anomaly detection for suspicious activity
- Automated order matching and processing
- Adaptive fee optimization based on network conditions
- Predictive liquidity provisioning
- Co-pilot relayer capabilities for makers

### BLS Signature Aggregation

Will enable:

- Collection of maker and bridger signatures
- Compact proof of agreement generation
- Transition to stateless relayer design
- Permissionless proof submission
- Multi-relayer competition for improved liveness

## Cross-Chain Flow Example

**Scenario:** Bridger wants to transfer ETH from Sepolia to receive XLM on Stellar

1. **Maker Setup:** Maker creates an ad on Stellar's AdManager (Soroban), funding it with XLM
2. **Order Creation:** Bridger deposits ETH on Sepolia's OrderPortal (automatically wrapped to WETH)
3. **Merkle Recording:** OrderPortal adds the order hash to Sepolia's MerkleManager MMR tree
4. **Relayer Detection:** Backend relayer detects the OrderCreated event
5. **Proof Generation:** Relayer requests proof circuit to generate ZK proof with Merkle inclusion
6. **Destination Unlock:** Relayer submits proof to Stellar's AdManager, releasing XLM to bridger
7. **Source Unlock:** Relayer submits proof to Sepolia's OrderPortal, releasing WETH to maker
8. **Completion:** Both parties receive their funds, cross-chain transfer complete
