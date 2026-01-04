/// ============================================================================
/// Friend-Fi Expense Splitting Module (Minimal - Settlement Only)
/// ============================================================================
///
/// HYBRID ARCHITECTURE:
/// - OFF-CHAIN (Supabase): Expense creation, tracking, debt calculation
/// - ON-CHAIN: Only USDC settlements with 0.3% fee
///
/// This module implements ONLY the settlement function with fee collection.
/// All expense tracking is done off-chain in Supabase for:
/// - Zero gas costs for expense creation
/// - Instant updates
/// - Easy editing/deletion
/// - No abuse vectors
///
/// On-chain settlements ensure trustless USDC transfers with platform fees.
///
/// ============================================================================

module friend_fi::expense_splitting {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// USDC metadata address on Movement testnet.
    const USDC_METADATA_ADDR: address =
        @0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7;

    /// Escrow object seed for expense settlements.
    const ESCROW_OBJECT_SEED: vector<u8> = b"FRIEND_FI_EXPENSE_ESCROW";

    /// Fee numerator for settlement rake (3 = 0.3%).
    const RAKE_NUMERATOR: u64 = 3;

    /// Fee denominator for settlement rake (1000 = 0.3%).
    const RAKE_DENOMINATOR: u64 = 1000;

    // =========================================================================
    // ERROR CODES
    // =========================================================================

    const E_ALREADY_INITIALIZED: u64 = 1;
    const E_NOT_ADMIN: u64 = 2;
    const E_NOT_INITIALIZED: u64 = 3;
    const E_INSUFFICIENT_AMOUNT: u64 = 16;

    // =========================================================================
    // HELPER FUNCTIONS
    // =========================================================================

    fun admin_address(): address {
        @friend_fi
    }

    fun usdc_metadata(): object::Object<fungible_asset::Metadata> {
        object::address_to_object<fungible_asset::Metadata>(USDC_METADATA_ADDR)
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct SettlementMadeEvent has drop, store {
        debtor: address,
        creditor: address,
        amount_gross: u64,
        amount_net: u64,
        fee: u64,
    }

    // =========================================================================
    // ESCROW OBJECT & CONFIGURATION
    // =========================================================================

    #[resource_group_member(group = aptos_framework::object::ObjectGroup)]
    struct EscrowMarker has key {}

    /// App configuration for expense module.
    struct AppConfig has key {
        /// ExtendRef for escrow object.
        extend_ref: object::ExtendRef,

        /// USDC store owned by escrow (for fee accumulation).
        escrow_store: object::Object<fungible_asset::FungibleStore>,

        /// Total fees accumulated.
        fee_accumulator: u64,
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the expense splitting module.
    /// Sets up USDC escrow for fee collection.
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // Create escrow object for USDC fees
        let constructor_ref = object::create_named_object(
            admin,
            ESCROW_OBJECT_SEED,
        );

        let escrow_signer = object::generate_signer(&constructor_ref);
        move_to(&escrow_signer, EscrowMarker {});

        let extend_ref = object::generate_extend_ref(&constructor_ref);
        let metadata = usdc_metadata();
        let escrow_store = fungible_asset::create_store(
            &constructor_ref,
            metadata,
        );

        move_to(admin, AppConfig {
            extend_ref,
            escrow_store,
            fee_accumulator: 0,
        });
    }

    #[test_only]
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // For testing, just create minimal AppConfig
        move_to(admin, AppConfig {
            extend_ref: object::generate_extend_ref(
                &object::create_object(signer::address_of(admin))
            ),
            escrow_store: object::address_to_object(admin_address()),
            fee_accumulator: 0,
        });
    }

    // =========================================================================
    // SETTLEMENT FUNCTION (Only on-chain function)
    // =========================================================================

    /// Settle a debt by transferring USDC with 0.3% fee.
    /// 
    /// USAGE:
    /// 1. Off-chain: Track all expenses in Supabase
    /// 2. Off-chain: Calculate net debts (who owes whom)
    /// 3. On-chain: Call this function to settle with USDC
    /// 
    /// The fee is deducted from the settlement amount, so the creditor
    /// receives slightly less than the gross amount.
    /// 
    /// Example:
    /// - Debtor sends 1.0 USDC
    /// - Fee: 0.003 USDC (0.3%)
    /// - Creditor receives: 0.997 USDC
    /// - Platform keeps: 0.003 USDC
    public entry fun settle_debt(
        debtor: &signer,
        creditor: address,
        amount: u64,
    ) acquires AppConfig {
        assert!(amount > 0, E_INSUFFICIENT_AMOUNT);

        let debtor_addr = signer::address_of(debtor);

        // Calculate fee (0.3%)
        let fee = (amount * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
        let net_to_creditor = amount - fee;

        // Transfer USDC from debtor to creditor (net amount)
        let metadata = usdc_metadata();
        let fa = primary_fungible_store::withdraw(debtor, metadata, amount);
        let fee_asset = fungible_asset::extract(&mut fa, fee);

        // Deposit net amount to creditor
        primary_fungible_store::deposit(creditor, fa);

        // Store fee in escrow
        let app = borrow_global_mut<AppConfig>(admin_address());
        fungible_asset::deposit(app.escrow_store, fee_asset);
        app.fee_accumulator = app.fee_accumulator + fee;

        // Emit event
        event::emit(SettlementMadeEvent {
            debtor: debtor_addr,
            creditor,
            amount_gross: amount,
            amount_net: net_to_creditor,
            fee,
        });
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /// Withdraw accumulated fees (admin only).
    public entry fun withdraw_fees(admin: &signer, amount: u64) acquires AppConfig {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);

        let app = borrow_global_mut<AppConfig>(admin_address());
        assert!(amount > 0, E_INSUFFICIENT_AMOUNT);
        assert!(amount <= app.fee_accumulator, E_INSUFFICIENT_AMOUNT);

        let escrow_signer = object::generate_signer_for_extending(&app.extend_ref);
        let fa = fungible_asset::withdraw(&escrow_signer, app.escrow_store, amount);
        app.fee_accumulator = app.fee_accumulator - amount;
        primary_fungible_store::deposit(admin_addr, fa);
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    #[view]
    public fun total_fees_accumulated(): u64 acquires AppConfig {
        if (!exists<AppConfig>(admin_address())) {
            return 0
        };
        borrow_global<AppConfig>(admin_address()).fee_accumulator
    }

    #[view]
    public fun escrow_balance(): u64 acquires AppConfig {
        if (!exists<AppConfig>(admin_address())) {
            return 0
        };
        let app = borrow_global<AppConfig>(admin_address());
        fungible_asset::balance(app.escrow_store)
    }

    // =========================================================================
    // TESTS
    // =========================================================================

    #[test(admin = @friend_fi)]
    fun test_init(admin: &signer) acquires AppConfig {
        init_for_testing(admin);
        assert!(total_fees_accumulated() == 0, 0);
    }
}
