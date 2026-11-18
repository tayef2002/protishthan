-- প্রতিষ্ঠান লিগ, step 1: the QUESTION BANK (the base of the daily quiz and of the live ব্যাচ চ্যালেঞ্জ) with a VERIFICATION flow.
--  * quiz_questions: one multiple-choice question (4 options, 1 correct) with topic, class band, difficulty, explanation and the SOURCE it was checked against.
--    status: draft -> review (sent for checking) -> verified, or flagged (a checker found it wrong) ; retired. Only VERIFIED questions may ever be shown to players (the next steps use that).
--  * quiz_reviewers: the members (teacher / student friends) the admin trusts to check questions.
--  * quiz_checks: a reviewer's verdict (ok / wrong / unsure) on one VERSION (rev) of a question. A question becomes verified when TWO different reviewers say ok on the current version and nobody says wrong.
--    Editing a question changes its version: the old verdicts no longer count and a verified question goes back to draft. A wrong verdict needs a written note (what is wrong).
-- The three tables are closed to the browser: only the admin reads and changes them directly (row security); a reviewer works only through the functions below, which never let a reviewer check their own
-- question or see anything but the questions waiting for a check. The answers are never given to a player here (that is the next step, and it will serve verified questions without the answer).
-- Needs 2026-10-26_admin_users.sql (is_admin). Safe to run more than once.

