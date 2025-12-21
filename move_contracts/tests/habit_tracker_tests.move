#[test_only]
module friend_fi::habit_tracker_tests {
    use std::string::utf8;
    use std::vector;
    use friend_fi::groups;
    use friend_fi::habit_tracker;
    use aptos_framework::timestamp;

    // Test addresses
    const ADMIN: address = @friend_fi;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;
    const DAVE: address = @0xDADE;

    /// Setup helper: Initialize modules and create a test group with Alice and Bob
    fun setup(admin: &signer, alice: &signer, bob: &signer) {
        // Initialize both modules
        groups::init_for_testing(admin);
        habit_tracker::init_for_testing(admin);

        // Create a test group
        groups::create_group(
            alice,
            utf8(b"Gym Buddies"),
            utf8(b"password"),
            utf8(b"Accountability group for fitness"),
        );

        // Bob joins
        groups::join_group(bob, 0, utf8(b"password"));
    }

    // =========================================================================
    // INITIALIZATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    fun test_init(admin: &signer) {
        groups::init_for_testing(admin);
        habit_tracker::init_for_testing(admin);
        
        assert!(habit_tracker::get_group_commitments_count(0) == 0, 0);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure(abort_code = 1)] // E_ALREADY_INITIALIZED
    fun test_double_init_fails(admin: &signer) {
        groups::init_for_testing(admin);
        habit_tracker::init_for_testing(admin);
        habit_tracker::init_for_testing(admin);
    }

    // =========================================================================
    // COMMITMENT CREATION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_create_commitment(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0, // group_id
            @0xB0B, // participant_b
            100, // weekly_payout (in USDC units, e.g., 100 = $1.00)
            3, // weekly_check_ins_required
            4, // duration_weeks
            utf8(b"Morning Gym Commitment"),
        );

        // Check commitment was created
        assert!(habit_tracker::get_group_commitments_count(0) == 1, 0);

        // Verify commitment details
        let (participant_a, participant_b, weekly_payout, duration_weeks, accepted, valid, name, _, check_ins_required) 
            = habit_tracker::get_commitment_details(0, 0);
        
        assert!(participant_a == @0xA11CE, 1);
        assert!(participant_b == @0xB0B, 2);
        assert!(weekly_payout == 100, 3);
        assert!(duration_weeks == 4, 4);
        assert!(!accepted, 5); // Not yet accepted
        assert!(valid, 6);
        assert!(name == utf8(b"Morning Gym Commitment"), 7);
        assert!(check_ins_required == 3, 8);

        // Alice should have this commitment in her list
        let alice_commitments = habit_tracker::get_user_commitments(0, @0xA11CE);
        assert!(vector::length(&alice_commitments) == 1, 9);
        assert!(*vector::borrow(&alice_commitments, 0) == 0, 10);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 27)] // E_BOTH_MUST_BE_GROUP_MEMBERS
    fun test_create_commitment_non_member_fails(admin: &signer, alice: &signer, bob: &signer) {
        setup(admin, alice, bob);

        // Try to create commitment with Charlie who is not in the group
        habit_tracker::create_commitment(
            alice,
            0,
            @0xC0C, // Charlie is not a member
            100,
            3,
            4,
            utf8(b"Invalid Commitment"),
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 12)] // E_INVALID_DURATION
    fun test_create_commitment_zero_weeks_fails(admin: &signer, alice: &signer, bob: &signer) {
        setup(admin, alice, bob);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            0, // Invalid: 0 weeks
            utf8(b"Invalid Commitment"),
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 13)] // E_INVALID_CHECK_INS_REQUIRED
    fun test_create_commitment_zero_check_ins_fails(admin: &signer, alice: &signer, bob: &signer) {
        setup(admin, alice, bob);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            0, // Invalid: 0 check-ins required
            4,
            utf8(b"Invalid Commitment"),
        );
    }

    // =========================================================================
    // COMMITMENT ACCEPTANCE TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_accept_commitment(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        // Alice creates commitment
        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Bob accepts
        habit_tracker::accept_commitment(bob, 0, 0);

        // Verify commitment is now accepted
        let (_, _, _, _, accepted, valid, _, _, _) = habit_tracker::get_commitment_details(0, 0);
        assert!(accepted, 0);
        assert!(valid, 1);

        // Bob should now have this commitment in his list
        let bob_commitments = habit_tracker::get_user_commitments(0, @0xB0B);
        assert!(vector::length(&bob_commitments) == 1, 2);
        assert!(*vector::borrow(&bob_commitments, 0) == 0, 3);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C, framework = @0x1)]
    #[expected_failure(abort_code = 15)] // E_NOT_INVITED_PARTICIPANT
    fun test_accept_commitment_wrong_person_fails(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
        framework: &signer
    ) {
        setup(admin, alice, bob);
        
        // Add Charlie to the group
        groups::join_group(charlie, 0, utf8(b"password"));

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        // Alice creates commitment with Bob
        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Charlie tries to accept (but commitment is for Bob)
        habit_tracker::accept_commitment(charlie, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 16)] // E_ALREADY_ACCEPTED
    fun test_accept_commitment_twice_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);
        habit_tracker::accept_commitment(bob, 0, 0); // Should fail
    }

    // =========================================================================
    // COMMITMENT DELETION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_delete_commitment(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Alice deletes the commitment before Bob accepts
        habit_tracker::delete_commitment(alice, 0, 0);

        // Verify commitment is invalid
        let (_, _, _, _, _, valid, _, _, _) = habit_tracker::get_commitment_details(0, 0);
        assert!(!valid, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 19)] // E_CANNOT_DELETE_ACCEPTED
    fun test_delete_accepted_commitment_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Try to delete after acceptance - should fail
        habit_tracker::delete_commitment(alice, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 18)] // E_NOT_CREATOR
    fun test_delete_commitment_not_creator_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Bob tries to delete Alice's commitment - should fail
        habit_tracker::delete_commitment(bob, 0, 0);
    }

    // =========================================================================
    // CHECK-IN TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_check_in(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        // Set timestamp to a known value
        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Alice checks in
        habit_tracker::check_in(alice, 0, 0);

        // Verify check-in was recorded
        let check_ins = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xA11CE);
        assert!(check_ins == 1, 0);

        // Alice checks in again
        habit_tracker::check_in(alice, 0, 0);
        let check_ins2 = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xA11CE);
        assert!(check_ins2 == 2, 1);

        // Bob checks in
        habit_tracker::check_in(bob, 0, 0);
        let bob_check_ins = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xB0B);
        assert!(bob_check_ins == 1, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 25)] // E_CHECK_IN_LIMIT_REACHED
    fun test_check_in_limit_reached(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3, // Max 3 check-ins per week
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Alice checks in 3 times (the limit)
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);

        // 4th check-in should fail
        habit_tracker::check_in(alice, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 17)] // E_NOT_ACCEPTED
    fun test_check_in_not_accepted_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Try to check in before Bob accepts
        habit_tracker::check_in(alice, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C, framework = @0x1)]
    #[expected_failure(abort_code = 20)] // E_NOT_PARTICIPANT
    fun test_check_in_non_participant_fails(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
        framework: &signer
    ) {
        setup(admin, alice, bob);
        groups::join_group(charlie, 0, utf8(b"password"));

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Charlie tries to check in (but he's not a participant)
        habit_tracker::check_in(charlie, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_check_in_multiple_weeks(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Alice checks in 3 times, Bob checks in 2 times
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Verify week 0 check-ins
        let alice_week0 = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xA11CE);
        let bob_week0 = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xB0B);
        assert!(alice_week0 == 3, 0);
        assert!(bob_week0 == 2, 1);

        // Advance to week 1 (604800 seconds = 1 week)
        timestamp::update_global_time_for_test_secs(start_time + 604800);

        // Week 1: Both check in 3 times
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);

        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Verify week 1 check-ins
        let alice_week1 = habit_tracker::get_weekly_check_ins(0, 0, 1, @0xA11CE);
        let bob_week1 = habit_tracker::get_weekly_check_ins(0, 0, 1, @0xB0B);
        assert!(alice_week1 == 3, 2);
        assert!(bob_week1 == 3, 3);

        // Week 0 check-ins should still be the same
        let alice_week0_again = habit_tracker::get_weekly_check_ins(0, 0, 0, @0xA11CE);
        assert!(alice_week0_again == 3, 4);
    }

    // =========================================================================
    // WEEK PROCESSING TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_process_week_alice_wins(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3, // Need 3 check-ins to succeed
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Alice checks in 3 times (succeeds), Bob checks in 2 times (fails)
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0
        habit_tracker::process_week(alice, 0, 0, 0);

        // Verify week was processed
        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_process_week_bob_wins(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Alice checks in 2 times (fails), Bob checks in 3 times (succeeds)
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0
        habit_tracker::process_week(bob, 0, 0, 0);

        // Verify week was processed
        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_process_week_both_succeed_split(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Both check in 3 times (both succeed)
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0 - should split payout
        habit_tracker::process_week(alice, 0, 0, 0);

        // Verify week was processed
        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_process_week_both_fail_split(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Neither checks in enough (both fail)
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0 - should split payout
        habit_tracker::process_week(alice, 0, 0, 0);

        // Verify week was processed
        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 21)] // E_WEEK_NOT_ENDED
    fun test_process_week_too_early_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Try to process week 0 before it ends
        habit_tracker::process_week(alice, 0, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 22)] // E_WEEK_ALREADY_PROCESSED
    fun test_process_week_twice_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0
        habit_tracker::process_week(alice, 0, 0, 0);

        // Try to process again - should fail
        habit_tracker::process_week(bob, 0, 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 23)] // E_INVALID_WEEK
    fun test_process_invalid_week_fails(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4, // Only 4 weeks (0-3)
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Advance time
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Try to process week 5 (invalid, only 0-3 exist)
        habit_tracker::process_week(alice, 0, 0, 5);
    }

    // =========================================================================
    // MULTI-WEEK SCENARIO TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_full_commitment_cycle(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        // 2-week commitment
        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            2, // 2 weeks
            utf8(b"Two Week Challenge"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Week 0: Alice succeeds, Bob fails
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Advance to end of week 0
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);
        habit_tracker::process_week(alice, 0, 0, 0);
        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);

        // Advance to week 1
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 100);

        // Week 1: Bob succeeds, Alice fails
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(bob, 0, 0);
        habit_tracker::check_in(alice, 0, 0);

        // Advance to end of week 1
        timestamp::update_global_time_for_test_secs(start_time + (2 * 604800) + 1);
        habit_tracker::process_week(bob, 0, 0, 1);
        assert!(habit_tracker::is_week_processed(0, 0, 1), 1);

        // Verify commitment is now ended
        assert!(habit_tracker::is_commitment_ended(0, 0), 2);
    }

    // =========================================================================
    // VIEW FUNCTION TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_get_current_week(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Initially at week 0
        let current_week = habit_tracker::get_current_week(0, 0);
        assert!(current_week == 0, 0);

        // Advance to week 1
        timestamp::update_global_time_for_test_secs(start_time + 604800);
        let current_week1 = habit_tracker::get_current_week(0, 0);
        assert!(current_week1 == 1, 1);

        // Advance to week 2
        timestamp::update_global_time_for_test_secs(start_time + (2 * 604800));
        let current_week2 = habit_tracker::get_current_week(0, 0);
        assert!(current_week2 == 2, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_get_all_check_ins(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Add some check-ins
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(alice, 0, 0);
        habit_tracker::check_in(bob, 0, 0);

        // Get all check-ins
        let (weeks, participants, counts) = habit_tracker::get_all_check_ins(0, 0);

        // Should have 2 entries (one for Alice, one for Bob)
        assert!(vector::length(&weeks) == 2, 0);
        assert!(vector::length(&participants) == 2, 1);
        assert!(vector::length(&counts) == 2, 2);

        // Verify data
        assert!(*vector::borrow(&weeks, 0) == 0, 3);
        assert!(*vector::borrow(&weeks, 1) == 0, 4);
        assert!(*vector::borrow(&counts, 0) == 2, 5); // Alice has 2 check-ins
        assert!(*vector::borrow(&counts, 1) == 1, 6); // Bob has 1 check-in
    }

    // =========================================================================
    // MULTIPLE COMMITMENTS TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C, framework = @0x1)]
    fun test_multiple_commitments_same_group(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
        framework: &signer
    ) {
        setup(admin, alice, bob);
        groups::join_group(charlie, 0, utf8(b"password"));

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        // Alice and Bob create one commitment
        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Morning Gym"),
        );

        // Alice and Charlie create another commitment
        habit_tracker::create_commitment(
            alice,
            0,
            @0xC0C,
            200,
            5,
            2,
            utf8(b"Evening Run"),
        );

        // Verify both commitments exist
        assert!(habit_tracker::get_group_commitments_count(0) == 2, 0);

        // Alice should have 2 commitments
        let alice_commitments = habit_tracker::get_user_commitments(0, @0xA11CE);
        assert!(vector::length(&alice_commitments) == 2, 1);

        // Verify details are different
        let (_, _, payout1, duration1, _, _, name1, _, checkins1) 
            = habit_tracker::get_commitment_details(0, 0);
        let (_, _, payout2, duration2, _, _, name2, _, checkins2) 
            = habit_tracker::get_commitment_details(0, 1);

        assert!(payout1 == 100 && payout2 == 200, 2);
        assert!(duration1 == 4 && duration2 == 2, 3);
        assert!(checkins1 == 3 && checkins2 == 5, 4);
        assert!(name1 == utf8(b"Morning Gym"), 5);
        assert!(name2 == utf8(b"Evening Run"), 6);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_multiple_groups_isolation(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        groups::init_for_testing(admin);
        habit_tracker::init_for_testing(admin);

        timestamp::set_time_has_started_for_testing(framework);
        timestamp::update_global_time_for_test_secs(1000000);

        // Create two groups
        groups::create_group(
            alice,
            utf8(b"Gym Group"),
            utf8(b"pass1"),
            utf8(b"Fitness"),
        );

        groups::create_group(
            bob,
            utf8(b"Study Group"),
            utf8(b"pass2"),
            utf8(b"Learning"),
        );

        groups::join_group(bob, 0, utf8(b"pass1"));
        groups::join_group(alice, 1, utf8(b"pass2"));

        // Create commitment in group 0
        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            4,
            utf8(b"Gym Commitment"),
        );

        // Create commitment in group 1
        habit_tracker::create_commitment(
            bob,
            1,
            @0xA11CE,
            200,
            5,
            2,
            utf8(b"Study Commitment"),
        );

        // Verify commitments are isolated
        assert!(habit_tracker::get_group_commitments_count(0) == 1, 0);
        assert!(habit_tracker::get_group_commitments_count(1) == 1, 1);

        // Verify details are different
        let (_, _, payout0, _, _, _, name0, _, _) 
            = habit_tracker::get_commitment_details(0, 0);
        let (_, _, payout1, _, _, _, name1, _, _) 
            = habit_tracker::get_commitment_details(1, 0);

        assert!(payout0 == 100, 2);
        assert!(payout1 == 200, 3);
        assert!(name0 == utf8(b"Gym Commitment"), 4);
        assert!(name1 == utf8(b"Study Commitment"), 5);
    }

    // =========================================================================
    // EDGE CASE TESTS
    // =========================================================================

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    fun test_zero_check_ins_both_fail(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            2,
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Neither checks in during week 0

        // Advance past week 0 end
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Process week 0 - should split since both failed
        habit_tracker::process_week(alice, 0, 0, 0);

        assert!(habit_tracker::is_week_processed(0, 0, 0), 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, framework = @0x1)]
    #[expected_failure(abort_code = 24)] // E_COMMITMENT_ENDED
    fun test_check_in_after_commitment_ended(admin: &signer, alice: &signer, bob: &signer, framework: &signer) {
        setup(admin, alice, bob);

        timestamp::set_time_has_started_for_testing(framework);
        let start_time = 1000000;
        timestamp::update_global_time_for_test_secs(start_time);

        habit_tracker::create_commitment(
            alice,
            0,
            @0xB0B,
            100,
            3,
            1, // Only 1 week
            utf8(b"Gym Commitment"),
        );

        habit_tracker::accept_commitment(bob, 0, 0);

        // Advance past the commitment duration
        timestamp::update_global_time_for_test_secs(start_time + 604800 + 1);

        // Try to check in after commitment ended
        habit_tracker::check_in(alice, 0, 0);
    }
}

