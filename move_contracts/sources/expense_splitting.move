/// ============================================================================
/// Friend-Fi Expense Splitting Module
/// ============================================================================
///
/// This module implements a complete expense splitting system similar to
/// Splitwise/SettleUp with the following features:
///
/// 1. EXPENSE MANAGEMENT
///    - Create expenses with description, amount, and payer
///    - Support multiple split types: equal, by percentage, by exact amount
///    - Track who paid and who owes what
///
/// 2. DEBT TRACKING
///    - Automatically calculate balances between members
///    - Simplify debts (A owes B $10, B owes C $10 -> A owes C $10)
///    - Real-time balance queries
///
/// 3. SETTLEMENT SYSTEM
///    - Mark debts as settled when paid
///    - Support partial settlements
///    - USDC integration for on-chain payments
///    - Track settlement history
///
/// 4. GROUP INTEGRATION
///    - Uses the shared groups module for member management
///    - Expenses are scoped to groups
///    - Only group members can add expenses
///
/// ============================================================================

module friend_fi::expense_splitting {

    // =========================================================================
    // IMPORTS
    // =========================================================================

    use std::signer;
    use std::string::{String, utf8};
    use std::vector;
    use aptos_framework::event;
    use aptos_framework::fungible_asset;
    use aptos_framework::object;
    use aptos_framework::primary_fungible_store;
    use friend_fi::groups;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// USDC metadata address on Movement testnet.
    /// IMPORTANT: Update for mainnet deployment.
    const USDC_METADATA_ADDR: address =
        @0xb89077cfd2a82a0c1450534d49cfd5f2707643155273069bc23a912bcfefdee7;

    /// Escrow object seed for expense settlements.
    const ESCROW_OBJECT_SEED: vector<u8> = b"FRIEND_FI_EXPENSE_ESCROW";

    /// Split type: Equal split among all participants.
    const SPLIT_TYPE_EQUAL: u8 = 1;

    /// Split type: Custom percentage per participant.
    const SPLIT_TYPE_PERCENTAGE: u8 = 2;

    /// Split type: Exact amount per participant.
    const SPLIT_TYPE_EXACT: u8 = 3;

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
    const E_BAD_EXPENSE_ID: u64 = 10;
    const E_NOT_GROUP_MEMBER: u64 = 11;
    const E_INVALID_SPLIT_DATA: u64 = 12;
    const E_SPLIT_AMOUNTS_DONT_MATCH: u64 = 13;
    const E_EMPTY_PARTICIPANTS: u64 = 14;
    const E_PAYER_NOT_IN_PARTICIPANTS: u64 = 15;
    const E_INSUFFICIENT_AMOUNT: u64 = 16;
    const E_NO_DEBT_EXISTS: u64 = 17;
    const E_PERCENTAGE_SUM_NOT_100: u64 = 18;
    const E_INVALID_SPLIT_TYPE: u64 = 19;

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
    // CORE DATA STRUCTURES
    // =========================================================================

    /// Represents a single participant's share in an expense.
    struct Split has store, copy, drop {
        /// Participant's address.
        participant: address,

        /// Amount they owe (in USDC units).
        amount: u64,
    }

    /// An expense record.
    struct Expense has store {
        /// Group this expense belongs to.
        group_id: u64,

        /// Description of the expense.
        description: String,

        /// Total amount of the expense (in USDC units).
        total_amount: u64,

        /// Who paid for this expense.
        payer: address,

        /// How the expense is split.
        split_type: u8,

        /// List of participants and their shares.
        splits: vector<Split>,

        /// Timestamp (block height) when created.
        created_at: u64,
    }

    /// Tracks a debt between two people.
    struct Debt has store, copy, drop {
        /// Who owes money.
        debtor: address,

        /// Who is owed money.
        creditor: address,

        /// Amount owed (in USDC units).
        amount: u64,
    }

    /// Settlement record when a debt is paid.
    struct Settlement has store {
        /// Original debt being settled.
        debtor: address,
        creditor: address,

