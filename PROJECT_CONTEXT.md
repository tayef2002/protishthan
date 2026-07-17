# Protishthan — Project Context (Protishthan-01 থেকে 05 চ্যাটের সম্পূর্ণ সামারি)

> এই ফাইলটা Claude Code এ প্রজেক্ট ফোল্ডার ওপেন করার পর প্রথম মেসেজে paste করো, যাতে পুরো প্রজেক্টের context/history/decisions বুঝে কাজ শুরু করতে পারে।

## প্রজেক্ট পরিচিতি

**Protishthan** (protishthan.com) — বাংলাদেশ-কেন্দ্রিক স্কুল/মাদ্রাসা ম্যানেজমেন্ট SaaS। মালিক/প্রোডাক্ট ওনার: **তায়েফ** (Tayef) — নিজেও Baniachong, Habiganj এ "5-Minute Arts academy" নামে একটা হাতের লেখা শেখানোর একাডেমি চালান। তায়েফ non-technical, Bengali/Banglish এ কথা বলেন, কাজ চান দ্রুত ("fast koro"), কিন্তু architecture-লেভেল সিদ্ধান্তের আগে সবসময় summary চান।

**Tech stack:** Vanilla HTML/CSS/JavaScript (কোনো framework না), Supabase (project ref: `eoqeeuujvpydhmfteqqj`) — PostgreSQL + Auth + Storage + RLS। Production: Cloudflare Pages (`protishthan.com`)। Dev/test: Netlify।

**Supabase ক্লায়েন্ট প্রতি ফাইলে এভাবে init হয়:**
```js
const { createClient } = supabase;
const sb = createClient(
  'https://eoqeeuujvpydhmfteqqj.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // anon key, সব ফাইলে same
);
```

---

## ফাইল লিস্ট (২৬টা HTML, সব root এ flat)

**Agent system:** agent-signup.html, agent-login.html, agent-dashboard.html
**Admin core:** admin.html, dashboard.html, login.html, list-institution.html
**Student/Class:** students.html, classes.html, guardians.html
**Teacher/Staff:** teachers.html, teacher-login.html, teacher-dashboard.html
**Attendance:** attendance.html
**Academic:** exam.html (admin), পরীক্ষা+ফলাফল ফিচার teacher-dashboard.html এর ভিতরে integrated
**Finance:** finance.html, vouchers.html
**Public-facing:** directory.html, institution-detail.html, index.html
**Student/Guardian portal:** student-login.html, student-dashboard.html, guardian-login.html, guardian-dashboard.html
**Settings/Public Page (নতুন, Protishthan-05 এ যুক্ত):** settings.html, public-page.html

---

## DB Schema — মূল টেবিলগুলো

- `institutions` — name, principal_name, phone, email, district, upazila, institution_type, eiin, prn_number, plan, logo_url, description, achievements(jsonb), cover_image_url
- `listing_submissions` — directory-তে পাবলিক লিস্টিং এর জন্য আলাদা টেবিল (institutions এর সাথে কোনো foreign key নেই! matching হয় name/phone/district+upazila দিয়ে, পরে বিস্তারিত নিচে দেখো) — institution_name, contact_phone, desired_slug, status, view_count, is_hidden, founding_year, student_count, teacher_count, achievements, description ইত্যাদি (registration-time snapshot)
- `classes`, `students`, `teachers`, `guardians`, `attendance`
- `teacher_class_subjects` — junction table (teacher কোন ক্লাসে কোন subject পড়ায়)
- `exams` — name, class_id, exam_date, exam_type, subjects(jsonb array of {subject, full_marks, pass_marks}), **is_locked** (boolean, admin "ফলাফল প্রকাশ" টগল)
- `exam_marks` — exam_id, student_id, subject, marks_obtained, is_absent (unique constraint: exam_id+student_id+subject)
- `fee_payments`, `fee_heads`, `student_fee_heads`, `other_income`, `other_expenses`, voucher sequences
- `institution_gallery`, `institution_notices`, `institution_testimonials`, `institution_inquiries` — সবগুলো `institution_id` (FK → institutions.id) দিয়ে link করা, RLS: authenticated=full access, anon=read-only (inquiries এ anon=insert-only)

