-- কার্ড পাতায় প্রতিষ্ঠানের নাম লেখার সময় সাজেশন: তথ্যভান্ডারে এখনো নেই, কিন্তু কোনো সদস্য নিজের প্রোফাইলে সেভ করেছেন এমন নামও দেখাবে,
-- যাতে পরের জনকে পুরো নাম আবার টাইপ করতে না হয়। শুধু নাম, ধরন, উপজেলা ও জেলা বেরোয় — কে সেভ করেছেন তা কখনো নয়।
-- যে নাম এখন তালিকাভুক্ত হয়ে গেছে (listing_id আছে) সেটা বাদ, কারণ সেটা তথ্যভান্ডার থেকেই আসে। বারবার চালানো নিরাপদ।

create or replace function public.member_name_suggestions(p_q text, p_limit int default 5)
returns table (name text, itype text, district text, upazila text, uses bigint)
language sql stable security definer set search_path = public as $$
  with q as (select lower(trim(coalesce(p_q, ''))) as t)
  select min(m.name) as name, max(m.itype) as itype, max(m.district) as district, max(m.upazila) as upazila, count(distinct m.user_id) as uses
  from public.member_custom_institutions m, q
  where char_length(q.t) >= 2
    and m.listing_id is null
    and char_length(trim(m.name)) >= 3
    and lower(m.name) like '%' || replace(replace(q.t, '%', ''), '_', '') || '%'
    and m.name !~* '(https?:|www\.|@|[0-9০-৯]{7,})'
  group by lower(trim(m.name))
  order by count(distinct m.user_id) desc, min(m.name)
  limit least(greatest(coalesce(p_limit, 5), 1), 8);
$$;
revoke all on function public.member_name_suggestions(text, int) from public;
grant execute on function public.member_name_suggestions(text, int) to anon, authenticated;

-- check
select * from public.member_name_suggestions('স্কুল', 3);
