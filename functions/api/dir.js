// /api/dir — the questions every visitor of the home page asks the database, answered from the edge instead.
// Before: each home page view sent about four questions straight to the (small, free) database: the verified list (select *, up to 1000 rows), the district counts,
// the default "daily mix" of the directory, the promo popup, and one question per search. The answers are the same for everybody, so thousands of visitors meant
// thousands of identical questions.
// Now: the first visitor in a data centre asks, everybody after gets the saved answer for a few minutes. When the database does not answer, the last good answer is
// handed out (up to a week old) instead of an empty page. Nothing here writes to the database; only the read-only questions below are allowed.
//   GET /api/dir?f=counts
//   GET /api/dir?f=verified           (home page list)        GET /api/dir?f=verifiedlite   (card page list, five columns)
//   GET /api/dir?f=promo
//   GET /api/dir?f=members&a={"p_q":"..","p_limit":5}       (card page: names members typed for institutions not yet listed)
//   GET /api/dir?f=browse&a={"p_q":..,"p_districts":[..],"p_upazila":..,"p_type":..,"p_limit":30,"p_offset":0}
//   GET /api/dir?f=search&a={"p_q":"bani","p_limit":8}
//   GET /api/dir?f=comments&a={"p_limit":10,"p_offset":0,"p_kind":"idea","p_sort":"top"}   (card page: the public opinion board, kept for a minute; kind and sort are optional)
//   GET /api/dir?f=tutors&a={"p_district":"বরিশাল","p_upazila":"বরিশাল সদর","p_class":"c6-8","p_subject":"math","p_mode":"home","p_limit":12,"p_offset":0}   (/tutor: approved tutors, only when the admin switched the list on; every part is optional)
//   GET /api/dir?f=tutors&a={...,"p_gender":"female","p_medium":"bangla","p_exam":"ssc","p_trial":true,"p_verified":true,"p_pledge":true,"p_sort":"new"}   (the filters and sorts of the results system; each is optional and sent on only when used)
//   GET /api/dir?f=tutorfacets&a={"p_district":"বরিশাল","p_upazila":"বরিশাল সদর","p_mode":"home"}   (/tutor: how many tutors per filter option for that area and mode: only counts)
//   GET /api/dir?f=tutorstate                                  (/tutor: is the list on, are new requests open)

import { rest } from '../_lib/seo.js';

const LAST_GOOD = 7 * 24 * 3600;     // how long the last good answer is kept as a fallback

const VERIFIED = 'listing_submissions?select=*&status=eq.approved&verification=eq.verified&or=(is_hidden.is.null,is_hidden.eq.false)&order=created_at.desc&limit=1000';
const VERIFIED_LITE = 'listing_submissions?select=institution_name,institution_type,district,upazila,desired_slug&status=eq.approved&verification=eq.verified&or=(is_hidden.is.null,is_hidden.eq.false)&limit=2000';   // the card page's list
const PROMO = 'site_promos?select=*&slot=eq.home_popup&limit=1';

const str = (v, max) => (v === null || v === undefined) ? null : (typeof v === 'string' && v.length <= max ? v.replace(/\s+/g, ' ').trim() : undefined);   // undefined = not acceptable
const int = (v, lo, hi, dflt) => v === undefined ? dflt : (Number.isInteger(v) && v >= lo && v <= hi ? v : undefined);
const oneOf = (v, list) => (v === null || v === undefined || v === '') ? null : (typeof v === 'string' && list.includes(v) ? v : undefined);   // undefined = not acceptable
const TUTOR_CLASSES = ['c1-5', 'c6-8', 'c9-10', 'c11-12', 'admission'];
const TUTOR_SUBJECTS = ['bangla', 'english', 'math', 'science', 'physics', 'chemistry', 'biology', 'hmath', 'ict', 'accounting', 'business', 'economics', 'social', 'religion', 'arabic', 'handwriting', 'admission', 'primary_all'];
const TUTOR_MEDIUMS = ['bangla', 'english_version', 'english_medium', 'madrasa'];
const TUTOR_EXAMS = ['scholarship', 'ssc', 'hsc', 'admission_med', 'admission_eng', 'admission_uni', 'ielts', 'olevel'];
const TUTOR_SORTS = ['best', 'new', 'verified'];
const flag = v => (v === undefined || v === null || v === false) ? null : (v === true ? true : undefined);   // a yes/no filter: only "yes" means anything; undefined = not acceptable
const strList = (v, maxItems, maxLen) => {
  if (v === null || v === undefined) return null;
  if (!Array.isArray(v) || v.length > maxItems) return undefined;
  const out = []; for (const x of v) { const s = str(x, maxLen); if (s === undefined || s === null) return undefined; out.push(s); }
  return out;
};

