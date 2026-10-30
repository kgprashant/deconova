// Sign in with mobile number + password. Looks up the account's email server-side so the email is never exposed.
import { createClient } from "npm:@supabase/supabase-js@2";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const out = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...cors, "Content-Type": "application/json" } });
const BAD = { ok: false, error: "Wrong mobile number or password." };
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  let b: any; try { b = await req.json(); } catch { return out(BAD); }
  const digits = String(b.phone ?? "").replace(/\D/g, "");
  const pw = String(b.password ?? "");
  if (digits.length < 10 || digits.length > 15 || pw.length < 6) return out(BAD);
  const phone = "+" + (digits.length === 10 ? "91" + digits : digits);
  const url = Deno.env.get("SUPABASE_URL")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data } = await admin.from("dn_users").select("email").eq("phone", phone).limit(2);
  if (!data || data.length !== 1 || !data[0].email) return out(BAD);
  const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: s, error } = await anon.auth.signInWithPassword({ email: data[0].email, password: pw });
  if (error || !s.session) return out(BAD);
  return out({ ok: true, access_token: s.session.access_token, refresh_token: s.session.refresh_token });
});
