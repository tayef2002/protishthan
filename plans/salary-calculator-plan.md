# ন্যায্য বেতন (salary calculator): the full plan, 2026-11-24

Status: PLAN ONLY. Nothing is built. Design and build start when the owner says so.

## 1. Why (the owner's reason, and the numbers behind it)
Jobs are scarce and the salaries offered are often not fair. A job seeker has nobody to ask "what is a fair salary for ME?", and job posts rarely show a salary ("negotiable").
What the sources say (all found on 2026-11-24, to be re-checked when the data sheet is made):
- Labour Force Survey 2022 (BBS): 12 % of university graduates (about 8 lakh) are unemployed, the highest of all education levels; 8.87 % at higher-secondary, 2.82 % at secondary, 3.53 % overall; 40.67 % of the 15-24 are NEET. (TBS News, Daily Star, Dhaka Tribune reports of the survey)
- Entry salaries: the Daily Star ("Entry salaries for fresh graduates: a bleak picture") puts the average monthly entry pay at 20,000-30,000 taka, and says it is hard to live on it in Dhaka, especially for graduates who support a family.
- Public sector: the Ninth National Pay Scale (2026): lowest grade (20) basic 20,000 (was 8,250), BCS entry grade 9 basic 44,000 (was 22,000), top 156,000 (Financial Express). These are BASIC figures: allowances come on top.
- Garments: minimum wage 12,500 a month for the lowest grade from Dec 2023 (basic 6,700 + allowances), top grade 14,750.
- Private job posts lack salary transparency (Financial Express); Paylab runs a paid, verified salary database for Bangladesh (averages: under 24: 20,593; 25-34: 28,125; banking 30,923; it reports a gender gap). It is paid, English, global, and has no skill-by-skill or offer-check help.
=> A free, Bangla, honest tool that tells a person a RANGE for his own education + skills, and checks an offer, does not exist in the form we want.

## 2. What the tool is (four parts, one page /salary)
1. **আমার ন্যায্য বেতন** (estimator): inputs -> three numbers: "এর নিচে কম" (low), "সম্ভাব্য" (likely), "ভালো দর, দরকষাকষির লক্ষ্য" (good ask), with a bar chart of what added how much.
2. **অফার যাচাই** (offer check): "আমাকে ৳১৫,০০০ অফার করেছে" -> verdict (অনেক কম / কম / ন্যায্য / ভালো), where it falls in the range, a checklist of what to ask (probation, increment, bonus, overtime, allowances) and ready sentences to say in the negotiation.
3. **কী শিখলে কত বাড়ে** (what-if): switch a skill on, see the change; list "the next 3 things that raise your range most" with a time-to-learn guess. No guarantee wording.
4. **আপনার বেতন জানান** (crowd data): anonymous, to make the numbers better and to make a data set nobody else has.

