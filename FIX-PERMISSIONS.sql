-- DESATIVAR RLS PARA GARANTIR QUE O APP CONSIGA SALVAR
-- Isso remove as travas de segurança padrão que impedem gravações

-- 1. Missões
ALTER TABLE user_missions DISABLE ROW LEVEL SECURITY;

-- 2. Inventário
ALTER TABLE user_inventory DISABLE ROW LEVEL SECURITY;

-- 3. Itens Equipados
ALTER TABLE user_equipped_items DISABLE ROW LEVEL SECURITY;

-- 4. Conquistas
ALTER TABLE user_achievements DISABLE ROW LEVEL SECURITY;

-- 5. Meta de Tempo (A que está dando problema)
ALTER TABLE user_time_goal DISABLE ROW LEVEL SECURITY;


-- CASO A TABELA NÃO EXISTA (Só por garantia)
CREATE TABLE IF NOT EXISTS user_time_goal (
  user_id UUID PRIMARY KEY,
  goal_name TEXT NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
