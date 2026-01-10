//! Token handling for the OrderPortal contract

extern crate alloc;

use soroban_sdk::{token, Address, BytesN, Env, String as SorobanString};
use stellar_strkey::Contract;

use crate::errors::OrderPortalError;
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
pub fn transfer_from_user(
    env: &Env,
    token_addr: &Address,
    from: &Address,
    amount: i128,
) -> Result<(), OrderPortalError> {
    let token_client = token::Client::new(env, token_addr);
    let contract_addr = env.current_contract_address();

    token_client.transfer(from, &contract_addr, &amount);

    Ok(())
}

/// Transfer tokens from the contract to a user
pub fn transfer_to_user(
    env: &Env,
    token_addr: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), OrderPortalError> {
    let token_client = token::Client::new(env, token_addr);
    let contract_addr = env.current_contract_address();

    token_client.transfer(&contract_addr, to, &amount);

    Ok(())
}

// =============================================================================
// BytesN<32> to Address Conversion
// =============================================================================

/// Convert BytesN<32> token address to Soroban Address
pub fn bytes32_to_token_address(env: &Env, bytes: &BytesN<32>) -> Option<Address> {
    if is_native_token(bytes) {
        return None;
    }

    let contract_id = bytes.to_array();
    let strkey = Contract(contract_id).to_string();

    let strkey_bytes = strkey.as_bytes();
    let soroban_str = SorobanString::from_str(env, core::str::from_utf8(strkey_bytes).unwrap());
    Some(Address::from_string(&soroban_str))
}

/// Convert BytesN<32> account address to Soroban Address
pub fn bytes32_to_account_address(env: &Env, bytes: &BytesN<32>) -> Address {
    use stellar_strkey::ed25519::PublicKey;

    let pubkey = PublicKey(bytes.to_array());
    let strkey = pubkey.to_string();

    let strkey_bytes = strkey.as_bytes();
    let soroban_str = SorobanString::from_str(env, core::str::from_utf8(strkey_bytes).unwrap());
    Address::from_string(&soroban_str)
}

// =============================================================================
// Token Operations with BytesN<32> Addresses
// =============================================================================

/// Transfer tokens using BytesN<32> token address
pub fn transfer_tokens(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    from: &Address,
    to: &Address,
    amount: u128,
) -> Result<(), OrderPortalError> {
    let amount_i128 = amount as i128;

    if is_native_token(token_bytes) {
        let token_client = token::Client::new(env, w_native_addr);
        token_client.transfer(from, to, &amount_i128);
    } else {
        if let Some(token_addr) = bytes32_to_token_address(env, token_bytes) {
            let token_client = token::Client::new(env, &token_addr);
            token_client.transfer(from, to, &amount_i128);
        } else {
            return Err(OrderPortalError::TokenZeroAddress);
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
) -> Result<(), OrderPortalError> {
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
) -> Result<(), OrderPortalError> {
    let contract_addr = env.current_contract_address();
    transfer_tokens(env, token_bytes, w_native_addr, &contract_addr, to, amount)
}

/// Transfer tokens from contract to recipient using BytesN<32> addresses
pub fn transfer_to_recipient_bytes32(
    env: &Env,
    token_bytes: &BytesN<32>,
    w_native_addr: &Address,
    recipient_bytes: &BytesN<32>,
    amount: u128,
) -> Result<(), OrderPortalError> {
    let contract_addr = env.current_contract_address();
    let recipient = bytes32_to_account_address(env, recipient_bytes);
    transfer_tokens(env, token_bytes, w_native_addr, &contract_addr, &recipient, amount)
}
