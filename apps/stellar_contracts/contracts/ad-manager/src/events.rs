//! Event publishing for the AdManager contract

use soroban_sdk::{symbol_short, Address, BytesN, Env, String};

/// Emit ChainSet event
pub fn emit_chain_set(env: &Env, chain_id: u128, order_portal: &BytesN<32>, supported: bool) {
    env.events().publish(
        (symbol_short!("chain_set"), chain_id),
        (order_portal.clone(), supported),
    );
}

/// Emit TokenRouteSet event
pub fn emit_token_route_set(
    env: &Env,
    order_token: &BytesN<32>,
    order_chain_id: u128,
    ad_token: &BytesN<32>,
) {
    env.events().publish(
        (symbol_short!("route_set"), ad_token.clone()),
        (order_token.clone(), order_chain_id),
    );
}

/// Emit TokenRouteRemoved event
pub fn emit_token_route_removed(
    env: &Env,
    ad_token: &BytesN<32>,
    order_token: &BytesN<32>,
    order_chain_id: u128,
) {
    env.events().publish(
        (symbol_short!("route_rm"), ad_token.clone()),
        (order_token.clone(), order_chain_id),
    );
}

/// Emit AdCreated event
pub fn emit_ad_created(
    env: &Env,
    ad_id: &String,
    maker: &Address,
    token: &BytesN<32>,
    init_amount: u128,
    order_chain_id: u128,
) {
    env.events().publish(
        (symbol_short!("ad_create"), ad_id.clone()),
        (maker.clone(), token.clone(), init_amount, order_chain_id),
    );
}

/// Emit AdFunded event
pub fn emit_ad_funded(env: &Env, ad_id: &String, maker: &Address, amount: u128, new_balance: u128) {
    env.events().publish(
        (symbol_short!("ad_fund"), ad_id.clone()),
        (maker.clone(), amount, new_balance),
    );
}

/// Emit AdWithdrawn event
pub fn emit_ad_withdrawn(
    env: &Env,
    ad_id: &String,
    maker: &Address,
    amount: u128,
    new_balance: u128,
) {
    env.events().publish(
        (symbol_short!("ad_wdraw"), ad_id.clone()),
        (maker.clone(), amount, new_balance),
    );
}

/// Emit AdClosed event
pub fn emit_ad_closed(env: &Env, ad_id: &String, maker: &Address) {
    env.events()
        .publish((symbol_short!("ad_close"), ad_id.clone()), maker.clone());
}

/// Emit OrderLocked event
pub fn emit_order_locked(
    env: &Env,
    ad_id: &String,
    order_hash: &BytesN<32>,
    maker: &Address,
    token: &BytesN<32>,
    amount: u128,
    bridger: &BytesN<32>,
    recipient: &BytesN<32>,
) {
    env.events().publish(
        (symbol_short!("ord_lock"), order_hash.clone()),
        (
            ad_id.clone(),
            maker.clone(),
            token.clone(),
            amount,
            bridger.clone(),
            recipient.clone(),
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

/// Emit UpdateManager event
pub fn emit_manager_updated(env: &Env, manager: &Address, status: bool) {
    env.events()
        .publish((symbol_short!("mgr_upd"), manager.clone()), status);
}

/// Emit Initialized event
pub fn emit_initialized(
    env: &Env,
    admin: &Address,
    verifier: &Address,
    merkle_manager: &Address,
    chain_id: u128,
) {
    env.events().publish(
        (symbol_short!("init"), admin.clone()),
        (verifier.clone(), merkle_manager.clone(), chain_id),
    );
}
