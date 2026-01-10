//! Merkle Mountain Range (MMR) implementation with Poseidon2 hashing.
//!
//! This is a port of the Solidity MMRPoseidon2.sol library.
//! Indexing is 1-based (not 0-based) to match the EVM implementation.

use soroban_sdk::{Bytes, BytesN, Env, Symbol, U256, Vec};

use crate::storage;

// =============================================================================
// Constants
// =============================================================================

/// BN254 scalar field prime (same as in Solidity Field.PRIME)
/// p = 21888242871839275222246405745257275088548364400416034343698204186575808495617
pub const BN254_SCALAR_PRIME: [u8; 32] = [
    0x30, 0x64, 0x4e, 0x72, 0xe1, 0x31, 0xa0, 0x29,
    0xb8, 0x50, 0x45, 0xb6, 0x81, 0x81, 0x58, 0x5d,
    0x28, 0x33, 0xe8, 0x48, 0x79, 0xb9, 0x70, 0x91,
    0x43, 0xe1, 0xf5, 0x93, 0xf0, 0x00, 0x00, 0x01,
];

// =============================================================================
// Field Operations
// =============================================================================

/// Apply BN254 field modulus to a hash.
/// Reduces dataHash into the BN254 scalar field.
pub fn field_mod(env: &Env, data_hash: &BytesN<32>) -> BytesN<32> {
    // Convert BytesN<32> to big-endian u256 value
    let hash_bytes = data_hash.to_array();
    
    // Load the prime as big-endian bytes
    let prime_bytes = BN254_SCALAR_PRIME;
    
    // Perform modular reduction
    // We need to compute hash % prime
    // Since both are 256-bit values, we use big integer arithmetic
    let result = mod_reduce(&hash_bytes, &prime_bytes);
    
    BytesN::from_array(env, &result)
}

/// Perform modular reduction: value % modulus (both as big-endian bytes)
fn mod_reduce(value: &[u8; 32], modulus: &[u8; 32]) -> [u8; 32] {
    // Compare value with modulus
    // If value < modulus, return value
    // Otherwise, compute value - modulus (may need multiple subtractions)
    
    let mut result = *value;
    
    // Keep subtracting modulus while result >= modulus
    while compare_be(&result, modulus) != core::cmp::Ordering::Less {
        result = sub_be(&result, modulus);
    }
    
    result
}

/// Compare two big-endian 256-bit numbers.
fn compare_be(a: &[u8; 32], b: &[u8; 32]) -> core::cmp::Ordering {
    for i in 0..32 {
        match a[i].cmp(&b[i]) {
            core::cmp::Ordering::Equal => continue,
            other => return other,
        }
    }
    core::cmp::Ordering::Equal
}

/// Subtract two big-endian 256-bit numbers (a - b), assuming a >= b.
fn sub_be(a: &[u8; 32], b: &[u8; 32]) -> [u8; 32] {
    let mut result = [0u8; 32];
    let mut borrow: u16 = 0;
    
    for i in (0..32).rev() {
        let diff = (a[i] as u16).wrapping_sub(b[i] as u16).wrapping_sub(borrow);
        result[i] = diff as u8;
        borrow = if diff > 255 { 1 } else { 0 };
    }
    
    result
}

// =============================================================================
// Poseidon2 Hashing
// =============================================================================

/// Hash a leaf node: Poseidon2(index, dataHash)
pub fn hash_leaf(env: &Env, index: u128, data_hash: &BytesN<32>) -> BytesN<32> {
    // Build inputs for Poseidon2 using U256
    let mut inputs: Vec<U256> = Vec::new(env);
    inputs.push_back(u128_to_u256(env, index));
    inputs.push_back(bytes32_to_u256(env, data_hash));

    // Use SDK's poseidon2 hash
    let field_type: Symbol = Symbol::new(env, "BN254");
    let result: U256 = env.crypto().poseidon2_hash(field_type, &inputs);
    u256_to_bytes32(env, &result)
}

