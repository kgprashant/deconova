// _shared/util.ts
import { createClient } from "npm:@supabase/supabase-js@2";
var cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
var reply = (body) => new Response(JSON.stringify(body), { headers: { ...cors, "Content-Type": "application/json" } });
var fail = (code, message) => reply({ ok: false, code, message });
async function getUser(req) {
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const authed = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }
  });
  const { data, error } = await authed.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}
var admin = () => createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
async function gemini(model, parts, generationConfig) {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ parts }], generationConfig })
    }
  );
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error?.message ?? `gemini_${r.status}`);
  return j;
}
var MAX_B64 = 22e5;

// _shared/catalog.ts
var STYLES = [
  {
    "id": "scandinavian",
    "label": "Scandinavian",
    "palette": [
      [
        "Chalk",
        "#F2EFE9"
      ],
      [
        "Pale oak",
        "#D8C3A2"
      ],
      [
        "Soft sage",
        "#A9B5A0"
      ],
      [
        "Ink",
        "#2E2E2B"
      ]
    ],
    "materials": "light oak, wool, linen, matte black metal, ceramic",
    "lighting": "2700K, soft, many small sources",
    "prompt_dna": "uncluttered, low-slung light-wood furniture, one woven rug, bare or sheer windows, a few plants, nothing ornate"
  },
  {
    "id": "japandi",
    "label": "Japandi",
    "palette": [
      [
        "Warm greige",
        "#CFC7BB"
      ],
      [
        "Charcoal",
        "#3A3A38"
      ],
      [
        "Muted clay",
        "#A9705B"
      ],
      [
        "Paper",
        "#EDE8DF"
      ]
    ],
    "materials": "two woods only, paper, stone, raw cotton",
    "lighting": "low warm pools, paper diffusers",
    "prompt_dna": "low furniture, floor-level sightlines, hidden storage, negative space treated as a material, no visual noise"
  },
  {
    "id": "modern",
    "label": "Modern",
    "palette": [
      [
        "Snow",
        "#F7F7F6"
      ],
      [
        "Graphite",
        "#39393B"
      ],
      [
        "Steel",
        "#8E9499"
      ],
      [
        "Bronze",
        "#8A6A3F"
      ]
    ],
    "materials": "lacquer, glass, brushed steel, engineered stone",
    "lighting": "even, cool-neutral, recessed",
    "prompt_dna": "clean lines, minimal ornament, one sculptural object, flush surfaces, restrained colour"
  },
  {
    "id": "midcentury",
    "label": "Mid-century",
    "palette": [
      [
        "Bone",
        "#EDE6D8"
      ],
      [
        "Teak",
        "#8A5B34"
      ],
      [
        "Olive",
        "#7A7A42"
      ],
      [
        "Mustard",
        "#D29B2C"
      ]
    ],
    "materials": "teak, walnut, boucle, tapered legs, smoked glass",
    "lighting": "warm, globe and cone shades",
    "prompt_dna": "tapered-leg furniture, low sideboard, one statement armchair, geometric textile, warm wood everywhere"
  },
  {
    "id": "industrial",
    "label": "Industrial",
    "palette": [
      [
        "Concrete",
        "#B6B4AF"
      ],
      [
        "Iron",
        "#434548"
      ],
      [
        "Brick",
        "#9A5C44"
      ],
      [
        "Oiled oak",
        "#6E5438"
      ]
    ],
    "materials": "raw concrete, blackened steel, reclaimed timber, exposed brick",
    "lighting": "pendant cages, directional, cool",
    "prompt_dna": "exposed structure, metal shelving, leather seating, oversized pendant, nothing precious"
  },
  {
    "id": "traditional",
    "label": "Traditional",
    "palette": [
      [
        "Antique white",
        "#EFE8DA"
      ],
      [
        "Mahogany",
        "#5B2E22"
      ],
      [
        "Sage",
        "#8E9A82"
      ],
      [
        "Gilt",
        "#A98A4F"
      ]
    ],
    "materials": "mahogany, damask, wool rug, brass, moulding",
    "lighting": "table lamps, warm, pooled",
    "prompt_dna": "symmetrical arrangement, rolled-arm seating, framed art in a set, patterned rug, crown moulding respected"
  },
  {
    "id": "coastal",
    "label": "Coastal",
    "palette": [
      [
        "Shell",
        "#F3F1EA"
      ],
      [
        "Sea glass",
        "#9DC0BC"
      ],
      [
        "Driftwood",
        "#B5A48E"
      ],
      [
        "Navy",
        "#2A4256"
      ]
    ],
    "materials": "whitewashed wood, rattan, linen slipcovers, jute",
    "lighting": "bright, daylight-led, sheer-filtered",
    "prompt_dna": "airy, slipcovered seating, rattan accents, blue and white textiles, windows left bare or sheer"
  },
  {
    "id": "bohemian",
    "label": "Bohemian",
    "palette": [
      [
        "Cream",
        "#F0E7D8"
      ],
      [
        "Terracotta",
        "#B2603F"
      ],
      [
        "Jade",
        "#4F7A63"
      ],
      [
        "Plum",
        "#6A3A52"
      ]
    ],
    "materials": "rattan, kilim, macrame, brass, plenty of plants",
    "lighting": "warm, layered, string and lantern",
    "prompt_dna": "layered rugs, low seating, many plants, mixed patterns that share a warm base, collected not bought"
  },
  {
    "id": "wabisabi",
    "label": "Wabi-sabi",
    "palette": [
      [
        "Lime plaster",
        "#DED6C8"
      ],
      [
        "Earth",
        "#8B7B68"
      ],
      [
        "Charcoal",
        "#3C3A36"
      ],
      [
        "Moss",
        "#767A5F"
      ]
    ],
    "materials": "lime plaster, unglazed ceramic, raw linen, weathered wood",
    "lighting": "single soft source, long shadows welcomed",
    "prompt_dna": "imperfect handmade surfaces, almost empty, one branch or vessel as the focal point, texture over colour"
  },
  {
    "id": "indo_contemporary",
    "label": "Indo-contemporary",
    "palette": [
      [
        "Bone",
        "#EDE9E2"
      ],
      [
        "Walnut",
        "#5C4432"
      ],
      [
        "Brass",
        "#B08D57"
      ],
      [
        "Deep teal",
        "#1F4F53"
      ]
    ],
    "materials": "teak veneer, brass inlay, cane, terrazzo",
    "lighting": "neutral ambient with warm accents",
    "prompt_dna": "clean modern envelope warmed with Indian materials, cane cabinet fronts, brass detailing, one heritage object as a focal point"
  },
  {
    "id": "traditional_indian",
    "label": "Traditional Indian",
    "palette": [
      [
        "Ivory",
        "#EFE6D4"
      ],
      [
        "Deep teak",
        "#4A2F1E"
      ],
      [
        "Marigold",
        "#E2A33B"
      ],
      [
        "Peacock",
        "#1C5660"
      ]
    ],
    "materials": "carved teak, brass, block-print cotton, terracotta, jaali screens",
    "lighting": "warm, layered, lamp-led",
    "prompt_dna": "carved wood seating, brass accents, patterned textiles, a jaali or screen element, floor seating option, rich saturated accents"
  },
  {
    "id": "south_indian",
    "label": "South Indian heritage",
    "palette": [
      [
        "Lime white",
        "#F1EADA"
      ],
      [
        "Rosewood",
        "#4A2B26"
      ],
      [
        "Athangudi red",
        "#9C4030"
      ],
      [
        "Palm",
        "#4E6B46"
      ]
    ],
    "materials": "rosewood, Athangudi tile, oxide flooring, brass, terracotta",
    "lighting": "warm, courtyard daylight plus oil-lamp accents",
    "prompt_dna": "patterned Athangudi or oxide floor, rosewood swing or low seating, pillared sightline, brass vessels, deep shade"
  },
  {
    "id": "contemporary",
    "label": "Contemporary",
    "palette": [
      [
        "Warm white",
        "#F4F1EC"
      ],
      [
        "Taupe",
        "#A89888"
      ],
      [
        "Black",
        "#232323"
      ],
      [
        "Brass",
        "#B89B5E"
      ]
    ],
    "materials": "matte lacquer, stone, glass, boucl\xE9, brushed brass",
    "lighting": "layered, warm-neutral, concealed sources",
    "prompt_dna": "current and clean-lined, a curved sofa, statement lighting, one bold art piece, mixed textures within a calm palette"
  },
  {
    "id": "minimalist",
    "label": "Minimalist",
    "palette": [
      [
        "Pure white",
        "#F8F8F6"
      ],
      [
        "Light grey",
        "#D9D9D6"
      ],
      [
        "Pale ash",
        "#CDB89A"
      ],
      [
        "Black",
        "#1E1E1E"
      ]
    ],
    "materials": "plaster, pale wood, glass, steel",
    "lighting": "even, daylight-led, hidden sources",
    "prompt_dna": "almost empty, flush storage, one object per surface, no pattern, generous negative space"
  },
  {
    "id": "transitional",
    "label": "Transitional",
    "palette": [
      [
        "Greige",
        "#D3CBBE"
      ],
      [
        "Navy",
        "#2F3F57"
      ],
      [
        "Soft white",
        "#F1EEE8"
      ],
      [
        "Walnut",
        "#6A4B36"
      ]
    ],
    "materials": "walnut, linen, velvet, nickel",
    "lighting": "warm, balanced table and floor lamps",
    "prompt_dna": "classic shapes with modern restraint, a neutral base, one navy accent, symmetrical but uncluttered"
  },
  {
    "id": "zen",
    "label": "Zen",
    "palette": [
      [
        "Stone grey",
        "#B8B4AA"
      ],
      [
        "Bamboo",
        "#C9B788"
      ],
      [
        "Charcoal",
        "#343432"
      ],
      [
        "Rice white",
        "#F0EDE4"
      ]
    ],
    "materials": "bamboo, stone, paper screens, raw cotton, dark wood",
    "lighting": "soft, diffused, low",
    "prompt_dna": "calm and spare, low platform furniture, a single stone or branch as the focal point, mats underfoot, strict order"
  },
  {
    "id": "farmhouse",
    "label": "Farmhouse",
    "palette": [
      [
        "Shiplap white",
        "#F2EFE8"
      ],
      [
        "Barn red",
        "#8B3A2F"
      ],
      [
        "Sage",
        "#A3AE95"
      ],
      [
        "Weathered oak",
        "#A68A64"
      ]
    ],
    "materials": "reclaimed wood, shiplap, iron, cotton, enamel",
    "lighting": "warm lantern and pendant light",
    "prompt_dna": "shiplap walls, a large wooden table, open shelving, vintage touches, cosy and not kitsch"
  },
  {
    "id": "rustic",
    "label": "Rustic",
    "palette": [
      [
        "Bark",
        "#5A4634"
      ],
      [
        "Stone",
        "#A59C8E"
      ],
      [
        "Moss",
        "#6C7656"
      ],
      [
        "Cream",
        "#E9E0CF"
      ]
    ],
    "materials": "rough-hewn timber, stone, leather, wool, iron",
    "lighting": "warm, low, fireside",
    "prompt_dna": "exposed beams respected, natural stone, chunky wood furniture, wool throws, earthy handmade textures"
  },
  {
    "id": "french_country",
    "label": "French country",
    "palette": [
      [
        "Ivory",
        "#F1EBDD"
      ],
      [
        "Powder blue",
        "#A9BCCB"
      ],
      [
        "Butter yellow",
        "#E5C97A"
      ],
      [
        "Antique gold",
        "#A98A4F"
      ]
    ],
    "materials": "painted wood, toile, linen, wrought iron, aged mirror",
    "lighting": "soft chandelier and candle glow",
    "prompt_dna": "curved legs, distressed painted furniture, floral or toile textiles, iron details, gentle pastels"
  },
  {
    "id": "art_deco",
    "label": "Art deco",
    "palette": [
      [
        "Black lacquer",
        "#1B1A1C"
      ],
      [
        "Emerald",
        "#1F5C4A"
      ],
      [
        "Gold",
        "#C2A04F"
      ],
      [
        "Ivory",
        "#EFE8D6"
      ]
    ],
    "materials": "lacquer, polished brass, velvet, mirror, marble",
    "lighting": "dramatic, sconces and glowing fixtures",
    "prompt_dna": "bold geometry, sunburst motifs, mirrored surfaces, velvet seating, symmetrical glamour, metallic accents"
  },
  {
    "id": "mediterranean",
    "label": "Mediterranean",
    "palette": [
      [
        "Whitewash",
        "#F4F1EA"
      ],
      [
        "Terracotta",
        "#B9643F"
      ],
      [
        "Aegean blue",
        "#2F6C9A"
      ],
      [
        "Olive",
        "#7A7B4A"
      ]
    ],
    "materials": "limewash plaster, terracotta, wrought iron, glazed tile, rough timber",
    "lighting": "bright warm sun, lantern accents",
    "prompt_dna": "textured plaster walls, existing arches respected, glazed tile accents, iron and wood, sun-washed palette"
  },
  {
    "id": "craftsman",
    "label": "Craftsman",
    "palette": [
      [
        "Oak",
        "#8A6A44"
      ],
      [
        "Forest green",
        "#3F5A44"
      ],
      [
        "Cream",
        "#EEE6D2"
      ],
      [
        "Copper",
        "#A8643A"
      ]
    ],
    "materials": "quarter-sawn oak, stained glass, copper, leather, wool",
    "lighting": "warm mission-style lamps",
    "prompt_dna": "built-in cabinetry, exposed joinery, straight-lined oak furniture, earthy palette, handcrafted details"
  },
  {
    "id": "shabby_chic",
    "label": "Shabby chic",
    "palette": [
      [
        "Antique white",
        "#F0EAE0"
      ],
      [
        "Dusty rose",
        "#D3A4A4"
      ],
      [
        "Sage mist",
        "#B3BFAE"
      ],
      [
        "Grey blue",
        "#AEB9C4"
      ]
    ],
    "materials": "distressed painted wood, lace, cotton, vintage mirror, crystal",
    "lighting": "soft, romantic, chandelier and candles",
    "prompt_dna": "distressed whitewashed furniture, ruffled and lace textiles, soft florals, vintage finds, romantic and worn-in"
  },
  {
    "id": "luxury_classic",
    "label": "Luxury modern-classic",
    "palette": [
      [
        "Ivory marble",
        "#EEE9DF"
      ],
      [
        "Champagne",
        "#CDB78F"
      ],
      [
        "Charcoal",
        "#36363A"
      ],
      [
        "Deep green",
        "#24433B"
      ]
    ],
    "materials": "marble, polished brass, silk, velvet, walnut veneer",
    "lighting": "warm dimmable, sculptural fixtures",
    "prompt_dna": "wall panelling and mouldings, marble surfaces, plush tufted seating, one statement chandelier, refined symmetry"
  },
  {
    "id": "hollywood_regency",
    "label": "Hollywood regency",
    "palette": [
      [
        "Mirror silver",
        "#C9CCD0"
      ],
      [
        "Fuchsia",
        "#B03A7A"
      ],
      [
        "Black",
        "#1C1C1E"
      ],
      [
        "Cream",
        "#F1EBDC"
      ]
    ],
    "materials": "mirror, lacquer, velvet, chrome, faux fur",
    "lighting": "glamorous crystal and sconces",
    "prompt_dna": "high-gloss lacquer, mirrored furniture, tufted velvet, bold colour pops, metallic accents, theatrical symmetry"
  },
  {
    "id": "maximalist",
    "label": "Maximalist",
    "palette": [
      [
        "Jewel plum",
        "#5B2A55"
      ],
      [
        "Teal",
        "#1E6B6B"
      ],
      [
        "Marigold",
        "#E0A32E"
      ],
      [
        "Blush",
        "#E8BFC0"
      ]
    ],
    "materials": "velvet, lacquer, brass, pattern-on-pattern textiles",
    "lighting": "rich and layered, many lamps",
    "prompt_dna": "bold saturated colour, layered patterns that share a palette, a gallery wall, collected objects, abundant not chaotic"
  },
  {
    "id": "eclectic",
    "label": "Eclectic",
    "palette": [
      [
        "Cream",
        "#F0E9DA"
      ],
      [
        "Cobalt",
        "#2E4C9C"
      ],
      [
        "Rust",
        "#A8532E"
      ],
      [
        "Mustard",
        "#D1A12E"
      ]
    ],
    "materials": "mixed woods, vintage metals, kilim, leather, ceramics",
    "lighting": "mixed warm sources",
    "prompt_dna": "a deliberate mix of eras, one unifying colour thread, vintage and modern side by side, personal objects"
  },
  {
    "id": "biophilic",
    "label": "Biophilic",
    "palette": [
      [
        "Leaf green",
        "#4F7A4B"
      ],
      [
        "Fern",
        "#8BA474"
      ],
      [
        "Natural linen",
        "#E6DFCF"
      ],
      [
        "Bark brown",
        "#5E4B3A"
      ]
    ],
    "materials": "living plants, bamboo, cork, rattan, stone, linen",
    "lighting": "bright natural daylight, soft",
    "prompt_dna": "many real plants at several heights, hanging planters, natural materials, daylight maximised"
  },
  {
    "id": "moroccan",
    "label": "Moroccan",
    "palette": [
      [
        "Zellige blue",
        "#1F5E7D"
      ],
      [
        "Saffron",
        "#D9962E"
      ],
      [
        "Terracotta",
        "#B5573A"
      ],
      [
        "Cream",
        "#EEE3CE"
      ]
    ],
    "materials": "zellige tile, carved wood, brass lanterns, kilim, leather poufs",
    "lighting": "warm patterned light from pierced lanterns",
    "prompt_dna": "existing arches respected, geometric tile accents, low seating with poufs, pierced brass lanterns, layered rugs, saturated colour"
  },
  {
    "id": "tropical",
    "label": "Tropical",
    "palette": [
      [
        "Palm green",
        "#2F6B3F"
      ],
      [
        "Coral",
        "#E26B50"
      ],
      [
        "Sand",
        "#EADBBE"
      ],
      [
        "Teak",
        "#7A5638"
      ]
    ],
    "materials": "rattan, bamboo, teak, linen, large-leaf prints",
    "lighting": "bright, airy, filtered",
    "prompt_dna": "large-leaf plants, rattan and bamboo furniture, botanical prints, breezy linen, one vivid accent colour, resort feel"
  },
  {
    "id": "rajasthani_haveli",
    "label": "Rajasthani haveli",
    "palette": [
      [
        "Sandstone pink",
        "#C98D72"
      ],
      [
        "Royal blue",
        "#234A8C"
      ],
      [
        "Gold",
        "#C9A24A"
      ],
      [
        "Cream",
        "#EFE5CF"
      ]
    ],
    "materials": "jaali carved stone, mirror work, brass, block-print cotton, carved teak",
    "lighting": "warm lamp-lit, filigree lanterns",
    "prompt_dna": "arched niches, mirror and inlay work, jaali screens, bolsters and floor seating, rich textiles, courtyard feel"
  },
  {
    "id": "minimal_indian",
    "label": "Contemporary minimal Indian",
    "palette": [
      [
        "Khadi white",
        "#EFEAE0"
      ],
      [
        "Teak",
        "#7A5A3E"
      ],
      [
        "Terracotta",
        "#B2603F"
      ],
      [
        "Indigo",
        "#2E3C63"
      ]
    ],
    "materials": "teak, cane, handloom cotton, terracotta, brass",
    "lighting": "warm neutral",
    "prompt_dna": "restrained Indian look, low teak furniture, handloom textiles in one accent colour, a brass vessel as focal point, uncluttered with heritage warmth"
  }
];
var PACKS = {
  "none": {
    "label": "No one in particular",
    "constraints": "A straight makeover, no extra constraints"
  },
  "elderly": {
    "label": "An elderly parent",
    "constraints": "Seat heights 45 cm+, no low glass, no loose rugs, non-slip flooring, strong floor-to-wall contrast, layered warm task lighting, 90 cm clear circulation"
  },
  "child": {
    "label": "A young child",
    "constraints": "Rounded corners, no glass, storage at 60\u201390 cm reach, no exposed cords, washable fabrics, anchored tall furniture, no small loose decor"
  },
  "wheelchair": {
    "label": "A wheelchair user",
    "constraints": "90 cm clear paths, 76 cm clearance under tables and desks, no thick-pile rugs, shelving under 120 cm, turning circle preserved"
  },
  "pets": {
    "label": "Pets",
    "constraints": "Tight-weave durable fabrics, nothing trailing or fringed, raised planters only, washable floor covering"
  },
  "rental": {
    "label": "A small rental",
    "constraints": "Nothing structural, one feature wall at most, freestanding and multi-use furniture only, vertical storage"
  },
  "wfh": {
    "label": "Someone working from home",
    "constraints": "A defined desk zone, glare-free window relationship, task lighting, acoustic softening, cable discipline"
  }
};

