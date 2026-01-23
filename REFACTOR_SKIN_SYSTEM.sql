-- REFACTOR_SKIN_SYSTEM.sql
-- Updates the user_stats table with the NEW creative skin counters
-- Deletes old skin columns if they exist (optional, but keep it clean)

ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_carbon bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_vaporwave bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_glitch bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_royal bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_ghost bigint DEFAULT 0;

-- 10 NEW SKINS
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_cyber bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_forest bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_magma bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_ice bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_neon_pink bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_gold_black bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_sunset bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_space bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_emerald bigint DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS skin_hacker bigint DEFAULT 0;
