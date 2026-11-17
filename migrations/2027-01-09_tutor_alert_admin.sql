-- Tutor Alert, the admin side: the admin tab remembers WHEN the tutor was sent the WhatsApp about an alert (tutor_matches.wa_at),
-- so the list "WhatsApp বাকি" (to do) is real, and a second admin does not send it twice.
-- Needs 2027-01-08_tutor_alerts.sql. Safe to run more than once. Only the admin reads or changes tutor_matches (row security of 2026-12-17_tutors.sql); nothing new is opened to anybody.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'tutor_matches' and column_name = 'wa_at') then
    alter table public.tutor_matches add column wa_at timestamptz;
    -- the matches the admin made before this file were sent through WhatsApp by the admin page: they are done, not "to do" (once, when the column is made)
    update public.tutor_matches set wa_at = created_at where source = 'admin';
  end if;
end $$;
create index if not exists tutor_matches_todo_idx on public.tutor_matches (created_at desc) where wa_at is null;
create index if not exists tutor_matches_replied_idx on public.tutor_matches (replied_at) where replied_at is not null;
