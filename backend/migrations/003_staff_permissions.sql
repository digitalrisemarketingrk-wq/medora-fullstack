-- Apply after 002_practice.sql. Only administrators provision memberships.
begin;
alter table public.medora_practice_members drop constraint if exists medora_practice_members_role_check;
alter table public.medora_practice_members add constraint medora_practice_members_role_check
 check(role in ('clinician','coordinator','billing','pharmacist','laboratory','hr'));
commit;
