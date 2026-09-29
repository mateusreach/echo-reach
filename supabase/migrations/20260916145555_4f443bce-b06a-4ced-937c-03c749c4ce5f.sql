drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuários já criados sem organização/perfil/papel
do $$
declare u record; new_org_id uuid;
begin
  for u in select * from auth.users where id not in (select id from public.profiles) loop
    insert into public.organizations (name, slug, owner_id)
    values (split_part(u.email,'@',1), 'org-' || replace(u.id::text,'-',''), u.id)
    returning id into new_org_id;

    insert into public.app_settings (id, organization_id)
    values (new_org_id::text, new_org_id) on conflict do nothing;

    insert into public.profiles (id, display_name, role, email, organization_id)
    values (u.id, split_part(u.email,'@',1), 'agency', u.email, new_org_id);

    insert into public.user_roles (user_id, role, organization_id)
    values (u.id, 'agency_admin', new_org_id) on conflict do nothing;
  end loop;
end $$;