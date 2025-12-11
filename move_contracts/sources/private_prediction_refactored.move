/// ============================================================================
/// Friend-Fi Private Prediction Market Module (Refactored)
/// ============================================================================
///
/// This module implements a prediction market system with the following features:
///
/// 1. USDC ESCROW SYSTEM
///    - Uses Aptos fungible_asset framework with a secondary store 
///    - All wagers are held in a contract-controlled escrow object
///    - 0.3% fee (rake) is taken on every wager deposited
///    - Admin can withdraw accumulated fees
///    - Winners receive immediate USDC payouts when bets are resolved
///
/// 2. PREDICTION MARKET CORE
///    - Bets: Multi-outcome predictions within groups (e.g., "Who wins the game?")
///    - Wagers: Users bet on outcomes; amounts tracked net-of-fees
///    - Parimutuel payouts: Winners split the total pool proportionally
///    - Group integration: Uses friend_fi::groups for member management
///
/// 3. EVENT SYSTEM (for indexers)
///    - BetCreatedEvent: When a new bet is created
///    - WagerPlacedEvent: When a user places a wager
///    - BetResolvedEvent: When a bet admin resolves a bet
///    - PayoutPaidEvent: When winnings are paid to a user
///
/// REFACTORED: Now uses friend_fi::groups module for group management.
/// This allows groups to be shared across predictions, expenses, and future apps!
///
/// ============================================================================

module friend_fi::private_prediction_refactored {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::string::{String, utf8};
    use std::vector;

    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    
    use friend_fi::groups;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// USDC metadata address on Movement testnet.
    const USDC_METADATA_ADDR: address =
        @0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7;

    /// Escrow object seed (different from expense module).
    const ESCROW_OBJECT_SEED: vector<u8> = b"FRIEND_FI_PREDICTION_ESCROW";

    /// House rake: 0.3% = 30 basis points.
    const FEE_BPS: u64 = 30;
    const BPS_DENOMINATOR: u64 = 10_000;

    // =========================================================================
    // ERROR CODES
    // =========================================================================

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_ADMIN: u64 = 2;
    const E_INSUFFICIENT_AMOUNT: u64 = 3;
    const E_ESCROW_NOT_INITIALIZED: u64 = 4;
    const E_BAD_BET_ID: u64 = 11;
    const E_NOT_MEMBER: u64 = 14;
    const E_NEED_AT_LEAST_TWO_OUTCOMES: u64 = 15;
    const E_INVALID_OUTCOME_INDEX: u64 = 16;
    const E_ZERO_WAGER: u64 = 17;
    const E_BET_ALREADY_RESOLVED: u64 = 18;
    const E_NOT_BET_ADMIN: u64 = 19;
    const E_ALREADY_BET_ON_DIFFERENT_OUTCOME: u64 = 21;
    const E_NO_WAGER_TO_CANCEL: u64 = 22;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    fun admin_address(): address {
        @friend_fi
    }

    fun usdc_metadata(): object::Object<fungible_asset::Metadata> {
        object::address_to_object<fungible_asset::Metadata>(USDC_METADATA_ADDR)
    }

    // =========================================================================
    // CORE DATA STRUCTURES
    // =========================================================================

    /// A single user's wager on a specific bet.
    struct Wager has store, copy, drop {
        /// Net wager amount (after 0.3% fee deduction).
        amount: u64,
        /// Index of the outcome the user is betting on.
        outcome: u64,
    }

    /// A bet within a group - a prediction with multiple possible outcomes.
    struct Bet has store {
        /// Description of what this bet is about.
        description: String,
        /// List of possible outcome labels.
        outcomes: vector<String>,
        /// The address authorized to resolve this bet.
        admin: address,
        /// Whether this bet has been resolved.
        resolved: bool,
        /// Index of the winning outcome (only valid if resolved == true).
        winning_outcome_index: u64,
        /// Total NET amount in the pool across all outcomes.
        total_pool: u64,
        /// Index of the group this bet belongs to.
        group_id: u64,
        /// Per-outcome pool amounts.
        outcome_pools: vector<u64>,
        /// List of addresses that have placed wagers.
        members_wagered: vector<address>,
        /// Parallel array to members_wagered.
        wagers: vector<Wager>,
        /// Optional encrypted payload for private bet details.
        encrypted_payload: vector<u8>,
    }

