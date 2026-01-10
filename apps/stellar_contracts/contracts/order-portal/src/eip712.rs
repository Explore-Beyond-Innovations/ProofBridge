//! EIP-712 compatible hashing for the OrderPortal contract
//!
//! This module provides EIP-712 typed data hashing that is compatible
//! with the EVM implementation, enabling cross-chain order verification.

use sha3::{Digest, Keccak256};
use soroban_sdk::{BytesN, Env};

use crate::types::OrderParams;

// =============================================================================
// Constants
// =============================================================================

/// EIP-712 domain name
pub const EIP712_NAME: &str = "Proofbridge";

/// EIP-712 domain version
pub const EIP712_VERSION: &str = "1";

/// keccak256("EIP712Domain(string name,string version)")
pub const DOMAIN_TYPEHASH_MIN: [u8; 32] = [
    0xb0, 0x39, 0x48, 0x44, 0x63, 0x34, 0xeb, 0x9b,
    0x21, 0x96, 0xd5, 0xeb, 0x16, 0x6f, 0x69, 0xb9,
    0xd4, 0x94, 0x03, 0xeb, 0x4a, 0x12, 0xf3, 0x6d,
    0xe8, 0xd3, 0xf9, 0xf3, 0xcb, 0x8e, 0x15, 0xc3,
];

/// keccak256("Order(address orderChainToken,address adChainToken,uint256 amount,address bridger,uint256 orderChainId,address orderPortal,address orderRecipient,uint256 adChainId,address adManager,string adId,address adCreator,address adRecipient,uint256 salt)")
pub const ORDER_TYPEHASH: [u8; 32] = [
    0xfb, 0x5f, 0x06, 0x1e, 0x3a, 0xd8, 0xda, 0xc0,
    0x16, 0x8c, 0xdf, 0xd6, 0xcd, 0xe8, 0xc1, 0xc8,
    0x2f, 0x60, 0x64, 0x86, 0x45, 0xb3, 0x29, 0x86,
    0xfc, 0xcb, 0x20, 0x65, 0x12, 0x5c, 0xd5, 0x32,
];

/// keccak256("Proofbridge")
pub const NAME_HASH: [u8; 32] = [
    0xce, 0xa4, 0xb9, 0x0a, 0xb1, 0x14, 0xe5, 0x57,
    0xc0, 0x15, 0x2d, 0xf0, 0xf3, 0x01, 0x09, 0x06,
    0xc4, 0x89, 0xb3, 0xad, 0xc1, 0x81, 0x4c, 0xfd,
    0xf1, 0x75, 0x5c, 0xe9, 0x28, 0xce, 0x35, 0x9c,
];

/// keccak256("1")
pub const VERSION_HASH: [u8; 32] = [
    0xc8, 0x9e, 0xfd, 0xaa, 0x54, 0xc0, 0xf2, 0x0c,
    0x7a, 0xdf, 0x61, 0x28, 0x82, 0xdf, 0x09, 0x50,
    0xf5, 0xa9, 0x51, 0x63, 0x7e, 0x03, 0x07, 0xcd,
    0xcb, 0x4c, 0x67, 0x2f, 0x29, 0x8b, 0x8b, 0xc6,
];

// =============================================================================
// Keccak256 Hashing
// =============================================================================

/// Compute keccak256 hash of data
pub fn keccak256(data: &[u8]) -> [u8; 32] {
    let mut hasher = Keccak256::new();
    hasher.update(data);
    hasher.finalize().into()
}

// =============================================================================
// Domain Separator
// =============================================================================

/// Compute the minimal EIP-712 domain separator (name + version only)
pub fn domain_separator_proofbridge() -> [u8; 32] {
    let mut data = [0u8; 96];
    data[0..32].copy_from_slice(&DOMAIN_TYPEHASH_MIN);
    data[32..64].copy_from_slice(&NAME_HASH);
    data[64..96].copy_from_slice(&VERSION_HASH);
    keccak256(&data)
}

// =============================================================================
// Order Hash Computation
// =============================================================================

