-- Migration: Remove on_chain_id from groups table
-- Groups are now 100% off-chain (no blockchain integration needed)

-- Drop the on_chain_id column (it's no longer used)
ALTER TABLE groups DROP COLUMN IF EXISTS on_chain_id;

-- No need for on_chain_id unique constraint anymore
-- (it was dropped automatically with the column)

-- That's it! Groups are now pure Supabase with auto-increment IDs

