# DecoNova
## Build Specification v2.0 — AI Interior Makeover

> **How to use this document.** This is the complete brief for an autonomous coding agent. Sections 1–4 are intent and must not be deviated from. Sections 5–12 are the product surface. Sections 13–18 are implementation. Section 19 is build order; follow it, because this ships in a hackathon window. Section 20 is how we know it is done.
>
> **A working prototype exists** (`deconova.html`, single file, vanilla JS). Where this document and the prototype disagree, this document wins — but read the prototype first, because the Reveal slider, the wall-mask compositing, the contrast maths and the lighting filters are already solved there and should be ported rather than reinvented. See §21.

---

## 1. The product

A mobile-first web app. A user photographs a room, picks a design style and who lives in that room, and gets a photorealistic makeover of their actual space — with the design reasoning, a colour palette, a what-changed list and a rough cost. They can then repaint the walls and change the light interactively, compare any version against the original with a drag slider, and keep finished rooms in a private gallery where they can be re-examined but not re-edited.

**Name:** DecoNova
**Caption, used verbatim on the sign-in screen:** *Luxury Living, Intelligently Designed*
**Positioning line, internal:** Your room, redesigned for the people who live in it.

---

## 2. The differentiator — do not dilute this

Photo-to-restyle is crowded. What makes DecoNova distinct is the **Who Lives Here** layer: a constraint pack applied on top of the style that changes the actual design output and is then surfaced back to the user as named reasons.

| Pack id | Label | What the AI must do differently | Min wall-to-floor contrast |
|---|---|---|---|
| `none` | No one in particular | A straight makeover, no extra constraints | — |
| `elderly` | An elderly parent | Seat heights 45 cm+, no low glass, no loose rugs, non-slip flooring, strong floor-to-wall contrast, layered warm task lighting, 90 cm clear circulation | **3.0 : 1** |
| `child` | A young child | Rounded corners, no glass, storage at 60–90 cm reach, no exposed cords, washable fabrics, anchored tall furniture, no small loose decor | — |
| `wheelchair` | A wheelchair user | 90 cm clear paths, 76 cm clearance under tables and desks, no thick-pile rugs, shelving under 120 cm, turning circle preserved | **3.0 : 1** |
| `pets` | Pets | Tight-weave durable fabrics, nothing trailing or fringed, raised planters only, washable floor covering | — |
| `rental` | A small rental | Nothing structural, one feature wall at most, freestanding and multi-use furniture only, vertical storage | — |
| `wfh` | Someone working from home | A defined desk zone, glare-free window relationship, task lighting, acoustic softening, cable discipline | — |

The contrast figure is not decoration. It is enforced in the wall-colour picker (§9.4). A makeover app that stops you choosing a wall colour your mother would trip against is the thing no competitor has.

**Four further non-negotiables:**

1. **Structure lock.** The AI must never move walls, windows, doors, the ceiling line or the camera position. This is the single biggest cause of AI makeovers looking fake.
2. **Privacy by default.** Every photo is private to its owner, enforced at the database and storage layer, not in application code.
3. **The Reveal.** The drag-to-compare slider is the signature moment and gets more polish than anything else in the app.
4. **Saved rooms are read-only.** Editing happens before saving. A saved room can be viewed, compared, downloaded and deleted — never altered. See §11.

---

## 3. Stack

- **Frontend:** React + Vite + TypeScript. Built in Bolt. No UI component kit — components are hand-built to §6.
- **Backend:** Supabase — Auth, Postgres, Storage, Edge Functions.
- **Image model:** Google Gemini image models via the Gemini API, or via fal.ai / Replicate for one SDK and easier fallback.
  - Draft path: a Flash image model (cheap, fast).
  - Commit path: a Pro-tier image model (higher fidelity).
  - **Verify current model IDs and per-image prices at build time — they change every few months.** The model ID lives in an environment variable. Never hardcode a model name in a component, and never trust a model name recalled from training data.
- **Secrets:** the image API key lives only in Supabase Edge Function environment variables. It must never appear in the client bundle. All generation goes through an Edge Function proxy.
- **Target device:** a phone held in portrait, used one-handed. Desktop is a scaled-up courtesy, not the design target.

---

## 4. Visual direction and why

The content is photographs of real rooms, and the user's core task on the Adjust screen is **judging colour**. A tinted interface ground biases colour perception — the same reason painters judge chips against neutral card. So the app sits on a near-black, barely-warm ground with cream text and exactly one accent.

**Do not** build the cream-background / high-contrast-serif / terracotta-accent combination. That palette has become the house style of AI-generated design and reads as a tell rather than a choice.

The one accent is **brass**, `#C8A96A` — and on any screen showing a specific room, the accent is **replaced at runtime by the most saturated colour in that room's palette**, so the chrome wears the room. Brass is the fallback only.

Spend the boldness in two places: the typography on the sign-in screen, and the Reveal. Everything else stays quiet.

### 4.1 Tokens

```css
:root{
  --ground:#121110;      /* app background */
  --ground-deep:#0B0A09; /* full-bleed photo backing, loader */
  --panel:#1C1B19;       /* cards, sheets, raised surfaces */
  --panel-sunk:#161513;  /* tab tracks, wells */

  --ink:#F2EEE7;
  --ink-soft:#9A9389;
  --line:rgba(242,238,231,.14);

  --brass:#C8A96A;
  --signal:#C8A96A;      /* overwritten at runtime from the room's palette */
  --signal-ink:#121110;  /* recomputed: #121110 if accent is light, #FFFFFF if dark */

  --warn:#D9A441;
  --danger:#D1705C;

  --r-chip:2px;          /* paint chips are rectangles, like a real deck */
  --r-control:10px;
  --ease:cubic-bezier(.22,.61,.36,1);

  --display:'Bodoni Moda',Georgia,'Times New Roman',serif;
  --ui:'Hanken Grotesk','Helvetica Neue',Arial,sans-serif;
}
```