**Storage buckets:** `voice-notes`, `homework-images`, `institution-logos`, `institution-gallery`

---

## ⚠️ সবচেয়ে গুরুত্বপূর্ণ Architecture Gotcha — অবশ্যই পড়ো

**`institutions` টেবিল আর `listing_submissions` টেবিলের মধ্যে কোনো foreign key নেই।** এগুলো দুটো আলাদা flow থেকে তৈরি হয় (signup এ list-institution.html একসাথে দুটোতেই insert করে, কিন্তু institutions.name পরে Settings থেকে এডিট হলে দুটো নাম mismatch হয়ে যায়)।

এই কারণে, যেকোনো জায়গায় যেখানে `institutions` row থেকে তার `listing_submissions` row (slug/view_count/QR এর জন্য) বা উল্টোটা খুঁজতে হয়, একটা **৪-স্তরের fallback matching chain** ব্যবহার করা হয়েছে (settings.html, public-page.html, institution-detail.html — সব জায়গায় same logic copy-paste করা আছে):

1. `institution_name` / `name` exact match
2. `institution_name` ILIKE fuzzy match
3. `contact_phone` / `phone` exact match
4. `district` + `upazila` combo match

**ভবিষ্যতে এই সমস্যা স্থায়ীভাবে ঠিক করার সবচেয়ে ভালো উপায়:** `listing_submissions` টেবিলে একটা `institution_id uuid REFERENCES institutions(id)` কলাম যুক্ত করে, signup flow এ সরাসরি সেট করা, আর পুরনো রো গুলো একবার manual/SQL দিয়ে backfill করা। এটা এখনো করা হয়নি — তায়েফকে suggest করতে পারো এটা করার জন্য, কারণ এই fallback matching বারবার fail করছিল (একই প্রতিষ্ঠানের Settings এডিট করার পর Public Page link "পাওয়া যায়নি" দেখানো বাগ — কয়েকবার fix করতে হয়েছে)।

---

## Protishthan-01 থেকে 04 এর কাজ (সংক্ষেপে)

- **01:** list-institution.html ৩-স্টেপ ফর্ম, admin.html dashboard, PRN system (`PRN-1425` format, sequence+RPC), নাম "Labbayik"→"Protishthan" পরিবর্তন
- **02:** Agent System (signup/login/dashboard, district auto-assign, commission ৫০%/২৫%), Teacher/Staff System (Teacher ID 10001+, phone login, synthetic email auth)
- **03:** Attendance System (date picker UTC+6, lock/finalize), Guardian Management, Student Login, Homework & Chat (voice recording, annotation editor, real-time polling)
- **04:** Finance module (৫ ট্যাব), Voucher system (auto-numbered, premium design), Exam & Result module (mark entry, report card, class result sheet with SolaimanLipi font), mobile bottom-nav সব পেজে

---

## Protishthan-05 (এই চ্যাট) এর কাজ — বিস্তারিত

### ১. Result Sheet ফাইনালাইজেশন
- **SolaimanLipi ফন্ট** — শুরুতে CDN লিংক (`fonts.maateen.me`) দিয়ে, পরে **base64 embed করে দেওয়া হয়েছে সরাসরি exam.html এর ভিতরে** (offline/PDF এর জন্য, ইন্টারনেট ছাড়াই কাজ করে)। শুধু **Result Sheet এ** এই ফন্ট, বাকি সব পেজে Hind Siliguri।
- রোটেটেড সাবজেক্ট হেডার: `writing-mode:vertical-rl` থেকে বদলে **`transform:rotate(-90deg)`** করা হয়েছে (পড়তে সহজ — মাথা ডানে কাত করে পড়া যায়)
- শেষ কলাম "রোল নং" থেকে বদলে **"মেধাক্রম"** (মোট নম্বরের ভিত্তিতে rank, ইংরেজি না বাংলা সংখ্যায়)
- **GPA শুধু ইংরেজি সংখ্যায়** (`2.8`, `0.0`), বাকি সব কলাম বাংলা সংখ্যায়
- **Fail হাইলাইট:** কোনো subject এ pass_marks এর কম পেলে (বা absent), সেই সেলে কালো ব্যাকগ্রাউন্ড + সাদা টেক্সট
- পেজ সাইজ: Legal landscape, margin/padding টাইট করে ৯+ স্টুডেন্ট এক পেজে ফিট