create or replace function public.quiz_options_ok(o jsonb) returns boolean language sql immutable as $$
  select jsonb_typeof(o) = 'array' and jsonb_array_length(o) = 4
     and not exists (select 1 from jsonb_array_elements(o) e where jsonb_typeof(e) <> 'string' or char_length(btrim(e #>> '{}')) not between 1 and 100)
     and (select count(distinct btrim(e #>> '{}')) from jsonb_array_elements(o) e) = 4
$$;

create table if not exists public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  topic text not null check (topic in ('bangla', 'english', 'math', 'science', 'gk', 'history', 'ict', 'geo', 'sports', 'school', 'puzzle')),
  band text not null default 'any' check (band in ('any', 'c1-5', 'c6-8', 'c9-10', 'c11-12')),
  difficulty smallint not null default 2 check (difficulty between 1 and 3),
  question text not null check (char_length(question) between 5 and 300),
  options jsonb not null check (public.quiz_options_ok(options)),
  answer_idx smallint not null check (answer_idx between 0 and 3),
  explanation text not null default '' check (char_length(explanation) <= 300),
  source text not null default '' check (char_length(source) <= 200),
  status text not null default 'draft' check (status in ('draft', 'review', 'flagged', 'verified', 'retired')),
  rev int not null default 1,
  verified_at timestamptz,
  verified_by text check (verified_by in ('reviewers', 'admin')),
  publish_on date,                                   -- the daily quiz (next step) uses it; empty = not scheduled
  admin_note text not null default '' check (char_length(admin_note) <= 600)
);
create index if not exists quiz_questions_status_idx on public.quiz_questions (status, created_at desc);
create index if not exists quiz_questions_topic_idx on public.quiz_questions (topic, status);

create table if not exists public.quiz_reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  note text not null default '' check (char_length(note) <= 100)
);

create table if not exists public.quiz_checks (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  rev int not null,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  verdict text not null check (verdict in ('ok', 'wrong', 'unsure')),
  note text not null default '' check (char_length(note) <= 300),
  created_at timestamptz not null default now(),
  unique (question_id, rev, reviewer_id)
);
create index if not exists quiz_checks_q_idx on public.quiz_checks (question_id, rev);

-- the rules of a question: a new version when the content changes, back to draft when a checked question is edited, a source is needed to go to checking or to be verified
create or replace function public.quiz_questions_before_write() returns trigger language plpgsql set search_path = public as $$
declare changed boolean;
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    changed := (new.question, new.options, new.answer_idx, new.explanation, new.topic, new.band, new.difficulty, new.source) is distinct from (old.question, old.options, old.answer_idx, old.explanation, old.topic, old.band, old.difficulty, old.source);
    if changed then
      new.rev := old.rev + 1;
      if new.status = old.status and old.status in ('review', 'flagged', 'verified') then new.status := 'draft'; end if;      -- an edit of a checked question: checked again
    end if;
  end if;
  if new.status in ('review', 'verified') and char_length(btrim(new.source)) < 3 then raise exception 'NEED_SOURCE'; end if;
  if new.status = 'verified' and (tg_op = 'INSERT' or old.status is distinct from 'verified') then
    new.verified_at := now(); new.verified_by := coalesce(nullif(current_setting('quiz.by', true), ''), 'admin');
  elsif new.status <> 'verified' then
    new.verified_at := null; new.verified_by := null;
  end if;
  return new;
end $$;
drop trigger if exists quiz_questions_bw on public.quiz_questions;
create trigger quiz_questions_bw before insert or update on public.quiz_questions for each row execute function public.quiz_questions_before_write();

-- two ok from two different reviewers on the CURRENT version and no wrong: verified; any wrong: flagged for the admin
create or replace function public.quiz_checks_after_write() returns trigger language plpgsql security definer set search_path = public as $$
declare q public.quiz_questions; oks int; wrongs int;
begin
  select * into q from public.quiz_questions where id = new.question_id;
  if not found or q.status not in ('review', 'flagged') or new.rev <> q.rev then return null; end if;
  select count(distinct reviewer_id) filter (where verdict = 'ok'), count(distinct reviewer_id) filter (where verdict = 'wrong') into oks, wrongs
    from public.quiz_checks where question_id = q.id and rev = q.rev;
  if wrongs > 0 then
    if q.status <> 'flagged' then update public.quiz_questions set status = 'flagged' where id = q.id; end if;
  elsif oks >= 2 then
    perform set_config('quiz.by', 'reviewers', true);
    update public.quiz_questions set status = 'verified' where id = q.id;
    perform set_config('quiz.by', '', true);
  elsif q.status = 'flagged' then
    update public.quiz_questions set status = 'review' where id = q.id;
  end if;
  return null;
end $$;
drop trigger if exists quiz_checks_aw on public.quiz_checks;
create trigger quiz_checks_aw after insert or update on public.quiz_checks for each row execute function public.quiz_checks_after_write();

-- the closed tables: only the admin reads and changes them directly
alter table public.quiz_questions enable row level security;
alter table public.quiz_reviewers enable row level security;
alter table public.quiz_checks enable row level security;
revoke all on public.quiz_questions, public.quiz_reviewers, public.quiz_checks from anon, authenticated;
grant select, insert, update, delete on public.quiz_questions, public.quiz_reviewers, public.quiz_checks to authenticated;
drop policy if exists quiz_questions_admin on public.quiz_questions;
create policy quiz_questions_admin on public.quiz_questions for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quiz_reviewers_admin on public.quiz_reviewers;
create policy quiz_reviewers_admin on public.quiz_reviewers for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists quiz_checks_admin on public.quiz_checks;
create policy quiz_checks_admin on public.quiz_checks for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- the reviewer's side (a reviewer is a signed-in member that the admin added)
create or replace function public.quiz_review_me() returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or not exists (select 1 from public.quiz_reviewers r where r.user_id = auth.uid()) then jsonb_build_object('reviewer', false)
    else jsonb_build_object('reviewer', true,
      'done', (select count(*)::int from public.quiz_checks c where c.reviewer_id = auth.uid()),
      'waiting', (select count(*)::int from public.quiz_questions q where q.status = 'review' and q.created_by is distinct from auth.uid()
                    and not exists (select 1 from public.quiz_checks c where c.question_id = q.id and c.rev = q.rev and c.reviewer_id = auth.uid()))) end
$$;

-- the next questions waiting for this reviewer (not their own, not already checked in the current version), with the answer, so it can be checked
create or replace function public.quiz_review_queue(p_limit int default 5) returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null or not exists (select 1 from public.quiz_reviewers r where r.user_id = auth.uid()) then '[]'::jsonb
    else coalesce((select jsonb_agg(x.j order by x.at) from (
      select q.created_at as at, jsonb_build_object('id', q.id, 'rev', q.rev, 'topic', q.topic, 'band', q.band, 'difficulty', q.difficulty, 'question', q.question,
               'options', q.options, 'answer_idx', q.answer_idx, 'explanation', q.explanation, 'source', q.source) as j
        from public.quiz_questions q
       where q.status = 'review' and q.created_by is distinct from auth.uid()
         and not exists (select 1 from public.quiz_checks c where c.question_id = q.id and c.rev = q.rev and c.reviewer_id = auth.uid())
       order by q.created_at limit greatest(1, least(coalesce(p_limit, 5), 10))) x), '[]'::jsonb) end
$$;

create or replace function public.quiz_review_submit(p_id uuid, p_verdict text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = public as $$
declare q public.quiz_questions; nt text := left(btrim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g')), 300);
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not exists (select 1 from public.quiz_reviewers r where r.user_id = auth.uid()) then return jsonb_build_object('ok', false, 'error', 'NOT_REVIEWER'); end if;
  if p_verdict is null or p_verdict not in ('ok', 'wrong', 'unsure') then return jsonb_build_object('ok', false, 'error', 'BAD_VERDICT'); end if;
  if p_verdict = 'wrong' and char_length(nt) < 5 then return jsonb_build_object('ok', false, 'error', 'NEED_NOTE'); end if;
  select * into q from public.quiz_questions where id = p_id and status in ('review', 'flagged') and created_by is distinct from auth.uid();
  if not found then return jsonb_build_object('ok', false, 'error', 'NOT_FOUND'); end if;
  insert into public.quiz_checks (question_id, rev, reviewer_id, verdict, note) values (q.id, q.rev, auth.uid(), p_verdict, nt)
    on conflict (question_id, rev, reviewer_id) do update set verdict = excluded.verdict, note = excluded.note, created_at = now();
  return jsonb_build_object('ok', true, 'status', (select status from public.quiz_questions where id = q.id));
end $$;

revoke all on function public.quiz_questions_before_write() from public, anon, authenticated;
revoke all on function public.quiz_checks_after_write() from public, anon, authenticated;
-- Supabase grants execute to anon on every new function by default, so anon is named here too
revoke all on function public.quiz_review_me() from public, anon;
revoke all on function public.quiz_review_queue(int) from public, anon;
revoke all on function public.quiz_review_submit(uuid, text, text) from public, anon;
grant execute on function public.quiz_review_me() to authenticated;
grant execute on function public.quiz_review_queue(int) to authenticated;
grant execute on function public.quiz_review_submit(uuid, text, text) to authenticated;
