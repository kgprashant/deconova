import { createClient } from "npm:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Always answer HTTP 200 with {ok:false,...} so the web app can show our own message.
export const reply = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });

export const fail = (code: string, message: string) => reply({ ok: false, code, message });

export async function getUser(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const authed = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data, error } = await authed.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export const admin = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

// Gemini REST call. The key lives only in function secrets.
export async function gemini(model: string, parts: unknown[], generationConfig: Record<string, unknown>) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig }),
    },
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `gemini_${r.status}`);
  return j;
}

export const MAX_B64 = 2_200_000; // ~1.6 MB image; the client sends 1280 px JPEGs

// Claude text+vision call (fast). Returns a Gemini-shaped reply so callers can share one parser.
export async function claude(parts: any[]) {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("no_key");
  const model = Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-5-5";
  const content = parts.map((p) => p.inline_data
    ? { type: "image", source: { type: "base64", media_type: p.inline_data.mime_type, data: p.inline_data.data } }
    : { type: "text", text: p.text });
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: "user", content }] }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `claude_${r.status}`);
  const text = (j.content ?? []).map((c: any) => c.text ?? "").join("");
  return { candidates: [{ content: { parts: [{ text }] } }] };
}

// Prefer Claude for text/vision when its key exists, else fall back to Gemini (with retry on busy).
export async function textAi(geminiModel: string, parts: any[], cfg: Record<string, unknown>) {
  if (Deno.env.get("ANTHROPIC_API_KEY")) return claude(parts);
  for (let n = 0;; n++) {
    try { return await gemini(geminiModel, parts, cfg); }
    catch (x) {
      if (n >= 3 || !/demand|overload|unavailable|429|503/i.test(String((x as Error).message))) throw x;
      await new Promise((s) => setTimeout(s, 2500 * (n + 1)));
    }
  }
}
