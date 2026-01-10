//! UltraHonk Verifier Contract for Stellar/Soroban
//!
//! This contract wraps the UltraHonk proof verifier with an immutable verification key.
//! The verification key is set at deployment time via the constructor and cannot be changed.
//!
//! ## Usage
//!
//! 1. Deploy the contract with `__constructor(vk_bytes)` - VK is set immutably
//! 2. Call `verify_proof(public_inputs, proof_bytes)` to verify proofs
//!
//! The verification key is stored on-chain at deployment and cannot be updated.

#![no_std]

extern crate alloc;

mod backend;

use alloc::{boxed::Box, vec::Vec as StdVec};
use soroban_sdk::{contract, contracterror, contractimpl, symbol_short, Bytes, Env, Symbol};
use ultrahonk_rust_verifier::{ec, hash, utils::load_vk_from_bytes, UltraHonkVerifier, PROOF_BYTES};

use backend::{SorobanBn254, SorobanKeccak};

// =============================================================================
// Error Types
// =============================================================================

#[contracterror]
#[repr(u32)]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum VerifierError {
    /// Failed to parse verification key bytes
    VkParseError = 1,
    /// Failed to parse proof bytes
    ProofParseError = 2,
    /// Proof verification failed
    VerificationFailed = 3,
    /// Verification key not set (constructor not called properly)
    VkNotSet = 4,
}

// =============================================================================
// Contract Definition
// =============================================================================

/// UltraHonk Verifier Contract
///
/// Stores an immutable verification key and verifies UltraHonk proofs.
#[contract]
pub struct VerifierContract;

#[contractimpl]
impl VerifierContract {
    // =========================================================================
    // Storage Keys
    // =========================================================================

    fn key_vk() -> Symbol {
        symbol_short!("vk")
    }

    // =========================================================================
    // Constructor
    // =========================================================================

    /// Contract constructor - sets the verification key immutably at deployment.
    ///
    /// This function is called automatically during contract deployment and
    /// cannot be called again. The verification key is stored permanently.
    ///
    /// # Arguments
    /// * `vk_bytes` - The serialized verification key bytes
    ///
    /// # Panics
    /// * If the verification key cannot be parsed
    pub fn __constructor(env: Env, vk_bytes: Bytes) {
        // Validate the verification key can be parsed
        let vk_vec: StdVec<u8> = vk_bytes.to_alloc_vec();
        if load_vk_from_bytes(&vk_vec).is_none() {
            panic!("Invalid verification key bytes");
        }

        // Store the verification key immutably
        env.storage().instance().set(&Self::key_vk(), &vk_bytes);
    }

    // =========================================================================
    // Verification
    // =========================================================================

    /// Verify an UltraHonk proof using the stored verification key.
    ///
    /// # Arguments
    /// * `public_inputs` - The public inputs as concatenated 32-byte chunks
    /// * `proof_bytes` - The proof bytes
    ///
    /// # Errors
    /// * `VkNotSet` - Contract not initialized
    /// * `ProofParseError` - Invalid proof format
    /// * `VerificationFailed` - Proof verification failed
    pub fn verify_proof(
        env: Env,
        public_inputs: Bytes,
        proof_bytes: Bytes,
    ) -> Result<(), VerifierError> {
        // Get stored verification key
        let vk_bytes: Bytes = env
            .storage()
            .instance()
            .get(&Self::key_vk())
            .ok_or(VerifierError::VkNotSet)?;

        // Set up crypto backends
        hash::set_soroban_hash_backend(Box::new(SorobanKeccak::new(&env)));
        ec::set_soroban_bn254_backend(Box::new(SorobanBn254::new(&env)));

        // Validate proof size
        let proof_vec: StdVec<u8> = proof_bytes.to_alloc_vec();
        if proof_vec.len() != PROOF_BYTES {
            return Err(VerifierError::ProofParseError);
        }

        // Parse verification key
        let vk_vec: StdVec<u8> = vk_bytes.to_alloc_vec();
        let vk = load_vk_from_bytes(&vk_vec).ok_or(VerifierError::VkParseError)?;

        // Create verifier with the stored VK
        let verifier = UltraHonkVerifier::new_with_vk(vk);

        // Get public inputs
        let pub_inputs_bytes = public_inputs.to_alloc_vec();

        // Verify the proof
        verifier
            .verify(&proof_vec, &pub_inputs_bytes)
            .map_err(|_| VerifierError::VerificationFailed)?;

        Ok(())
    }

    // =========================================================================
    // View Functions
    // =========================================================================

    /// Get the stored verification key bytes.
    ///
    /// The VK is always set at deployment via constructor, so this should
    /// never return None for a properly deployed contract.
    pub fn get_vk(env: Env) -> Option<Bytes> {
        env.storage().instance().get(&Self::key_vk())
    }
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod test;
