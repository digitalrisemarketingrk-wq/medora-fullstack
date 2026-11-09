-- Supabase live practice setup. Existing 001_medora.sql schema is already installed.
-- Run this whole file in the Supabase SQL Editor as the database administrator.
-- Contains migrations 002 and 003 in order. No sample data or credentials.
-- Apply after 001_medora.sql as the database administrator.
-- Server-only resource writes; browser clients cannot invoke these functions.
begin;
create extension if not exists btree_gist;
alter table public.medora_access_grants add column if not exists expires_at bigint;
create table if not exists public.medora_qr_receipts (
 token_hash text not null,owner_id uuid not null references public.medora_profiles(id),recipient_id uuid not null references public.medora_profiles(id),expires_at bigint not null,revoked boolean not null default false,primary key(token_hash,recipient_id)
);
alter table public.medora_qr_receipts enable row level security;
revoke all on public.medora_qr_receipts from anon,authenticated;
grant select,insert,update,delete on public.medora_qr_receipts to service_role;

create or replace function public.medora_grant_qr_access(p_hash text,p_owner uuid,p_recipient uuid,p_expires bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_recipient::text,0));
 if not exists(select 1 from public.medora_profiles where id=p_recipient and role in ('doctor','hospital')) or p_expires<=extract(epoch from now()) or p_expires>extract(epoch from now())+900 then
   return jsonb_build_object('error','Invalid temporary care access');
 end if;
 if exists(select 1 from public.medora_qr_receipts where token_hash=p_hash and recipient_id=p_recipient and revoked) then
   return jsonb_build_object('error','This pass was revoked for your account. Ask the patient for a new pass.');
 end if;
 insert into public.medora_qr_receipts(token_hash,owner_id,recipient_id,expires_at) values(p_hash,p_owner,p_recipient,p_expires) on conflict do nothing;
 insert into public.medora_access_grants(owner_id,recipient_id,scope,expires_at) values(p_owner,p_recipient,'read',p_expires)
 on conflict(owner_id,recipient_id) do update set expires_at=greatest(public.medora_access_grants.expires_at,excluded.expires_at)
 where public.medora_access_grants.expires_at is not null;
 return jsonb_build_object('ok',true);
end;
$$;
create or replace function public.medora_revoke_care_access(p_owner uuid,p_recipient uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text||':'||p_recipient::text,0));
 update public.medora_qr_receipts set revoked=true where owner_id=p_owner and recipient_id=p_recipient;
 delete from public.medora_access_grants where owner_id=p_owner and recipient_id=p_recipient;
 return jsonb_build_object('ok',true);
end;
$$;
revoke all on function public.medora_grant_qr_access(text,uuid,uuid,bigint),public.medora_revoke_care_access(uuid,uuid) from public,anon,authenticated;
grant execute on function public.medora_grant_qr_access(text,uuid,uuid,bigint),public.medora_revoke_care_access(uuid,uuid) to service_role;

create table if not exists public.medora_practice_members (
  practice_id uuid not null references public.medora_profiles(id),
  user_id uuid not null references public.medora_profiles(id),
  role text not null check(role in ('clinician','coordinator')),
  primary key(practice_id,user_id)
);

