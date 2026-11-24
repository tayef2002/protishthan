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

---

# 12. The smart engine (v2 of section 4, written after the owner asked for real accuracy, 2026-11-24)

The owner: "it must be accurate, 19 of 20, and use smart intelligence, many people will use it". Section 4 (a table times factors) is only the FIRST STAGE below. The honest contract first.

## 12.1 What accuracy can be promised, and how it is measured
- Two people with the same degree and skills are paid differently (employer, negotiation, luck). No tool can name one number that is right for 19 of 20 of them. What CAN be built, measured and shown is a CALIBRATED RANGE: "of people with your profile, 9 in 10 are paid inside this range" (and a 95 % version, "19 of 20", which is wider).
- Method: conformal quantile prediction. The model predicts low and high quantiles; a held-out part of the data is used to widen or narrow them until the share of real salaries inside the range equals what the screen says (90 %). This gives a measured guarantee, not a hope.
- Targets (to be MEASURED, not promised): stage A (survey data only): the middle number is off by about 25-35 % for a typical person, 90 % ranges wide (about 0.6x to 1.7x); stage B (1,000+ reports): about 20-25 %; stage C (5,000+ reports and employer size, industry known): about 15-20 %, ranges clearly narrower. A public "accuracy" line on the page tells the current number (trust).
- After launch every user is asked once, later, "what did you really get?" (a one-tap answer). That is the ground truth that keeps the model honest.

## 12.2 The layers (the intelligence), each with a job
1. **Foundation from real survey data.** The BBS Labour Force Survey is a public-use file (the 2015-16 file states "accessible to all" with a citation and a confidentiality declaration; 126,000 households a year; it has monthly earnings, education, occupation, industry, division, urban/rural, hours). Phase 0 checks whether the 2022 file (and the later quarterly rounds) can be downloaded; if only tables are public, the tables are used. From the file a quantile regression of log earnings (the Mincer model used by Asadullah 2006 and Rahman and Al-Hasan 2018 for Bangladesh) on education, potential experience (and its square), occupation group, sector, division and urban/rural, hours gives the whole distribution (P10 to P90) for a profile, from over a hundred thousand real earners, not a guess.
2. **Narrow roles by partial pooling.** The survey is too thin for "software engineer" or "bank officer". A hierarchical model lets a narrow role borrow strength from its occupation group and sector, and move away from them only as much as its own data (crowd reports, pasted job ads) justifies. This is the standard cure for thin cells.
3. **Skill premiums from evidence, then from data.** Priors from research (English proficiency: a premium of 20-30 % of earnings in Bangladesh in the British Council and Open University synthesis; computer use: an econometric study of returns to computer use in Bangladesh, 2021), with wide uncertainty, so the crowd data can overrule them. Fitted with regularisation (ridge or elastic net) so that no skill gets a crazy number from a few reports. Monotone: adding a skill never lowers the estimate.
4. **Similar people (k-nearest neighbours) on the crowd reports.** The result page can say "12 people like you reported between X and Y" with the real spread: transparent and convincing; shown only from 8 reports.
5. **Time and inflation.** Older numbers are brought to today with the wage and price index and weighted down with age, so the model does not live in 2022.
6. **A language layer (AI) that does NOT make the number.** An AI model (a small, cheap Claude model through our own edge function, with a per-user limit) (a) reads a free text "I know Excel, I can write Python, my English is okay, I did an internship" or a pasted CV and turns it into the tool's fixed skill list (Bangla and English), (b) reads a pasted job post and pulls out the salary, role and requirements for the data set, (c) writes the plain-Bangla explanation and the negotiation sentences. The number itself always comes from the audited model, so it is repeatable, testable and cannot be talked into a fantasy.
7. **Progressive questions (the smart interface).** The range is shown after three answers and visibly narrows with every further answer. The next question asked is the one that would shrink the range most (information gain, computed from the model: for example "company size" or "city" for a banker, "English level" for an office job). The user stops when he is happy; the result says how wide it still is and what would narrow it.
8. **Offer check as a position, not a verdict.** "Your 15,000 is at the 22nd percentile of people with your profile" plus how much of the gap each missing item (probation, allowances, bonus) explains.

