-- Echo · página 08: tema padrão por base/caminho e padrões do Like.
alter table public.app_settings add column if not exists default_base text not null default 'system'
  check (default_base in ('light', 'dark', 'system'));
alter table public.app_settings add column if not exists default_path text not null default 'iris'
  check (default_path in ('ceu', 'blush', 'iris', 'solar'));
alter table public.app_settings add column if not exists like_defaults jsonb not null default
  '{"decisionDays":2,"remindBefore":true,"remindOnDay":true,"remindLate":true,"requireCommentOnAdjust":true,"allowDownload":false,"watermark":true}'::jsonb;
alter table public.app_settings add column if not exists agency_description text;
alter table public.app_settings add column if not exists agency_email text;
alter table public.app_settings add column if not exists agency_phone text;
alter table public.app_settings add column if not exists agency_site text;
alter table public.app_settings add column if not exists agency_address text;

comment on column public.app_settings.like_defaults is
  'Valores iniciais de cada rodada do Like (prazo em dias úteis, lembretes, comentário obrigatório no ajuste, download, marca d''água). Cada cliente pode sobrescrever.';
