/// ============================================================================
/// Friend-Fi Private Prediction Market Module
/// ============================================================================
///
/// This module implements a complete prediction market system with the following
/// key features:
///
/// 1. USDC ESCROW SYSTEM
///    - Uses Aptos fungible_asset framework with a secondary store 
///    - All wagers are held in a contract-controlled escrow object
///    - 0.3% fee (rake) is taken on every wager deposited
///    - Admin can withdraw accumulated fees
///    - Winners receive immediate USDC payouts when bets are resolved
///
/// 2. PREDICTION MARKET CORE
///    - Groups: Password-protected betting groups for friends
///    - Bets: Multi-outcome predictions within groups (e.g., "Who wins the game?")
///    - Wagers: Users bet on outcomes; amounts tracked net-of-fees
///    - Parimutuel payouts: Winners split the total pool proportionally
///
/// 3. USERNAME/PROFILE REGISTRY
///    - Each address can set a profile with unique username and avatar
///    - Global username uniqueness enforced
///    - Username → address resolution for easy lookups
///
/// 4. EVENT SYSTEM (for indexers)
///    - ProfileUpdatedEvent: When users update their profile
///    - GroupCreatedEvent: When a new group is created
///    - GroupJoinedEvent: When a user joins a group
///    - BetCreatedEvent: When a new bet is created
///    - WagerPlacedEvent: When a user places a wager
///    - BetResolvedEvent: When a bet admin resolves a bet
///    - PayoutPaidEvent: When winnings are paid to a user
///
/// ============================================================================

module friend_fi::private_prediction_market {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::string::{String, bytes, utf8};
    use std::vector;

    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// The metadata object address for USDC on Movement testnet.
    /// This is the fungible asset that users will wager with.
    /// IMPORTANT: Update this address for mainnet deployment.
    const USDC_METADATA_ADDR: address =
        @0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7;

    /// Deterministic seed for creating the escrow object.
    /// This ensures we can always find/recreate the escrow address.
    const ESCROW_OBJECT_SEED: vector<u8> = b"FRIEND_FI_USDC_ESCROW";

    /// House rake in basis points: 0.3% = 30 basis points.
    /// Fee is taken from each wager when deposited into escrow.
    const FEE_BPS: u64 = 30;
    
    /// Denominator for basis point calculations (100% = 10,000 bps).
    const BPS_DENOMINATOR: u64 = 10_000;

    // =========================================================================
    // ERROR CODES
    // =========================================================================

    // --- Initialization & Admin Errors ---
    
    /// State or AppConfig already exists; init() can only be called once.
    const E_ALREADY_INITIALIZED: u64 = 1;
    
    /// Caller is not the admin (module deployer address).
    const E_NOT_ADMIN: u64 = 2;
    
    /// Amount must be greater than zero or exceeds available balance.
    const E_INSUFFICIENT_AMOUNT: u64 = 3;
    
    /// Escrow has not been initialized; call init() first.
    const E_ESCROW_NOT_INITIALIZED: u64 = 4;

    // --- Group & Bet Errors ---
    
    /// The provided group_id does not exist.
    const E_BAD_GROUP_ID: u64 = 10;
    
    /// The provided bet_id does not exist.
    const E_BAD_BET_ID: u64 = 11;
    
    /// Password does not match the group's password.
    const E_INVALID_PASSWORD: u64 = 12;
    
    /// User is already a member of this group.
    const E_ALREADY_MEMBER: u64 = 13;
    
    /// User is not a member of the required group.
    const E_NOT_MEMBER: u64 = 14;
    
    /// Bets must have at least 2 outcomes to choose from.
    const E_NEED_AT_LEAST_TWO_OUTCOMES: u64 = 15;
    
    /// The outcome_index is out of bounds for this bet.
    const E_INVALID_OUTCOME_INDEX: u64 = 16;
    
    /// Wager amount must be greater than zero.
    const E_ZERO_WAGER: u64 = 17;
    
    /// Cannot place wager or modify a bet that has already been resolved.
    const E_BET_ALREADY_RESOLVED: u64 = 18;
    
    /// Only the designated bet admin can resolve this bet.
    const E_NOT_BET_ADMIN: u64 = 19;
    
    /// The requested username is already taken by another address.
    const E_USERNAME_TAKEN: u64 = 20;
    
    /// User already has a wager on a different outcome.
    const E_ALREADY_BET_ON_DIFFERENT_OUTCOME: u64 = 21;
    
    /// User has no wager to cancel.
    const E_NO_WAGER_TO_CANCEL: u64 = 22;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /// Returns the admin address (module deployer).
    /// This address owns the State and AppConfig resources.
    fun admin_address(): address {
        @friend_fi
    }

    /// Compare two String values for equality by comparing their byte representations.
    fun strings_equal(a: &String, b: &String): bool {
        *bytes(a) == *bytes(b)
    }

    /// Clone a String by extracting bytes and creating a new String.
    /// Move doesn't have native string cloning, so we do it via bytes.
    fun clone_string(s: &String): String {
        utf8(*bytes(s))
    }

    /// Returns the USDC metadata object.
    /// This is used for all fungible asset operations involving USDC.
    fun usdc_metadata(): object::Object<fungible_asset::Metadata> {
        object::address_to_object<fungible_asset::Metadata>(USDC_METADATA_ADDR)
    }

    // =========================================================================
    // CORE DATA STRUCTURES
    // =========================================================================

    /// A prediction group - a private space for friends to create and participate in bets.
    /// 
    /// Groups are password-protected. The creator is automatically added as the first member.
    /// Each group maintains its own set of bets and tracks member wagering volume.
    struct Group has store {
        /// Display name of the group.
        name: String,
        
