/// ============================================================================
/// Friend-Fi Integration Tests
/// ============================================================================
///
/// These tests demonstrate how the modular architecture allows:
/// 1. One group to be used across multiple applications
/// 2. Users join once, use everywhere (predictions, expenses, future apps)
/// 3. Shared profile/username system
/// 4. Clean separation of concerns while maintaining cohesion
///
/// ============================================================================

#[test_only]
module friend_fi::integration_tests {
    use std::string::utf8;
    use std::vector;
    use friend_fi::groups;
    use friend_fi::expense_splitting;
    use friend_fi::private_prediction_refactored;

    const ADMIN: address = @friend_fi;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;

    /// Setup all three modules
    fun setup_all(admin: &signer) {
        groups::init_for_testing(admin);
        expense_splitting::init_for_testing(admin);
        private_prediction_refactored::init_for_testing(admin);
    }

    // =========================================================================
    // TEST: SHARED GROUP ACROSS PREDICTIONS AND EXPENSES
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_shared_group_predictions_and_expenses(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // =====================================================================
        // STEP 1: Create a group for a trip to Bali
        // =====================================================================
        
        groups::create_group(
            alice,
            utf8(b"Bali Trip 2025"),
            utf8(b"password123"),
            utf8(b"Friends vacation to Bali"),
        );

        // Bob and Charlie join
        groups::join_group(bob, 0, utf8(b"password123"));
        groups::join_group(charlie, 0, utf8(b"password123"));

        // Verify all members
        let members = groups::get_group_members(0);
        assert!(vector::length(&members) == 3, 0);

        // =====================================================================
        // STEP 2: Use the SAME group for predictions
        // =====================================================================

        // Create a bet: "Will it rain on our first day?"
        let outcomes = vector::empty<vector<u8>>();
        vector::push_back(&mut outcomes, b"Yes");
        vector::push_back(&mut outcomes, b"No");

        let outcomes_str = vector::empty<std::string::String>();
        vector::push_back(&mut outcomes_str, utf8(b"Yes"));
        vector::push_back(&mut outcomes_str, utf8(b"No"));

        private_prediction_refactored::create_bet(
            alice,
            0, // Same group_id!
            utf8(b"Will it rain on our first day?"),
            outcomes_str,
            @0xA11CE, // Alice is bet admin
            vector::empty<u8>(),
        );

        // Verify bet was created in the group
        let group_bets = private_prediction_refactored::get_group_bets(0);
        assert!(vector::length(&group_bets) == 1, 1);

        // =====================================================================
        // STEP 3: Use the SAME group for expense splitting
        // =====================================================================

        // Alice pays for the hotel
        let hotel_participants = vector::empty<address>();
        vector::push_back(&mut hotel_participants, @0xA11CE);
        vector::push_back(&mut hotel_participants, @0xB0B);
        vector::push_back(&mut hotel_participants, @0xC0C);

        expense_splitting::create_expense_equal(
            alice,
            0, // Same group_id!
            utf8(b"Hotel - 3 nights"),
            900, // $900 total
            hotel_participants,
        );

        // Verify expense was created
        assert!(expense_splitting::get_group_expenses_count(0) == 1, 2);

        // Bob and Charlie each owe Alice $300
        let bob_owes = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(bob_owes == 300, 3);

        // =====================================================================
        // STEP 4: Verify data isolation
        // =====================================================================

        // Predictions and expenses are separate but use the same group
        assert!(private_prediction_refactored::get_bets_count() == 1, 4);
        assert!(expense_splitting::get_group_expenses_count(0) == 1, 5);
        
        // Group membership check works for both
        assert!(groups::is_member(0, @0xA11CE), 6);
        assert!(groups::is_member(0, @0xB0B), 7);
        assert!(groups::is_member(0, @0xC0C), 8);
    }

    // =========================================================================
    // TEST: PROFILES SHARED ACROSS APPLICATIONS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_shared_profiles(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // Set up profiles once
        groups::set_profile(alice, utf8(b"alice_in_wonderland"), 1);
        groups::set_profile(bob, utf8(b"bob_the_builder"), 2);
        groups::set_profile(charlie, utf8(b"charlie_chocolate"), 3);

