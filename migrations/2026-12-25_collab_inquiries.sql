-- The contact form of /collaborate (2026-12-25): a brand, an organisation or a person leaves a name, a WhatsApp number and a short message.
-- Nobody can read the table except the admin (the admin page has a tab "সহযোগিতার বার্তা"). The public key can only call collab_inquiry_add().
-- The function checks the text itself (length, a Bangladeshi mobile number, no links) and limits how often one device and the whole site can send.
-- Safe to run more than once.

create table if not exists public.collab_inquiries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  brand text,
  phone text not null,
  topic text,
  message text not null,
  device text,
  status text not null default 'new' check (status in ('new', 'done')),
  note text
);
create index if not exists collab_inquiries_created_idx on public.collab_inquiries (created_at desc);
alter table public.collab_inquiries enable row level security;
drop policy if exists collab_inquiries_admin on public.collab_inquiries;
create policy collab_inquiries_admin on public.collab_inquiries for all to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on public.collab_inquiries from anon;

create or replace function public.collab_inquiry_add(p_name text, p_brand text, p_phone text, p_topic text, p_message text, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
declare nm text := left(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'), 60);
        br text := left(regexp_replace(trim(coalesce(p_brand, '')), '\s+', ' ', 'g'), 80);
        msg text := left(trim(coalesce(p_message, '')), 800);
        tp text := left(trim(coalesce(p_topic, '')), 40);
        dev text := left(coalesce(trim(p_device), ''), 64);
        ph text := regexp_replace(translate(coalesce(p_phone, ''), '০১২৩৪৫৬৭৮৯', '0123456789'), '[^0-9+]', '', 'g');
begin
  if ph like '+880%' then ph := '0' || substr(ph, 5); elsif ph like '880%' then ph := '0' || substr(ph, 4); end if;
  if char_length(nm) < 2 then raise exception 'BAD_NAME'; end if;
  if ph !~ '^01[3-9][0-9]{8}$' then raise exception 'BAD_PHONE'; end if;
  if char_length(msg) < 10 then raise exception 'TOO_SHORT'; end if;
  if msg ~* '(https?:|www\.)' or br ~* '(https?:|www\.)' then raise exception 'BAD_LINK'; end if;
  if (select count(*) from public.collab_inquiries c where c.created_at > now() - interval '1 hour') >= 20 then raise exception 'BUSY'; end if;
  if dev <> '' and (select count(*) from public.collab_inquiries c where c.device = dev and c.created_at > now() - interval '1 day') >= 3 then raise exception 'DAILY_LIMIT'; end if;
  if exists (select 1 from public.collab_inquiries c where c.phone = ph and c.message = msg and c.created_at > now() - interval '1 day') then raise exception 'DUPLICATE'; end if;
  insert into public.collab_inquiries (name, brand, phone, topic, message, device) values (nm, nullif(br, ''), ph, nullif(tp, ''), msg, nullif(dev, ''));
end $$;
revoke all on function public.collab_inquiry_add(text, text, text, text, text, text) from public;
grant execute on function public.collab_inquiry_add(text, text, text, text, text, text) to anon, authenticated;

-- check: a bad number is refused; nothing is stored by this select
select 'ok' as table_ready, (select count(*) from public.collab_inquiries) as rows_now;
