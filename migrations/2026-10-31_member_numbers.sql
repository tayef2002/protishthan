-- সদস্য নম্বর: every member gets a plain serial number (1, 2, 3 ...) shown as PM-00001.
-- Existing members are numbered in the order they joined; new members get the next number automatically.
-- A member cannot change it (the update grant only covers name and photo).
-- Run 2026-10-29_members.sql first. Safe to run more than once.

create sequence if not exists public.member_no_seq;

alter table public.members add column if not exists member_no int;

-- number the members who have none yet, oldest first, continuing after the highest existing number
with base as (select coalesce(max(member_no), 0) as b from public.members),
     n as (select user_id, row_number() over (order by created_at, user_id) as rn from public.members where member_no is null)
update public.members m
   set member_no = (select b from base) + n.rn
  from n
 where n.user_id = m.user_id;

-- the next new member continues from the highest number
select setval('public.member_no_seq', coalesce((select max(member_no) from public.members), 0) + 1, false);

alter table public.members alter column member_no set default nextval('public.member_no_seq');
alter table public.members alter column member_no set not null;
create unique index if not exists members_member_no_key on public.members (member_no);

-- check: one row per member with a unique number
select member_no, display_name, created_at from public.members order by member_no;