// generate/index.ts
var IMAGE_MODEL = Deno.env.get("GEMINI_IMAGE_MODEL") ?? "gemini-nano-banana-2.1";
var MAX_TOTAL = Number(Deno.env.get("MAX_TOTAL_RENDERS") ?? "300");
var LOCK = `ABSOLUTE CONSTRAINTS
- Keep the camera position, focal length and perspective identical.
- Do not move, add or remove walls, windows, doors, or the ceiling line.
- Keep the room's real dimensions and proportions.
- Photorealistic interior photograph. No text, no labels, no watermarks.`;
var AVOID = `AVOID
New walls or windows, changed camera angle, warped or melted furniture, impossible geometry, visible text, oversaturation.`;
var clean = (s, n = 80) => String(s ?? "").replace(/[^\p{L}\p{N} ,.'\-]/gu, "").slice(0, n);
function buildPrompt(b) {
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
  const packPart = pk && b.pack_id !== "none" ? `WHO LIVES HERE: ${pk.label}
${pk.constraints}` : "";
  const decor = Array.isArray(b.decor) && b.decor.length ? `ALSO INCLUDE: ${b.decor.slice(0, 10).map((d) => clean(d, 30)).join(", ")}` : "";
  switch (b.mode) {
    case "restyle":
      return style ? ["Restyle this interior photograph.", LOCK, roomLine, stylePart, packPart, decor, AVOID].filter(Boolean).join("\n\n") : null;
    case "stage": {
      const dens = { minimal: "a few essential pieces", balanced: "a complete, comfortable layout", full: "a fully furnished, layered layout" }[b.density] ?? "a complete, comfortable layout";
      return [
        "This photograph shows an empty or sparsely furnished room. Furnish it virtually.",
        LOCK,
        "Add furniture and decor only. Do not change any wall, window, door, floor or ceiling.",
        roomLine,
        `Furnish with ${dens}, scaled correctly to the room.`,
        stylePart,
        packPart,
        decor,
        AVOID
      ].filter(Boolean).join("\n\n");
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
  let b;
  try {
    b = await req.json();
  } catch {
    return fail("bad_request", "That request was not readable.");
  }
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
    const j = await gemini(
      IMAGE_MODEL,
      [{ text: prompt }, { inline_data: { mime_type: "image/jpeg", data: b.image } }],
      { responseModalities: ["IMAGE"] }
    );
    const part = (j?.candidates?.[0]?.content?.parts ?? []).find((p) => p.inlineData?.data || p.inline_data?.data);
    const data = part?.inlineData?.data ?? part?.inline_data?.data;
    if (!data) throw new Error("no_image");
    await db.rpc("finish_render", { p_user: user.id, p_request: rid });
    return reply({ ok: true, image: data, mime: part.inlineData?.mimeType ?? "image/png", credits_left: left });
  } catch (_e) {
    const { data: back } = await db.rpc("refund_credit", { p_user: user.id, p_request: rid });
    return reply({
      ok: false,
      code: "render_failed",
      credits_left: back,
      message: "The image model could not finish that render. Your credit was refunded. Try again."
    });
  }
});
