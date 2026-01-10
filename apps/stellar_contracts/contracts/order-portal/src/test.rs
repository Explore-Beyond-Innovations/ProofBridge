#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

use crate::{OrderPortalContract, OrderPortalContractClient};

// =============================================================================
// Helper Functions
// =============================================================================

fn setup_contract(env: &Env) -> (OrderPortalContractClient, Address, Address, Address, Address) {
    let contract_id = env.register(OrderPortalContract, ());
    let client = OrderPortalContractClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let verifier = Address::generate(env);
    let merkle_manager = Address::generate(env);
    let w_native_token = Address::generate(env);

    (client, admin, verifier, merkle_manager, w_native_token)
}

// =============================================================================
// Initialization Tests
// =============================================================================

#[test]
fn test_initialization() {
    let env = Env::default();
    let (client, admin, verifier, merkle_manager, w_native_token) = setup_contract(&env);

    let chain_id: u128 = 2_000_000_002; // Stellar testnet

    // Initialize
    client.initialize(&admin, &verifier, &merkle_manager, &w_native_token, &chain_id);

    // Verify
    assert!(client.is_initialized());
    assert!(client.is_manager(&admin));
    assert_eq!(client.get_chain_id(), chain_id);
}

#[test]
fn test_double_initialization_fails() {
    let env = Env::default();
    let (client, admin, verifier, merkle_manager, w_native_token) = setup_contract(&env);

    let chain_id: u128 = 2_000_000_002;

    // First initialize should succeed
    client.initialize(&admin, &verifier, &merkle_manager, &w_native_token, &chain_id);

    // Second initialize should fail
    let result = client.try_initialize(&admin, &verifier, &merkle_manager, &w_native_token, &chain_id);
    assert!(result.is_err());
}

// =============================================================================
// EIP-712 Tests
// =============================================================================

mod eip712_tests {
    use crate::eip712::*;

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

    #[test]
    fn test_domain_separator() {
        // The domain separator should be deterministic
        let sep1 = domain_separator_proofbridge();
        let sep2 = domain_separator_proofbridge();
        assert_eq!(sep1, sep2);
        // Should not be zero
        assert_ne!(sep1, [0u8; 32]);
    }
}
