// dn-plan: "Ask AI" - three makeover plans (lowest cost, optimized, best) for one room photo.
import { createClient } from "npm:@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const out = (o: unknown) => new Response(JSON.stringify(o), { headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (code: string, message: string) => out({ ok: false, code, message });

const STYLES: Record<string, string> = {
  scandinavian: "Scandinavian", japandi: "Japandi", modern: "Modern", midcentury: "Mid-century", industrial: "Industrial",
  traditional: "Traditional", coastal: "Coastal", bohemian: "Bohemian", wabisabi: "Wabi-sabi", indo_contemporary: "Indo-contemporary",
  traditional_indian: "Traditional Indian", south_indian: "South Indian heritage", contemporary: "Contemporary", minimalist: "Minimalist",
  transitional: "Transitional", zen: "Zen", farmhouse: "Farmhouse", rustic: "Rustic", french_country: "French country", art_deco: "Art deco",
  mediterranean: "Mediterranean", craftsman: "Craftsman", shabby_chic: "Shabby chic", luxury_classic: "Luxury modern-classic",
  hollywood_regency: "Hollywood regency", maximalist: "Maximalist", eclectic: "Eclectic", biophilic: "Biophilic", moroccan: "Moroccan",
  tropical: "Tropical", rajasthani_haveli: "Rajasthani haveli", minimal_indian: "Contemporary minimal Indian",
};
const DECOR = ["Plants", "Gallery wall", "Floor lamp", "Bookshelf", "Rug", "Sheer curtains", "Pooja corner", "Reading chair", "Mirror", "Storage bench"];
const TIERS = ["lowest", "optimized", "best"];

async function who(req: Request) {
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data, error } = await c.auth.getUser();
  return error || !data.user ? null : data.user;
}

async function ask(image: string, prompt: string): Promise<string> {
  const ak = Deno.env.get("ANTHROPIC_API_KEY");
  if (ak) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "content-type": "application/json", "x-api-key": ak, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: Deno.env.get("CLAUDE_MODEL") ?? "claude-haiku-5-5", max_tokens: 3500, messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } }, { type: "text", text: prompt }] }] }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error?.message ?? "claude_" + r.status);
    return (j.content ?? []).map((o: any) => o.text ?? "").join("");
  }
  const gk = Deno.env.get("GEMINI_API_KEY"); if (!gk) throw new Error("no_key");
  const m = Deno.env.get("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": gk },
    body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: "image/jpeg", data: image } }, { text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? "gemini_" + r.status);
  return (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (!(await who(req))) return fail("auth", "Sign in again to continue.");
  let b: any; try { b = await req.json(); } catch { return fail("bad_request", "That request was not readable."); }
  if (typeof b.image !== "string" || b.image.length > 2_200_000) return fail("bad_image", "That photo is too large.");
  if (b.task === "locate") {
    const names = (Array.isArray(b.names) ? b.names : []).slice(0, 8).map((n: unknown) => String(n).replace(/[^\w ,.\-()/]/g, "").slice(0, 60)).filter(Boolean);
    if (!names.length) return out({ ok: true, result: { boxes: [] } });
    try {
      const t = (await ask(b.image, `This is a photo of a room after a makeover. Find each of these newly added items in the image: ${names.map((n) => '"' + n + '"').join(", ")}.
Return ONLY minified JSON: {"boxes":[{"name":"exactly as given","box":[x,y,w,h] or null}]}. box = the item's visible extent as integers 0-100, percent of image width (x,w) and height (y,h), x,y the top-left corner, tight fit. Use null if the item is not visible.`)).replace(/```json|```/g, "").trim();
      const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
      const boxes = (Array.isArray(j.boxes) ? j.boxes : []).map((o: any) => {
        const bx = Array.isArray(o.box) && o.box.length === 4 ? o.box.map((v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v))))) : null;
        const ok = bx && bx.every((v: number) => Number.isFinite(v)) && bx[2] >= 2 && bx[3] >= 2;
        return { name: String(o.name ?? "").slice(0, 60), box: ok ? bx : null };
      });
      return out({ ok: true, result: { boxes } });
    } catch (_e) { return out({ ok: true, result: { boxes: [] } }); }
  }
  const pack = String(b.pack_note ?? "").replace(/[^\w ,.\-()/]/g, "").slice(0, 300);
  const prompt = `You are a senior interior designer in India. Look at this room photo and propose THREE makeover plans.
Tiers: "lowest" = the cheapest meaningful upgrade (paint, textiles, lighting, rearranging; keep existing furniture); "optimized" = best value for money, a few key pieces; "best" = the best possible makeover for this room, realistic but cost no object.
${pack ? "Room needs: " + pack + "\n" : ""}For each plan choose style_id from: ${Object.keys(STYLES).join(", ")}. Choose decor only from: ${DECOR.join(", ")}.
Use realistic Indian retail prices in rupees. "paint_cost" = cost of repainting / wall finish changes for the plan (paint, labour), always a number. "items" = ONLY the new physical objects added to the room (2 to 6 per plan, each a single visible piece such as a rug, floor lamp or sofa), never paint.
Return ONLY minified JSON: {"summary":"one sentence about the room","plans":[{"tier":"lowest|optimized|best","title":"3-5 words","style_id":"...","wall":{"name":"paint name","hex":"#RRGGBB"},"paint_cost":number,"decor":["..."],"changes":["3 to 5 short verb-first lines"],"items":[{"name":"item","approx_cost":number}],"why":"one or two sentences"}]}`;
  try {
    const t = (await ask(b.image, prompt)).replace(/```json|```/g, "").trim();
    const j = JSON.parse(t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1));
    const plans = (Array.isArray(j.plans) ? j.plans.slice(0, 3) : []).map((p: any) => {
      const items = (Array.isArray(p.items) ? p.items.slice(0, 6) : []).map((i: any) => ({ name: String(i.name ?? "").slice(0, 80), approx_cost: Math.max(0, Math.round(Number(i.approx_cost) || 0)) }));
      const sid = STYLES[p.style_id] ? p.style_id : "contemporary";
      const hex = /^#[0-9a-fA-F]{6}$/.test(p.wall?.hex ?? "") ? p.wall.hex : null;
      const paint = Math.max(0, Math.round(Number(p.paint_cost) || 0));
      return {
        paint_cost: paint,
        title: String(p.title ?? "").slice(0, 60), style_id: sid, style_label: STYLES[sid],
        wall: hex ? { name: String(p.wall.name ?? "").slice(0, 40), hex } : null,
        decor: (Array.isArray(p.decor) ? p.decor : []).filter((d: string) => DECOR.includes(d)).slice(0, 6),
        changes: (Array.isArray(p.changes) ? p.changes : []).slice(0, 5).map((c: string) => String(c).slice(0, 140)),
        items, total_cost: paint + items.reduce((a: number, i: any) => a + i.approx_cost, 0), why: String(p.why ?? "").slice(0, 300),
      };
    }).filter((p: any) => p.items.length);
    if (plans.length < 3) return fail("ai_failed", "The AI could not plan this room. Try again.");
    plans.sort((a: any, b2: any) => a.total_cost - b2.total_cost);
    plans.forEach((p: any, i: number) => { p.tier = TIERS[i]; });
    return out({ ok: true, result: { summary: String(j.summary ?? "").slice(0, 240), plans } });
  } catch (e) {
    return String((e as Error).message) === "no_key" ? fail("no_key", "The AI key is not set on the server.") : fail("ai_failed", "The AI could not plan this room. Try again.");
  }
});
