//! Data types for the OrderPortal contract

use soroban_sdk::{contracttype, Address, BytesN, String};

// =============================================================================
// Constants
// =============================================================================

/// Native token address placeholder (matches EVM's 0xEeee...)
pub const NATIVE_TOKEN_ADDRESS: [u8; 32] = [
    0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE,
    0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE,
    0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE,
    0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE, 0xEE,
];

/// Stellar chain IDs (2 billion range)
pub mod chain_ids {
    pub const STELLAR_MAINNET: u128 = 2_000_000_001;
    pub const STELLAR_TESTNET: u128 = 2_000_000_002;
    pub const STELLAR_FUTURENET: u128 = 2_000_000_003;
}

// =============================================================================
// Chain Configuration
// =============================================================================

/// Configuration for supported destination (ad) chains
#[contracttype]
#[derive(Clone, Debug)]
pub struct ChainInfo {
    /// Whether the destination chain is supported
    pub supported: bool,
    /// AdManager contract address on the destination chain
    pub ad_manager: BytesN<32>,
}

// =============================================================================
// Order Types
// =============================================================================

/// Parameters for creating or unlocking an order
///
/// All fields are used when computing the EIP-712 order hash.
#[contracttype]
#[derive(Clone, Debug)]
pub struct OrderParams {
    /// Token being deposited on this (order) chain
    pub order_chain_token: BytesN<32>,
    /// Token on the destination (ad) chain
    pub ad_chain_token: BytesN<32>,
    /// Amount of order_chain_token to deposit
    pub amount: u128,
    /// Address of the bridger (user creating the order)
    pub bridger: BytesN<32>,
    /// Recipient address on the ad chain (receives unlocked funds there)
    pub order_recipient: BytesN<32>,
    /// Destination (ad) chain ID
    pub ad_chain_id: u128,
    /// AdManager contract address on the ad chain
    pub ad_manager: BytesN<32>,
    /// Ad ID on the ad chain
    pub ad_id: String,
    /// Maker address (ad creator) on the ad chain
    pub ad_creator: BytesN<32>,
    /// Ad maker's recipient address on this (order) chain
    pub ad_recipient: BytesN<32>,
    /// Unique nonce to avoid hash collisions / replay
    pub salt: u128,
}

/// Order lifecycle status
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Status {
    /// Unknown / not created
    None = 0,
    /// Created and funded
    Open = 1,
    /// Unlocked / paid out
    Filled = 2,
}

// =============================================================================
// Contract Configuration
// =============================================================================

/// Immutable contract configuration set at initialization
#[contracttype]
#[derive(Clone, Debug)]
pub struct ContractConfig {
    /// Admin address
    pub admin: Address,
    /// Verifier contract address
    pub verifier: Address,
    /// MerkleManager contract address
    pub merkle_manager: Address,
    /// Wrapped native token (XLM) contract address
    pub w_native_token: Address,
    /// This chain's ID
    pub chain_id: u128,
}
