-- SCRIPT PARA PADRONIZAÇÃO DE IDS (VERSÃO 4 - LIMPEZA DE LIXO)
-- Esta versão remove registros com IDs inválidos (como "1", "2", etc) antes de converter para UUID.
-- Isso resolve o erro de "invalid input syntax for type uuid".

DO $$ 
DECLARE
    r RECORD;
    target_tables TEXT[] := ARRAY['usuarios', 'user_stats', 'maquinas', 'mining_history', 'user_missions', 'user_inventory', 'user_equipped_items', 'user_achievements', 'user_time_goal'];
    tbl TEXT;
BEGIN
    -- 1. REMOVER CONSTRAINTS ANTIGAS
    FOR r IN (
        SELECT tc.table_name, tc.constraint_name
        FROM information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE kcu.column_name = 'user_id' 
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name = ANY(target_tables)
          AND tc.table_schema = 'public'
    ) LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.table_name) || ' DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;

    -- 2. LIMPEZA DE DADOS INCOMPATÍVEIS (O "LIXO" DAS MULTICONTAS)
    -- Se o ID não for um UUID válido (36 caracteres com hifens), ele será removido.
    FOREACH tbl IN ARRAY target_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id') THEN
            -- Deleta registros onde o user_id não segue o padrão UUID (ex: deleta "1", "2", "bruno", etc)
            EXECUTE 'DELETE FROM public.' || quote_ident(tbl) || ' WHERE user_id::text !~ ''^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$''';
        END IF;
    END LOOP;

    -- 3. AGORA SIM, CONVERTER COLUNAS PARA UUID
    FOREACH tbl IN ARRAY target_tables
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'user_id') THEN
            EXECUTE 'ALTER TABLE public.' || quote_ident(tbl) || ' ALTER COLUMN user_id TYPE UUID USING (user_id::text::UUID)';
        END IF;
    END LOOP;

    -- 4. LIMPEZA DE DUPLICADAS RESIDUAIS
    DELETE FROM public.user_stats a USING public.user_stats b WHERE a.ctid < b.ctid AND a.user_id = b.user_id;
    DELETE FROM public.mining_history a USING public.mining_history b WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.date = b.date;

    -- 5. RESTRIÇÕES DE UNICIDADE
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_stats_user_id_key') THEN
        ALTER TABLE public.user_stats ADD CONSTRAINT user_stats_user_id_key UNIQUE (user_id);
    END IF;

    -- 6. NOVAS FOREIGN KEYS (VINCULANDO AO AUTH DO SUPABASE)
    -- Isso impedirá que novos "lixos" (IDs que não são UUIDs do Auth) entrem no sistema
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_stats' AND table_schema = 'public') THEN
        ALTER TABLE public.user_stats ADD CONSTRAINT fk_user_stats_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'maquinas' AND table_schema = 'public') THEN
        ALTER TABLE public.maquinas ADD CONSTRAINT fk_maquinas_auth_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;

END $$;

-- 7. DESABILITAR RLS (Para manter o comportamento atual do App)
ALTER TABLE IF EXISTS user_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS maquinas DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mining_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_missions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_achievements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_equipped_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_time_goal DISABLE ROW LEVEL SECURITY;

SELECT 'Sucesso: Lixo removido e IDs padronizados para UUID.' as resultado;
