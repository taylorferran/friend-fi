/// ============================================================================
/// Test USDC Module - Mintable Fungible Asset for Testing
/// ============================================================================
///
/// This module creates a test version of USDC with the following features:
/// - 6 decimals (same as real USDC)
/// - Unlimited minting by admin
/// - Standard fungible asset framework
/// - Can be used exactly like real USDC in all contracts
///
/// IMPORTANT: This is for TESTNET ONLY. Do not use in production.
///
/// ============================================================================

module friend_fi::test_usdc {
    use std::string;
    use std::signer;
    use std::option;
    
    use aptos_framework::fungible_asset::{Self, MintRef, TransferRef, BurnRef, Metadata, FungibleAsset};
    use aptos_framework::object::{Self, Object};
    use aptos_framework::primary_fungible_store;

    /// Only admin can mint
    const E_NOT_ADMIN: u64 = 1;

    /// Admin address (deployer)
    const ADMIN_ADDR: address = @friend_fi;

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    /// Hold refs to control the minting, transfer, and burning of fungible assets.
    struct ManagedFungibleAsset has key {
        mint_ref: MintRef,
        transfer_ref: TransferRef,
        burn_ref: BurnRef,
    }

    /// Initialize the test USDC token
    /// Creates a fungible asset with:
    /// - Name: "Test USDC"
    /// - Symbol: "tUSDC"
    /// - Decimals: 6 (same as real USDC)
    /// - Icon: USDC logo URI
    fun init_module(admin: &signer) {
        // Create a named object for the fungible asset metadata
        let constructor_ref = &object::create_named_object(admin, b"TEST_USDC");
        
        // Create the fungible asset with USDC-like properties
        primary_fungible_store::create_primary_store_enabled_fungible_asset(
            constructor_ref,
            option::none(), // max_supply (none = unlimited)
            string::utf8(b"Test USDC"),
            string::utf8(b"tUSDC"),
            6, // decimals (same as real USDC)
            string::utf8(b"https://cryptologos.cc/logos/usd-coin-usdc-logo.png"),
            string::utf8(b"https://www.circle.com/en/usdc"),
        );

        // Generate mint, burn, and transfer refs for admin control
        let mint_ref = fungible_asset::generate_mint_ref(constructor_ref);
        let burn_ref = fungible_asset::generate_burn_ref(constructor_ref);
        let transfer_ref = fungible_asset::generate_transfer_ref(constructor_ref);
        
        // Store refs for later use
        let metadata_object_signer = object::generate_signer(constructor_ref);
        move_to(
            &metadata_object_signer,
            ManagedFungibleAsset { mint_ref, transfer_ref, burn_ref }
        );
    }

    /// Mint test USDC to any address
    /// Only admin can mint
    public entry fun mint(
        admin: &signer,
        to: address,
        amount: u64
    ) acquires ManagedFungibleAsset {
        assert!(signer::address_of(admin) == ADMIN_ADDR, E_NOT_ADMIN);
        
        let asset = get_metadata();
        let managed_fungible_asset = authorized_borrow_refs(admin, asset);
        let to_wallet = primary_fungible_store::ensure_primary_store_exists(to, asset);
        let fa = fungible_asset::mint(&managed_fungible_asset.mint_ref, amount);
        fungible_asset::deposit_with_ref(&managed_fungible_asset.transfer_ref, to_wallet, fa);
    }

    /// Burn test USDC from an address
    /// Only admin can burn
    public entry fun burn(
        admin: &signer,
        from: address,
        amount: u64
    ) acquires ManagedFungibleAsset {
        assert!(signer::address_of(admin) == ADMIN_ADDR, E_NOT_ADMIN);
        
        let asset = get_metadata();
        let burn_ref = &authorized_borrow_refs(admin, asset).burn_ref;
        let from_wallet = primary_fungible_store::primary_store(from, asset);
        fungible_asset::burn_from(burn_ref, from_wallet, amount);
    }

    /// Transfer test USDC between addresses (forced, admin only)
    /// This can override transfer restrictions if needed
    public entry fun force_transfer(
        admin: &signer,
        from: address,
        to: address,
        amount: u64,
    ) acquires ManagedFungibleAsset {
        assert!(signer::address_of(admin) == ADMIN_ADDR, E_NOT_ADMIN);
        
        let asset = get_metadata();
        let transfer_ref = &authorized_borrow_refs(admin, asset).transfer_ref;
        let from_wallet = primary_fungible_store::primary_store(from, asset);
        let to_wallet = primary_fungible_store::ensure_primary_store_exists(to, asset);
        fungible_asset::transfer_with_ref(transfer_ref, from_wallet, to_wallet, amount);
    }

    /// Get the metadata object for test USDC
    #[view]
    public fun get_metadata(): Object<Metadata> {
        let metadata_address = object::create_object_address(&ADMIN_ADDR, b"TEST_USDC");
        object::address_to_object<Metadata>(metadata_address)
    }

    /// Get the balance of an address in test USDC
    #[view]
    public fun balance_of(account: address): u64 {
        let metadata = get_metadata();
        primary_fungible_store::balance(account, metadata)
    }

    /// Check if an address has a primary store for test USDC
    #[view]
    public fun has_store(account: address): bool {
        let metadata = get_metadata();
        primary_fungible_store::primary_store_exists(account, metadata)
    }

    // ============================================================================
    // INTERNAL HELPERS
    // ============================================================================

    /// Borrow the refs (only admin can do this)
    inline fun authorized_borrow_refs(
        admin: &signer,
        asset: Object<Metadata>,
    ): &ManagedFungibleAsset acquires ManagedFungibleAsset {
        assert!(signer::address_of(admin) == ADMIN_ADDR, E_NOT_ADMIN);
        borrow_global<ManagedFungibleAsset>(object::object_address(&asset))
    }
}

