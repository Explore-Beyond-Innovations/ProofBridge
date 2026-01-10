//! EIP-712 compatible hashing for cross-chain order identification
//!
//! This module implements EIP-712 typed data hashing to ensure order hashes
//! computed on Stellar match those computed on EVM chains.
//!
//! IMPORTANT: This is critical for cross-chain interoperability. The order hash
//! must be byte-for-byte identical on both EVM and Stellar.

use sha3::{Digest, Keccak256};
use soroban_sdk::{Bytes, BytesN, Env, String};

use crate::types::OrderParams;

// =============================================================================
// EIP-712 Constants
// =============================================================================

/// EIP-712 domain name
pub const EIP712_NAME: &str = "Proofbridge";

/// EIP-712 domain version
pub const EIP712_VERSION: &str = "1";

/// Precomputed: keccak256("EIP712Domain(string name,string version)")
/// Computed using: keccak256(b"EIP712Domain(string name,string version)")
pub const DOMAIN_TYPEHASH_MIN: [u8; 32] = [
    0xb0, 0x39, 0x48, 0x44, 0x63, 0x34, 0xeb, 0x9b,
    0x21, 0x96, 0xd5, 0xeb, 0x16, 0x6f, 0x69, 0xb9,
    0xd4, 0x94, 0x03, 0xeb, 0x4a, 0x12, 0xf3, 0x6d,
    0xe8, 0xd3, 0xf9, 0xf3, 0xcb, 0x8e, 0x15, 0xc3,
];

/// Precomputed: keccak256("Order(address orderChainToken,address adChainToken,uint256 amount,address bridger,uint256 orderChainId,address orderPortal,address orderRecipient,uint256 adChainId,address adManager,string adId,address adCreator,address adRecipient,uint256 salt)")
pub const ORDER_TYPEHASH: [u8; 32] = compute_order_typehash();

/// Precomputed: keccak256("Proofbridge")
pub const NAME_HASH: [u8; 32] = compute_name_hash();

/// Precomputed: keccak256("1")
pub const VERSION_HASH: [u8; 32] = compute_version_hash();

// =============================================================================
// Compile-time Hash Computation
// =============================================================================

/// Compute ORDER_TYPEHASH at compile time
const fn compute_order_typehash() -> [u8; 32] {
    // This is computed offline and hardcoded
    // keccak256("Order(address orderChainToken,address adChainToken,uint256 amount,address bridger,uint256 orderChainId,address orderPortal,address orderRecipient,uint256 adChainId,address adManager,string adId,address adCreator,address adRecipient,uint256 salt)")
    [
        0xfb, 0x5f, 0x06, 0x1e, 0x3a, 0xd8, 0xda, 0xc0,
        0x16, 0x8c, 0xdf, 0xd6, 0xcd, 0xe8, 0xc1, 0xc8,
        0x2f, 0x60, 0x64, 0x86, 0x45, 0xb3, 0x29, 0x86,
        0xfc, 0xcb, 0x20, 0x65, 0x12, 0x5c, 0xd5, 0x32,
    ]
}

/// Compute NAME_HASH at compile time
const fn compute_name_hash() -> [u8; 32] {
    // keccak256("Proofbridge")
    [
        0xce, 0xa4, 0xb9, 0x0a, 0xb1, 0x14, 0xe5, 0x57,
        0xc0, 0x15, 0x2d, 0xf0, 0xf3, 0x01, 0x09, 0x06,
        0xc4, 0x89, 0xb3, 0xad, 0xc1, 0x81, 0x4c, 0xfd,
        0xf1, 0x75, 0x5c, 0xe9, 0x28, 0xce, 0x35, 0x9c,
    ]
}

/// Compute VERSION_HASH at compile time
const fn compute_version_hash() -> [u8; 32] {
    // keccak256("1")
    [
        0xc8, 0x9e, 0xfd, 0xaa, 0x54, 0xc0, 0xf2, 0x0c,
        0x7a, 0xdf, 0x61, 0x28, 0x82, 0xdf, 0x09, 0x50,
        0xf5, 0xa9, 0x51, 0x63, 0x7e, 0x03, 0x07, 0xcd,
        0xcb, 0x4c, 0x67, 0x2f, 0x29, 0x8b, 0x8b, 0xc6,
    ]
}

// =============================================================================
// Keccak256 Implementation
// =============================================================================

/// Keccak256 hash function using sha3 crate
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    let result = hasher.finalize();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

