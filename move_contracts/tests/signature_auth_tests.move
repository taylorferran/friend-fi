///============================================================================
/// Friend-Fi Signature Auth Tests
/// ============================================================================

#[test_only]
module friend_fi::signature_auth_tests {
    use std::signer;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::account;
    use friend_fi::signature_auth;
    
    // Test constants
    const TEST_GROUP_ID: u64 = 42;
    
    // Valid test signature (generated with backend key)
    // Message: "0x1:42:1704067200000" (signed with private key from keypair generation)
    // This is a placeholder - in real tests, generate actual signatures
    const TEST_SIGNATURE: vector<u8> = x"0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
    
    #[test]
    fun test_get_backend_public_key() {
        // Test that we can retrieve the backend public key
        let pub_key = signature_auth::get_backend_public_key();
        assert!(vector::length(&pub_key) == 32, 1); // Ed25519 public keys are 32 bytes
    }
    
    #[test(admin = @0x1)]
    fun test_is_expired_future(admin: &signer) {
        // Setup
        let admin_addr = signer::address_of(admin);
        account::create_account_for_test(admin_addr);
        timestamp::set_time_has_started_for_testing(admin);
        
        // Future timestamp (1 hour from now)
        let future_ms = ((timestamp::now_seconds() + 3600) as u64) * 1000;
        
        // Should not be expired
        assert!(!signature_auth::is_expired(future_ms), 1);
    }
    
    #[test(admin = @0x1)]
    fun test_is_expired_past(admin: &signer) {
        // Setup
        let admin_addr = signer::address_of(admin);
        account::create_account_for_test(admin_addr);
        timestamp::set_time_has_started_for_testing(admin);
        
        // Set time to a reasonable value (not 0)
        timestamp::update_global_time_for_test_secs(1000000);
        
        // Past timestamp (1 hour ago = 3600 seconds ago)
        let now_seconds = timestamp::now_seconds();
        let past_seconds = now_seconds - 3600;
        let past_ms = (past_seconds as u64) * 1000;
        
        // Should be expired
        assert!(signature_auth::is_expired(past_ms), 1);
    }
    
    #[test(admin = @0x1)]
    #[expected_failure(abort_code = signature_auth::E_SIGNATURE_EXPIRED)]
    fun test_assert_membership_expired(admin: &signer) {
        // Setup
        let admin_addr = signer::address_of(admin);
        account::create_account_for_test(admin_addr);
        timestamp::set_time_has_started_for_testing(admin);
        
        // Set time to a reasonable value
        timestamp::update_global_time_for_test_secs(1000000);
        
        // Expired timestamp (1 hour ago)
        let now_seconds = timestamp::now_seconds();
        let past_seconds = now_seconds - 3600;
        let past_ms = (past_seconds as u64) * 1000;
        
        // Should abort with E_SIGNATURE_EXPIRED
        signature_auth::assert_membership(
            TEST_GROUP_ID,
            admin_addr,
            past_ms,
            TEST_SIGNATURE,
        );
    }
    
    /// Note: Full signature verification tests require generating actual valid signatures
    /// with the backend private key. For now, we test the structure and expiration logic.
    /// 
    /// To properly test signature verification:
    /// 1. Generate a message in TypeScript: "address:groupId:expiresMs"
    /// 2. Sign it with the backend private key
    /// 3. Pass the signature to the Move test
    /// 4. Verify it passes
    /// 
    /// This requires cross-language test coordination or using the same
    /// Ed25519 signing in Move tests (which is complex).
}

