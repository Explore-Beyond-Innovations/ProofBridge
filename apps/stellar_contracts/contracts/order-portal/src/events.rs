//! Event publishing for the OrderPortal contract

use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

// =============================================================================
// Chain Events
// =============================================================================

/// Emit ChainSet event
pub fn emit_chain_set(env: &Env, chain_id: u128, ad_manager: &BytesN<32>, supported: bool) {
    env.events().publish(
        (symbol_short!("chain_set"), chain_id),
        (ad_manager.clone(), supported),
    );
}

// =============================================================================
// Token Route Events
// =============================================================================

/// Emit TokenRouteSet event
pub fn emit_token_route_set(
    env: &Env,
    order_token: &BytesN<32>,
    ad_chain_id: u128,
    ad_token: &BytesN<32>,
) {
    env.events().publish(
        (symbol_short!("route_set"), order_token.clone()),
        (ad_token.clone(), ad_chain_id),
    );
}

/// Emit TokenRouteRemoved event
pub fn emit_token_route_removed(env: &Env, order_token: &BytesN<32>, ad_chain_id: u128) {
    env.events().publish(
        (symbol_short!("route_rm"), order_token.clone()),
        ad_chain_id,
    );
}

// =============================================================================
// Order Events
// =============================================================================

/// Emit OrderCreated event
pub fn emit_order_created(
    env: &Env,
    order_hash: &BytesN<32>,
    bridger: &BytesN<32>,
    order_chain_token: &BytesN<32>,
    amount: u128,
    ad_chain_id: u128,
    ad_chain_token: &BytesN<32>,
    ad_manager: &BytesN<32>,
    ad_id: &String,
    ad_creator: &BytesN<32>,
    ad_recipient: &BytesN<32>,
) {
    env.events().publish(
        (symbol_short!("ord_creat"), order_hash.clone()),
        (
            bridger.clone(),
            order_chain_token.clone(),
            amount,
            ad_chain_id,
            ad_chain_token.clone(),
        ),
    );
    // Additional event data (split due to tuple size limits)
    env.events().publish(
        (symbol_short!("ord_cr_2"), order_hash.clone()),
        (
            ad_manager.clone(),
            ad_id.clone(),
            ad_creator.clone(),
            ad_recipient.clone(),
        ),
    );
}

/// Emit OrderUnlocked event
pub fn emit_order_unlocked(
    env: &Env,
    order_hash: &BytesN<32>,
    recipient: &BytesN<32>,
    nullifier_hash: &BytesN<32>,
) {
    env.events().publish(
        (symbol_short!("ord_unlck"), order_hash.clone()),
        (recipient.clone(), nullifier_hash.clone()),
    );
}

// =============================================================================
// Manager Events
// =============================================================================

/// Emit UpdateManager event
pub fn emit_manager_updated(env: &Env, manager: &Address, status: bool) {
    env.events()
        .publish((symbol_short!("mgr_upd"), manager.clone()), status);
}
