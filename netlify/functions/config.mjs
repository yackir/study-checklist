export default async () => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, VAPID_PUBLIC_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return new Response(JSON.stringify({enabled:false}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
  return new Response(JSON.stringify({enabled:true,url:SUPABASE_URL,anonKey:SUPABASE_ANON_KEY,vapidPublicKey:VAPID_PUBLIC_KEY}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
};
