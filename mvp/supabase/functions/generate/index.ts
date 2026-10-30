// The only function that spends money. Server-side credits, idempotency and a hard global cap.
import { cors, fail, reply, getUser, admin, gemini, MAX_B64 } from "../_shared/util.ts";
import { STYLES, PACKS } from "../_shared/catalog.ts";

const IMAGE_MODEL = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-nano-banana-2.1"; // verify at build time
const MAX_TOTAL = Number(Deno.env.get("MAX_TOTAL_RENDERS") ?? "300");  // hard ceiling on spend

const LOCK = `ABSOLUTE CONSTRAINTS
- Keep the camera position, focal length and perspective identical.
- Do not move, add or remove walls, windows, doors, or the ceiling line.
- Keep the room's real dimensions and proportions.
- Photorealistic interior photograph. No text, no labels, no watermarks.`;
const AVOID = `AVOID
New walls or windows, changed camera angle, warped or melted furniture, impossible geometry, visible text, oversaturation.`;

const clean = (s: unknown, n = 80) => String(s ?? "").replace(/[^\p{L}\p{N} ,.'\-]/gu, "").slice(0, n);

function buildPrompt(b: any): string | null {
  const room = b.room ?? {};
  const roomLine = `ROOM
Type: ${clean(room.room_type, 30) || "room"}. Existing light: ${Number(room.light?.sources) || 1} sources, ${clean(room.light?.direction, 20) || "side"}-facing, ${clean(room.light?.quality, 30) || "soft"}.`;
  const style = STYLES.find((x) => x.id === b.style_id);
  const pk = PACKS[b.pack_id];
  const stylePart = style ? `STYLE: ${style.label}
${style.prompt_dna}
Palette, 60/30/10: ${style.palette[0][0]} dominant, ${style.palette[1][0]} secondary, ${style.palette[2][0]} accent.
Materials: ${style.materials}
Lighting character: ${style.lighting}` : "";
  const packPart = pk && b.pack_id !== "none" ? `WHO LIVES HERE: ${pk.label}\n${pk.constraints}` : "";
  const decor = Array.isArray(b.decor) && b.decor.length
    ? `ALSO INCLUDE: ${b.decor.slice(0, 10).map((d: string) => clean(d, 30)).join(", ")}` : "";

  switch (b.mode) {
    case "restyle":
      return style ? ["Restyle this interior photograph.", LOCK, roomLine, stylePart, packPart, decor, AVOID].filter(Boolean).join("\n\n") : null;
    case "stage": {
      const dens = ({ minimal: "a few essential pieces", balanced: "a complete, comfortable layout", full: "a fully furnished, layered layout" } as any)[b.density] ?? "a complete, comfortable layout";
      return ["This photograph shows an empty or sparsely furnished room. Furnish it virtually.", LOCK,
        "Add furniture and decor only. Do not change any wall, window, door, floor or ceiling.",
        roomLine, `Furnish with ${dens}, scaled correctly to the room.`, stylePart, packPart, decor, AVOID].filter(Boolean).join("\n\n");
    }
    case "floor":
      return `Replace only the flooring in this interior photograph with ${clean(b.material, 40)}.
Keep every other element identical: walls, furniture, decor, ceiling, window frames, camera angle and composition.
Keep the perspective of the floor and the existing shadows and light. Photorealistic. No text.`;
    case "remove":
      return `Remove the following from this interior photograph: ${clean(b.target, 80)}.
Fill the area with realistic background that continues the surrounding wall, floor or surface.
Keep every other element identical, including the camera angle and composition. Photorealistic. No text.`;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const user = await getUser(req);
  if (!user) return fail("auth", "Sign in again to continue.");
  let b: any;
  try { b = await req.json(); } catch { return fail("bad_request", "That request was not readable."); }
  if (typeof b.image !== "string" || b.image.length > MAX_B64) return fail("bad_image", "That photo is too large. Retake it at a lower resolution.");
  if (typeof b.request_id !== "string" || b.request_id.length < 8) return fail("bad_request", "Missing request id.");
  const prompt = buildPrompt(b);
  if (!prompt) return fail("bad_request", "That edit is not available.");

  const db = admin();
  const rid = `${user.id}:${b.request_id}`.slice(0, 120);
  const { data: left, error } = await db.rpc("spend_credit", { p_user: user.id, p_request: rid, p_mode: b.mode, p_max_total: MAX_TOTAL });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("no_credits")) return fail("no_credits", "You are out of credits.");
    if (m.includes("duplicate")) return fail("duplicate", "That render is already running. Wait a moment.");
    if (m.includes("cap")) return fail("cap", "The demo's render budget is used up. Showing the simulated preview instead.");
    return fail("server", "Something went wrong before rendering. No credit was used.");
  }
  try {
    const j = await gemini(IMAGE_MODEL,
      [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b.image } }],
      { responseModalities: ["IMAGE"] });
    const part = (j?.candidates?.[0]?.content?.parts ?? []).find((p: any) => p.inlineData?.data || p.inline_data?.data);
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (!data) throw new Error("no_image");
    await db.rpc("finish_render", { p_user: user.id, p_request: rid });
    return reply({ ok: true, image: data, mime: part.inlineData?.mimeType ?? "image/png", credits_left: left });
  } catch (_e) {
    const { data: back } = await db.rpc("refund_credit", { p_user: user.id, p_request: rid });
    return reply({ ok: false, code: "render_failed", credits_left: back,
      message: "The image model could not finish that render. Your credit was refunded. Try again." });
  }
});
