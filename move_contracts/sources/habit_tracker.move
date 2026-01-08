/// ============================================================================
/// Friend-Fi Habit Tracker Module (Amigo)
/// ============================================================================
///
/// This module implements a habit accountability system where two friends stake
/// money and compete to maintain their habits:
///
/// 1. COMMITMENT SYSTEM
///    - Two participants stake USDC on a weekly commitment
///    - Each participant deposits half of the weekly payout × duration
///    - Track weekly check-ins for both participants
///    - Process weekly results and distribute payouts
///
/// 2. CHECK-IN TRACKING
///    - Participants check in to prove habit adherence
///    - Weekly check-in requirements (e.g., 3 check-ins per week)
///    - Track check-ins by week and participant
///
/// 3. PAYOUT SYSTEM
///    - Winner of the week receives the full weekly payout
///    - If both succeed/fail, split evenly
///    - Automatic distribution via USDC escrow
///    - 0.3% fee on deposits
///
/// 4. GROUP INTEGRATION
///    - Uses friend_fi::groups for member management
///    - Commitments are scoped to groups
///    - Only group members can create/accept commitments
///
/// ============================================================================

module friend_fi::habit_tracker {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::string::{String};
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    use aptos_framework::timestamp;
    use friend_fi::groups;
    use friend_fi::signature_auth; // NEW: For signature-based auth

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// USDC metadata address on Movement testnet.
    const USDC_METADATA_ADDR: address =
        @0x9cdf923fb59947421487b61b19f9cacb172d971a755d6bb34f69474148c11ada; // Test USDC

    /// Escrow object seed for habit tracker (v2 with new USDC).
    const ESCROW_OBJECT_SEED: vector<u8> = b"FRIEND_FI_HABIT_ESCROW_V2";

    /// Fee numerator for deposit rake (3 = 0.3%).
    const RAKE_NUMERATOR: u64 = 3;

    /// Fee denominator for deposit rake (1000 = 0.3%).
    const RAKE_DENOMINATOR: u64 = 1000;

    /// Seconds in a week.
    const SECONDS_PER_WEEK: u64 = 604800;

    // =========================================================================
    // ERROR CODES
    // =========================================================================

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_ADMIN: u64 = 2;
    const E_NOT_INITIALIZED: u64 = 3;
    const E_BAD_COMMITMENT_ID: u64 = 10;
    const E_NOT_GROUP_MEMBER: u64 = 11;
    const E_INVALID_DURATION: u64 = 12;
    const E_INVALID_CHECK_INS_REQUIRED: u64 = 13;
    const E_INCORRECT_AMOUNT: u64 = 14;
    const E_NOT_INVITED_PARTICIPANT: u64 = 15;
    const E_ALREADY_ACCEPTED: u64 = 16;
    const E_NOT_ACCEPTED: u64 = 17;
    const E_NOT_CREATOR: u64 = 18;
    const E_CANNOT_DELETE_ACCEPTED: u64 = 19;
    const E_NOT_PARTICIPANT: u64 = 20;
    const E_WEEK_NOT_ENDED: u64 = 21;
    const E_WEEK_ALREADY_PROCESSED: u64 = 22;
    const E_INVALID_WEEK: u64 = 23;
    const E_COMMITMENT_ENDED: u64 = 24;
    const E_CHECK_IN_LIMIT_REACHED: u64 = 25;
    const E_COMMITMENT_INVALID: u64 = 26;
    const E_BOTH_MUST_BE_GROUP_MEMBERS: u64 = 27;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    fun admin_address(): address {
        @friend_fi
    }

    fun usdc_metadata(): object::Object<fungible_asset::Metadata> {
        object::address_to_object<fungible_asset::Metadata>(USDC_METADATA_ADDR)
    }

    /// Get current time, returns 0 if timestamp not initialized (for testing).
    fun get_time_seconds(): u64 {
        timestamp::now_seconds()
    }

    // =========================================================================
    // CORE DATA STRUCTURES
    // =========================================================================