There is **no light mode**. The dark theme is the brand. Do not add a `prefers-color-scheme` branch.

### 4.2 Typography

- **Display — Bodoni Moda, weight 400.** A high-contrast didone, the face fashion houses use for mastheads. Every heading, the wordmark, the sign-in caption, section titles and the cost total. Letter-spacing `-0.012em`, line-height `1.06`. Never set it bold; the contrast carries it.
- **UI and body — Hanken Grotesk, 400 / 500 / 600.** Everything else. Tabular figures on all measurements (kelvin, contrast ratios, prices, dimensions).

Type scale: 13 / 15 / 17 / 21 / 28 / 40 / 56. Body line length under 70 characters. Sentence case everywhere except the wordmark. No all-caps labels, no eyebrow labels above headings, no middle-dot meta strings, no arrows appended to button text.

Section titles get a **34 px brass hairline** underneath, as the structural device.

### 4.3 Motion
Motion answers a touch. The only non-user-triggered motion in the whole app is: the ambient drift on the sign-in screen, the light sweep and auto-wipe when a render first lands, the loader hairline, the cost count-up, and the gallery stagger. Everything on that list respects `prefers-reduced-motion`, which disables all of them.

---

## 5. Information architecture

```
/                  Sign in (unauthenticated)
/new               Capture or upload
/new/style         Taste Test → Who Lives Here → Style → Decor chips
/render/:id        Result — Reveal, Adjust, Story. Editable.
/gallery           Private gallery, masonry
/room/:id          Saved room. Read-only. Reveal + Story + download + delete.
/settings          Account, credits, delete all data
```

Bottom navigation, three items, thumb-zone: **Capture · Gallery · You**. The capture control is a brass ring, centre, raised above the bar. Navigation is hidden on sign-in and during capture.

---

## 6. Screen: sign in

Full-viewport, `position: fixed`, its own dark world. No navigation.

**Composition, top to bottom, with `space-between`:**

1. **Wordmark** — `DECONOVA`, Bodoni Moda 13 px, letter-spacing `0.42em`, opacity `0.72`.
2. **Caption** — `Luxury Living, / Intelligently / Designed` on three lines, Bodoni Moda 400, `clamp(33px, 10.4vw, 50px)`, line-height `1.04`. The word *Intelligently* is set in italic — this is the one permitted single-word accent in the app, because it is the brand's claim.
3. **Brass hairline** — 54 × 1 px, `#C8A96A`, 26 px below the caption.
4. **One line of copy** — *Photograph a room. Watch it become the one you meant to have.* 15.5 px, `rgba(242,238,231,.68)`, max 27ch.
5. **Email field** — a hairline underline, not a box. No label. Placeholder *Your email*. The underline turns brass on focus-within.
6. **Button** — full width, 17 px padding, 2 px radius, `1px` cream outline, transparent fill, 14 px text at `0.14em` tracking, label **Enter**. On hover and press it fills brass with dark text.
7. **One quiet line** — *Your rooms stay yours.* 12.5 px, centred, `rgba(242,238,231,.42)`.

**No technical copy anywhere on this screen.** No mention of storage, buckets, prototypes, credits or how sign-in works.

**Background, three stacked layers, all `pointer-events: none`:**
- `glow1` — a warm radial `rgba(232,201,160,.46)` at 72% / 18%, drifting over 22 s, alternating.
- `glow2` — a cool radial `rgba(96,132,142,.34)` at 18% / 86%, drifting over 28 s, alternating.
- `rake` — a 104° linear gradient with a soft `rgba(255,236,208,.17)` band, `mix-blend-mode: screen`, translating from −62% to +62% over 16 s on a loop. This is late light raking across a plaster wall, and it is the reason the screen reads as expensive.

Auth itself: Supabase magic link plus Google. **Do not build a password reset flow** — it eats an hour and no judge will see it.

---

## 7. Screen: capture

1. `getUserMedia({ facingMode: { ideal: 'environment' } })`. If the camera is blocked or absent, hide the viewfinder and fall back to a file input with `capture="environment"`, with one line of explanation.
2. Overlay guidance, exactly three lines: *Stand in the doorway · Hold the phone level · Fit the whole wall in frame*, plus an inset hairline framing rectangle.
3. A **live level indicator** driven by `DeviceOrientationEvent`, reading *Level* within 6° and *Tilt up/down N°* otherwise, turning solid when level. On iOS this needs `DeviceOrientationEvent.requestPermission()`, so show a *Tap to check level* affordance rather than failing silently.
4. On capture: downscale client-side to **1280 px on the long edge**, JPEG quality 0.86, strip EXIF. Upload to the `originals` bucket.
5. Fire the Room Read immediately and navigate on, so the wait is hidden behind the transition.

---

## 8. Screen: Room Read and style

### 8.1 Room Read
One vision call on the uploaded photo, returning strict JSON:

```json
{
  "room_type": "living room",
  "detected": ["sofa", "window", "coffee table", "hardwood floor", "ceiling fan"],
  "light": { "sources": 2, "direction": "north", "quality": "soft diffuse" },
  "estimated_ceiling_m": 2.7
}
```

Render `detected` as thin brackets animating onto the photo on a 130 ms stagger, each with a small label. Below the photo, a single line: *living room · 2 light sources, soft diffuse · ceiling about 2.7 m*.

This does more for perceived intelligence than anything else in the app, costs one call, and its output is also prompt input for generation. Cache it on the room row. **Always** ship a hardcoded fallback object so a failed call never blocks the flow.

### 8.2 Taste Test
Six full-bleed interior photos, swipe or tap like/pass. Each image carries 2–3 style tags. Score the tags and pre-select the winner: *You lean Japandi.* Always offer **Browse all styles** as an escape hatch; never force the test. This is P2 — build the grid first.

