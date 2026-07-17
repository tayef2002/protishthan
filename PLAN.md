# Protishthan - Full Project Plan
Last Updated: 2026-07-13

---

## বর্তমান অবস্থা (Done ✅)

- ✅ Web version সম্পূর্ণ (exam, result, dashboard, custom-document)
- ✅ Arabic Tashkeel system (Groq API - llama-3.3-70b)
- ✅ Hafizi Quran style post-processing (shadda, dagger alif, madd sukoon, hamza strip)
- ✅ Interactive tashkeel correction (word click → AI suggestions, char click → harakat picker)
- ✅ Git version control (commit: 439e017)
- ✅ Groq API Key: (stored in .env)

---

## AI System Plan

### এখনকার Setup
- Protishthan এর নিজের Groq key দিয়ে সব institute serve করছে
- ১টা key = ১৪,৪০০ request/day = ~১৪৪ institute (প্রতিটায় ১০০ req/day)
- আপাতত এটাই যথেষ্ট

### ভবিষ্যতে Scale করলে (App Release এর পর)
- Hidden system: Teacher নিজের Google account দিয়ে "Protishthan AI" activate করবে
- Background এ Groq account তৈরি হবে, API key capture হবে
- Teacher জানবে না এটা Groq — শুধু "AI Ready" দেখবে
- প্রতি institute এর নিজস্ব Groq key = নিজস্ব ১৪,৪০০ req/day quota
- Unlimited scale, ০ টাকা খরচ

### Hidden System Flow (App এ)
```
Teacher "Setup AI" tap → WebView খোলে (hidden)
→ groq.com লোড → "Continue with Google" auto click
→ Teacher Google account select করে (একবার)
→ Email verification নেই (Google OAuth তে লাগে না)
→ API keys page → auto generate → key capture
→ Database এ save → "✅ AI Ready!" দেখায়
```

---

## App Conversion Plan

### Phase 1: Server Host করো (Oracle VM)
- Oracle Cloud Free Tier - A1.Flex VM (Mumbai)
- Ubuntu + Node.js + MySQL
- Cloudflare Tunnel দিয়ে domain connect
- server.js সেখানে চলবে সবসময়

### Phase 2: Mobile App (Capacitor)
- তোমার existing HTML/CSS/JS → Capacitor wrap
- Android APK + iOS App বানাবে
- Backend: Oracle VM এর server
- Frontend: Capacitor app
- WebView support থাকবে → Hidden Groq system কাজ করবে

### Phase 3: Hidden Groq Setup System
- App এ "Protishthan AI" page
- Teacher Google দিয়ে একবার activate করবে
- Background এ সব auto হবে
- Teacher Groq এর নাম জানবে না

---

## Protishthan AI Dashboard (Future)

Institute dashboard এ থাকবে:
```
🤖 Protishthan AI
✅ Status: Active
📊 আজকের ব্যবহার: ৪৩/১০০
📅 Plan: Unlimited (Free)

Features:
✅ Arabic Tashkeel
✅ Word Suggestions
✅ Harakat Correction
```

---

## বাকি Web কাজ (custom-document.html)

- [ ] Table row add/delete (right panel)
- [ ] Class filter → student list sync
- [ ] Bullet/Numbered list for text elements
- [ ] Institution header auto-insert when template loads

---

## Groq API Keys (Database এ রাখতে হবে)

| Account | Email | Key | Status |
|---------|-------|-----|--------|
| Main | jubayerpro01@gmail.com | (stored in .env) | Active |
| Backup | tayefahmedofficial@gmail.com | (নিতে হবে) | Pending |

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML/CSS/JS (existing) |
| Backend | Node.js (server.js) |
| Database | MySQL |
| AI | Groq API (llama-3.3-70b-versatile) |
| Mobile App | Capacitor (Ionic) |
| Desktop Test | Electron |
| Server Host | Oracle Cloud VM (Free) |
| Tunnel | Cloudflare Tunnel (Free) |
| Email (future) | jubayerpro01@gmail.com (Gmail API) |

---

## Category-Based Feature Architecture (Long-term Vision)

প্রতিষ্ঠানের ধরন (মাদ্রাসা, স্কুল, কলেজ, কোচিং সেন্টার) অনুযায়ী আলাদা features design করা হবে।

- **মাদ্রাসা:** জামাত, বিভাগ (নূরানী/হিফজ/কিতাব), আরবি tashkeel, দাখিলা নং system
- **স্কুল/কলেজ:** ক্লাস, রোল, সাবজেক্ট-ভিত্তিক result
- **কোচিং:** Batch management, subject-wise fee

**Decision:** Institution Name ও Category একবার set হলে locked — এটা system এর core identity।
`institution_type` field দেখে সব conditional rendering ও feature gating হবে।

---

## Institute Academic Calendar System (Planned Feature)

### বর্তমান সমস্যা
Settings এ শুধু শুরুর মাস ও শেষের মাস আছে — তারিখ নেই, তাই real-time কার্যদিবস গণনা সম্ভব না।

### প্রস্তাবিত Design

**Step 1 — Settings পরিবর্তন:**
- শুরুর মাস + **তারিখ** (start date picker)
- শেষের মাস + **তারিখ** (end date picker)
- Database: `academic_start_date` (DATE), `academic_end_date` (DATE) columns

**Step 2 — নতুন Page: প্রতিষ্ঠান ক্যালেন্ডার**
- Academic year এর পুরো date range visual calendar এ দেখাবে
- Institute নিজেই প্রতিটি দিন **চালু / বন্ধ** mark করবে (click করে)
- Data Supabase এ save হবে (table: `calendar_days`, columns: date, status: open/closed, note)

**Step 3 — Auto-Count (Real-time)**
- মোট কার্যদিবস (চালু দিনের সংখ্যা)
- মোট ছুটি (বন্ধ দিনের সংখ্যা)
- আজ পর্যন্ত কতদিন হয়েছে / কতদিন বাকি
- Dashboard এ live widget দেখাবে

**Future Integration:**
- Attendance system → calendar এর working days দিয়ে percentage হিসাব
- Exam scheduling → calendar এর open days এ exam set করা যাবে

---

## Priority Order

1. ✅ Tashkeel system (done)
2. ✅ Registration print form (done)
3. 🔄 custom-document.html বাকি features
4. ⏳ Oracle VM setup + server host
5. ⏳ Capacitor mobile app
6. ⏳ Hidden Groq setup system
7. ⏳ Protishthan AI dashboard page
8. ⏳ Category-specific feature sets (per institution_type)
