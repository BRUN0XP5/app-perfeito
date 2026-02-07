-- SUPORTE COMPLETO PARA ATIVOS DA BOLSA (AÇÕES E FIIs)
-- Este script adiciona as colunas necessárias na tabela 'maquinas' que estavam faltando após o reset.

ALTER TABLE public.maquinas 
ADD COLUMN IF NOT EXISTS investment_type TEXT DEFAULT 'CDB', -- 'CDB', 'IPCA', 'LCI', 'LCA', 'ACAO', 'FII'
ADD COLUMN IF NOT EXISTS yield_mode TEXT DEFAULT 'POS', -- 'PRE', 'POS'
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly', -- 'daily', 'monthly', 'quarterly', 'semiannual', 'annual'
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_purchase_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS paused BOOLEAN DEFAULT FALSE;

-- Adiciona índices para melhorar a filtragem por tipo de investimento
CREATE INDEX IF NOT EXISTS idx_maquinas_investment_type ON public.maquinas(investment_type);

-- Comentários para documentação no Supabase
COMMENT ON COLUMN public.maquinas.investment_type IS 'Tipo do ativo: Renda Fixa (CDB, IPCA, etc) ou Bolsa (ACAO, FII)';
COMMENT ON COLUMN public.maquinas.yield_mode IS 'Modo de rentabilidade: PRE (Taxa Fixa) ou POS (indexado ao CDI)';
COMMENT ON COLUMN public.maquinas.stock_quantity IS 'Quantidade de cotas ou ações para ativos da bolsa';
COMMENT ON COLUMN public.maquinas.stock_purchase_price IS 'Preço pago por cada cota/ação no momento da compra';
COMMENT ON COLUMN public.maquinas.payment_frequency IS 'Freqüência com que o dividendo cai no saldo';

SELECT 'COLUNAS DA BOLSA ADICIONADAS COM SUCESSO! Agora você pode investir em Ações e FIIs.' as status;
