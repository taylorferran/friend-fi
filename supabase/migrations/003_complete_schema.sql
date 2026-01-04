-- Migration: Complete schema for Friend-Fi hybrid architecture
-- This ensures all necessary tables exist for off-chain data storage

-- ============================================================================
-- PROFILES TABLE (Already exists, but ensuring structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
    wallet_address TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    avatar_id INTEGER NOT NULL DEFAULT 0,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- ============================================================================
-- GROUPS TABLE (Already exists, but ensuring structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS groups (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    password_hash TEXT NOT NULL,
    admin_address TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_groups_admin ON groups(admin_address);

-- ============================================================================
-- GROUP MEMBERS TABLE (Already exists, but ensuring structure)
-- ============================================================================

CREATE TABLE IF NOT EXISTS group_members (
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, wallet_address)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_group_members_wallet ON group_members(wallet_address);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

-- ============================================================================
-- BETS TABLE (For metadata - on_chain_bet_id links to blockchain)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bets (
    id SERIAL PRIMARY KEY,
    on_chain_bet_id INTEGER NOT NULL UNIQUE,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    outcomes JSONB NOT NULL, -- Array of outcome strings
    admin_address TEXT NOT NULL,
    encrypted_payload BYTEA, -- Optional encrypted data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bets_group ON bets(group_id);
CREATE INDEX IF NOT EXISTS idx_bets_on_chain ON bets(on_chain_bet_id);
CREATE INDEX IF NOT EXISTS idx_bets_admin ON bets(admin_address);

-- ============================================================================
-- EXPENSES TABLE (Fully off-chain - no on-chain reference needed)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    total_amount BIGINT NOT NULL, -- In micro-USDC (6 decimals)
    payer_address TEXT NOT NULL,
    split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'exact', 'percentage')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_expenses_group ON expenses(group_id);
CREATE INDEX IF NOT EXISTS idx_expenses_payer ON expenses(payer_address);

-- ============================================================================
-- EXPENSE SPLITS TABLE (Who owes what for each expense)
-- ============================================================================

CREATE TABLE IF NOT EXISTS expense_splits (
    id SERIAL PRIMARY KEY,
    expense_id INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
    participant_address TEXT NOT NULL,
    amount BIGINT NOT NULL, -- In micro-USDC
    UNIQUE (expense_id, participant_address)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_expense_splits_expense ON expense_splits(expense_id);
CREATE INDEX IF NOT EXISTS idx_expense_splits_participant ON expense_splits(participant_address);

-- ============================================================================
-- COMMITMENTS TABLE (Habit tracker - hybrid: on-chain money, off-chain check-ins)
-- ============================================================================

CREATE TABLE IF NOT EXISTS commitments (
    id SERIAL PRIMARY KEY,
    on_chain_commitment_id INTEGER, -- Can be NULL if not yet on-chain
    group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE,
    participant_a TEXT NOT NULL,
    participant_b TEXT NOT NULL,
    commitment_name TEXT NOT NULL,
    weekly_payout BIGINT NOT NULL, -- In micro-USDC
    weekly_check_ins_required INTEGER NOT NULL,
    duration_weeks INTEGER NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_commitments_group ON commitments(group_id);
CREATE INDEX IF NOT EXISTS idx_commitments_participant_a ON commitments(participant_a);
CREATE INDEX IF NOT EXISTS idx_commitments_participant_b ON commitments(participant_b);

-- ============================================================================
-- CHECK_INS TABLE (NEW - Fully off-chain habit check-ins)
-- ============================================================================

CREATE TABLE IF NOT EXISTS check_ins (
    id SERIAL PRIMARY KEY,
    commitment_id INTEGER REFERENCES commitments(id) ON DELETE CASCADE,
    wallet_address TEXT NOT NULL,
    week INTEGER NOT NULL,
    check_in_count INTEGER DEFAULT 1,
    notes TEXT,
    photo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (commitment_id, wallet_address, week)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_check_ins_commitment ON check_ins(commitment_id);
CREATE INDEX IF NOT EXISTS idx_check_ins_wallet ON check_ins(wallet_address);
CREATE INDEX IF NOT EXISTS idx_check_ins_week ON check_ins(commitment_id, week);

-- Enable incrementing check_in_count on conflict (multiple check-ins same week)
-- This allows upsert behavior: INSERT ... ON CONFLICT DO UPDATE

COMMENT ON TABLE check_ins IS 'Habit tracker check-ins (fully off-chain). Weekly check-ins are recorded here and used for on-chain weekly settlement.';
COMMENT ON COLUMN check_ins.check_in_count IS 'Number of check-ins this week (can increment with each check-in)';
COMMENT ON COLUMN check_ins.week IS 'Week number (0-based from commitment start)';

-- ============================================================================
-- HELPER VIEWS (Optional - for easier querying)
-- ============================================================================

-- View: Group members with profile info
CREATE OR REPLACE VIEW group_members_with_profiles AS
SELECT 
    gm.group_id,
    gm.wallet_address,
    gm.joined_at,
    p.username,
    p.avatar_id,
    p.bio
FROM group_members gm
LEFT JOIN profiles p ON gm.wallet_address = p.wallet_address;

-- View: Expenses with payer profile
CREATE OR REPLACE VIEW expenses_with_profiles AS
SELECT 
    e.*,
    p.username as payer_username,
    p.avatar_id as payer_avatar_id
FROM expenses e
LEFT JOIN profiles p ON e.payer_address = p.wallet_address;

-- View: Current week check-ins summary
CREATE OR REPLACE VIEW current_week_check_ins AS
SELECT 
    commitment_id,
    wallet_address,
    week,
    check_in_count,
    MAX(created_at) as last_check_in,
    COUNT(*) as total_entries
FROM check_ins
GROUP BY commitment_id, wallet_address, week;

-- ============================================================================
-- UPDATED_AT TRIGGER (For tables that need it)
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to groups
DROP TRIGGER IF EXISTS update_groups_updated_at ON groups;
CREATE TRIGGER update_groups_updated_at 
    BEFORE UPDATE ON groups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - Optional but recommended for production
-- ============================================================================

-- Enable RLS on sensitive tables (uncomment for production)
-- ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can read their own profile
-- CREATE POLICY "Users can view their own profile" ON profiles
--     FOR SELECT USING (wallet_address = current_user);

-- Example policy: Group members can view their group
-- CREATE POLICY "Group members can view their group" ON groups
--     FOR SELECT USING (
--         id IN (SELECT group_id FROM group_members WHERE wallet_address = current_user)
--     );

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Additional composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_check_ins_commitment_week ON check_ins(commitment_id, week);
CREATE INDEX IF NOT EXISTS idx_expenses_group_created ON expenses(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_group_created ON bets(group_id, created_at DESC);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles (off-chain). Wallet address is the primary identifier.';
COMMENT ON TABLE groups IS 'Groups (off-chain metadata). On-chain contract only stores member list.';
COMMENT ON TABLE group_members IS 'Group membership (off-chain). Synced with on-chain for access control.';
COMMENT ON TABLE bets IS 'Bet metadata (off-chain). Links to on-chain bet via on_chain_bet_id.';
COMMENT ON TABLE expenses IS 'Expenses (fully off-chain). No on-chain representation.';
COMMENT ON TABLE commitments IS 'Habit commitments (hybrid). Money is on-chain, check-ins are off-chain.';

-- ============================================================================
-- DONE!
-- ============================================================================

-- All tables created with proper indexes, triggers, and relationships.
-- Schema supports the hybrid architecture:
-- - Critical data (money, access control): On-chain
-- - Metadata (names, descriptions, check-ins): Off-chain (Supabase)

