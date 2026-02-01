-- SCRIPT PARA CORRIGIR PERSISTÊNCIA DE CONQUISTAS (RESGATAR)
-- Adiciona a coluna 'notified' caso ela não exista, para salvar se a recompensa foi resgatada ou não.

DO $$ 
BEGIN
    -- Adiciona a coluna notified na tabela user_achievements se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_achievements' AND column_name = 'notified') THEN
        ALTER TABLE user_achievements ADD COLUMN notified BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

COMMENT ON COLUMN user_achievements.notified IS 'Indica se o usuário já clicou em Resgatar para esta conquista';
