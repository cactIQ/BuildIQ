# MASTER BUILD PROMPT v2 (Phase 4: refined after three independent critiques)

> Draft. Changes from v1 come from three reviews: architectural fidelity (refs A–F, pixel-measured), real-time
> graphics on Iris Xe (r170), and product/method/compliance. All dimensions are **estimates from marketing renders**
> and live in the SPEC with an `inferred` tag. They must be confirmed by a second qualified reviewer and, ideally,
> by client drawings.

## 0. Outcome, rules, branding
- A **premium archviz-grade real-time Three.js (r170) presentation** of a 2-tower residential project, for (a)
  embedding on the builder's website and (b) live pitching on a laptop or projector, offline.
- **Neutral branding.** Everything comes from `SPEC.brand`: name "Project Name", developer "Developer Name", tagline,
  location text, accent colours, CTA links, disclaimer, regulatory slot (RERA no./QR, a placeholder that legal must
  confirm).
  - The real project or developer names, the locality and "housing" must never appear in `src/`, `index.html`, CSS,
    assets or the README. `tests/banned.json` lists them, and a test enforces it.
- **References are measurement-only and internal.** Never load them in `src/`, never sample them into
  textures/decals/backgrounds, and never trace their art.
  - Gym wall art (the "YOGA" graphic, the sketch) is original procedural artwork. Cars are generic, with no badges.
  - `_internal/` and `shots/` are excluded from any deploy.
- **House rules (old skill):**
  - Smoothness first.
  - No CSS `filter`/`blur` on or over the canvas.
  - No GPU canvas rasterisation during load.
  - The loader animates only transform and opacity.
  - Verify in a real browser.
  - No pricing UI.
  - Placeholder data is labelled.
- Every output is a **draft** until the owner and a second qualified reviewer sign off.

## 1. Inputs
- Refs (PNG copies in `_internal/refs/`): **A** front elevation · **B** aerial from SSW · **C** aerial from NNW ·
  **D** pool deck · **E** clubhouse · **F** gym.
- Precedence: client facts (`SPEC.facts[]`) > B/C for massing and layout > A for elevation detail > D–F for local detail.
  - Conflicts are recorded in `_internal/observed.json`.
  - A appears **composited**: Rear tower scale is off by about 30 %. Accept a mismatch there.
- Method: `.claude/skills/threejs-property-showcase/references/worldclaw-findings.md`.

## 2. Method (WorldClaw, adapted)
1. **Two-pass plan.**
   - `observed.json` holds measured facts (pixel measures, counts, colours).
   - The SPEC holds the chosen values; anything inferred is marked `inferred` in a comment.
2. **SPEC is the single source of truth**, split as `src/spec/{brand,global,site,towers,amenities,cameras,quality}.js`.
   - It is pure data: no THREE, no DOM. It runs under node.
3. **Coarse to fine with a massing gate.**
   - Order: site base → massing (flat material) → **massing gate**: tower height:width, Rear:Hero length, and gate
     height vs tower width must be within ±5 % of `observed.json` in matched views → facade kit → roofscape →
     amenities → scatter → light/atmosphere → UI.
4. **Prototype + instance via a registry.**
   - Every placement goes through `util.place(kind, id, matrix, bbox, supportId)`, which writes to `ctx.registry`.
   - Merging and instancing are built from the registry afterwards.
   - IDs look like `Tower_H/F07/B03`. Each InstancedMesh keeps `userData.ids[]`.
   - The scene graph stops at component level.
5. **Seeded randomness only:** `ctx.rng(stream)` (mulberry32, seeded from `SPEC.global.seed`). `Math.random` is
   banned, and a test greps for it.
6. **Validation on the registry:**
   - Grounding: `floating` if more than 2 cm above the support, `buried` if more than 5 cm below. Every placement names
     its support (ground / deck / roof / slab).
   - Scale: asymmetric tolerance, −10 % / +5 %.
   - Overlaps.
   - It runs in node and in the browser (`window.__report`).
7. **Render–inspect–refine loop**, §9.

## 3. What to build (SPEC values; inferred unless noted)
**Frame:**
- Metres, Y-up. +x east, +z south.
- Front road on the **south**. Origin at the plot bbox centre. y=0 is finished ground; the road is at −0.15.
- Building local frame: origin at the base centre, front facade facing +z.

