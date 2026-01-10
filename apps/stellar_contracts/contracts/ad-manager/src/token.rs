//! Token handling for the AdManager contract
//!
//! This module provides functions for interacting with Stellar Asset Contracts (SAC)
//! and handling native XLM through the wrapped XLM contract.

extern crate alloc;

use soroban_sdk::{token, Address, BytesN, Env, String as SorobanString};
use stellar_strkey::Contract;

use crate::errors::AdManagerError;
use crate::types::NATIVE_TOKEN_ADDRESS;

// =============================================================================
// Native Token Check
// =============================================================================

/// Check if the given token address represents the native token (XLM)
pub fn is_native_token(token_addr: &BytesN<32>) -> bool {
    token_addr.to_array() == NATIVE_TOKEN_ADDRESS
}

// =============================================================================
// Token Transfer Functions
// =============================================================================

/// Transfer tokens from a user to the contract
///
/// For SAC tokens, this requires the user to have approved the contract
/// or the user must be the invoker with require_auth.
pub fn transfer_from_user(
    env: &Env,
    token_addr: &Address,
    from: &Address,
    amount: i128,
) -> Result<(), AdManagerError> {
    let token_client = token::Client::new(env, token_addr);
    let contract_addr = env.current_contract_address();

    // Transfer from user to contract
    // This requires the user to have approved the transfer or be the authorized caller
    token_client.transfer(from, &contract_addr, &amount);

    Ok(())
}

/// Transfer tokens from the contract to a user
pub fn transfer_to_user(
    env: &Env,
    token_addr: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), AdManagerError> {
    let token_client = token::Client::new(env, token_addr);
    let contract_addr = env.current_contract_address();

    // Transfer from contract to user
    token_client.transfer(&contract_addr, to, &amount);

    Ok(())
}

/// Get token balance of an address
pub fn get_balance(env: &Env, token_addr: &Address, addr: &Address) -> i128 {
    let token_client = token::Client::new(env, token_addr);
    token_client.balance(addr)
}

/// Get contract's token balance
pub fn get_contract_balance(env: &Env, token_addr: &Address) -> i128 {
    let contract_addr = env.current_contract_address();
    get_balance(env, token_addr, &contract_addr)
}

// =============================================================================
// Native Token (XLM) Handling
// =============================================================================

/// Deposit native XLM by wrapping it
///
/// This calls the wrapped XLM contract to deposit native XLM.
pub fn deposit_native(
    env: &Env,
    w_native_addr: &Address,
    from: &Address,
    amount: i128,
) -> Result<(), AdManagerError> {
    // For wrapped XLM, we use the standard SAC interface
    // The deposit is handled by transferring XLM to the wrapper contract
    // and receiving wrapped tokens in return

    // In Soroban, native XLM is accessed through the built-in XLM SAC
    // The wrapped XLM contract should handle the wrapping automatically
    let token_client = token::Client::new(env, w_native_addr);
    let contract_addr = env.current_contract_address();

    token_client.transfer(from, &contract_addr, &amount);

    Ok(())
}

/// Withdraw native XLM by unwrapping
///
/// This calls the wrapped XLM contract to withdraw native XLM.
pub fn withdraw_native(
    env: &Env,
    w_native_addr: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), AdManagerError> {
    let token_client = token::Client::new(env, w_native_addr);
    let contract_addr = env.current_contract_address();

    token_client.transfer(&contract_addr, to, &amount);

    Ok(())
}

// =============================================================================
// BytesN<32> to Address Conversion
// =============================================================================

/// Convert BytesN<32> token address to Soroban Address
///
/// This is needed because we store cross-chain addresses as BytesN<32>
/// but need Soroban Address for token operations.
///
/// NOTE: This assumes the BytesN<32> contains a valid Stellar contract address.
/// For cross-chain addresses (e.g., EVM), this should not be used directly.
pub fn bytes32_to_token_address(env: &Env, bytes: &BytesN<32>) -> Option<Address> {
    // Check if it's the native token marker
    if is_native_token(bytes) {
        return None; // Native token, use w_native_token instead
    }

    // Convert BytesN<32> to contract strkey format
    // Contract addresses start with 'C' and are base32-encoded
    let contract_id = bytes.to_array();
    let strkey = Contract(contract_id).to_string();

    // Create Address from the strkey string
    let strkey_bytes = strkey.as_bytes();
    let soroban_str = SorobanString::from_str(env, core::str::from_utf8(strkey_bytes).unwrap());
    Some(Address::from_string(&soroban_str))
}