### 8.3 Order on this screen
Room Read → **Who Lives Here** → **Style** → **Add to the room** → the generate button. Who Lives Here comes before style deliberately: it is the differentiator and should be the first thing a judge sees being set.

Packs render as full-width rows with the label and the plain-language note. Styles render as a two-column grid of tiles, each tile a four-swatch palette strip over the style name — **no stock photography needed**, which keeps the bundle small and avoids licensing questions. A selected tile gets a brass border and a brass tick in the top-right corner.

Decor chips are a horizontally scrolling row, multi-select: Plants · Gallery wall · Floor lamp · Bookshelf · Rug · Sheer curtains · Pooja corner · Reading chair · Mirror · Storage bench. Each appends a clause to the prompt.

The generate button is disabled until a style is chosen. Credit count sits beneath it.

### 8.4 Region sampling
On photo accept, downscale to 80 × 60 off-screen and average two bands:
- rows 6–22 → `wallBaseHex`, used as the lightness reference when repainting.
- rows 50–60 → `floorHex`, used for every contrast calculation in §9.4.

Both are cheap, both are real, and the floor sample is what makes the accessibility gate honest.

---

## 9. Screen: result

### 9.1 Layout
Title (style name) and subtitle (pack · room type) → the Reveal → a one-line honesty note if the render is simulated → the version strip → three tabs (**Walls · Light · Story**) → **Save to gallery**.

### 9.2 The Reveal
Build this first and make it exact.

- Two stacked images; the top layer clipped by `clip-path: inset(0 {100-pos}% 0 0)` driven by pointer X.
- A **1 px brass seam** with a `0 0 10px rgba(200,169,106,.55)` glow, and a 38 px circular cream handle centred on it.
- `BEFORE` / `AFTER` tags in opposite bottom corners, dropping to `opacity: .15` as the handle passes 18% / 82%. The tags show the actual frame labels, so after a repaint the right-hand tag reads e.g. `CLAY WALLS`.
- Haptic tick every 10% of travel: `navigator.vibrate?.(4)`.
- **Double-tap auto-wipes** the full width over 1100 ms with a cubic ease-out, pauses 420 ms, then settles back to 50% over 600 ms.
- Pinch-to-zoom zooms both layers in lockstep.
- Keyboard: arrow keys move the handle 5% per press; the handle is focusable with a visible focus ring.
- `prefers-reduced-motion` replaces the animated wipe with an instant jump.

**The orchestrated moment.** When a render first lands: fire a haptic of 18 ms, run a **light sweep** across the frame (a 104° cream gradient band, `mix-blend-mode: screen`, translating −70% → +70% over 1.25 s while fading out), then at +560 ms trigger the auto-wipe. This happens once per render, never on navigation.

### 9.3 Versions
Every commit creates a new version with a parent pointer, forming a chain. The strip under the image shows the original plus every version as 54 px thumbnails. Tapping one sets it as the second half of the comparison pair, so a user can wipe between *sage walls* and *clay walls* in the same room. Selected thumbnails get a brass border.

Also build **Style duel**: generate two styles from the same original and put them in the Reveal against each other. Two renders, two credits, stated upfront. This is the strongest thing to show on a projector after the basic reveal.

### 9.4 Walls tab

Governed by one rule: **preview is instant and free; commit is a render.**

**The deck.** 12–14 **rectangular** chips (2 px radius, not pills), each 62 px wide with the colour name beneath. Chips are curated per active style, so the user physically cannot pick something that fights the design. Full seed data in §14.

**Three ways in:**
1. The deck — curated, harmonised, the default.
2. **Pull from the room** — an eyedropper; tap anywhere in the photo to sample, and return a wall-appropriate derivative (lightened, desaturated toward a paintable value). Good for matching an existing sofa or floor. P2.
3. **Custom** — an HSL wheel behind a `+` chip. P2.

**Two readouts, always visible under the deck:**

- **Harmony.** Minimum hue distance between the chosen colour and the style palette. Under 32° → *Works with your palette* (green badge). Under 75° → *Bold contrast*. Above → *Fights the palette*. Never blocks; informs.
- **Contrast.** WCAG luminance ratio between the chosen wall colour and `floorHex`, shown as a number: `Wall to floor 2.1:1`. When the active pack has a `min_wall_floor_contrast`, the badge also shows `· needs 3:1`, and a third badge displays the sampled floor swatch so the user can see what it was measured against.

**The accessibility gate.** When a pack sets a minimum, any chip below it renders with a red `!` marker. First tap does not select it — it raises a toast: *Only 2.1:1 against the floor. Low contrast at the floor edge makes depth hard to judge. Tap again to use it anyway.* Second tap selects. **Inform and require confirmation; never hard-block.** The badge carries an icon and text, not colour alone.

**Target toggle:** `All walls` / `Feature wall`. Feature wall asks the model to paint only the largest uninterrupted wall plane.

**Mask debug:** a `Show the mask` chip that swaps the after-image for the mask itself. This is a development affordance and it is also a surprisingly good demo beat — it proves the app understands the geometry. Keep it.

**Apply** is the only control that spends a credit. It states the cost on the button, is disabled while a render is in flight, and the pane carries the line *Dragging and tapping is free. Only Apply spends a credit.*

### 9.5 Light tab

**Instant tier, free, client-side:**
- **Warmth** — a range from 2000 K to 6500 K, step 50, default 3200, labelled at the stops *Candle · Lamp · Neutral · Daylight* and read out as `3200 K · Lamp`. Implemented as a temperature veil over the image: below 4000 K a warm `#FFB46B` at up to `.55` alpha, above 4000 K a cool `#9FC6FF` at up to `.42`, in `mix-blend-mode: soft-light`.
- **Brightness** — −2 to +2 stops, read out as `+0.8 stops`, implemented as `filter: brightness(1 + ev*0.16) contrast(1 + |ev|*0.03)`.

