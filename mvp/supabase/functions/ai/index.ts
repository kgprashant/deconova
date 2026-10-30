// Free-tier text and vision: room read and design story. Prompts live here, not in the browser.
import { cors, fail, reply, getUser, textAi, MAX_B64 } from "../_shared/util.ts";
import { STYLES, PACKS } from "../_shared/catalog.ts";

const TEXT_MODEL = Deno.env.get("GEMINI_TEXT_MODEL") ?? "gemini-2.5-flash"; // verify at build time

const parse = (j: any) => {
  const txt = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("")
    .replace(/```json|```/g, "").trim();
  return JSON.parse(txt);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return fail("auth", "Sign in again to continue.");
  let b: any;
  try { b = await req.json(); } catch { return fail("bad_request", "That request was not readable."); }
  if (typeof b.image !== "string" || b.image.length > MAX_B64) return fail("bad_image", "That photo is too large.");
  const img = { inline_data: { mime_type: "image/jpeg", data: b.image } };
  try {
    if (b.task === "room_read") {
      const j = await textAi(TEXT_MODEL, [img, { text:
        `You are the vision stage of an interior makeover app. Return ONLY minified JSON:
{"room_type":string,"detected":[up to 6 short nouns actually visible],"light":{"sources":number,"direction":string,"quality":string},"estimated_ceiling_m":number,"is_empty":boolean}` }],
        { responseMimeType: "application/json" });
      return reply({ ok: true, result: parse(j) });
    }
    if (b.task === "story") {
      const s = STYLES.find((x) => x.id === b.style_id) ?? STYLES[0];
      const pk = PACKS[b.pack_id];
      const pack = pk && b.pack_id !== "none" ? `, designed for ${pk.label.toLowerCase()} (${pk.constraints})` : "";
      const decor = Array.isArray(b.decor) && b.decor.length ? `, adding: ${b.decor.slice(0, 10).join(", ")}` : "";
      const j = await textAi(TEXT_MODEL, [img, { text:
        `You are an interior designer writing up a makeover of this room in ${s.label} style${pack}${decor}.
Return ONLY minified JSON:
{"palette":[{"name":"short evocative paint name","hex":"#RRGGBB"}] (4 items),
"changes":[5 short verb-first lines],
"why":"two sentences in a designer's voice",
"accessibility_notes":[${b.pack_id && b.pack_id !== "none" ? "3 short lines on the safety or accessibility decisions" : "empty array"}],
"items":[{"name":"piece","approx_cost":number}] (5 items, rupees),
"total_cost":number,"currency":"INR"}` }],
        { responseMimeType: "application/json" });
      return reply({ ok: true, result: parse(j) });
    }
    if (b.task === "budget") {
      const budget = Math.min(5_000_000, Math.max(5_000, Math.round(Number(b.budget) || 0)));
      const s = STYLES.find((x) => x.id === b.style_id) ?? STYLES[0];
      const pk = PACKS[b.pack_id];
      const pack = pk && b.pack_id !== "none" ? ` The room is for ${pk.label.toLowerCase()}: ${pk.constraints}.` : "";
      const j = await textAi(TEXT_MODEL, [img, { text:
        `You are an interior designer in India. Plan a makeover of this room in ${s.label} style (${s.prompt_dna}) for a total budget of ${budget} rupees.${pack}
Prefer paint, textiles, lighting, rearranging and a few key pieces over new large furniture. Use realistic Indian retail prices in rupees.
Return ONLY minified JSON: {"summary":"two plain sentences","items":[{"name":"short item name","approx_cost":number,"why":"one short reason"}] (4 to 8 items, highest impact first),"skipped":["up to 3 nice-to-have ideas that did not fit"]}` }],
        { responseMimeType: "application/json" });
      const r = parse(j);
      // Enforce the budget here, not in the prompt: keep items in order until the next one would break it.
      let total = 0; const items: any[] = []; const skipped: string[] = Array.isArray(r.skipped) ? r.skipped.slice(0, 3) : [];
      for (const it of Array.isArray(r.items) ? r.items.slice(0, 8) : []) {
        const c = Math.max(0, Math.round(Number(it.approx_cost) || 0));
        if (total + c <= budget) { total += c; items.push({ name: String(it.name ?? "").slice(0, 80), approx_cost: c, why: String(it.why ?? "").slice(0, 140) }); }
        else if (skipped.length < 3) skipped.push(String(it.name ?? "").slice(0, 80));
      }
      return reply({ ok: true, result: { summary: String(r.summary ?? "").slice(0, 400), items, total_cost: total, skipped, budget } });
    }
    if (b.task === "vastu") {
      const dir = String(b.direction ?? "").replace(/[^a-zA-Z \-]/g, "").slice(0, 20);
      const j = await textAi(TEXT_MODEL, [img, { text:
        `You are a practical Vastu Shastra consultant. Look at this room and give suggestions in a calm, non-alarmist tone.
Rules: suggest only changes made by moving or adding things (furniture placement, colours, mirrors, plants, lighting). Never suggest structural changes, and never claim that anything is unlucky or harmful.
A photo cannot show true compass directions. ${dir ? `The room's light seems to come from the ${dir}, but say that directions should be confirmed with a compass.` : "Say that directions should be confirmed with a compass."}
Return ONLY minified JSON: {"direction_note":"one sentence on the compass caveat","notes":[{"area":"short area name","suggestion":"one practical sentence"}] (4 to 6 items),"caution":"one sentence saying these are traditional suggestions, not guarantees"}` }],
        { responseMimeType: "application/json" });
      const r = parse(j);
      const notes = (Array.isArray(r.notes) ? r.notes.slice(0, 6) : []).map((n: any) => ({ area: String(n.area ?? "").slice(0, 40), suggestion: String(n.suggestion ?? "").slice(0, 220) }));
      return reply({ ok: true, result: { direction_note: String(r.direction_note ?? "").slice(0, 200), notes, caution: String(r.caution ?? "").slice(0, 200) } });
    }
    return fail("bad_request", "Unknown task.");
  } catch (e) {
    const m = String((e as Error).message);
    if (m === "no_key") return fail("no_key", "The AI key is not set on the server.");
    return fail("ai_failed", "The AI could not read that. Using the built-in fallback.");
  }
});
