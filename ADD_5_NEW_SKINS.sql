-- Adiciona colunas para as 5 novas skins na tabela user_stats

ALTER TABLE public.user_stats
ADD COLUMN IF NOT EXISTS skin_plasma INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_pixel_art INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_aurora INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_obsidian INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skin_quantum INTEGER DEFAULT 0;

-- Comentários (opcional, apenas para documentação se suportado)
COMMENT ON COLUMN public.user_stats.skin_plasma IS 'Contador da skin Plasma';
COMMENT ON COLUMN public.user_stats.skin_pixel_art IS 'Contador da skin Pixel Art';
COMMENT ON COLUMN public.user_stats.skin_aurora IS 'Contador da skin Aurora';
COMMENT ON COLUMN public.user_stats.skin_obsidian IS 'Contador da skin Obsidian';
COMMENT ON COLUMN public.user_stats.skin_quantum IS 'Contador da skin Quantum';
