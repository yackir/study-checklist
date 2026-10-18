// Cloudflare Pages compatibility endpoint for the existing Netlify config URL.
// No Supabase service-role credentials belong in this endpoint.
export async function onRequestGet({ env }) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ enabled: false }), { status: 503, headers });
  }
  return new Response(JSON.stringify({
    enabled: true,
    url: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    vapidPublicKey: null
  }), { headers });
}
