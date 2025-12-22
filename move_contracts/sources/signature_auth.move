/// ============================================================================
/// Friend-Fi Signature-Based Authentication Module
/// ============================================================================
///
/// This module implements signature-based membership verification.
/// Backend signs attestations, contracts verify on-chain.
///
/// Flow:
/// 1. User wants to create bet/expense in group
/// 2. Frontend requests signature from backend API
/// 3. Backend checks Supabase, signs: "user:group:expires"
/// 4. User submits transaction + signature
/// 5. Contract verifies signature from trusted backend
/// 6. If valid, transaction proceeds
///
/// ============================================================================

module friend_fi::signature_auth {
    use std::bcs;
    use std::vector;
    use std::string::{Self, String};
    use aptos_std::ed25519;
    use aptos_framework::timestamp;
    
    // =========================================================================
    // CONSTANTS
    // =========================================================================
    
    /// Backend's Ed25519 public key (generated via generate-backend-keypair.ts)
    /// This is the ONLY trusted signer for membership attestations
    const BACKEND_PUBLIC_KEY: vector<u8> = x"a45972792b0aa9f863fa4e9b9ec3178ad0b67a67594a729a21388ab6e395478a";
    
    // =========================================================================
    // ERROR CODES
    // =========================================================================
    
    /// Signature has expired
    const E_SIGNATURE_EXPIRED: u64 = 1;
    
    /// Signature verification failed (invalid signature)
    const E_INVALID_SIGNATURE: u64 = 2;
    
    /// Invalid public key format
    const E_INVALID_PUBLIC_KEY: u64 = 3;
    
    // =========================================================================
    // PUBLIC FUNCTIONS
    // =========================================================================
    
    /// Verify a membership attestation signature
    ///
    /// Message format: "{user_address}:{group_id}:{expires_timestamp}"
    /// Example: "0x123abc:42:1704067200000"
    ///
    /// @param group_id - Group ID the user claims membership in
    /// @param user_addr - User's wallet address
    /// @param expires_at_ms - Expiration timestamp in milliseconds
    /// @param signature - Backend's Ed25519 signature (64 bytes)
    /// @return true if signature is valid and not expired
    public fun verify_membership(
        group_id: u64,
        user_addr: address,
        expires_at_ms: u64,
        signature: vector<u8>,
    ): bool {
        // Check expiration (convert to seconds for Aptos timestamp)
        let now_seconds = timestamp::now_seconds();
        let expires_at_seconds = expires_at_ms / 1000;
        
        if (now_seconds > expires_at_seconds) {
            return false // Signature expired
        };
        
        // Reconstruct message: "user:group:expires"
        let message = reconstruct_message(user_addr, group_id, expires_at_ms);
        
        // Verify signature
        verify_signature_internal(message, signature)
    }
    
    /// Assert that membership is valid (reverts if not)
    /// Use this in entry functions to enforce membership
    public fun assert_membership(
        group_id: u64,
        user_addr: address,
        expires_at_ms: u64,
        signature: vector<u8>,
    ) {
        let now_seconds = timestamp::now_seconds();
        let expires_at_seconds = expires_at_ms / 1000;
        
        assert!(now_seconds <= expires_at_seconds, E_SIGNATURE_EXPIRED);
        
        let message = reconstruct_message(user_addr, group_id, expires_at_ms);
        assert!(verify_signature_internal(message, signature), E_INVALID_SIGNATURE);
    }
    
    // =========================================================================
    // INTERNAL FUNCTIONS
    // =========================================================================
    
    /// Reconstruct the signed message
    /// Format: "{address}:{group_id}:{expires_ms}"
    /// Example: "0x1234abcd:42:1704067200000"
    fun reconstruct_message(
        user_addr: address,
        group_id: u64,
        expires_at_ms: u64,
    ): vector<u8> {
        // Convert address to hex string
        let addr_bytes = bcs::to_bytes(&user_addr);
        let addr_string = to_hex_string(addr_bytes);
        
        // Convert group_id to string
        let group_string = u64_to_string(group_id);
        
        // Convert expires_at_ms to string
        let expires_string = u64_to_string(expires_at_ms);
        
        // Build message: "address:group:expires"
        let mut_message = string::utf8(b"");
        string::append(&mut mut_message, addr_string);
        string::append_utf8(&mut mut_message, b":");
        string::append(&mut mut_message, group_string);
        string::append_utf8(&mut mut_message, b":");
        string::append(&mut mut_message, expires_string);
        
        // Return as bytes
        *string::bytes(&mut_message)
    }
    
    /// Convert u64 to string
    fun u64_to_string(value: u64): String {
        if (value == 0) {
            return string::utf8(b"0")
        };
        
        let mut_value = value;
        let mut_buffer = vector::empty<u8>();
        
        while (mut_value > 0) {
            let digit = ((mut_value % 10) as u8) + 48; // ASCII '0' = 48
            vector::push_back(&mut mut_buffer, digit);
            mut_value = mut_value / 10;
        };
        
        // Reverse the buffer (digits were added backwards)
        vector::reverse(&mut mut_buffer);
        string::utf8(mut_buffer)
    }
    
    /// Convert bytes to hex string with 0x prefix
    fun to_hex_string(bytes: vector<u8>): String {
        let hex_chars = b"0123456789abcdef";
        let mut_result = vector::empty<u8>();
        
        // Add "0x" prefix
        vector::push_back(&mut mut_result, 48); // '0'
        vector::push_back(&mut mut_result, 120); // 'x'
        
        let len = vector::length(&bytes);
        let mut_i = 0;
        while (mut_i < len) {
            let byte = *vector::borrow(&bytes, mut_i);
            let high = (byte >> 4) & 0x0f;
            let low = byte & 0x0f;
            vector::push_back(&mut mut_result, *vector::borrow(&hex_chars, (high as u64)));
            vector::push_back(&mut mut_result, *vector::borrow(&hex_chars, (low as u64)));
            mut_i = mut_i + 1;
        };
        
        string::utf8(mut_result)
    }
    
    /// Verify Ed25519 signature against backend public key
    fun verify_signature_internal(
        message: vector<u8>,
        signature: vector<u8>,
    ): bool {
        // Create unvalidated public key from constant
        let unvalidated_pub_key = ed25519::new_unvalidated_public_key_from_bytes(BACKEND_PUBLIC_KEY);
        
        // Create signature object
        let sig = ed25519::new_signature_from_bytes(signature);
        
        // Verify signature (signature_verify_strict does validation internally)
        ed25519::signature_verify_strict(&sig, &unvalidated_pub_key, message)
    }
    
    // =========================================================================
    // VIEW FUNCTIONS (for testing/debugging)
    // =========================================================================
    
    /// Get the backend public key (for verification)
    public fun get_backend_public_key(): vector<u8> {
        BACKEND_PUBLIC_KEY
    }
    
    /// Check if a timestamp is expired
    public fun is_expired(expires_at_ms: u64): bool {
        let now_seconds = timestamp::now_seconds();
        let expires_at_seconds = expires_at_ms / 1000;
        now_seconds > expires_at_seconds
    }
}

