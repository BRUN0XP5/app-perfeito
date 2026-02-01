-- SCRIPT PARA FIX DE STREAK E MISSÕES DIÁRIAS
-- Adiciona colunas faltantes na tabela user_stats para persistência de dados.

ALTER TABLE public.user_stats 
ADD COLUMN IF NOT EXISTS daily_streak INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_streak_date TEXT,
ADD COLUMN IF NOT EXISTS last_daily_reset TEXT;

COMMENT ON COLUMN public.user_stats.daily_streak IS 'Contagem de dias consecutivos ativos (Fogo)';
COMMENT ON COLUMN public.user_stats.last_streak_date IS 'Data do último incremento da streak (YYYY-MM-DD)';
COMMENT ON COLUMN public.user_stats.last_daily_reset IS 'Data do último reset de missões diárias (YYYY-MM-DD)';
