-- ==========================================
-- SCRIPT DE CORREÇÃO FINAL DO BANCO DE DATAS
-- Executar este script no SQL Editor do Supabase
-- ==========================================

-- 1. CORREÇÃO DA TABELA user_stats (Saldos, Missões e Diversos)
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS salary NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS salary_day INT DEFAULT 5,
ADD COLUMN IF NOT EXISTS daily_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date TEXT,
ADD COLUMN IF NOT EXISTS last_daily_reset TEXT,
ADD COLUMN IF NOT EXISTS last_deposit_value NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS usd_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS jpy_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cumulative_deposits NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_principal_invested NUMERIC DEFAULT 0;

-- 2. ADIÇÃO DE TODAS AS SKINS FALTANTES EM user_stats
ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS skin_plasma INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_pixel_art INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_aurora INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_obsidian INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_quantum INT DEFAULT 0;

-- 3. CORREÇÃO DA TABELA user_achievements (Conquistas)
-- Garante a coluna notified
ALTER TABLE public.user_achievements 
ADD COLUMN IF NOT EXISTS notified BOOLEAN DEFAULT FALSE;

-- Garante a restrição de unicidade para o comando upsert funcionar
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_user_id_achievement_id_key') THEN
        ALTER TABLE public.user_achievements ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);
    END IF;
END $$;

-- 4. DESABILITAR RLS (SEGURANÇA) PARA FUNCIONAMENTO DO APP
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipped_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_time_goal DISABLE ROW LEVEL SECURITY;

-- 5. PERMISSÕES PARA AMBIENTES SEM AUTH NATIVA
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

SELECT 'CORREÇÃO SQL APLICADA COM SUCESSO! O banco está pronto para a v0.41.0.' as status;
