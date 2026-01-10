//! MerkleManager Contract for Stellar/Soroban
//!
//! This contract manages order hashes for the ProofBridge protocol using a
//! Merkle Mountain Range (MMR) data structure with Poseidon2 hashing.
//!
//! ## Usage
//!
//! 1. Deploy and initialize the contract with an admin address
//! 2. Admin sets the AdManager contract as a manager
//! 3. Manager calls `append_order_hash` to add order hashes
//! 4. Anyone can query `get_root`, `get_width`, etc.

#![no_std]

mod errors;
mod mmr;
mod storage;

use errors::MerkleError;
use soroban_sdk::{contract, contractimpl, symbol_short, Address, BytesN, Env};

// =============================================================================
// Contract Definition
// =============================================================================

/// MerkleManager Contract
///
/// Manages order hashes using a Merkle Mountain Range (MMR) with Poseidon2.
#[contract]
pub struct MerkleManagerContract;

#[contractimpl]
impl MerkleManagerContract {
    // =========================================================================
    // Initialization
    // =========================================================================

    /// Initialize the contract with an admin address.
    ///
    /// Can only be called once. The admin can set managers who are
    /// authorized to append order hashes.
    pub fn initialize(env: Env, admin: Address) -> Result<(), MerkleError> {
        if storage::is_initialized(&env) {
            return Err(MerkleError::AlreadyInitialized);
        }

        // Validate admin address
        if admin == env.current_contract_address() {
            return Err(MerkleError::ZeroAddress);
        }

        // Store admin
        storage::set_admin(&env, &admin);

        // Mark as initialized
        storage::set_initialized(&env);

        // Extend TTL
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Admin Functions
    // =========================================================================

    /// Set or unset a manager.
    ///
    /// Only the admin can call this function. Managers are authorized
    /// to append order hashes to the MMR.
    pub fn set_manager(env: Env, manager: Address, status: bool) -> Result<(), MerkleError> {
        if !storage::is_initialized(&env) {
            return Err(MerkleError::NotInitialized);
        }

        // Get admin and require auth
        let admin = storage::get_admin(&env).ok_or(MerkleError::NotInitialized)?;
        admin.require_auth();

        // Set manager status
        storage::set_manager(&env, &manager, status);

        // Emit event
        env.events()
            .publish((symbol_short!("mgr_upd"), manager.clone()), status);

        // Extend TTL
        storage::extend_instance_ttl(&env);

        Ok(())
    }

    // =========================================================================
    // Core Functions
    // =========================================================================

    /// Append an order hash to the MMR.
    ///
    /// Only authorized managers can call this function.
    /// Returns true on success.
    pub fn append_order_hash(
        env: Env,
        manager: Address,
        order_hash: BytesN<32>,
    ) -> Result<bool, MerkleError> {
        if !storage::is_initialized(&env) {
            return Err(MerkleError::NotInitialized);
        }

        // Require manager auth
        manager.require_auth();

        // Check manager is authorized
        if !storage::is_manager(&env, &manager) {
            return Err(MerkleError::NotManager);
        }

        // Append to MMR
        let leaf_index = mmr::append(&env, &order_hash);

        // Get updated state for event
        let width = storage::get_width(&env);
        let size = storage::get_size(&env);
        let root = storage::get_root(&env);

        // Emit event
        env.events().publish(
            (symbol_short!("mmr_add"), leaf_index),
            (order_hash, width, size, root),
        );

        // Extend TTL
        storage::extend_instance_ttl(&env);

        Ok(true)
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// Get the current MMR root.
    pub fn get_root(env: Env) -> BytesN<32> {
        storage::get_root(&env)
    }

    /// Get the root at a specific width (leaf count).
    ///
    /// This allows verification against historical roots.
    pub fn get_root_at_index(env: Env, leaf_index: u128) -> BytesN<32> {
        storage::get_root_at_width(&env, leaf_index).unwrap_or(BytesN::from_array(&env, &[0u8; 32]))
    }

    /// Get the current width (number of leaves).
    pub fn get_width(env: Env) -> u128 {
        storage::get_width(&env)
    }

    /// Get the current size (total number of nodes).
    pub fn get_size(env: Env) -> u128 {
        storage::get_size(&env)
    }

    /// Get a node hash by index.
    pub fn get_node(env: Env, index: u128) -> BytesN<32> {
        storage::get_node_hash(&env, index).unwrap_or(BytesN::from_array(&env, &[0u8; 32]))
    }

    /// Apply BN254 field modulus to a hash.
    ///
    /// This is useful for ensuring hashes are within the Poseidon2 field.
    pub fn field_mod(env: Env, order_hash: BytesN<32>) -> BytesN<32> {
        mmr::field_mod(&env, &order_hash)
    }

    /// Check if an address is a manager.
    pub fn is_manager(env: Env, addr: Address) -> bool {
        storage::is_manager(&env, &addr)
    }

    /// Get the admin address.
    pub fn get_admin(env: Env) -> Option<Address> {
        storage::get_admin(&env)
    }

    /// Check if the contract is initialized.
    pub fn is_initialized(env: Env) -> bool {
        storage::is_initialized(&env)
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
