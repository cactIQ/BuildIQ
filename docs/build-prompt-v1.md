# MASTER BUILD PROMPT, v1 (Phase 2)

## 0. Role and outcome
You are building a **premium, photoreal-leaning, real-time Three.js presentation** of a residential project, so a builder
can (a) embed it on their website and (b) pitch it live on a laptop or projector. Quality bar: it should read like an
architectural-visualisation marketing render (the reference images), yet stay interactive and smooth on an **Intel Iris Xe
laptop** and a mid-range phone.

**Branding:** the project is shown under a **neutral placeholder name** (`SPEC.brand.name = "Project Name"`,
developer `"Developer Name"`). Never show "Oswal Heights", "Vikas Construction" or any housing.com mark. All dimensions
are **estimates from photos**; the UI shows a small "Indicative visualisation · not to scale" note.

## 1. Inputs
- `Reference/*.avif`, six marketing renders (convert to PNG for viewing with Pillow):
  - **A** `vikas_oswal_heights-...avif`: front elevation from the road (hero)
  - **B** `fs.avif`: aerial, 3/4 view
  - **C** `fs (1).avif`: aerial, reverse side
  - **D** `fs (2).avif`: pool deck
  - **E** `fs (3).avif`: clubhouse
  - **F** `fs (4).avif`: gym/yoga interior
- `.claude/skills/threejs-property-showcase/SKILL.md` (house rules) and
  `references/worldclaw-findings.md` (method).

## 2. Method (WorldClaw, adapted; follow it in order)
1. **Observe, then plan.** Write `observed` facts per reference (things you can see) separately from `inferred`
   values (anything you estimate). Every inferred number in the SPEC carries a `// inferred` comment.
2. **SPEC is the single source of truth** (`src/spec.js`). Builders read the SPEC and never hard-code dimensions.
3. **Coarse to fine:** site base → massing → facade kit → roofscape → amenities → scatter → lighting/atmosphere →
   UI. Check the massing against refs A–C *before* adding facade detail.
4. **Prototype + instance:** every repeated thing (window bay, balcony, ornament, palm, car, lamp, railing post) is built
   once and placed via `InstancedMesh` or merged geometry.
5. **Grounding + scale validation in code** (`src/validate.js`): see §8.
6. **Render–inspect–refine loop** with `tools/shoot.py`: matched cameras for A–F, side-by-side compare sheets, a checklist
   critic, at most 3 rounds per issue, parameter edits rather than rewrites.

## 3. What to build (from the references)
### 3.1 Towers (2), neoclassical, cream
- **Tower A** (front, hero): about 30 m wide × 19 m deep (inferred). Stilt parking (3.6 m) + **14 residential floors**
  (3.0 m) + terrace. The front facade is symmetrical: two projecting **corner wings**, each topped by a **turret attic**
  (about 4.5 m) with a **triangular pediment** (scroll/cartouche ornament in the tympanum) and **3 small arched windows**.
  Between them is a recessed central zone of stacked **balconies with glass railings**, with a central **lift/stair
  core mumty** rising above the roof.
- **Tower B** (rear-left): about 24 m × 18 m, same language and floor count, smaller turrets.
- **Facade kit (instanced modules):**
  - window bay: dark-framed window with dark reflective glass and a subtle curtain hint; sill + head moulding
  - relief panel under the windows: a rectangular ornament with a garland/medallion, done with a normal map
  - full-height **pilasters** between bays
  - **cornice bands:** a light band at every floor slab, a **heavy projecting cornice every 4 floors** (moulded profile)
  - balcony: slab edge + glass railing with a top rail
  - top **entablature/parapet** with a moulded crown
- **Roofscape (refs B, C):** terrace parapet, lift/stair mumties, water-tank blocks, **rooftop planters** (green),
  turret attics.
- **Ground floor:** stilt columns (about 0.45 m square) on a grid, a ceiling soffit, parked cars, entrance lobby glass.
- **Colours** (sample the refs; values here are starting points): body render `#E3CFA0`, trim/mouldings
  `#EEE2C2`, ornament panels `#D9C08C`, window frames `#3B3530`, glass dark `#1D2228` with env reflection, railings
  clear glass + `#C8C8C8` rail.

### 3.2 Site (refs B, C)
- Plot about 120 × 90 m (inferred) with a **compound wall**: pillars every 3 m, a low plinth wall and a balustrade/railing in
  between, cream with darker caps.
- **Two entrance gate pavilions** (ref A): 4 clustered columns per side, an entablature, a triangular pediment, the gold
  name lettering (placeholder name), and black wrought-iron swing gates.
- **Internal drive** (grey pavers) looping around the towers; **stilt parking** under both towers.
- **Pool + clubhouse** near the front corner (ref D/E): rectangular pool with a raised square centre feature, a round
  jacuzzi, a blue mosaic floor and walls, a white coping edge, a **timber deck**, steel ladders, a glass balustrade; the clubhouse
  pavilion beside it.