/// Compute the struct hash for an Order
///
/// This matches the EVM's _structHash function.
pub fn struct_hash_order(
    params: &OrderParams,
    order_chain_id: u128,
    order_portal: &[u8; 32],
) -> [u8; 32] {
    // 14 elements * 32 bytes = 448 bytes
    let mut data = [0u8; 448];

    // ORDER_TYPEHASH
    data[0..32].copy_from_slice(&ORDER_TYPEHASH);

    // orderChainToken (left-padded to 32 bytes)
    data[32..64].copy_from_slice(&params.order_chain_token.to_array());

    // adChainToken
    data[64..96].copy_from_slice(&params.ad_chain_token.to_array());

    // amount (u128 -> u256, big-endian)
    let amount_bytes = u128_to_bytes32(params.amount);
    data[96..128].copy_from_slice(&amount_bytes);

    // bridger
    data[128..160].copy_from_slice(&params.bridger.to_array());

    // orderChainId
    let order_chain_id_bytes = u128_to_bytes32(order_chain_id);
    data[160..192].copy_from_slice(&order_chain_id_bytes);

    // orderPortal (this contract)
    data[192..224].copy_from_slice(order_portal);

    // orderRecipient
    data[224..256].copy_from_slice(&params.order_recipient.to_array());

    // adChainId
    let ad_chain_id_bytes = u128_to_bytes32(params.ad_chain_id);
    data[256..288].copy_from_slice(&ad_chain_id_bytes);

    // adManager
    data[288..320].copy_from_slice(&params.ad_manager.to_array());

    // keccak256(bytes(adId))
    let ad_id_len = params.ad_id.len() as usize;
    let mut ad_id_bytes = [0u8; 256];
    params.ad_id.copy_into_slice(&mut ad_id_bytes[..ad_id_len]);
    let ad_id_hash = keccak256(&ad_id_bytes[..ad_id_len]);
    data[320..352].copy_from_slice(&ad_id_hash);

    // adCreator
    data[352..384].copy_from_slice(&params.ad_creator.to_array());

    // adRecipient
    data[384..416].copy_from_slice(&params.ad_recipient.to_array());

    // salt
    let salt_bytes = u128_to_bytes32(params.salt);
    data[416..448].copy_from_slice(&salt_bytes);

    keccak256(&data)
}

/// Compute the final EIP-712 order hash
///
/// hash = keccak256("\x19\x01" || domainSeparator || structHash)
pub fn hash_typed_data_v4(struct_hash: &[u8; 32]) -> [u8; 32] {
    let domain_sep = domain_separator_proofbridge();

    let mut data = [0u8; 66];
    data[0] = 0x19;
    data[1] = 0x01;
    data[2..34].copy_from_slice(&domain_sep);
    data[34..66].copy_from_slice(struct_hash);

    keccak256(&data)
}

/// Compute the complete order hash for given parameters
pub fn hash_order(
    env: &Env,
    params: &OrderParams,
    order_chain_id: u128,
    order_portal: &BytesN<32>,
) -> BytesN<32> {
    let struct_h = struct_hash_order(params, order_chain_id, &order_portal.to_array());
    let digest = hash_typed_data_v4(&struct_h);
    BytesN::from_array(env, &digest)
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Convert u128 to 32-byte big-endian array (left-padded with zeros)
fn u128_to_bytes32(value: u128) -> [u8; 32] {
    let mut bytes = [0u8; 32];
    bytes[16..32].copy_from_slice(&value.to_be_bytes());
    bytes
}

/// Get the contract address as bytes32
pub fn contract_address_to_bytes32(env: &Env) -> BytesN<32> {
    use stellar_strkey::Contract;

    let addr = env.current_contract_address();
    let addr_str = addr.to_string();

    let len = addr_str.len() as usize;
    let mut buf = [0u8; 64];
    addr_str.copy_into_slice(&mut buf[..len]);
    let addr_str_slice = core::str::from_utf8(&buf[..len]).unwrap();

    let mut result = [0u8; 32];
    if let Ok(contract) = Contract::from_string(addr_str_slice) {
        result = contract.0;
    }

    BytesN::from_array(env, &result)
}

// =============================================================================
// Tests
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keccak256_empty() {
        let result = keccak256(&[]);
        let expected: [u8; 32] = [
            0xc5, 0xd2, 0x46, 0x01, 0x86, 0xf7, 0x23, 0x3c,
            0x92, 0x7e, 0x7d, 0xb2, 0xdc, 0xc7, 0x03, 0xc0,
            0xe5, 0x00, 0xb6, 0x53, 0xca, 0x82, 0x27, 0x3b,
            0x7b, 0xfa, 0xd8, 0x04, 0x5d, 0x85, 0xa4, 0x70,
        ];
        assert_eq!(result, expected);
    }

    #[test]
    fn test_keccak256_hello() {
        let result = keccak256(b"hello");
        let expected: [u8; 32] = [
            0x1c, 0x8a, 0xff, 0x95, 0x06, 0x85, 0xc2, 0xed,
            0x4b, 0xc3, 0x17, 0x4f, 0x34, 0x72, 0x28, 0x7b,
            0x56, 0xd9, 0x51, 0x7b, 0x9c, 0x94, 0x81, 0x27,
            0x31, 0x9a, 0x09, 0xa7, 0xa3, 0x6d, 0xea, 0xc8,
        ];
        assert_eq!(result, expected);
    }

    #[test]
    fn test_domain_typehash() {
        let result = keccak256(b"EIP712Domain(string name,string version)");
        assert_eq!(result, DOMAIN_TYPEHASH_MIN);
    }

    #[test]
    fn test_order_typehash() {
        let result = keccak256(b"Order(address orderChainToken,address adChainToken,uint256 amount,address bridger,uint256 orderChainId,address orderPortal,address orderRecipient,uint256 adChainId,address adManager,string adId,address adCreator,address adRecipient,uint256 salt)");
        assert_eq!(result, ORDER_TYPEHASH);
    }

    #[test]
    fn test_name_hash() {
        let result = keccak256(b"Proofbridge");
        assert_eq!(result, NAME_HASH);
    }

    #[test]
    fn test_version_hash() {
        let result = keccak256(b"1");
        assert_eq!(result, VERSION_HASH);
    }
}