    /// Tracks which bets belong to which group.
    struct GroupBets has store {
        /// Group ID from groups module.
        group_id: u64,
        /// List of bet_ids in this group.
        bet_ids: vector<u64>,
        /// Track total wagered per member (for leaderboards).
        /// Parallel arrays: member addresses and their total wagered amounts.
        members: vector<address>,
        total_wagered: vector<u64>,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct BetCreatedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        creator: address,
        admin: address,
        encrypted_len: u64,
    }

    #[event]
    struct WagerPlacedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        user: address,
        outcome_index: u64,
        amount_gross: u64,
        amount_net: u64,
        fee: u64,
    }

    #[event]
    struct BetResolvedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        admin: address,
        winning_outcome_index: u64,
    }

    #[event]
    struct PayoutPaidEvent has drop, store {
        bet_id: u64,
        user: address,
        amount: u64,
    }

    #[event]
    struct WagerCancelledEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        user: address,
        outcome_index: u64,
        amount_refunded: u64,
    }

    // =========================================================================
    // ESCROW OBJECT & CONFIGURATION
    // =========================================================================

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct EscrowMarker has key {}

    /// Application configuration for prediction markets.
    struct AppConfig has key {
        extend_ref: object::ExtendRef,
        escrow_store: object::Object<fungible_asset::FungibleStore>,
        fee_accumulator: u64,
    }

    // =========================================================================
    // GLOBAL STATE
    // =========================================================================

    /// Central state for prediction markets.
    struct State has key {
        /// All bets in the system. bet_id = index in this vector.
        bets: vector<Bet>,
        /// Per-group bet tracking.
        group_bets: vector<GroupBets>,
    }

    // =========================================================================
    // STATE ACCESS HELPERS
    // =========================================================================

    inline fun borrow_state_mut(): &mut State {
        borrow_global_mut<State>(admin_address())
    }

    inline fun borrow_state(): &State {
        borrow_global<State>(admin_address())
    }

    inline fun borrow_app_config_mut(): &mut AppConfig {
        assert!(exists<AppConfig>(admin_address()), E_ESCROW_NOT_INITIALIZED);
        borrow_global_mut<AppConfig>(admin_address())
    }

    inline fun borrow_app_config(): &AppConfig {
        assert!(exists<AppConfig>(admin_address()), E_ESCROW_NOT_INITIALIZED);
        borrow_global<AppConfig>(admin_address())
    }

    // =========================================================================
    // LOOKUP HELPERS
    // =========================================================================

    /// Get a reference to a bet by its ID.
    fun borrow_bet(state: &State, bet_id: u64): &Bet {
        assert!(bet_id < vector::length(&state.bets), E_BAD_BET_ID);
        vector::borrow(&state.bets, bet_id)
    }

    /// Get a mutable reference to a bet by its ID.
    fun borrow_bet_mut(state: &mut State, bet_id: u64): &mut Bet {
        assert!(bet_id < vector::length(&state.bets), E_BAD_BET_ID);
        vector::borrow_mut(&mut state.bets, bet_id)
    }

    /// Find a user's wager index in a bet's wager list.
    fun find_wager_index(bet: &Bet, addr: address): (bool, u64) {
        let len = vector::length(&bet.members_wagered);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&bet.members_wagered, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Ensure GroupBets exists for a group_id.
    fun ensure_group_bets(state: &mut State, group_id: u64) {
        let current_len = vector::length(&state.group_bets);
        while (current_len <= group_id) {
            vector::push_back(&mut state.group_bets, GroupBets {
                group_id: current_len,
                bet_ids: vector::empty<u64>(),
                members: vector::empty<address>(),
                total_wagered: vector::empty<u64>(),
            });
            current_len = current_len + 1;
        };
    }

    /// Get mutable reference to GroupBets.
    fun borrow_group_bets_mut(state: &mut State, group_id: u64): &mut GroupBets {
        ensure_group_bets(state, group_id);
        vector::borrow_mut(&mut state.group_bets, group_id)
    }

    /// Find member index in GroupBets.
    fun find_member_in_group_bets(gb: &GroupBets, addr: address): (bool, u64) {
        let len = vector::length(&gb.members);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&gb.members, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the prediction market module.
    /// Must be called after groups::init().
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // Create escrow object for USDC
        let constructor_ref = object::create_named_object(admin, ESCROW_OBJECT_SEED);
        let escrow_signer = object::generate_signer(&constructor_ref);
        move_to(&escrow_signer, EscrowMarker {});

        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let metadata = usdc_metadata();
        let escrow_store = fungible_asset::create_store(&constructor_ref, metadata);

        move_to(admin, AppConfig {
            extend_ref,
            escrow_store,
            fee_accumulator: 0,
        });

        move_to(admin, State {
            bets: vector::empty<Bet>(),
            group_bets: vector::empty<GroupBets>(),
        });
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);

        move_to(admin, State {
            bets: vector::empty<Bet>(),
            group_bets: vector::empty<GroupBets>(),
        });
    }

    // =========================================================================
    // ESCROW PRIMITIVES
    // =========================================================================

    /// Deposit USDC from user into escrow, taking 0.3% fee.
    fun internal_deposit_from_user(user: &signer, raw_amount: u64): u64 acquires AppConfig {
        assert!(raw_amount > 0, E_INSUFFICIENT_AMOUNT);

        let fee = (raw_amount * FEE_BPS) / BPS_DENOMINATOR;
        let net = raw_amount - fee;

        let metadata = usdc_metadata();
        let fa = primary_fungible_store::withdraw(user, metadata, raw_amount);
        let fee_asset = fungible_asset::extract(&mut fa, fee);

        let app = borrow_app_config_mut();
        let store = app.escrow_store;

        fungible_asset::deposit(store, fee_asset);
        app.fee_accumulator = app.fee_accumulator + fee;
        fungible_asset::deposit(store, fa);

        net
    }

    /// Payout USDC from escrow to user.
    fun internal_payout_to_user(bet_id: u64, recipient: address, amount: u64) acquires AppConfig {
        if (amount == 0) return;

        let app = borrow_app_config_mut();
        let escrow_signer = object::generate_signer_for_extending(&app.extend_ref);
        let store = app.escrow_store;

        let fa = fungible_asset::withdraw(&escrow_signer, store, amount);
        primary_fungible_store::deposit(recipient, fa);

        event::emit(PayoutPaidEvent {
            bet_id,
            user: recipient,
            amount,
        });
    }

    // =========================================================================
    // BET FUNCTIONS
    // =========================================================================

    /// Create a new bet within a group.
    /// User must be a member of the group (checked via groups module).
    public entry fun create_bet(
        account: &signer,
        group_id: u64,
        description: String,
        outcomes: vector<String>,
        admin: address,
        encrypted_payload: vector<u8>,
    ) acquires State {
        let caller = signer::address_of(account);

        // Verify caller is a group member using groups module
        assert!(groups::is_member(group_id, caller), E_NOT_MEMBER);

        let num_outcomes = vector::length(&outcomes);
        assert!(num_outcomes > 1, E_NEED_AT_LEAST_TWO_OUTCOMES);

        let state = borrow_state_mut();

        // Initialize outcome pools
        let outcome_pools = vector::empty<u64>();
        let i = 0;
        while (i < num_outcomes) {
            vector::push_back(&mut outcome_pools, 0);
            i = i + 1;
        };

        let encrypted_len = vector::length(&encrypted_payload);

        // Create bet
        let bet = Bet {
            description,
            outcomes,
            admin,
            resolved: false,
            winning_outcome_index: 0,
            total_pool: 0,
            group_id,
            outcome_pools,
            members_wagered: vector::empty<address>(),
            wagers: vector::empty<Wager>(),
            encrypted_payload,
        };

        let bet_id = vector::length(&state.bets);
        vector::push_back(&mut state.bets, bet);

        // Add bet to group's bet list
        let group_bets = borrow_group_bets_mut(state, group_id);
        vector::push_back(&mut group_bets.bet_ids, bet_id);

        event::emit(BetCreatedEvent {
            bet_id,
            group_id,
            creator: caller,
            admin,
            encrypted_len,
        });
    }

    // =========================================================================
    // WAGER FUNCTIONS
    // =========================================================================

    /// Place a wager on a specific outcome of a bet.
    public entry fun place_wager(
        account: &signer,
        bet_id: u64,
        outcome_index: u64,
        amount: u64,
    ) acquires State, AppConfig {
        let user = signer::address_of(account);

        // Deposit USDC from user -> escrow
        let net_amount = internal_deposit_from_user(account, amount);

        // Validate
        let (group_id, _) = {
            let state_read = borrow_state();
            let bet_read = borrow_bet(state_read, bet_id);
            
            assert!(!bet_read.resolved, E_BET_ALREADY_RESOLVED);
            assert!(outcome_index < vector::length(&bet_read.outcomes), E_INVALID_OUTCOME_INDEX);
            assert!(amount > 0, E_ZERO_WAGER);

            // Check user is a group member using groups module
            assert!(groups::is_member(bet_read.group_id, user), E_NOT_MEMBER);

            (bet_read.group_id, 0)
        };

        // Update bet pools and wagers
        {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            let pool_ref = vector::borrow_mut(&mut bet.outcome_pools, outcome_index);
            *pool_ref = *pool_ref + net_amount;
            bet.total_pool = bet.total_pool + net_amount;

            let (found, w_idx) = find_wager_index(bet, user);
            if (found) {
                let w_ref = vector::borrow_mut(&mut bet.wagers, w_idx);
                assert!(w_ref.outcome == outcome_index, E_ALREADY_BET_ON_DIFFERENT_OUTCOME);
                w_ref.amount = w_ref.amount + net_amount;
            } else {
                vector::push_back(&mut bet.members_wagered, user);
                vector::push_back(&mut bet.wagers, Wager { amount: net_amount, outcome: outcome_index });
            };

            event::emit(WagerPlacedEvent {
                bet_id,
                group_id,
                user,
                outcome_index,
                amount_gross: amount,
                amount_net: net_amount,
                fee: amount - net_amount,
            });
        };

        // Update group total wagered
        {
            let state = borrow_state_mut();
            let group_bets = borrow_group_bets_mut(state, group_id);
            let (found, idx) = find_member_in_group_bets(group_bets, user);
            if (found) {
                let tw_ref = vector::borrow_mut(&mut group_bets.total_wagered, idx);
                *tw_ref = *tw_ref + amount;
            } else {
                vector::push_back(&mut group_bets.members, user);
                vector::push_back(&mut group_bets.total_wagered, amount);
            };
        };
    }

    /// Cancel a wager and get a refund.
    public entry fun cancel_wager(account: &signer, bet_id: u64) acquires State, AppConfig {
        let user = signer::address_of(account);

        let (group_id, outcome_index, refund_amount) = {
            let state = borrow_state();
            let bet = borrow_bet(state, bet_id);
            
            assert!(!bet.resolved, E_BET_ALREADY_RESOLVED);

            let (found, w_idx) = find_wager_index(bet, user);
            assert!(found, E_NO_WAGER_TO_CANCEL);

            let wager = vector::borrow(&bet.wagers, w_idx);
            (bet.group_id, wager.outcome, wager.amount)
        };

        // Update bet pools
        {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            let pool_ref = vector::borrow_mut(&mut bet.outcome_pools, outcome_index);
            *pool_ref = *pool_ref - refund_amount;
            bet.total_pool = bet.total_pool - refund_amount;

            let (_, w_idx) = find_wager_index(bet, user);
            vector::remove(&mut bet.members_wagered, w_idx);
            vector::remove(&mut bet.wagers, w_idx);
        };

        // Refund USDC
        internal_payout_to_user(bet_id, user, refund_amount);

        event::emit(WagerCancelledEvent {
            bet_id,
            group_id,
            user,
            outcome_index,
            amount_refunded: refund_amount,
        });
    }

    // =========================================================================
    // BET RESOLUTION & PAYOUTS
    // =========================================================================

    /// Resolve a bet by declaring the winning outcome.
    public entry fun resolve_bet(
        account: &signer,
        bet_id: u64,
        winning_outcome_index: u64,
    ) acquires State, AppConfig {
        let caller = signer::address_of(account);

        let (group_id, total_pool_u128, winning_pool_u128, members_snapshot, wagers_snapshot) = {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            assert!(caller == bet.admin, E_NOT_BET_ADMIN);
            assert!(!bet.resolved, E_BET_ALREADY_RESOLVED);
            assert!(winning_outcome_index < vector::length(&bet.outcomes), E_INVALID_OUTCOME_INDEX);

            bet.resolved = true;
            bet.winning_outcome_index = winning_outcome_index;

            let total_pool_u128 = (bet.total_pool as u128);
            let winning_pool = *vector::borrow(&bet.outcome_pools, winning_outcome_index);
            let winning_pool_u128 = (winning_pool as u128);

            // Snapshot wagers
            let members_snapshot = vector::empty<address>();
            let wagers_snapshot = vector::empty<Wager>();
            let len = vector::length(&bet.members_wagered);
            let i = 0;
            while (i < len) {
                vector::push_back(&mut members_snapshot, *vector::borrow(&bet.members_wagered, i));
                let w = vector::borrow(&bet.wagers, i);
                vector::push_back(&mut wagers_snapshot, Wager { amount: w.amount, outcome: w.outcome });
                i = i + 1;
            };

            event::emit(BetResolvedEvent {
                bet_id,
                group_id: bet.group_id,
                admin: caller,
                winning_outcome_index,
            });

            (bet.group_id, total_pool_u128, winning_pool_u128, members_snapshot, wagers_snapshot)
        };

        if (winning_pool_u128 == 0) return;

        // Pay winners
        let len = vector::length(&members_snapshot);
        let i = 0;
        while (i < len) {
            let user = *vector::borrow(&members_snapshot, i);
            let w = vector::borrow(&wagers_snapshot, i);

            if (w.amount > 0 && w.outcome == winning_outcome_index) {
                let payout_u128 = ((w.amount as u128) * total_pool_u128) / winning_pool_u128;
                internal_payout_to_user(bet_id, user, (payout_u128 as u64));
            };

            i = i + 1;
        };
    }

    // =========================================================================
    // ADMIN FEE WITHDRAWAL
    // =========================================================================

    /// Withdraw accumulated fees.
    public entry fun withdraw_fees(admin: &signer, amount: u64) acquires AppConfig {
        let addr = signer::address_of(admin);
        assert!(addr == admin_address(), E_NOT_ADMIN);

        let app = borrow_app_config_mut();
        assert!(amount > 0, E_INSUFFICIENT_AMOUNT);
        assert!(amount <= app.fee_accumulator, E_INSUFFICIENT_AMOUNT);

        let escrow_signer = object::generate_signer_for_extending(&app.extend_ref);
        let fa = fungible_asset::withdraw(&escrow_signer, app.escrow_store, amount);
        app.fee_accumulator = app.fee_accumulator - amount;
        primary_fungible_store::deposit(addr, fa);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    #[view]
    public fun get_bets_count(): u64 acquires State {
        let state = borrow_state();
        vector::length(&state.bets)
    }

    #[view]
    public fun get_group_bets(group_id: u64): vector<u64> acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_bets)) {
            return vector::empty<u64>()
        };
        let gb = vector::borrow(&state.group_bets, group_id);
        let result = vector::empty<u64>();
        let len = vector::length(&gb.bet_ids);
        let i = 0;
        while (i < len) {
            vector::push_back(&mut result, *vector::borrow(&gb.bet_ids, i));
            i = i + 1;
        };
        result
    }

    #[view]
    public fun get_bet_description(bet_id: u64): String acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        utf8(*std::string::bytes(&bet.description))
    }

    #[view]
    public fun is_bet_resolved(bet_id: u64): bool acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.resolved
    }

    #[view]
    public fun get_bet_total_pool(bet_id: u64): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.total_pool
    }

    #[view]
    public fun get_user_wager(bet_id: u64, user: address): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        let (found, idx) = find_wager_index(bet, user);
        if (!found) {
            0
        } else {
            vector::borrow(&bet.wagers, idx).amount
        }
    }

    #[view]
    public fun escrow_balance(): u64 acquires AppConfig {
        let app = borrow_app_config();
        fungible_asset::balance(app.escrow_store)
    }

    #[view]
    public fun total_fees_accumulated(): u64 acquires AppConfig {
        let app = borrow_app_config();
        app.fee_accumulator
    }
}

