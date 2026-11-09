-- Run once in the Supabase SQL editor as the project administrator.
-- Application writes go through FastAPI. Browser Data API writes are forbidden.
begin;

create table if not exists public.medora_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null default 'patient' check (role in ('patient','doctor','hospital'))
);
create unique index if not exists medora_profile_email on public.medora_profiles(lower(email));

create table if not exists public.medora_workspaces (
  owner_id uuid primary key references public.medora_profiles(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data)='object'),
  version bigint not null default 0 check (version>=0)
);
create table if not exists public.medora_access_grants (
  owner_id uuid not null references public.medora_profiles(id) on delete cascade,
  recipient_id uuid not null references public.medora_profiles(id) on delete cascade,
  scope text not null check (scope in ('read','write')),
  primary key(owner_id,recipient_id),
  check (owner_id<>recipient_id)
);
create index if not exists medora_received_grants on public.medora_access_grants(recipient_id);

create or replace function public.medora_create_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- A supplied role in user metadata is intentionally ignored.
  insert into public.medora_profiles(id,email,name,role)
  values(new.id,lower(new.email),left(coalesce(nullif(new.raw_user_meta_data->>'name',''),split_part(new.email,'@',1)),120),'patient')
  on conflict(id) do nothing;
  return new;
end;
$$;
revoke all on function public.medora_create_profile() from public,anon,authenticated;
drop trigger if exists medora_auth_user_created on auth.users;
create trigger medora_auth_user_created after insert on auth.users for each row execute function public.medora_create_profile();
insert into public.medora_profiles(id,email,name,role)
select id,lower(email),left(coalesce(nullif(raw_user_meta_data->>'name',''),split_part(email,'@',1)),120),'patient'
from auth.users where email is not null on conflict(id) do nothing;

alter table public.medora_profiles enable row level security;
alter table public.medora_workspaces enable row level security;
alter table public.medora_access_grants enable row level security;
revoke all on public.medora_profiles,public.medora_workspaces,public.medora_access_grants from anon,authenticated;
grant select on public.medora_profiles,public.medora_workspaces,public.medora_access_grants to authenticated;
grant all on public.medora_profiles,public.medora_workspaces,public.medora_access_grants to service_role;

drop policy if exists medora_own_profile on public.medora_profiles;
create policy medora_own_profile on public.medora_profiles for select to authenticated using(id=(select auth.uid()));
drop policy if exists medora_grant_visibility on public.medora_access_grants;
create policy medora_grant_visibility on public.medora_access_grants for select to authenticated
using(owner_id=(select auth.uid()) or recipient_id=(select auth.uid()));
drop policy if exists medora_workspace_read on public.medora_workspaces;
create policy medora_workspace_read on public.medora_workspaces for select to authenticated
using(owner_id=(select auth.uid()) or exists (
  select 1 from public.medora_access_grants g
  join public.medora_profiles p on p.id=g.recipient_id
  where g.owner_id=medora_workspaces.owner_id and g.recipient_id=(select auth.uid()) and p.role in ('doctor','hospital')
));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('medora-documents','medora-documents',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
-- No browser storage policies are created. Only the server secret uploads or
-- deletes objects. Downloads require authorized, short-lived signed links.
commit;

-- Professional access is provisioned by a trusted project administrator:
-- update public.medora_profiles set role='doctor' where email='doctor@example.com';
-- update public.medora_profiles set role='hospital' where email='admin@example.com';
-- Never grant role-editing permissions to authenticated browser users.
