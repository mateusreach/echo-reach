-- Echo · Aparência por pessoa (página 02, F5).
-- Base (clara/escura/automática) e caminho de cor (Céu, Blush, Íris, Solar),
-- com mistura, ângulo e intensidade da aura. Idempotente; não altera dados.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_base text NOT NULL DEFAULT 'system';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_path text NOT NULL DEFAULT 'iris';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_mix text NOT NULL DEFAULT 'auto';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_angle smallint NOT NULL DEFAULT 135;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_aura smallint NOT NULL DEFAULT 90;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_base_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_base_check CHECK (ui_base IN ('light', 'dark', 'system'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_path_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_path_check CHECK (ui_path IN ('ceu', 'blush', 'iris', 'solar'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_mix_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_mix_check CHECK (ui_mix IN ('auto', 'azul', 'rosa', 'lilas', 'laranja', 'perola'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_ui_ranges_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_ui_ranges_check CHECK (ui_angle BETWEEN 0 AND 360 AND ui_aura BETWEEN 0 AND 100);
  END IF;
END;
$$;

-- A própria pessoa pode atualizar seu perfil (política já existente no piloto
-- para profiles). Nenhuma política nova é necessária para estas colunas.
