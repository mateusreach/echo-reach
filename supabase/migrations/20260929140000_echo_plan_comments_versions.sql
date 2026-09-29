-- Echo · página 11: comentários da equipe e histórico de versões por seção do Plano.

CREATE TABLE IF NOT EXISTS public.brand_section_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.brand_home_sections(id) ON DELETE CASCADE,
  author_id uuid DEFAULT auth.uid(),
  author_name text,
  body text NOT NULL CHECK (length(trim(body)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_section_comments_section_idx ON public.brand_section_comments (section_id, created_at);
ALTER TABLE public.brand_section_comments ENABLE ROW LEVEL SECURITY;
-- Comentários internos: só a equipe da agência lê e escreve.
DROP POLICY IF EXISTS brand_section_comments_agency ON public.brand_section_comments;
CREATE POLICY brand_section_comments_agency ON public.brand_section_comments
  FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id));

CREATE TABLE IF NOT EXISTS public.brand_section_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.brand_home_sections(id) ON DELETE CASCADE,
  author_id uuid DEFAULT auth.uid(),
  author_name text,
  field_key text NOT NULL,
  field_label text,
  before_value text,
  after_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_section_versions_section_idx ON public.brand_section_versions (section_id, created_at DESC);
ALTER TABLE public.brand_section_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS brand_section_versions_agency ON public.brand_section_versions;
CREATE POLICY brand_section_versions_agency ON public.brand_section_versions
  FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id));
DROP POLICY IF EXISTS brand_section_versions_member_read ON public.brand_section_versions;
CREATE POLICY brand_section_versions_member_read ON public.brand_section_versions
  FOR SELECT TO authenticated USING (public.is_brand_member(brand_id));