    /// Tracks check-ins for a specific week and participant.
    struct WeeklyCheckIns has store, copy, drop {
        week: u64,
        participant: address,
        check_ins: u64,
    }

    /// A commitment between two participants.
    struct Commitment has store {
        /// Group this commitment belongs to.
        group_id: u64,

        /// First participant (creator).
        participant_a: address,

        /// Second participant (invited).
        participant_b: address,

        /// Weekly payout amount (winner gets this).
        weekly_payout: u64,

        /// Number of check-ins required per week.
        weekly_check_ins_required: u64,

        /// Timestamp when commitment starts.
        start_time: u64,

        /// Duration in weeks.
        duration_weeks: u64,

        /// Whether participant B has accepted.
        accepted: bool,

        /// Commitment name/description.
        commitment_name: String,

        /// Whether commitment is valid (not deleted).
        valid: bool,

        /// Track which weeks have been processed.
        weeks_processed: vector<bool>,

        /// All check-ins for this commitment.
        check_ins: vector<WeeklyCheckIns>,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct CommitmentCreatedEvent has drop, store {
        commitment_id: u64,
        group_id: u64,
        participant_a: address,
        participant_b: address,
        weekly_payout: u64,
        duration_weeks: u64,
        commitment_name: String,
    }

    #[event]
    struct CommitmentAcceptedEvent has drop, store {
        commitment_id: u64,
        group_id: u64,
        participant_b: address,
    }

    #[event]
    struct CommitmentDeletedEvent has drop, store {
        commitment_id: u64,
        group_id: u64,
        participant_a: address,
    }

    #[event]
    struct CheckInEvent has drop, store {
        commitment_id: u64,
        group_id: u64,
        participant: address,
        week: u64,
        check_in_count: u64,
    }

    #[event]
    struct WeekProcessedEvent has drop, store {
        commitment_id: u64,
        group_id: u64,
        week: u64,
        winner: address,
        payout: u64,
        a_check_ins: u64,
        b_check_ins: u64,
    }

    #[event]
    struct FeeCollectedEvent has drop, store {
        commitment_id: u64,
        participant: address,
        amount: u64,
        fee_amount: u64,
    }

    // =========================================================================
    // ESCROW OBJECT & CONFIGURATION
    // =========================================================================

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct EscrowMarker has key {}

    /// App configuration for habit tracker.
    struct AppConfig has key {
        /// ExtendRef for escrow object.
        extend_ref: object::ExtendRef,

        /// USDC store owned by escrow.
        escrow_store: object::Object<fungible_asset::FungibleStore>,
    }

    // =========================================================================
    // GLOBAL STATE
    // =========================================================================

    /// Per-group commitment tracking.
    struct GroupCommitments has store {
        /// Group ID.
        group_id: u64,

        /// All commitments in this group.
        commitments: vector<Commitment>,

        /// Track commitment IDs per address for easy lookup.
        /// Parallel arrays.
        user_addrs: vector<address>,
        user_commitment_ids: vector<vector<u64>>,
    }

    /// Global state for habit tracker.
    struct State has key {
        /// Commitments organized by group.
        group_commitments: vector<GroupCommitments>,

        /// Global commitment counter.
        next_commitment_id: u64,
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
        assert!(exists<AppConfig>(admin_address()), E_NOT_INITIALIZED);
        borrow_global_mut<AppConfig>(admin_address())
    }

    inline fun borrow_app_config(): &AppConfig {
        assert!(exists<AppConfig>(admin_address()), E_NOT_INITIALIZED);
        borrow_global<AppConfig>(admin_address())
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the habit tracker module.
    /// Sets up USDC escrow for staking.
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // Create escrow object for USDC
        let constructor_ref = object::create_named_object(
            admin,
            ESCROW_OBJECT_SEED,
        );

        let escrow_signer = object::generate_signer(&constructor_ref);
        move_to(&escrow_signer, EscrowMarker {});

        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let metadata = usdc_metadata();
        let escrow_store = fungible_asset::create_store(
            &constructor_ref,
            metadata,
        );

        move_to(admin, AppConfig {
            extend_ref,
            escrow_store,
        });

        // Initialize state
        move_to(admin, State {
            group_commitments: vector::empty<GroupCommitments>(),
            next_commitment_id: 0,
        });
    }

