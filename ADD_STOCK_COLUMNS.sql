-- Adiciona suporte para ativos da bolsa criados manualmente
ALTER TABLE maquinas 
ADD COLUMN IF NOT EXISTS payment_frequency TEXT DEFAULT 'monthly', -- 'daily', 'monthly', 'quarterly', 'semiannual', 'annual'
ADD COLUMN IF NOT EXISTS stock_quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_purchase_price NUMERIC DEFAULT 0;

-- Comentários
COMMENT ON COLUMN maquinas.payment_frequency IS 'Freqüência de pagamento de dividendos/rendimento';
COMMENT ON COLUMN maquinas.stock_quantity IS 'Quantidade de cotas/ações';
COMMENT ON COLUMN maquinas.stock_purchase_price IS 'Preço médio de compra';