        /// Amount settled.
        amount: u64,

        /// Expense ID this relates to (0 if general settlement).
        expense_id: u64,

        /// Timestamp (block height) when settled.
        settled_at: u64,
    }

    // =========================================================================
    // EVENT DEFINITIONS
    // =========================================================================

    #[event]
    struct ExpenseCreatedEvent has drop, store {
        expense_id: u64,
        group_id: u64,
        payer: address,
        total_amount: u64,
        description: String,
    }

    #[event]
    struct DebtUpdatedEvent has drop, store {
        group_id: u64,
        debtor: address,
        creditor: address,
        amount: u64,
    }

    #[event]
    struct SettlementMadeEvent has drop, store {
        debtor: address,
        creditor: address,
        amount: u64,
        expense_id: u64,
    }

    #[event]
    struct FeeCollectedEvent has drop, store {
        debtor: address,
        creditor: address,
        settlement_amount: u64,
        fee_amount: u64,
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

        /// USDC store owned by escrow.
        escrow_store: object::Object<fungible_asset::FungibleStore>,
    }

    // =========================================================================
    // GLOBAL STATE
    // =========================================================================

    /// Per-group expense tracking.
    struct GroupExpenses has store {
        /// Group ID.
        group_id: u64,

        /// All expenses in this group.
        expenses: vector<Expense>,

        /// Current debts between members (simplified).
        /// This is a flattened list of all debts in the group.
        debts: vector<Debt>,

        /// Settlement history.
        settlements: vector<Settlement>,
    }

    /// Global state for expense splitting.
    struct State has key {
        /// Expenses organized by group.
        /// group_expenses[i] corresponds to group_id i.
        /// Index = group_id from the groups module.
        group_expenses: vector<GroupExpenses>,
    }

    // =========================================================================
    // STATE ACCESS HELPERS
    // =========================================================================

    inline fun borrow_state_mut(): &mut State {
        borrow_global_mut<State>(admin_address())
    }

    inline fun borrow_state(): &State {
        borrow_global<State>(admin_address())
    }

    inline fun borrow_app_config_mut(): &mut AppConfig {
        assert!(exists<AppConfig>(admin_address()), E_NOT_INITIALIZED);
        borrow_global_mut<AppConfig>(admin_address())
    }

