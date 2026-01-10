//! AdManager Contract for Stellar/Soroban
//!
//! This contract manages liquidity advertisements for the Proofbridge cross-chain bridge.
//! Makers (LPs) post liquidity ads, lock funds against orders, and bridgers unlock
//! funds by presenting ZK proofs of deposits on the source chain.
//!
//! ## Cross-Chain Compatibility
//!
//! This contract is designed to be interoperable with the EVM AdManager contract.
//! Order hashes are computed using EIP-712 encoding to ensure compatibility.

#![no_std]

extern crate alloc;

mod auth;
mod eip712;
mod errors;
mod events;
mod storage;
mod token;
mod types;

use soroban_sdk::{
    contract, contractimpl, Address, Bytes, BytesN, Env, IntoVal, InvokeError, String, Symbol, Val,
    Vec,
};

pub use errors::AdManagerError;
pub use types::{Ad, ChainInfo, ContractConfig, OrderParams, Status, NATIVE_TOKEN_ADDRESS};

/// The AdManager contract
#[contract]
pub struct AdManagerContract;

#[contractimpl]
impl AdManagerContract {
    // =========================================================================
    // Initialization
    // =========================================================================

    /// Initialize the contract with admin and external contract addresses
    ///
    /// This function can only be called once. It sets up:
    /// - Admin address (granted manager role)
    /// - Verifier contract address (for ZK proof verification)
    /// - MerkleManager contract address (for order hash tracking)
    /// - Wrapped native token contract address (for XLM handling)
    /// - Chain ID for this deployment
    pub fn initialize(
        env: Env,
        admin: Address,
        verifier: Address,
        merkle_manager: Address,
        w_native_token: Address,
        chain_id: u128,
    ) -> Result<(), AdManagerError> {
        // Check not already initialized
        if storage::is_initialized(&env) {
            return Err(AdManagerError::AlreadyInitialized);
        }

        // Validate addresses are not zero (basic check)
        admin.require_auth();

        // Store configuration
        let config = ContractConfig {
            admin: admin.clone(),
            verifier,
            merkle_manager,
            w_native_token,
            chain_id,
        };
        storage::set_config(&env, &config);

        // Grant admin manager role
        storage::set_manager(&env, &admin, true);

        // Mark as initialized
        storage::set_initialized(&env);

        // Emit initialization event
        events::emit_initialized(&env, &admin, &config.verifier, &config.merkle_manager, chain_id);

        // Extend TTL
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /// Set or unset an address as a manager
    pub fn set_manager(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        manager: Address,
        status: bool,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::hash_request(
            &env,
            &auth_token,
            time_to_expire,
            "setManager",
            &Bytes::new(&env),
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Update manager status
        storage::set_manager(&env, &manager, status);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_manager_updated(&env, &manager, status);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Add or update a source chain configuration
    pub fn set_chain(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        order_chain_id: u128,
        order_portal: BytesN<32>,
        supported: bool,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::hash_request(
            &env,
            &auth_token,
            time_to_expire,
            "setChain",
            &Bytes::new(&env),
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Store chain info
        let chain_info = ChainInfo {
            supported,
            order_portal: order_portal.clone(),
        };
        storage::set_chain(&env, order_chain_id, &chain_info);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_chain_set(&env, order_chain_id, &order_portal, supported);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Remove a source chain configuration
    pub fn remove_chain(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        order_chain_id: u128,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::hash_request(
            &env,
            &auth_token,
            time_to_expire,
            "removeChain",
            &Bytes::new(&env),
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Remove chain
        storage::remove_chain(&env, order_chain_id);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        let zero_addr = BytesN::from_array(&env, &[0u8; 32]);
        events::emit_chain_set(&env, order_chain_id, &zero_addr, false);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Set a token route mapping
    pub fn set_token_route(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_token: BytesN<32>,
        order_token: BytesN<32>,
        order_chain_id: u128,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Validate tokens not zero
        if auth::is_zero_bytes32(&ad_token) || auth::is_zero_bytes32(&order_token) {
            return Err(AdManagerError::TokenZeroAddress);
        }

        // Validate chain is supported
        let chain_info = storage::get_chain(&env, order_chain_id)
            .ok_or(AdManagerError::ChainNotSupported)?;
        if !chain_info.supported {
            return Err(AdManagerError::ChainNotSupported);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::hash_request(
            &env,
            &auth_token,
            time_to_expire,
            "setTokenRoute",
            &Bytes::new(&env),
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Store token route
        storage::set_token_route(&env, &ad_token, order_chain_id, &order_token);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_token_route_set(&env, &order_token, order_chain_id, &ad_token);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Remove a token route mapping
    pub fn remove_token_route(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_token: BytesN<32>,
        order_chain_id: u128,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Get existing route for event
        let order_token = storage::get_token_route(&env, &ad_token, order_chain_id)
            .unwrap_or_else(|| BytesN::from_array(&env, &[0u8; 32]));

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::hash_request(
            &env,
            &auth_token,
            time_to_expire,
            "removeTokenRoute",
            &Bytes::new(&env),
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Remove token route
        storage::remove_token_route(&env, &ad_token, order_chain_id);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_token_route_removed(&env, &ad_token, &order_token, order_chain_id);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    // =========================================================================
    // Maker Functions - Ads
    // =========================================================================

    /// Create a new liquidity ad
    pub fn create_ad(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_id: String,
        ad_token: BytesN<32>,
        initial_amount: u128,
        order_chain_id: u128,
        ad_recipient: BytesN<32>,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Validations
        if auth::is_zero_bytes32(&ad_token) {
            return Err(AdManagerError::TokenZeroAddress);
        }
        if auth::is_zero_bytes32(&ad_recipient) {
            return Err(AdManagerError::RecipientZero);
        }
        if initial_amount == 0 {
            return Err(AdManagerError::ZeroAmount);
        }

        // Check token route exists
        if storage::get_token_route(&env, &ad_token, order_chain_id).is_none() {
            return Err(AdManagerError::ChainNotSupported);
        }

        // Check ad_id not used
        if storage::is_ad_id_used(&env, &ad_id) {
            return Err(AdManagerError::UsedAdId);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::create_ad_request_hash(
            &env,
            &ad_id,
            &ad_token,
            initial_amount,
            order_chain_id,
            &ad_recipient,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        let signer = auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Transfer tokens from signer to contract
        token::transfer_from_user_bytes32(&env, &ad_token, &config.w_native_token, &signer, initial_amount)?;

        // Create ad
        let ad = Ad {
            order_chain_id,
            ad_recipient: ad_recipient.clone(),
            maker: signer.clone(),
            token: ad_token.clone(),
            balance: initial_amount,
            locked: 0,
            open: true,
        };
        storage::set_ad(&env, &ad_id, &ad);

        // Mark ad_id as used
        storage::set_ad_id_used(&env, &ad_id);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_ad_created(&env, &ad_id, &signer, &ad_token, initial_amount, order_chain_id);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Fund an existing ad with additional liquidity
    pub fn fund_ad(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_id: String,
        amount: u128,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Get ad and validate
        let mut ad = storage::get_ad(&env, &ad_id).ok_or(AdManagerError::AdNotFound)?;

        if !ad.open {
            return Err(AdManagerError::AdClosed);
        }
        if amount == 0 {
            return Err(AdManagerError::ZeroAmount);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::fund_ad_request_hash(
            &env,
            &ad_id,
            amount,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        let signer = auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Verify signer is the ad maker
        if ad.maker != signer {
            return Err(AdManagerError::NotMaker);
        }

        // Transfer tokens from signer to contract
        token::transfer_from_user_bytes32(&env, &ad.token, &config.w_native_token, &signer, amount)?;

        // Update ad balance
        ad.balance += amount;
        storage::set_ad(&env, &ad_id, &ad);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_ad_funded(&env, &ad_id, &signer, amount, ad.balance);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Withdraw available (unlocked) liquidity from an ad
    pub fn withdraw_from_ad(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_id: String,
        amount: u128,
        to: Address,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Get ad and validate
        let mut ad = storage::get_ad(&env, &ad_id).ok_or(AdManagerError::AdNotFound)?;

        if amount == 0 {
            return Err(AdManagerError::ZeroAmount);
        }

        let available = ad.balance - ad.locked;
        if amount > available {
            return Err(AdManagerError::InsufficientLiquidity);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::withdraw_from_ad_request_hash(
            &env,
            &ad_id,
            amount,
            &to,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        let signer = auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Verify signer is the ad maker
        if ad.maker != signer {
            return Err(AdManagerError::NotMaker);
        }

        // Update ad balance
        ad.balance -= amount;
        storage::set_ad(&env, &ad_id, &ad);

        // Transfer tokens from contract to recipient
        token::transfer_to_user_bytes32(&env, &ad.token, &config.w_native_token, &to, amount)?;

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_ad_withdrawn(&env, &ad_id, &signer, amount, ad.balance);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    /// Close an ad and withdraw all remaining funds
    pub fn close_ad(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        ad_id: String,
        to: Address,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Get ad and validate
        let mut ad = storage::get_ad(&env, &ad_id).ok_or(AdManagerError::AdNotFound)?;

        if ad.locked != 0 {
            return Err(AdManagerError::ActiveLocks);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::close_ad_request_hash(
            &env,
            &ad_id,
            &to,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        let signer = auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Verify signer is the ad maker
        if ad.maker != signer {
            return Err(AdManagerError::NotMaker);
        }

        let remaining = ad.balance;
        let ad_token = ad.token.clone();

        // Update ad
        ad.balance = 0;
        ad.open = false;
        storage::set_ad(&env, &ad_id, &ad);

        // Transfer remaining tokens to recipient if any
        if remaining > 0 {
            token::transfer_to_user_bytes32(&env, &ad_token, &config.w_native_token, &to, remaining)?;
        }

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_ad_closed(&env, &ad_id, &signer);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    // =========================================================================
    // Maker Functions - Orders
    // =========================================================================

    /// Lock liquidity for an order
    pub fn lock_for_order(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        params: OrderParams,
    ) -> Result<BytesN<32>, AdManagerError> {
        let config = storage::get_config(&env)?;

        // Get ad and validate ownership
        let mut ad = storage::get_ad(&env, &params.ad_id).ok_or(AdManagerError::AdNotFound)?;

        // Validate order
        Self::validate_order(&env, &ad, &params)?;

        // Check available liquidity
        let available = ad.balance - ad.locked;
        if params.amount > available {
            return Err(AdManagerError::InsufficientLiquidity);
        }

        // Compute order hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let order_hash = eip712::hash_order(&env, &params, config.chain_id, &contract_bytes);

        // Check order doesn't already exist
        if storage::get_order_status(&env, &order_hash) != Status::None {
            return Err(AdManagerError::OrderExists);
        }

        // Build request hash
        let message = auth::lock_for_order_request_hash(
            &env,
            &params.ad_id,
            &order_hash,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        let signer = auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Verify signer is the ad maker
        if ad.maker != signer {
            return Err(AdManagerError::NotMaker);
        }

        // Update ad locked amount
        ad.locked += params.amount;
        storage::set_ad(&env, &params.ad_id, &ad);

        // Set order status to Open
        storage::set_order_status(&env, &order_hash, Status::Open);

        // Append to merkle tree
        Self::append_to_merkle(&env, &config.merkle_manager, &order_hash)?;

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_order_locked(
            &env,
            &params.ad_id,
            &order_hash,
            &signer,
            &ad.token,
            params.amount,
            &params.bridger,
            &params.order_recipient,
        );

        storage::extend_instance_ttl(&env);
        Ok(order_hash)
    }

    // =========================================================================
    // Bridger Functions
    // =========================================================================

    /// Unlock funds with a ZK proof
    pub fn unlock(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        params: OrderParams,
        nullifier_hash: BytesN<32>,
        target_root: BytesN<32>,
        proof: Bytes,
    ) -> Result<(), AdManagerError> {
        let config = storage::get_config(&env)?;

        // Compute order hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let order_hash = eip712::hash_order(&env, &params, config.chain_id, &contract_bytes);

        // Verify order is Open
        if storage::get_order_status(&env, &order_hash) != Status::Open {
            return Err(AdManagerError::OrderNotOpen);
        }

        // Verify nullifier not used
        if storage::is_nullifier_used(&env, &nullifier_hash) {
            return Err(AdManagerError::NullifierUsed);
        }

        // Build request hash
        let message = auth::unlock_order_request_hash(
            &env,
            &params.ad_id,
            &order_hash,
            &target_root,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Validate pre-auth
        if storage::is_request_hash_used(&env, &message) {
            return Err(AdManagerError::RequestHashProcessed);
        }

        auth::pre_auth_validations(&env, &message, &auth_token, time_to_expire, &signature, &public_key)?;

        // Build public inputs and verify proof
        let public_inputs = Self::build_public_inputs(&env, &config.merkle_manager, &nullifier_hash, &target_root, &order_hash);
        Self::verify_proof(&env, &config.verifier, &public_inputs, &proof)?;

        // Mark nullifier as used
        storage::set_nullifier_used(&env, &nullifier_hash);

        // Set order status to Filled
        storage::set_order_status(&env, &order_hash, Status::Filled);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Get ad and update locked amount
        let mut ad = storage::get_ad(&env, &params.ad_id).ok_or(AdManagerError::AdNotFound)?;
        let ad_token = ad.token.clone();
        ad.locked -= params.amount;
        ad.balance -= params.amount;
        storage::set_ad(&env, &params.ad_id, &ad);

        // Transfer tokens to order recipient
        token::transfer_to_recipient_bytes32(&env, &ad_token, &config.w_native_token, &params.order_recipient, params.amount)?;

        // Emit event
        events::emit_order_unlocked(&env, &order_hash, &params.order_recipient, &nullifier_hash);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// Get available (unlocked) liquidity for an ad
    pub fn available_liquidity(env: Env, ad_id: String) -> u128 {
        if let Some(ad) = storage::get_ad(&env, &ad_id) {
            ad.balance - ad.locked
        } else {
            0
        }
    }

    /// Check if a request hash has been processed
    pub fn check_request_hash_exists(env: Env, message: BytesN<32>) -> bool {
        storage::is_request_hash_used(&env, &message)
    }

    /// Get the latest merkle root
    pub fn get_latest_merkle_root(env: Env) -> Result<BytesN<32>, AdManagerError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_root(&env, &config.merkle_manager))
    }

    /// Get historical root at index
    pub fn get_historical_root(env: Env, index: u128) -> Result<BytesN<32>, AdManagerError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_root_at_index(&env, &config.merkle_manager, index))
    }

    /// Get merkle leaf count
    pub fn get_merkle_leaf_count(env: Env) -> Result<u128, AdManagerError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_width(&env, &config.merkle_manager))
    }

    /// Get ad details
    pub fn get_ad(env: Env, ad_id: String) -> Option<Ad> {
        storage::get_ad(&env, &ad_id)
    }

    /// Get chain configuration
    pub fn get_chain(env: Env, chain_id: u128) -> Option<ChainInfo> {
        storage::get_chain(&env, chain_id)
    }

    /// Get order status
    pub fn get_order_status(env: Env, order_hash: BytesN<32>) -> Status {
        storage::get_order_status(&env, &order_hash)
    }

    /// Check if address is a manager
    pub fn is_manager(env: Env, addr: Address) -> bool {
        storage::is_manager(&env, &addr)
    }

    /// Get chain ID
    pub fn get_chain_id(env: Env) -> Result<u128, AdManagerError> {
        let config = storage::get_config(&env)?;
        Ok(config.chain_id)
    }

    /// Get contract configuration
    pub fn get_config(env: Env) -> Result<ContractConfig, AdManagerError> {
        storage::get_config(&env)
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /// Validate order parameters against ad and chain configuration
    fn validate_order(env: &Env, ad: &Ad, params: &OrderParams) -> Result<(), AdManagerError> {
        // Check ad is open
        if !ad.open {
            return Err(AdManagerError::AdClosed);
        }

        // Check amount > 0
        if params.amount == 0 {
            return Err(AdManagerError::ZeroAmount);
        }

        // Check bridger not zero
        if auth::is_zero_bytes32(&params.bridger) {
            return Err(AdManagerError::BridgerZero);
        }

        // Check recipient not zero
        if auth::is_zero_bytes32(&params.order_recipient) {
            return Err(AdManagerError::RecipientZero);
        }

        // Check source chain is supported
        let chain_info = storage::get_chain(env, params.order_chain_id)
            .ok_or(AdManagerError::ChainNotSupported)?;
        if !chain_info.supported {
            return Err(AdManagerError::ChainNotSupported);
        }

        // Check order portal matches (if configured)
        if !auth::is_zero_bytes32(&chain_info.order_portal)
            && chain_info.order_portal != params.src_order_portal
        {
            return Err(AdManagerError::OrderPortalMismatch);
        }

        // Check order chain matches ad's chain
        if params.order_chain_id != ad.order_chain_id {
            return Err(AdManagerError::OrderChainMismatch);
        }

        // Check token route exists and matches
        let routed = storage::get_token_route(env, &params.ad_chain_token, params.order_chain_id)
            .ok_or(AdManagerError::MissingRoute)?;
        if routed != params.order_chain_token {
            return Err(AdManagerError::OrderTokenMismatch);
        }

        // Check ad token matches
        if params.ad_chain_token != ad.token {
            return Err(AdManagerError::AdTokenMismatch);
        }

        // Check ad recipient matches
        if params.ad_recipient != ad.ad_recipient {
            return Err(AdManagerError::AdRecipientMismatch);
        }

        Ok(())
    }

    // =========================================================================
    // Proof Verification Helpers
    // =========================================================================

    /// Build public inputs for the ZK proof verification.
    ///
    /// The public inputs are ordered as (matching EVM buildPublicInputs):
    /// - nullifier_hash (32 bytes)
    /// - order_hash_mod (32 bytes) - order hash with BN254 field modulus applied
    /// - target_root (32 bytes)
    /// - chain_flag (32 bytes) - value 1 for destination/ad chain
    ///
    /// Total: 128 bytes (4 x 32-byte field elements)
    fn build_public_inputs(
        env: &Env,
        merkle_manager: &Address,
        nullifier_hash: &BytesN<32>,
        target_root: &BytesN<32>,
        order_hash: &BytesN<32>,
    ) -> Bytes {
        // Apply field modulus to order hash (same as EVM)
        let order_hash_mod = Self::get_field_mod(env, merkle_manager, order_hash);

        // Chain flag = 1 for destination/ad chain (as bytes32)
        let mut chain_flag = [0u8; 32];
        chain_flag[31] = 1; // Big-endian uint256(1)

        let mut inputs = Bytes::new(env);

        // Append nullifier_hash (32 bytes)
        inputs.append(&Bytes::from_slice(env, &nullifier_hash.to_array()));

        // Append order_hash_mod (32 bytes)
        inputs.append(&Bytes::from_slice(env, &order_hash_mod.to_array()));

        // Append target_root (32 bytes)
        inputs.append(&Bytes::from_slice(env, &target_root.to_array()));

        // Append chain_flag (32 bytes) - value 1 for destination chain
        inputs.append(&Bytes::from_slice(env, &chain_flag));

        inputs
    }

    /// Verify a ZK proof via cross-contract call to the Verifier contract.
    ///
    /// # Arguments
    /// * `verifier` - Address of the Verifier contract
    /// * `public_inputs` - The public inputs as bytes
    /// * `proof_bytes` - The proof bytes
    ///
    /// # Errors
    /// * `InvalidProof` - Proof verification failed
    fn verify_proof(
        env: &Env,
        verifier: &Address,
        public_inputs: &Bytes,
        proof_bytes: &Bytes,
    ) -> Result<(), AdManagerError> {
        // Build arguments for cross-contract call
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(public_inputs.into_val(env));
        args.push_back(proof_bytes.into_val(env));

        // Call verify_proof on the Verifier contract
        // The Verifier contract returns Result<(), VerifierError>
        // We map any error to InvalidProof
        env.try_invoke_contract::<(), InvokeError>(
            verifier,
            &Symbol::new(env, "verify_proof"),
            args,
        )
        .map_err(|_| AdManagerError::InvalidProof)?
        .map_err(|_| AdManagerError::InvalidProof)?;

        Ok(())
    }

    // =========================================================================
    // MerkleManager Cross-Contract Calls
    // =========================================================================

    /// Append an order hash to the MerkleManager.
    ///
    /// This calls the MerkleManager contract to add the order hash to the MMR.
    fn append_to_merkle(
        env: &Env,
        merkle_manager: &Address,
        order_hash: &BytesN<32>,
    ) -> Result<(), AdManagerError> {
        // Build arguments: (manager: Address, order_hash: BytesN<32>)
        // The AdManager contract is the manager
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(env.current_contract_address().into_val(env));
        args.push_back(order_hash.into_val(env));

        // Call append_order_hash on MerkleManager
        env.try_invoke_contract::<bool, InvokeError>(
            merkle_manager,
            &Symbol::new(env, "append_order_hash"),
            args,
        )
        .map_err(|_| AdManagerError::MerkleAppendFailed)?
        .map_err(|_| AdManagerError::MerkleAppendFailed)?;

        Ok(())
    }

    /// Get the current root from MerkleManager.
    fn get_merkle_root(env: &Env, merkle_manager: &Address) -> BytesN<32> {
        let args: Vec<Val> = Vec::new(env);
        env.invoke_contract::<BytesN<32>>(
            merkle_manager,
            &Symbol::new(env, "get_root"),
            args,
        )
    }

    /// Get a historical root from MerkleManager at a specific width.
    fn get_merkle_root_at_index(
        env: &Env,
        merkle_manager: &Address,
        index: u128,
    ) -> BytesN<32> {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(index.into_val(env));
        env.invoke_contract::<BytesN<32>>(
            merkle_manager,
            &Symbol::new(env, "get_root_at_index"),
            args,
        )
    }

    /// Get the current width (leaf count) from MerkleManager.
    fn get_merkle_width(env: &Env, merkle_manager: &Address) -> u128 {
        let args: Vec<Val> = Vec::new(env);
        env.invoke_contract::<u128>(
            merkle_manager,
            &Symbol::new(env, "get_width"),
            args,
        )
    }

    /// Apply BN254 field modulus to a hash via MerkleManager.
    ///
    /// This ensures the order hash is within the Poseidon2 field for ZK verification.
    fn get_field_mod(env: &Env, merkle_manager: &Address, order_hash: &BytesN<32>) -> BytesN<32> {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(order_hash.into_val(env));
        env.invoke_contract::<BytesN<32>>(
            merkle_manager,
            &Symbol::new(env, "field_mod"),
            args,
        )
    }
}

#[cfg(test)]
mod test;