/// Convert Soroban Address to BytesN<32>
///
/// This extracts the raw bytes from a Soroban Address for storage.
/// Works for both contract and account addresses.
pub fn address_to_bytes32(env: &Env, addr: &Address) -> BytesN<32> {
    use stellar_strkey::{Contract, ed25519::PublicKey};

    // Convert address to string representation
    let addr_str = addr.to_string();
    let addr_bytes = get_string_bytes(env, &addr_str);
    let addr_str_slice = core::str::from_utf8(&addr_bytes).unwrap();

    // Parse the strkey and extract the 32-byte payload
    let mut buf = [0u8; 32];

    if addr_str_slice.starts_with('C') {
        // Contract address
        if let Ok(contract) = Contract::from_string(addr_str_slice) {
            buf = contract.0;
        }
    } else if addr_str_slice.starts_with('G') {
        // Account address (Ed25519 public key)
        if let Ok(pubkey) = PublicKey::from_string(addr_str_slice) {
            buf = pubkey.0;
        }
    }

    BytesN::from_array(env, &buf)
}

/// Helper to get bytes from a Soroban String
fn get_string_bytes(env: &Env, s: &SorobanString) -> alloc::vec::Vec<u8> {
    let len = s.len() as usize;
    let mut buf = alloc::vec![0u8; len];
    s.copy_into_slice(&mut buf);
    buf
}

// =============================================================================
// Token Operations with BytesN<32> Addresses
// =============================================================================

/// Transfer tokens using BytesN<32> token address
///
/// This handles the conversion from BytesN<32> to Address and performs the transfer.
/// For native tokens, it uses the wrapped native token contract.
pub fn transfer_tokens(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    from: &Address,
    to: &Address,
    amount: u128,
) -> Result<(), AdManagerError> {
    let amount_i128 = amount as i128;

    if is_native_token(token_bytes) {
        // For native token, use wrapped XLM
        let token_client = token::Client::new(env, w_native_addr);
        token_client.transfer(from, to, &amount_i128);
    } else {
        // For other tokens, convert BytesN<32> to Address
        if let Some(token_addr) = bytes32_to_token_address(env, token_bytes) {
            let token_client = token::Client::new(env, &token_addr);
            token_client.transfer(from, to, &amount_i128);
        } else {
            return Err(AdManagerError::TokenZeroAddress);
        }
    }

    Ok(())
}

/// Transfer tokens from user to contract using BytesN<32> token address
pub fn transfer_from_user_bytes32(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    from: &Address,
    amount: u128,
) -> Result<(), AdManagerError> {
    let contract_addr = env.current_contract_address();
    transfer_tokens(env, token_bytes, w_native_addr, from, &contract_addr, amount)
}

/// Transfer tokens from contract to user using BytesN<32> token address
pub fn transfer_to_user_bytes32(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    to: &Address,
    amount: u128,
) -> Result<(), AdManagerError> {
    let contract_addr = env.current_contract_address();
    transfer_tokens(env, token_bytes, w_native_addr, &contract_addr, to, amount)
}

/// Convert BytesN<32> account address to Soroban Address
///
/// This converts an Ed25519 public key (account address) stored as bytes32
/// back to a Soroban Address (G... format).
pub fn bytes32_to_account_address(env: &Env, bytes: &BytesN<32>) -> Address {
    use stellar_strkey::ed25519::PublicKey;

    // Convert bytes to strkey G... format
    let pubkey = PublicKey(bytes.to_array());
    let strkey = pubkey.to_string();

    // Create Address from the strkey string
    let strkey_bytes = strkey.as_bytes();
    let soroban_str = SorobanString::from_str(env, core::str::from_utf8(strkey_bytes).unwrap());
    Address::from_string(&soroban_str)
}

/// Transfer tokens from contract to recipient using BytesN<32> addresses
///
/// This handles the case where the recipient is stored as BytesN<32> (cross-chain compatible).
pub fn transfer_to_recipient_bytes32(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    recipient_bytes: &BytesN<32>,
    amount: u128,
) -> Result<(), AdManagerError> {
    let contract_addr = env.current_contract_address();
    let recipient = bytes32_to_account_address(env, recipient_bytes);
    transfer_tokens(env, token_bytes, w_native_addr, &contract_addr, &recipient, amount)
}