- **Garden** (ref C): circular lawn with a central tree/fountain, curved paths, hedges, an ornamental lawn.
- **Kids' play area** (ref B): colourful soft-floor patch with play equipment.
- **Landscape:** palms along the perimeter and drive (dominant), shrubs, flowering bushes, clipped hedges along the wall.
- **Context:** roads on two sides with lane markings, kerbs, footpaths and a **zebra crossing**; low-rise neighbours
  (G+3/G+4, simple); dense tree belts; distant buildings for depth; parked and moving cars on the road.

### 3.3 Clubhouse (ref E)
Single-storey neoclassical pavilion: a corner **glass curtain wall** (thin black mullions, sheer white curtains behind),
paired pilasters at the corners, an entablature with a **fluted frieze**, a projecting cornice, a **stepped attic** on
the roof, gold "CLUB HOUSE" letters, planters with shrubs, and a paver forecourt. Wooden doors (changing rooms) on the pool
side (ref D).

### 3.4 Gym / yoga interior (ref F), a separate interior scene
About 12 × 8 m room, 3.2 m ceiling: beige walls; a **recessed LED cove rectangle** (emissive strip) + about 10
**downlights**; two wooden doors with a diagonal groove pattern; 600×1200 grey matt tiles; windows on the left wall
(bright exterior); a treadmill and bike (stylised), a dumbbell rack, yoga mats (dark navy), foam rollers, potted plants,
a framed sketch, and a "YOGA" wall graphic (generic artwork drawn on canvas; no copying of the reference art).

## 4. Rendering stack (realism on an iGPU budget)
- `WebGLRenderer({antialias:true, powerPreference:'high-performance'})`; DPR `min(dpr,2)` desktop, 1.5 phone;
  `ACESFilmicToneMapping` exterior, `AgXToneMapping` interior; sRGB output; `PCFSoftShadowMap`.
- **Sky:** `Sky` addon (Preetham) driven by sun elevation + soft procedural cloud dome (canvas). **Environment:**
  PMREM from the sky scene (regenerated only when the time of day changes by > 0.05). Optional CC0 HDRI (Poly Haven,
  1K) on desktop high quality, with a procedural fallback.
- **Sun:** one `DirectionalLight` with shadows; the shadow camera is tightly fitted to the site (about 140 m); map size 4096 (high)
  / 2048 (medium) / 1024 (low); `shadow.bias` and `normalBias` tuned to avoid acne on the facade. `HemisphereLight` fill.
- **Fake AO (no SSAO):** vertex-colour darkening under cornices, balcony soffits and the stilt ceiling; a baked ground
  AO/shadow texture around footprints, kerbs and walls (drawn from the SPEC polygons onto the ground canvas); radial
  contact-shadow decals under cars, planters and palms.
- **Materials:** procedural canvas textures (plaster noise + normal, pavers, asphalt, lawn, timber deck, mosaic,
  tiles, bark, leaf atlas, curtains, window interiors), with world-scale UVs (texel density consistent: 1 texture repeat
  ≈ 1–2 m on facades). Glass = `MeshPhysicalMaterial` (ior 1.5, roughness 0.05, no transmission, env reflections). Gold
  letters = metal 1, roughness 0.3.
- **Water:** custom shader on the pool surface: two scrolling normal maps, Fresnel blend between env reflection and the
  tinted floor, plus animated caustics on the pool floor (cheap texture shader).
- **Post:** `EffectComposer` with an MSAA target (samples 4, 2 on DPR > 1.5) → RenderPass → UnrealBloom (only at night;
  threshold high) → colour-grade + vignette ShaderPass → OutputPass. Skip SSAO, SSR and DOF.
- **Time of day** `k ∈ [0,1]` (day → golden hour → dusk → night) drives sun, sky, env, fog, exposure, window
  emissives (about 55 % lit, warm 2700K, varied), path lamps, pool light (cyan), facade up-lights (warm grazing on
  the pilasters at night), stars.

