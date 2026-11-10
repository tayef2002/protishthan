# Card page name index (instant institution search)

On the card page a visitor types the name of an institution. Before, every typed name was a question to the database (a small free one, 0.2 s when healthy, 10+ s when it is
struggling). Now the 100,000+ institutions are saved as small text files (`card-index/`) and searched in the browser: the list appears at once, and when it is full
no question goes to the server at all.

## Pieces

| File | What it does |
|---|---|
| `phon.js` | The "sound key" (ঢাকা কলেজ and Dhaka College both become `tkC`). An exact copy of `phon_key()` in `migrations/2026-11-15_sound_search.sql`. |
| `card-index.js` | The search: the first two steps of `directory_search()` (spelled alike and starting with the typed text; then same sound, starting with it). |
| `tools/card-index/build.mjs` | Builds `card-index/k/*.txt` (by the first two letters of the spelling key) and `card-index/p/*.txt` (by the first two letters of the sound key). |
| `card.html` | Uses it in `showAc()`. The server (`/api/dir?f=search`, then the database) is asked only when the saved files do not fill the list. |

The "contains what was typed" steps (3 and 4 of `directory_search`) stay on the server, as do institutions added after the last build (verified ones are already on
the page: `INST`).

## Rebuild (after a big import, or when partners verify many institutions)

```
node tools/card-index/build.mjs          # reads tools/import-institutions/out-*/rows.json (+ rebuilds the BANBEIS csv files), writes card-index/
node tools/card-index/test_index.js      # offline checks
node tools/card-index/verify_keys.mjs    # the JS keys equal the database keys (needs internet, read only)
node tools/card-index/verify_live.mjs    # saved index vs live directory_search for 30 queries (needs internet, read only)
```

Then change `INDEX_VERSION` in `card.html` and commit the new `card-index/` folder. Files are cached for a day in the browser; the version in the address
(`?v=`) makes the new ones load at once.

## If `phon_key()` or `bn_key()` ever change in the database

Change `phon.js` / `bnname.js` the same way, run `verify_keys.mjs` until it says 0 differences, rebuild, bump `INDEX_VERSION`.

## Known small differences from the server

- Rows hidden or edited in the database after the build still show their old text until the next build.
- Typing English letters: the sound files answer instantly, but the server is still asked (there are no spelling files for English names), as before.
- Order inside a group of equal-length names can differ in rare cases (database sorting rules vs JavaScript).