### 3.1 Hero tower (closest to the front road; the A subject)
**Massing**
- Footprint 28 × 23 m, at x[−11.5, 16.5], z[8.5, 31.5].
- Stilt 3.5 m + **14 floors × 3.0 m** + attic band. Height about 50 m.

**Front bays, left to right (m)**

| # | Bay | Width (m) | Content |
|---|---|---|---|
| 1 | Wing | 7.1 | pilaster \| window \| pilaster \| window \| pilaster; projects 0.3 m; windows 1.5×1.7 m |
| 2 | Small-window | 2.7 | window 1.3 m wide |
| 3 | Recessed balcony | 3.1 | |
| 4 | Central stair/lobby glazing strip | 2.0 | taller window 1.5 × 2.1 m on every floor |
| 5 | Recessed balcony | 3.1 | |
| 6 | Small-window | 2.7 | |
| 7 | Wing | 7.1 | mirror of bay 1 |

**Facade detail**
- **Cornices:** heavy projecting cornices at the top of floors **[0 (stilt), 3, 4, 7, 8, 12, 14]**.
  - Floors 4 and 8 are "band floors" sandwiched between cornices.
  - Floors 13–14 form a two-storey order with round engaged columns.
  - There are small scroll capitals on the pilasters under each heavy cornice.
  - Thin slab bands on the other floors.
- **Relief panels** (a C-scroll pair with a medallion, normal-mapped) sit under every window, except where a cornice
  takes the spandrel.
- **Open loggias** with columns on the left inner zone at floors 8, 13 and 14 (`inferred`, medium confidence).
- **Attic:** a frontispiece parapet (0.4 m thick, returns 1.5 m), not a room.
  - A 2.5 m band with 3 round-headed dark windows, then a cornice, then a low (about 15°) **pediment** 2 m high with
    a cartouche, over each wing.
  - The centre mumty over the stair strip has 2 stepped tiers, each with a cornice.

**Other faces**
- West face: mostly plain, with 1–2 window stacks and pilasters.
- North face: balconies.
- East face: as the west face.

**Roof:** pale blue-grey deck, 2–3 mumties, 2 sunken square planters, a perimeter hedge planter.

**Stilt:** 0.45 m columns on a grid of about 6 m, a soffit, parked cars, lobby glazing.

### 3.2 Rear tower (largest)
- **46 × 20 m**, long axis E–W, at x[−45.5, 0.5], z[−28.2, −8.2].
- Same storey count and language.
- Two "wing–inner–wing" modules along the south face, so about 4 pediments along the long side; pediments and attics
  the same size as the hero's.
- A long sunken open roof shaft (12 × 4 m) in the middle. 5–6 mumties, sunken planters.

### 3.3 Palette (sampled; calibrate on compare sheets)

| Element | Colour |
|---|---|
| Body albedo | **#D6C6A4** (lit target about #D8C9AA, shade about #B1A184) |
| Trim | #E4D8BC |
| Panel field | #D1BF9A |
| Glass | warm dark #3A2F25–#545356 |
| Frames | #3B3128 |
| Balcony rail | grey-blue glass #5A5F66, light top rail; slab edge white band 0.25 m |
| Gold letters | #C08A3E (metal) |
| Doors | walnut #7A4E33 |
| Pavers | #A8A59F |
| Deck | #D8C0A4 |
| Mosaic | #A8CAD9 |
| Coping | #F0F0EE |

### 3.4 Site (plot 115 × 83 m bbox, irregular with an NW parking tail)
**Roads**
- Front road z[43.5, 53.5]: 2 lanes, dashed centreline, kerbs, footpaths z[41.5, 43.5] and z[53.5, 55.5].
- North road z[−51.5, −41.5].
- Zebra crossings west of gateW and east past the plaza.

**Gates** (`gateW` centre (−15.5, 41.5), `gateE` centre (20.5, 41.5))
- About 12 w × 4 d, 7.4 m to the apex, 5.5 m to the soffit, 5.8 m clear opening.
- Per side: one wide square pier plus 2 round engaged columns.
- Architrave, frieze, cornice, a 15° pediment with the brand name in gold.
- Black wrought-iron double swing leaves with an arched top and a concentric-circle motif.
- An optional north gate at (8, −41.5) (low confidence; v2).