### ২. Teacher-side পরীক্ষা ও ফলাফল ফিচার
- Admin (exam.html) এ প্রতি exam এর জন্য **"ফলাফল প্রকাশ করুন"** টগল বাটন (`exams.is_locked`)
- Teacher Dashboard এ "আমার ক্লাস" ট্যাবে আগের ২টা কার্ড (হোমওয়ার্ক দিন/ফি উত্তোলন) এর নিচে **২টা নতুন কার্ড**: "পরীক্ষা" আর "ফলাফল"
  - **পরীক্ষা কার্ড:** শুধু teacher এর নিজের assign করা class+subject এর exam দেখাবে (`teacher_class_subjects` দিয়ে scope), মার্ক এন্ট্রি attendance-স্টাইল simple list (নাম+input+অনুপস্থিত checkbox)
  - **ফলাফল কার্ড:** শুধু `is_locked=true` exam দেখাবে, ক্লিক করলে পুরো ক্লাসের সব subject এর combined result (filtered না, কারণ এটা প্রতিষ্ঠানের অফিসিয়াল আউটপুট) + প্রিন্ট বাটন (admin এর same SolaimanLipi result sheet reuse করে)
- **Bug ফিক্স করতে হয়েছিল:** `allClassStudents` ভ্যারিয়েবল শুধু "ফলাফল" খুললে populate হতো, "পরীক্ষা" খুললে খালি থাকতো — `loadClassStudents()` এ fix করে একই ভ্যারিয়েবল সব জায়গায় শেয়ার করা হয়েছে

### ৩. settings.html (নতুন পেজ)
প্রতিষ্ঠানের প্রোফাইল ম্যানেজ করার পেজ। Sections:
- লোগো আপলোড (Storage bucket: `institution-logos`)
- প্রতিষ্ঠানের নাম/অধ্যক্ষ/ফোন এডিট
- **জেলা/উপজেলা dropdown** — list-institution.html এর same `BD_LOCATIONS` array আর dependent-select logic কপি করা হয়েছে
- **প্রতিষ্ঠানের ধরন** — same ৪-বাটন চিপ (মাদ্রাসা/স্কুল/কলেজ/কোচিং) registration form থেকে কপি
- EIIN নম্বর (editable text)
- PRN/EIIN read-only badge
- পাসওয়ার্ড পরিবর্তন (`sb.auth.updateUser`)
- Public Page link + ডিরেক্টরি ভিজিবিলিটি টগল (`listing_submissions.is_hidden`)
- প্ল্যান প্রদর্শন + WhatsApp আপগ্রেড লিংক
- Logout

**ডিজাইন iteration নোট (ভবিষ্যতে কাজে লাগবে):** topbar height নিয়ে বহুবার back-and-forth হয়েছিল (60px বনাম 68px বনাম padding-based) — **ফাইনাল সমাধান: অন্য যেকোনো পেজ থেকে exact `.topbar`/`.topbar-title`/`.topbar-right` CSS+HTML structure verbatim কপি করা, কোনো creative tweak না।** ভবিষ্যতে নতুন পেজ বানানোর সময় এই rule মানা উচিত — সব পেজের topbar literally identical CSS হতে হবে।