/// Hash a branch node: Poseidon2(index, left, right)
pub fn hash_branch(env: &Env, index: u128, left: &BytesN<32>, right: &BytesN<32>) -> BytesN<32> {
    // Build inputs for Poseidon2 using U256
    let mut inputs: Vec<U256> = Vec::new(env);
    inputs.push_back(u128_to_u256(env, index));
    inputs.push_back(bytes32_to_u256(env, left));
    inputs.push_back(bytes32_to_u256(env, right));

    // Use SDK's poseidon2 hash
    let field_type: Symbol = Symbol::new(env, "BN254");
    let result: U256 = env.crypto().poseidon2_hash(field_type, &inputs);
    u256_to_bytes32(env, &result)
}

/// Compute peak bagging: fold peaks into a single root.
pub fn peak_bagging(env: &Env, width: u128, peaks: &Vec<BytesN<32>>) -> BytesN<32> {
    if width == 0 {
        return BytesN::from_array(env, &[0u8; 32]);
    }

    let size = calc_size(width);
    let size_u256 = u128_to_u256(env, size);

    // Fold: acc = H(acc, peak[i])
    let field_type: Symbol = Symbol::new(env, "BN254");
    let mut acc: U256 = size_u256.clone();

    for i in 0..peaks.len() {
        let peak = peaks.get(i).unwrap();
        let mut inputs: Vec<U256> = Vec::new(env);
        inputs.push_back(acc.clone());
        inputs.push_back(bytes32_to_u256(env, &peak));
        acc = env.crypto().poseidon2_hash(field_type.clone(), &inputs);
    }

    // Final bind: H(size, acc)
    let mut final_inputs: Vec<U256> = Vec::new(env);
    final_inputs.push_back(size_u256);
    final_inputs.push_back(acc);
    let result = env.crypto().poseidon2_hash(field_type, &final_inputs);
    u256_to_bytes32(env, &result)
}

// =============================================================================
// MMR Pure Functions
// =============================================================================

/// Calculate MMR size from width (leaf count).
/// size = (width << 1) - popcount(width)
pub fn calc_size(width: u128) -> u128 {
    (width << 1) - num_of_peaks(width) as u128
}

/// Count the number of peaks (popcount of width).
pub fn num_of_peaks(width: u128) -> u32 {
    let mut bits = width;
    let mut count = 0u32;
    while bits > 0 {
        count += 1;
        bits &= bits - 1; // Clear lowest set bit
    }
    count
}

/// Get peak indexes for a given width.
pub fn get_peak_indexes(env: &Env, width: u128) -> Vec<u128> {
    let num_peaks = num_of_peaks(width);
    let mut peak_indexes: Vec<u128> = Vec::new(env);
    
    if width == 0 {
        return peak_indexes;
    }
    
    // Compute max height
    let mut max_height: u32 = 1;
    while (1u128 << max_height) <= width {
        max_height += 1;
    }
    
    let mut running_size: u128 = 0;
    for i in (1..=max_height).rev() {
        if (width & (1u128 << (i - 1))) != 0 {
            running_size = running_size + (1u128 << i) - 1;
            peak_indexes.push_back(running_size);
        }
    }
    
    // Verify count matches
    assert!(peak_indexes.len() == num_peaks);
    
    peak_indexes
}

/// Get the leaf index for a given width.
/// Width is 1-indexed count of leaves.
pub fn get_leaf_index(width: u128) -> u128 {
    if width % 2 == 1 {
        calc_size(width)
    } else {
        calc_size(width - 1) + 1
    }
}

/// Get the height of a node at a given index.
pub fn height_at(index: u128) -> u8 {
    let mut reduced_index = index;
    let mut peak_index: u128 = 0;
    let mut height: u8 = 0;
    
    while reduced_index > peak_index {
        reduced_index -= (1u128 << height) - 1;
        height = mountain_height(reduced_index);
        peak_index = (1u128 << height) - 1;
    }
    
    height - (peak_index - reduced_index) as u8
}

/// Check if an index is a leaf node.
pub fn is_leaf(index: u128) -> bool {
    height_at(index) == 1
}

/// Get the children of a node at a given index.
pub fn get_children(index: u128) -> (u128, u128) {
    let h = height_at(index);
    let left = index - (1u128 << (h - 1));
    let right = index - 1;
    assert!(left != right, "Not a parent node");
    (left, right)
}

