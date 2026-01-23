-- Tabela para Missões do Usuário
CREATE TABLE IF NOT EXISTS user_missions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  mission_id BIGINT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  target NUMERIC NOT NULL,
  claimed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mission_id)
);

-- Tabela para Inventário de Itens
CREATE TABLE IF NOT EXISTS user_inventory (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  item_type TEXT NOT NULL,
  css_class TEXT,
  rarity TEXT,
  acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Itens Equipados
CREATE TABLE IF NOT EXISTS user_equipped_items (
  user_id UUID PRIMARY KEY,
  aura TEXT DEFAULT '',
  nick_color TEXT DEFAULT '',
  background TEXT DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela para Conquistas (Achievements)
CREATE TABLE IF NOT EXISTS user_achievements (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL,
  unlocked BOOLEAN DEFAULT FALSE,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, achievement_id)
);

-- Tabela para Meta de Tempo
CREATE TABLE IF NOT EXISTS user_time_goal (
  user_id UUID PRIMARY KEY,
  goal_name TEXT NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Adicionar coluna account_created_at na tabela user_stats se não existir
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS account_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_user_missions_user_id ON user_missions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);

-- Comentários para documentação
COMMENT ON TABLE user_missions IS 'Armazena as missões personalizadas de cada usuário';
COMMENT ON TABLE user_inventory IS 'Inventário de itens cosméticos desbloqueados';
COMMENT ON TABLE user_equipped_items IS 'Itens atualmente equipados pelo usuário';
COMMENT ON TABLE user_achievements IS 'Conquistas desbloqueadas por cada usuário';
COMMENT ON TABLE user_time_goal IS 'Meta de tempo definida pelo usuário';
