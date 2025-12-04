// ============================================================================
// Unit Tests for Friend-Fi Private Prediction Market Module
// ============================================================================
//
// These tests cover:
// - Initialization (test-only without USDC)
// - Profile/Username management
// - Group creation and joining
// - Bet creation
// - Access control and error cases
//
// Note: Tests involving USDC transfers (place_wager, resolve_bet, withdraw_fees)
// require integration tests on testnet as unit tests cannot access external
// fungible assets.
// ============================================================================

#[test_only]
module friend_fi::private_prediction_tests {
    use std::string::utf8;
    use std::vector;
    
    use friend_fi::private_prediction_market;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    #[test_only]
    // Initialize the contract for testing (without USDC escrow)
    fun setup_test(admin: &signer) {
        private_prediction_market::init_for_testing(admin);
    }

    // =========================================================================
    // INITIALIZATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    // Test successful initialization
    fun test_init_success(admin: signer) {
        private_prediction_market::init_for_testing(&admin);
        
        // Verify state is initialized by checking counts
        let groups_count = private_prediction_market::get_groups_count();
        let bets_count = private_prediction_market::get_bets_count();
        
        assert!(groups_count == 0, 0);
        assert!(bets_count == 0, 1);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure(abort_code = 1, location = friend_fi::private_prediction_market)]
    // Test that double initialization fails (E_ALREADY_INITIALIZED = 1)
    fun test_init_double_fails(admin: signer) {
        private_prediction_market::init_for_testing(&admin);
        private_prediction_market::init_for_testing(&admin); // Should fail
    }

    #[test(non_admin = @0x1234)]
    #[expected_failure(abort_code = 2, location = friend_fi::private_prediction_market)]
    // Test that non-admin cannot initialize (E_NOT_ADMIN = 2)
    fun test_init_non_admin_fails(non_admin: signer) {
        private_prediction_market::init_for_testing(&non_admin); // Should fail
    }

    // =========================================================================
    // PROFILE / USERNAME TESTS
    // =========================================================================

