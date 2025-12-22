#[test_only]
module friend_fi::groups_tests {
    use std::string::utf8;
    use std::vector;
    use friend_fi::groups;
    use aptos_framework::account;

    // Test addresses
    const ADMIN: address = @friend_fi;
    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;

    #[test(admin = @friend_fi)]
    fun test_init(admin: &signer) {
        groups::init_for_testing(admin);
        assert!(groups::get_groups_count() == 0, 0);
    }

    #[test(admin = @friend_fi)]
    #[expected_failure(abort_code = 1)] // E_ALREADY_INITIALIZED
    fun test_double_init_fails(admin: &signer) {
        groups::init_for_testing(admin);
        groups::init_for_testing(admin);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_set_profile(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::set_profile(alice, utf8(b"alice"), 1);

        let (name, avatar_id, exists) = groups::get_profile(@0xA11CE);
        assert!(exists, 0);
        assert!(name == utf8(b"alice"), 1);
        assert!(avatar_id == 1, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 14)] // E_USERNAME_TAKEN
    fun test_duplicate_username_fails(admin: &signer, alice: &signer, bob: &signer) {
        groups::init_for_testing(admin);

        groups::set_profile(alice, utf8(b"alice"), 1);
        groups::set_profile(bob, utf8(b"alice"), 2); // Should fail
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_update_profile(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::set_profile(alice, utf8(b"alice"), 1);
        groups::set_profile(alice, utf8(b"alice_updated"), 2);

        let (name, avatar_id, exists) = groups::get_profile(@0xA11CE);
        assert!(exists, 0);
        assert!(name == utf8(b"alice_updated"), 1);
        assert!(avatar_id == 2, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_resolve_username(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::set_profile(alice, utf8(b"alice"), 1);

        let (addr, found) = groups::resolve_username(utf8(b"alice"));
        assert!(found, 0);
        assert!(addr == @0xA11CE, 1);

        let (_, not_found) = groups::resolve_username(utf8(b"nonexistent"));
        assert!(!not_found, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_create_group(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Trip to Bali"),
            utf8(b"password123"),
            utf8(b"Summer vacation expenses"),
        );

        assert!(groups::get_groups_count() == 1, 0);
        
        let name = groups::get_group_name(0);
        assert!(name == utf8(b"Trip to Bali"), 1);

        let desc = groups::get_group_description(0);
        assert!(desc == utf8(b"Summer vacation expenses"), 2);

        // Creator should be a member
        assert!(groups::check_if_member_in_group(0, @0xA11CE), 3);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    fun test_join_group(admin: &signer, alice: &signer, bob: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"secret"),
            utf8(b"Shared rent and utilities"),
        );

        groups::join_group(bob, 0, utf8(b"secret"));

        // Both should be members
        assert!(groups::check_if_member_in_group(0, @0xA11CE), 0);
        assert!(groups::check_if_member_in_group(0, @0xB0B), 1);

        let members = groups::get_group_members(0);
        assert!(vector::length(&members) == 2, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 11)] // E_INVALID_PASSWORD
    fun test_join_group_wrong_password(admin: &signer, alice: &signer, bob: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"secret"),
            utf8(b"Shared rent and utilities"),
        );

        groups::join_group(bob, 0, utf8(b"wrongpassword"));
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    #[expected_failure(abort_code = 12)] // E_ALREADY_MEMBER
    fun test_join_group_already_member(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"secret"),
            utf8(b"Shared rent and utilities"),
        );

        // Alice is already a member (creator)
        groups::join_group(alice, 0, utf8(b"secret"));
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    fun test_leave_group(admin: &signer, alice: &signer, bob: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"secret"),
            utf8(b"Shared rent and utilities"),
        );

        groups::join_group(bob, 0, utf8(b"secret"));
        assert!(groups::check_if_member_in_group(0, @0xB0B), 0);

        groups::leave_group(bob, 0);
        assert!(!groups::check_if_member_in_group(0, @0xB0B), 1);

        let members = groups::get_group_members(0);
        assert!(vector::length(&members) == 1, 2);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B)]
    #[expected_failure(abort_code = 13)] // E_NOT_MEMBER
    fun test_leave_group_not_member(admin: &signer, alice: &signer, bob: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Flatmates"),
            utf8(b"secret"),
            utf8(b"Shared rent and utilities"),
        );

        // Bob is not a member
        groups::leave_group(bob, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_is_member_helper(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Trip"),
            utf8(b"pass"),
            utf8(b"Trip expenses"),
        );

        assert!(groups::is_member(0, @0xA11CE), 0);
        assert!(!groups::is_member(0, @0xB0B), 1);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE)]
    fun test_get_group_admin(admin: &signer, alice: &signer) {
        groups::init_for_testing(admin);

        groups::create_group(
            alice,
            utf8(b"Trip"),
            utf8(b"pass"),
            utf8(b"Trip expenses"),
        );

        let group_admin = groups::get_group_admin(0);
        assert!(group_admin == @0xA11CE, 0);
    }

    #[test(admin = @friend_fi, alice = @0xA11CE, bob = @0xB0B, charlie = @0xC0C)]
    fun test_multiple_groups(admin: &signer, alice: &signer, bob: &signer, charlie: &signer) {
        groups::init_for_testing(admin);

        // Create multiple groups
        groups::create_group(
            alice,
            utf8(b"Group 1"),
            utf8(b"pass1"),
            utf8(b"First group"),
        );

        groups::create_group(
            bob,
            utf8(b"Group 2"),
            utf8(b"pass2"),
            utf8(b"Second group"),
        );

        assert!(groups::get_groups_count() == 2, 0);

        // Charlie joins both groups
        groups::join_group(charlie, 0, utf8(b"pass1"));
        groups::join_group(charlie, 1, utf8(b"pass2"));

        assert!(groups::check_if_member_in_group(0, @0xC0C), 1);
        assert!(groups::check_if_member_in_group(1, @0xC0C), 2);

        // Verify group names
        assert!(groups::get_group_name(0) == utf8(b"Group 1"), 3);
        assert!(groups::get_group_name(1) == utf8(b"Group 2"), 4);
    }
}

