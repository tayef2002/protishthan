# What was checked, and how (question bank, 2026-11-22)

Rule: a question goes into the bank only if (a) its answer is right BY CONSTRUCTION (a program computes it, and a second, different computation or an independent re-working from the question text must agree), or (b) it is a fixed fact from a standard reference table. Nothing here was checked by a human teacher; the terms of the site say "এআই-সহ".

| Part | How it was checked |
|---|---|
| Math (780, gen-math.js) | answer worked two ways in the generator; verify-math.js re-works from the question TEXT: 759 re-worked, 0 differ, 21 shapes not re-checked |
| Physics and chemistry with numbers (380, gen-science.js) | the formula is printed in the explanation; a second computation (loop, inverse formula, parsed formula against a hand-written table of molar masses) must agree; values (g, c of water, atomic masses) are written inside each question |
| Districts and divisions (gen-facts.js) | compared with Wikipedia "Districts of Bangladesh" on 2026-11-22: all 8 divisions, 64 districts and the counts (13, 11, 8, 10, 6, 4, 8, 4) are identical |
| Bangla/English literature (gen-facts2.js) | spot-checked on Wikipedia: Humayun Ahmed (Nondito Noroke, Shonkhonil Karagar, Debi), Zahir Raihan (Arek Falgun, Hajar Bachhor Dhore, Baraf Gala Nodi), Shahidullah Kaiser (Sangshaptak, Sareng Bou), Selina Hossain (Hangor Nodi Grenade; "Gayatri Sandhya" could not be found, so it was REMOVED), Syed Mujtaba Ali (Deshe Bideshe, Panchatantra). The rest are well-known author-work pairs |
| History / Bangladesh facts | Wikipedia: Mujibnagar government (17 April 1971, Baidyanathtala, PM Tajuddin Ahmad, C-in-C Osmani), 11 sectors (web search, Banglapedia/Wikipedia), Padma Bridge (inaugurated 25 June 2022, open to traffic 26 June: the question was reworded to "inaugurated"), Bangabandhu Bridge (23 June 1998), BSAT-1 (12 May 2018 Bangladesh time), Rangamati largest district, Test status (26 June 2000). Fazlur Rahman Khan (born Dhaka, Sears Tower), J. C. Bose, S. N. Bose: web search |
| Everything else (English verb forms and plurals, Bangla calendar, elements, capitals, sports results, biology/physics/chemistry facts, simple science) | standard textbook tables written from knowledge, NOT individually web-checked. Verbs/plurals with two accepted forms (waked, gotten, persons, mouses) were left out on purpose |

If a wrong answer is reported, retire the question in the admin tab and fix the row in the generator.

## Fourth batch (2026-11-23, gen-facts4.js: 187 questions)
| Part | How it was checked |
|---|---|
| UNESCO intangible heritage years: Baul songs 2008, Jamdani 2013, Mangal Shobhajatra 2016, Shital Pati 2017 | Wikipedia "Intangible Cultural Heritage elements in Bangladesh" (also lists rickshaw art 2023, Tangail saree 2025: not used) |
| University founding years: Rajshahi 1953, Chittagong 1966, Jahangirnagar 1970 (act 20 Aug 1970); Bangla Academy 1955; Commonwealth 1972 (18 April) | web search (university and Bangla Academy sites, news, Banglapedia) |
| Syed Waliullah (Lalsalu, Tarangabhanga is a PLAY: asked as "রচনা"), Pyarichand Mitra (Alaler Gharer Dulal, 1857), Kaliprasanna Singha (Hutom Pyanchar Naksha, 1861) | web search |
| Counting, probability, trailing zeros, remainders, divisors puzzles | computed in the program and re-computed by brute force (listing, loops, fast power) |
| Words, days and months in English, small-class science and geography, Bangla grammar counts (6 kārak, 5 pad), organisation founding years (WHO 1948, UNICEF 1946, SAARC 1985, ASEAN 1967, OIC 1969, WTO 1995, NATO 1949) | standard tables written from knowledge, not individually web-checked |
