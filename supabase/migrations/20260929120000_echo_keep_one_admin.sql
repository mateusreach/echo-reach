-- Echo · página 07: a agência nunca fica sem administrador.
-- Bloqueia remover/rebaixar o último agency_admin de uma organização e
-- desativar o perfil do último administrador ativo.

create or replace function public.echo_keep_one_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if old.role <> 'agency_admin' then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'agency_admin' then
    return new;
  end if;
  select count(*) into remaining
  from public.user_roles ur
  join public.profiles p on p.id = ur.user_id
  where ur.role = 'agency_admin'
    and ur.id <> old.id
    and ur.organization_id is not distinct from old.organization_id
    and p.active is not false;
  if remaining = 0 then
    raise exception 'A agência precisa de pelo menos um administrador ativo.';
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists echo_keep_one_admin on public.user_roles;
create trigger echo_keep_one_admin
  before update or delete on public.user_roles
  for each row execute function public.echo_keep_one_admin();

create or replace function public.echo_keep_one_active_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.active is false and old.active is not false
     and exists (select 1 from public.user_roles where user_id = new.id and role = 'agency_admin')
     and not exists (
       select 1 from public.user_roles ur
       join public.profiles p on p.id = ur.user_id
       where ur.role = 'agency_admin' and ur.user_id <> new.id and p.active is not false
         and ur.organization_id is not distinct from new.organization_id
     ) then
    raise exception 'A agência precisa de pelo menos um administrador ativo.';
  end if;
  return new;
end;
$$;

drop trigger if exists echo_keep_one_active_admin on public.profiles;
create trigger echo_keep_one_active_admin
  before update of active on public.profiles
  for each row execute function public.echo_keep_one_active_admin();