## 3. Inputs (a wizard of 5 short steps, under 90 seconds, mobile first, the last answers kept on the phone)
0. Which one are you: ফ্রেশার / অভিজ্ঞ / অফার পেয়েছি.
1. Field (job family), v1 families: IT and software; accounts and finance; banking; sales and marketing; garments and merchandising; engineering (civil, electrical, mechanical); teaching (school, coaching); health (nurse, pharma); NGO and development; customer service; design and media; government (exact pay scale). Others later.
2. Education: level (SSC, HSC, diploma, honours, masters), subject group, GPA/CGPA (links to the site's own calculators), institution TYPE only (public, private, national university, foreign), never a named ranking in v1.
3. Experience (years), city (Dhaka, Chattogram, other cities, district town), employer type (government, multinational, big local, small business, NGO, start-up), job type (full time, part time, remote, freelance).
4. Skills and extras (searchable chips by group): English level (reading, speaking, IELTS score), computer (Excel advanced, accounting software), tech (programming languages, SQL, design tools), digital marketing, typing speed, languages, driving; certificates (ACCA/CA stages, PMP, CCNA, BTEB trades, Google/Coursera) ; internships, projects, a portfolio or GitHub, freelance marketplace rating, leadership roles, publications. The site's own skill cards can fill this in for a signed-in member.
5. Result screen.
NOT asked: gender, religion, age, marital status, name of employer. (The bank of data would show gaps by gender; using it as an input would copy an unfairness into the tool.)

## 4. How the number is made (a transparent formula, shown on a methodology page)
estimate = BASE(family, education, experience) x CITY x EMPLOYER x (1 + SKILLS), then a range around it.
- BASE: a table per family: entry pay for each education level, and an experience curve (0, 2, 5, 8, 12 years as multipliers). Every cell carries a SOURCE LABEL and a CONFIDENCE: A (official: pay scale, minimum wage, BBS), B (a published survey or report), C (our estimate, waiting for crowd data).
- CITY and EMPLOYER: factors (Dhaka 1.00; big cities a little lower; district towns lower; multinational and big local higher; NGO and small business lower), same labels.
- SKILLS: each skill has a premium in %, with diminishing returns, and a CAP on the total (about +35 % for a fresher, +25 % for an experienced person) so that the tool never promises a fantasy. Premiums start as expert priors (confidence C) and are corrected by the crowd data later.
- RANGE: low / likely / good ask = 0.82 / 1.00 / 1.25 of the estimate when the confidence is A or B, wider when C. Always shown as MONTHLY GROSS and, for government, basic and gross told apart.
- Crowd blend: once a cell has n reports, final = w x crowd median + (1 - w) x prior, w = n / (n + 15). A cell shows a crowd number only from n >= 8 (nobody can be picked out).
- Rules the tests will enforce: more experience is never lower, a higher education level is never lower, adding a skill never lowers the number, the total premium never passes the cap, low < likely < good, golden cases (for example government grade 9 = 44,000 basic exactly).

## 5. The crowd data (the long-term asset)
- Table `salary_reports` (closed to the browser, as the quiz tables), written only through a function `salary_submit` and read only as aggregates (`salary_stats`), cached at the edge (like /api/dir) so it costs no quota.
- Fields (bucketed, no free text): family, education level, experience band, city band, employer type, monthly gross in a 1,000-taka bucket, year. No name, no employer name, no gender.
- Protection against fakes: sign-in with the member account, one report per family per 90 days, plausibility limits per family, median and trimmed averages, an admin tab to remove reports, a minimum number before anything is shown, nothing shown for a cell with fewer than 8.
- Privacy and terms: a new section in the privacy policy and the terms (what is kept, that it is anonymous and bucketed, that it can be deleted on request).

## 6. Honesty rules (what keeps the tool from harming people)
- The words "অনুমান" and the confidence badge (A/B/C) are always on the result; the first release says openly which parts are our estimate.
- Never "you will get"; always "the range people with your profile are usually offered/paid".
- A person told he is underpaid is not told to quit: the screen suggests asking, comparing and improving.
- No employer is named and no institution is ranked in v1 (defamation, bias and unprovable claims).
- The methodology page lists every source and date; the data sheet is updated at least every 6 months (and when the pay scale or the minimum wage changes).

## 7. Pages, files, build outline (when it starts)
- Pages: /salary (the tool, four tabs), /salary/method (sources and formula), later /salary/<family> pages for search (for example "ব্যাংকারের বেতন কত?").
- Files: salary-data.js (tables with source labels), salary-engine.js (pure functions), salary.html/css, an admin tab "বেতন তথ্য", a migration for the reports, a function /api/salary (cached stats).
- Tests: the formula rules in section 4, data integrity (every cell has a source, a confidence and a date), page tests like the other pages. The release switch pattern (hidden first: noindex, not linked) as for the league.
- Share card: an image of the range without any personal detail, rounded to the nearest thousand, share is the user's choice.

## 8. Validation before it goes public
1. Build the data sheet from the sources above; the owner reads it.
2. Back-test 30-40 real cases (people the owner knows: what they were offered or paid vs what the tool says); fix the tables where it is far off.
3. 20-30 people use the hidden version on their phones; watch where they stop.
4. Only then public, with the crowd form on.

## 9. Phases
- Phase 0 (3-4 days): sources and the data sheet for 8 families, reviewed by the owner.
- Phase 1 (about a week): engine and the estimator and the offer check, hidden.
- Phase 2 (about a week): what-if, the methodology page, tests with real people.
- Phase 3: public, crowd form, share card, family pages for search.
- Phase 4 (after 300+ reports): calibration of premiums from the data; institution-type effects if the data supports them.

## 10. Growth and money (honestly)
- Why people will share it: curiosity and fairness ("আমার বেতন কত হওয়া উচিত?"), a private result, a number to take to an interview; search: "বাংলাদেশে X এর বেতন", "ফ্রেশারের বেতন"; Facebook job and career groups; students in the last year (the card and league users are the same age).
- It feeds the rest of the site: skill cards (skills prefill the tool), CGPA/GPA calculators, the card and league audience.
- Income paths, later and only if the data is good: a paid salary report for small and medium employers (benchmark for their hiring), a partner job board, sponsored skill courses (clearly marked as sponsored). Nothing that sells the user's data.
- Risks: employers may dislike it (keep the tone "fair range", no names), thin data at the start (labels and wide ranges), gaming of the crowd form (section 5), a wrong number hurting someone (section 6).

## 11. Decisions needed from the owner
1. Name: "ন্যায্য বেতন" (my suggestion) or another.
2. The families for v1 (the list above, add or remove).
3. Public from day one with labels, or hidden beta with 20-30 people first (my suggestion: hidden first).
4. Collect real salaries from users (needs sign-in, privacy text): yes or later.
5. Who reviews the data sheet (the owner, or friends in each field).
6. Is the money idea of section 10 something he wants to keep open.
