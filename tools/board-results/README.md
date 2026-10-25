# Board results pipeline

This pipeline turns the institution-wise result statistics that the education boards publish into the `board_results` table. The `/results` page and the institution profiles read from that table.

It stores only aggregate counts per EIIN: examinees, passed, GPA bands. There are no student names, rolls or marks.

## Steps (per board, per exam, per year)

1. Download the board's "Zilla & Upazila Wise Result Statistics" PDF from the board's own site, and keep its URL. The URL becomes the source link on every row.
2. Parse the PDF:
   ```
   node tools/board-results/parse-dhaka-upazila-stats.js file.pdf HSC 2018 "<pdf url>" > parsed.json
   ```
   The parser prints `institutions: N, failing checks: M`. Each institution is checked as follows:
   - the department examinee counts add up to the total
   - the passed counts add up to the total
   - the GPA bands add up to the number passed
   - the computed pass % matches the printed pass %

   Don't import a file while `failing checks` is above 0. Look at those rows first.
3. Convert it to the import file. This step maps district names to Bangla and title-cases institution names.
   ```
   node tools/board-results/to-import.js parsed.json > data/board-results/<board>-<exam>-<year>.json
   ```
4. Go to Admin → **বোর্ড ফলাফল**, choose the file and press ইমপোর্ট করুন. Rows that already exist (same exam/year/board/EIIN/group) are replaced.

## Notes

- `pdftext.js` is a small text-with-position extractor that uses only Node built-ins. It doesn't work on scanned (image-only) PDFs; those need OCR.
- Each board formats its PDF differently. A new board or a new layout needs its own parser, or new column positions in `COLS`/`ROWS`.
- Never collect individual results or bypass a site's bot check or CAPTCHA. Use only what the boards publish.

## Loaded so far

| File | Source | Institutions |
|---|---|---|
| `data/board-results/dhaka-hsc-2018.json` | Dhaka Board, HSC 2018: https://www.dhakaeducationboard.gov.bd/data/20180722113436451890.pdf | 1,232 (all checks pass) |