**Both apply to the after frame only.** The temperature veil is clipped with `inset(0 0 0 {pos}%)` so it tracks the slider and never touches the original. This matters: a comparison where both sides have been relit is a lie.

A **Reset the light** button returns 3200 K / 0 stops.

**Commit tier, one render each, visibly priced:**
`Morning · Midday · Golden hour · Dusk, lamps on · Night, lamps on`, plus a **Lamps on/off** toggle. These move shadows, change window light and add visible lamp glow, which a filter cannot fake. Each chip reads `Golden hour · 1 credit`. A commit here applies to the **current** version, so a repaint followed by a relight composes rather than reverting.

Never fire a render from a slider drag.

### 9.6 Story tab
A text call on the generated image returning strict JSON (§16.4), rendered as:

- **The palette** — 4 chips as physical paint-deck rectangles with evocative names and hex beneath. Tap copies the hex with a toast.
- **What changed** — verb-first lines, one per row with a hairline between.
- **Why** — two sentences in a designer's voice.
- **For the people here** — present only when a pack is active. The safety and accessibility decisions, named.
- **To recreate this** — item rows with costs, then the total in Bodoni, in brass, **counting up** from zero over 900 ms with a cubic ease-out.

A story failure must never block the image. Catch, fall back to the style's own palette plus generic change lines, and render anyway.

---

## 10. Screen: gallery

Masonry, two columns, each tile the room's latest version. Tiles **rise in on a 55 ms stagger** (`translateY(10px)` → none, 0.5 s).

Each tile carries:
- a brass `COMPARE` pill, top-left, which signals that the tile opens into something rather than just enlarging;
- a `×` delete button, top-right, which stops propagation and removes the room and its storage objects;
- a bottom gradient caption: style name · pack (suppressed when the pack is "No one in particular"), then room type · wall colour name on a second line.

Footer line: `4 rooms · only visible to you@example.com`.

Empty state is an invitation, not a mood: a heading, one line, and a capture button. Nothing else.

Tapping a tile opens the saved room.

---

## 11. Screen: saved room — read-only

**Users do not edit saved rooms.** They see exactly what the product did to their photo, including the slider.

Contents, in order:
1. Title (style) and subtitle: `living room · An elderly parent · Clay walls · 14 Oct 2026`.
2. **The Reveal**, with the same seam, handle, haptics, tags, keyboard support and double-tap wipe as the result screen. On open it runs the light sweep and auto-wipes once, at +520 ms.
3. One line: *Drag to compare. Saved rooms are kept exactly as they were made.*
4. The full Story block, rendered from the stored JSON — palette, changes, why, accessibility notes, items, counting total.
5. **Download the makeover** — a direct download of the after frame, filename derived from the style (`japandi.jpg`).
6. **Delete this room** — a two-tap confirm. First tap changes the label to *Tap again to delete this room* and arms for 4 s.

**No tabs. No sliders. No Apply. No credit spend.** The lighting the user had set at save time is stored and re-applied as a filter so the room looks as they left it. The interface accent switches to the room's stored accent colour on open.

Do not use `window.confirm()` anywhere — it is blocked in sandboxed frames. Every destructive action is a two-tap arm-and-fire with a 4 s timeout, or a typed confirmation in settings.

---

## 12. Screen: you

Account email, credits remaining, **Delete all photos and designs** (two-tap armed), **Sign out**. One closing line about privacy in plain language. No bucket names, no SQL, no architecture.

---

## 13. Credits
Free tier: 10. Generation, repaint commit and relight commit each cost 1. Instant previews cost nothing and the UI says so. Balance lives on `profiles.credits` and is decremented **inside the Edge Function**, never in the client. A failed render refunds automatically and says so in the error copy.

---

## 14. Style catalogue — seed data

Grouped in the UI. `palette` drives the tile swatches, the 60/30/10 prompt block and the runtime accent (most saturated member wins). `chips` drives the wall deck. `fx` is prototype-only (§21) and can be dropped once a real image model is wired.