    inline fun borrow_app_config(): &AppConfig {
        assert!(exists<AppConfig>(admin_address()), E_NOT_INITIALIZED);
        borrow_global<AppConfig>(admin_address())
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// Initialize the expense splitting module.
    /// Sets up USDC escrow for settlements.
    public entry fun init(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);
        assert!(!exists<AppConfig>(admin_addr), E_ALREADY_INITIALIZED);

        // Create escrow object for USDC
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
        });

        // Initialize state
        move_to(admin, State {
            group_expenses: vector::empty<GroupExpenses>(),
        });
    }

    #[test_only]
    /// Test-only initialization without USDC escrow.
    public fun init_for_testing(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(admin_addr == admin_address(), E_NOT_ADMIN);
        assert!(!exists<State>(admin_addr), E_ALREADY_INITIALIZED);

        move_to(admin, State {
            group_expenses: vector::empty<GroupExpenses>(),
        });
    }

    // =========================================================================
    // HELPER FUNCTIONS - GROUP EXPENSES ACCESS
    // =========================================================================

    /// Ensure GroupExpenses exists for a group_id.
    /// Creates it if it doesn't exist.
    fun ensure_group_expenses(state: &mut State, group_id: u64) {
        let current_len = vector::length(&state.group_expenses);
        
        // Fill gaps if needed (if group_id > current_len)
        while (current_len <= group_id) {
            let new_group_expenses = GroupExpenses {
                group_id: current_len,
                expenses: vector::empty<Expense>(),
                debts: vector::empty<Debt>(),
                settlements: vector::empty<Settlement>(),
            };
            vector::push_back(&mut state.group_expenses, new_group_expenses);
            current_len = current_len + 1;
        };
    }

    /// Get mutable reference to GroupExpenses.
    fun borrow_group_expenses_mut(state: &mut State, group_id: u64): &mut GroupExpenses {
        ensure_group_expenses(state, group_id);
        vector::borrow_mut(&mut state.group_expenses, group_id)
    }

    /// Get immutable reference to GroupExpenses.
    fun borrow_group_expenses(state: &State, group_id: u64): &GroupExpenses {
        assert!(group_id < vector::length(&state.group_expenses), E_BAD_EXPENSE_ID);
        vector::borrow(&state.group_expenses, group_id)
    }

    // =========================================================================
    // DEBT SIMPLIFICATION
    // =========================================================================

    /// Find a debt in the debts vector.
    /// Returns (found, index).
    fun find_debt(debts: &vector<Debt>, debtor: address, creditor: address): (bool, u64) {
        let len = vector::length(debts);
        let i = 0;
        while (i < len) {
            let d = vector::borrow(debts, i);
            if (d.debtor == debtor && d.creditor == creditor) {
                return (true, i)
            };
            i = i + 1;
        };
        (false, 0)
    }

    /// Add or update a debt in the debts list.
    /// Simplifies: if A owes B $10 and we add B owes A $5, result is A owes B $5.
    fun add_debt(debts: &mut vector<Debt>, debtor: address, creditor: address, amount: u64) {
        // Don't add zero debts
        if (amount == 0) {
            return
        };

        // Check if reverse debt exists (creditor owes debtor)
        let (reverse_found, reverse_idx) = find_debt(debts, creditor, debtor);
        if (reverse_found) {
            let reverse_debt = vector::borrow_mut(debts, reverse_idx);
            if (reverse_debt.amount > amount) {
                // Reduce reverse debt
                reverse_debt.amount = reverse_debt.amount - amount;
                return
            } else if (reverse_debt.amount == amount) {
                // Cancel out completely
                vector::remove(debts, reverse_idx);
                return
            } else {
                // Reverse the debt
                let remaining = amount - reverse_debt.amount;
                vector::remove(debts, reverse_idx);
                // Continue to add the remaining as normal debt
                amount = remaining;
            };
        };

        // Check if debt already exists (debtor owes creditor)
        let (found, idx) = find_debt(debts, debtor, creditor);
        if (found) {
            let debt = vector::borrow_mut(debts, idx);
            debt.amount = debt.amount + amount;
        } else {
            // Create new debt
            vector::push_back(debts, Debt {
                debtor,
                creditor,
                amount,
            });
        };
    }

    // =========================================================================
    // EXPENSE CREATION
    // =========================================================================

    /// Create an equal-split expense.
    /// Total amount is split equally among all participants.
    public entry fun create_expense_equal(
        account: &signer,
        group_id: u64,
        description: String,
        total_amount: u64,
        participants: vector<address>,
    ) acquires State {
        let payer = signer::address_of(account);

        // Verify payer is group member
        assert!(groups::is_member(group_id, payer), E_NOT_GROUP_MEMBER);

        // Validate participants
        assert!(vector::length(&participants) > 0, E_EMPTY_PARTICIPANTS);

        // Check payer is in participants
        let payer_in_list = false;
        let len = vector::length(&participants);
        let i = 0;
        while (i < len) {
            if (*vector::borrow(&participants, i) == payer) {
                payer_in_list = true;
            };
            i = i + 1;
        };
        assert!(payer_in_list, E_PAYER_NOT_IN_PARTICIPANTS);

        // Calculate equal split
        let num_participants = vector::length(&participants);
        let share_amount = total_amount / num_participants;
        let remainder = total_amount % num_participants;

        // Create splits
        let splits = vector::empty<Split>();
        let i = 0;
        while (i < num_participants) {
            let participant = *vector::borrow(&participants, i);
            let amount = share_amount;
            // Give remainder to first participant
            if (i == 0) {
                amount = amount + remainder;
            };
            vector::push_back(&mut splits, Split {
                participant,
                amount,
            });
            i = i + 1;
        };

        create_expense_internal(
            group_id,
            description,
            total_amount,
            payer,
            SPLIT_TYPE_EQUAL,
            splits,
        );
    }

    /// Create an expense with custom amounts per participant.
    /// The sum of all amounts must equal total_amount.
    public entry fun create_expense_exact(
        account: &signer,
        group_id: u64,
        description: String,
        total_amount: u64,
        participants: vector<address>,
        amounts: vector<u64>,
    ) acquires State {
        let payer = signer::address_of(account);

        // Verify payer is group member
        assert!(groups::is_member(group_id, payer), E_NOT_GROUP_MEMBER);

        // Validate participants and amounts match
        assert!(vector::length(&participants) > 0, E_EMPTY_PARTICIPANTS);
        assert!(vector::length(&participants) == vector::length(&amounts), E_INVALID_SPLIT_DATA);

        // Verify sum equals total
        let sum = 0;
        let len = vector::length(&amounts);
        let i = 0;
        while (i < len) {
            sum = sum + *vector::borrow(&amounts, i);
            i = i + 1;
        };
        assert!(sum == total_amount, E_SPLIT_AMOUNTS_DONT_MATCH);

        // Create splits
        let splits = vector::empty<Split>();
        let i = 0;
        while (i < len) {
            vector::push_back(&mut splits, Split {
                participant: *vector::borrow(&participants, i),
                amount: *vector::borrow(&amounts, i),
            });
            i = i + 1;
        };

        create_expense_internal(
            group_id,
            description,
            total_amount,
            payer,
            SPLIT_TYPE_EXACT,
            splits,
        );
    }

    /// Create an expense with percentage splits.
    /// Percentages should sum to 100 (represented as basis points: 10000 = 100%).
    public entry fun create_expense_percentage(
        account: &signer,
        group_id: u64,
        description: String,
        total_amount: u64,
        participants: vector<address>,
        percentages: vector<u64>, // In basis points (10000 = 100%)
    ) acquires State {
        let payer = signer::address_of(account);

        // Verify payer is group member
        assert!(groups::is_member(group_id, payer), E_NOT_GROUP_MEMBER);

        // Validate participants and percentages match
        assert!(vector::length(&participants) > 0, E_EMPTY_PARTICIPANTS);
        assert!(vector::length(&participants) == vector::length(&percentages), E_INVALID_SPLIT_DATA);

        // Verify percentages sum to 10000 (100%)
        let sum = 0;
        let len = vector::length(&percentages);
        let i = 0;
        while (i < len) {
            sum = sum + *vector::borrow(&percentages, i);
            i = i + 1;
        };
        assert!(sum == 10000, E_PERCENTAGE_SUM_NOT_100);

        // Calculate amounts from percentages
        let splits = vector::empty<Split>();
        let total_allocated = 0;
        let i = 0;
        while (i < len) {
            let percentage = *vector::borrow(&percentages, i);
            let amount = (total_amount * percentage) / 10000;
            
            // Last participant gets remainder to handle rounding
            if (i == len - 1) {
                amount = total_amount - total_allocated;
            };

            total_allocated = total_allocated + amount;

            vector::push_back(&mut splits, Split {
                participant: *vector::borrow(&participants, i),
                amount,
            });
            i = i + 1;
        };

        create_expense_internal(
            group_id,
            description,
            total_amount,
            payer,
            SPLIT_TYPE_PERCENTAGE,
            splits,
        );
    }

    /// Internal function to create an expense and update debts.
    fun create_expense_internal(
        group_id: u64,
        description: String,
        total_amount: u64,
        payer: address,
        split_type: u8,
        splits: vector<Split>,
    ) acquires State {
        let state = borrow_state_mut();
        let group_exp = borrow_group_expenses_mut(state, group_id);

        // Create expense
        let expense = Expense {
            group_id,
            description,
            total_amount,
            payer,
            split_type,
            splits,
            created_at: 0, // In production, use timestamp
        };

        let expense_id = vector::length(&group_exp.expenses);
        vector::push_back(&mut group_exp.expenses, expense);

        // Update debts
        // For each participant, if they're not the payer, they owe the payer their share
        let splits_ref = &splits;
        let len = vector::length(splits_ref);
        let i = 0;
        while (i < len) {
            let split = vector::borrow(splits_ref, i);
            if (split.participant != payer) {
                add_debt(&mut group_exp.debts, split.participant, payer, split.amount);
                
                event::emit(DebtUpdatedEvent {
                    group_id,
                    debtor: split.participant,
                    creditor: payer,
                    amount: split.amount,
                });
            };
            i = i + 1;
        };

        event::emit(ExpenseCreatedEvent {
            expense_id,
            group_id,
            payer,
            total_amount,
            description,
        });
    }

    // =========================================================================
    // SETTLEMENT FUNCTIONS
    // =========================================================================

    /// Settle a debt by transferring USDC on-chain.
    /// Amount is deducted from debtor's wallet and sent to creditor.
    /// A small fee (0.3%) is taken from the gross amount.
    public entry fun settle_debt_with_usdc(
        debtor_account: &signer,
        group_id: u64,
        creditor: address,
        amount: u64,
    ) acquires State, AppConfig {
        let debtor = signer::address_of(debtor_account);

        // Verify debt exists
        let state = borrow_state();
        let group_exp = borrow_group_expenses(state, group_id);
        let (found, debt_idx) = find_debt(&group_exp.debts, debtor, creditor);
        assert!(found, E_NO_DEBT_EXISTS);

        let debt = vector::borrow(&group_exp.debts, debt_idx);
        assert!(amount <= debt.amount, E_INSUFFICIENT_AMOUNT);

        // Calculate fee (0.3%)
        let fee = (amount * RAKE_NUMERATOR) / RAKE_DENOMINATOR;
        let net_to_creditor = amount - fee;

        // Transfer USDC: fee to escrow, net to creditor
        let metadata = usdc_metadata();
        
        // Withdraw gross amount from debtor
        let fa = primary_fungible_store::withdraw(debtor_account, metadata, amount);
        
        // Split: fee to escrow, rest to creditor
        if (fee > 0) {
            let fee_fa = fungible_asset::extract(&mut fa, fee);
            let config = borrow_app_config();
            fungible_asset::deposit(config.escrow_store, fee_fa);
        };
        
        // Send net to creditor
        primary_fungible_store::deposit(creditor, fa);

        // Update debt
        let state = borrow_state_mut();
        let group_exp = borrow_group_expenses_mut(state, group_id);
        let (_, debt_idx2) = find_debt(&group_exp.debts, debtor, creditor);
        let debt_mut = vector::borrow_mut(&mut group_exp.debts, debt_idx2);
        
        if (debt_mut.amount == amount) {
            // Fully settled - remove debt
            vector::remove(&mut group_exp.debts, debt_idx2);
        } else {
            // Partial settlement
            debt_mut.amount = debt_mut.amount - amount;
        };

        // Record settlement
        vector::push_back(&mut group_exp.settlements, Settlement {
            debtor,
            creditor,
            amount,
            expense_id: 0, // General settlement
            settled_at: 0, // Use timestamp in production
        });

        event::emit(SettlementMadeEvent {
            debtor,
            creditor,
            amount,
            expense_id: 0,
        });

        // Emit fee collection event
        if (fee > 0) {
            event::emit(FeeCollectedEvent {
                debtor,
                creditor,
                settlement_amount: amount,
                fee_amount: fee,
            });
        };
    }

    /// Mark a debt as settled (off-chain payment).
    /// Creditor must confirm the payment was received.
    public entry fun mark_debt_settled(
        creditor_account: &signer,
        group_id: u64,
        debtor: address,
        amount: u64,
    ) acquires State {
        let creditor = signer::address_of(creditor_account);

        // Verify debt exists
        let state = borrow_state_mut();
        let group_exp = borrow_group_expenses_mut(state, group_id);
        let (found, debt_idx) = find_debt(&group_exp.debts, debtor, creditor);
        assert!(found, E_NO_DEBT_EXISTS);

        let debt = vector::borrow_mut(&mut group_exp.debts, debt_idx);
        assert!(amount <= debt.amount, E_INSUFFICIENT_AMOUNT);

        if (debt.amount == amount) {
            // Fully settled - remove debt
            vector::remove(&mut group_exp.debts, debt_idx);
        } else {
            // Partial settlement
            debt.amount = debt.amount - amount;
        };

        // Record settlement
        vector::push_back(&mut group_exp.settlements, Settlement {
            debtor,
            creditor,
            amount,
            expense_id: 0,
            settled_at: 0,
        });

        event::emit(SettlementMadeEvent {
            debtor,
            creditor,
            amount,
            expense_id: 0,
        });
    }

    // =========================================================================
    // VIEW FUNCTIONS
    // =========================================================================

    #[view]
    /// Get total number of expenses in a group.
    public fun get_group_expenses_count(group_id: u64): u64 acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_expenses)) {
            return 0
        };
        let group_exp = borrow_group_expenses(state, group_id);
        vector::length(&group_exp.expenses)
    }

    #[view]
    /// Get all debts in a group.
    /// Returns parallel vectors of (debtors, creditors, amounts).
    public fun get_group_debts(group_id: u64): (vector<address>, vector<address>, vector<u64>) acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_expenses)) {
            return (vector::empty<address>(), vector::empty<address>(), vector::empty<u64>())
        };

        let group_exp = borrow_group_expenses(state, group_id);
        let debtors = vector::empty<address>();
        let creditors = vector::empty<address>();
        let amounts = vector::empty<u64>();

        let len = vector::length(&group_exp.debts);
        let i = 0;
        while (i < len) {
            let debt = vector::borrow(&group_exp.debts, i);
            vector::push_back(&mut debtors, debt.debtor);
            vector::push_back(&mut creditors, debt.creditor);
            vector::push_back(&mut amounts, debt.amount);
            i = i + 1;
        };

        (debtors, creditors, amounts)
    }

    #[view]
    /// Get balance for a user in a group (how much they owe or are owed).
    /// Returns (net_amount, is_owed).
    /// If is_owed = true, they are owed net_amount.
    /// If is_owed = false, they owe net_amount.
    public fun get_user_balance(group_id: u64, user: address): (u64, bool) acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_expenses)) {
            return (0, false)
        };

        let group_exp = borrow_group_expenses(state, group_id);
        let total_owed = 0; // How much others owe this user
        let total_owes = 0; // How much this user owes others

        let len = vector::length(&group_exp.debts);
        let i = 0;
        while (i < len) {
            let debt = vector::borrow(&group_exp.debts, i);
            if (debt.creditor == user) {
                total_owed = total_owed + debt.amount;
            };
            if (debt.debtor == user) {
                total_owes = total_owes + debt.amount;
            };
            i = i + 1;
        };

        if (total_owed > total_owes) {
            (total_owed - total_owes, true)
        } else if (total_owes > total_owed) {
            (total_owes - total_owed, false)
        } else {
            (0, false)
        }
    }

    #[view]
    /// Get specific debt amount between two users.
    /// Returns the amount debtor owes creditor (0 if no debt).
    public fun get_debt_amount(group_id: u64, debtor: address, creditor: address): u64 acquires State {
        let state = borrow_state();
        if (group_id >= vector::length(&state.group_expenses)) {
            return 0
        };

        let group_exp = borrow_group_expenses(state, group_id);
        let (found, idx) = find_debt(&group_exp.debts, debtor, creditor);
        if (!found) {
            0
        } else {
            let debt = vector::borrow(&group_exp.debts, idx);
            debt.amount
        }
    }

    #[view]
    /// Get the current USDC balance in the escrow.
    public fun get_escrow_balance(): u64 acquires AppConfig {
        let config = borrow_app_config();
        fungible_asset::balance(config.escrow_store)
    }
}

