/// ============================================================================
/// Friend-Fi Shared Groups Module
/// ============================================================================
///
/// This module provides reusable group management functionality that can be
/// shared across multiple applications (prediction markets, expense splitting, etc.)
///
/// KEY FEATURES:
/// 1. Create password-protected groups
/// 2. Join groups with password verification
/// 3. Member management and tracking
/// 4. Profile/username registry with global uniqueness
/// 5. Event system for indexers
///
/// DESIGN:
/// - Groups are stored in a central registry under the module address
/// - Each group has a unique ID (index in the groups vector)
/// - Members can be part of multiple groups
/// - Usernames are globally unique across all users
///
/// ============================================================================

module friend_fi::groups {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::string::{String, bytes, utf8};
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

    /// Wrong password.
    const E_INVALID_PASSWORD: u64 = 11;

    /// Already a member.
    const E_ALREADY_MEMBER: u64 = 12;

    /// Not a member.
    const E_NOT_MEMBER: u64 = 13;

    /// Username already taken.
    const E_USERNAME_TAKEN: u64 = 14;

    /// Not the group admin.
    const E_NOT_GROUP_ADMIN: u64 = 15;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    /// Compare two strings for equality.
    fun strings_equal(a: &String, b: &String): bool {
        *bytes(a) == *bytes(b)
    }

    /// Clone a string.
    fun clone_string(s: &String): String {
        utf8(*bytes(s))
    }

    /// Hash password (just bytes for demo - NOT production secure).
    fun hash_password(p: &String): vector<u8> {
        *bytes(p)
    }

    // =========================================================================
    // CORE DATA STRUCTURES
    // =========================================================================

    /// A group with members and metadata.
    struct Group has store {
        /// Group display name.
        name: String,

        /// Password hash for joining (WARNING: readable on-chain, demo only).
        password_hash: vector<u8>,

        /// Admin who created the group (can manage settings).
        admin: address,

        /// List of member addresses.
        members: vector<address>,

        /// Optional description or metadata.
        description: String,
    }

    /// User profile for display.
    struct UserProfile has store {
        /// Unique username.
        name: String,

        /// Avatar ID (index into frontend avatar list).
        avatar_id: u64,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct ProfileUpdatedEvent has drop, store {
        user: address,
        name: String,
        avatar_id: u64,
    }

    #[event]
    struct GroupCreatedEvent has drop, store {
        group_id: u64,
        creator: address,
        name: String,
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

    /// Central registry for all groups and profiles.
    struct State has key {
        /// All groups. group_id = index in this vector.
        groups: vector<Group>,

        /// Profile registry: parallel arrays.
        profile_addrs: vector<address>,
        profiles: vector<UserProfile>,
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

    /// Find profile index by address.
    fun find_profile_index(state: &State, addr: address): (bool, u64) {
        let len = vector::length(&state.profile_addrs);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&state.profile_addrs, i) == addr) {
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
            profile_addrs: vector::empty<address>(),
            profiles: vector::empty<UserProfile>(),
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
            profile_addrs: vector::empty<address>(),
            profiles: vector::empty<UserProfile>(),
        });
    }

    // =========================================================================
    // PROFILE FUNCTIONS
    // =========================================================================

    /// Set or update your profile (username and avatar).
    /// Usernames must be globally unique.
    public entry fun set_profile(
        account: &signer,
        name: String,
        avatar_id: u64,
    ) acquires State {
        let user = signer::address_of(account);
        let state = borrow_state_mut();

        // Check username uniqueness
        let len = vector::length(&state.profile_addrs);
        let i = 0;
        while (i < len) {
            let addr_ref = vector::borrow(&state.profile_addrs, i);
            let prof_ref = vector::borrow(&state.profiles, i);
            if (*addr_ref != user && strings_equal(&prof_ref.name, &name)) {
                abort E_USERNAME_TAKEN
            };
            i = i + 1;
        };

        // Update or create profile
        let (found, idx) = find_profile_index(state, user);
        if (found) {
            let profile_ref = vector::borrow_mut(&mut state.profiles, idx);
            profile_ref.name = name;
            profile_ref.avatar_id = avatar_id;
        } else {
            vector::push_back(&mut state.profile_addrs, user);
            vector::push_back(&mut state.profiles, UserProfile { name, avatar_id });
        };

        let (_, idx2) = find_profile_index(state, user);
        let prof_ref2 = vector::borrow(&state.profiles, idx2);
        event::emit(ProfileUpdatedEvent {
            user,
            name: clone_string(&prof_ref2.name),
            avatar_id: prof_ref2.avatar_id,
        });
    }

