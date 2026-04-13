# ProofBridge Backend Relayer

A NestJS-based microservice that orchestrates **cross-chain trading operations** using **zero-knowledge proofs** and **cryptographic verification**.

* **Trade Management**: Complete lifecycle management from ad creation to settlement across multiple blockchain networks
* **MMR Engine**: Offchain engine for rebuilding deposit orders and generating merkle proofs for inclusion verification
* **Zero-Knowledge Integration**: Noir circuit integration with UltraHonk backend for verifiable deposit attestation
* **Multi-Chain Coordination**: Seamless integration with Ethereum, Hedera, and other EVM-compatible networks

The relayer serves as the **core backend infrastructure** for ProofBridge, enabling secure, private, and trustless token exchanges between different blockchain networks.

## Contents

- [ProofBridge Backend Relayer](#proofbridge-backend-relayer)
  - [Contents](#contents)
  - [Architecture](#architecture)
  - [Core Services](#core-services)
    - [**Trade Management System**](#trade-management-system)
      - [**MMR (Merkle Mountain Range) Engine**](#mmr-merkle-mountain-range-engine)
      - [**Zero-Knowledge Proof System**](#zero-knowledge-proof-system)
      - [**Multi-Chain Blockchain Integration**](#multi-chain-blockchain-integration)
    - [API Modules](#api-modules)
      - [**Authentication \& Authorization**](#authentication--authorization)
      - [**Trading Operations**](#trading-operations)
      - [**Route Management**](#route-management)
      - [**Advertisement System**](#advertisement-system)
      - [**Token \& Chain Management**](#token--chain-management)
  - [Technical Implementation Details](#technical-implementation-details)
    - [**Database Layer**](#database-layer)
    - [**Security \& Encryption**](#security--encryption)
    - [**Development \& Deployment**](#development--deployment)
  - [Network Requirements](#network-requirements)
  - [Install \& Build](#install--build)
    - [Prerequisites](#prerequisites)
    - [Installation](#installation)
    - [Database Setup](#database-setup)
  - [Testing](#testing)
  - [Deployment](#deployment)
    - [Development Mode](#development-mode)
    - [Production Deployment](#production-deployment)
  - [Configuration](#configuration)
    - [Environment Variables](#environment-variables)
    - [Network Configuration](#network-configuration)
    - [Monitoring Configuration](#monitoring-configuration)

## Architecture

The relayer implements a **layered microservice architecture** with distinct service layers handling specific aspects of cross-chain trading:

1. **Trade Coordination**: Manages the complete cross-chain trade lifecycle from ad creation to settlement
2. **Cryptographic Verification**: Handles merkle proof generation and zero-knowledge attestation using Noir circuits
3. **Blockchain Integration**: Coordinates with multiple blockchain networks through Viem and custom providers
4. **Data Management**: Maintains trade state, MMR structures, and cryptographic commitments in PostgreSQL

Cross-chain flow:

* **Ad Creation**: Ad creator creates advertisement indicating liquidity provision from ad chain → order chain
* **Marketplace Listing**: Ad is placed in marketplace for bridgers to discover and select
* **Bridger Selection**: Bridger selects suitable ad and makes deposit on the ad's order chain
* **Ad Creator Notification**: Ad creator is notified of bridger's deposit and locks respective amount on ad chain
* **Unlock Proof Generation**: Both users can request unlock proofs to release their locked tokens
* **Settlement**: Coordinated token release on both chains using cryptographic proofs

Security and verification via:

* **Merkle Proofs**: Cryptographic verification of deposit order inclusion in MMR trees
* **Zero-Knowledge Attestation**: Verifiable confirmation of deposit settlement without trust assumptions
* **Nullifier Systems**: Prevents double-spending without revealing transaction links
* **Encrypted State**: Sensitive trade parameters are encrypted in storage

## Core Services

### **Trade Management System**

* **Ad Lifecycle Management**: Manages advertisement creation, funding, and closure on ad chains
* **Deposit Processing**: Handles bridger deposits on order chains and triggers ad creator notifications
* **Lock Coordination**: Synchronizes ad creator fund locking in response to bridger deposits
* **State Management**: Tracks trade status (ad created, deposit made, funds locked, unlock requested, completed)
* **Cross-Chain Coordination**: Coordinates actions between ad chain and order chain
* **Encrypted Data Handling**: Secures sensitive trade parameters and user notifications

#### **MMR (Merkle Mountain Range) Engine**

**Offchain engine for rebuilding deposit orders** and generating merkle proofs for transaction inclusion verification.

* **Deposit Order Reconstruction**: Rebuilds complete deposit order history from blockchain events
* **MMR Tree Management**: Maintains append-only Merkle Mountain Range structures for efficient proof generation
* **Merkle Proof Generation**: Creates cryptographic merkle proofs for deposit order inclusion validation
* **Data Integrity**: Maintains tamper-proof records using Poseidon2 hashing
* **LevelDB Storage**: Persistent offchain storage for MMR data structures and order history
* **Blockchain Synchronization**: Monitors on-chain events to rebuild and update MMR state
* **Performance Optimization**: Caches frequently accessed MMR instances and merkle proof data

#### **Zero-Knowledge Proof System**

**Provides verifiable attestation of confirmed deposits** without requiring trust in the relayer service.

* **Noir Circuit Integration**: Utilizes Aztec's Noir language for cryptographic verification circuits
* **UltraHonk Backend**: High-performance proving system for ZK proof generation and verification
* **Deposit Attestation**: Creates verifiable proofs that deposits have been confirmed on-chain
* **Nullifier Management**: Prevents double-spending through cryptographic nullifiers
* **Trustless Verification**: Enables verification of deposit confirmation without relying on relayer claims

#### **Multi-Chain Blockchain Integration**

* **Viem-Based Architecture**: Modern Ethereum interaction library for type-safe blockchain operations
* **Network Support**: Ethereum Sepolia, Hedera Testnet, OP Sepolia, Polygon Amoy and local development networks
* **Smart Contract ABIs**: Pre-configured interfaces for AdManager, OrderPortal, and Verifier contracts
* **Typed Data Handling**: EIP-712 structured data signing and verification
* **Account Management**: Secure private key handling and transaction signing

### API Modules

#### **Authentication & Authorization**

* **SIWE Authentication**: Web3-native wallet signature authentication
* **JWT Management**: Secure session handling with role-based access
* **Security**: Nonce-based challenge-response, replay attack prevention

#### **Trading Operations**

* **Deposit Processing**: Handle bridger deposits and ad creator notifications
* **Lock Coordination**: Facilitate fund locking on ad chains
* **Proof Generation**: Create unlock proofs for both parties
* **Settlement**: Coordinate token release across chains

#### **Route Management**

* **Token Pairs**: Define supported cross-chain token mappings
* **Fee Calculation**: Dynamic fee computation based on network conditions
* **Liquidity Tracking**: Monitor available liquidity in marketplace

#### **Advertisement System**

* **Ad Creation**: Allow ad creators to create advertisements specifying ad chain → order chain liquidity provision
* **Marketplace Management**: Maintain marketplace for bridgers to discover and select suitable ads
* **Ad Lifecycle**: Handle ad funding, modification, and closure operations
* **Discovery API**: Enable bridgers to search and filter advertisements by chains, tokens, and rates
* **Notification System**: Alert ad creators when bridgers make deposits on their advertised routes

#### **Token & Chain Management**

* **Token Registry**: Multi-chain token catalog with metadata
* **Chain Configuration**: Network parameters and contract addresses
* **Cross-Chain Mapping**: Link equivalent tokens across networks

## Technical Implementation Details

### **Database Layer**

* **Prisma ORM**: Type-safe operations with PostgreSQL, automated migrations, connection pooling
* **Data Models**: Trades, orders, advertisements, users, and MMR state management
* **Performance**: Indexed queries, caching, batch operations for MMR updates

### **Security & Encryption**

* **Data Protection**: AES-256 encryption, JWT sessions, input validation, rate limiting
* **Cryptographic Operations**: ECDSA signatures, ZK proof integration, nullifier management, Poseidon2 hashing
* **Network Security**: CORS policies, TLS encryption, bearer token authentication

### **Development & Deployment**

* **Environment Management**: `.env` configuration, secrets handling, service discovery
* **Deployment**: Blue-green updates, automated migrations, GitOps, Prometheus monitoring
* **Development Tools**: Hot reload, comprehensive testing, ESLint/Prettier, CI/CD pipelines

## Network Requirements

**Supported Networks**:

* **Ethereum Mainnet/Testnets**: Full feature support with optimal gas costs
* **Hedera Hashgraph**: Native integration with Hedera's consensus mechanism
* **EVM-Compatible Chains**: Polygon, Arbitrum, Optimism, Base (with minor configuration)
* **Local Development**: Hardhat/Anvil networks for testing and development

**Cross-Chain Compatibility Matrix**:

| Chain Pair         | Status        |
| ------------------ | ------------- |
| Hedera ↔ Ethereum  | ✅ Active      |
| Hedera ↔ Polygon   | 🔄 In Progress |
| Hedera ↔ Optimism  | 🔄 In Progress |
| Hedera ↔ Scroll    | 🔄 In Progress |
| Hedera ↔ Base      | 🔄 In Progress |
| Hedera ↔ Arbitrum  | 🔄 In Progress |
| Hedera ↔ Avalanche | 🔄 In Progress |
| Hedera ↔ BSC       | 🔄 In Progress |
| Hedera ↔ Fantom    | 🔄 In Progress |
| Hedera ↔ Linea     | 🔄 In Progress |
| Hedera ↔ Mantle    | 🔄 In Progress |
| Hedera ↔ Blast     | 🔄 In Progress |
| Hedera ↔ zkSync    | 🔄 In Progress |
| Hedera ↔ Starknet  | 🔄 In Progress |
| Hedera ↔ Celo      | 🔄 In Progress |
| Hedera ↔ Gnosis    | 🔄 In Progress |
| Hedera ↔ Moonbeam  | 🔄 In Progress |
| Hedera ↔ Aurora    | 🔄 In Progress |

## Install & Build

### Prerequisites

* **Node.js** ≥ 18 and **pnpm**
* **PostgreSQL** database instance
* **Redis** (optional, for caching)
* **Docker** (for containerized deployment)

### Installation

```bash
# Clone repository and navigate to backend-relayer
cd apps/backend-relayer

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Database Setup

```bash
# Generate Prisma client
pnpm prisma generate

# Run database migrations
pnpm prisma migrate deploy
```

## Testing

The relayer includes comprehensive test suites covering unit, integration, and end-to-end scenarios.

```bash
# Run all tests
pnpm test

# Integration tests
pnpm run test:integration

# End-to-end tests
pnpm run test:e2e

# Test coverage report
pnpm run test:coverage
```

**Test Categories**:

* **Unit Tests**: Individual service and controller logic
* **E2E Tests**: Database operations and external API interactions
* **Integration Tests**: Complete trade workflows and cross-chain scenarios

## Deployment

### Development Mode

```bash
# Start in development mode with hot reload
pnpm run start:dev

# Start with debugging enabled
pnpm run start:debug
```

### Production Deployment

```bash
# Build for production
pnpm run build

# Start production server
pnpm run start:prod
```

## Configuration

### Environment Variables

**Core Configuration**:

```bash
EVM_ADMIN_PRIVATE_KEY=""
STELLAR_ADMIN_SECRET=""
DATABASE_URL=""
EVM_RPC_API_KEY=""
JWT_EXPIRY=""
JWT_REFRESH_EXPIRTY=""
JWT_SECRET=""
NODE_ENV=""
PORT=""
SECRET_KEY=""
SIGN_DOMAIN=proof-bridge.vercel.app
SIGN_URI=https://proof-bridge.vercel.app
```

### Network Configuration

Network configuration is managed through admin API endpoints with admin authentication:

**Chain Registration**:
Use the `POST /admin/chains/create` endpoint to register new chains:

```bash
# Create a new chain
curl -X POST /admin/chains/create \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 1,
    "name": "Ethereum",
    "orderPortalAddress": "0x...",
    "adManagerAddress": "0x...",
  }'
```

**Token Registration**:
Use the `POST /admin/tokens/create` endpoint to register tokens:
Pass the uuid of the chain you want to register token to

```bash
# Create a new token
curl -X POST /admin/tokens/create \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "chainUid": "123e4567-e89b-12d3-a456-426614174000", 
    "symbol": "USDC",
    "name": "USD Coin",
    "decimals": 6,
    "address": "0xA0b86a33E6441A8D1b70Ae73292d8426"
  }'
```

**Route Creation**:
Use the `POST /admin/route` endpoint to link chains and tokens:
Pass the ids of the tokens

```bash
# Create a cross-chain route
curl -X POST /admin/route \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "adTokenId": "123e4567-e89b-12d3-a456-426614174000",
    "orderTokenId": "123e4567-e89b-12d3-a456-426614174001",
  }'
```

### Monitoring Configuration

**Health Checks**:

* `/health` - Basic service health
* `/docs` - Swagger API documentation