**Sidebar user-card pattern পরিবর্তন (সব ১০টা admin পেজেই apply করা হয়েছে):** আগে পুরো card ক্লিক করলে logout হতো। এখন:
- নামের উপর ক্লিক → settings.html এ যায়
- নামের নিচে আলাদা ছোট **"লগআউট"** লিংক (লাল, underline) → logout

### ৪. public-page.html (নতুন পেজ) — Public Page ম্যানেজমেন্ট প্যানেল
- **পারফরম্যান্স:** view count (listing_submissions.view_count থেকে), QR কোড (⚠️ JS লাইব্রেরি CDN ফেইল হয়েছিল, **এখন image-API ব্যবহার করা হয় — `api.qrserver.com`**, কোনো JS dependency নাই), পাবলিক লিংক কপি বাটন
- **আমাদের সম্পর্কে:** description (textarea) + achievements (chip list, add/remove)
- **গ্যালারি:** multi-image upload (bucket: `institution-gallery`), delete
- **নোটিস বোর্ড:** title+body+is_active টগল (creation form এ "এখনই প্রকাশ করুন" checkbox)
- **অভিভাবকদের মতামত:** author_name+message+★rating (1-5 star picker)
- **Admission Inquiry (Leads):** পাবলিক ফর্ম থেকে আসা inquiries, "যোগাযোগ হয়েছে" স্ট্যাটাস টগল

### ৫. institution-detail.html (পাবলিক পেজ) আপডেট
- ৪-স্তর fallback দিয়ে matching `institutions` row resolve করে (উপরের gotcha দেখো), **live description/achievements/logo** static listing_submissions snapshot এর উপর priority পায়
- নতুন সেকশন: নোটিস, গ্যালারি (lightbox-on-click সহ), টেস্টিমোনিয়াল (star rating দেখায়)
- **Admission Inquiry ফর্ম** — submit করলে `institution_inquiries` এ insert হয়, admin এর public-page.html এ lead হিসেবে আসে
- Long unbroken text (স্পেস ছাড়া) box এর বাইরে চলে যাওয়ার bug ফিক্স — সব description/notice/testimonial টেক্সটে `overflow-wrap:break-word` যুক্ত

### ৬. directory.html আপডেট
- যেই প্রতিষ্ঠানের active নোটিস আছে, তার card এ **"📢 নতুন নোটিস"** badge (bulk query দিয়ে, per-card query না — পারফরম্যান্সের জন্য)

---

## Workflow Convention (তায়েফের পছন্দ)
- সব deliverable **zip ফাইলে** দিতে হয় (single file হলেও)
- SQL সবসময় **plain copy-paste text**, কখনো zip এ না
- Bug fix করার আগে **root cause খুঁজে বের করে দেখানো**, তারপর fix
- বড় ফিচারের আগে ছোট **summary দিয়ে "buccho?" confirm** নেওয়া, ছোট fix এ direct কাজ শুরু করা ("fast koro" মানলে)
- Real data সবসময় preferred, hardcoded placeholder না
- প্রতিটা version sequentially number (v180, v181...) ট্র্যাক করা হয়

---

## এখনকার অবস্থা / পরের কাজ
- লেটেস্ট ভার্সন: **v211**, ২৬টা HTML ফাইল
- SQL migration ফাইল (`migration_all.sql`) এই ফোল্ডারেই আছে — তায়েফ ইতিমধ্যে এর প্রায় পুরোটাই Supabase এ রান করেছে, কিন্তু **Claude Code/তুমি একবার Supabase এ গিয়ে verify করে নিও কোন কোন টেবিল/কলাম আসলে আছে**, কারণ চ্যাটে বলা আর তায়েফ আসলে রান করা — দুটো এক না হতে পারে
- সম্ভাব্য পরের কাজ: `listing_submissions.institution_id` FK যুক্ত করে matching সমস্যা স্থায়ীভাবে সমাধান (উপরের gotcha অনুযায়ী)