    #[test(admin = @friend_fi, user = @0x1001)]
    // Test setting a new profile
    fun test_set_profile_new(admin: signer, user: signer) {
        setup_test(&admin);
        
        let username = utf8(b"alice");
        let avatar_id = 5;
        
        private_prediction_market::set_profile(&user, username, avatar_id);
        
        // Verify profile was set
        let (_name, avatar, exists) = private_prediction_market::get_profile(@0x1001);
        assert!(exists, 0);
        assert!(avatar == 5, 1);
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // Test updating an existing profile
    fun test_set_profile_update(admin: signer, user: signer) {
        setup_test(&admin);
        
        // Set initial profile
        private_prediction_market::set_profile(&user, utf8(b"alice"), 1);
        
        // Update profile
        private_prediction_market::set_profile(&user, utf8(b"alice_updated"), 10);
        
        // Verify update
        let (_, avatar, exists) = private_prediction_market::get_profile(@0x1001);
        assert!(exists, 0);
        assert!(avatar == 10, 1);
    }

    #[test(admin = @friend_fi, user1 = @0x1001, user2 = @0x1002)]
    #[expected_failure(abort_code = 20, location = friend_fi::private_prediction_market)]
    // Test that duplicate usernames are rejected (E_USERNAME_TAKEN = 20)
    fun test_set_profile_duplicate_username_fails(admin: signer, user1: signer, user2: signer) {
        setup_test(&admin);
        
        // User1 takes the username
        private_prediction_market::set_profile(&user1, utf8(b"unique_name"), 1);
        
        // User2 tries to use the same username - should fail
        private_prediction_market::set_profile(&user2, utf8(b"unique_name"), 2);
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // Test that user can keep their own username when updating
    fun test_set_profile_keep_own_username(admin: signer, user: signer) {
        setup_test(&admin);
        
        private_prediction_market::set_profile(&user, utf8(b"myname"), 1);
        
        // User updates avatar but keeps same name - should work
        private_prediction_market::set_profile(&user, utf8(b"myname"), 5);
        
        let (_, avatar, _) = private_prediction_market::get_profile(@0x1001);
        assert!(avatar == 5, 0);
    }

    #[test(admin = @friend_fi)]
    // Test get_profile for non-existent user
    fun test_get_profile_not_exists(admin: signer) {
        setup_test(&admin);
        
        let (_, _, exists) = private_prediction_market::get_profile(@0x9999);
        assert!(!exists, 0);
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // Test username resolution
    fun test_resolve_username(admin: signer, user: signer) {
        setup_test(&admin);
        
        private_prediction_market::set_profile(&user, utf8(b"findme"), 1);
        
        let (addr, found) = private_prediction_market::resolve_username(utf8(b"findme"));
        assert!(found, 0);
        assert!(addr == @0x1001, 1);
    }

    #[test(admin = @friend_fi)]
    // Test username resolution for non-existent name
    fun test_resolve_username_not_found(admin: signer) {
        setup_test(&admin);
        
        let (_, found) = private_prediction_market::resolve_username(utf8(b"nonexistent"));
        assert!(!found, 0);
    }

    // =========================================================================
    // GROUP TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating a new group
    fun test_create_group(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Crypto Degens"),
            utf8(b"secret123")
        );
        
        // Verify group was created
        let groups_count = private_prediction_market::get_groups_count();
        assert!(groups_count == 1, 0);
        
        // Verify creator is a member
        let is_member = private_prediction_market::check_if_member_in_group(0, @0x1001);
        assert!(is_member, 1);
        
        // Verify members list
        let members = private_prediction_market::get_group_members(0);
        assert!(vector::length(&members) == 1, 2);
        assert!(*vector::borrow(&members, 0) == @0x1001, 3);
    }

    #[test(admin = @friend_fi, creator = @0x1001, joiner = @0x1002)]
    // Test joining a group with correct password
    fun test_join_group_success(admin: signer, creator: signer, joiner: signer) {
        setup_test(&admin);
        
        // Create group
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        // Join group
        private_prediction_market::join_group(
            &joiner,
            0, // group_id
            utf8(b"password")
        );
        
        // Verify joiner is now a member
        let is_member = private_prediction_market::check_if_member_in_group(0, @0x1002);
        assert!(is_member, 0);
        
        // Verify members count
        let members = private_prediction_market::get_group_members(0);
        assert!(vector::length(&members) == 2, 1);
    }

    #[test(admin = @friend_fi, creator = @0x1001, joiner = @0x1002)]
    #[expected_failure(abort_code = 12, location = friend_fi::private_prediction_market)]
    // Test joining with wrong password fails (E_INVALID_PASSWORD = 12)
    fun test_join_group_wrong_password(admin: signer, creator: signer, joiner: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"correct_password")
        );
        
        // Try to join with wrong password
        private_prediction_market::join_group(
            &joiner,
            0,
            utf8(b"wrong_password")
        );
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    #[expected_failure(abort_code = 13, location = friend_fi::private_prediction_market)]
    // Test joining a group twice fails (E_ALREADY_MEMBER = 13)
    fun test_join_group_already_member(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        // Creator tries to join again (they're already a member from creation)
        private_prediction_market::join_group(
            &creator,
            0,
            utf8(b"password")
        );
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    #[expected_failure(abort_code = 10, location = friend_fi::private_prediction_market)]
    // Test joining non-existent group fails (E_BAD_GROUP_ID = 10)
    fun test_join_group_invalid_id(admin: signer, user: signer) {
        setup_test(&admin);
        
        private_prediction_market::join_group(
            &user,
            999, // non-existent group
            utf8(b"password")
        );
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_group_bets returns empty for new group
    fun test_get_group_bets_empty(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        let bets = private_prediction_market::get_group_bets(0);
        assert!(vector::length(&bets) == 0, 0);
    }

    #[test(admin = @friend_fi)]
    // Test check_if_member returns false for non-member
    fun test_check_if_member_not_member(admin: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &admin,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        let is_member = private_prediction_market::check_if_member_in_group(0, @0x9999);
        assert!(!is_member, 0);
    }

    // =========================================================================
    // BET CREATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating a bet with two outcomes
    fun test_create_bet_success(admin: signer, creator: signer) {
        setup_test(&admin);
        
        // Create group first
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        // Create bet
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(
            &creator,
            0, // group_id
            utf8(b"Will BTC reach 100k?"),
            outcomes,
            @0x1001 // admin (bet resolver)
        );
        
        // Verify bet was created
        let bets_count = private_prediction_market::get_bets_count();
        assert!(bets_count == 1, 0);
        
        // Verify bet is linked to group
        let group_bets = private_prediction_market::get_group_bets(0);
        assert!(vector::length(&group_bets) == 1, 1);
        assert!(*vector::borrow(&group_bets, 0) == 0, 2);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating a bet with multiple outcomes
    fun test_create_bet_multiple_outcomes(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Team A"));
        vector::push_back(&mut outcomes, utf8(b"Team B"));
        vector::push_back(&mut outcomes, utf8(b"Draw"));
        
        private_prediction_market::create_bet(
            &creator,
            0,
            utf8(b"Who wins the match?"),
            outcomes,
            @0x1001
        );
        
        // Verify outcome count
        let outcome_count = private_prediction_market::get_bet_outcomes_length(0);
        assert!(outcome_count == 3, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    #[expected_failure(abort_code = 15, location = friend_fi::private_prediction_market)]
    // Test creating bet with less than 2 outcomes fails (E_NEED_AT_LEAST_TWO_OUTCOMES = 15)
    fun test_create_bet_insufficient_outcomes(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        // Only one outcome - should fail
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Only Option"));
        
        private_prediction_market::create_bet(
            &creator,
            0,
            utf8(b"Bad bet"),
            outcomes,
            @0x1001
        );
    }

    #[test(admin = @friend_fi, creator = @0x1001, non_member = @0x1002)]
    #[expected_failure(abort_code = 14, location = friend_fi::private_prediction_market)]
    // Test non-member cannot create bet (E_NOT_MEMBER = 14)
    fun test_create_bet_not_member(admin: signer, creator: signer, non_member: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(
            &creator,
            utf8(b"Test Group"),
            utf8(b"password")
        );
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        // Non-member tries to create bet - should fail
        private_prediction_market::create_bet(
            &non_member,
            0,
            utf8(b"Unauthorized bet"),
            outcomes,
            @0x1002
        );
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    #[expected_failure(abort_code = 10, location = friend_fi::private_prediction_market)]
    // Test creating bet for non-existent group fails (E_BAD_GROUP_ID = 10)
    fun test_create_bet_invalid_group(admin: signer, creator: signer) {
        setup_test(&admin);
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(
            &creator,
            999, // non-existent group
            utf8(b"Bad bet"),
            outcomes,
            @0x1001
        );
    }

    // =========================================================================
    // BET VIEW FUNCTION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_bet_admin
    fun test_get_bet_admin(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        // Set a different admin for the bet
        private_prediction_market::create_bet(
            &creator,
            0,
            utf8(b"Test bet"),
            outcomes,
            @0x9999 // Different admin
        );
        
        let bet_admin = private_prediction_market::get_bet_admin(0);
        assert!(bet_admin == @0x9999, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_bet_total_pool returns 0 for new bet
    fun test_get_bet_total_pool_empty(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        let pool = private_prediction_market::get_bet_total_pool(0);
        assert!(pool == 0, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test is_bet_resolved returns false for new bet
    fun test_is_bet_resolved_new_bet(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        let resolved = private_prediction_market::is_bet_resolved(0);
        assert!(!resolved, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_bet_outcome_pool returns 0 for each outcome
    fun test_get_bet_outcome_pool_empty(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        let pool0 = private_prediction_market::get_bet_outcome_pool(0, 0);
        let pool1 = private_prediction_market::get_bet_outcome_pool(0, 1);
        
        assert!(pool0 == 0, 0);
        assert!(pool1 == 0, 1);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    #[expected_failure(abort_code = 16, location = friend_fi::private_prediction_market)]
    // Test get_bet_outcome with invalid index fails (E_INVALID_OUTCOME_INDEX = 16)
    fun test_get_bet_outcome_invalid_index(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        // Index 2 doesn't exist (only 0 and 1)
        let _ = private_prediction_market::get_bet_outcome(0, 2);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_user_wager returns 0 for user who hasn't wagered
    fun test_get_user_wager_no_wager(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        let wager = private_prediction_market::get_user_wager(0, @0x9999);
        assert!(wager == 0, 0);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure(abort_code = 11, location = friend_fi::private_prediction_market)]
    // Test accessing non-existent bet fails (E_BAD_BET_ID = 11)
    fun test_get_bet_invalid_id(admin: signer) {
        setup_test(&admin);
        
        // No bets created, try to access bet 0
        let _ = private_prediction_market::get_bet_admin(0);
    }

    // =========================================================================
    // MULTIPLE GROUPS & BETS TESTS
    // =========================================================================

    #[test(admin = @friend_fi, user1 = @0x1001, user2 = @0x1002)]
    // Test creating multiple groups
    fun test_multiple_groups(admin: signer, user1: signer, user2: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&user1, utf8(b"Group 1"), utf8(b"pwd1"));
        private_prediction_market::create_group(&user2, utf8(b"Group 2"), utf8(b"pwd2"));
        private_prediction_market::create_group(&user1, utf8(b"Group 3"), utf8(b"pwd3"));
        
        let count = private_prediction_market::get_groups_count();
        assert!(count == 3, 0);
        
        // user1 is in groups 0 and 2, user2 is in group 1
        assert!(private_prediction_market::check_if_member_in_group(0, @0x1001), 1);
        assert!(private_prediction_market::check_if_member_in_group(1, @0x1002), 2);
        assert!(private_prediction_market::check_if_member_in_group(2, @0x1001), 3);
        assert!(!private_prediction_market::check_if_member_in_group(0, @0x1002), 4);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating multiple bets in one group
    fun test_multiple_bets_in_group(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Bet 1"), outcomes, @0x1001);
        private_prediction_market::create_bet(&creator, 0, utf8(b"Bet 2"), outcomes, @0x1001);
        private_prediction_market::create_bet(&creator, 0, utf8(b"Bet 3"), outcomes, @0x1001);
        
        let bets_count = private_prediction_market::get_bets_count();
        assert!(bets_count == 3, 0);
        
        let group_bets = private_prediction_market::get_group_bets(0);
        assert!(vector::length(&group_bets) == 3, 1);
    }

    #[test(admin = @friend_fi, user1 = @0x1001, user2 = @0x1002)]
    // Test bets across different groups
    fun test_bets_across_groups(admin: signer, user1: signer, user2: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&user1, utf8(b"Group 1"), utf8(b"pwd1"));
        private_prediction_market::create_group(&user2, utf8(b"Group 2"), utf8(b"pwd2"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        // Create bet in group 0
        private_prediction_market::create_bet(&user1, 0, utf8(b"Bet in G1"), outcomes, @0x1001);
        
        // Create bet in group 1
        private_prediction_market::create_bet(&user2, 1, utf8(b"Bet in G2"), outcomes, @0x1002);
        
        // Verify each group has its own bet
        let g1_bets = private_prediction_market::get_group_bets(0);
        let g2_bets = private_prediction_market::get_group_bets(1);
        
        assert!(vector::length(&g1_bets) == 1, 0);
        assert!(vector::length(&g2_bets) == 1, 1);
        assert!(*vector::borrow(&g1_bets, 0) == 0, 2);
        assert!(*vector::borrow(&g2_bets, 0) == 1, 3);
    }

    // =========================================================================
    // GROUP MEMBERSHIP FLOW TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001, member1 = @0x1002, member2 = @0x1003)]
    // Test complete group membership flow
    fun test_group_membership_flow(
        admin: signer, 
        creator: signer, 
        member1: signer, 
        member2: signer
    ) {
        setup_test(&admin);
        
        // Creator makes group
        private_prediction_market::create_group(&creator, utf8(b"Friends"), utf8(b"secret"));
        
        // Members join
        private_prediction_market::join_group(&member1, 0, utf8(b"secret"));
        private_prediction_market::join_group(&member2, 0, utf8(b"secret"));
        
        // Verify all are members
        let members = private_prediction_market::get_group_members(0);
        assert!(vector::length(&members) == 3, 0);
        
        assert!(private_prediction_market::check_if_member_in_group(0, @0x1001), 1);
        assert!(private_prediction_market::check_if_member_in_group(0, @0x1002), 2);
        assert!(private_prediction_market::check_if_member_in_group(0, @0x1003), 3);
    }

    // =========================================================================
    // EDGE CASE TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating group with empty name (allowed)
    fun test_create_group_empty_name(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b""), utf8(b"pwd"));
        
        let count = private_prediction_market::get_groups_count();
        assert!(count == 1, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test creating bet with empty description (allowed)
    fun test_create_bet_empty_description(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b""), outcomes, @0x1001);
        
        let count = private_prediction_market::get_bets_count();
        assert!(count == 1, 0);
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // Test setting profile with empty username
    fun test_set_profile_empty_name(admin: signer, user: signer) {
        setup_test(&admin);
        
        private_prediction_market::set_profile(&user, utf8(b""), 0);
        
        let (_, _, exists) = private_prediction_market::get_profile(@0x1001);
        assert!(exists, 0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test bet with many outcomes
    fun test_create_bet_many_outcomes(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Option 1"));
        vector::push_back(&mut outcomes, utf8(b"Option 2"));
        vector::push_back(&mut outcomes, utf8(b"Option 3"));
        vector::push_back(&mut outcomes, utf8(b"Option 4"));
        vector::push_back(&mut outcomes, utf8(b"Option 5"));
        vector::push_back(&mut outcomes, utf8(b"Option 6"));
        vector::push_back(&mut outcomes, utf8(b"Option 7"));
        vector::push_back(&mut outcomes, utf8(b"Option 8"));
        vector::push_back(&mut outcomes, utf8(b"Option 9"));
        vector::push_back(&mut outcomes, utf8(b"Option 10"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Many options"), outcomes, @0x1001);
        
        let outcome_count = private_prediction_market::get_bet_outcomes_length(0);
        assert!(outcome_count == 10, 0);
    }

    // =========================================================================
    // BET OUTCOME LABEL TESTS
    // =========================================================================

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test getting bet outcome labels
    fun test_get_bet_outcome_labels(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        vector::push_back(&mut outcomes, utf8(b"Maybe"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        // Just verify we can retrieve them without error
        let _outcome0 = private_prediction_market::get_bet_outcome(0, 0);
        let _outcome1 = private_prediction_market::get_bet_outcome(0, 1);
        let _outcome2 = private_prediction_market::get_bet_outcome(0, 2);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // Test get_winning_outcome returns 0 for unresolved bet
    fun test_get_winning_outcome_unresolved(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"Group"), utf8(b"pwd"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"Yes"));
        vector::push_back(&mut outcomes, utf8(b"No"));
        
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0x1001);
        
        // Returns 0 by default (even though bet isn't resolved)
        let winning = private_prediction_market::get_winning_outcome(0);
        assert!(winning == 0, 0);
    }

    // =========================================================================
    // SANITY CHECK TESTS - Verify tests are not false positives
    // =========================================================================

    #[test(admin = @friend_fi)]
    // SANITY: Verify state actually changes after creating groups
    fun sanity_state_changes_on_group_creation(admin: signer) {
        setup_test(&admin);
        
        // Before: 0 groups
        let count_before = private_prediction_market::get_groups_count();
        assert!(count_before == 0, 0);
        
        // Create a group
        private_prediction_market::create_group(&admin, utf8(b"Test"), utf8(b"pwd"));
        
        // After: 1 group - state MUST have changed
        let count_after = private_prediction_market::get_groups_count();
        assert!(count_after == 1, 1);
        assert!(count_after != count_before, 2); // Explicitly verify change
    }

    #[test(admin = @friend_fi)]
    // SANITY: Verify state actually changes after creating bets
    fun sanity_state_changes_on_bet_creation(admin: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&admin, utf8(b"G"), utf8(b"p"));
        
        let count_before = private_prediction_market::get_bets_count();
        assert!(count_before == 0, 0);
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"A"));
        vector::push_back(&mut outcomes, utf8(b"B"));
        private_prediction_market::create_bet(&admin, 0, utf8(b"Test"), outcomes, @friend_fi);
        
        let count_after = private_prediction_market::get_bets_count();
        assert!(count_after == 1, 1);
        assert!(count_after > count_before, 2);
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // SANITY: Verify membership actually works
    fun sanity_membership_is_real(admin: signer, user: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&admin, utf8(b"G"), utf8(b"pwd"));
        
        // User is NOT a member yet
        let before = private_prediction_market::check_if_member_in_group(0, @0x1001);
        assert!(!before, 0);
        
        // User joins
        private_prediction_market::join_group(&user, 0, utf8(b"pwd"));
        
        // User IS now a member
        let after = private_prediction_market::check_if_member_in_group(0, @0x1001);
        assert!(after, 1);
        assert!(before != after, 2); // State changed
    }

    #[test(admin = @friend_fi, user = @0x1001)]
    // SANITY: Verify profile exists/not exists is accurate
    fun sanity_profile_existence_is_real(admin: signer, user: signer) {
        setup_test(&admin);
        
        // Profile does NOT exist
        let (_, _, exists_before) = private_prediction_market::get_profile(@0x1001);
        assert!(!exists_before, 0);
        
        // Create profile
        private_prediction_market::set_profile(&user, utf8(b"name"), 1);
        
        // Profile DOES exist now
        let (_, avatar, exists_after) = private_prediction_market::get_profile(@0x1001);
        assert!(exists_after, 1);
        assert!(avatar == 1, 2);
        assert!(exists_before != exists_after, 3);
    }

    #[test(admin = @friend_fi)]
    // SANITY: Verify group_bets tracking works
    fun sanity_group_bets_tracking(admin: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&admin, utf8(b"G"), utf8(b"p"));
        
        // Initially empty
        let bets_before = private_prediction_market::get_group_bets(0);
        assert!(vector::length(&bets_before) == 0, 0);
        
        // Add a bet
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"A"));
        vector::push_back(&mut outcomes, utf8(b"B"));
        private_prediction_market::create_bet(&admin, 0, utf8(b"Bet"), outcomes, @friend_fi);
        
        // Now has 1 bet
        let bets_after = private_prediction_market::get_group_bets(0);
        assert!(vector::length(&bets_after) == 1, 1);
        
        // The bet ID should be 0
        assert!(*vector::borrow(&bets_after, 0) == 0, 2);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure] // This SHOULD fail - wrong password
    // SANITY: Verify password check actually works (this must fail!)
    fun sanity_wrong_password_must_fail(admin: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&admin, utf8(b"G"), utf8(b"correct"));
        
        // Try wrong password - MUST fail
        private_prediction_market::join_group(&admin, 0, utf8(b"wrong"));
    }

    #[test(admin = @friend_fi)]
    #[expected_failure] // This SHOULD fail - group doesn't exist
    // SANITY: Verify group ID validation works (this must fail!)
    fun sanity_invalid_group_must_fail(admin: signer) {
        setup_test(&admin);
        
        // No groups created, try to access group 0
        let _ = private_prediction_market::get_group_members(0);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure] // This SHOULD fail - bet doesn't exist
    // SANITY: Verify bet ID validation works (this must fail!)
    fun sanity_invalid_bet_must_fail(admin: signer) {
        setup_test(&admin);
        
        // No bets created, try to access bet 0
        let _ = private_prediction_market::get_bet_total_pool(0);
    }

    #[test(admin = @friend_fi, creator = @0x1001)]
    // SANITY: Verify bet admin is correctly stored
    fun sanity_bet_admin_stored_correctly(admin: signer, creator: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&creator, utf8(b"G"), utf8(b"p"));
        
        let outcomes = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes, utf8(b"A"));
        vector::push_back(&mut outcomes, utf8(b"B"));
        
        // Set bet admin to a specific address
        private_prediction_market::create_bet(&creator, 0, utf8(b"Test"), outcomes, @0xABCD);
        
        // Verify it's stored correctly
        let stored_admin = private_prediction_market::get_bet_admin(0);
        assert!(stored_admin == @0xABCD, 0);
        assert!(stored_admin != @0x1001, 1); // Not the creator
    }

    #[test(admin = @friend_fi)]
    // SANITY: Verify members list grows correctly
    fun sanity_members_list_grows(admin: signer) {
        setup_test(&admin);
        
        private_prediction_market::create_group(&admin, utf8(b"G"), utf8(b"p"));
        
        // Admin is automatically added
        let members = private_prediction_market::get_group_members(0);
        assert!(vector::length(&members) == 1, 0);
        assert!(*vector::borrow(&members, 0) == @friend_fi, 1);
    }
}