## 5. Architecture
- No build step. `index.html` + import map → `vendor/three/` (three@0.170.0 vendored from the npm tarball, so it works
  **offline** for pitches) with ES modules in `src/`. A `start.bat` / `start.sh` runs `python -m http.server` and opens
  the browser. (Deviation from the old skill's file:// rule: ES modules need http; justified by parallel module
  development and offline vendoring. Opening via file:// shows a friendly "please use start.bat" message.)
- **Module contract.** Every builder exports `build(ctx)` and returns `{ group, update?(dt,t,k), dispose?() }`.
  `ctx = { THREE, SPEC, M (shared materials), tex (texture factory), util (merge, instancing, grounding helpers), quality }`.
  - `src/spec.js`: SPEC (brand, global, site θ, layout polygons, buildings, regions, cameras, quality presets)
  - `src/core.js`: renderer, scene, cameras, controls, sky/env, sun, composer, time of day, render loop, stats
  - `src/textures.js`: procedural canvas textures (software 2D canvas, `willReadFrequently:true`), cached
  - `src/materials.js`: the shared `M` material library
  - `src/tower.js`: tower massing + facade kit + roofscape + stilt level (`buildTower(ctx, towerSpec)`)
  - `src/site.js`: ground, roads, drive, compound wall, gates, context buildings, AO ground
  - `src/amenities.js`: pool + deck + water shader, clubhouse, garden, fountain, play area
  - `src/vegetation.js`: palm/shrub/hedge/tree prototypes + scatter
  - `src/props.js`: cars, lamps, benches, planters
  - `src/interior-gym.js`: the gym interior scene
  - `src/ui.js` + `src/i18n.js` + `styles.css`: UI
  - `src/validate.js`: grounding/scale/overlap checks → `window.__report`
- Scene graph naming: `Tower_A/Floor_07/Bay_03`, `Amenity_Pool/...`, so units can be highlighted later.

## 6. Experience / UI (old-skill style: dark gold-black glass, Fraunces + Inter, hairline gold)
- Loading screen (transform/opacity-only animation; wordmark, gold diamond, thin progress line).
- **View presets:** Hero (matches A), Aerial (B), Aerial reverse (C), Pool (D), Clubhouse (E), Gym (F), Free orbit.
  Smooth eased camera flights (1.6–2.2 s); orbit limits per view; no going under the ground.
- **Time-of-day slider** + chips Day / Golden / Dusk / Night.
- **Guided Tour** autoplay: a slow cinematic sequence through the presets, with captions; any input pauses it.
- **Floating tags** (gold diamond pin + leader + plate) for Tower A, Tower B, Clubhouse, Pool, Garden, Play area,
  Entrance.
- **Info panel:** hero band (name, location placeholder, "2 towers · 14 floors · amenities"), amenity cards, a
  "placeholder data" label. No pricing.
- **Presentation mode:** hides the UI (key `P`) and shows cinematic letterbox bars. **Snapshot** button saves a PNG at 2× size.
- **Embed mode:** `?embed=1&view=hero&tod=0.2&ui=min` for the builder's website iframe.
- Languages EN / हिं / मरा (i18n keyed by English, fallback to English, Noto Devanagari, no letter-spacing on
  Devanagari). Translations flagged for native review.
- **Quality auto-tier** (high/medium/low) from GPU string + a measured frame-time warm-up; manual override in settings.

## 7. Performance budget (hard)
- Iris Xe, 1080p, high: ≥ 45 fps on hero, ≥ 30 fps on aerial. Phone (low): ≥ 30 fps.
- Draw calls ≤ 300 (exterior, high); triangles ≤ 1.5 M (high), ≤ 400 k (low).
- Textures: procedural, max 2048² (most 1024²); total download (excluding vendored three and the optional HDRI) < 1.5 MB.
- No CSS filter/blur on the canvas. No GPU canvas rasterisation during load. Shader warm-up via `renderer.compile`
  before the loading screen fades out.

## 8. Validation (documented + automated)
- `tests/spec.test.mjs` (node:test, no deps): SPEC ranges/units (floor heights 2.8–3.6 m, counts integer,
  polygons closed and inside the plot, buildings not overlapping roads or each other, cameras above ground, every
  region has a material). Normal, edge and failure cases (feed deliberately broken SPECs).
- `src/validate.js` at runtime: for every named object, bbox min-y vs its support height → `floating` (> 0.02 m) /
  `buried` (> 0.05 m); scale vs known sizes (car 4.2–4.9 m long, door 2.0–2.4 m, palm 5–10 m, floor 2.8–3.6 m) with an
  asymmetric tolerance; instance overlaps (palms inside buildings or water). Exposed as `window.__report`.
- `tools/shoot.py` (Playwright, Chrome): for each preset → beauty PNG + optional `?debug=normals|depth|ids` passes →
  side-by-side sheet with the matching reference → console errors + `renderer.info` + fps + `__report` → `shots/report.json`.
- Critic checklist per round (§9).

## 9. Critic checklist (per preset)
Fidelity: floor count, bay rhythm, cornice cadence, turret/pediment form, balcony stack, colour/value of the render,
stilt level, gates, pool shape, clubhouse form. Realism: material scale (texel density), glass reads as glass,
shadows grounded, no floating or buried objects, natural (non-grid) vegetation distribution, no z-fighting, no
abrupt transitions, sky/env consistent with the sun, believable exposure. Product: hero shot is pitch-worthy, UI legible,
transitions smooth, console clean, budget met.

## 10. Definition of done
All presets render with a clean console. Compare sheets show a structural match to A–F. Budget met on this laptop's
Iris Xe (measured, real GPU `--use-angle=d3d11`). `node --test` passes. `__report` shows zero floating or buried objects.
The skill and README are updated. A second qualified reviewer is listed in the handover checklist.