        /// Password "hash" for joining. Currently just bytes(password).
        /// WARNING: This is NOT cryptographically secure - anyone can read storage.
        /// Fine for hackathon/demo purposes only.
        password_hash: vector<u8>,

        /// List of member addresses in this group.
        members: vector<address>,
        
        /// Parallel array to members: total_wagered[i] is the gross wagering
        /// volume for members[i] across all bets in this group.
        total_wagered: vector<u64>,

        /// List of bet_ids that belong to this group.
        bets: vector<u64>,
    }

    /// A single user's wager on a specific bet.
    /// 
    /// The amount stored is NET (after the 0.3% fee has been deducted).
    /// This is what actually sits in the outcome pool and is used for payout calculations.
    struct Wager has store, copy, drop {
        /// Net wager amount (after 0.3% fee deduction).
        amount: u64,
        
        /// Index of the outcome the user is betting on (0-indexed into Bet.outcomes).
        outcome: u64,
    }

    /// A bet within a group - a prediction with multiple possible outcomes.
    /// 
    /// Example: "Who will win the Super Bowl?"
    /// Outcomes: ["Chiefs", "Eagles"]
    /// 
    /// Uses parimutuel betting: all wagers go into a pool, winners split proportionally.
    struct Bet has store {
        /// Description of what this bet is about.
        description: String,
        
        /// List of possible outcome labels (e.g., ["Yes", "No"] or ["Team A", "Team B", "Draw"]).
        outcomes: vector<String>,
        
        /// The address authorized to resolve this bet (set winner).
        admin: address,
        
        /// Whether this bet has been resolved (winner declared).
        resolved: bool,
        
        /// Index of the winning outcome (only valid if resolved == true).
        winning_outcome_index: u64,
        
        /// Total NET amount in the pool across all outcomes.
        total_pool: u64,
        
        /// Index of the group this bet belongs to.
        group_id: u64,

        /// Per-outcome pool amounts. outcome_pools[i] = total NET wagered on outcomes[i].
        outcome_pools: vector<u64>,
        
        /// List of addresses that have placed wagers on this bet.
        members_wagered: vector<address>,
        
        /// Parallel array to members_wagered: wagers[i] is the wager for members_wagered[i].
        wagers: vector<Wager>,
        
        /// Optional encrypted payload for private bet details.
        /// Can contain encrypted description, metadata, or any other data.
        encrypted_payload: vector<u8>,
    }

    // =========================================================================
    // USERNAME / PROFILE REGISTRY
    // =========================================================================

    /// User profile for display in the frontend.
    /// 
    /// Each address can have one profile. Usernames must be globally unique.
    struct UserProfile has store {
        /// Unique username/handle for this user.
        name: String,
        
        /// Index into a preset avatar list (frontend defines the actual images).
        avatar_id: u64,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================
    // Events are emitted for all significant actions. An indexer can listen
    // to these events to build a real-time view of all groups, bets, etc.

    // Emitted when a user creates or updates their profile.
    #[event]
    struct ProfileUpdatedEvent has drop, store {
        user: address,
        name: String,
        avatar_id: u64,
    }

    // Emitted when a new group is created.
    #[event]
    struct GroupCreatedEvent has drop, store {
        group_id: u64,
        creator: address,
        name: String,
    }

    // Emitted when a user joins an existing group.
    #[event]
    struct GroupJoinedEvent has drop, store {
        group_id: u64,
        user: address,
    }

    // Emitted when a new bet is created within a group.
    #[event]
    struct BetCreatedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        creator: address,
        admin: address,
        /// Length of the encrypted payload (0 if none).
        encrypted_len: u64,
    }

