/// ============================================================================
/// Friend-Fi Shared Groups Module V2 (Hybrid Architecture)
/// ============================================================================
///
/// HYBRID DESIGN:
/// - ON-CHAIN: Only membership list for access control
/// - OFF-CHAIN (Supabase): Group name, description, password hash, admin
///
/// This drastically reduces gas costs while maintaining security:
/// - Group creation: ~90% cheaper (no name/description storage)
/// - Joining groups: ~80% cheaper (no password comparison on-chain)
/// - Profile management: 100% free (off-chain only)
///
/// SECURITY MODEL:
/// - Membership verification happens on-chain (cannot be faked)
/// - Password verification happens off-chain (client-side or API)
/// - Metadata is trusted but not critical for security
///
/// ============================================================================

module friend_fi::groups {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::vector;
    use aptos_framework::event;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// Module admin address (deployer).
    const ADMIN_ADDR: address = @friend_fi;

    // =========================================================================
    // ERROR CODES
    // =========================================================================

    /// State already initialized.
    const E_ALREADY_INITIALIZED: u64 = 1;

    /// Caller is not the admin.
    const E_NOT_ADMIN: u64 = 2;

    /// Group ID doesn't exist.
    const E_BAD_GROUP_ID: u64 = 10;

    /// Already a member.
    const E_ALREADY_MEMBER: u64 = 12;

    /// Not a member.
    const E_NOT_MEMBER: u64 = 13;

    /// Not the group admin.
    const E_NOT_GROUP_ADMIN: u64 = 15;

    // =========================================================================
    // CORE DATA STRUCTURES
    // =========================================================================

    /// Minimal on-chain group data (access control only)
    struct Group has store {
        /// Admin who created the group (for access control)
        admin: address,

        /// List of member addresses (for membership verification)
        members: vector<address>,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct GroupCreatedEvent has drop, store {
        group_id: u64,
        creator: address,
    }

    #[event]
    struct GroupJoinedEvent has drop, store {
        group_id: u64,
        user: address,
    }

    #[event]
    struct GroupLeftEvent has drop, store {
        group_id: u64,
        user: address,
    }

    // =========================================================================
    // GLOBAL STATE
    // =========================================================================

    /// Central registry for all groups (minimal on-chain data)
    struct State has key {
        /// All groups. group_id = index in this vector.
        groups: vector<Group>,
    }

    // =========================================================================
    // STATE ACCESS HELPERS
    // =========================================================================

    inline fun borrow_state_mut(): &mut State {
        borrow_global_mut<State>(ADMIN_ADDR)
    }

    inline fun borrow_state(): &State {
        borrow_global<State>(ADMIN_ADDR)
    }

    // =========================================================================
    // LOOKUP HELPERS
    // =========================================================================

    /// Get a reference to a group by ID.
    fun borrow_group(state: &State, group_id: u64): &Group {
        assert!(group_id < vector::length(&state.groups), E_BAD_GROUP_ID);
        vector::borrow(&state.groups, group_id)
    }

    /// Get a mutable reference to a group by ID.
    fun borrow_group_mut(state: &mut State, group_id: u64): &mut Group {
        assert!(group_id < vector::length(&state.groups), E_BAD_GROUP_ID);
        vector::borrow_mut(&mut state.groups, group_id)
    }