**Compound wall:** cream piers 0.5 m square × 1.5 m at about 2.5 m spacing; 0.6 m plinth plus cream rails. Side and
rear boundaries use black vertical-bar railings between piers.

**Paving:** almost everything is grey pavers:
- 6 m+ apron around both towers
- the court z[−8.2, 8.5]
- west parking x[−55, −46] z[−30, 10]

**Pool zone**
- Deck x[−40, −22] z[28, 40.5], light-ash timber.
- Pool 12 × 6.5 m (E–W), centre (−31, 34).
- 3 × 3 m raised square mosaic feature **on the south long edge**.
- Round jacuzzi Ø2.2 at (−36, 31.5).
- White coping with a linear grating, 2 steel ladders.
- Low cream wall with a planter on the west, hedges on the east. **No glass balustrade.**

**Clubhouse:** centre (−33, 23), 9 × 9 m. See §3.5.

**Plaza** (east) x[24, 57], grey pavers:
- a round hedge-ring tree planter Ø8 at (42, 2)
- a striped lawn with rounded ends, 20 × 12, at (40, −27)
- a **play circle Ø10** at (42, 31) in multicolour EPDM with play equipment
- a lawn strip along the south wall
- palms and hedges along the edges

**Context:**
- Low-rise G+2…G+4 neighbours, in cream, white or grey.
- A white G+2 villa with solar panels to the NE.
- Broadleaf tree belts made of displaced icosphere clumps.
- Palms line the drive and walls.

### 3.5 Clubhouse (E is authoritative for the roof)
- 9 × 9 m. Wall to the cornice soffit 3.3 m; entablature to 4.7 m; a **fluted frieze band** plus a fluted parapet to
  5.6 m; **stepped attic** (2 tiers) per E.
- Corners: clustered round columns (2–3).
- South (pool) face: 2 walnut doors (west) plus a 3-panel glazed wall with transom (east).
- East and north faces: fully glazed (4 panels plus transom) with sheer white curtains.
- Brand-neutral "CLUB HOUSE" in gold on the east entablature.
- Grey concrete raised planters with topiary and bougainvillea; grey paver forecourt.

### 3.6 Gym interior (F), lazy-loaded, built last (v1-lite)
- Room 7.5 m wide × 9.5 m deep × **2.5 m** ceiling, beige #DACDAF walls.
- A **flush thin linear LED rectangle** (emissive), 8 downlights as emissive discs with light pools painted into a
  lightMap or texture.
- 1200 × 600 light grey tiles.
- Left wall: deep window reveals plus a bulkhead, a bright exterior.
- 2 walnut doors with diagonal grooves on the handle half.
- Treadmill, bike, dumbbell rack, 4 navy mats plus 1 grey mat, blocks, bottles, 2–3 perforated cylinder lamps,
  plants, an original framed abstract artwork and an original "YOGA" wall graphic.
- At most 2 real lights plus a RoomEnvironment PMREM.

## 4. Rendering recipe (r170; budgets are estimates to be measured)

**Renderer and resolution**
- `antialias:true`, `powerPreference:'high-performance'`, sRGB output, `info.autoReset=false`.
- Resolution scale = `min(dpr, sqrt(maxPx/(cssW·cssH)))`, where maxPx is H 2.1 MP / M 1.5 MP / L 0.9 MP.
- Dynamic resolution: ±0.1 step, floor 0.6, adjusting on the median of 60 frames.

**Tone and post**
- A/B in round 1: `NeutralToneMapping` (start) vs ACES. Exposure per keyframe.
- **No composer by default.** The vignette is a static CSS radial-gradient `<div>` (not a CSS filter).
- Night glow: emissive at 1.5–3× plus additive halo sprites; no bloom.

**Lights**
- A fixed pool: 1 directional with shadows, 1 hemisphere (0 in the day, 0.15 at night), ≤4 point/spot without shadows.
- Never add, remove or toggle lights.

**Shadows**
- `PCFSoftShadowMap`, 4096 / 2048 / 1024, `autoUpdate=false`.
- Update on a time-of-day change (debounced 150 ms) and at warm-up.
- Ortho frustum fitted to the light-space AABB of (plot × 55 m), texel-snapped. `bias −0.0003`, `normalBias 0.05`.
- Sun elevation ≥ 12°; fade the shadow below that.
- Cars, glass and moving things: `castShadow=false` plus blob decals.

