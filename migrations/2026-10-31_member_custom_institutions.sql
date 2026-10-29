-- সদস্য: "my institution is not listed" — a member can keep an institution that is not in the directory in
-- their own profile (name, optional type and district). Only that member can see it. Later they can list it
-- properly through the normal listing form. Run 2026-10-29_members.sql first. Safe to run more than once.

create table if not exists public.member_custom_institutions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  itype text check (itype is null or itype in ('মাদ্রাসা', 'স্কুল', 'কলেজ', 'কোচিং সেন্টার')),
  district text check (district is null or char_length(district) <= 60),
  created_at timestamptz not null default now()
);
create unique index if not exists member_custom_inst_unique on public.member_custom_institutions (user_id, lower(name));
create index if not exists member_custom_inst_user on public.member_custom_institutions (user_id, created_at desc);

alter table public.member_custom_institutions enable row level security;
drop policy if exists mci_own_select on public.member_custom_institutions;
create policy mci_own_select on public.member_custom_institutions for select to authenticated using (user_id = auth.uid());
drop policy if exists mci_own_insert on public.member_custom_institutions;
create policy mci_own_insert on public.member_custom_institutions for insert to authenticated with check (user_id = auth.uid());
drop policy if exists mci_own_delete on public.member_custom_institutions;
create policy mci_own_delete on public.member_custom_institutions for delete to authenticated using (user_id = auth.uid());
drop policy if exists mci_admin_read on public.member_custom_institutions;
create policy mci_admin_read on public.member_custom_institutions for select to authenticated using (public.is_admin());
revoke all on public.member_custom_institutions from anon;
grant select, insert, delete on public.member_custom_institutions to authenticated;

-- at most 30 per member
create or replace function public.mci_limit() returns trigger language plpgsql as $$
begin
  if (select count(*) from public.member_custom_institutions where user_id = new.user_id) >= 30 then
    raise exception 'TOO_MANY';
  end if;
  return new;
end $$;
drop trigger if exists mci_limit on public.member_custom_institutions;
create trigger mci_limit before insert on public.member_custom_institutions for each row execute function public.mci_limit();

-- check
select count(*) as custom_institutions from public.member_custom_institutions;