        // Create a group
        groups::create_group(
            alice,
            utf8(b"Weekend Hangout"),
            utf8(b"pass"),
            utf8(b"Weekend activities"),
        );
        groups::join_group(bob, 0, utf8(b"pass"));
        groups::join_group(charlie, 0, utf8(b"pass"));

        // Verify profiles are accessible
        let (alice_name, alice_avatar, alice_exists) = groups::get_profile(@0xA11CE);
        assert!(alice_exists, 0);
        assert!(alice_name == utf8(b"alice_in_wonderland"), 1);
        assert!(alice_avatar == 1, 2);

        // Profiles can be resolved by username
        let (resolved_addr, found) = groups::resolve_username(utf8(b"bob_the_builder"));
        assert!(found, 3);
        assert!(resolved_addr == @0xB0B, 4);

        // Same profiles are used when creating predictions
        private_prediction_refactored::create_bet(
            bob,
            0,
            utf8(b"Who will win the game?"),
            vector[utf8(b"Team A"), utf8(b"Team B")],
            @0xB0B,
            vector::empty<u8>(),
        );

        // And when creating expenses
        expense_splitting::create_expense_equal(
            charlie,
            0,
            utf8(b"Dinner"),
            60,
            vector[@0xA11CE, @0xB0B, @0xC0C],
        );