**Environment**
- 4 PMREM keyframes (Day 0, Golden 0.35, Dusk 0.65, Night 1), all baked at load at the same size.
- Env scene: Sky (scale 10), a grey ground disc, a canvas silhouette horizon band of trees and buildings. Glass shows
  a horizon; the night env has a warm horizon glow.
- Pick the nearest keyframe and lerp `environmentIntensity`.

**Sky and fog**
- Preetham Sky: turbidity 9, rayleigh 1.5, mie 0.005, mieG 0.8.
- Canvas cloud dome with a warm-beige tint. Night gradient dome with stars.
- `FogExp2` is always on: 0.0022 (day) / 0.003 (golden) / 0.0035 (dusk), coloured by the keyframe horizon.

**Calibration:** an 18 % grey card in noon sun renders sRGB 115–130.

**Materials** (`M.get(name)` only; one owner)
- Plaster: Standard, roughness 0.88, ORM (R ao, G rough) plus a normal map, world UV 2 m tile, anisotropy 8.
- **Recess materials** (stilt, soffits, balcony ceilings, gate interiors): `envMapIntensity` 0.3.
- **Geometry vs maps:**
  - Real geometry for anything shadow-casting and readable at 40 m or more (cornices as extruded profiles with a
    2 cm bevel, pilasters, sills, slabs, attics, pediments).
  - Normal/ORM maps for detail under about 5 cm.
  - Low tier: facade cards.

**Windows:** interior mapping (`onBeforeCompile` on the instanced glass Standard material).
- A 3 m box room from a 2048×1024 atlas of 8 room variants, a curtain layer at 0.3 m.
- Per-instance `aWin` = (variant, curtain, lit, tint).
- Fresnel env reflection with F0 0.04.
- Night: about 55 % lit, 2700 K, varied.
- Low tier: 2-layer parallax.

**Foliage**
- Opaque colour plus a separate `alphaMap`, `alphaTest 0.4`, `alphaToCoverage:true`, roughness 0.75, ±8 % tint per
  instance.
- Palms: 2 InstancedMeshes (trunk, fronds), 12–16 curved strip fronds.
- Tree belts: icosphere clumps, no alpha. Foliage overdraw ≤3 in the aerial view.

**Ground**
- A 2048² site atlas (albedo, AO, markings, kerb shadows, wear) × a detail tile at 2 scales (the second rotated 37°)
  with a 40 m macro mask (`onBeforeCompile`).
- Contact decals: `depthWrite:false`, `polygonOffset −1`.

**Water**
- Standard: transparent, roughness 0.04, #2E9FB5, Fresnel opacity, 2 scrolling normals.
- Floor caustics as a scrolling emissive. Cyan emissive at night.

**Textures**
- Generated in a **Worker** into `DataTexture`s (pick one flipY convention). Cached.
- Mostly 1024²; the atlases are 2048².
- GPU memory ≤120 MB (H) / 60 MB (L).
- Albedo uses SRGB; data textures use NoColorSpace.
- Generation time per texture goes in `__report`.

**Programs**
- ≤30 unique programs.
- No program changes after `ready`: no light-count, fog-type or env null↔non-null changes, and no new materials.
- Warm-up: `compileAsync` → render every preset once with shadows → bake PMREMs → 3 frames → `__ready=true`.

**Depth:** near 0.5, far 2500, no log depth. Coplanar surfaces use `polygonOffset`.

**Budgets (high tier, visible plus shadow casters)**
- Towers: 120 draw calls / 700k triangles.
- Site + props: 70 / 300k.
- Vegetation: 20 / 250k.
- Amenities: 40 / 150k.
- Total ≤ 300 draw calls.
- Target ≥ 45 fps hero, ≥ 30 fps aerial on Iris Xe at 1080p.

## 5. Architecture and contracts (Stage 0 freezes these before any parallel work)

**Loading and launch**
- `index.html` plus an import map: `three` → `./vendor/three/build/three.module.js`, `three/addons/` →
  `./vendor/three/examples/jsm/`.
- three@0.170.0 is vendored from the npm tarball (MIT LICENSE kept). Fonts are vendored woff2 files (OFL). Fully
  offline.
