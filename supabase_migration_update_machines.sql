-- Adiciona as colunas para suportar tipos de investimento e modo de rendimento
ALTER TABLE maquinas 
ADD COLUMN IF NOT EXISTS investment_type TEXT DEFAULT 'CDB',
ADD COLUMN IF NOT EXISTS yield_mode TEXT DEFAULT 'POS';

-- investment_type pode ser: 'CDB', 'IPCA', 'LCI', 'LCA'
-- yield_mode pode ser: 'POS' (Pós-fixado), 'PRE' (Pré-fixado)
