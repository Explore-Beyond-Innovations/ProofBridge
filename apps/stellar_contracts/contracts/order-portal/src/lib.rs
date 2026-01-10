//! OrderPortal Contract for Stellar/Soroban
//!
//! This contract allows bridgers to open cross-chain orders by depositing tokens.
//! Makers (ad creators) later unlock those funds with proofs on this chain.
//!
//! ## Usage
//!
//! 1. Deploy and initialize the contract
//! 2. Admin configures destination chains and token routes
//! 3. Bridgers create orders by depositing tokens
//! 4. Makers unlock orders with ZK proofs

#![no_std]

mod auth;
mod eip712;
mod errors;
mod events;
mod storage;
mod token;
mod types;

use errors::OrderPortalError;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, Bytes, BytesN, Env, IntoVal, InvokeError, String, Symbol, Val, Vec};
use types::{ChainInfo, ContractConfig, OrderParams, Status};

// =============================================================================
// Contract Definition
// =============================================================================

#[contract]
pub struct OrderPortalContract;

#[contractimpl]
impl OrderPortalContract {
    // =========================================================================
    // Initialization
    // =========================================================================

    /// Initialize the contract with admin and external contract addresses
    pub fn initialize(
        env: Env,
        admin: Address,
        verifier: Address,
        merkle_manager: Address,
        w_native_token: Address,
        chain_id: u128,
    ) -> Result<(), OrderPortalError> {
        if storage::is_initialized(&env) {
            return Err(OrderPortalError::AlreadyInitialized);
        }

        // Validate addresses
        if admin == env.current_contract_address() {
            return Err(OrderPortalError::ZeroAddress);
        }

        // Store configuration
        let config = ContractConfig {
            admin: admin.clone(),
            verifier,
            merkle_manager,
            w_native_token,
            chain_id,
        };
        storage::set_config(&env, &config);

        // Set admin as manager
        storage::set_manager(&env, &admin, true);

        // Mark as initialized
        storage::set_initialized(&env);

        // Extend TTL
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Admin Functions - Managers
    // =========================================================================

    /// Set or unset a manager
    pub fn set_manager(env: Env, manager: Address, status: bool) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Require admin auth
        config.admin.require_auth();

        if manager == env.current_contract_address() {
            return Err(OrderPortalError::ZeroAddress);
        }

        storage::set_manager(&env, &manager, status);

        events::emit_manager_updated(&env, &manager, status);
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Admin Functions - Chains
    // =========================================================================

    /// Configure a destination (ad) chain
    pub fn set_chain(
        env: Env,
        ad_chain_id: u128,
        ad_manager: BytesN<32>,
        supported: bool,
    ) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Require admin auth
        config.admin.require_auth();

        if supported && auth::is_zero_bytes32(&ad_manager) {
            return Err(OrderPortalError::ZeroAddress);
        }

        let chain_info = ChainInfo {
            supported,
            ad_manager: ad_manager.clone(),
        };
        storage::set_chain(&env, ad_chain_id, &chain_info);

        events::emit_chain_set(&env, ad_chain_id, &ad_manager, supported);
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    /// Remove a destination chain configuration
    pub fn remove_chain(env: Env, ad_chain_id: u128) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Require admin auth
        config.admin.require_auth();

        storage::remove_chain(&env, ad_chain_id);

        events::emit_chain_set(&env, ad_chain_id, &BytesN::from_array(&env, &[0u8; 32]), false);
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Admin Functions - Token Routes
    // =========================================================================

    /// Set a token route for a destination chain
    pub fn set_token_route(
        env: Env,
        order_token: BytesN<32>,
        ad_chain_id: u128,
        ad_token: BytesN<32>,
    ) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Require admin auth
        config.admin.require_auth();

        if auth::is_zero_bytes32(&order_token) || auth::is_zero_bytes32(&ad_token) {
            return Err(OrderPortalError::RoutesZeroAddress);
        }

        // Check chain is supported
        let chain_info = storage::get_chain(&env, ad_chain_id)
            .ok_or(OrderPortalError::AdChainNotSupported)?;
        if !chain_info.supported {
            return Err(OrderPortalError::AdChainNotSupported);
        }

        storage::set_token_route(&env, &order_token, ad_chain_id, &ad_token);

        events::emit_token_route_set(&env, &order_token, ad_chain_id, &ad_token);
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    /// Remove a token route
    pub fn remove_token_route(
        env: Env,
        order_token: BytesN<32>,
        ad_chain_id: u128,
    ) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Require admin auth
        config.admin.require_auth();

        storage::remove_token_route(&env, &order_token, ad_chain_id);

        events::emit_token_route_removed(&env, &order_token, ad_chain_id);
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Bridger Functions - Create Order
    // =========================================================================

    /// Create and fund an order
    ///
    /// Bridger deposits tokens and creates an order that can be unlocked
    /// by a maker with a ZK proof on this chain.
    pub fn create_order(
        env: Env,
        signature: BytesN<64>,
        public_key: BytesN<32>,
        auth_token: BytesN<32>,
        time_to_expire: u64,
        params: OrderParams,
    ) -> Result<BytesN<32>, OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Validate order and compute hash
        let order_hash = Self::validate_order(&env, &config, &params)?;

        // Check order doesn't exist
        if storage::get_order_status(&env, &order_hash) != Status::None {
            return Err(OrderPortalError::OrderExists);
        }

        // Build request hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let message = auth::create_order_request_hash(
            &env,
            &params.ad_id,
            &order_hash,
            &auth_token,
            time_to_expire,
            config.chain_id,
            &contract_bytes,
        );

