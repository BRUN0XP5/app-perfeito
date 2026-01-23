-- TABELA DE DÍVIDAS
CREATE TABLE IF NOT EXISTS public.dividas (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    valor NUMERIC NOT NULL,
    categoria TEXT NOT NULL, -- 'cartao' ou 'emprestimo'
    paga BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.dividas DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.dividas TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