    /// Find member index in group.
    fun find_member_index(group: &Group, addr: address): (bool, u64) {
        let len = vector::length(&group.members);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&group.members, i) == addr) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the groups registry.
    /// MUST be called once by admin before using the module.
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == ADMIN_ADDR, E_NOT_ADMIN);
        assert!(!exists<State>(ADMIN_ADDR), E_ALREADY_INITIALIZED);

        move_to(admin, State {
            groups: vector::empty<Group>(),
        });
    }

    #[test_only]
    /// Test-only initialization.
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == ADMIN_ADDR, E_NOT_ADMIN);
        assert!(!exists<State>(ADMIN_ADDR), E_ALREADY_INITIALIZED);

        move_to(admin, State {
            groups: vector::empty<Group>(),
        });
    }

    // =========================================================================
    // GROUP MANAGEMENT (Simplified)
    // =========================================================================

    /// Create a new group (minimal on-chain data)
    /// Name, description, password are stored off-chain in Supabase
    public entry fun create_group(creator: &signer) acquires State {
        let creator_addr = signer::address_of(creator);
        let state = borrow_state_mut();

        // Create minimal group on-chain
        let group = Group {
            admin: creator_addr,
            members: vector::singleton(creator_addr),
        };

        let group_id = vector::length(&state.groups);
        vector::push_back(&mut state.groups, group);

        // Emit event for indexer
        event::emit(GroupCreatedEvent {
            group_id,
            creator: creator_addr,
        });
    }

    /// Join a group (password verification happens off-chain)
    /// Frontend/API verifies password before calling this
    public entry fun join_group(user: &signer, group_id: u64) acquires State {
        let user_addr = signer::address_of(user);
        let state = borrow_state_mut();
        let group = borrow_group_mut(state, group_id);

        // Check if already a member
        let (is_member, _) = find_member_index(group, user_addr);
        assert!(!is_member, E_ALREADY_MEMBER);

        // Add to members list
        vector::push_back(&mut group.members, user_addr);

        // Emit event
        event::emit(GroupJoinedEvent {
            group_id,
            user: user_addr,
        });
    }

    /// Leave a group
    public entry fun leave_group(user: &signer, group_id: u64) acquires State {
        let user_addr = signer::address_of(user);
        let state = borrow_state_mut();
        let group = borrow_group_mut(state, group_id);

        // Find and remove member
        let (is_member, idx) = find_member_index(group, user_addr);
        assert!(is_member, E_NOT_MEMBER);

        vector::remove(&mut group.members, idx);

        // Emit event
        event::emit(GroupLeftEvent {
            group_id,
            user: user_addr,
        });
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    /// Get total number of groups
    #[view]
    public fun get_groups_count(): u64 acquires State {
        if (!exists<State>(ADMIN_ADDR)) {
            return 0
        };
        let state = borrow_state();
        vector::length(&state.groups)
    }

    /// Check if an address is a member of a group
    #[view]
    public fun is_member(group_id: u64, addr: address): bool acquires State {
        if (!exists<State>(ADMIN_ADDR)) {
            return false
        };
        let state = borrow_state();
        if (group_id >= vector::length(&state.groups)) {
            return false
        };
        let group = borrow_group(state, group_id);
        let (is_member, _) = find_member_index(group, addr);
        is_member
    }

    /// Check if an address is the admin of a group
    #[view]
    public fun is_admin(group_id: u64, addr: address): bool acquires State {
        if (!exists<State>(ADMIN_ADDR)) {
            return false
        };
        let state = borrow_state();
        if (group_id >= vector::length(&state.groups)) {
            return false
        };
        let group = borrow_group(state, group_id);
        group.admin == addr
    }

    /// Get all members of a group
    #[view]
    public fun get_members(group_id: u64): vector<address> acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        group.members
    }

    /// Get the admin of a group
    #[view]
    public fun get_admin(group_id: u64): address acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        group.admin
    }

    // =========================================================================
    // TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    fun test_init(admin: &signer) acquires State {
        init_for_testing(admin);
        assert!(get_groups_count() == 0, 0);
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_create_group(admin: &signer, creator: &signer) acquires State {
        init_for_testing(admin);
        
        create_group(creator);
        
        assert!(get_groups_count() == 1, 0);
        assert!(is_member(0, signer::address_of(creator)), 1);
        assert!(is_admin(0, signer::address_of(creator)), 2);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    fun test_join_group(admin: &signer, creator: &signer, user: &signer) acquires State {
        init_for_testing(admin);
        
        create_group(creator);
        join_group(user, 0);
        
        assert!(is_member(0, signer::address_of(user)), 0);
        assert!(!is_admin(0, signer::address_of(user)), 1);
        
        let members = get_members(0);
        assert!(vector::length(&members) == 2, 2);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    fun test_leave_group(admin: &signer, creator: &signer, user: &signer) acquires State {
        init_for_testing(admin);
        
        create_group(creator);
        join_group(user, 0);
        leave_group(user, 0);
        
        assert!(!is_member(0, signer::address_of(user)), 0);
        
        let members = get_members(0);
        assert!(vector::length(&members) == 1, 1);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = E_ALREADY_MEMBER)]
    fun test_join_twice_fails(admin: &signer, creator: &signer, user: &signer) acquires State {
        init_for_testing(admin);
        
        create_group(creator);
        join_group(user, 0);
        join_group(user, 0); // Should fail
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = E_NOT_MEMBER)]
    fun test_leave_without_joining_fails(admin: &signer, creator: &signer, user: &signer) acquires State {
        init_for_testing(admin);
        
        create_group(creator);
        leave_group(user, 0); // User never joined group 0, should fail with E_NOT_MEMBER
    }
}