- `start.bat` tries Python (`tools/serve.py`, which forces the `.js` MIME type and binds to 127.0.0.1). If Python is
  missing, it falls back to `tools/serve.ps1`, a PowerShell HttpListener server. Both open the browser. There is also
  `start.sh`.
- Opening via file:// shows a "run start.bat" message.

**Modules**
- `async build(ctx)` returns `{group, update?(f), onTimeOfDay?(k), dispose?()}`, where
  `f = {dt, t, k, camera, tier, frozen}`.
- `ctx = {THREE, SPEC, M, tex, util, rng, registry, tier, renderer}`.
- **Modules never create lights or call `new *Material`**, except materials registered through `M.define(name, fn)`
  in their own `materials/<module>.js`.
- `M.get(unknown)` returns magenta and logs an error.

**File ownership** (one owner each)

| Area | Files |
|---|---|
| Core | `core.js`, `util.js`, `textures.js` + `texture-worker.js`, `materials/base.js`, `validate.js` |
| Towers | `tower.js`, `materials/tower.js` (window shader) |
| Site | `site.js`, `props.js`, `materials/site.js` |
| Amenities | `amenities.js`, `vegetation.js`, `materials/amenities.js` |
| UI | `ui.js`, `i18n.js`, `styles.css`, `embed.js`, `interior-gym.js` |

- A `?only=<module>` harness lets each module be developed in isolation.

## 6. Experience
**Loading:** poster first. `assets/poster.jpg` (our own render) shows within 1 s, then crossfades to live 3D.
Time-to-interactive ≤ 5 s on Iris Xe (cold, localhost), measured.

**Views**

| View | Notes |
|---|---|
| **Hero** (default, poster) | 3/4 from the road corner near gateE, 25–35° elevation, golden hour k≈0.35, tower in the left two-thirds |
| **Elevation** | Matched to A (level camera plus `setViewOffset` shift lens) |
| **Aerial** | Matched to B |
| **Aerial-N** | Matched to C |
| **Pool** | Matched to D |
| **Clubhouse** | Matched to E |
| **Gym** | Matched to F; lazy |
| **Orbit** | Free |

- Eased flights of 1.6–2.2 s. With `prefers-reduced-motion`, flights become crossfades.

**Time of day:** chips for Day / Golden / Dusk / Night plus a slider.

**Tour:** 60–90 s, starting from and ending on Hero with the CTA, with captions (labelled placeholder). Any input
pauses it.

**Tags:** a gold diamond pin, a leader and a plate, with collision culling and at most 4 visible on phones.

**Info panel:** brand hero band, key facts ("2 towers · stilt + 14 floors · amenities", placeholder), amenity cards,
the CTA (a configurable link, `target:_top`), the disclaimer and the regulatory slot. On phones it becomes a bottom
sheet.

**Presentation mode (`P`)**
- Letterbox, hidden UI.
- Clicker keys: PageUp, PageDown, arrows and Space step through views; `B` blanks the screen.
- UI scale for 720p.

**Snapshot:** ≤3840 px wide, with the disclaimer burned in.

**Embed** (`?embed=1&view=&tod=&ui=min&autostart=0`)
- Poster plus "View in 3D". Gestures stay inert until clicked ("Click to explore" / two fingers on touch); Esc
  releases.
- postMessage v1, accepted only from `SPEC.embed.allowedOrigins`:
  - inbound: `setView`, `setTime`, `tour`
  - outbound: `ready`, `viewChanged`, `ctaClicked`, `error`
- Pause when hidden or off-screen. `embed-example.html` ships with a 16:9 wrapper.

**Fallback:** if WebGL2 is unavailable, the context is lost twice, or warm-up fps is below 20 on low, switch to
**Gallery mode** (our own pre-rendered stills plus the panel plus the CTA). Handle `webglcontextlost` and `restored`.
Provide `<noscript>` content.

**Languages:** English, with Hindi and Marathi strings present but **hidden until reviewed by native speakers**
(`SPEC.i18n.enabled`).

**Accessibility:** real buttons, keyboard focus, AA contrast, the canvas has `role=img` with an aria-label per view.

**SEO:** title, description, OG/Twitter tags with `og-image.jpg` (our own hero render).

**Quality tiers:** 2 tiers (high/low) plus `?q=` plus an fps downgrade. The tier comes from a probe context.