        // Check request hash not processed
        if storage::is_request_hash_used(&env, &message) {
            return Err(OrderPortalError::RequestHashProcessed);
        }

        // Validate pre-auth (verifies signature, checks manager, marks auth_token used)
        let signer = auth::pre_auth_validations(
            &env,
            &message,
            &auth_token,
            time_to_expire,
            &signature,
            &public_key,
        )?;

        // Transfer tokens from bridger to contract
        let bridger_addr = token::bytes32_to_account_address(&env, &params.bridger);
        token::transfer_from_user_bytes32(
            &env,
            &params.order_chain_token,
            &config.w_native_token,
            &bridger_addr,
            params.amount,
        )?;

        // Append to merkle tree
        Self::append_to_merkle(&env, &config.merkle_manager, &order_hash)?;

        // Set order status
        storage::set_order_status(&env, &order_hash, Status::Open);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Emit event
        events::emit_order_created(
            &env,
            &order_hash,
            &params.bridger,
            &params.order_chain_token,
            params.amount,
            params.ad_chain_id,
            &params.ad_chain_token,
            &params.ad_manager,
            &params.ad_id,
            &params.ad_creator,
            &params.ad_recipient,
        );

        storage::extend_instance_ttl(&env);
        Ok(order_hash)
    }

    // =========================================================================
    // Maker Functions - Unlock with Proof
    // =========================================================================

    /// Unlock an order with a ZK proof
    ///
    /// Maker provides proof of deposit on the ad chain and receives
    /// the deposited tokens on this chain.
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
    ) -> Result<(), OrderPortalError> {
        let config = storage::get_config(&env)?;

        // Compute order hash
        let contract_bytes = eip712::contract_address_to_bytes32(&env);
        let order_hash = eip712::hash_order(&env, &params, config.chain_id, &contract_bytes);

        // Verify order is Open
        if storage::get_order_status(&env, &order_hash) != Status::Open {
            return Err(OrderPortalError::OrderNotOpen);
        }

        // Verify nullifier not used
        if storage::is_nullifier_used(&env, &nullifier_hash) {
            return Err(OrderPortalError::NullifierUsed);
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

        // Check request hash not processed
        if storage::is_request_hash_used(&env, &message) {
            return Err(OrderPortalError::RequestHashProcessed);
        }

        // Validate pre-auth
        let _signer = auth::pre_auth_validations(
            &env,
            &message,
            &auth_token,
            time_to_expire,
            &signature,
            &public_key,
        )?;

        // Build public inputs and verify proof
        let public_inputs = Self::build_public_inputs(&env, &config.merkle_manager, &nullifier_hash, &target_root, &order_hash);
        Self::verify_proof(&env, &config.verifier, &public_inputs, &proof)?;

        // Mark nullifier as used
        storage::set_nullifier_used(&env, &nullifier_hash);

        // Set order status to Filled
        storage::set_order_status(&env, &order_hash, Status::Filled);

        // Mark request hash as used
        storage::set_request_hash_used(&env, &message);

        // Transfer tokens to ad_recipient (the maker's recipient on this chain)
        token::transfer_to_recipient_bytes32(
            &env,
            &params.order_chain_token,
            &config.w_native_token,
            &params.ad_recipient,
            params.amount,
        )?;

        // Emit event
        events::emit_order_unlocked(&env, &order_hash, &params.ad_recipient, &nullifier_hash);

        storage::extend_instance_ttl(&env);
        Ok(())
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// Get destination token for a route
    pub fn get_dest_token(env: Env, order_token: BytesN<32>, ad_chain_id: u128) -> BytesN<32> {
        storage::get_token_route(&env, &order_token, ad_chain_id)
            .unwrap_or(BytesN::from_array(&env, &[0u8; 32]))
    }

    /// Check if a request hash exists
    pub fn check_request_hash_exists(env: Env, message: BytesN<32>) -> bool {
        storage::is_request_hash_used(&env, &message)
    }

    /// Get the latest merkle root
    pub fn get_latest_merkle_root(env: Env) -> Result<BytesN<32>, OrderPortalError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_root(&env, &config.merkle_manager))
    }

    /// Get historical root at index
    pub fn get_historical_root(env: Env, index: u128) -> Result<BytesN<32>, OrderPortalError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_root_at_index(&env, &config.merkle_manager, index))
    }

    /// Get merkle leaf count
    pub fn get_merkle_leaf_count(env: Env) -> Result<u128, OrderPortalError> {
        let config = storage::get_config(&env)?;
        Ok(Self::get_merkle_width(&env, &config.merkle_manager))
    }

    /// Get order status
    pub fn get_order_status(env: Env, order_hash: BytesN<32>) -> Status {
        storage::get_order_status(&env, &order_hash)
    }

    /// Get chain info
    pub fn get_chain(env: Env, chain_id: u128) -> Option<ChainInfo> {
        storage::get_chain(&env, chain_id)
    }

    /// Check if address is a manager
    pub fn is_manager(env: Env, addr: Address) -> bool {
        storage::is_manager(&env, &addr)
    }

    /// Get chain ID
    pub fn get_chain_id(env: Env) -> Result<u128, OrderPortalError> {
        let config = storage::get_config(&env)?;
        Ok(config.chain_id)
    }

    /// Get contract configuration
    pub fn get_config(env: Env) -> Result<ContractConfig, OrderPortalError> {
        storage::get_config(&env)
    }

    /// Check if initialized
    pub fn is_initialized(env: Env) -> bool {
        storage::is_initialized(&env)
    }

    // =========================================================================
    // Internal Functions
    // =========================================================================

    /// Validate order parameters and compute order hash
    fn validate_order(
        env: &Env,
        config: &ContractConfig,
        params: &OrderParams,
    ) -> Result<BytesN<32>, OrderPortalError> {
        // Check amount > 0
        if params.amount == 0 {
            return Err(OrderPortalError::ZeroAmount);
        }

        // Check ad_recipient not zero
        if auth::is_zero_bytes32(&params.ad_recipient) {
            return Err(OrderPortalError::InvalidAdRecipient);
        }

        // Check chain is supported
        let chain_info = storage::get_chain(env, params.ad_chain_id)
            .ok_or(OrderPortalError::AdChainNotSupported)?;
        if !chain_info.supported {
            return Err(OrderPortalError::AdChainNotSupported);
        }

        // Check ad_manager matches
        if chain_info.ad_manager != params.ad_manager {
            return Err(OrderPortalError::AdManagerMismatch);
        }

        // Check token route exists
        let route = storage::get_token_route(env, &params.order_chain_token, params.ad_chain_id)
            .ok_or(OrderPortalError::MissingRoute)?;

        // Check ad_chain_token matches route
        if route != params.ad_chain_token {
            return Err(OrderPortalError::AdTokenMismatch);
        }

        // Compute order hash
        let contract_bytes = eip712::contract_address_to_bytes32(env);
        let order_hash = eip712::hash_order(env, params, config.chain_id, &contract_bytes);

        Ok(order_hash)
    }

    /// Build public inputs for ZK proof verification
    ///
    /// The public inputs are ordered as (matching EVM buildPublicInputs):
    /// - nullifier_hash (32 bytes)
    /// - order_hash_mod (32 bytes) - order hash with BN254 field modulus applied
    /// - target_root (32 bytes)
    /// - chain_flag (32 bytes) - value 0 for source/order chain
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

        // Chain flag = 0 for source/order chain (as bytes32)
        let chain_flag = [0u8; 32]; // Big-endian uint256(0)

        let mut inputs = Bytes::new(env);

        // Append nullifier_hash (32 bytes)
        inputs.append(&Bytes::from_slice(env, &nullifier_hash.to_array()));

        // Append order_hash_mod (32 bytes)
        inputs.append(&Bytes::from_slice(env, &order_hash_mod.to_array()));

        // Append target_root (32 bytes)
        inputs.append(&Bytes::from_slice(env, &target_root.to_array()));

        // Append chain_flag (32 bytes) - value 0 for source chain
        inputs.append(&Bytes::from_slice(env, &chain_flag));

        inputs
    }

    /// Verify ZK proof via verifier contract
    fn verify_proof(
        env: &Env,
        verifier: &Address,
        public_inputs: &Bytes,
        proof: &Bytes,
    ) -> Result<(), OrderPortalError> {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(public_inputs.into_val(env));
        args.push_back(proof.into_val(env));

        env.try_invoke_contract::<(), InvokeError>(
            verifier,
            &Symbol::new(env, "verify_proof_with_stored_vk"),
            args,
        )
        .map_err(|_| OrderPortalError::InvalidProof)?
        .map_err(|_| OrderPortalError::InvalidProof)?;

        Ok(())
    }

    /// Append order hash to merkle tree
    fn append_to_merkle(
        env: &Env,
        merkle_manager: &Address,
        order_hash: &BytesN<32>,
    ) -> Result<(), OrderPortalError> {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(env.current_contract_address().into_val(env));
        args.push_back(order_hash.into_val(env));

        env.try_invoke_contract::<bool, InvokeError>(
            merkle_manager,
            &Symbol::new(env, "append_order_hash"),
            args,
        )
        .map_err(|_| OrderPortalError::MerkleAppendFailed)?
        .map_err(|_| OrderPortalError::MerkleAppendFailed)?;

        Ok(())
    }

    /// Get merkle root from merkle manager
    fn get_merkle_root(env: &Env, merkle_manager: &Address) -> BytesN<32> {
        let args: Vec<Val> = Vec::new(env);
        env.invoke_contract::<BytesN<32>>(
            merkle_manager,
            &Symbol::new(env, "get_root"),
            args,
        )
    }

    /// Get merkle root at index from merkle manager
    fn get_merkle_root_at_index(env: &Env, merkle_manager: &Address, index: u128) -> BytesN<32> {
        let mut args: Vec<Val> = Vec::new(env);
        args.push_back(index.into_val(env));
        env.invoke_contract::<BytesN<32>>(
            merkle_manager,
            &Symbol::new(env, "get_root_at_index"),
            args,
        )
    }

    /// Get merkle width from merkle manager
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

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
