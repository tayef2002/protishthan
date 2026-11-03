-- বোর্ড ফলাফলে উপজেলা: the Cumilla Board's pages give the district but not the upazila. Every institution has an EIIN that is also in the directory, so the upazila is copied from there
-- (the results page can then filter "সব উপজেলা"). Run it again after any new board import: board_results_fill_upazila() only fills rows that are still empty.
-- Safe to run more than once.

create or replace function public.board_results_fill_upazila()
returns bigint language plpgsql security definer set search_path = public as $$
declare n bigint;
begin
  update public.board_results b set upazila = l.upazila
  from public.listing_submissions l
  where (b.upazila is null or b.upazila = '') and l.source_id = b.eiin and l.source like 'banbeis%' and coalesce(l.upazila, '') <> '';
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.board_results_fill_upazila() from public, anon, authenticated;

select public.board_results_fill_upazila() as rows_filled;

-- check
select board, year, exam, count(*) filter (where grp = 'total') as institutions, count(*) filter (where grp = 'total' and upazila is not null) as with_upazila
from public.board_results group by 1, 2, 3 order by 1;