    /// Migrate to a new escrow with updated USDC metadata.
    /// This is used when the USDC metadata address changes (e.g., switching to test USDC).
    public entry fun migrate_escrow(admin: &signer) acquires AppConfig {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(exists<AppConfig>(admin_addr), E_NOT_INITIALIZED);

        // Create NEW escrow object with current seed
        let constructor_ref = object::create_named_object(
            admin,
            ESCROW_OBJECT_SEED,
        );

        let escrow_signer = object::generate_signer(&constructor_ref);
        move_to(&escrow_signer, EscrowMarker {});

        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let metadata = usdc_metadata();
        let escrow_store = fungible_asset::create_store(
            &constructor_ref,
            metadata,
        );

        // Update AppConfig with new escrow
        let config = borrow_global_mut<AppConfig>(admin_addr);
        config.extend_ref = extend_ref;
        config.escrow_store = escrow_store;
    }

    #[test_only]
    /// Test-only initialization without USDC escrow.
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);

        move_to(admin, State {
            group_commitments: vector::empty<GroupCommitments>(),
            next_commitment_id: 0,
        });
    }

    // =========================================================================
    // HELPER FUNCTIONS - GROUP COMMITMENTS ACCESS
    // =========================================================================

    /// Ensure GroupCommitments exists for a group_id.
    fun ensure_group_commitments(state: &mut State, group_id: u64) {
        let current_len = vector::length(&state.group_commitments);
        
        while (current_len <= group_id) {
            let new_group_commitments = GroupCommitments {
                group_id: current_len,
                commitments: vector::empty<Commitment>(),
                user_addrs: vector::empty<address>(),
                user_commitment_ids: vector::empty<vector<u64>>(),
            };
            vector::push_back(&mut state.group_commitments, new_group_commitments);
            current_len = current_len + 1;
        };
    }

    /// Get mutable reference to GroupCommitments.
    fun borrow_group_commitments_mut(state: &mut State, group_id: u64): &mut GroupCommitments {
        ensure_group_commitments(state, group_id);
        vector::borrow_mut(&mut state.group_commitments, group_id)
    }

    /// Get immutable reference to GroupCommitments.
    fun borrow_group_commitments(state: &State, group_id: u64): &GroupCommitments {
        assert!(group_id < vector::length(&state.group_commitments), E_BAD_COMMITMENT_ID);
        vector::borrow(&state.group_commitments, group_id)
    }

    /// Add commitment ID to user's list.
    fun add_user_commitment(gc: &mut GroupCommitments, user: address, commitment_id: u64) {
        let len = vector::length(&gc.user_addrs);
        let i = 0;
        let found = false;
        while (i < len) {
            if (*vector::borrow(&gc.user_addrs, i) == user) {
                let ids_ref = vector::borrow_mut(&mut gc.user_commitment_ids, i);
                vector::push_back(ids_ref, commitment_id);
                found = true;
                break
            };
            i = i + 1;
        };

        if (!found) {
            vector::push_back(&mut gc.user_addrs, user);
            let new_ids = vector::empty<u64>();
            vector::push_back(&mut new_ids, commitment_id);
            vector::push_back(&mut gc.user_commitment_ids, new_ids);
        };
    }

    /// Find check-in record for a specific week and participant.
    fun find_check_in_index(check_ins: &vector<WeeklyCheckIns>, week: u64, participant: address): (bool, u64) {
        let len = vector::length(check_ins);
        let i = 0;
        while (i < len) {
            let ci = vector::borrow(check_ins, i);
            if (ci.week == week && ci.participant == participant) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Get check-in count for a specific week and participant.
    fun get_check_ins(check_ins: &vector<WeeklyCheckIns>, week: u64, participant: address): u64 {
        let (found, idx) = find_check_in_index(check_ins, week, participant);
        if (found) {
            vector::borrow(check_ins, idx).check_ins
        } else {
            0
        }
    }

    // =========================================================================
    // COMMITMENT CREATION & ACCEPTANCE
    // =========================================================================

    /// Create a new commitment.
    /// Participant A (creator) deposits half of the total stake.
    public entry fun create_commitment(
        account: &signer,
        group_id: u64,
        backend_signature: vector<u8>,
        expires_at_ms: u64,
        participant_b: address,
        weekly_payout: u64,
        weekly_check_ins_required: u64,
        duration_weeks: u64,
        commitment_name: String,
    ) acquires State, AppConfig {
        let participant_a = signer::address_of(account);

        // Verify both are group members using signature authentication
        signature_auth::assert_membership(group_id, participant_a, expires_at_ms, backend_signature);
        // Note: participant_b's membership is verified when they accept

        // Validate parameters
        assert!(duration_weeks > 0, E_INVALID_DURATION);
        assert!(weekly_check_ins_required > 0, E_INVALID_CHECK_INS_REQUIRED);

        // Calculate required deposit (half of total weekly payout × duration)
        let total_stake = weekly_payout * duration_weeks;
        let required_deposit = total_stake / 2;

        // Calculate fee (0.3%)
        let fee = (required_deposit * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
        let gross_deposit = required_deposit + fee;

        // Transfer USDC from participant A to escrow (only if AppConfig exists)
        if (exists<AppConfig>(admin_address())) {
            let metadata = usdc_metadata();
            let fa = primary_fungible_store::withdraw(account, metadata, gross_deposit);
            
            // Split fee and deposit
            let fee_fa = fungible_asset::extract(&mut fa, fee);
            let config = borrow_app_config_mut();
            fungible_asset::deposit(config.escrow_store, fee_fa);
            fungible_asset::deposit(config.escrow_store, fa);

            event::emit(FeeCollectedEvent {
                commitment_id: 0, // Will be updated below
                participant: participant_a,
                amount: gross_deposit,
                fee_amount: fee,
            });
        };

        // Create commitment
        let state = borrow_state_mut();
        let commitment_id = state.next_commitment_id;
        state.next_commitment_id = state.next_commitment_id + 1;

        // Initialize weeks_processed vector
        let weeks_processed = vector::empty<bool>();
        let i = 0;
        while (i < duration_weeks) {
            vector::push_back(&mut weeks_processed, false);
            i = i + 1;
        };

        // Get start time (0 if timestamp not initialized, for testing)
        let start_time = get_time_seconds();

        let commitment = Commitment {
            group_id,
            participant_a,
            participant_b,
            weekly_payout,
            weekly_check_ins_required,
            start_time,
            duration_weeks,
            accepted: false,
            commitment_name,
            valid: true,
            weeks_processed,
            check_ins: vector::empty<WeeklyCheckIns>(),
        };

        let gc = borrow_group_commitments_mut(state, group_id);
        let local_id = vector::length(&gc.commitments);
        vector::push_back(&mut gc.commitments, commitment);

        // Add to participant A's commitment list
        add_user_commitment(gc, participant_a, local_id);

        event::emit(CommitmentCreatedEvent {
            commitment_id,
            group_id,
            participant_a,
            participant_b,
            weekly_payout,
            duration_weeks,
            commitment_name,
        });
    }

    /// Accept a commitment.
    /// Participant B deposits the other half of the total stake.
    public entry fun accept_commitment(
        account: &signer,
        group_id: u64,
        backend_signature: vector<u8>,
        expires_at_ms: u64,
        commitment_local_id: u64,
    ) acquires State, AppConfig {
        let participant_b = signer::address_of(account);

        // Verify participant B is group member using signature authentication
        signature_auth::assert_membership(group_id, participant_b, expires_at_ms, backend_signature);

        // Verify commitment exists and get details
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        let commitment_ref = vector::borrow(&gc.commitments, commitment_local_id);

        // Validate
        assert!(participant_b == commitment_ref.participant_b, E_NOT_INVITED_PARTICIPANT);
        assert!(!commitment_ref.accepted, E_ALREADY_ACCEPTED);
        assert!(commitment_ref.valid, E_COMMITMENT_INVALID);

        // Calculate required deposit
        let total_stake = commitment_ref.weekly_payout * commitment_ref.duration_weeks;
        let required_deposit = total_stake / 2;
        let fee = (required_deposit * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
        let gross_deposit = required_deposit + fee;

        // Transfer USDC from participant B to escrow (only if AppConfig exists)
        if (exists<AppConfig>(admin_address())) {
            let metadata = usdc_metadata();
            let fa = primary_fungible_store::withdraw(account, metadata, gross_deposit);
            
            let fee_fa = fungible_asset::extract(&mut fa, fee);
            let config = borrow_app_config_mut();
            fungible_asset::deposit(config.escrow_store, fee_fa);
            fungible_asset::deposit(config.escrow_store, fa);

            event::emit(FeeCollectedEvent {
                commitment_id: commitment_local_id,
                participant: participant_b,
                amount: gross_deposit,
                fee_amount: fee,
            });
        };

        // Update commitment
        let state = borrow_state_mut();
        let gc = borrow_group_commitments_mut(state, group_id);
        let commitment_mut = vector::borrow_mut(&mut gc.commitments, commitment_local_id);
        commitment_mut.accepted = true;

        // Add to participant B's commitment list
        add_user_commitment(gc, participant_b, commitment_local_id);

        event::emit(CommitmentAcceptedEvent {
            commitment_id: commitment_local_id,
            group_id,
            participant_b,
        });
    }

    /// Delete a commitment that hasn't been accepted yet.
    /// Refunds participant A's deposit.
    public entry fun delete_commitment(
        account: &signer,
        group_id: u64,
        commitment_local_id: u64,
    ) acquires State, AppConfig {
        let participant_a = signer::address_of(account);

        let state = borrow_state_mut();
        let gc = borrow_group_commitments_mut(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let commitment = vector::borrow_mut(&mut gc.commitments, commitment_local_id);

        // Validate
        assert!(participant_a == commitment.participant_a, E_NOT_CREATOR);
        assert!(!commitment.accepted, E_CANNOT_DELETE_ACCEPTED);
        assert!(commitment.valid, E_COMMITMENT_INVALID);

        commitment.valid = false;

        // Calculate refund
        let total_stake = commitment.weekly_payout * commitment.duration_weeks;
        let refund = total_stake / 2;

        // Refund USDC to participant A (only if AppConfig exists)
        if (exists<AppConfig>(admin_address())) {
            let config = borrow_app_config_mut();
            let escrow_signer = object::generate_signer_for_extending(&config.extend_ref);
            let fa = fungible_asset::withdraw(&escrow_signer, config.escrow_store, refund);
            primary_fungible_store::deposit(participant_a, fa);
        };

        event::emit(CommitmentDeletedEvent {
            commitment_id: commitment_local_id,
            group_id,
            participant_a,
        });
    }

    // =========================================================================
    // CHECK-IN FUNCTIONS
    // =========================================================================

    /// Check in for the current week.
    public entry fun check_in(
        account: &signer,
        group_id: u64,
        commitment_local_id: u64,
    ) acquires State {
        let participant = signer::address_of(account);

        let state = borrow_state_mut();
        let gc = borrow_group_commitments_mut(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let commitment = vector::borrow_mut(&mut gc.commitments, commitment_local_id);

        // Validate
        assert!(commitment.valid, E_COMMITMENT_INVALID);
        assert!(commitment.accepted, E_NOT_ACCEPTED);
        assert!(
            participant == commitment.participant_a || participant == commitment.participant_b,
            E_NOT_PARTICIPANT
        );

        // Calculate current week
        let now = get_time_seconds();
        let elapsed = now - commitment.start_time;
        let current_week = elapsed / SECONDS_PER_WEEK;
        assert!(current_week < commitment.duration_weeks, E_COMMITMENT_ENDED);

        // Get or create check-in record
        let current_check_ins = get_check_ins(&commitment.check_ins, current_week, participant);
        assert!(current_check_ins < commitment.weekly_check_ins_required, E_CHECK_IN_LIMIT_REACHED);

        let (found, idx) = find_check_in_index(&commitment.check_ins, current_week, participant);
        if (found) {
            let ci_mut = vector::borrow_mut(&mut commitment.check_ins, idx);
            ci_mut.check_ins = ci_mut.check_ins + 1;
        } else {
            vector::push_back(&mut commitment.check_ins, WeeklyCheckIns {
                week: current_week,
                participant,
                check_ins: 1,
            });
        };

        event::emit(CheckInEvent {
            commitment_id: commitment_local_id,
            group_id,
            participant,
            week: current_week,
            check_in_count: current_check_ins + 1,
        });
    }

    // =========================================================================
    // WEEK PROCESSING & PAYOUTS
    // =========================================================================

    /// Process a specific week's results and distribute payouts.
    /// Can be called by anyone after the week has ended.
    public entry fun process_week(
        _account: &signer,
        group_id: u64,
        commitment_local_id: u64,
        week: u64,
    ) acquires State, AppConfig {
        let state = borrow_state_mut();
        let gc = borrow_group_commitments_mut(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let commitment = vector::borrow_mut(&mut gc.commitments, commitment_local_id);

        // Validate
        assert!(commitment.valid, E_COMMITMENT_INVALID);
        assert!(commitment.accepted, E_NOT_ACCEPTED);
        assert!(week < commitment.duration_weeks, E_INVALID_WEEK);
        assert!(!*vector::borrow(&commitment.weeks_processed, week), E_WEEK_ALREADY_PROCESSED);

        // Check that week has ended
        let now = get_time_seconds();
        let week_end_time = commitment.start_time + ((week + 1) * SECONDS_PER_WEEK);
        assert!(now >= week_end_time, E_WEEK_NOT_ENDED);

        // Get check-ins for both participants
        let a_check_ins = get_check_ins(&commitment.check_ins, week, commitment.participant_a);
        let b_check_ins = get_check_ins(&commitment.check_ins, week, commitment.participant_b);

        let required = commitment.weekly_check_ins_required;
        let a_succeeded = (a_check_ins >= required);
        let b_succeeded = (b_check_ins >= required);

        // Mark week as processed
        let week_processed_ref = vector::borrow_mut(&mut commitment.weeks_processed, week);
        *week_processed_ref = true;

        let weekly_payout = commitment.weekly_payout;
        let participant_a = commitment.participant_a;
        let participant_b = commitment.participant_b;

        // Determine winner and payout
        let (winner, payout_a, payout_b) = if (a_succeeded && !b_succeeded) {
            // A wins
            (participant_a, weekly_payout, 0)
        } else if (b_succeeded && !a_succeeded) {
            // B wins
            (participant_b, 0, weekly_payout)
        } else {
            // Both succeed or both fail - split evenly
            (participant_a, weekly_payout / 2, weekly_payout / 2)
        };

        // Distribute payouts (only if AppConfig exists)
        if (exists<AppConfig>(admin_address())) {
            let config = borrow_app_config_mut();
            let escrow_signer = object::generate_signer_for_extending(&config.extend_ref);
            
            if (payout_a > 0) {
                let fa_a = fungible_asset::withdraw(&escrow_signer, config.escrow_store, payout_a);
                primary_fungible_store::deposit(participant_a, fa_a);
            };

            if (payout_b > 0) {
                let fa_b = fungible_asset::withdraw(&escrow_signer, config.escrow_store, payout_b);
                primary_fungible_store::deposit(participant_b, fa_b);
            };
        };

        event::emit(WeekProcessedEvent {
            commitment_id: commitment_local_id,
            group_id,
            week,
            winner,
            payout: weekly_payout,
            a_check_ins,
            b_check_ins,
        });
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    #[view]
    /// Get total number of commitments in a group.
    public fun get_group_commitments_count(group_id: u64): u64 acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_commitments)) {
            return 0
        };
        let gc = borrow_group_commitments(state, group_id);
        vector::length(&gc.commitments)
    }

    #[view]
    /// Get commitment details.
    /// Returns (participant_a, participant_b, weekly_payout, duration_weeks, accepted, valid, commitment_name, start_time, weekly_check_ins_required).
    public fun get_commitment_details(group_id: u64, commitment_local_id: u64): (
        address, address, u64, u64, bool, bool, String, u64, u64
    ) acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        (
            c.participant_a,
            c.participant_b,
            c.weekly_payout,
            c.duration_weeks,
            c.accepted,
            c.valid,
            c.commitment_name,
            c.start_time,
            c.weekly_check_ins_required
        )
    }

    #[view]
    /// Get check-in count for a specific week and participant.
    public fun get_weekly_check_ins(
        group_id: u64,
        commitment_local_id: u64,
        week: u64,
        participant: address
    ): u64 acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        
        // Verify participant
        assert!(
            participant == c.participant_a || participant == c.participant_b,
            E_NOT_PARTICIPANT
        );

        get_check_ins(&c.check_ins, week, participant)
    }

    #[view]
    /// Check if a week has been processed.
    public fun is_week_processed(
        group_id: u64,
        commitment_local_id: u64,
        week: u64
    ): bool acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        assert!(week < c.duration_weeks, E_INVALID_WEEK);
        
        *vector::borrow(&c.weeks_processed, week)
    }

    #[view]
    /// Get all commitment IDs for a user in a group.
    public fun get_user_commitments(group_id: u64, user: address): vector<u64> acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_commitments)) {
            return vector::empty<u64>()
        };
        
        let gc = borrow_group_commitments(state, group_id);
        let len = vector::length(&gc.user_addrs);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&gc.user_addrs, i) == user) {
                let ids_ref = vector::borrow(&gc.user_commitment_ids, i);
                let result = vector::empty<u64>();
                let j = 0;
                let ids_len = vector::length(ids_ref);
                while (j < ids_len) {
                    vector::push_back(&mut result, *vector::borrow(ids_ref, j));
                    j = j + 1;
                };
                return result
            };
            i = i + 1;
        };
        vector::empty<u64>()
    }

    #[view]
    /// Get current week for a commitment.
    public fun get_current_week(group_id: u64, commitment_local_id: u64): u64 acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        let now = get_time_seconds();
        let elapsed = now - c.start_time;
        elapsed / SECONDS_PER_WEEK
    }

    #[view]
    /// Get the USDC balance in the escrow.
    public fun get_escrow_balance(): u64 acquires AppConfig {
        let config = borrow_app_config();
        fungible_asset::balance(config.escrow_store)
    }

    #[view]
    /// Check if a commitment has ended.
    public fun is_commitment_ended(group_id: u64, commitment_local_id: u64): bool acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        let now = get_time_seconds();
        let end_time = c.start_time + (c.duration_weeks * SECONDS_PER_WEEK);
        now >= end_time
    }

    #[view]
    /// Get all check-ins for a commitment.
    /// Returns (weeks, participants, check_in_counts).
    public fun get_all_check_ins(
        group_id: u64,
        commitment_local_id: u64
    ): (vector<u64>, vector<address>, vector<u64>) acquires State {
        let state = borrow_state();
        let gc = borrow_group_commitments(state, group_id);
        assert!(commitment_local_id < vector::length(&gc.commitments), E_BAD_COMMITMENT_ID);
        
        let c = vector::borrow(&gc.commitments, commitment_local_id);
        
        let weeks = vector::empty<u64>();
        let participants = vector::empty<address>();
        let check_in_counts = vector::empty<u64>();
        
        let len = vector::length(&c.check_ins);
        let i = 0;
        while (i < len) {
            let ci = vector::borrow(&c.check_ins, i);
            vector::push_back(&mut weeks, ci.week);
            vector::push_back(&mut participants, ci.participant);
            vector::push_back(&mut check_in_counts, ci.check_ins);
            i = i + 1;
        };
        
        (weeks, participants, check_in_counts)
    }
}

