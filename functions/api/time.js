// /api/time — the server's clock in milliseconds, for the live game (ব্যাচ চ্যালেঞ্জ): every phone works out how far its own clock is from this one, so everybody sees the same question at the same moment.
// No database, never cached (a saved answer would be an old time).
export async function onRequestGet() {
  return new Response(JSON.stringify({ now: Date.now() }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
}