/// Keccak256 and return as BytesN<32>
pub fn keccak256_to_bytes32(env: &Env, data: &[u8]) -> BytesN<32> {
    let hash = keccak256(data);
    BytesN::from_array(env, &hash)
}

// =============================================================================
// ABI Encoding Functions
// =============================================================================

/// ABI encode a bytes32 value (already 32 bytes, just copy)
pub fn abi_encode_bytes32(value: &[u8; 32]) -> [u8; 32] {
    *value
}

/// ABI encode an address as bytes32 (already padded in our case)
/// EVM addresses are 20 bytes, stored as 32 bytes with 12 leading zeros.
/// Stellar addresses in BytesN<32> are already 32 bytes.
pub fn abi_encode_address(addr: &BytesN<32>) -> [u8; 32] {
    addr.to_array()
}

/// ABI encode a uint256 (u128 extended to 32 bytes, big-endian)
pub fn abi_encode_uint256(value: u128) -> [u8; 32] {
    let mut buf = [0u8; 32];
    // u128 is 16 bytes, so it goes in the last 16 bytes (big-endian)
    buf[16..32].copy_from_slice(&value.to_be_bytes());
    buf
}

/// ABI encode a string by hashing it (EIP-712 string encoding)
pub fn abi_encode_string(s: &String) -> [u8; 32] {
    let len = s.len() as usize;
    let mut buf = [0u8; 1024]; // Support strings up to 1KB
    if len > 0 && len <= buf.len() {
        s.copy_into_slice(&mut buf[..len]);
    }
    keccak256(&buf[..len])
}

// =============================================================================
// Domain Separator
// =============================================================================

/// Compute the minimal EIP-712 domain separator (name, version only)
///
/// domainSeparator = keccak256(abi.encode(
///     DOMAIN_TYPEHASH_MIN,
///     keccak256(bytes("Proofbridge")),
///     keccak256(bytes("1"))
/// ))
pub fn domain_separator_proofbridge() -> [u8; 32] {
    // Concatenate: DOMAIN_TYPEHASH_MIN || NAME_HASH || VERSION_HASH
    let mut data = [0u8; 96]; // 32 * 3
    data[0..32].copy_from_slice(&DOMAIN_TYPEHASH_MIN);
    data[32..64].copy_from_slice(&NAME_HASH);
    data[64..96].copy_from_slice(&VERSION_HASH);
    keccak256(&data)
}

/// Get domain separator as BytesN<32>
pub fn domain_separator_proofbridge_bytes32(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &domain_separator_proofbridge())
}

// =============================================================================
// Order Struct Hash
// =============================================================================

/// Compute the struct hash for an Order
///
/// structHash = keccak256(abi.encode(
///     ORDER_TYPEHASH,
///     orderChainToken,
///     adChainToken,
///     amount,
///     bridger,
///     orderChainId,
///     srcOrderPortal,
///     orderRecipient,
///     adChainId,
///     adManager,
///     keccak256(bytes(adId)),
///     adCreator,
///     adRecipient,
///     salt
/// ))
pub fn struct_hash_order(
    params: &OrderParams,
    ad_chain_id: u128,
    ad_manager: &BytesN<32>,
) -> [u8; 32] {
    // Total size: 14 fields * 32 bytes = 448 bytes
    let mut data = [0u8; 448];
    let mut offset = 0;

    // ORDER_TYPEHASH
    data[offset..offset + 32].copy_from_slice(&ORDER_TYPEHASH);
    offset += 32;

    // orderChainToken (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.order_chain_token));
    offset += 32;

    // adChainToken (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.ad_chain_token));
    offset += 32;

    // amount (uint256)
    data[offset..offset + 32].copy_from_slice(&abi_encode_uint256(params.amount));
    offset += 32;

    // bridger (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.bridger));
    offset += 32;

    // orderChainId (uint256)
    data[offset..offset + 32].copy_from_slice(&abi_encode_uint256(params.order_chain_id));
    offset += 32;

    // srcOrderPortal (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.src_order_portal));
    offset += 32;

    // orderRecipient (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.order_recipient));
    offset += 32;

    // adChainId (uint256)
    data[offset..offset + 32].copy_from_slice(&abi_encode_uint256(ad_chain_id));
    offset += 32;

    // adManager (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(ad_manager));
    offset += 32;

    // keccak256(bytes(adId))
    let ad_id_hash = abi_encode_string(&params.ad_id);
    data[offset..offset + 32].copy_from_slice(&ad_id_hash);
    offset += 32;

    // adCreator (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.ad_creator));
    offset += 32;

    // adRecipient (address as bytes32)
    data[offset..offset + 32].copy_from_slice(&abi_encode_address(&params.ad_recipient));
    offset += 32;

    // salt (uint256)
    data[offset..offset + 32].copy_from_slice(&abi_encode_uint256(params.salt));

    keccak256(&data)
}