    #[view]
    /// Get profile for an address.
    /// Returns (name, avatar_id, exists).
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
    /// Resolve username to address.
    /// Returns (address, found).
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
        (ADMIN_ADDR, false)
    }

    // =========================================================================
    // GROUP FUNCTIONS
    // =========================================================================

    /// Create a new group.
    /// Creator becomes admin and first member.
    /// Returns group_id via event.
    public entry fun create_group(
        account: &signer,
        name: String,
        password: String,
        description: String,
    ) acquires State {
        let creator = signer::address_of(account);
        let state = borrow_state_mut();

        let pwd_hash = hash_password(&password);
        let members = vector::empty<address>();
        vector::push_back(&mut members, creator);

        let group = Group {
            name: clone_string(&name),
            password_hash: pwd_hash,
            admin: creator,
            members,
            description,
        };

        let group_id = vector::length(&state.groups);
        vector::push_back(&mut state.groups, group);

        event::emit(GroupCreatedEvent {
            group_id,
            creator,
            name,
        });
    }

    /// Join an existing group with password.
    public entry fun join_group(
        account: &signer,
        group_id: u64,
        password: String,
    ) acquires State {
        let user = signer::address_of(account);
        let state = borrow_state_mut();
        let group = borrow_group_mut(state, group_id);

        // Verify password
        let expected = &group.password_hash;
        let provided = hash_password(&password);
        assert!(provided == *expected, E_INVALID_PASSWORD);

        // Check not already member
        let (is_mem, _) = find_member_index(group, user);
        assert!(!is_mem, E_ALREADY_MEMBER);

        // Add to group
        vector::push_back(&mut group.members, user);

        event::emit(GroupJoinedEvent { group_id, user });
    }

    /// Leave a group (remove yourself from members).
    public entry fun leave_group(
        account: &signer,
        group_id: u64,
    ) acquires State {
        let user = signer::address_of(account);
        let state = borrow_state_mut();
        let group = borrow_group_mut(state, group_id);

        let (is_mem, idx) = find_member_index(group, user);
        assert!(is_mem, E_NOT_MEMBER);

        vector::remove(&mut group.members, idx);

        event::emit(GroupLeftEvent { group_id, user });
    }

    // =========================================================================
    // PUBLIC HELPER FUNCTIONS (for other modules to use)
    // =========================================================================

    /// Check if user is member of group (for other modules to verify access).
    public fun is_member(group_id: u64, addr: address): bool acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        let (is_mem, _) = find_member_index(group, addr);
        is_mem
    }

    /// Get group admin address.
    public fun get_group_admin(group_id: u64): address acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        group.admin
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    #[view]
    /// Get all member addresses in a group.
    public fun get_group_members(group_id: u64): vector<address> acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);

        let res = vector::empty<address>();
        let len = vector::length(&group.members);
        let i = 0;
        while (i < len) {
            vector::push_back(&mut res, *vector::borrow(&group.members, i));
            i = i + 1;
        };
        res
    }

    #[view]
    /// Get number of groups.
    public fun get_groups_count(): u64 acquires State {
        let state = borrow_state();
        vector::length(&state.groups)
    }

    #[view]
    /// Get group name.
    public fun get_group_name(group_id: u64): String acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        clone_string(&group.name)
    }

    #[view]
    /// Get group description.
    public fun get_group_description(group_id: u64): String acquires State {
        let state = borrow_state();
        let group = borrow_group(state, group_id);
        clone_string(&group.description)
    }

    #[view]
    /// Check if address is member of group.
    public fun check_if_member_in_group(group_id: u64, member: address): bool acquires State {
        is_member(group_id, member)
    }
}