## 12.3 The stages (accuracy grows with data, the tool is honest at each stage)
- **Stage A (launch):** layers 1, 2 (priors), 3 (priors), 5, 6, 7, 8. Ranges are wide and labelled "survey-based"; many cells say "low confidence".
- **Stage B (1,000+ reports):** partial pooling with the crowd data, fitted skill premiums, k-nearest neighbours, first conformal calibration on real reports.
- **Stage C (5,000+ reports):** a gradient-boosted quantile model with monotone constraints and conformal calibration; employer size and industry as inputs; the public accuracy line.
- The model is trained OFFLINE (on my side, from the survey file and the exported reports) and written as a small static table of coefficients and quantiles: the live calculator only looks things up and adds, so it costs nothing to run, is fast on a cheap phone, and can be checked line by line. Retrained monthly while reports are coming in.

## 12.4 Where the real reports come from (the engine's fuel)
1. "Give to get": the full result and the what-if are shown after the user adds his own salary (or "I have no job yet", which gives nothing but still works).
2. Pasted job posts (the user pastes an ad he saw, the AI layer extracts the salary range; no scraping of other sites).
3. A one-time Facebook and campus campaign: "tell us your first salary, we publish the real picture of Bangladesh" with the result published (the first real numbers will themselves be the news).
4. Partners: university career offices and alumni groups, HR people, who give their own anonymous aggregates.
5. Aim for 3,000 reports in the first three months across the 8 launch families (about 375 each); the list of families can grow with the data.

## 12.5 Testing the intelligence (before the public sees it)
- Hold out 20 % of the survey file: measure the error of the middle number against two simple baselines (the overall median; the median by education only) and the real coverage of the 80 % and 90 % ranges. The engine must beat the baselines clearly, and the ranges must cover what they say (within 2-3 points) or it does not go out.
- Fairness check: the error and the coverage by division, by urban and rural, by education level: none may be systematically worse for a group.
- Real-life check: 30-40 people from the owner's circle (their real pay or offer against the tool), as in section 8.
- Automatic tests of the rules (monotone, caps, golden cases) as in section 4, plus a test that the shipped tables reproduce the offline model's answers exactly.

## 12.6 What this changes in the decisions list
7. The owner agrees that Phase 0 downloads the public-use Labour Force Survey and builds the foundation from it (citation and confidentiality text on the method page).
8. The owner agrees to a small AI cost for the language layer (a cheap model, capped per user; the amount is worked out at design time and shown to him first).
9. "Give to get" (the user gives his salary to see the full result): yes or no.

## 12.7 The owner's meaning of "19 of 20" (clarified 2026-11-24)
He means POINT accuracy: if the tool says 15,000, the fair figure should be about 16,000 (a miss of about 5-7 %). Two different things must be kept apart:
- The MARKET RATE for a profile (the typical pay of people with that education, skills, experience, city, employer type). This CAN reach 5-10 % accuracy, but only where there is a lot of data about that exact profile: the error of a median shrinks with the number of reports (with the usual spread of salaries, 100 reports give roughly 6 %, 400 give roughly 3 %, plus the model's own error). So it is reachable first for the COMMON profiles, not for rare ones.
- What ONE person actually earns. People with the same profile still differ by about 25-35 % (employer, negotiation, luck); asking more questions can bring that to about 15-20 %, never to 5 %. So the tool names the market rate as the headline number ("সম্ভাব্য") and shows the range for the person's own spread.
Where rules fix the pay the tool is exact (0 % error): government pay scale grades, the garment minimum wage grades, the MPO teachers' scale (to be added with its source).
How it is measured and published: for each job family, the share of its profiles whose headline number is within 7 % of the reports (held-out), shown as a confidence badge on the result: "পাকা" (within about 7 %), "মোটামুটি" (about 15 %), "অনুমান" (wider). Plan: the 12-15 most common profiles (for example fresher accountant, fresher software developer, bank officer, school teacher, garments merchandiser, sales executive, customer service, NGO programme officer) are collected first, with a target of 300+ reports each, so that those reach "পাকা" first; the rare ones stay honestly wide.
Decision for the owner: accept this definition (the headline number within about 7 % where the data is dense, a labelled range elsewhere), yes or no.