        // All activities use the same profile system
        let (bob_name2, _, _) = groups::get_profile(@0xB0B);
        assert!(bob_name2 == utf8(b"bob_the_builder"), 5);
    }

    // =========================================================================
    // TEST: MULTIPLE GROUPS WITH DIFFERENT PURPOSES
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_multiple_groups_different_apps(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // =====================================================================
        // Group 0: Prediction Market focused
        // =====================================================================
        
        groups::create_group(
            alice,
            utf8(b"Sports Betting Group"),
            utf8(b"sports123"),
            utf8(b"Weekly sports predictions"),
        );
        groups::join_group(bob, 0, utf8(b"sports123"));

        // Create multiple bets in this group
        private_prediction_refactored::create_bet(
            alice,
            0,
            utf8(b"Who wins the Super Bowl?"),
            vector[utf8(b"Chiefs"), utf8(b"Eagles")],
            @0xA11CE,
            vector::empty<u8>(),
        );

        private_prediction_refactored::create_bet(
            bob,
            0,
            utf8(b"NBA Finals winner?"),
            vector[utf8(b"Lakers"), utf8(b"Celtics"), utf8(b"Other")],
            @0xB0B,
            vector::empty<u8>(),
        );

        // =====================================================================
        // Group 1: Expense Splitting focused
        // =====================================================================

        groups::create_group(
            charlie,
            utf8(b"Apartment Roommates"),
            utf8(b"apt456"),
            utf8(b"Monthly rent and utilities"),
        );
        groups::join_group(alice, 1, utf8(b"apt456"));

        // Track apartment expenses in this group
        expense_splitting::create_expense_equal(
            charlie,
            1,
            utf8(b"Rent - January"),
            2000,
            vector[@0xA11CE, @0xC0C],
        );

        expense_splitting::create_expense_equal(
            alice,
            1,
            utf8(b"Utilities - January"),
            150,
            vector[@0xA11CE, @0xC0C],
        );

        // =====================================================================
        // Group 2: Mixed usage (both predictions and expenses)
        // =====================================================================

        groups::create_group(
            alice,
            utf8(b"Road Trip Crew"),
            utf8(b"trip789"),
            utf8(b"Road trip adventures"),
        );
        groups::join_group(bob, 2, utf8(b"trip789"));
        groups::join_group(charlie, 2, utf8(b"trip789"));

        // Make predictions about the trip
        private_prediction_refactored::create_bet(
            alice,
            2,
            utf8(b"Will we make it in under 6 hours?"),
            vector[utf8(b"Yes"), utf8(b"No")],
            @0xA11CE,
            vector::empty<u8>(),
        );

        // Split trip expenses
        expense_splitting::create_expense_equal(
            bob,
            2,
            utf8(b"Gas"),
            120,
            vector[@0xA11CE, @0xB0B, @0xC0C],
        );

        // =====================================================================
        // Verify isolation
        // =====================================================================

        // Group 0 has 2 bets, 0 expenses
        assert!(vector::length(&private_prediction_refactored::get_group_bets(0)) == 2, 0);
        assert!(expense_splitting::get_group_expenses_count(0) == 0, 1);

        // Group 1 has 0 bets, 2 expenses
        assert!(vector::length(&private_prediction_refactored::get_group_bets(1)) == 0, 2);
        assert!(expense_splitting::get_group_expenses_count(1) == 2, 3);

        // Group 2 has 1 bet, 1 expense (mixed usage!)
        assert!(vector::length(&private_prediction_refactored::get_group_bets(2)) == 1, 4);
        assert!(expense_splitting::get_group_expenses_count(2) == 1, 5);

        // Verify memberships are correct
        assert!(groups::check_if_member_in_group(0, @0xA11CE), 6);
        assert!(groups::check_if_member_in_group(0, @0xB0B), 7);
        assert!(!groups::check_if_member_in_group(0, @0xC0C), 8); // Charlie not in group 0

        assert!(groups::check_if_member_in_group(1, @0xA11CE), 9);
        assert!(groups::check_if_member_in_group(1, @0xC0C), 10);
        assert!(!groups::check_if_member_in_group(1, @0xB0B), 11); // Bob not in group 1
    }

    // =========================================================================
    // TEST: COMPLEX REAL-WORLD SCENARIO
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_complex_trip_scenario(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // Set up profiles
        groups::set_profile(alice, utf8(b"alice"), 1);
        groups::set_profile(bob, utf8(b"bob"), 2);
        groups::set_profile(charlie, utf8(b"charlie"), 3);

        // =====================================================================
        // SCENARIO: Weekend ski trip
        // =====================================================================

        // Create group
        groups::create_group(
            alice,
            utf8(b"Ski Trip Weekend"),
            utf8(b"ski2025"),
            utf8(b"Weekend ski trip with the crew"),
        );
        groups::join_group(bob, 0, utf8(b"ski2025"));
        groups::join_group(charlie, 0, utf8(b"ski2025"));

        // =====================================================================
        // Before the trip: Make predictions
        // =====================================================================

        // Bet 1: Weather prediction
        private_prediction_refactored::create_bet(
            alice,
            0,
            utf8(b"Will it snow this weekend?"),
            vector[utf8(b"Yes"), utf8(b"No")],
            @0xA11CE,
            vector::empty<u8>(),
        );

        // Bet 2: Activity prediction
        private_prediction_refactored::create_bet(
            bob,
            0,
            utf8(b"Who will fall the most?"),
            vector[utf8(b"Alice"), utf8(b"Bob"), utf8(b"Charlie")],
            @0xB0B,
            vector::empty<u8>(),
        );

        // Verify bets created
        assert!(vector::length(&private_prediction_refactored::get_group_bets(0)) == 2, 0);

        // =====================================================================
        // During the trip: Track expenses
        // =====================================================================

        // Alice books the cabin
        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Cabin rental"),
            600,
            vector[@0xA11CE, @0xB0B, @0xC0C],
        );

        // Bob pays for lift tickets (unequal split - Bob gets student discount)
        expense_splitting::create_expense_exact(
            bob,
            0,
            utf8(b"Lift tickets"),
            180,
            vector[@0xA11CE, @0xB0B, @0xC0C],
            vector[70, 50, 60], // Bob gets discount
        );

        // Charlie pays for group dinner
        expense_splitting::create_expense_equal(
            charlie,
            0,
            utf8(b"Dinner on Saturday"),
            90,
            vector[@0xA11CE, @0xB0B, @0xC0C],
        );

        // Alice pays for breakfast supplies
        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Breakfast groceries"),
            45,
            vector[@0xA11CE, @0xB0B, @0xC0C],
        );

        // =====================================================================
        // After the trip: Check balances
        // =====================================================================

        // Total expenses tracked
        assert!(expense_splitting::get_group_expenses_count(0) == 4, 1);

        // Calculate who owes whom
        // Alice paid: 600 + 45 = 645
        // Bob paid: 180
        // Charlie paid: 90
        // Total: 915
        
        // Alice's share: 200 (cabin) + 70 (lift) + 30 (dinner) + 15 (breakfast) = 315
        // Alice should be owed: 645 - 315 = 330
        let (alice_balance, alice_is_owed) = expense_splitting::get_user_balance(0, @0xA11CE);
        assert!(alice_is_owed, 2);
        assert!(alice_balance == 330, 3);

        // =====================================================================
        // Verify both systems work independently but share the group
        // =====================================================================

        // Group has both predictions and expenses
        assert!(vector::length(&private_prediction_refactored::get_group_bets(0)) == 2, 4);
        assert!(expense_splitting::get_group_expenses_count(0) == 4, 5);

        // All members are in the same group for both
        let members = groups::get_group_members(0);
        assert!(vector::length(&members) == 3, 6);

        // Profiles work across both systems
        let (alice_name, _, _) = groups::get_profile(@0xA11CE);
        assert!(alice_name == utf8(b"alice"), 7);
    }

    // =========================================================================
    // TEST: ACCESS CONTROL USING SHARED GROUPS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    #[expected_failure(abort_code = 14)] // E_NOT_MEMBER
    fun test_non_member_cannot_create_bet(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // Alice creates a group
        groups::create_group(
            alice,
            utf8(b"Private Group"),
            utf8(b"secret"),
            utf8(b"Private betting group"),
        );

        // Bob joins
        groups::join_group(bob, 0, utf8(b"secret"));

        // Charlie is NOT a member and tries to create a bet
        // This should fail with E_NOT_MEMBER
        private_prediction_refactored::create_bet(
            charlie,
            0,
            utf8(b"Unauthorized bet"),
            vector[utf8(b"Yes"), utf8(b"No")],
            @0xC0C,
            vector::empty<u8>(),
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    #[expected_failure(abort_code = 11)] // E_NOT_GROUP_MEMBER
    fun test_non_member_cannot_create_expense(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // Alice creates a group
        groups::create_group(
            alice,
            utf8(b"Private Group"),
            utf8(b"secret"),
            utf8(b"Private expense group"),
        );

        // Bob joins
        groups::join_group(bob, 0, utf8(b"secret"));

        // Charlie is NOT a member and tries to create an expense
        // This should fail with E_NOT_GROUP_MEMBER
        expense_splitting::create_expense_equal(
            charlie,
            0,
            utf8(b"Unauthorized expense"),
            100,
            vector[@0xA11CE, @0xC0C],
        );
    }

    // =========================================================================
    // TEST: MEMBER CAN USE GROUP AFTER JOINING
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_join_once_use_everywhere(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup_all(admin);

        // Alice creates group
        groups::create_group(
            alice,
            utf8(b"Multi-Purpose Group"),
            utf8(b"pass"),
            utf8(b"For everything"),
        );

        // Charlie joins the group ONCE
        groups::join_group(charlie, 0, utf8(b"pass"));

        // Now Charlie can immediately use BOTH predictions and expenses
        
        // Create a bet
        private_prediction_refactored::create_bet(
            charlie,
            0,
            utf8(b"Charlie's prediction"),
            vector[utf8(b"Option A"), utf8(b"Option B")],
            @0xC0C,
            vector::empty<u8>(),
        );

        // Create an expense
        expense_splitting::create_expense_equal(
            charlie,
            0,
            utf8(b"Charlie's expense"),
            100,
            vector[@0xA11CE, @0xC0C],
        );

        // Both operations succeeded!
        assert!(vector::length(&private_prediction_refactored::get_group_bets(0)) == 1, 0);
        assert!(expense_splitting::get_group_expenses_count(0) == 1, 1);
    }
}