```json
[
{"id":"scandinavian","label":"Scandinavian","group":"Global modern",
 "palette":[["Chalk","#F2EFE9"],["Pale oak","#D8C3A2"],["Soft sage","#A9B5A0"],["Ink","#2E2E2B"]],
 "materials":"light oak, wool, linen, matte black metal, ceramic",
 "lighting":"2700K, soft, many small sources",
 "prompt_dna":"uncluttered, low-slung light-wood furniture, one woven rug, bare or sheer windows, a few plants, nothing ornate",
 "chips":[["Chalk","#F2EFE9"],["Oat","#E6DFD2"],["Mist","#D7DCD8"],["Soft sage","#A9B5A0"],["Dove","#BFC2BE"],["Clay ash","#C5B4A5"],["Linen","#EDE7DB"],["Pale slate","#9FA8AE"],["Birch","#E3D7C3"],["Fog","#CFD2CE"],["Stone","#B3B0A8"],["Ink","#2E2E2B"]]},

{"id":"japandi","label":"Japandi","group":"Global modern",
 "palette":[["Warm greige","#CFC7BB"],["Charcoal","#3A3A38"],["Muted clay","#A9705B"],["Paper","#EDE8DF"]],
 "materials":"two woods only, paper, stone, raw cotton",
 "lighting":"low warm pools, paper diffusers",
 "prompt_dna":"low furniture, floor-level sightlines, hidden storage, negative space treated as a material, no visual noise",
 "chips":[["Paper","#EDE8DF"],["Warm greige","#CFC7BB"],["Rice","#E2DACC"],["Ash wood","#B9AA98"],["Muted clay","#A9705B"],["Moss","#7D8268"],["Smoke","#9C9A94"],["Charcoal","#3A3A38"],["Sand","#D6C8B0"],["Bark","#6B5A4A"],["Shoji","#F1EEE7"],["Slate ink","#4A4F52"]]},

{"id":"modern","label":"Modern","group":"Global modern",
 "palette":[["Snow","#F7F7F6"],["Graphite","#39393B"],["Steel","#8E9499"],["Bronze","#8A6A3F"]],
 "materials":"lacquer, glass, brushed steel, engineered stone",
 "lighting":"even, cool-neutral, recessed",
 "prompt_dna":"clean lines, minimal ornament, one sculptural object, flush surfaces, restrained colour",
 "chips":[["Snow","#F7F7F6"],["Pearl","#E4E5E6"],["Steel","#8E9499"],["Graphite","#39393B"],["Pewter","#6E7276"],["Cool white","#EFF2F3"],["Putty","#C6C1B8"],["Ash","#A6A8A6"],["Deep navy","#2B3440"],["Bronze","#8A6A3F"],["Chalk grey","#D3D5D4"],["Onyx","#242527"]]},

{"id":"midcentury","label":"Mid-century","group":"Global modern",
 "palette":[["Bone","#EDE6D8"],["Teak","#8A5B34"],["Olive","#7A7A42"],["Mustard","#D29B2C"]],
 "materials":"teak, walnut, boucle, tapered legs, smoked glass",
 "lighting":"warm, globe and cone shades",
 "prompt_dna":"tapered-leg furniture, low sideboard, one statement armchair, geometric textile, warm wood everywhere",
 "chips":[["Bone","#EDE6D8"],["Cream","#F0E4CC"],["Mustard","#D29B2C"],["Olive","#7A7A42"],["Teak","#8A5B34"],["Burnt orange","#B4582C"],["Sage grey","#A8AE9C"],["Walnut","#6A4428"],["Duck egg","#9FBDB8"],["Clay","#C07B52"],["Ochre","#C99A41"],["Charcoal","#333331"]]},

{"id":"industrial","label":"Industrial","group":"Global modern",
 "palette":[["Concrete","#B6B4AF"],["Iron","#434548"],["Brick","#9A5C44"],["Oiled oak","#6E5438"]],
 "materials":"raw concrete, blackened steel, reclaimed timber, exposed brick",
 "lighting":"pendant cages, directional, cool",
 "prompt_dna":"exposed structure, metal shelving, leather seating, oversized pendant, nothing precious",
 "chips":[["Concrete","#B6B4AF"],["Cement","#9C9B96"],["Iron","#434548"],["Brick","#9A5C44"],["Gunmetal","#5A5E62"],["Lime wash","#DAD6CC"],["Rust","#8C4F31"],["Slate","#6B6F73"],["Bone white","#E6E2D9"],["Deep olive","#4F5340"],["Soot","#2C2D2E"],["Zinc","#8A8E90"]]},

{"id":"traditional","label":"Traditional","group":"Classic and warm",
 "palette":[["Antique white","#EFE8DA"],["Mahogany","#5B2E22"],["Sage","#8E9A82"],["Gilt","#A98A4F"]],
 "materials":"mahogany, damask, wool rug, brass, moulding",
 "lighting":"table lamps, warm, pooled",
 "prompt_dna":"symmetrical arrangement, rolled-arm seating, framed art in a set, patterned rug, crown moulding respected",
 "chips":[["Antique white","#EFE8DA"],["Parchment","#E4D9C1"],["Sage","#8E9A82"],["Dusty rose","#C49A94"],["Mahogany","#5B2E22"],["Hunter green","#2F4A38"],["Gilt","#A98A4F"],["Oxblood","#6B2B2B"],["Dove grey","#BFBCB4"],["Deep teal","#255158"],["Ivory","#F2EADA"],["Walnut","#5D4330"]]},

{"id":"coastal","label":"Coastal","group":"Classic and warm",
 "palette":[["Shell","#F3F1EA"],["Sea glass","#9DC0BC"],["Driftwood","#B5A48E"],["Navy","#2A4256"]],
 "materials":"whitewashed wood, rattan, linen slipcovers, jute",
 "lighting":"bright, daylight-led, sheer-filtered",
 "prompt_dna":"airy, slipcovered seating, rattan accents, blue and white textiles, windows left bare or sheer",
 "chips":[["Shell","#F3F1EA"],["Salt","#E8EDEC"],["Sea glass","#9DC0BC"],["Sky","#B9CEDB"],["Driftwood","#B5A48E"],["Navy","#2A4256"],["Pebble","#CBC8BF"],["Reef","#4E8A8A"],["Sand","#DFD2BB"],["Deep sea","#1F3B4D"],["Chalk","#F6F5F1"],["Kelp","#4A5F4A"]]},

{"id":"bohemian","label":"Bohemian","group":"Expressive",
 "palette":[["Cream","#F0E7D8"],["Terracotta","#B2603F"],["Jade","#4F7A63"],["Plum","#6A3A52"]],
 "materials":"rattan, kilim, macrame, brass, plenty of plants",
 "lighting":"warm, layered, string and lantern",
 "prompt_dna":"layered rugs, low seating, many plants, mixed patterns that share a warm base, collected not bought",
 "chips":[["Cream","#F0E7D8"],["Apricot","#E0A878"],["Terracotta","#B2603F"],["Jade","#4F7A63"],["Plum","#6A3A52"],["Saffron","#D29B37"],["Clay pink","#C98B7E"],["Teal","#2F6B6B"],["Warm sand","#DCC7A8"],["Indigo","#38456B"],["Rust","#9E4A2E"],["Char","#2F2B29"]]},

{"id":"wabisabi","label":"Wabi-sabi","group":"Expressive",
 "palette":[["Lime plaster","#DED6C8"],["Earth","#8B7B68"],["Charcoal","#3C3A36"],["Moss","#767A5F"]],
 "materials":"lime plaster, unglazed ceramic, raw linen, weathered wood",
 "lighting":"single soft source, long shadows welcomed",
 "prompt_dna":"imperfect handmade surfaces, almost empty, one branch or vessel as the focal point, texture over colour",
 "chips":[["Lime plaster","#DED6C8"],["Raw clay","#C7B7A3"],["Earth","#8B7B68"],["Moss","#767A5F"],["Ash","#A39C92"],["Charcoal","#3C3A36"],["Oyster","#E6E0D5"],["Umber","#6E5B48"],["Stone grey","#B0ABA2"],["Olive dust","#8C8B6E"],["Chalk","#EDE8DF"],["Soot","#33312E"]]},

{"id":"indo_contemporary","label":"Indo-contemporary","group":"Indian",
 "palette":[["Bone","#EDE9E2"],["Walnut","#5C4432"],["Brass","#B08D57"],["Deep teal","#1F4F53"]],
 "materials":"teak veneer, brass inlay, cane, terrazzo",
 "lighting":"neutral ambient with warm accents",
 "prompt_dna":"clean modern envelope warmed with Indian materials, cane cabinet fronts, brass detailing, one heritage object as a focal point",
 "chips":[["Bone","#EDE9E2"],["Chikoo","#C9A882"],["Brass","#B08D57"],["Deep teal","#1F4F53"],["Walnut","#5C4432"],["Cane","#D6BC90"],["Indigo","#2E3C63"],["Khadi","#E8E1D2"],["Terracotta","#A8603C"],["Jade","#44705C"],["Stone grey","#B4AFA5"],["Kohl","#2A2724"]]},

{"id":"traditional_indian","label":"Traditional Indian","group":"Indian",
 "palette":[["Ivory","#EFE6D4"],["Deep teak","#4A2F1E"],["Marigold","#E2A33B"],["Peacock","#1C5660"]],
 "materials":"carved teak, brass, block-print cotton, terracotta, jaali screens",
 "lighting":"warm, layered, lamp-led",
 "prompt_dna":"carved wood seating, brass accents, patterned textiles, a jaali or screen element, floor seating option, rich saturated accents",
 "chips":[["Ivory","#EFE6D4"],["Haldi","#E2A33B"],["Sindoor","#A8342B"],["Peacock","#1C5660"],["Deep teak","#4A2F1E"],["Mehendi","#5C6B37"],["Rose","#C07A77"],["Brass","#B08D57"],["Chandan","#E3D2AE"],["Indigo","#2B3666"],["Terracotta","#A75A38"],["Kajal","#231F1C"]]},

{"id":"south_indian","label":"South Indian heritage","group":"Indian",
 "palette":[["Lime white","#F1EADA"],["Rosewood","#4A2B26"],["Athangudi red","#9C4030"],["Palm","#4E6B46"]],
 "materials":"rosewood, Athangudi tile, oxide flooring, brass, terracotta",
 "lighting":"warm, courtyard daylight plus oil-lamp accents",
 "prompt_dna":"patterned Athangudi or oxide floor, rosewood swing or low seating, pillared sightline, brass vessels, deep shade",
 "chips":[["Lime white","#F1EADA"],["Athangudi red","#9C4030"],["Rosewood","#4A2B26"],["Palm","#4E6B46"],["Turmeric","#D59A32"],["Oxide green","#3C5B4C"],["Kumkum","#8E2E2A"],["Sandal","#DCC9A4"],["Granite","#6E6A63"],["Brass","#AE8A4E"],["Ivory","#EDE4D2"],["Teak","#5B3A24"]]}
]
```

