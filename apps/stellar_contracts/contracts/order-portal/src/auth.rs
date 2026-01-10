//! Authentication and signature verification for the OrderPortal contract

use soroban_sdk::{Address, Bytes, BytesN, Env, String};

use crate::errors::OrderPortalError;
use crate::storage;

// =============================================================================
// Pre-Auth Validations
// =============================================================================

/// Validate pre-authorization signature and return the signer address
///
/// This function:
/// 1. Validates the message hash is not zero
/// 2. Checks auth_token hasn't been used
/// 3. Verifies time_to_expire hasn't passed
/// 4. Verifies the Ed25519 signature
/// 5. Checks signer is a registered manager
/// 6. Marks auth_token as used
pub fn pre_auth_validations(
    env: &Env,
    message: &BytesN<32>,
    auth_token: &BytesN<32>,
    time_to_expire: u64,
    signature: &BytesN<64>,
    public_key: &BytesN<32>,
) -> Result<Address, OrderPortalError> {
    // Check message is not zero
    if is_zero_bytes32(message) {
        return Err(OrderPortalError::InvalidMessage);
    }

    // Check auth_token hasn't been used
    if storage::is_request_token_used(env, auth_token) {
        return Err(OrderPortalError::TokenAlreadyUsed);
    }

    // Check expiration
    let current_timestamp = env.ledger().timestamp();
    if current_timestamp > time_to_expire {
        return Err(OrderPortalError::RequestTokenExpired);
    }

    // Verify Ed25519 signature
    verify_ed25519_signature(env, public_key, message, signature)?;

    // Convert public key to address
    let signer = get_signer_address(env, public_key)?;

    // Check signer is a manager
    if !storage::is_manager(env, &signer) {
        return Err(OrderPortalError::InvalidSigner);
    }

    // Mark auth_token as used
    storage::set_request_token_used(env, auth_token);

    Ok(signer)
}

// =============================================================================
// Signature Verification
// =============================================================================

/// Verify Ed25519 signature
pub fn verify_ed25519_signature(
    env: &Env,
    public_key: &BytesN<32>,
    message: &BytesN<32>,
    signature: &BytesN<64>,
) -> Result<(), OrderPortalError> {
    let msg_bytes = Bytes::from_slice(env, &message.to_array());

    env.crypto()
        .ed25519_verify(public_key, &msg_bytes, signature);

    Ok(())
}

/// Get address from Ed25519 public key
pub fn get_signer_address(env: &Env, public_key: &BytesN<32>) -> Result<Address, OrderPortalError> {
    use stellar_strkey::ed25519::PublicKey;

    let pubkey = PublicKey(public_key.to_array());
    let strkey = pubkey.to_string();

    let strkey_bytes = strkey.as_bytes();
    let soroban_str = String::from_str(env, core::str::from_utf8(strkey_bytes).unwrap());
    let address = Address::from_string(&soroban_str);

    Ok(address)
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Check if a BytesN<32> is all zeros
pub fn is_zero_bytes32(bytes: &BytesN<32>) -> bool {
    let arr = bytes.to_array();
    arr.iter().all(|&b| b == 0)
}

// =============================================================================
// Request Hash Functions
// =============================================================================

/// Hash a request for pre-authorization
pub fn hash_request(
    env: &Env,
    auth_token: &BytesN<32>,
    time_to_expire: u64,
    action: &str,
    params: &Bytes,
    chain_id: u128,
    contract_address: &BytesN<32>,
) -> BytesN<32> {
    let mut data = Bytes::new(env);

    // Add auth_token (32 bytes)
    data.append(&Bytes::from_slice(env, &auth_token.to_array()));

    // Add time_to_expire (8 bytes, big-endian)
    data.append(&Bytes::from_slice(env, &time_to_expire.to_be_bytes()));

    // Add action string hash
    let action_bytes = Bytes::from_slice(env, action.as_bytes());
    let action_hash = env.crypto().sha256(&action_bytes);
    data.append(&Bytes::from_slice(env, &action_hash.to_array()));

    // Add params
    data.append(params);

    // Add chain_id (16 bytes, big-endian)
    data.append(&Bytes::from_slice(env, &chain_id.to_be_bytes()));

    // Add contract_address (32 bytes)
    data.append(&Bytes::from_slice(env, &contract_address.to_array()));

    env.crypto().sha256(&data).into()
}

/// Create request hash for createOrder
pub fn create_order_request_hash(
    env: &Env,
    ad_id: &String,
    order_hash: &BytesN<32>,
    auth_token: &BytesN<32>,
    time_to_expire: u64,
    chain_id: u128,
    contract_address: &BytesN<32>,
) -> BytesN<32> {
    let mut params = Bytes::new(env);

    // Encode ad_id (hash of string)
    let ad_id_bytes = string_to_bytes(env, ad_id);
    let ad_id_hash = env.crypto().sha256(&ad_id_bytes);
    params.append(&Bytes::from_slice(env, &ad_id_hash.to_array()));

    // Encode order_hash
    params.append(&Bytes::from_slice(env, &order_hash.to_array()));

    hash_request(
        env,
        auth_token,
        time_to_expire,
        "createOrder",
        &params,
        chain_id,
        contract_address,
    )
}

/// Create request hash for unlock
pub fn unlock_order_request_hash(
    env: &Env,
    ad_id: &String,
    order_hash: &BytesN<32>,
    target_root: &BytesN<32>,
    auth_token: &BytesN<32>,
    time_to_expire: u64,
    chain_id: u128,
    contract_address: &BytesN<32>,
) -> BytesN<32> {
    let mut params = Bytes::new(env);

    // Encode ad_id (hash of string)
    let ad_id_bytes = string_to_bytes(env, ad_id);
    let ad_id_hash = env.crypto().sha256(&ad_id_bytes);
    params.append(&Bytes::from_slice(env, &ad_id_hash.to_array()));

    // Encode order_hash
    params.append(&Bytes::from_slice(env, &order_hash.to_array()));

    // Encode target_root
    params.append(&Bytes::from_slice(env, &target_root.to_array()));

    hash_request(
        env,
        auth_token,
        time_to_expire,
        "unlockOrder",
        &params,
        chain_id,
        contract_address,
    )
}

/// Convert String to Bytes
fn string_to_bytes(env: &Env, s: &String) -> Bytes {
    let len = s.len() as usize;
    let mut buf = [0u8; 256];
    s.copy_into_slice(&mut buf[..len]);
    Bytes::from_slice(env, &buf[..len])
}