// every question: how to build it from the visitor's arguments (null = refused) and how long an answer is reused (seconds)
const QUESTIONS = {
  counts:   { ttl: 600, build: () => ({ path: 'rpc/directory_counts', rpc: {} }) },
  verified: { ttl: 180, build: () => ({ path: VERIFIED }) },
  verifiedlite: { ttl: 180, build: () => ({ path: VERIFIED_LITE }) },
  promo:    { ttl: 60,  build: () => ({ path: PROMO }) },
  members:  { ttl: 300, build: a => {                       // names that members typed for institutions not in the directory (card page suggestions; the function reads no user data)
    const q = str(a.p_q, 100), limit = int(a.p_limit, 1, 8, 5);
    if (q === undefined || q === null || q.length < 2 || limit === undefined) return null;
    return { path: 'rpc/member_name_suggestions', rpc: { p_q: q, p_limit: limit } };
  } },
  browse:   { ttl: 600, build: a => {
    const q = str(a.p_q, 100), districts = strList(a.p_districts, 70, 40), upazila = str(a.p_upazila, 60), type = str(a.p_type, 40), limit = int(a.p_limit, 1, 50, 30), offset = int(a.p_offset, 0, 3000, 0);
    if ([q, districts, upazila, type, limit, offset].includes(undefined)) return null;
    return { path: 'rpc/directory_browse', rpc: { p_q: q || null, p_districts: districts, p_upazila: upazila || null, p_type: type || null, p_limit: limit, p_offset: offset } };
  } },
  comments: { ttl: 60, build: a => {                       // the public opinion board of the card page (published comments only; the functions never return the device or the account)
    const limit = int(a.p_limit, 1, 30, 10), offset = int(a.p_offset, 0, 1000, 0);
    const kind = (a.p_kind === undefined || a.p_kind === null || a.p_kind === '') ? null : (['opinion', 'idea', 'problem'].includes(a.p_kind) ? a.p_kind : undefined);
    const sort = a.p_sort === undefined ? 'new' : (['new', 'top'].includes(a.p_sort) ? a.p_sort : undefined);
    if ([limit, offset, kind, sort].includes(undefined)) return null;
    // the plain question (page, offset) goes to the first function; asking for a kind or a sort goes to the feed (2026-12-16 migration), so an old page keeps working either way
    if (a.p_kind === undefined && a.p_sort === undefined) return { path: 'rpc/card_comment_list', rpc: { p_limit: limit, p_offset: offset } };
    return { path: 'rpc/card_comment_feed', rpc: { p_limit: limit, p_offset: offset, p_kind: kind, p_sort: sort } };
  } },
  tutors:   { ttl: 60, build: a => {                       // /tutor: approved tutors (the function returns nothing until the admin switches the public list on; it never returns a mobile number or the real name)
    const district = str(a.p_district, 40), upazila = str(a.p_upazila, 60), cls = oneOf(a.p_class, TUTOR_CLASSES), subject = oneOf(a.p_subject, TUTOR_SUBJECTS), mode = oneOf(a.p_mode, ['home', 'online']), limit = int(a.p_limit, 1, 30, 12), offset = int(a.p_offset, 0, 500, 0);
    const gender = oneOf(a.p_gender, ['female', 'male']), medium = oneOf(a.p_medium, TUTOR_MEDIUMS), exam = oneOf(a.p_exam, TUTOR_EXAMS), trial = flag(a.p_trial), verified = flag(a.p_verified), pledge = flag(a.p_pledge);
    const sort = (a.p_sort === undefined || a.p_sort === null || a.p_sort === '') ? 'best' : (TUTOR_SORTS.includes(a.p_sort) ? a.p_sort : undefined);
    if ([district, upazila, cls, subject, mode, limit, offset, gender, medium, exam, trial, verified, pledge, sort].includes(undefined)) return null;
    const rpc = { p_district: district || null, p_upazila: upazila || null, p_class: cls, p_subject: subject, p_mode: mode, p_limit: limit, p_offset: offset };
    // the newer arguments go to the database only when they are used, so a database that has not had the 2026-12-20 update yet still answers the plain search
    if (gender) rpc.p_gender = gender; if (medium) rpc.p_medium = medium; if (exam) rpc.p_exam = exam;
    if (trial) rpc.p_trial = true; if (verified) rpc.p_verified = true; if (pledge) rpc.p_pledge = true; if (sort !== 'best') rpc.p_sort = sort;
    return { path: 'rpc/tutor_search', rpc: rpc };
  } },
  tutorfacets: { ttl: 60, build: a => {                    // /tutor: how many tutors per filter option for an area and a mode (only counts; all zero until the admin switches the list on)
    const district = str(a.p_district, 40), upazila = str(a.p_upazila, 60), mode = oneOf(a.p_mode, ['home', 'online']);
    if ([district, upazila, mode].includes(undefined)) return null;
    return { path: 'rpc/tutor_facets', rpc: { p_district: district || null, p_upazila: upazila || null, p_mode: mode } };
  } },
  tutorstate: { ttl: 60, build: () => ({ path: 'rpc/tutor_state', rpc: {} }) },
  search:   { ttl: 600, build: a => {
    const q = str(a.p_q, 100), limit = int(a.p_limit, 1, 20, 8);
    if (q === undefined || q === null || q.length < 1 || limit === undefined) return null;
    return { path: 'rpc/directory_search', rpc: { p_q: q, p_limit: limit } };
  } },
};

