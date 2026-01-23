-- SCRIPT MESTRE: RESET E CONFIGURAÇÃO COMPLETA DO JOGO
-- Este script apaga TUDO e recria o banco de dados do zero, pronto para o App.
-- Execute este script no SQL Editor do Supabase.

-- 1. LIMPEZA TOTAL (CUIDADO: APAGA TUDO!)
DROP TABLE IF EXISTS public.user_time_goal CASCADE;
DROP TABLE IF EXISTS public.user_achievements CASCADE;
DROP TABLE IF EXISTS public.user_equipped_items CASCADE;
DROP TABLE IF EXISTS public.user_inventory CASCADE;
DROP TABLE IF EXISTS public.user_missions CASCADE;
DROP TABLE IF EXISTS public.mining_history CASCADE;
DROP TABLE IF EXISTS public.maquinas CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE; -- Tabela de Auth Customizada
-- Não mudamos auth.users para não quebrar o projeto Supabase, mas o jogo usa a tabela 'usuarios'.

-- 2. CRIAÇÃO DA TABELA DE USUÁRIOS (AUTH CUSTOMIZADO DO JOGO)
CREATE TABLE public.usuarios (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, -- Em produção real, use hash! Para o jogo, texto simples ok.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE ESTATÍSTICAS E SALDOS (O "CORAÇÃO" DO PLAYER)
CREATE TABLE public.user_stats (
    user_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0,
    usd_balance NUMERIC DEFAULT 0,
    jpy_balance NUMERIC DEFAULT 0,
    cumulative_deposits NUMERIC DEFAULT 0,
    total_principal_invested NUMERIC DEFAULT 0, -- O que saiu do bolso
    last_payout TIMESTAMP WITH TIME ZONE,
    pix_key TEXT,
    account_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Contadores de Skins (Inventário de Skins)
    skin_carbon INT DEFAULT 0,
    skin_vaporwave INT DEFAULT 0,
    skin_glitch INT DEFAULT 0,
    skin_royal INT DEFAULT 0,
    skin_ghost INT DEFAULT 0,
    skin_cyber INT DEFAULT 0,
    skin_forest INT DEFAULT 0,
    skin_magma INT DEFAULT 0,
    skin_ice INT DEFAULT 0,
    skin_neon_pink INT DEFAULT 0,
    skin_gold_black INT DEFAULT 0,
    skin_sunset INT DEFAULT 0,
    skin_space INT DEFAULT 0,
    skin_emerald INT DEFAULT 0,
    skin_hacker INT DEFAULT 0
);

-- 4. TABELA DE MÁQUINAS (ATIVOS DE CDI) - AGORA COM LIQUIDEZ
CREATE TABLE public.maquinas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    cdi_quota NUMERIC NOT NULL, -- Ex: 100, 105, 120
    vencimento TIMESTAMP WITH TIME ZONE,
    rendimento_dia NUMERIC DEFAULT 0,
    skin TEXT DEFAULT 'none',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Sistema de Liquidez (Nubank Style)
    liquidity_type TEXT DEFAULT 'daily', -- 'daily', 'locked_30', 'locked_365'
    locked_until TIMESTAMP WITH TIME ZONE,
    max_capacity NUMERIC DEFAULT NULL
);

-- 5. HISTÓRICO DE MINERAÇÃO (PARA GRÁFICOS)
CREATE TABLE public.mining_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    date TEXT NOT NULL, -- Armazena ISO String do dia
    total_profit NUMERIC DEFAULT 0,
    details JSONB, -- Detalhes de qual máquina rendeu quanto
    
    -- Snapshots para o Gráfico de Escada
    total_patrimony_snapshot NUMERIC DEFAULT 0,
    total_invested_snapshot NUMERIC DEFAULT 0
);

-- 6. MISSÕES E CONQUISTAS
CREATE TABLE public.user_missions (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    mission_id BIGINT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    target NUMERIC NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, mission_id)
);

CREATE TABLE public.user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    achievement_id TEXT NOT NULL,
    unlocked BOOLEAN DEFAULT FALSE,
    unlocked_at TIMESTAMP WITH TIME ZONE,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, achievement_id)
);

-- 7. ITENS VISUAIS E COSMÉTICOS
CREATE TABLE public.user_equipped_items (
    user_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    aura TEXT DEFAULT '',
    nick_color TEXT DEFAULT '',
    background TEXT DEFAULT '',
    machine_skin TEXT DEFAULT '', -- Skin global padrão
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_inventory (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    item_type TEXT NOT NULL,
    css_class TEXT,
    rarity TEXT,
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.user_time_goal (
    user_id UUID PRIMARY KEY REFERENCES public.usuarios(id) ON DELETE CASCADE,
    goal_name TEXT NOT NULL,
    target_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. PERMISSÕES (DESABILITANDO RLS PARA SIMPLICIDADE)
ALTER TABLE public.usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.maquinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mining_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_equipped_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_time_goal DISABLE ROW LEVEL SECURITY;

-- 9. PERMISSÕES PÚBLICAS (Evita erro 403 se o usuário anon tentar acessar)
GRANT ALL ON TABLE public.usuarios TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_stats TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.maquinas TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.mining_history TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_missions TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_achievements TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_equipped_items TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_inventory TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.user_time_goal TO anon, authenticated, service_role;

GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

SELECT 'JOGO RESETADO E CONFIGURADO COM SUCESSO! Crie um novo personagem.' as status;
