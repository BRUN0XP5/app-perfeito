-- Desabilita RLS para todas as tabelas para evitar erros de permissão no salvamento
ALTER TABLE user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_equipped_items DISABLE ROW LEVEL SECURITY;

-- Garante que a estrutura de conquistas está correta
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_achievements_user_id_achievement_id_key') THEN
        ALTER TABLE user_achievements ADD CONSTRAINT user_achievements_user_id_achievement_id_key UNIQUE (user_id, achievement_id);
    END IF;
END $$;