Room for growth, same shape, if time allows: Contemporary, Minimalist, Transitional, Farmhouse, Rustic, French country, Art deco, Mediterranean, Maximalist, Eclectic, Biophilic, Luxury modern-classic, Rajasthani haveli, Contemporary minimal Indian.

**Colour discipline is the main quality lever.** Inject the palette as an explicit 60/30/10 split with named materials. Do not let the model free-associate colour. This is the difference between a designed room and AI slop.

---

## 15. The non-destructive edit model

Edits are data until committed.

```ts
type Edit =
  | { kind: 'repaint'; target: 'all_walls' | 'feature_wall'; hex: string; name: string }
  | { kind: 'relight'; preset?: TimePreset; kelvin?: number; ev?: number; lampsOn?: boolean };

type PendingState = {
  previewEdits: Edit[];   // client-side, instant, reversible, free
  baseVersionId: string;  // what the preview composites on top of
};
```

`previewEdits` render as canvas or CSS composites at display time. **Apply** posts them to the Edge Function, which returns a new image; that image becomes a new `versions` row with `parent_version_id = baseVersionId`, and the preview state clears. This gives version history, undo and arbitrary pairwise comparison for free.

### 15.1 Wall mask
Fetched once per base version and cached as a 1-bit PNG at `masks/{user_id}/{room_id}/{version_id}_wall.png`.

**Production:** one segmentation call at first render — either a prompted mask from the image model (*return a black and white mask, walls white, everything else black*) or a hosted segmentation model with the prompt `wall`.

**Prototype heuristic, already working and worth keeping as a fallback:** downscale to 160 px wide, average rows 4–22% as a reference colour, then for every pixel above 80% height mark it as wall when its Euclidean colour distance from the reference is under 74 **and** the local luminance gradient is under 16 (walls are flat), or when the distance alone is under 48. Blur the resulting alpha by 1.6 px to soften edges. This does well on flat painted walls in even light and badly on heavy texture or strong shadow gradients — which is exactly why the AI repaint is the reliable path and the mask preview is P2.

If no mask is available, hide the instant preview, keep the deck, and send straight to the commit tier. Degrade quietly; never show a broken preview.

