# League load test (step 6)

Three small tools, none of them writes to the real database.

| file | what it answers | how |
|---|---|---|
| `cost.js` | what ONE call of the live game costs the database, and how it grows with the players | runs the real SQL in PGlite (Postgres in WebAssembly, one connection): `PGLITE_DIR=%TEMP%\pgl node tools/loadtest/cost.js 100` (add `rope` for a batch-vs-batch match) |
| `probe.mjs` | how many requests a second the REAL API answers, and how fast | a few workers at a time for a few seconds, read-only public calls only: `node tools/loadtest/probe.mjs --levels 1,4,10`. Every request to protishthan.com counts against the free Cloudflare daily quota. Ask the owner before going above 10 workers. |
| `budget.js` | the request budget of a match (edge quota, database peaks) | `node tools/loadtest/budget.js 100 3` (players, matches a day) |

First results (2026-11-18): see `live-batch-game-plan.md` in the memory folder.