const json = (body, status, cache, extra = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache, ...extra } });
const keyOf = (kind, id) => new Request('https://protishthan.com/__cache/dir-' + kind + '/' + encodeURIComponent(id));

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const f = url.searchParams.get('f'), spec = Object.prototype.hasOwnProperty.call(QUESTIONS, f) ? QUESTIONS[f] : null;
  if (!spec) return json({ error: 'unknown question' }, 400, 'no-store');
  let args = {};
  const raw = url.searchParams.get('a');
  if (raw) { if (raw.length > 2500) return json({ error: 'too long' }, 400, 'no-store'); try { args = JSON.parse(raw); } catch (e) { return json({ error: 'bad arguments' }, 400, 'no-store'); } if (!args || typeof args !== 'object' || Array.isArray(args)) return json({ error: 'bad arguments' }, 400, 'no-store'); }
  const q = spec.build(args);
  if (!q) return json({ error: 'bad arguments' }, 400, 'no-store');

  const id = f + ':' + JSON.stringify(q.rpc || q.path);        // the cleaned-up question, so the same search typed with extra spaces shares one answer
  const cache = typeof caches !== 'undefined' ? caches.default : null;
  const read = async kind => { if (!cache) return null; try { const hit = await cache.match(keyOf(kind, id)); return hit ? await hit.text() : null; } catch (e) { return null; } };
  const write = (kind, body, ttl) => { if (!cache) return; const p = cache.put(keyOf(kind, id), new Response(body, { headers: { 'Cache-Control': 'public, max-age=' + ttl } })).catch(() => {}); if (context.waitUntil) context.waitUntil(p); };
  const browserTtl = Math.min(30, spec.ttl);

  const fresh = await read('fresh');
  if (fresh !== null) return json(fresh, 200, 'public, max-age=' + browserTtl, { 'X-Dir': 'edge' });

  const r = await rest(q.path, q.rpc === undefined ? { timeout: 4000 } : { rpc: q.rpc, timeout: 4000 });     // a plain table read keeps the limit written in its own address
  if (r && r.data !== undefined && r.data !== null) {
    const body = JSON.stringify(r.data);
    write('fresh', body, spec.ttl); write('last', body, LAST_GOOD);
    return json(body, 200, 'public, max-age=' + browserTtl, { 'X-Dir': 'db' });
  }
  const last = await read('last');                                // the database is not answering: the last good answer, marked as old
  if (last !== null) return json(last, 200, 'public, max-age=10', { 'X-Dir': 'stale' });
  return json({ error: 'database busy' }, 503, 'no-store', { 'Retry-After': '10' });
}
