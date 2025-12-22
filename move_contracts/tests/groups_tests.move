/// ============================================================================
/// Groups Module Tests (V2 - Hybrid Architecture)
/// ============================================================================
///
/// Tests for the simplified groups module that only stores membership on-chain.
/// Profile and group metadata tests are now handled by Supabase integration tests.
///
/// ============================================================================

#[test_only]
module friend_fi::groups_tests {
    use std::signer;
    use std::vector;
    use friend_fi::groups;

    // =========================================================================
    // INITIALIZATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    fun test_initialization(admin: &signer) {
        groups::init_for_testing(admin);
        
        // Should start with 0 groups
        assert!(groups::get_groups_count() == 0, 0);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure(abort_code = 1)] // E_ALREADY_INITIALIZED
    fun test_double_initialization_fails(admin: &signer) {
        groups::init_for_testing(admin);
        groups::init_for_testing(admin); // Should fail
    }

    // =========================================================================
    // GROUP CREATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_create_group(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        
        // Create a group
        groups::create_group(creator);
        
        // Check group was created
        assert!(groups::get_groups_count() == 1, 0);
        
        // Creator should be a member
        let creator_addr = signer::address_of(creator);
        assert!(groups::is_member(0, creator_addr), 1);
        
        // Creator should be admin
        assert!(groups::is_admin(0, creator_addr), 2);
        
        // Check admin address
        assert!(groups::get_admin(0) == creator_addr, 3);
        
        // Check members list
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 1, 4);
        assert!(*vector::borrow(&members, 0) == creator_addr, 5);
    }

    #[test(admin = @friend_fi, creator1 = @0x123, creator2 = @0x456)]
    fun test_create_multiple_groups(admin: &signer, creator1: &signer, creator2: &signer) {
        groups::init_for_testing(admin);
        
        // Create two groups
        groups::create_group(creator1);
        groups::create_group(creator2);
        
        // Check both were created
        assert!(groups::get_groups_count() == 2, 0);
        
        // Check membership
        assert!(groups::is_member(0, signer::address_of(creator1)), 1);
        assert!(groups::is_member(1, signer::address_of(creator2)), 2);
        
        // Check they're not members of each other's groups
        assert!(!groups::is_member(0, signer::address_of(creator2)), 3);
        assert!(!groups::is_member(1, signer::address_of(creator1)), 4);
    }

    // =========================================================================
    // JOIN GROUP TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    fun test_join_group(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        // Create group
        groups::create_group(creator);
        
        // User joins
        groups::join_group(user, 0);
        
        // Check user is member
        let user_addr = signer::address_of(user);
        assert!(groups::is_member(0, user_addr), 0);
        
        // User is not admin
        assert!(!groups::is_admin(0, user_addr), 1);
        
        // Check members list
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 2, 2);
    }

    #[test(admin = @friend_fi, creator = @0x123, user1 = @0x456, user2 = @0x789)]
    fun test_multiple_users_join(admin: &signer, creator: &signer, user1: &signer, user2: &signer) {
        groups::init_for_testing(admin);
        
        // Create group
        groups::create_group(creator);
        
        // Two users join
        groups::join_group(user1, 0);
        groups::join_group(user2, 0);
        
        // Check all are members
        assert!(groups::is_member(0, signer::address_of(creator)), 0);
        assert!(groups::is_member(0, signer::address_of(user1)), 1);
        assert!(groups::is_member(0, signer::address_of(user2)), 2);
        
        // Check members count
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 3, 3);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = 12)] // E_ALREADY_MEMBER
    fun test_join_twice_fails(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        groups::create_group(creator);
        groups::join_group(user, 0);
        groups::join_group(user, 0); // Should fail
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = 10)] // E_BAD_GROUP_ID
    fun test_join_nonexistent_group_fails(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        groups::create_group(creator);
        groups::join_group(user, 999); // Should fail
    }

    // =========================================================================
    // LEAVE GROUP TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    fun test_leave_group(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        // Create and join
        groups::create_group(creator);
        groups::join_group(user, 0);
        
        // User leaves
        groups::leave_group(user, 0);
        
        // Check user is no longer member
        let user_addr = signer::address_of(user);
        assert!(!groups::is_member(0, user_addr), 0);
        
        // Check members list
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 1, 1);
        assert!(*vector::borrow(&members, 0) == signer::address_of(creator), 2);
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_creator_can_leave(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        
        // Create group
        groups::create_group(creator);
        
        // Creator leaves their own group
        groups::leave_group(creator, 0);
        
        // Check creator is no longer member
        assert!(!groups::is_member(0, signer::address_of(creator)), 0);
        
        // Group still exists but is empty
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 0, 1);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = 13)] // E_NOT_MEMBER
    fun test_leave_without_joining_fails(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        groups::create_group(creator);
        groups::leave_group(user, 0); // Should fail - never joined
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    #[expected_failure(abort_code = 13)] // E_NOT_MEMBER
    fun test_leave_twice_fails(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        groups::create_group(creator);
        groups::join_group(user, 0);
        groups::leave_group(user, 0);
        groups::leave_group(user, 0); // Should fail - already left
    }

    // =========================================================================
    // MEMBERSHIP QUERY TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_is_member_query(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        
        let creator_addr = signer::address_of(creator);
        let random_addr = @0x999;
        
        // Before group creation
        assert!(!groups::is_member(0, creator_addr), 0);
        
        // Create group
        groups::create_group(creator);
        
        // After group creation
        assert!(groups::is_member(0, creator_addr), 1);
        assert!(!groups::is_member(0, random_addr), 2);
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_is_admin_query(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        
        let creator_addr = signer::address_of(creator);
        let random_addr = @0x999;
        
        // Before group creation
        assert!(!groups::is_admin(0, creator_addr), 0);
        
        // Create group
        groups::create_group(creator);
        
        // After group creation
        assert!(groups::is_admin(0, creator_addr), 1);
        assert!(!groups::is_admin(0, random_addr), 2);
    }

    #[test(admin = @friend_fi, creator = @0x123, user = @0x456)]
    fun test_member_is_not_admin(admin: &signer, creator: &signer, user: &signer) {
        groups::init_for_testing(admin);
        
        groups::create_group(creator);
        groups::join_group(user, 0);
        
        let user_addr = signer::address_of(user);
        
        // User is member but not admin
        assert!(groups::is_member(0, user_addr), 0);
        assert!(!groups::is_admin(0, user_addr), 1);
    }

    // =========================================================================
    // EDGE CASE TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    fun test_queries_before_initialization() {
        // Should not crash, just return false/0
        assert!(groups::get_groups_count() == 0, 0);
        assert!(!groups::is_member(0, @0x123), 1);
        assert!(!groups::is_admin(0, @0x123), 2);
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    fun test_queries_for_invalid_group_id(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        groups::create_group(creator);
        
        // Query for non-existent group
        assert!(!groups::is_member(999, signer::address_of(creator)), 0);
        assert!(!groups::is_admin(999, signer::address_of(creator)), 1);
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    #[expected_failure(abort_code = 10)] // E_BAD_GROUP_ID
    fun test_get_members_invalid_group_fails(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        groups::create_group(creator);
        
        let _ = groups::get_members(999); // Should fail
    }

    #[test(admin = @friend_fi, creator = @0x123)]
    #[expected_failure(abort_code = 10)] // E_BAD_GROUP_ID
    fun test_get_admin_invalid_group_fails(admin: &signer, creator: &signer) {
        groups::init_for_testing(admin);
        groups::create_group(creator);
        
        let _ = groups::get_admin(999); // Should fail
    }

    // =========================================================================
    // INTEGRATION SCENARIO TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC4471E)]
    fun test_realistic_group_scenario(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer
    ) {
        groups::init_for_testing(admin);
        
        // Alice creates a group for a trip
        groups::create_group(alice);
        
        // Bob and Charlie join
        groups::join_group(bob, 0);
        groups::join_group(charlie, 0);
        
        // Verify all members
        let members = groups::get_members(0);
        assert!(vector::length(&members) == 3, 0);
        
        assert!(groups::is_member(0, signer::address_of(alice)), 1);
        assert!(groups::is_member(0, signer::address_of(bob)), 2);
        assert!(groups::is_member(0, signer::address_of(charlie)), 3);
        
        // Alice is admin, others are not
        assert!(groups::is_admin(0, signer::address_of(alice)), 4);
        assert!(!groups::is_admin(0, signer::address_of(bob)), 5);
        assert!(!groups::is_admin(0, signer::address_of(charlie)), 6);
        
        // Bob leaves the group
        groups::leave_group(bob, 0);
        
        // Verify Bob is gone
        assert!(!groups::is_member(0, signer::address_of(bob)), 7);
        
        let members_after = groups::get_members(0);
        assert!(vector::length(&members_after) == 2, 8);
    }

    #[test(admin = @friend_fi, user1 = @0x1, user2 = @0x2, user3 = @0x3, user4 = @0x4, user5 = @0x5)]
    fun test_multiple_groups_multiple_users(
        admin: &signer,
        user1: &signer,
        user2: &signer,
        user3: &signer,
        user4: &signer,
        user5: &signer
    ) {
        groups::init_for_testing(admin);
        
        // User1 creates Group A
        groups::create_group(user1);
        
        // User2 creates Group B
        groups::create_group(user2);
        
        // User3 creates Group C
        groups::create_group(user3);
        
        // Cross-join: User4 joins A and B, User5 joins B and C
        groups::join_group(user4, 0); // A
        groups::join_group(user4, 1); // B
        groups::join_group(user5, 1); // B
        groups::join_group(user5, 2); // C
        
        // Verify counts
        assert!(groups::get_groups_count() == 3, 0);
        
        // Verify Group A: User1 (admin), User4
        assert!(vector::length(&groups::get_members(0)) == 2, 1);
        assert!(groups::is_member(0, signer::address_of(user1)), 2);
        assert!(groups::is_member(0, signer::address_of(user4)), 3);
        
        // Verify Group B: User2 (admin), User4, User5
        assert!(vector::length(&groups::get_members(1)) == 3, 4);
        assert!(groups::is_member(1, signer::address_of(user2)), 5);
        assert!(groups::is_member(1, signer::address_of(user4)), 6);
        assert!(groups::is_member(1, signer::address_of(user5)), 7);
        
        // Verify Group C: User3 (admin), User5
        assert!(vector::length(&groups::get_members(2)) == 2, 8);
        assert!(groups::is_member(2, signer::address_of(user3)), 9);
        assert!(groups::is_member(2, signer::address_of(user5)), 10);
    }
}

