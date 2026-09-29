-- ===========================================================================
-- Echo · esquema-base
-- ---------------------------------------------------------------------------
-- Cria, num banco novo, as 42 tabelas que o sistema já usa e que existiam só
-- no banco do projeto antigo (nenhuma outra migração as cria): organização,
-- marcas, perfis, papéis, biblioteca, identidade visual, plano, Espaço 360,
-- agência e convites. Também cria as funções de permissão (has_role,
-- is_agency_for_brand, is_brand_member, has_brand_permission…), as regras de
-- acesso (RLS), o gatilho que cria o perfil de quem entra e o bucket de
-- arquivos. Não muda nada do sistema: só dá ao banco a forma que o código espera.
--
-- Gerado a partir de src/integrations/supabase/types.ts por
-- scripts/gen-base-schema.py (tabelas) + regras escritas à mão (funções e RLS).
-- Idempotente nas tabelas (IF NOT EXISTS). Roda antes de todas as migrações.
-- ===========================================================================

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('agency_admin', 'agency_member', 'client');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.organizations (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  owner_id uuid,
  slug text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (slug)
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS organizations_owner_id_idx ON public.organizations (owner_id);

CREATE TABLE IF NOT EXISTS public.brands (
  accent_color text,
  avatar_url text,
  contact_email text,
  contact_name text,
  contract_type text,
  cover_frame jsonb,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  favicon_url text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_example boolean NOT NULL DEFAULT false,
  logo_frame jsonb,
  logo_url text,
  modules jsonb NOT NULL DEFAULT '{}'::jsonb,
  name text NOT NULL,
  notes text,
  organization_id uuid,
  primary_color text,
  segment text,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'ativo',
  suggested_palettes jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  workspace_client_id uuid,
  workspace_connected boolean NOT NULL DEFAULT false,
  workspace_url text,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  UNIQUE (slug)
);
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brands_organization_id_idx ON public.brands (organization_id);
CREATE INDEX IF NOT EXISTS brands_workspace_client_id_idx ON public.brands (workspace_client_id);

CREATE TABLE IF NOT EXISTS public.profiles (
  active boolean NOT NULL DEFAULT true,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  display_name text,
  email text,
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  job_title text,
  organization_id uuid,
  role text NOT NULL DEFAULT 'client',
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS profiles_organization_id_idx ON public.profiles (organization_id);

CREATE TABLE IF NOT EXISTS public.agency_events (
  brand_id uuid,
  category text NOT NULL DEFAULT 'evento',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  description text,
  event_date date NOT NULL,
  event_time text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notes text,
  organization_id uuid,
  responsible text,
  status text NOT NULL DEFAULT 'agendado',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.agency_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS agency_events_brand_id_idx ON public.agency_events (brand_id);
CREATE INDEX IF NOT EXISTS agency_events_organization_id_idx ON public.agency_events (organization_id);

CREATE TABLE IF NOT EXISTS public.agency_invites (
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid,
  job_title text,
  name text,
  organization_id uuid,
  permissions text[] NOT NULL DEFAULT '{}',
  role public.app_role NOT NULL DEFAULT 'client',
  status text NOT NULL DEFAULT 'pendente',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.agency_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS agency_invites_organization_id_idx ON public.agency_invites (organization_id);

CREATE TABLE IF NOT EXISTS public.agency_posts (
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'aviso',
  organization_id uuid,
  pinned boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.agency_posts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS agency_posts_organization_id_idx ON public.agency_posts (organization_id);

CREATE TABLE IF NOT EXISTS public.agency_post_acks (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL,
  user_id uuid NOT NULL,
  FOREIGN KEY (post_id) REFERENCES public.agency_posts(id) ON DELETE CASCADE
);
ALTER TABLE public.agency_post_acks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS agency_post_acks_post_id_idx ON public.agency_post_acks (post_id);
CREATE INDEX IF NOT EXISTS agency_post_acks_user_id_idx ON public.agency_post_acks (user_id);

CREATE TABLE IF NOT EXISTS public.app_settings (
  accent_color text,
  agency_address text,
  agency_description text,
  agency_email text,
  agency_name text,
  agency_phone text,
  agency_site text,
  created_at timestamptz NOT NULL DEFAULT now(),
  default_theme text NOT NULL DEFAULT 'light',
  favicon_url text,
  icon_url text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_cliente_body text,
  invite_cliente_subject text,
  invite_colaborador_body text,
  invite_colaborador_subject text,
  loading_image_url text,
  logo_offset_x numeric NOT NULL DEFAULT 0,
  logo_offset_y numeric NOT NULL DEFAULT 0,
  logo_scale numeric NOT NULL DEFAULT 0,
  logo_secondary_url text,
  logo_url text,
  organization_id uuid,
  primary_color text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS app_settings_organization_id_idx ON public.app_settings (organization_id);

CREATE TABLE IF NOT EXISTS public.biblioteca_pilares (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.biblioteca_pilares ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS biblioteca_pilares_brand_id_idx ON public.biblioteca_pilares (brand_id);

CREATE TABLE IF NOT EXISTS public.biblioteca_categorias (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  pilar_id uuid NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (pilar_id) REFERENCES public.biblioteca_pilares(id) ON DELETE CASCADE
);
ALTER TABLE public.biblioteca_categorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS biblioteca_categorias_brand_id_idx ON public.biblioteca_categorias (brand_id);
CREATE INDEX IF NOT EXISTS biblioteca_categorias_pilar_id_idx ON public.biblioteca_categorias (pilar_id);

CREATE TABLE IF NOT EXISTS public.objectives (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  current_value numeric,
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL DEFAULT 0,
  period_label text,
  period_type text NOT NULL DEFAULT 'mensal',
  status text NOT NULL DEFAULT 'em_andamento',
  target_value numeric,
  title text NOT NULL,
  unit text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.objectives ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS objectives_brand_id_idx ON public.objectives (brand_id);

CREATE TABLE IF NOT EXISTS public.espaco360_initiatives (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid,
  order_index integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'media',
  semester text,
  status text NOT NULL DEFAULT 'planejada',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON DELETE SET NULL
);
ALTER TABLE public.espaco360_initiatives ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_initiatives_brand_id_idx ON public.espaco360_initiatives (brand_id);
CREATE INDEX IF NOT EXISTS espaco360_initiatives_objective_id_idx ON public.espaco360_initiatives (objective_id);

CREATE TABLE IF NOT EXISTS public.espaco360_campaigns (
  brand_id uuid NOT NULL,
  channels text[] NOT NULL DEFAULT '{}',
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  end_date date,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid,
  learnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  message text,
  objective_id uuid,
  offer text,
  opportunity text,
  priority text NOT NULL DEFAULT 'media',
  products text,
  quarter text,
  responsible text,
  stage text NOT NULL DEFAULT 'planejamento',
  start_date date,
  status text NOT NULL DEFAULT 'planejada',
  target_audience text,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (initiative_id) REFERENCES public.espaco360_initiatives(id) ON DELETE SET NULL,
  FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON DELETE SET NULL
);
ALTER TABLE public.espaco360_campaigns ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_campaigns_brand_id_idx ON public.espaco360_campaigns (brand_id);
CREATE INDEX IF NOT EXISTS espaco360_campaigns_initiative_id_idx ON public.espaco360_campaigns (initiative_id);
CREATE INDEX IF NOT EXISTS espaco360_campaigns_objective_id_idx ON public.espaco360_campaigns (objective_id);

CREATE TABLE IF NOT EXISTS public.biblioteca_ideias (
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_id uuid NOT NULL,
  campaign_id uuid,
  categoria_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  due_date date,
  format text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text,
  initiative_id uuid,
  link text,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  priority text NOT NULL DEFAULT 'sem_prioridade',
  refs jsonb NOT NULL DEFAULT '[]'::jsonb,
  responsible text,
  starred boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'a_fazer',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (categoria_id) REFERENCES public.biblioteca_categorias(id) ON DELETE SET NULL,
  FOREIGN KEY (initiative_id) REFERENCES public.espaco360_initiatives(id) ON DELETE SET NULL
);
ALTER TABLE public.biblioteca_ideias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS biblioteca_ideias_brand_id_idx ON public.biblioteca_ideias (brand_id);
CREATE INDEX IF NOT EXISTS biblioteca_ideias_campaign_id_idx ON public.biblioteca_ideias (campaign_id);
CREATE INDEX IF NOT EXISTS biblioteca_ideias_categoria_id_idx ON public.biblioteca_ideias (categoria_id);
CREATE INDEX IF NOT EXISTS biblioteca_ideias_initiative_id_idx ON public.biblioteca_ideias (initiative_id);

CREATE TABLE IF NOT EXISTS public.brand_access_logs (
  brand_id uuid NOT NULL,
  context text,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL DEFAULT 'acesso',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'ok',
  user_email text,
  user_id uuid,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.brand_access_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_access_logs_brand_id_idx ON public.brand_access_logs (brand_id);
CREATE INDEX IF NOT EXISTS brand_access_logs_user_id_idx ON public.brand_access_logs (user_id);

CREATE TABLE IF NOT EXISTS public.brand_home_sections (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index integer NOT NULL DEFAULT 0,
  section_key text NOT NULL,
  stage text NOT NULL,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_home_sections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_home_sections_brand_id_idx ON public.brand_home_sections (brand_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_channels (
  active boolean NOT NULL DEFAULT true,
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  general_prompt text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_identity_channels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_channels_brand_id_idx ON public.brand_identity_channels (brand_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_colors (
  brand_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'apoio',
  channel_id uuid,
  cmyk text,
  created_at timestamptz NOT NULL DEFAULT now(),
  hex text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  note text,
  order_index integer NOT NULL DEFAULT 0,
  pantone text,
  rgb text,
  source text NOT NULL DEFAULT 'manual',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES public.brand_identity_channels(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_identity_colors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_colors_brand_id_idx ON public.brand_identity_colors (brand_id);
CREATE INDEX IF NOT EXISTS brand_identity_colors_channel_id_idx ON public.brand_identity_colors (channel_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_channel_color_refs (
  channel_id uuid NOT NULL,
  color_id uuid NOT NULL,
  PRIMARY KEY (channel_id, color_id),
  FOREIGN KEY (channel_id) REFERENCES public.brand_identity_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (color_id) REFERENCES public.brand_identity_colors(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_identity_channel_color_refs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_channel_color_refs_channel_id_idx ON public.brand_identity_channel_color_refs (channel_id);
CREATE INDEX IF NOT EXISTS brand_identity_channel_color_refs_color_id_idx ON public.brand_identity_channel_color_refs (color_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_master (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  general_rules text,
  graphic_elements text,
  icon_style text,
  manual_attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  photo_direction text,
  typography text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  visual_direction text,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  UNIQUE (brand_id)
);
ALTER TABLE public.brand_identity_master ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_master_brand_id_idx ON public.brand_identity_master (brand_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_presets (
  active boolean NOT NULL DEFAULT true,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  channel_id uuid NOT NULL,
  composition_rules text,
  created_at timestamptz NOT NULL DEFAULT now(),
  dimension text,
  format text,
  graphic_elements text,
  hierarchy text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_treatment text,
  logo_position text,
  margins text,
  name text NOT NULL,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  safe_area text,
  text_sizes text,
  typography text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (channel_id) REFERENCES public.brand_identity_channels(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_identity_presets ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_presets_channel_id_idx ON public.brand_identity_presets (channel_id);

CREATE TABLE IF NOT EXISTS public.brand_identity_models (
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  carousel_cover_structure text,
  carousel_cta text,
  carousel_final_page text,
  carousel_forbidden_elements text,
  carousel_hierarchy text,
  carousel_page_count text,
  carousel_pages_structure text,
  carousel_required_elements text,
  carousel_text_treatment text,
  carousel_title_treatment text,
  category text,
  channel_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  format text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  naming_pattern text,
  objective text,
  order_index integer NOT NULL DEFAULT 0,
  preset_id uuid,
  prompt text,
  status text NOT NULL DEFAULT 'ativo',
  structure text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  visual_direction text,
  FOREIGN KEY (channel_id) REFERENCES public.brand_identity_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (preset_id) REFERENCES public.brand_identity_presets(id) ON DELETE SET NULL
);
ALTER TABLE public.brand_identity_models ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_identity_models_channel_id_idx ON public.brand_identity_models (channel_id);
CREATE INDEX IF NOT EXISTS brand_identity_models_preset_id_idx ON public.brand_identity_models (preset_id);

CREATE TABLE IF NOT EXISTS public.brand_invites (
  accepted_at timestamptz,
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text NOT NULL,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invited_by uuid,
  is_admin boolean NOT NULL DEFAULT false,
  member_role text NOT NULL DEFAULT 'client',
  name text,
  organization_id uuid,
  permissions text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pendente',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_invites ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_invites_brand_id_idx ON public.brand_invites (brand_id);
CREATE INDEX IF NOT EXISTS brand_invites_organization_id_idx ON public.brand_invites (organization_id);

CREATE TABLE IF NOT EXISTS public.brand_members (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_admin boolean NOT NULL DEFAULT false,
  member_role text NOT NULL DEFAULT 'client',
  permissions text[] NOT NULL DEFAULT '{}',
  user_id uuid NOT NULL,
  PRIMARY KEY (brand_id, user_id),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.brand_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS brand_members_brand_id_idx ON public.brand_members (brand_id);
CREATE INDEX IF NOT EXISTS brand_members_user_id_idx ON public.brand_members (user_id);

CREATE TABLE IF NOT EXISTS public.espaco360_tasks (
  assignee_id uuid,
  brand_id uuid NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  description text,
  due_date date,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid,
  is_required boolean NOT NULL DEFAULT false,
  owner_scope text NOT NULL DEFAULT 'agencia',
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'pendente',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (assignee_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (initiative_id) REFERENCES public.espaco360_initiatives(id) ON DELETE SET NULL
);
ALTER TABLE public.espaco360_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_tasks_assignee_id_idx ON public.espaco360_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS espaco360_tasks_brand_id_idx ON public.espaco360_tasks (brand_id);
CREATE INDEX IF NOT EXISTS espaco360_tasks_campaign_id_idx ON public.espaco360_tasks (campaign_id);
CREATE INDEX IF NOT EXISTS espaco360_tasks_initiative_id_idx ON public.espaco360_tasks (initiative_id);

CREATE TABLE IF NOT EXISTS public.conteudos (
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_id uuid NOT NULL,
  briefing text,
  campaign_id uuid,
  canal text,
  created_at timestamptz NOT NULL DEFAULT now(),
  cta text,
  formato text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ideia_id uuid,
  image_url text,
  legenda text,
  notes text,
  publish_date date,
  published_link text,
  responsible text,
  roteiro text,
  status text NOT NULL DEFAULT 'rascunho',
  task_id uuid,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (ideia_id) REFERENCES public.biblioteca_ideias(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES public.espaco360_tasks(id) ON DELETE SET NULL
);
ALTER TABLE public.conteudos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS conteudos_brand_id_idx ON public.conteudos (brand_id);
CREATE INDEX IF NOT EXISTS conteudos_campaign_id_idx ON public.conteudos (campaign_id);
CREATE INDEX IF NOT EXISTS conteudos_ideia_id_idx ON public.conteudos (ideia_id);
CREATE INDEX IF NOT EXISTS conteudos_task_id_idx ON public.conteudos (task_id);

CREATE TABLE IF NOT EXISTS public.deliveries (
  brand_id uuid NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz,
  delivery_type text,
  description text,
  due_date date,
  file_url text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'entregue',
  task_id uuid,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES public.espaco360_tasks(id) ON DELETE SET NULL
);
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS deliveries_brand_id_idx ON public.deliveries (brand_id);
CREATE INDEX IF NOT EXISTS deliveries_campaign_id_idx ON public.deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS deliveries_task_id_idx ON public.deliveries (task_id);

CREATE TABLE IF NOT EXISTS public.espaco360_calendar_events (
  brand_id uuid NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivery_date date,
  delivery_title text,
  description text,
  end_time text,
  event_date date NOT NULL,
  event_type text NOT NULL DEFAULT 'publicacao',
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  responsible text,
  start_time text,
  status text NOT NULL DEFAULT 'agendado',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL
);
ALTER TABLE public.espaco360_calendar_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_calendar_events_brand_id_idx ON public.espaco360_calendar_events (brand_id);
CREATE INDEX IF NOT EXISTS espaco360_calendar_events_campaign_id_idx ON public.espaco360_calendar_events (campaign_id);

CREATE TABLE IF NOT EXISTS public.espaco360_channels (
  brand_id uuid NOT NULL,
  channel_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ativo',
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.espaco360_channels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_channels_brand_id_idx ON public.espaco360_channels (brand_id);

CREATE TABLE IF NOT EXISTS public.espaco360_meetings (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_date date NOT NULL,
  notes text,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  title text NOT NULL,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.espaco360_meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_meetings_brand_id_idx ON public.espaco360_meetings (brand_id);

CREATE TABLE IF NOT EXISTS public.espaco360_meeting_tasks (
  assignee text,
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL,
  due_date date,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (meeting_id) REFERENCES public.espaco360_meetings(id) ON DELETE CASCADE
);
ALTER TABLE public.espaco360_meeting_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_meeting_tasks_brand_id_idx ON public.espaco360_meeting_tasks (brand_id);
CREATE INDEX IF NOT EXISTS espaco360_meeting_tasks_meeting_id_idx ON public.espaco360_meeting_tasks (meeting_id);

CREATE TABLE IF NOT EXISTS public.espaco360_monthly_tracking (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  decisoes_tomadas text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insights text,
  month_ref text NOT NULL,
  ponto_atencao text,
  resultados_internos text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE
);
ALTER TABLE public.espaco360_monthly_tracking ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_monthly_tracking_brand_id_idx ON public.espaco360_monthly_tracking (brand_id);

CREATE TABLE IF NOT EXISTS public.espaco360_notes (
  brand_id uuid NOT NULL,
  content text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'nota',
  note_date date,
  pinned boolean NOT NULL DEFAULT false,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.espaco360_notes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS espaco360_notes_brand_id_idx ON public.espaco360_notes (brand_id);

CREATE TABLE IF NOT EXISTS public.kpis (
  brand_id uuid NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  objective_id uuid,
  period_label text,
  responsible text,
  source text NOT NULL DEFAULT 'manual',
  target_value numeric,
  unit text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  value numeric NOT NULL DEFAULT 0,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (objective_id) REFERENCES public.objectives(id) ON DELETE SET NULL
);
ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS kpis_brand_id_idx ON public.kpis (brand_id);
CREATE INDEX IF NOT EXISTS kpis_campaign_id_idx ON public.kpis (campaign_id);
CREATE INDEX IF NOT EXISTS kpis_objective_id_idx ON public.kpis (objective_id);

CREATE TABLE IF NOT EXISTS public.plan_templates (
  active boolean NOT NULL DEFAULT true,
  audience text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  notes text,
  objective text,
  organization_id uuid,
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  type text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.plan_templates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS plan_templates_organization_id_idx ON public.plan_templates (organization_id);

CREATE TABLE IF NOT EXISTS public.referencia_categorias (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  organization_id uuid,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.referencia_categorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS referencia_categorias_organization_id_idx ON public.referencia_categorias (organization_id);

CREATE TABLE IF NOT EXISTS public.referencias (
  active boolean NOT NULL DEFAULT true,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_id uuid,
  category text NOT NULL DEFAULT 'geral',
  channel_id uuid,
  cover_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  description text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  links jsonb NOT NULL DEFAULT '[]'::jsonb,
  model_id uuid,
  organization_id uuid,
  purpose text,
  tags text[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  usage_notes text,
  when_to_use text,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (channel_id) REFERENCES public.brand_identity_channels(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (model_id) REFERENCES public.brand_identity_models(id) ON DELETE SET NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.referencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS referencias_brand_id_idx ON public.referencias (brand_id);
CREATE INDEX IF NOT EXISTS referencias_channel_id_idx ON public.referencias (channel_id);
CREATE INDEX IF NOT EXISTS referencias_model_id_idx ON public.referencias (model_id);
CREATE INDEX IF NOT EXISTS referencias_organization_id_idx ON public.referencias (organization_id);

CREATE TABLE IF NOT EXISTS public.solicitacoes (
  brand_id uuid NOT NULL,
  campaign_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  description text,
  due_date date,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  initiative_id uuid,
  priority text NOT NULL DEFAULT 'media',
  status text NOT NULL DEFAULT 'nova',
  task_id uuid,
  tipo text,
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES public.espaco360_campaigns(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL,
  FOREIGN KEY (initiative_id) REFERENCES public.espaco360_initiatives(id) ON DELETE SET NULL,
  FOREIGN KEY (task_id) REFERENCES public.espaco360_tasks(id) ON DELETE SET NULL
);
ALTER TABLE public.solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS solicitacoes_brand_id_idx ON public.solicitacoes (brand_id);
CREATE INDEX IF NOT EXISTS solicitacoes_campaign_id_idx ON public.solicitacoes (campaign_id);
CREATE INDEX IF NOT EXISTS solicitacoes_initiative_id_idx ON public.solicitacoes (initiative_id);
CREATE INDEX IF NOT EXISTS solicitacoes_task_id_idx ON public.solicitacoes (task_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  active boolean NOT NULL DEFAULT true,
  avatar_url text,
  brand_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  email text,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_leader boolean NOT NULL DEFAULT false,
  job_title text,
  kind text NOT NULL DEFAULT 'agency',
  name text NOT NULL,
  organization_id uuid,
  palette text NOT NULL DEFAULT 'purple',
  updated_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS team_members_brand_id_idx ON public.team_members (brand_id);
CREATE INDEX IF NOT EXISTS team_members_organization_id_idx ON public.team_members (organization_id);
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members (user_id);

CREATE TABLE IF NOT EXISTS public.user_permissions (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  permission text NOT NULL,
  user_id uuid NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS user_permissions_organization_id_idx ON public.user_permissions (organization_id);
CREATE INDEX IF NOT EXISTS user_permissions_user_id_idx ON public.user_permissions (user_id);

CREATE TABLE IF NOT EXISTS public.user_roles (
  created_at timestamptz NOT NULL DEFAULT now(),
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid,
  role public.app_role NOT NULL,
  user_id uuid NOT NULL,
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS user_roles_organization_id_idx ON public.user_roles (organization_id);
CREATE INDEX IF NOT EXISTS user_roles_user_id_idx ON public.user_roles (user_id);

CREATE TABLE IF NOT EXISTS public.workspace_dispatches (
  brand_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  external_id uuid,
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin text NOT NULL DEFAULT 'criacao',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  response text,
  source_id uuid,
  source_table text,
  status text NOT NULL DEFAULT 'pendente',
  title text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);
ALTER TABLE public.workspace_dispatches ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS workspace_dispatches_brand_id_idx ON public.workspace_dispatches (brand_id);
CREATE INDEX IF NOT EXISTS workspace_dispatches_external_id_idx ON public.workspace_dispatches (external_id);
CREATE INDEX IF NOT EXISTS workspace_dispatches_source_id_idx ON public.workspace_dispatches (source_id);

-- ---------------------------------------------------------------------------
-- Ajustes que o arquivo de tipos não descreve
-- ---------------------------------------------------------------------------
ALTER TABLE public.agency_post_acks ADD CONSTRAINT agency_post_acks_once UNIQUE (post_id, user_id);
ALTER TABLE public.app_settings ALTER COLUMN logo_scale SET DEFAULT 1;
CREATE UNIQUE INDEX IF NOT EXISTS app_settings_org_uq ON public.app_settings (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_uq ON public.user_roles (user_id, role);
CREATE UNIQUE INDEX IF NOT EXISTS brand_home_sections_key_uq ON public.brand_home_sections (brand_id, section_key);

-- ---------------------------------------------------------------------------
-- Funções de apoio e de permissão (as mesmas assinaturas do banco antigo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_organization_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- Equipe da agência: papel agency_admin ou agency_member (ou perfil antigo marcado como 'agency').
CREATE OR REPLACE FUNCTION public.is_agency() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('agency_admin', 'agency_member'))
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'agency');
$$;

CREATE OR REPLACE FUNCTION public.is_agency_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'agency_admin');
$$;

CREATE OR REPLACE FUNCTION public.is_agency_org(target_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency() AND (target_org_id IS NULL OR target_org_id = public.current_organization_id()
    OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND organization_id = target_org_id));
$$;

CREATE OR REPLACE FUNCTION public.is_agency_admin_org(target_org_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency_admin() AND public.is_agency_org(target_org_id);
$$;

-- A equipe atende os clientes da própria agência (brands.organization_id).
CREATE OR REPLACE FUNCTION public.is_agency_for_brand(target_brand_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency() AND EXISTS (SELECT 1 FROM brands b WHERE b.id = target_brand_id AND public.is_agency_org(b.organization_id));
$$;

CREATE OR REPLACE FUNCTION public.is_brand_member(target_brand_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM brand_members WHERE brand_id = target_brand_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_brand_admin(target_brand_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency_for_brand(target_brand_id)
      OR EXISTS (SELECT 1 FROM brand_members WHERE brand_id = target_brand_id AND user_id = auth.uid() AND is_admin);
$$;

-- Permissão do cliente na marca: admin da marca tem todas; os outros, as da lista.
CREATE OR REPLACE FUNCTION public.has_brand_permission(perm text, target_brand_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_agency_for_brand(target_brand_id)
      OR EXISTS (SELECT 1 FROM brand_members WHERE brand_id = target_brand_id AND user_id = auth.uid() AND (is_admin OR perm = ANY (permissions)));
$$;

CREATE OR REPLACE FUNCTION public.has_permission(_permission text, _user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'agency_admin')
      OR EXISTS (SELECT 1 FROM user_permissions WHERE user_id = _user_id AND permission = _permission);
$$;

-- Admin de marca do cliente pode gerenciar pessoas da mesma marca.
CREATE OR REPLACE FUNCTION public.is_client_admin_for_user(target_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM brand_members me JOIN brand_members them ON them.brand_id = me.brand_id
                 WHERE me.user_id = auth.uid() AND me.is_admin AND them.user_id = target_user_id);
$$;

CREATE OR REPLACE FUNCTION public.brand_identity_channel_brand(target_channel_id uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT brand_id FROM brand_identity_channels WHERE id = target_channel_id;
$$;

-- ---------------------------------------------------------------------------
-- Novo usuário: cria o perfil. A PRIMEIRA pessoa a entrar vira admin da agência
-- (para o sistema novo não nascer sem ninguém capaz de convidar os outros).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE org uuid; first_user boolean;
BEGIN
  SELECT id INTO org FROM organizations ORDER BY created_at LIMIT 1;
  SELECT NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'agency_admin') INTO first_user;
  INSERT INTO profiles (id, email, display_name, organization_id, role)
  VALUES (NEW.id, NEW.email, coalesce(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1)),
          CASE WHEN first_user THEN org ELSE NULL END, CASE WHEN first_user THEN 'agency' ELSE 'client' END)
  ON CONFLICT (id) DO NOTHING;
  IF first_user THEN
    INSERT INTO user_roles (user_id, role, organization_id) VALUES (NEW.id, 'agency_admin', org) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Gatilhos de updated_at nas tabelas-base que têm a coluna.
DO $$ DECLARE t text; BEGIN
  FOR t IN SELECT c.table_name FROM information_schema.columns c
           WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
             AND c.table_name IN ('organizations','brands','agency_events','agency_posts','app_settings','biblioteca_pilares','biblioteca_categorias','biblioteca_ideias','objectives','espaco360_initiatives','espaco360_campaigns','brand_home_sections','brand_identity_channels','brand_identity_colors','brand_identity_master','brand_identity_presets','brand_identity_models','espaco360_tasks','conteudos','deliveries','espaco360_calendar_events','espaco360_channels','espaco360_meetings','espaco360_meeting_tasks','espaco360_monthly_tracking','espaco360_notes','kpis','plan_templates','referencia_categorias','referencias','solicitacoes','team_members','workspace_dispatches')
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'trg_' || t || '_touch', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()', 'trg_' || t || '_touch', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Regras de acesso (RLS)
-- ---------------------------------------------------------------------------
-- Tabelas da marca que o cliente também usa: equipe faz tudo; cliente lê e edita.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['biblioteca_pilares','biblioteca_categorias','biblioteca_ideias','conteudos','referencias','referencia_categorias','brand_home_sections','objectives','kpis',
    'espaco360_initiatives','espaco360_campaigns','espaco360_tasks','espaco360_calendar_events','espaco360_channels','espaco360_meetings','espaco360_meeting_tasks','espaco360_monthly_tracking','espaco360_notes',
    'solicitacoes','deliveries','brand_identity_master','brand_identity_colors','brand_identity_channels','brand_identity_presets','brand_identity_models']
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'brand_id') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id))', t || '_agency', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_brand_member(brand_id))', t || '_member_read', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.is_brand_member(brand_id))', t || '_member_insert', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.is_brand_member(brand_id)) WITH CHECK (public.is_brand_member(brand_id))', t || '_member_update', t);
    END IF;
  END LOOP;
END $$;

-- Presets e modelos sem brand_id: seguem o canal.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['brand_identity_presets','brand_identity_models'] LOOP
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'brand_id') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_agency_for_brand(public.brand_identity_channel_brand(channel_id))) WITH CHECK (public.is_agency_for_brand(public.brand_identity_channel_brand(channel_id)))', t || '_agency', t);
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_brand_member(public.brand_identity_channel_brand(channel_id)))', t || '_member_read', t);
    END IF;
  END LOOP;
END $$;
CREATE POLICY brand_identity_channel_color_refs_agency ON public.brand_identity_channel_color_refs FOR ALL TO authenticated
  USING (public.is_agency_for_brand(public.brand_identity_channel_brand(channel_id))) WITH CHECK (public.is_agency_for_brand(public.brand_identity_channel_brand(channel_id)));
CREATE POLICY brand_identity_channel_color_refs_read ON public.brand_identity_channel_color_refs FOR SELECT TO authenticated
  USING (public.is_brand_member(public.brand_identity_channel_brand(channel_id)));

-- Organização e marcas
CREATE POLICY organizations_read ON public.organizations FOR SELECT TO authenticated USING (public.is_agency_org(id) OR id = public.current_organization_id());
CREATE POLICY organizations_admin ON public.organizations FOR ALL TO authenticated USING (public.is_agency_admin_org(id)) WITH CHECK (public.is_agency_admin_org(id));
CREATE POLICY brands_agency ON public.brands FOR ALL TO authenticated USING (public.is_agency_org(organization_id)) WITH CHECK (public.is_agency_org(organization_id));
CREATE POLICY brands_member_read ON public.brands FOR SELECT TO authenticated USING (public.is_brand_member(id));
CREATE POLICY brands_client_admin_update ON public.brands FOR UPDATE TO authenticated USING (public.is_brand_admin(id)) WITH CHECK (public.is_brand_admin(id));

-- Pessoas e papéis
CREATE POLICY profiles_self ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY profiles_agency_read ON public.profiles FOR SELECT TO authenticated USING (public.is_agency());
CREATE POLICY profiles_agency_admin ON public.profiles FOR UPDATE TO authenticated USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY profiles_same_brand_read ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM brand_members a JOIN brand_members b ON a.brand_id = b.brand_id WHERE a.user_id = auth.uid() AND b.user_id = profiles.id));
CREATE POLICY user_roles_self ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_agency());
CREATE POLICY user_roles_admin ON public.user_roles FOR ALL TO authenticated USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY user_permissions_self ON public.user_permissions FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_agency());
CREATE POLICY user_permissions_admin ON public.user_permissions FOR ALL TO authenticated USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY brand_members_read ON public.brand_members FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_brand_member(brand_id) OR public.is_agency_for_brand(brand_id));
CREATE POLICY brand_members_manage ON public.brand_members FOR ALL TO authenticated USING (public.is_brand_admin(brand_id)) WITH CHECK (public.is_brand_admin(brand_id));
CREATE POLICY brand_invites_manage ON public.brand_invites FOR ALL TO authenticated USING (public.is_brand_admin(brand_id)) WITH CHECK (public.is_brand_admin(brand_id));
CREATE POLICY brand_access_logs_read ON public.brand_access_logs FOR SELECT TO authenticated USING (public.is_brand_admin(brand_id));
CREATE POLICY brand_access_logs_insert ON public.brand_access_logs FOR INSERT TO authenticated WITH CHECK (public.is_brand_member(brand_id) OR public.is_agency_for_brand(brand_id));
CREATE POLICY team_members_agency ON public.team_members FOR ALL TO authenticated USING (public.is_agency()) WITH CHECK (public.is_agency());
CREATE POLICY team_members_brand_read ON public.team_members FOR SELECT TO authenticated USING (brand_id IS NOT NULL AND public.is_brand_member(brand_id));

-- Agência
CREATE POLICY agency_invites_admin ON public.agency_invites FOR ALL TO authenticated USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY agency_events_read ON public.agency_events FOR SELECT TO authenticated USING (public.is_agency());
CREATE POLICY agency_events_write ON public.agency_events FOR ALL TO authenticated USING (public.is_agency()) WITH CHECK (public.is_agency());
CREATE POLICY agency_posts_read ON public.agency_posts FOR SELECT TO authenticated USING (public.is_agency());
CREATE POLICY agency_posts_write ON public.agency_posts FOR ALL TO authenticated USING (public.is_agency()) WITH CHECK (public.is_agency());
CREATE POLICY agency_post_acks_own ON public.agency_post_acks FOR ALL TO authenticated USING (user_id = auth.uid() OR public.is_agency_admin()) WITH CHECK (user_id = auth.uid());
CREATE POLICY app_settings_read ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY app_settings_admin ON public.app_settings FOR ALL TO authenticated USING (public.is_agency_admin()) WITH CHECK (public.is_agency_admin());
CREATE POLICY plan_templates_read ON public.plan_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY plan_templates_agency ON public.plan_templates FOR ALL TO authenticated USING (public.is_agency()) WITH CHECK (public.is_agency());
CREATE POLICY workspace_dispatches_agency ON public.workspace_dispatches FOR ALL TO authenticated USING (public.is_agency_for_brand(brand_id)) WITH CHECK (public.is_agency_for_brand(brand_id) OR public.is_brand_member(brand_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Arquivos (logos, capas, anexos): bucket privado usado por src/lib/storage.ts.
INSERT INTO storage.buckets (id, name, public) VALUES ('reach-files', 'reach-files', false) ON CONFLICT (id) DO NOTHING;
CREATE POLICY reach_files_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'reach-files');
CREATE POLICY reach_files_write ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'reach-files');
CREATE POLICY reach_files_update ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'reach-files' AND owner = auth.uid());

-- ---------------------------------------------------------------------------
-- Dados iniciais: a agência. Com uma única organização, a migração
-- 20260918120000 cria sozinha os 11 clientes da carteira, e a 20260918181500
-- restaura o arquivo da Fina Fragrância. A equipe entra por convite; a primeira
-- pessoa que criar conta vira administradora (ver handle_new_user).
-- ---------------------------------------------------------------------------
INSERT INTO public.organizations (name, slug)
SELECT 'Reach', 'reach' WHERE NOT EXISTS (SELECT 1 FROM public.organizations);
INSERT INTO public.app_settings (organization_id, agency_name, default_theme)
SELECT o.id, 'Reach', 'light' FROM public.organizations o
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings) ORDER BY o.created_at LIMIT 1;
