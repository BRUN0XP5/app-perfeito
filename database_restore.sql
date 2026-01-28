-- RESTAURAÇÃO DO BANCO DE DADOS (DATABASE RESTORE)

-- 1. Tabela de Usuários (Login simples)
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela de Estatísticas do Usuário (Saldo, Salário, etc)
CREATE TABLE IF NOT EXISTS user_stats (
    user_id UUID REFERENCES usuarios(id) PRIMARY KEY,
    balance NUMERIC DEFAULT 0,
    salary NUMERIC DEFAULT 0,
    salary_day INTEGER DEFAULT 5,
    usd_balance NUMERIC DEFAULT 0,
    jpy_balance NUMERIC DEFAULT 0,
    last_deposit_value NUMERIC DEFAULT 0,
    equipped_background TEXT DEFAULT 'dark',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela de Máquinas (Investimentos)
CREATE TABLE IF NOT EXISTS maquinas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES usuarios(id),
    nome TEXT NOT NULL,
    valor NUMERIC DEFAULT 0,
    cdi_quota NUMERIC DEFAULT 100,
    rendimento_dia NUMERIC DEFAULT 0,
    vencimento DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    skin TEXT DEFAULT 'none',
    liquidity_type TEXT DEFAULT 'daily', -- 'daily', 'locked_30', 'locked_365'
    locked_until DATE,
    max_capacity NUMERIC, -- Limite de segurança opcional
    investment_type TEXT DEFAULT 'CDB', -- 'CDB', 'IPCA', 'LCI', 'LCA'
    yield_mode TEXT DEFAULT 'POS' -- 'POS' (Pós-fixado), 'PRE' (Pré-fixado)
);

-- 4. Tabela de Histórico de Mineração (Gráficos)
CREATE TABLE IF NOT EXISTS mining_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES usuarios(id),
    date DATE NOT NULL,
    total NUMERIC DEFAULT 0,
    machines JSONB DEFAULT '[]'::jsonb, -- Armazena snapshot das máquinas do dia
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS (Segurança) - Opcional, mas recomendado
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE maquinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE mining_history ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso simples (Liberar tudo para fins de desenvolvimento/protótipo)
-- Em produção, você restringiria isso por usuario.id
CREATE POLICY "Acesso total usuarios" ON usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total user_stats" ON user_stats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total maquinas" ON maquinas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total mining_history" ON mining_history FOR ALL USING (true) WITH CHECK (true);