## 7. Tests and validation (`node --test`, no dependencies)
- `spec.test.mjs`: ranges and units, polygons inside the plot, no building/road overlap, cameras above ground,
  materials exist. Normal, edge and failure cases.
- `modules.test.mjs`: three runs in node. Build each geometry-only module with stub `tex`/`M` and check: no NaNs;
  registry grounding (0 floating or buried); per-module triangle and draw-call budgets.
- `params.test.mjs`: URL/embed params (valid, out-of-range, unknown, injection-like) and the postMessage validator.
- `i18n.test.mjs`: keys complete, fallback works.
- `compliance.test.mjs`: banned strings, `Math.random` in `src/`, CSS `filter` on the canvas and its ancestors,
  references never imported.
- Browser: `window.__report` = {floating, buried, scale, overlaps, programs, drawCalls, triangles, texMs, ttiMs}.

## 8. Shooting
`tools/shoot.py` (Playwright with channel chrome) runs these steps:
1. Load `?shot=1&view=X&tod=Y` with a frozen time.
2. Use a viewport matching each reference's aspect ratio (1600 px wide) at DPR 1.
3. Wait for `__ready`, then 2 rAFs.
4. Take a screenshot.
5. Write the `{view}.compare.png` sheet (reference | render).
6. Diff the shot against the previous round.
7. Collect console errors and `__report` into `report.json`.

**Perf numbers:**
- Run headed on the real GPU (`--use-angle=d3d11 --disable-gpu-vsync --disable-frame-rate-limit`).
- Warm up for 2 s, then record the median and p95 of 300 frames.
- Fail if the renderer string contains SwiftShader.

## 9. Refine loop (render–inspect–refine)
**Roles**
- **Orchestrator** (main agent): owns the issue queue, budgets and log.
- **Shooter:** a script, not an agent.
- **Critic:** a fresh-context agent. It sees only the compare sheets, `report.json`, the checklist and
  `observed.json`, never the code.
- **Fixer:** the owner of the affected module.

**Critic output:** `shots/r{N}/critique.json`. Per view: a checklist with pass/fail and evidence, plus issues. Each
issue has:
- id, status, category, severity (blocker 5 / major 2 / minor 1)
- observation, reference_evidence, region
- spec_path, proposed_fix {param | local-code | rewrite}
- acceptance, confidence

**Hard gates** (machine-checked; the critic cannot override them): 0 console errors; 0 floating or buried objects;
tests pass; no new programs after ready; budgets met.

**Budgets**
- ≤3 attempts per issue, then `wontfix` with a note.
- Rounds per view: Hero, Elevation, Aerial and Pool get 4. Aerial-N and Clubhouse get 2. Gym gets 1.
- 8 rounds overall.

**Stop and revert**
- Stop a view when it has no blocker or major issues, OR its budget is spent, OR the weighted score plateaus for
  2 rounds.
- A regression reverts to the checkpoint.

**Order within a round:** architecture and objects → grounding → light and atmosphere.

**Fixes:** parameter edits by default.

**Log:** `refine/log.jsonl`, one line per attempt. A snapshot checkpoint is taken per round.

**Checklist**
- Fidelity: floor count, bay sequence, cornice cadence, attic/pediment form, Rear length, gate form, pool and plaza
  layout, clubhouse form, colour.
- Realism: texel density, glass has depth, grounded shadows, no floating objects, natural scatter, no z-fighting or
  shimmer, consistent sky/env/sun, exposure.
- Product: pitch-worthy hero, legible UI, smooth motion.

## 10. Definition of done (v1)
- All views render with a clean console, and the massing gate passed. Compare sheets show a structural match for
  A–E (F lite).
- Hard gates are green, and `node --test` passes.
- Perf is measured headed on the Iris Xe (median and p95 logged).
- The poster, OG image and gallery stills come from our own renders.
- The offline launch is verified, and the embed example works.
- `assets/CREDITS.md` is complete.
- `HANDOVER.md` contains the open `wontfix` issues and the checklist: facts verified · sources confirmed · no
  sensitive data · **second reviewer: name**.
- Skill updates are proposed for owner approval.

**v2 / later:**
- north gate
- caustics polish
- continuous ToD re-bake
- reviewed hi/mr
- full gym
- unit highlight UI (the registry already supports it)
- moving traffic
- an HDRI option
