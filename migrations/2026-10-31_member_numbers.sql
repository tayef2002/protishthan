-- সদস্য নম্বর: every member gets a random, unique 5-digit number (10000-99999), e.g. 48213.
-- If the 5-digit space ever gets crowded it quietly moves on to 6 digits. A member cannot change it
-- (the update grant only covers name and photo). Safe to run more than once, also on top of the earlier
-- serial version: anyone holding a small serial number (below 10000) is given a random one.
-- Run 2026-10-29_members.sql first.

alter table public.members add column if not exists member_no int;

-- picks a number nobody has yet
create or replace function public.gen_member_no()
returns int language plpgsql as $$
declare
  n int; tries int := 0;
begin
  loop
    tries := tries + 1;
    if tries <= 60 then n := 10000 + floor(random() * 90000)::int;
    else n := 100000 + floor(random() * 900000)::int; end if;
    exit when not exists (select 1 from public.members where member_no = n);
    if tries > 500 then raise exception 'MEMBER_NO_EXHAUSTED'; end if;
  end loop;
  return n;
end $$;

create or replace function public.members_set_no()
returns trigger language plpgsql as $$
begin
  if new.member_no is null then new.member_no := public.gen_member_no(); end if;
  return new;
end $$;

drop trigger if exists members_set_no on public.members;
create trigger members_set_no before insert on public.members
for each row execute function public.members_set_no();

-- numbers still missing, or left over from the earlier serial version, become random ones (one row at a time)
do $$
declare r record;
begin
  for r in select user_id from public.members where member_no is null or member_no < 10000 loop
    update public.members set member_no = public.gen_member_no() where user_id = r.user_id;
  end loop;
end $$;

-- the old serial is no longer used
alter table public.members alter column member_no drop default;
drop sequence if exists public.member_no_seq;

alter table public.members alter column member_no set not null;
create unique index if not exists members_member_no_key on public.members (member_no);

-- check: every member has a unique number
select member_no, display_name, created_at from public.members order by created_at;