    // Emitted when a user places or adds to a wager.
    #[event]
    struct WagerPlacedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        user: address,
        outcome_index: u64,
        // Gross amount the user sent (before fee).
        amount_gross: u64,
        // Net amount credited to the pool (after fee).
        amount_net: u64,
        // Fee amount taken (0.3% of gross).
        fee: u64,
    }

    // Emitted when a bet admin resolves a bet by declaring the winning outcome.
    #[event]
    struct BetResolvedEvent has drop, store {
        bet_id: u64,
        group_id: u64,
        admin: address,
        winning_outcome_index: u64,
    }

    // Emitted when winnings are paid out to a user.
    #[event]
    struct PayoutPaidEvent has drop, store {
        bet_id: u64,
        user: address,
        amount: u64,
    }

    // Emitted when a user cancels their wager.
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

    // Marker resource that lives inside the escrow object.
    // This is required so the object has a resource and can be properly typed.
    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct EscrowMarker has key {}

    /// Application configuration stored under the admin account.
    /// 
    /// This holds the escrow object reference and fee tracking.
    struct AppConfig has key {
        /// ExtendRef for the escrow object.
        /// This allows us to generate a signer for the escrow object on-demand
        /// to withdraw funds for payouts.
        extend_ref: object::ExtendRef,

        /// The secondary FungibleStore for USDC, owned by the escrow object.
        /// All wagers are deposited here; all payouts come from here.
        escrow_store: object::Object<fungible_asset::FungibleStore>,

        /// Running total of fees accumulated (in raw USDC units).
        /// Admin can withdraw up to this amount.
        fee_accumulator: u64,
    }

    // =========================================================================
    // GLOBAL APPLICATION STATE
    // =========================================================================

    /// Central state for the entire application.
    /// Stored under the admin (module) address.
    struct State has key {
        /// All groups in the system. group_id = index in this vector.
        groups: vector<Group>,
        
        /// All bets in the system. bet_id = index in this vector.
        bets: vector<Bet>,

        /// Profile registry: parallel arrays mapping address -> UserProfile.
        profile_addrs: vector<address>,
        profiles: vector<UserProfile>,
    }

    // =========================================================================
    // STATE ACCESS HELPERS
    // =========================================================================

    /// Borrow mutable reference to the global State.
    inline fun borrow_state_mut(): &mut State {
        borrow_global_mut<State>(@friend_fi)
    }

    /// Borrow immutable reference to the global State.
    inline fun borrow_state(): &State {
        borrow_global<State>(@friend_fi)
    }

    /// Borrow mutable reference to AppConfig.
    /// Asserts that escrow has been initialized.
    inline fun borrow_app_config_mut(): &mut AppConfig {
        assert!(exists<AppConfig>(@friend_fi), E_ESCROW_NOT_INITIALIZED);
        borrow_global_mut<AppConfig>(@friend_fi)
    }

    /// Borrow immutable reference to AppConfig.
    /// Asserts that escrow has been initialized.
    inline fun borrow_app_config(): &AppConfig {
        assert!(exists<AppConfig>(@friend_fi), E_ESCROW_NOT_INITIALIZED);
        borrow_global<AppConfig>(@friend_fi)
    }

    // =========================================================================
    // LOOKUP HELPERS
    // =========================================================================

    /// Get a reference to a group by its ID.
    /// Aborts with E_BAD_GROUP_ID if the group doesn't exist.
    fun borrow_group(state: &State, group_id: u64): &Group {
        let len = vector::length(&state.groups);
        assert!(group_id < len, E_BAD_GROUP_ID);
        vector::borrow(&state.groups, group_id)
    }

    /// Get a mutable reference to a group by its ID.
    /// Aborts with E_BAD_GROUP_ID if the group doesn't exist.
    fun borrow_group_mut(state: &mut State, group_id: u64): &mut Group {
        let len = vector::length(&state.groups);
        assert!(group_id < len, E_BAD_GROUP_ID);
        vector::borrow_mut(&mut state.groups, group_id)
    }

    /// Get a reference to a bet by its ID.
    /// Aborts with E_BAD_BET_ID if the bet doesn't exist.
    fun borrow_bet(state: &State, bet_id: u64): &Bet {
        let len = vector::length(&state.bets);
        assert!(bet_id < len, E_BAD_BET_ID);
        vector::borrow(&state.bets, bet_id)
    }

    /// Get a mutable reference to a bet by its ID.
    /// Aborts with E_BAD_BET_ID if the bet doesn't exist.
    fun borrow_bet_mut(state: &mut State, bet_id: u64): &mut Bet {
        let len = vector::length(&state.bets);
        assert!(bet_id < len, E_BAD_BET_ID);
        vector::borrow_mut(&mut state.bets, bet_id)
    }

    /// Find a member's index in a group's member list.
    /// Returns (true, index) if found, (false, 0) otherwise.
    fun find_member_index(group: &Group, addr: address): (bool, u64) {
        let len = vector::length(&group.members);
        let i = 0;
        while (i < len) {
            let a_ref = vector::borrow(&group.members, i);
            if (*a_ref == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Find a user's wager index in a bet's wager list.
    /// Returns (true, index) if found, (false, 0) otherwise.
    fun find_wager_index(bet: &Bet, addr: address): (bool, u64) {
        let len = vector::length(&bet.members_wagered);
        let i = 0;
        while (i < len) {
            let a_ref = vector::borrow(&bet.members_wagered, i);
            if (*a_ref == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Find a user's profile index in the profile registry.
    /// Returns (true, index) if found, (false, 0) otherwise.
    fun find_profile_index(state: &State, addr: address): (bool, u64) {
        let len = vector::length(&state.profile_addrs);
        let i = 0;
        while (i < len) {
            let a_ref = vector::borrow(&state.profile_addrs, i);
            if (*a_ref == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the entire application.
    /// 
    /// MUST be called once by the admin (@friend_fi) before any other functions.
    /// 
    /// This sets up:
    /// 1. Escrow object with a secondary USDC store for holding wagers
    /// 2. AppConfig with the ExtendRef for signing as escrow
    /// 3. Global State with empty groups/bets/profiles and event handles
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Only the module deployer can initialize
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);

        // Prevent double initialization
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // =====================================================================
        // STEP 1: Create escrow object and USDC secondary store
        // =====================================================================

        // Create a named object with deterministic address based on seed
        let constructor_ref = object::create_named_object(
            admin,
            ESCROW_OBJECT_SEED,
        );

        // The escrow object needs a resource to exist, so we add EscrowMarker
        let escrow_signer = object::generate_signer(&constructor_ref);
        move_to(&escrow_signer, EscrowMarker {});

        // Get ExtendRef - this lets us generate a signer for the escrow object later
        // (needed for withdrawing funds for payouts)
        let extend_ref = object::generate_extend_ref(&constructor_ref);

        // Create a secondary FungibleStore for USDC owned by the escrow object
        // All wagers will be deposited here
        let metadata = usdc_metadata();
        let escrow_store = fungible_asset::create_store(
            &constructor_ref,
            metadata,
        );

        // Store the configuration under the admin account
        move_to(admin, AppConfig {
            extend_ref,
            escrow_store,
            fee_accumulator: 0,
        });

        // =====================================================================
        // STEP 2: Create global State
        // =====================================================================

        init_state_internal(admin);
    }

    /// Internal function to initialize just the State (no escrow).
    /// Used by both init() and test-only initialization.
    fun init_state_internal(admin: &signer) {
        let groups = vector::empty<Group>();
        let bets = vector::empty<Bet>();
        let profile_addrs = vector::empty<address>();
        let profiles = vector::empty<UserProfile>();

        move_to(admin, State {
            groups,
            bets,
            profile_addrs,
            profiles,
        });
    }

    #[test_only]
    /// Test-only initialization that skips USDC escrow setup.
    /// This allows unit testing of groups, bets, profiles without needing real USDC.
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Only the module deployer can initialize
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);

        // Prevent double initialization
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);

        init_state_internal(admin);
    }

    // =========================================================================
    // ESCROW PRIMITIVES (INTERNAL)
    // =========================================================================

    /// Internal function: Move USDC from user's primary store into escrow.
    /// 
    /// Takes the 0.3% fee and tracks it in fee_accumulator.
    /// Returns the NET amount credited to the pool (raw_amount - fee).
    /// 
    /// Flow:
    /// 1. Calculate fee (0.3% of raw_amount)
    /// 2. Withdraw full amount from user's primary fungible store
    /// 3. Split into fee portion and net portion
    /// 4. Deposit both into escrow store (fee tracked separately)
    fun internal_deposit_from_user(
        user: &signer,
        raw_amount: u64
    ): u64 acquires AppConfig {
        assert!(raw_amount > 0, E_INSUFFICIENT_AMOUNT);

        // Calculate fee: 0.3% = 30/10000
        let fee = (raw_amount * FEE_BPS) / BPS_DENOMINATOR;
        let net = raw_amount - fee;

        // Withdraw the full amount from user's primary USDC store
        let metadata = usdc_metadata();
        let fa = primary_fungible_store::withdraw(user, metadata, raw_amount);

        // Split the fungible asset into fee and net portions
        let fee_asset = fungible_asset::extract(&mut fa, fee);

        // Deposit into escrow store and update fee tracking
        let app = borrow_app_config_mut();
        let store = app.escrow_store;

        // Deposit the fee (tracked in fee_accumulator)
        fungible_asset::deposit(store, fee_asset);
        app.fee_accumulator = app.fee_accumulator + fee;

        // Deposit the net amount (this goes into the betting pool)
        fungible_asset::deposit(store, fa);

        net
    }

    /// Internal function: Pay USDC from escrow to a user.
    /// 
    /// Used for paying out winnings when a bet is resolved.
    /// Does nothing if amount == 0.
    /// Emits a PayoutPaidEvent.
    fun internal_payout_to_user(
        bet_id: u64,
        recipient: address,
        amount: u64
    ) acquires AppConfig {
        if (amount == 0) {
            return
        };

        let app = borrow_app_config_mut();

        // Generate a signer for the escrow object using the stored ExtendRef
        let escrow_signer = object::generate_signer_for_extending(&app.extend_ref);
        let store = app.escrow_store;

        // Withdraw from escrow store
        let fa = fungible_asset::withdraw(
            &escrow_signer,
            store,
            amount,
        );

        // Deposit to recipient's primary store (creates one if it doesn't exist)
        primary_fungible_store::deposit(recipient, fa);

        // Emit payout event for indexer
        event::emit(PayoutPaidEvent {
            bet_id,
            user: recipient,
            amount,
        });
    }

    // =========================================================================
    // PROFILE / USERNAME FUNCTIONS
    // =========================================================================

    /// Set or update your profile (username and avatar).
    /// 
    /// Usernames must be globally unique - no two addresses can have the same name.
    /// If you already have a profile, this updates it. Otherwise, creates a new one.
    /// 
    /// Emits ProfileUpdatedEvent.
    public entry fun set_profile(
        account: &signer,
        name: String,
        avatar_id: u64,
    ) acquires State {
        let user = signer::address_of(account);
        let state = borrow_state_mut();

        // Check username uniqueness: ensure no other address has this name
        let len = vector::length(&state.profile_addrs);
        let i = 0;
        while (i < len) {
            let addr_ref = vector::borrow(&state.profile_addrs, i);
            let prof_ref = vector::borrow(&state.profiles, i);
            // Allow the same user to keep their name, but reject if someone else has it
            if (*addr_ref != user && strings_equal(&prof_ref.name, &name)) {
                abort E_USERNAME_TAKEN
            };
            i = i + 1;
        };

        // Update existing profile or create new one
        let (found, idx) = find_profile_index(state, user);
        if (found) {
            // Update existing profile
            let profile_ref = vector::borrow_mut(&mut state.profiles, idx);
            profile_ref.name = name;
            profile_ref.avatar_id = avatar_id;
        } else {
            // Create new profile
            vector::push_back(&mut state.profile_addrs, user);
            let profile = UserProfile { name, avatar_id };
            vector::push_back(&mut state.profiles, profile);
        };

        // Emit event with the updated profile data
        let (_, idx2) = find_profile_index(state, user);
        let prof_ref2 = vector::borrow(&state.profiles, idx2);
        event::emit(ProfileUpdatedEvent {
            user,
            name: clone_string(&prof_ref2.name),
            avatar_id: prof_ref2.avatar_id,
        });
    }

    #[view]
    /// View: Get profile for an address.
    /// Returns (name, avatar_id, exists).
    /// If no profile exists, returns ("", 0, false).
    public fun get_profile(addr: address): (String, u64, bool) acquires State {
        let state = borrow_state();
        let (found, idx) = find_profile_index(state, addr);
        if (!found) {
            (utf8(b""), 0, false)
        } else {
            let prof_ref = vector::borrow(&state.profiles, idx);
            (clone_string(&prof_ref.name), prof_ref.avatar_id, true)
        }
    }

    #[view]
    /// View: Resolve a username to an address.
    /// Returns (address, found).
    /// If no user has this name, returns (admin_address(), false).
    public fun resolve_username(name: String): (address, bool) acquires State {
        let state = borrow_state();
        let len = vector::length(&state.profile_addrs);
        let i = 0;
        while (i < len) {
            let addr_ref = vector::borrow(&state.profile_addrs, i);
            let prof_ref = vector::borrow(&state.profiles, i);
            if (strings_equal(&prof_ref.name, &name)) {
                return (*addr_ref, true)
            };
            i = i + 1;
        };
        // Return a dummy address and false if not found
        (admin_address(), false)
    }

    // =========================================================================
    // GROUP FUNCTIONS
    // =========================================================================

    /// Create a simple password "hash" from a string.
    /// 
    /// WARNING: This just returns the raw bytes - NOT cryptographically secure!
    /// Anyone can read on-chain storage and see the password bytes.
    /// This is acceptable for a hackathon demo but NOT for production.
    fun hash_password(p: &String): vector<u8> {
        *bytes(p)
    }

    /// Create a new betting group.
    /// 
    /// The creator is automatically added as the first member.
    /// Other users must call join_group() with the correct password.
    /// 
    /// Returns: group_id = vector::length(&groups) - 1 after creation
    /// Emits GroupCreatedEvent.
    public entry fun create_group(
        account: &signer,
        name: String,
        password: String,
    ) acquires State {
        let creator = signer::address_of(account);
        let state = borrow_state_mut();

        // Hash the password (just bytes for now)
        let pwd_hash = hash_password(&password);

        // Initialize member arrays with creator as first member
        let members = vector::empty<address>();
        let total_wagered = vector::empty<u64>();
        let bets = vector::empty<u64>();

        vector::push_back(&mut members, creator);
        vector::push_back(&mut total_wagered, 0);

        // Create the group struct
        let group = Group {
            name: clone_string(&name),
            password_hash: pwd_hash,
            members,
            total_wagered,
            bets,
        };

        // Add to groups vector; ID is the index
        let group_id = vector::length(&state.groups);
        vector::push_back(&mut state.groups, group);

        // Emit event for indexer
        event::emit(GroupCreatedEvent {
            group_id,
            creator,
            name,
        });
    }

    /// Join an existing group with the correct password.
    /// 
    /// Fails if:
    /// - Group doesn't exist (E_BAD_GROUP_ID)
    /// - Password is wrong (E_INVALID_PASSWORD)
    /// - Already a member (E_ALREADY_MEMBER)
    /// 
    /// Emits GroupJoinedEvent.
    public entry fun join_group(
        account: &signer,
        group_id: u64,
        password: String,
    ) acquires State {
        let user = signer::address_of(account);
        let state = borrow_state_mut();
        let group = borrow_group_mut(state, group_id);

        // Verify password matches
        let expected = &group.password_hash;
        let provided = hash_password(&password);
        assert!(provided == *expected, E_INVALID_PASSWORD);

        // Check not already a member
        let (is_mem, _) = find_member_index(group, user);
        assert!(!is_mem, E_ALREADY_MEMBER);

        // Add user to group
        vector::push_back(&mut group.members, user);
        vector::push_back(&mut group.total_wagered, 0);

        // Emit event
        event::emit(GroupJoinedEvent { group_id, user });
    }

    #[view]
    /// View: Get all member addresses in a group.
    public fun get_group_members(group_id: u64): vector<address> acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);

        // Clone the members vector
        let res = vector::empty<address>();
        let len = vector::length(&group.members);
        let i = 0;
        while (i < len) {
            let a_ref = vector::borrow(&group.members, i);
            vector::push_back(&mut res, *a_ref);
            i = i + 1;
        };
        res
    }

    #[view]
    /// View: Get all bet IDs in a group.
    public fun get_group_bets(group_id: u64): vector<u64> acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);

        // Clone the bets vector
        let res = vector::empty<u64>();
        let len = vector::length(&group.bets);
        let i = 0;
        while (i < len) {
            let v_ref = vector::borrow(&group.bets, i);
            vector::push_back(&mut res, *v_ref);
            i = i + 1;
        };
        res
    }

    #[view]
    /// View: Check if an address is a member of a group.
    public fun check_if_member_in_group(group_id: u64, member: address): bool acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        let (is_mem, _) = find_member_index(group, member);
        is_mem
    }

    // =========================================================================
    // BET FUNCTIONS
    // =========================================================================

    /// Create a new bet within a group.
    /// 
    /// Requirements:
    /// - Caller must be a member of the group
    /// - Must have at least 2 outcomes
    /// - Admin address is who can resolve the bet (can be caller or someone else)
    /// 
    /// The encrypted_payload can contain any encrypted data (e.g., encrypted description,
    /// metadata, or additional bet details). Pass an empty vector if not using encryption.
    /// 
    /// Returns: bet_id = vector::length(&bets) - 1 after creation
    /// Emits BetCreatedEvent.
    public entry fun create_bet(
        account: &signer,
        group_id: u64,
        description: String,
        outcomes: vector<String>,
        admin: address,
        encrypted_payload: vector<u8>,
    ) acquires State {
        let caller = signer::address_of(account);

        // Validate in read-only scope to avoid borrow conflicts
        {
            let state_read = borrow_state();
            let group_read = borrow_group(state_read, group_id);
            let (is_mem, _) = find_member_index(group_read, caller);
            assert!(is_mem, E_NOT_MEMBER);

            let num_outcomes = vector::length(&outcomes);
            assert!(num_outcomes > 1, E_NEED_AT_LEAST_TWO_OUTCOMES);
        };

        // Now mutate state
        let state = borrow_state_mut();

        // Initialize outcome pools (all start at 0)
        let num_outcomes = vector::length(&outcomes);
        let outcome_pools = vector::empty<u64>();
        let i = 0;
        while (i < num_outcomes) {
            vector::push_back(&mut outcome_pools, 0);
            i = i + 1;
        };

        let members_wagered = vector::empty<address>();
        let wagers = vector::empty<Wager>();

        // Get encrypted payload length for event
        let encrypted_len = vector::length(&encrypted_payload);

        // Create the bet struct
        let bet = Bet {
            description,
            outcomes,
            admin,
            resolved: false,
            winning_outcome_index: 0,
            total_pool: 0,
            group_id,
            outcome_pools,
            members_wagered,
            wagers,
            encrypted_payload,
        };

        // Add to bets vector and get bet_id
        let bet_id = vector::length(&state.bets);
        vector::push_back(&mut state.bets, bet);

        // Add bet_id to the group's bet list
        let group = borrow_group_mut(state, group_id);
        vector::push_back(&mut group.bets, bet_id);

        // Emit event
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
    /// 
    /// Flow:
    /// 1. Pull USDC from user's wallet into escrow (0.3% fee taken)
    /// 2. Credit the net amount to the chosen outcome's pool
    /// 3. Record or update the user's wager
    /// 4. Update the user's total wagered volume in the group
    /// 
    /// Requirements:
    /// - User must be a member of the bet's group
    /// - Bet must not be resolved yet
    /// - Amount must be > 0
    /// - Outcome index must be valid
    /// 
    /// If user already has a wager on this bet, the new amount is ADDED
    /// and the outcome is updated to the new choice.
    /// 
    /// Emits WagerPlacedEvent.
    public entry fun place_wager(
        account: &signer,
        bet_id: u64,
        outcome_index: u64,
        amount: u64,
    ) acquires State, AppConfig {
        let user = signer::address_of(account);

        // Step 1: Pull USDC from user -> escrow, get net amount after fee
        let net_amount = internal_deposit_from_user(account, amount);

        // Step 2: Read-only validation to get group_id and member index
        let (group_id, mem_idx) = {
            let state_read = borrow_state();
            let bet_read = borrow_bet(state_read, bet_id);
            
            // Cannot wager on resolved bets
            assert!(!bet_read.resolved, E_BET_ALREADY_RESOLVED);

            // Validate outcome index
            let num_outcomes = vector::length(&bet_read.outcomes);
            assert!(outcome_index < num_outcomes, E_INVALID_OUTCOME_INDEX);
            assert!(amount > 0, E_ZERO_WAGER);

            // Check user is a group member
            let group_read = borrow_group(state_read, bet_read.group_id);
            let (is_mem, mem_idx_inner) = find_member_index(group_read, user);
            assert!(is_mem, E_NOT_MEMBER);

            (bet_read.group_id, mem_idx_inner)
        };

        // Step 3: Update bet pools and user's wager
        {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            // Add net amount to the outcome pool
            let pool_ref = vector::borrow_mut(&mut bet.outcome_pools, outcome_index);
            *pool_ref = *pool_ref + net_amount;
            bet.total_pool = bet.total_pool + net_amount;

            // Update or create user's wager record
            let (found, w_idx) = find_wager_index(bet, user);
            if (found) {
                // User already has a wager - verify same outcome and add to it
                let w_ref = vector::borrow_mut(&mut bet.wagers, w_idx);
                // Users can only bet on one outcome - reject if trying to bet on different outcome
                assert!(w_ref.outcome == outcome_index, E_ALREADY_BET_ON_DIFFERENT_OUTCOME);
                w_ref.amount = w_ref.amount + net_amount;
            } else {
                // First wager from this user
                vector::push_back(&mut bet.members_wagered, user);
                let w = Wager { amount: net_amount, outcome: outcome_index };
                vector::push_back(&mut bet.wagers, w);
            };

            // Emit wager event
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

        // Step 4: Update group.total_wagered with GROSS amount
        {
            let state = borrow_state_mut();
            let group = borrow_group_mut(state, group_id);
            let tw_ref = vector::borrow_mut(&mut group.total_wagered, mem_idx);
            *tw_ref = *tw_ref + amount;
        };
    }

    /// Cancel a wager and get a refund.
    /// 
    /// Users can cancel their wager before a bet is resolved.
    /// The NET amount (what was credited to the pool) is returned.
    /// Note: The 0.3% fee taken at deposit is NOT refunded.
    /// 
    /// Requirements:
    /// - Bet must not be resolved yet
    /// - User must have an existing wager on this bet
    /// 
    /// Emits WagerCancelledEvent.
    public entry fun cancel_wager(
        account: &signer,
        bet_id: u64,
    ) acquires State, AppConfig {
        let user = signer::address_of(account);

        // Step 1: Validate and get wager info
        let (group_id, outcome_index, refund_amount, mem_idx) = {
            let state = borrow_state();
            let bet = borrow_bet(state, bet_id);
            
            // Cannot cancel on resolved bets
            assert!(!bet.resolved, E_BET_ALREADY_RESOLVED);

            // Check user has a wager
            let (found, w_idx) = find_wager_index(bet, user);
            assert!(found, E_NO_WAGER_TO_CANCEL);

            let wager = vector::borrow(&bet.wagers, w_idx);
            let outcome_index = wager.outcome;
            let refund_amount = wager.amount;

            // Get group and member index for updating total_wagered
            let group = borrow_group(state, bet.group_id);
            let (is_mem, mem_idx_inner) = find_member_index(group, user);
            assert!(is_mem, E_NOT_MEMBER);

            (bet.group_id, outcome_index, refund_amount, mem_idx_inner)
        };

        // Step 2: Update bet pools and remove wager
        {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            // Decrease the outcome pool
            let pool_ref = vector::borrow_mut(&mut bet.outcome_pools, outcome_index);
            *pool_ref = *pool_ref - refund_amount;
            bet.total_pool = bet.total_pool - refund_amount;

            // Find and remove the wager
            let (_, w_idx) = find_wager_index(bet, user);
            vector::remove(&mut bet.members_wagered, w_idx);
            vector::remove(&mut bet.wagers, w_idx);
        };

        // Step 3: Update group.total_wagered (subtract the original gross amount)
        // Note: We're subtracting the net amount here since we don't track gross per wager
        // This is a slight inconsistency but acceptable for the use case
        {
            let state = borrow_state_mut();
            let group = borrow_group_mut(state, group_id);
            let tw_ref = vector::borrow_mut(&mut group.total_wagered, mem_idx);
            // Subtract net amount (we could track gross separately if needed)
            if (*tw_ref >= refund_amount) {
                *tw_ref = *tw_ref - refund_amount;
            } else {
                *tw_ref = 0;
            };
        };

        // Step 4: Refund USDC from escrow to user
        internal_payout_to_user(bet_id, user, refund_amount);

        // Emit cancel event
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

    /// Resolve a bet by declaring the winning outcome and paying winners.
    /// 
    /// Only the bet admin can call this.
    /// 
    /// Payout calculation (parimutuel):
    /// - All wagers go into a combined pool
    /// - Winners split the entire pool proportional to their wager
    /// - payout = (user_wager / winning_pool) * total_pool
    /// 
    /// Example:
    /// - Total pool: 1000 USDC
    /// - Winning outcome pool: 400 USDC
    /// - User wagered 100 USDC on winner
    /// - User payout: (100 / 400) * 1000 = 250 USDC
    /// 
    /// Emits BetResolvedEvent and PayoutPaidEvent for each winner.
    public entry fun resolve_bet(
        account: &signer,
        bet_id: u64,
        winning_outcome_index: u64,
    ) acquires State, AppConfig {
        let caller = signer::address_of(account);

        // Snapshot data and mark bet as resolved in one scope
        let (_group_id, total_pool_u128, winning_pool_u128, members_snapshot, wagers_snapshot) = {
            let state = borrow_state_mut();
            let bet = borrow_bet_mut(state, bet_id);

            // Only bet admin can resolve
            assert!(caller == bet.admin, E_NOT_BET_ADMIN);
            
            // Cannot resolve twice
            assert!(!bet.resolved, E_BET_ALREADY_RESOLVED);

            // Validate winning outcome index
            let num_outcomes = vector::length(&bet.outcomes);
            assert!(winning_outcome_index < num_outcomes, E_INVALID_OUTCOME_INDEX);

            // Mark as resolved
            bet.resolved = true;
            bet.winning_outcome_index = winning_outcome_index;

            // Get pool values for payout calculation
            let total_pool_u128 = (bet.total_pool as u128);
            let winning_pool = *vector::borrow(&bet.outcome_pools, winning_outcome_index);
            let winning_pool_u128 = (winning_pool as u128);

            // Snapshot participants and their wagers (we need copies because we'll
            // release the borrow before paying out)
            let members_snapshot = {
                let res = vector::empty<address>();
                let len = vector::length(&bet.members_wagered);
                let i = 0;
                while (i < len) {
                    let a_ref = vector::borrow(&bet.members_wagered, i);
                    vector::push_back(&mut res, *a_ref);
                    i = i + 1;
                };
                res
            };

            let wagers_snapshot = {
                let res = vector::empty<Wager>();
                let len = vector::length(&bet.wagers);
                let i = 0;
                while (i < len) {
                    let w_ref = vector::borrow(&bet.wagers, i);
                    // Copy the wager struct
                    let w_copy = Wager {
                        amount: w_ref.amount,
                        outcome: w_ref.outcome,
                    };
                    vector::push_back(&mut res, w_copy);
                    i = i + 1;
                };
                res
            };

            // Emit resolution event
            event::emit(BetResolvedEvent {
                bet_id,
                group_id: bet.group_id,
                admin: caller,
                winning_outcome_index,
            });

            (bet.group_id, total_pool_u128, winning_pool_u128, members_snapshot, wagers_snapshot)
        };

        // If no one bet on the winning side, nothing to pay out
        if (winning_pool_u128 == 0) {
            return
        };

        // Calculate and pay out winnings to each winner
        // Formula: payout = (user_wager * total_pool) / winning_pool
        let len = vector::length(&members_snapshot);
        let i = 0;
        while (i < len) {
            let user_ref = vector::borrow(&members_snapshot, i);
            let w_ref = vector::borrow(&wagers_snapshot, i);
            let user = *user_ref;
            let w_amount = w_ref.amount;
            let w_outcome = w_ref.outcome;

            // Only pay users who bet on the winning outcome
            if (w_amount > 0 && w_outcome == winning_outcome_index) {
                let w_u128 = (w_amount as u128);
                let payout_u128 = (w_u128 * total_pool_u128) / winning_pool_u128;
                let payout = (payout_u128 as u64);

                // Transfer USDC from escrow to winner
                internal_payout_to_user(bet_id, user, payout);
            };

            i = i + 1;
        };
    }

    // =========================================================================
    // ADMIN FEE WITHDRAWAL
    // =========================================================================

    /// Withdraw accumulated fees from escrow to admin's wallet.
    /// 
    /// Only the admin (module deployer) can call this.
    /// The amount must be <= fee_accumulator (can't withdraw bet pool funds).
    public entry fun withdraw_fees(
        admin: &signer,
        amount: u64
    ) acquires AppConfig {
        let addr = signer::address_of(admin);
        
        // Only module deployer can withdraw fees
        assert!(addr == admin_address(), E_NOT_ADMIN);

        let app = borrow_app_config_mut();
        
        // Validate amount
        assert!(amount > 0, E_INSUFFICIENT_AMOUNT);
        assert!(amount <= app.fee_accumulator, E_INSUFFICIENT_AMOUNT);

        // Generate signer for escrow object
        let escrow_signer = object::generate_signer_for_extending(&app.extend_ref);
        let store = app.escrow_store;

        // Withdraw from escrow
        let fa = fungible_asset::withdraw(
            &escrow_signer,
            store,
            amount,
        );

        // Update fee accumulator
        app.fee_accumulator = app.fee_accumulator - amount;

        // Deposit to admin's wallet
        primary_fungible_store::deposit(addr, fa);
    }

    // =========================================================================
    // VIEW FUNCTIONS - ESCROW & FEES
    // =========================================================================

    #[view]
    /// View: Get total USDC balance in escrow (includes both pools and fees).
    public fun escrow_balance(): u64 acquires AppConfig {
        let app = borrow_app_config();
        fungible_asset::balance(app.escrow_store)
    }

    #[view]
    /// View: Get total accumulated fees (available for admin withdrawal).
    public fun total_fees_accumulated(): u64 acquires AppConfig {
        let app = borrow_app_config();
        app.fee_accumulator
    }

    // =========================================================================
    // VIEW FUNCTIONS - BETS
    // =========================================================================

    #[view]
    /// View: Get the admin address for a bet.
    public fun get_bet_admin(bet_id: u64): address acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.admin
    }

    #[view]
    /// View: Get the number of outcomes for a bet.
    public fun get_bet_outcomes_length(bet_id: u64): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        vector::length(&bet.outcomes)
    }

    #[view]
    /// View: Get the label for a specific outcome of a bet.
    public fun get_bet_outcome(bet_id: u64, outcome_index: u64): String acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);

        let len = vector::length(&bet.outcomes);
        assert!(outcome_index < len, E_INVALID_OUTCOME_INDEX);
        let s_ref = vector::borrow(&bet.outcomes, outcome_index);
        utf8(*bytes(s_ref))
    }

    #[view]
    /// View: Get the pool amount for a specific outcome of a bet.
    public fun get_bet_outcome_pool(bet_id: u64, outcome_index: u64): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);

        let len = vector::length(&bet.outcome_pools);
        assert!(outcome_index < len, E_INVALID_OUTCOME_INDEX);
        let p_ref = vector::borrow(&bet.outcome_pools, outcome_index);
        *p_ref
    }

    #[view]
    /// View: Get the total pool for a bet.
    public fun get_bet_total_pool(bet_id: u64): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.total_pool
    }

    #[view]
    /// View: Check if a bet has been resolved.
    public fun is_bet_resolved(bet_id: u64): bool acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.resolved
    }

    #[view]
    /// View: Get the winning outcome index (only valid if bet is resolved).
    public fun get_winning_outcome(bet_id: u64): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        bet.winning_outcome_index
    }

    #[view]
    /// View: Get a user's wager amount on a bet (returns 0 if no wager).
    public fun get_user_wager(bet_id: u64, user: address): u64 acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        let (found, idx) = find_wager_index(bet, user);
        if (!found) {
            0
        } else {
            let w_ref = vector::borrow(&bet.wagers, idx);
            w_ref.amount
        }
    }

    #[view]
    /// View: Get the number of groups.
    public fun get_groups_count(): u64 acquires State {
        let state = borrow_state();
        vector::length(&state.groups)
    }

    #[view]
    /// View: Get the number of bets.
    public fun get_bets_count(): u64 acquires State {
        let state = borrow_state();
        vector::length(&state.bets)
    }

    #[view]
    /// View: Get the name of a group.
    public fun get_group_name(group_id: u64): String acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        clone_string(&group.name)
    }

    #[view]
    /// View: Get the description of a bet.
    public fun get_bet_description(bet_id: u64): String acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        clone_string(&bet.description)
    }

    #[view]
    /// View: Get which outcome a user wagered on.
    /// Returns (outcome_index, has_wager).
    /// If user has no wager, returns (0, false).
    public fun get_user_wager_outcome(bet_id: u64, user: address): (u64, bool) acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        let (found, idx) = find_wager_index(bet, user);
        if (!found) {
            (0, false)
        } else {
            let w_ref = vector::borrow(&bet.wagers, idx);
            (w_ref.outcome, true)
        }
    }

    #[view]
    /// View: Get the encrypted payload for a bet.
    /// Returns the raw bytes (empty vector if no payload was provided).
    public fun get_bet_encrypted_payload(bet_id: u64): vector<u8> acquires State {
        let state = borrow_state();
        let bet = borrow_bet(state, bet_id);
        // Clone the vector
        let res = vector::empty<u8>();
        let len = vector::length(&bet.encrypted_payload);
        let i = 0;
        while (i < len) {
            let b_ref = vector::borrow(&bet.encrypted_payload, i);
            vector::push_back(&mut res, *b_ref);
            i = i + 1;
        };
        res
    }
}