/// Calculate the mountain height for a given size.
fn mountain_height(size: u128) -> u8 {
    let mut height: u8 = 1;
    while (1u128 << height) <= size + height as u128 {
        height += 1;
    }
    height - 1
}

// =============================================================================
// MMR Append Operation
// =============================================================================

/// Append a new leaf to the MMR.
/// Returns the new leaf index.
pub fn append(env: &Env, data_hash: &BytesN<32>) -> u128 {
    // Apply field modulus
    let data_hash_mod = field_mod(env, data_hash);
    
    // Increment width
    let width = storage::get_width(env) + 1;
    storage::set_width(env, width);
    
    // Calculate leaf index
    let leaf_index = get_leaf_index(width);
    
    // Hash leaf node: Poseidon2(index, value)
    let leaf_node = hash_leaf(env, leaf_index, &data_hash_mod);
    
    // Store leaf hash
    storage::set_node_hash(env, leaf_index, &leaf_node);
    
    // Get peak indexes
    let peak_indexes = get_peak_indexes(env, width);
    
    // Update size
    let size = calc_size(width);
    storage::set_size(env, size);
    
    // Get or create node hashes for all peaks
    let mut peaks: Vec<BytesN<32>> = Vec::new(env);
    for i in 0..peak_indexes.len() {
        let peak_idx = peak_indexes.get(i).unwrap();
        let peak_hash = get_or_create_node(env, peak_idx, size);
        peaks.push_back(peak_hash);
    }
    
    // Compute new root via peak bagging
    let new_root = peak_bagging(env, width, &peaks);
    storage::set_root(env, &new_root);
    
    // Store root in history
    storage::set_root_at_width(env, width, &new_root);
    
    leaf_index
}

/// Get or create a node hash at the given index.
/// Recursively computes branch hashes if not cached.
fn get_or_create_node(env: &Env, index: u128, size: u128) -> BytesN<32> {
    assert!(index <= size, "Index out of bounds");
    
    // Check if already cached
    if let Some(cached) = storage::get_node_hash(env, index) {
        if cached != BytesN::from_array(env, &[0u8; 32]) {
            return cached;
        }
    }
    
    // Not cached - must be a branch node, compute from children
    let (left_idx, right_idx) = get_children(index);
    let left_hash = get_or_create_node(env, left_idx, size);
    let right_hash = get_or_create_node(env, right_idx, size);
    
    let branch_hash = hash_branch(env, index, &left_hash, &right_hash);
    storage::set_node_hash(env, index, &branch_hash);
    
    branch_hash
}

// =============================================================================
// Helper Functions
// =============================================================================

/// Convert u128 to BytesN<32> (big-endian, left-padded with zeros).
pub fn u128_to_bytes32(env: &Env, value: u128) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[16..32].copy_from_slice(&value.to_be_bytes());
    BytesN::from_array(env, &bytes)
}

/// Convert BytesN<32> to u128 (assumes value fits in u128).
pub fn bytes32_to_u128(bytes: &BytesN<32>) -> u128 {
    let arr = bytes.to_array();
    u128::from_be_bytes(arr[16..32].try_into().unwrap())
}

/// Convert u128 to U256.
pub fn u128_to_u256(env: &Env, value: u128) -> U256 {
    U256::from_u128(env, value)
}

/// Convert BytesN<32> to U256 (big-endian).
pub fn bytes32_to_u256(env: &Env, bytes: &BytesN<32>) -> U256 {
    // Convert BytesN<32> to Bytes for U256::from_be_bytes
    let bytes_dynamic = Bytes::from_slice(env, &bytes.to_array());
    U256::from_be_bytes(env, &bytes_dynamic)
}

/// Convert U256 to BytesN<32> (big-endian).
pub fn u256_to_bytes32(env: &Env, value: &U256) -> BytesN<32> {
    let bytes_dynamic: Bytes = value.to_be_bytes();
    // Convert Bytes to BytesN<32>
    let mut arr = [0u8; 32];
    for i in 0..32 {
        if i < bytes_dynamic.len() as usize {
            arr[i] = bytes_dynamic.get(i as u32).unwrap();
        }
    }
    BytesN::from_array(env, &arr)
}
