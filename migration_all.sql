-- Exam result publish/lock flag
ALTER TABLE exams ADD COLUMN IF NOT EXISTS is_locked boolean DEFAULT false;

-- Settings page: institution logo + listing visibility toggle
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE listing_submissions ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- Storage bucket for institution logos (public read)
insert into storage.buckets (id, name, public)
values ('institution-logos', 'institution-logos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload/update/read logos
drop policy if exists "logo_upload" on storage.objects;
create policy "logo_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'institution-logos');
drop policy if exists "logo_update" on storage.objects;
create policy "logo_update" on storage.objects
  for update to authenticated using (bucket_id = 'institution-logos');
drop policy if exists "logo_read" on storage.objects;
create policy "logo_read" on storage.objects
  for select to public using (bucket_id = 'institution-logos');

-- ===================== PUBLIC PAGE FEATURE =====================

-- Institution profile enrichment
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS achievements jsonb DEFAULT '[]'::jsonb;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS cover_image_url text;

-- Gallery images
CREATE TABLE IF NOT EXISTS institution_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE institution_gallery ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gallery_all" ON institution_gallery;
CREATE POLICY "gallery_all" ON institution_gallery FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "gallery_public_read" ON institution_gallery;
CREATE POLICY "gallery_public_read" ON institution_gallery FOR SELECT TO anon USING (true);

-- Notices
CREATE TABLE IF NOT EXISTS institution_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE institution_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notices_all" ON institution_notices;
CREATE POLICY "notices_all" ON institution_notices FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "notices_public_read" ON institution_notices;
CREATE POLICY "notices_public_read" ON institution_notices FOR SELECT TO anon USING (is_active = true);

-- Testimonials
CREATE TABLE IF NOT EXISTS institution_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  message text NOT NULL,
  rating int DEFAULT 5,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE institution_testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "testimonials_all" ON institution_testimonials;
CREATE POLICY "testimonials_all" ON institution_testimonials FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "testimonials_public_read" ON institution_testimonials;
CREATE POLICY "testimonials_public_read" ON institution_testimonials FOR SELECT TO anon USING (true);

-- Admission inquiries (leads from public page)
CREATE TABLE IF NOT EXISTS institution_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid REFERENCES institutions(id) ON DELETE CASCADE,
  guardian_name text NOT NULL,
  phone text NOT NULL,
  message text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE institution_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "inquiries_admin_all" ON institution_inquiries;
CREATE POLICY "inquiries_admin_all" ON institution_inquiries FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "inquiries_public_insert" ON institution_inquiries;
CREATE POLICY "inquiries_public_insert" ON institution_inquiries FOR INSERT TO anon WITH CHECK (true);

-- Storage bucket for gallery + cover images
insert into storage.buckets (id, name, public)
values ('institution-gallery', 'institution-gallery', true)
on conflict (id) do nothing;

drop policy if exists "gallery_img_upload" on storage.objects;
create policy "gallery_img_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'institution-gallery');
drop policy if exists "gallery_img_update" on storage.objects;
create policy "gallery_img_update" on storage.objects
  for update to authenticated using (bucket_id = 'institution-gallery');
drop policy if exists "gallery_img_delete" on storage.objects;
create policy "gallery_img_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'institution-gallery');
drop policy if exists "gallery_img_read" on storage.objects;
create policy "gallery_img_read" on storage.objects
  for select to public using (bucket_id = 'institution-gallery');
-- Add selected_template column to institutions
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS selected_template TEXT DEFAULT NULL;
