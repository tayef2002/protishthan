-- আমার ব্যাচ: the convener can give the batch a name of its own (for example "Medhabikashiyan 2020") after the batch is opened.
-- Opening a batch needs nothing but the sign-in now; the name, the line and the colour are set afterwards through batch_set_look.
-- Needs: 2026-12-26_batches.sql. Safe to run more than once.

alter table public.batches add column if not exists name text;
alter table public.batches drop constraint if exists batches_name_len;
alter table public.batches add constraint batches_name_len check (name is null or char_length(name) between 2 and 40);

-- the public page now also gets the batch name
create or replace function public.batch_lookup(p_slug text, p_level text, p_year int)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  inst record; b public.batches; n int; conv text; me public.batch_members; mine jsonb := null;
begin
  if not public.batch_level_ok(p_level) or not public.batch_year_ok(p_year) then
    return jsonb_build_object('ok', false, 'error', 'BAD_BATCH');
  end if;
  select l.institution_name, l.district, l.upazila, l.institution_type into inst
    from public.listing_submissions l
   where l.desired_slug = p_slug and l.status = 'approved' and coalesce(l.is_hidden, false) = false limit 1;
  if not found then return jsonb_build_object('ok', false, 'error', 'NO_INSTITUTION'); end if;
  select * into b from public.batches where institution_slug = p_slug and level = p_level and exam_year = p_year;
  if found then
    select count(*) into n from public.batch_members where batch_id = b.id;
    select public.batch_first_name(m.display_name) into conv from public.members m where m.user_id = b.convener_id;
    if auth.uid() is not null then
      select * into me from public.batch_members where batch_id = b.id and user_id = auth.uid();
      if found then mine := jsonb_build_object('joined', true, 'seq', me.seq, 'role', me.role, 'ref', me.ref_code); end if;
    end if;
  end if;
  return jsonb_build_object('ok', true,
    'inst', jsonb_build_object('name', inst.institution_name, 'district', inst.district, 'upazila', inst.upazila, 'type', inst.institution_type),
    'batch', case when b.id is null then null else jsonb_build_object('id', b.id, 'members', n, 'convener', conv, 'name', b.name, 'line', b.line, 'theme', b.theme, 'status', b.status) end,
    'me', mine);
end $$;

-- my batches, with the batch name
create or replace function public.batch_me()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'batch_id', b.id, 'slug', b.institution_slug, 'level', b.level, 'year', b.exam_year, 'theme', b.theme, 'line', b.line, 'bname', b.name,
      'seq', m.seq, 'role', m.role, 'ref', m.ref_code, 'joined_at', m.joined_at,
      'members', (select count(*) from public.batch_members x where x.batch_id = b.id),
      'name', (select l.institution_name from public.listing_submissions l where l.desired_slug = b.institution_slug and l.status = 'approved' limit 1)
    ) order by m.joined_at desc)
    from public.batch_members m join public.batches b on b.id = m.batch_id where m.user_id = auth.uid()
  ), '[]'::jsonb);
end $$;

-- the convener sets the name, the line and the colour (the old three-argument version is replaced)
drop function if exists public.batch_set_look(uuid, text, text);
create or replace function public.batch_set_look(p_batch_id uuid, p_name text, p_line text, p_theme text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  nm text := nullif(btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')), '');
  ln text := nullif(btrim(regexp_replace(coalesce(p_line, ''), '\s+', ' ', 'g')), '');
begin
  if uid is null then return jsonb_build_object('ok', false, 'error', 'NOT_SIGNED_IN'); end if;
  if not exists (select 1 from public.batch_members where batch_id = p_batch_id and user_id = uid and role in ('convener', 'co')) then
    return jsonb_build_object('ok', false, 'error', 'NOT_ALLOWED');
  end if;
  if p_theme not in ('blue', 'violet', 'teal', 'amber', 'rose') then return jsonb_build_object('ok', false, 'error', 'BAD_THEME'); end if;
  if nm is not null and (char_length(nm) < 2 or char_length(nm) > 40 or nm ~* '(https?:|www\.|\.com|\.net|\.bd|@|[0-9০-৯]{8,})' or not public.skill_text_ok(nm)) then
    return jsonb_build_object('ok', false, 'error', 'BAD_NAME');
  end if;
  if ln is not null and (char_length(ln) > 120 or ln ~* '(https?:|www\.|\.com|\.net|\.bd|@|[0-9০-৯]{8,})' or not public.skill_text_ok(ln)) then
    return jsonb_build_object('ok', false, 'error', 'BAD_LINE');
  end if;
  update public.batches set name = nm, line = ln, theme = p_theme where id = p_batch_id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.batch_set_look(uuid, text, text, text) from public;
grant execute on function public.batch_set_look(uuid, text, text, text) to authenticated;
revoke all on function public.batch_lookup(text, text, int) from public;
grant execute on function public.batch_lookup(text, text, int) to anon, authenticated;
revoke all on function public.batch_me() from public;
grant execute on function public.batch_me() to authenticated;

-- check
select count(*) as batches, count(name) as named from public.batches;
