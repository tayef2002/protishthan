-- Board exam results, one row per institution (EIIN) per exam/year/board/group.
-- Source: the institution-wise result statistics each education board publishes
-- (aggregate counts only — no student names, rolls or marks).
-- Public can read; only admins can write. Safe to run more than once.

create table if not exists public.board_results (
  id bigserial primary key,
  exam text not null check (exam in ('SSC', 'DAKHIL', 'HSC', 'ALIM', 'SSC_VOC', 'HSC_BM')),
  year int not null check (year between 1990 and 2100),
  board text not null,
  eiin text not null,
  institution_name text not null,
  district text,
  upazila text,
  grp text not null default 'total',          -- total / science / humanities / business ...
  appeared int not null default 0,
  passed int not null default 0,
  gpa5 int not null default 0,
  gpa_bands jsonb,                            -- {"5":..,"4":..,"3.5":..,"3":..,"2":..,"1":..}
  pass_rate numeric(5,2) generated always as (case when appeared > 0 then round(passed * 100.0 / appeared, 2) else 0 end) stored,
  source_url text,
  created_at timestamptz not null default now(),
  unique (exam, year, board, eiin, grp)
);
create index if not exists board_results_eiin_idx on public.board_results (eiin);
create index if not exists board_results_pick_idx on public.board_results (exam, year, board, grp);
create index if not exists board_results_area_idx on public.board_results (district, upazila);

alter table public.board_results enable row level security;
drop policy if exists board_results_read on public.board_results;
create policy board_results_read on public.board_results for select to anon, authenticated using (true);
drop policy if exists board_results_admin_write on public.board_results;
create policy board_results_admin_write on public.board_results for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- which exams/years/boards have data (for the page's pickers)
create or replace function public.board_results_available()
returns table (exam text, year int, board text, institutions bigint)
language sql stable as $$
  select exam, year, board, count(*) from public.board_results where grp = 'total'
  group by exam, year, board order by year desc, exam, board;
$$;

-- totals + district breakdown for one exam/year (board = null means all boards)
create or replace function public.board_results_summary(p_exams text[], p_year int, p_board text default null)
returns json language sql stable as $$
  with r as (
    select * from public.board_results
    where grp = 'total' and exam = any(p_exams) and year = p_year and (p_board is null or board = p_board)
  )
  select json_build_object(
    'institutions', (select count(*) from r),
    'appeared', coalesce((select sum(appeared) from r), 0),
    'passed', coalesce((select sum(passed) from r), 0),
    'gpa5', coalesce((select sum(gpa5) from r), 0),
    'zero_pass', (select count(*) from r where passed = 0 and appeared > 0),
    'full_pass', (select count(*) from r where passed = appeared and appeared > 0),
    'districts', coalesce((select json_agg(d order by d.pass_rate desc) from (
        select district, sum(appeared) as appeared, sum(passed) as passed, sum(gpa5) as gpa5,
               round(sum(passed) * 100.0 / nullif(sum(appeared), 0), 2) as pass_rate
        from r where district is not null group by district) d), '[]'::json)
  );
$$;
grant execute on function public.board_results_available() to anon, authenticated;
grant execute on function public.board_results_summary(text[], int, text) to anon, authenticated;

select count(*) as rows_now from public.board_results;
