-- Adiciona a coluna cumulative_deposits para rastrear o progresso de recompensas de skins
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS cumulative_deposits NUMERIC DEFAULT 0;