### 15.2 Compositing a wall colour
1. Draw the base image.
2. Build a tint layer: fill with the target colour (for `feature_wall`, only the left 52% of the frame as an approximation), then `globalCompositeOperation = 'destination-in'` and draw the mask to clip it.
3. **Pass one:** `globalCompositeOperation = 'color'`, alpha `0.95`, draw the tint. This transfers hue and saturation while keeping the photograph's luminance, so existing shadows and texture survive. This is what sells the effect.
4. **Pass two:** compare the target's relative luminance to `wallBaseHex`. If darker, `multiply`; if lighter, `screen`; alpha `clamp(|Δ| * 0.95, 0.06, 0.5)`. This nudges lightness toward the target without flattening the surface.
5. Reset to `source-over` and export at JPEG 0.9.

After a repaint commits, set `wallBaseHex` to the new colour and rebuild the mask from the new image.

---

## 16. Prompts

Composed server-side from blocks. Never build a prompt in the browser.

### 16.1 Generation
```
Restyle this interior photograph.

ABSOLUTE CONSTRAINTS
- Keep the camera position, focal length and perspective identical.
- Do not move, add or remove walls, windows, doors, or the ceiling line.
- Keep the room's real dimensions and proportions.
- Photorealistic interior photograph. No text, no labels, no watermarks.

ROOM
Type: {room_type}. Existing light: {light.sources} sources, {light.direction}-facing, {light.quality}.

STYLE: {style.label}
{style.prompt_dna}
Palette, 60/30/10: {palette[0]} dominant, {palette[1]} secondary, {palette[2]} accent.
Materials: {style.materials}
Lighting character: {style.lighting}

WHO LIVES HERE: {pack.label}
{pack.constraints}

ALSO INCLUDE: {decor_chips}

AVOID
New walls or windows, changed camera angle, warped or melted furniture,
impossible geometry, visible text, oversaturation, more than three accent colours.
```

### 16.2 Repaint commit
```
Repaint only the walls of this interior photograph to {color_name} ({hex}).
{target_clause}
Keep every other element identical — furniture, decor, flooring, ceiling,
window frames, camera angle and composition must not change.
Preserve the existing shadows and the direction of light on the walls.
Photorealistic. No text.
```
`target_clause` is either *Paint all wall surfaces.* or *Paint only the largest uninterrupted wall plane; leave the other walls as they are.*

### 16.3 Relight commit
```
Relight this interior photograph to: {preset_description}.
Keep every object, material, colour and the camera angle identical.
Change only the light: its direction, colour temperature, intensity,
the resulting shadows, and whether lamps are lit.
{lamps_clause}
Photorealistic. No text.
```
Preset descriptions, e.g. *Dusk, lamps on* → `low blue ambient light through the windows, interior lamps switched on casting warm pools, visible warm glow around each lamp, long soft shadows`.

### 16.4 Design story
A text call on the generated image. Strict JSON, no prose, no fences:
```json
{
  "palette": [{ "name": "Raw Linen", "hex": "#E8E2D6" }],
  "changes": ["Replaced the glass table with rounded oak"],
  "why": "Two sentences in a designer's voice.",
  "accessibility_notes": ["Raised the seating to 46 cm for easier standing"],
  "items": [{ "name": "Jute rug 6x4", "approx_cost": 4500 }],
  "total_cost": 42000,
  "currency": "INR"
}
```
Four palette entries, five changes, five items. `accessibility_notes` is an empty array when no pack is active. Parse defensively: strip fences, `try/catch`, fall back to the style palette and generic lines.

### 16.5 Room read
See §8.1. Same defensive parsing, same hardcoded fallback.

---

## 17. Data model

```sql
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  currency text default 'INR',
  credits int default 10,
  created_at timestamptz default now()
);

create table rooms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  original_path text not null,
  room_type text,
  room_read jsonb,
  floor_hex text,            -- sampled, drives contrast checks
  wall_base_hex text,        -- sampled, drives repaint lightness
  title text,
  created_at timestamptz default now()
);

create table versions (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  parent_version_id uuid references versions on delete cascade,
  kind text not null check (kind in ('generate','repaint','relight')),
  image_path text not null,
  wall_mask_path text,
  style_id text,
  pack_id text,
  decor_chips text[],
  edits jsonb default '[]'::jsonb,
  kelvin int default 3200,
  ev int default 0,
  wall_name text,
  accent_hex text,           -- drives the runtime interface accent
  story jsonb,
  palette jsonb,
  status text default 'pending' check (status in ('pending','ready','failed')),
  error text,
  created_at timestamptz default now()
);

create index on rooms (user_id, created_at desc);
create index on versions (room_id, created_at desc);
create index on versions (parent_version_id);

create table styles (
  id text primary key, label text, "group" text,
  palette jsonb, materials text, lighting text, prompt_dna text,
  chips jsonb, sort int default 0
);

create table packs (
  id text primary key, label text, note text, constraints text,
  min_wall_floor_contrast numeric, sort int default 0
);
```

### 17.1 Row level security — mandatory
```sql
alter table profiles enable row level security;
alter table rooms    enable row level security;
alter table versions enable row level security;

create policy "own profile" on profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "own rooms" on rooms
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own versions" on versions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table styles enable row level security;
create policy "styles readable" on styles for select using (true);
alter table packs enable row level security;
create policy "packs readable" on packs for select using (true);
```

### 17.2 Storage
Buckets `originals`, `renders`, `masks` — **all private**. Keys are `{user_id}/{room_id}/{filename}`. Access only via signed URLs with a 600 s expiry.

```sql
create policy "own objects" on storage.objects
  for all to authenticated
  using (bucket_id in ('originals','renders','masks')
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id in ('originals','renders','masks')
         and (storage.foldername(name))[1] = auth.uid()::text);
```

### 17.3 Deletion
Hard delete, not a soft flag. Deleting a room lists every storage object under `{user_id}/{room_id}/`, removes them, then deletes the row and lets the cascade clear versions. Settings-level deletion does the same for `{user_id}/`. If a user asks for erasure, erase.

---

## 18. Edge Functions

Each takes the Supabase JWT, resolves `user_id` server-side, verifies ownership of the referenced row, and checks credits before calling any paid API.

