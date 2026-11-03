-- ব্যাকএন্ড পরীক্ষা: "আমার এলাকা" → যাচাই জমা → Admin অনুমোদন → প্রতিষ্ঠান "যাচাইকৃত" ও আপনার নামে যুক্ত।
-- এটা আপনার (প্রথম সদস্য) অ্যাকাউন্ট হিসেবে সব ধাপ চালায়, ফলাফল একটা বার্তায় দেখায়, তারপর ইচ্ছা করে একটা এরর তুলে সবকিছু ফেরত নেয় (rollback):
-- ডাটাবেসে কিছুই সেভ হয় না, কোনো প্রতিষ্ঠান বদলায় না। শেষের লাল "TEST RESULT" বার্তাটাই ফলাফল।
do $t$
declare
  uid uuid; lid uuid; cid uuid; res text := ''; r record; n int;
begin
  select user_id into uid from public.members where email = 'jubayerpro01@gmail.com' limit 1;
  if uid is null then select user_id into uid from public.members order by created_at limit 1; end if;
  res := res || 'member: ' || coalesce(uid::text, 'NONE') || E'\n';
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated', 'email', 'jubayerpro01@gmail.com')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  res := res || 'is_admin: ' || coalesce(public.is_admin()::text, 'null') || E'\n';

  select id into lid from public.listing_submissions where source_id = '129356' and district = 'হবিগঞ্জ' limit 1;
  res := res || 'listing found: ' || (lid is not null)::text || E'\n';
  select verification, contributor_name, student_count into r from public.listing_submissions where id = lid;
  res := res || 'BEFORE: verification=' || r.verification || ', contributor=' || coalesce(r.contributor_name, '-') || ', students=' || coalesce(r.student_count::text, '-') || E'\n';

  -- 1) area numbers and list
  select total, verified, mine into r from public.area_summary('হবিগঞ্জ', 'বানিয়াচং');
  res := res || 'area_summary: total=' || r.total || ' verified=' || r.verified || ' mine=' || r.mine || E'\n';
  select count(*) into n from public.area_institutions('হবিগঞ্জ', 'বানিয়াচং', 'todo', null, 30, 0);
  res := res || 'area_institutions(todo) rows on first page: ' || n || E'\n';

  -- 2) submit (junk field must be ignored, a bad phone must be refused)
  begin
    perform public.submit_contribution(lid, '{"contact_phone":"123"}'::jsonb, 'visited', null, true);
    res := res || 'bad phone: NOT refused (problem)' || E'\n';
  exception when others then res := res || 'bad phone refused: ' || sqlerrm || E'\n'; end;
  cid := public.submit_contribution(lid, '{"student_count":"450","teacher_count":"12","medium":["বাংলা মিডিয়াম"],"junk":"x","status":"approved"}'::jsonb, 'visited', 'পরীক্ষা', true);
  res := res || 'submitted: ' || cid::text || E'\n';
  select payload, status into r from public.listing_contributions where id = cid;
  res := res || 'stored payload: ' || r.payload::text || ' | status=' || r.status || E'\n';
  begin
    perform public.submit_contribution(lid, '{"student_count":"1"}'::jsonb, 'visited', null, true);
    res := res || 'second pending: NOT refused (problem)' || E'\n';
  exception when others then res := res || 'second pending refused: ' || sqlerrm || E'\n'; end;

  -- 3) the listing is untouched until approval
  select verification, student_count into r from public.listing_submissions where id = lid;
  res := res || 'BEFORE approval: verification=' || r.verification || ', students=' || coalesce(r.student_count::text, '-') || E'\n';

  -- 4) approve (admin)
  begin
    perform public.review_contribution(cid, true, 'ok');
    select verification, contributor_name, student_count, teacher_count, medium, verified_method into r from public.listing_submissions where id = lid;
    res := res || 'AFTER approval: verification=' || r.verification || ', contributor=' || coalesce(r.contributor_name, '-') || ', students=' || coalesce(r.student_count::text, '-') || ', teachers=' || coalesce(r.teacher_count::text, '-') || ', medium=' || coalesce(r.medium::text, '-') || ', method=' || coalesce(r.verified_method, '-') || E'\n';
    res := res || 'contributor_count: ' || public.contributor_count(lid) || E'\n';
    select total, verified, mine into r from public.area_summary('হবিগঞ্জ', 'বানিয়াচং');
    res := res || 'area_summary after: verified=' || r.verified || ' mine=' || r.mine || E'\n';
  exception when others then res := res || 'approval failed: ' || sqlerrm || E'\n'; end;

  raise exception E'\nTEST RESULT (nothing was saved):\n%', res;
end
$t$;
