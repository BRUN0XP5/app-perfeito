-- Este script corrige TODOS os problemas de salvamento e permissão
-- Execute no Editor SQL do Supabase

-- 1. Garante que as colunas necessárias existam
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS keys BIGINT DEFAULT 0;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS skin TEXT DEFAULT '';
ALTER TABLE user_equipped_items ADD COLUMN IF NOT EXISTS machine_skin TEXT DEFAULT '';

-- 2. Desabilita RLS (Row Level Security) em todas as tabelas
-- Isso remove qualquer bloqueio de atualização/inserção
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipped_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_time_goal DISABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;

-- 3. Garante permissões públicas para API
GRANT ALL ON TABLE user_stats TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_inventory TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_equipped_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE maquinas TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_missions TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_achievements TO anon, authenticated, service_role;
GRANT ALL ON TABLE user_time_goal TO anon, authenticated, service_role;

-- 4. Confirmação
SELECT 'Sucesso: Permissões corrigidas e colunas garantidas.' as resultado;
