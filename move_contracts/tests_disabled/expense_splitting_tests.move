#[test_only]
module friend_fi::expense_splitting_tests {
    use std::string::utf8;
    use std::vector;
    use friend_fi::groups;
    use friend_fi::expense_splitting;

    // Test addresses
    const ADMIN: address = @friend_fi;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;
    const DAVE: address = @0xDADE;

    fun setup(admin: &signer, alice: &signer, bob: &signer, charlie: &signer) {
        // Initialize both modules
        groups::init_for_testing(admin);
        expense_splitting::init_for_testing(admin);

        // Create a test group
        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"password"),
            utf8(b"Shared apartment expenses"),
        );

        // Bob and Charlie join
        groups::join_group(bob, 0, utf8(b"password"));
        groups::join_group(charlie, 0, utf8(b"password"));
    }

    #[test(admin = @friend_fi)]
    fun test_init(admin: &signer) {
        groups::init_for_testing(admin);
        expense_splitting::init_for_testing(admin);
        
        assert!(expense_splitting::get_group_expenses_count(0) == 0, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_create_expense_equal(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $300 for groceries, split 3 ways
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);
        vector::push_back(&mut participants, @0xC0C);

        expense_splitting::create_expense_equal(
            alice,
            0, // group_id
            utf8(b"Groceries"),
            300,
            participants,
        );

        // Check expense was created
        assert!(expense_splitting::get_group_expenses_count(0) == 1, 0);

        // Bob and Charlie each owe Alice $100
        let bob_owes = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        let charlie_owes = expense_splitting::get_debt_amount(0, @0xC0C, @0xA11CE);
        
        assert!(bob_owes == 100, 1);
        assert!(charlie_owes == 100, 2);

        // Alice should be owed $200 total
        let (alice_balance, is_owed) = expense_splitting::get_user_balance(0, @0xA11CE);
        assert!(is_owed, 3);
        assert!(alice_balance == 200, 4);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_create_expense_exact(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $500 for rent, but splits are different
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);
        vector::push_back(&mut participants, @0xC0C);

        let amounts = vector::empty<u64>();
        vector::push_back(&mut amounts, 200); // Alice's share
        vector::push_back(&mut amounts, 150); // Bob's share
        vector::push_back(&mut amounts, 150); // Charlie's share

        expense_splitting::create_expense_exact(
            alice,
            0,
            utf8(b"Rent"),
            500,
            participants,
            amounts,
        );

        // Bob owes Alice $150
        let bob_owes = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(bob_owes == 150, 0);

        // Charlie owes Alice $150
        let charlie_owes = expense_splitting::get_debt_amount(0, @0xC0C, @0xA11CE);
        assert!(charlie_owes == 150, 1);

        // Alice should be owed $300 total
        let (alice_balance, is_owed) = expense_splitting::get_user_balance(0, @0xA11CE);
        assert!(is_owed, 2);
        assert!(alice_balance == 300, 3);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_create_expense_percentage(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $1000 for utilities
        // Alice: 40%, Bob: 30%, Charlie: 30%
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);
        vector::push_back(&mut participants, @0xC0C);

        let percentages = vector::empty<u64>();
        vector::push_back(&mut percentages, 4000); // 40%
        vector::push_back(&mut percentages, 3000); // 30%
        vector::push_back(&mut percentages, 3000); // 30%

        expense_splitting::create_expense_percentage(
            alice,
            0,
            utf8(b"Utilities"),
            1000,
            participants,
            percentages,
        );

        // Bob owes Alice $300 (30% of 1000)
        let bob_owes = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(bob_owes == 300, 0);

        // Charlie owes Alice $300 (30% of 1000)
        let charlie_owes = expense_splitting::get_debt_amount(0, @0xC0C, @0xA11CE);
        assert!(charlie_owes == 300, 1);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    #[expected_failure(abort_code = 13)] // E_SPLIT_AMOUNTS_DONT_MATCH
    fun test_create_expense_exact_sum_mismatch(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);

        let amounts = vector::empty<u64>();
        vector::push_back(&mut amounts, 100);
        vector::push_back(&mut amounts, 50); // Sum is 150, not 200

        expense_splitting::create_expense_exact(
            alice,
            0,
            utf8(b"Test"),
            200,
            participants,
            amounts,
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    #[expected_failure(abort_code = 18)] // E_PERCENTAGE_SUM_NOT_100
    fun test_create_expense_percentage_sum_not_100(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);

        let percentages = vector::empty<u64>();
        vector::push_back(&mut percentages, 5000); // 50%
        vector::push_back(&mut percentages, 3000); // 30% - sum is 80%, not 100%

        expense_splitting::create_expense_percentage(
            alice,
            0,
            utf8(b"Test"),
            1000,
            participants,
            percentages,
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_debt_simplification(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $100, split between Alice and Bob
        let participants1 = vector::empty<address>();
        vector::push_back(&mut participants1, @0xA11CE);
        vector::push_back(&mut participants1, @0xB0B);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Dinner"),
            100,
            participants1,
        );

        // Bob owes Alice $50
        let debt1 = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(debt1 == 50, 0);

        // Bob pays $80, split between Bob and Alice
        let participants2 = vector::empty<address>();
        vector::push_back(&mut participants2, @0xB0B);
        vector::push_back(&mut participants2, @0xA11CE);

        expense_splitting::create_expense_equal(
            bob,
            0,
            utf8(b"Lunch"),
            80,
            participants2,
        );

        // Now Alice owes Bob $40, but Bob already owed Alice $50
        // Net result: Bob owes Alice $10
        let bob_to_alice = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        let alice_to_bob = expense_splitting::get_debt_amount(0, @0xA11CE, @0xB0B);
        
        assert!(bob_to_alice == 10, 1);
        assert!(alice_to_bob == 0, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_mark_debt_settled(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $100, split equally
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Dinner"),
            100,
            participants,
        );

        // Bob owes Alice $50
        let debt_before = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(debt_before == 50, 0);

        // Alice marks the debt as settled (Bob paid off-chain)
        expense_splitting::mark_debt_settled(
            alice,
            0,
            @0xB0B,
            50,
        );

        // Debt should be cleared
        let debt_after = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(debt_after == 0, 1);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_partial_settlement(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $100, split equally
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Dinner"),
            100,
            participants,
        );

        // Bob owes Alice $50
        let debt_before = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(debt_before == 50, 0);

        // Alice marks partial payment as settled
        expense_splitting::mark_debt_settled(
            alice,
            0,
            @0xB0B,
            30,
        );

        // Debt should be reduced to $20
        let debt_after = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        assert!(debt_after == 20, 1);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_get_group_debts(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $300, split 3 ways
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);
        vector::push_back(&mut participants, @0xC0C);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Groceries"),
            300,
            participants,
        );

        let (debtors, creditors, amounts) = expense_splitting::get_group_debts(0);
        
        // Should have 2 debts (Bob->Alice, Charlie->Alice)
        assert!(vector::length(&debtors) == 2, 0);
        assert!(vector::length(&creditors) == 2, 1);
        assert!(vector::length(&amounts) == 2, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_user_balance_owed(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Alice pays $300, split 3 ways
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xB0B);
        vector::push_back(&mut participants, @0xC0C);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Groceries"),
            300,
            participants,
        );

        // Alice is owed $200 (Bob owes $100 + Charlie owes $100)
        let (alice_balance, alice_is_owed) = expense_splitting::get_user_balance(0, @0xA11CE);
        assert!(alice_is_owed, 0);
        assert!(alice_balance == 200, 1);

        // Bob owes $100
        let (bob_balance, bob_is_owed) = expense_splitting::get_user_balance(0, @0xB0B);
        assert!(!bob_is_owed, 2);
        assert!(bob_balance == 100, 3);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_complex_scenario(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Scenario: Shared apartment over a month

        // 1. Alice pays rent ($1500, split 3 ways)
        let rent_participants = vector::empty<address>();
        vector::push_back(&mut rent_participants, @0xA11CE);
        vector::push_back(&mut rent_participants, @0xB0B);
        vector::push_back(&mut rent_participants, @0xC0C);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Rent"),
            1500,
            rent_participants,
        );

        // 2. Bob pays utilities ($300, split 3 ways)
        let utils_participants = vector::empty<address>();
        vector::push_back(&mut utils_participants, @0xA11CE);
        vector::push_back(&mut utils_participants, @0xB0B);
        vector::push_back(&mut utils_participants, @0xC0C);

        expense_splitting::create_expense_equal(
            bob,
            0,
            utf8(b"Utilities"),
            300,
            utils_participants,
        );

        // 3. Charlie pays groceries ($150, split 3 ways)
        let grocery_participants = vector::empty<address>();
        vector::push_back(&mut grocery_participants, @0xA11CE);
        vector::push_back(&mut grocery_participants, @0xB0B);
        vector::push_back(&mut grocery_participants, @0xC0C);

        expense_splitting::create_expense_equal(
            charlie,
            0,
            utf8(b"Groceries"),
            150,
            grocery_participants,
        );

        // Calculate balances
        // Alice paid: $1500, owes: $100 (utilities) + $50 (groceries) = $150
        // Net: Alice is owed $1500 - $500 (her share of all) - $150 = $850? Let me recalculate
        
        // Alice: paid $1500, her share of total ($1950) is $650
        // Alice should be owed: $1500 - $650 = $850
        
        // Actually, with simplified debts:
        // After rent: Bob owes Alice $500, Charlie owes Alice $500
        // After utilities: Bob is owed $100 from each -> Alice owes Bob $100, Charlie owes Bob $100
        //   Simplified: Bob owes Alice $400, Charlie owes Alice $500, Charlie owes Bob $100
        // After groceries: Charlie is owed $50 from each -> further simplification
        
        // Let's just verify that total expenses are tracked correctly
        assert!(expense_splitting::get_group_expenses_count(0) == 3, 0);

        // Verify Alice is owed money overall (she paid the most)
        let (alice_balance, alice_is_owed) = expense_splitting::get_user_balance(0, @0xA11CE);
        assert!(alice_is_owed, 1);
        assert!(alice_balance > 0, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C, dave = @0xDADE)]
    #[expected_failure(abort_code = 11)] // E_NOT_GROUP_MEMBER
    fun test_non_member_cannot_create_expense(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
        dave: &signer,
    ) {
        setup(admin, alice, bob, charlie);

        // Dave is not a member of the group
        let participants = vector::empty<address>();
        vector::push_back(&mut participants, @0xA11CE);
        vector::push_back(&mut participants, @0xDADE);

        expense_splitting::create_expense_equal(
            dave,
            0,
            utf8(b"Unauthorized expense"),
            100,
            participants,
        );
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_multiple_groups_isolation(
        admin: &signer,
        alice: &signer,
        bob: &signer,
        charlie: &signer,
    ) {
        groups::init_for_testing(admin);
        expense_splitting::init_for_testing(admin);

        // Create two separate groups
        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"pass1"),
            utf8(b"Apartment"),
        );

        groups::create_group(
            bob,
            utf8(b"Trip Group"),
            utf8(b"pass2"),
            utf8(b"Vacation"),
        );

        groups::join_group(bob, 0, utf8(b"pass1"));
        groups::join_group(alice, 1, utf8(b"pass2"));

        // Add expense to group 0
        let participants0 = vector::empty<address>();
        vector::push_back(&mut participants0, @0xA11CE);
        vector::push_back(&mut participants0, @0xB0B);

        expense_splitting::create_expense_equal(
            alice,
            0,
            utf8(b"Rent"),
            1000,
            participants0,
        );

        // Add expense to group 1
        let participants1 = vector::empty<address>();
        vector::push_back(&mut participants1, @0xA11CE);
        vector::push_back(&mut participants1, @0xB0B);

        expense_splitting::create_expense_equal(
            bob,
            1,
            utf8(b"Hotel"),
            500,
            participants1,
        );

        // Verify expenses are isolated
        assert!(expense_splitting::get_group_expenses_count(0) == 1, 0);
        assert!(expense_splitting::get_group_expenses_count(1) == 1, 1);

        // Debts should be different in each group
        let debt_group0 = expense_splitting::get_debt_amount(0, @0xB0B, @0xA11CE);
        let debt_group1 = expense_splitting::get_debt_amount(1, @0xA11CE, @0xB0B);

        assert!(debt_group0 == 500, 2); // Bob owes Alice in group 0
        assert!(debt_group1 == 250, 3); // Alice owes Bob in group 1
    }
}

