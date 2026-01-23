-- Adicionar colunas de saldo em moeda estrangeira
ALTER TABLE user_stats 
ADD COLUMN IF NOT EXISTS usd_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS jpy_balance NUMERIC DEFAULT 0;
