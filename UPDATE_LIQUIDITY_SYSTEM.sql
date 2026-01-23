-- ATUALIZAÇÃO DO SISTEMA DE LIQUIDEZ E REALISMO FINANCEIRO
-- Baseado nas Caixinhas do Nubank e conceitos reais de Renda Fixa

-- 1. Melhorias na tabela de Máquinas (Ativos)
-- Adiciona suporte para liquidez (D+0, D+30, etc) e capacidade máxima
ALTER TABLE maquinas 
ADD COLUMN IF NOT EXISTS liquidity_type TEXT DEFAULT 'daily', -- 'daily' (D+0), 'locked_30' (D+30), 'locked_365' (D+365)
ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP WITH TIME ZONE, -- Data até quando o resgate está bloqueado
ADD COLUMN IF NOT EXISTS max_capacity NUMERIC DEFAULT NULL; -- Limite de investimento nesta "caixinha" (null = sem limite)

-- 2. Melhorias no Histórico para o "Gráfico de Escada"
-- Precisamos salvar não apenas o lucro do dia, mas o snapshot do patrimônio total e do total investido (principal)
ALTER TABLE mining_history
ADD COLUMN IF NOT EXISTS total_patrimony_snapshot NUMERIC DEFAULT 0, -- Quanto valia tudo no dia
ADD COLUMN IF NOT EXISTS total_invested_snapshot NUMERIC DEFAULT 0; -- Quanto saiu do bolso do usuário (Principal)

-- 3. Atualização de Stats para controle preciso
-- Garante que temos o registro do total investido "do bolso" para cálculo fidedigno
ALTER TABLE user_stats
ADD COLUMN IF NOT EXISTS total_principal_invested NUMERIC DEFAULT 0; -- Acumulado de depósitos reais (sem contar reinvestimentos de lucro)

-- 4. Comentários para documentação
COMMENT ON COLUMN maquinas.liquidity_type IS 'Tipo de liquidez: daily (Imediata), locked_30 (30 dias), locked_365 (1 ano)';
COMMENT ON COLUMN maquinas.max_capacity IS 'Teto do FGC ou limite do produto. Excedente não rende ou vai para saldo livre.';
COMMENT ON COLUMN mining_history.total_invested_snapshot IS 'Usado para gerar o Gráfico de Escada (Principal vs Juros)';