/// Get struct hash as BytesN<32>
pub fn struct_hash_order_bytes32(
    env: &Env,
    params: &OrderParams,
    ad_chain_id: u128,
    ad_manager: &BytesN<32>,
) -> BytesN<32> {
    BytesN::from_array(env, &struct_hash_order(params, ad_chain_id, ad_manager))
}

// =============================================================================
// Final Order Hash (EIP-712 Typed Data Hash)
// =============================================================================

/// Compute the final EIP-712 typed data hash for an order
///
/// digest = keccak256("\x19\x01" || domainSeparator || structHash)
pub fn hash_typed_data_v4(struct_hash: &[u8; 32]) -> [u8; 32] {
    let domain_sep = domain_separator_proofbridge();

    // Total: 2 + 32 + 32 = 66 bytes
    let mut data = [0u8; 66];

    // EIP-712 prefix: "\x19\x01"
    data[0] = 0x19;
    data[1] = 0x01;

    // Domain separator
    data[2..34].copy_from_slice(&domain_sep);

    // Struct hash
    data[34..66].copy_from_slice(struct_hash);

    keccak256(&data)
}

/// Compute the complete order hash
///
/// This is the main entry point for computing an order hash that must
/// match the EVM-computed hash for the same order parameters.
pub fn hash_order(
    env: &Env,
    params: &OrderParams,
    ad_chain_id: u128,
    ad_manager: &BytesN<32>,
) -> BytesN<32> {
    let struct_h = struct_hash_order(params, ad_chain_id, ad_manager);
    let order_hash = hash_typed_data_v4(&struct_h);
    BytesN::from_array(env, &order_hash)
}

// =============================================================================
// Helper: Convert Address to BytesN<32>
// =============================================================================

/// Convert a Stellar Address to BytesN<32> for cross-chain storage
///
/// This creates a 32-byte representation of the address suitable for
/// use in order parameters and cross-chain references.
pub fn address_to_bytes32(env: &Env, addr: &soroban_sdk::Address) -> BytesN<32> {
    // For contract addresses, we need to extract the contract ID
    // This is a simplified implementation - in production, need proper serialization
    let mut buf = [0u8; 32];
    // The Address type in Soroban can be serialized to bytes
    // For now, we'll use a placeholder that should be replaced with proper encoding
    BytesN::from_array(env, &buf)
}

/// Convert contract address to BytesN<32>
pub fn contract_address_to_bytes32(env: &Env) -> BytesN<32> {
    address_to_bytes32(env, &env.current_contract_address())
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keccak256_empty() {
        // keccak256("") = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470
        let hash = keccak256(&[]);
        assert_eq!(
            hex::encode(hash),
            "c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
    }

    #[test]
    fn test_keccak256_hello() {
        // keccak256("hello") = 0x1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8
        let hash = keccak256(b"hello");
        assert_eq!(
            hex::encode(hash),
            "1c8aff950685c2ed4bc3174f3472287b56d9517b9c948127319a09a7a36deac8"
        );
    }

    #[test]
    fn test_domain_typehash() {
        // Verify DOMAIN_TYPEHASH_MIN is correctly computed
        let computed = keccak256(b"EIP712Domain(string name,string version)");
        assert_eq!(computed, DOMAIN_TYPEHASH_MIN);
    }

    #[test]
    fn test_version_hash() {
        // keccak256("1")
        let computed = keccak256(b"1");
        assert_eq!(computed, VERSION_HASH);
    }

    #[test]
    fn test_name_hash() {
        // keccak256("Proofbridge")
        let computed = keccak256(b"Proofbridge");
        assert_eq!(computed, NAME_HASH);
    }

    #[test]
    fn test_order_typehash() {
        // Verify ORDER_TYPEHASH is correctly computed
        let type_string = "Order(address orderChainToken,address adChainToken,uint256 amount,address bridger,uint256 orderChainId,address orderPortal,address orderRecipient,uint256 adChainId,address adManager,string adId,address adCreator,address adRecipient,uint256 salt)";
        let computed = keccak256(type_string.as_bytes());
        assert_eq!(computed, ORDER_TYPEHASH);
    }
}