create table if not exists public.medora_practice_records (
  id uuid primary key,
  practice_id uuid not null references public.medora_profiles(id),
  module text not null,
  branch_id uuid not null,
  title text not null check(length(title)<=500),
  status text not null,
  data jsonb not null check(jsonb_typeof(data)='object'),
  version bigint not null check(version>0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  clinician_key text,
  starts_at timestamptz,
  ends_at timestamptz,
  bed_key text,
  check(starts_at is null or ends_at>starts_at),
  constraint medora_appointment_overlap exclude using gist (
    practice_id with =, clinician_key with =, tstzrange(starts_at,ends_at,'[)') with &&
  ) where(module='appointments' and status not in ('Cancelled','Completed','No-show'))
);
create index if not exists medora_practice_record_list on public.medora_practice_records(practice_id,module,branch_id,created_at desc,id desc);
create unique index if not exists medora_occupied_bed on public.medora_practice_records(practice_id,branch_id,bed_key) where module='ipd' and status='Admitted';

create table if not exists public.medora_practice_events (
  id uuid primary key,
  practice_id uuid not null references public.medora_profiles(id),
  actor_id uuid not null references public.medora_profiles(id),
  record_id uuid not null references public.medora_practice_records(id),
  action text not null,
  details jsonb not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists medora_practice_event_list on public.medora_practice_events(practice_id,created_at desc,id desc);

alter table public.medora_practice_members enable row level security;
alter table public.medora_practice_records enable row level security;
alter table public.medora_practice_events enable row level security;
revoke all on public.medora_practice_members,public.medora_practice_records,public.medora_practice_events from anon,authenticated;
grant all on public.medora_practice_members,public.medora_practice_records,public.medora_practice_events to service_role;

create or replace function public.medora_commit_practice_record(
 p_actor uuid,p_practice uuid,p_record jsonb,p_expected bigint,p_event uuid,p_action text,p_details jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare old public.medora_practice_records; saved public.medora_practice_records;
 ev public.medora_practice_events; rec_id uuid; mod text; vals jsonb; b_id uuid;
begin
 if not exists(select 1 from public.medora_profiles where id=p_actor and role in ('doctor','hospital'))
 or (p_actor<>p_practice and not exists(select 1 from public.medora_practice_members where practice_id=p_practice and user_id=p_actor)) then
   return jsonb_build_object('error','Practice access denied','status',403);
 end if;
 rec_id := (p_record->>'id')::uuid; mod := p_record->>'module'; vals := p_record->'data'; b_id := (p_record->>'branch_id')::uuid;
 -- Serialize retries of the same idempotency key; unrelated records remain independent.
 perform pg_advisory_xact_lock(hashtextextended(p_event::text,0));
 select * into ev from public.medora_practice_events where id=p_event;
 if found then
   if ev.practice_id<>p_practice or ev.actor_id<>p_actor or ev.record_id<>rec_id or ev.action<>p_action or ev.details<>p_details then
     return jsonb_build_object('error','Request identifier was already used','status',409);
   end if;
   return ev.snapshot;
 end if;
 select * into old from public.medora_practice_records where id=rec_id for update;
 if found and old.practice_id<>p_practice then return jsonb_build_object('error','Record access denied','status',403); end if;
 if coalesce(old.version,0)<>p_expected then return jsonb_build_object('error','Record changed; reload before saving','status',409); end if;
 if mod<>'locations' and not exists(select 1 from public.medora_practice_records where id=b_id and practice_id=p_practice and module='locations' and status='Active') then
   return jsonb_build_object('error','Choose an active branch','status',422);
 end if;
 if coalesce(vals->>'patient_id','')<>'' and not exists(select 1 from public.medora_practice_records where id=(vals->>'patient_id')::uuid and practice_id=p_practice and module='patients') then
   return jsonb_build_object('error','Choose a registered patient','status',422);
 end if;
 insert into public.medora_practice_records(id,practice_id,module,branch_id,title,status,data,version,created_at,updated_at,clinician_key,starts_at,ends_at,bed_key)
 values(rec_id,p_practice,mod,b_id,p_record->>'title',p_record->>'status',vals,p_expected+1,(p_record->>'created_at')::timestamptz,now(),
   case when mod='appointments' then lower(trim(vals->>'clinician')) end,
   case when mod='appointments' then (vals->>'starts_at')::timestamptz end,
   case when mod='appointments' then (vals->>'ends_at')::timestamptz end,
   case when mod='ipd' then lower(trim(vals->>'ward'))||':'||lower(trim(vals->>'bed')) end)
 on conflict(id) do update set branch_id=excluded.branch_id,title=excluded.title,status=excluded.status,data=excluded.data,version=excluded.version,updated_at=excluded.updated_at,
 clinician_key=excluded.clinician_key,starts_at=excluded.starts_at,ends_at=excluded.ends_at,bed_key=excluded.bed_key
 returning * into saved;
 insert into public.medora_practice_events(id,practice_id,actor_id,record_id,action,details,snapshot)
 values(p_event,p_practice,p_actor,rec_id,p_action,p_details,to_jsonb(saved));
 return to_jsonb(saved);
exception when exclusion_violation then
 return jsonb_build_object('error','This clinician already has an overlapping appointment','status',409);
when unique_violation then
 return jsonb_build_object('error','Record or occupied bed conflict; reload before retrying','status',409);
end;
$$;
revoke all on function public.medora_commit_practice_record(uuid,uuid,jsonb,bigint,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.medora_commit_practice_record(uuid,uuid,jsonb,bigint,uuid,text,jsonb) to service_role;

create or replace function public.medora_practice_summary(p_practice uuid,p_branch uuid default null)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('counts',coalesce((select jsonb_agg(t) from (select module,status,count(*) as count from public.medora_practice_records where practice_id=p_practice and (p_branch is null or branch_id=p_branch) group by module,status)t),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(t) from (select action,record_id,created_at from public.medora_practice_events where practice_id=p_practice order by created_at desc limit 8)t),'[]'::jsonb));
$$;
revoke all on function public.medora_practice_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.medora_practice_summary(uuid,uuid) to service_role;

create index if not exists medora_practice_patient_timeline on public.medora_practice_records(practice_id,(data->>'patient_id'),created_at desc,id desc);

create or replace function public.medora_practice_finance(p_practice uuid,p_branch uuid default null)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('currencies',coalesce((select jsonb_agg(t) from (
 select data->>'currency' as currency,
 sum(((data->>'amount')::numeric*100)::bigint) as billed_minor,
 sum(coalesce((data->>'_paid_minor')::bigint,0)) as received_minor,
 sum(((data->>'amount')::numeric*100)::bigint-coalesce((data->>'_paid_minor')::bigint,0)) as outstanding_minor
 from public.medora_practice_records where practice_id=p_practice and module='billing' and status not in ('Draft','Void') and (p_branch is null or branch_id=p_branch)
 group by data->>'currency')t),'[]'::jsonb));
$$;
revoke all on function public.medora_practice_finance(uuid,uuid) from public,anon,authenticated;
grant execute on function public.medora_practice_finance(uuid,uuid) to service_role;

drop policy if exists medora_workspace_read on public.medora_workspaces;
create policy medora_workspace_read on public.medora_workspaces for select to authenticated using(
 owner_id=(select auth.uid()) or exists(select 1 from public.medora_access_grants g join public.medora_profiles p on p.id=g.recipient_id
 where g.owner_id=medora_workspaces.owner_id and g.recipient_id=(select auth.uid()) and p.role in ('doctor','hospital') and (g.expires_at is null or g.expires_at>extract(epoch from now())))
);
commit;

-- Shared-practice membership is administrator provisioned, never a self-service role assertion.
-- insert into public.medora_practice_members(practice_id,user_id,role) values('<owner-profile-id>','<staff-profile-id>','coordinator');

-- Apply after 002_practice.sql. Only administrators provision memberships.
begin;
alter table public.medora_practice_members drop constraint if exists medora_practice_members_role_check;
alter table public.medora_practice_members add constraint medora_practice_members_role_check
 check(role in ('clinician','coordinator','billing','pharmacist','laboratory','hr'));
commit;

NOTIFY pgrst, 'reload schema';