| Function | Input | Behaviour |
|---|---|---|
| `room-read` | `{ room_id }` | Vision call → JSON → writes `rooms.room_read`. Free. |
| `generate` | `{ room_id, style_id, pack_id, decor_chips, request_id }` | Inserts a `pending` version, decrements a credit, calls §16.1, uploads to `renders`, requests the wall mask, sets `ready`. On failure sets `failed`, writes `error`, refunds. |
| `repaint` | `{ version_id, hex, name, target }` | Validates against the pack's `min_wall_floor_contrast`. Calls §16.2 on the parent image. Inserts a child version. |
| `relight` | `{ version_id, preset, lamps_on }` | Calls §16.3 on the parent image. Inserts a child version. |
| `story` | `{ version_id }` | §16.4. Free, non-blocking, called after the image is already on screen. |
| `purge` | `{ room_id? }` | §17.3. |

Uniform return shape: `{ ok: true, version: {...} }` or `{ ok: false, code, message }`. The client renders `message` verbatim, so write those as user-facing copy — errors explain what happened and what to do, never apologise, never go vague.

**Idempotency:** `request_id` is client-generated; reject a duplicate within 60 s so a double-tap cannot burn two credits.

---

## 19. Build order

**P0 — no demo without these**
1. Supabase project, schema, RLS, private buckets, signed-URL helper.
2. Auth: magic link + Google. No password reset.
3. Sign-in screen to §6, exactly.
4. Capture → downscale → upload → `rooms` row.
5. Who Lives Here + style grid (seed 8 styles) + decor chips.
6. `generate` end to end with the Designer-at-Work loader.
7. **The Reveal**, polished — seam, handle, haptics, tags, double-tap wipe.
8. Gallery with signed URLs, delete room, delete all.
9. **Saved room, read-only, with the Reveal** (§11).

**P1 — this is what wins**
10. Design Story with palette chips, accessibility notes, counting total.
11. Walls: chip deck, commit tier, harmony and contrast readouts, the accessibility gate.
12. Light: warmth and brightness instant sliders, clipped to the after side.
13. Room Read brackets.
14. Version chain and arbitrary pairwise compare.
15. The orchestrated moment: light sweep, haptic, auto-wipe.

**P2 — if time remains**
16. Lighting commit presets.
17. Wall mask and the instant blend preview, plus the mask-debug chip.
18. Taste Test onboarding.
19. Style duel.
20. Eyedropper, pull-from-the-room.
21. Shareable before/after card export.

**Cut in this order if behind:** 21 → 20 → 19 → 18 → 17 → 16.
**Never cut:** 7, 8, 9, the contrast gate in 11, or RLS.

---

## 20. Acceptance criteria

- [ ] A second account cannot read, list or guess a URL for the first account's photos. Verified by a direct storage fetch with a different JWT.
- [ ] Generated rooms keep the original walls, windows, doors and camera angle in 9 of 10 test photos.
- [ ] The Reveal handle tracks a finger with no perceptible lag on a mid-range phone.
- [ ] Moving the warmth slider updates the image within one frame, with no network call.
- [ ] The warmth veil and brightness filter affect only the after side of the comparison.
- [ ] Applying a wall colour creates a new version and leaves the previous one intact and viewable.
- [ ] With the elderly pack active, a wall colour under 3:1 against the sampled floor shows the marker, raises the explanation and requires a second tap.
- [ ] A saved room opens read-only: slider works, story renders, download works, and there is no control anywhere on the screen that alters the image.
- [ ] A saved room re-displays with the lighting that was set when it was saved.
- [ ] A failed render shows a plain-language reason and refunds the credit.
- [ ] Deleting a room removes its storage objects, confirmed by a direct storage list.
- [ ] No API key appears in the built client bundle. Verified by searching the build output.
- [ ] `window.confirm` appears nowhere; every destructive action is two-tap or typed.
- [ ] `prefers-reduced-motion` disables the ambient drift, the sweep, the auto-wipe, the loader hairline, the count-up and the gallery stagger.
- [ ] The full flow, capture to compared makeover, completes in under 60 seconds on a phone.

---

## 21. The existing prototype

`deconova.html` is a single-file, dependency-free implementation. **Port from it; do not rebuild these from scratch.**

**Already real and correct:**
- Camera capture, level indicator, iOS orientation permission, downscale to 1280 px, library fallback.
- Room Read vision call with bracket rendering and a hardcoded fallback.
- The Reveal slider in full: pointer tracking, clip-path, brass seam, haptic ticks, tag cross-fade, double-tap wipe with settle, keyboard support.
- The heuristic wall mask (§15.1) and the two-pass compositing (§15.2), plus the mask-debug view.
- WCAG contrast maths, the harmony calculation, and the two-tap accessibility gate.
- Lighting: the kelvin veil, the brightness filter, and the clip that keeps both off the before side.
- The version chain and pairwise compare.
- The Design Story call, defensive JSON parsing, palette chip copy-to-clipboard, counting total.
- Per-user isolated storage, the gallery, the read-only saved room, download, two-tap deletes.
- The full sign-in treatment and the design tokens.

**The one thing that is simulated:** the makeover render. There is no image-generation model available in the prototype's environment, so `simulateRender(src, style)` puts the user's real photo through a style-specific saturation, contrast, brightness, hue and tint transform with a soft vignette. **Replacing that single function with a call to the `generate` Edge Function is the entire swap.** Nothing downstream of it changes. Delete the `fx` block from the style seed data at the same time, and remove the `simnote` line from the result screen.

**Known rough edges to fix while porting:**
- The auto-wipe can fire twice if a saved room is opened while a result is still animating. Gate it on a single in-flight flag.
- The style grid is long before the generate button is reachable. Either collapse groups or float the button.
- The Walls tab opens empty; it should open on the colour the room already has.
- `feature_wall` is approximated as the left 52% of the frame. In production, let the model decide which plane is largest.
