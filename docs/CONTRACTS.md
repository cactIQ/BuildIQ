# Build contracts (frozen in Stage 0). Every builder agent follows these.

Read first: `docs/build-prompt-v2.md` (what and why), `src/spec/*.js` (all numbers), this file (how).
House rules: `.claude/skills/threejs-property-showcase/` (SKILL is the old skill, `Reference/oldskill.md`) and
`references/worldclaw-findings.md`.

## Frame & units
- Metres, Y-up, +x east, +z **south** (the front road is on the south). Origin = plot bbox centre.
- Levels: y=0 finished ground/paving. Roads at `SPEC.global.roadLevel` (âˆ’0.15). Kerb top 0. Lawn patches top +0.03.
  Pool deck top +0.15. Tower plinth top `t.plinthH` (0.3). The stilt floor sits on the plinth.
- Building local frame: origin at the base centre, front facade faces +z. `t.c = [x, z]` is the footprint centre.

## Module contract
```js
export async function build(ctx) -> { group, update?(f), onTimeOfDay?(k, state), dispose?() }
// f = { dt, t, k, camera, tier, frozen }   (dt = 0 and t fixed when frozen/shot mode)
// state = blended ToD keyframe fields (sunI, envI, night 0..1, exposure, ...) - see src/spec/global.js
ctx = { THREE, SPEC, util, rng, registry, tex, tier, renderer|null, params, M, lights, scene }
```
- The build must also run **under node** (`npm test` builds every module with stub textures). Never touch
  `document`/`window` in builders. Use `ctx.tex.canvas()` for 2D-canvas textures (it is stubbed in node).
- **Materials:** define them in your own `src/materials/<module>.js`: `export function define(M, SPEC){ M.define('name', async (ctx) => material) }`.
  In build: `const m = await ctx.M.use('name')`. Base materials are in `src/materials/base.js`: plaster, trim,
  plasterRecess, slabWhite, roofDeck, concrete, kerb, pavers, asphalt, lawn, lawnStriped, deck, mosaic, coping,
  frame, iron, steel, gold, walnut, rail, balconyGlass, contactShadow, emissiveWarm. Prefix your own names with
  your module (`tower.glass`, `site.gateIron`...).
  All materials must be created during `build()`. Never create or swap materials after build (that recompiles shaders).
  Night changes go through **uniforms/intensities** in `onTimeOfDay`, e.g. `mat.emissiveIntensity = state.night * 2`.
- **Textures:** `await ctx.tex.get(recipe, params)` gives `{albedo, normal, orm, alpha, emissive}` DataTextures.
  These are generated in a worker: an image covers 1 UV unit; flipY=false; albedo is sRGB; the others are linear.
  - To add recipes, edit ONLY your `src/tex/recipes-<module>.js` (same signature as `recipes-base.js`).
  - Use world-scale UVs: `util.worldUV(geometry, tileMetres)` after baking transforms. Texture repeat stays 1.
  - Sizes: 1024Â² normally, 2048Â² only for atlases.
- **Lights:** never create lights. `ctx.lights.claim(owner, {color, position, distance, intensity})` gives one of 4 pooled
  point lights, scaled by `night` automatically. Fake everything else with emissives and additive halo sprites.
- **Randomness:** `ctx.rng('stream-name')` â†’ `r()`, `r.range(a,b)`, `r.int(a,b)`, `r.pick(arr)`, `r.chance(p)`.
  `Math.random` is banned (the test fails).
- **Registry (grounding/scale/ids):** every placed object goes through
  `ctx.registry.place({ kind, id, bbox: Box3 (world), supportY, module })`.
  - `supportY` is the surface it rests on (0, âˆ’0.15, 0.15, roof y...), or `null` for non-resting parts
    (cornices, wall-mounted parts).
  - Kinds with a scale check: `car` (len 4.2â€“4.9), `door` (h 2.0â€“2.4), `palm` (h 5â€“10), `floor` (h 2.8â€“3.6).
  - IDs look like `Tower_H/F07/B03`, `Car_012`, `Palm_034`. For instanced meshes keep `mesh.userData.ids[i]`.
- **Geometry:** merge static parts per material (`util.mergeParts`) and instance repeats (`util.instanced`).
  The scene graph stops at component level (`Tower_H/Facade/Windows` = one InstancedMesh), not per bay.
  Name every mesh.
- **Shadows:** big architecture casts and receives. Small props, glass, cars, foliage cards and moving things
  have `castShadow=false`; use `contactShadow` decals for those. The shadow map is static (updated only when the
  time of day changes).
- **Tiers:** `ctx.tier.name` is `'high'|'low'`. Low tier: fewer fronds and instances, facade cards instead of deep geometry.

## Budgets (high tier, `npm test` enforces)

| Module | Draw calls | Triangles |
|---|---|---|
| tower (both towers) | 120 | 700k |
| site + props | 70 | 300k |
| amenities | 40 | 150k |
| vegetation | 20 | 250k |
| total (incl. core) | 300 | 1.5M |

Programs: at most about 30 unique shader programs in the whole exterior, so reuse materials.

## Ownership (edit ONLY your files; if you need a core change, describe it in your report)

| Agent | Files |
|---|---|
| tower | `src/tower.js`, `src/materials/tower.js`, `src/tex/recipes-tower.js` |
| site | `src/site.js`, `src/props.js`, `src/materials/site.js`, `src/tex/recipes-site.js` |
| amenities | `src/amenities.js`, `src/vegetation.js`, `src/materials/amenities.js`, `src/tex/recipes-amenities.js` |
| ui | `src/ui.js`, `src/frost.js`, `src/look-panel.js`, `src/i18n.js`, `src/embed.js`, `styles.css`, `embed-example.html`, `src/interior-gym.js`, `src/materials/gym.js`, `tests/i18n.test.mjs`, `tests/embed.test.mjs`, `vendor/fonts/`, `assets/CREDITS.md` |
| core (orchestrator) | everything else (`core.js`, `util.js`, `params.js`, `spec/`, `textures.js`, `materials/base.js`, `tex/recipes-base.js`, `validate.js`, `index.html`, `main.js`, `tools/`, other tests) |

Spatial split, to avoid double-building:
- **site:** ground and paving, roads, kerbs, footpaths, zebras, markings, compound wall and railings, both gate
  pavilions, context buildings, cars, street and path lamps, the parking strip.
- **amenities:** pool zone (deck, basin, water, jacuzzi, kids' pool, ladders, west wall), clubhouse, plaza contents
  (tree ring, striped lawn, play area, south lawn strip), planters.
- **vegetation:** palms (drive, walls, plaza edges, pool), shrubs, hedges (along walls/plaza), tree belts.
- **tower:** both towers including plinth, stilt columns, roof, mumties, rooftop planters and roof hedges.
  Cars in the stilt parking are site's job (`props.js`), so tower exposes nothing; site reads the SPEC.

## Verification loop (each agent)
1. `npm test` must pass (it builds your module in node: no NaN, grounded, budgets).
2. Shoot your module in isolation or together, using a unique round number range per agent:
   `python tools/shoot.py --views hero,aerial --round 2xx --query "only=tower,site"`
   (tower 201â€“299, site 301â€“399, amenities 401â€“499, ui 501â€“599).
   Read `shots/r2xx/*.compare.png` next to the references (`_internal/refs/A..F.png`) and `report.json`
   (console errors, drawCalls, programs).
3. Up to 4 renderâ€“inspectâ€“refine rounds. Prefer parameter changes. Stop on a pass or when the budget is spent.
4. Do NOT run git. Do NOT edit files outside your ownership. Report: what you built, test output, shots inspected,
   known issues, and requests for core changes.

## Compliance
Never use the reference images as textures or trace their art. Never write the real project, developer or
locality names, or the listing site's name, anywhere. Branding comes from `SPEC.brand` only.

## Interiors (v1.15)
- An interior is a module like any other (`build(ctx) -> { group, update?, setMode?, colliders?, bounds?, eye?, radius? }`),
  registered in `MODULE_FILES` / `MATERIAL_FILES` in `src/core.js` and built lazily into its own scene on first entry.
- Camera presets name it: `interior: 'flat'` (legacy `interior: true` is the gym) and optionally `mode: 'dollhouse' | 'walk'`.
  `dock: false` hides a preset from the dock; `dockAs` highlights another tab; `exitTo` is where Esc goes from Walk.
- `setMode('all' | 'dollhouse' | 'walk')` toggles visibility groups only (never materials). Core calls `setMode('all')`
  before `compileAsync`, so every variant is compiled once.
- Walk collision uses `colliders` (plan rectangles `[x0, z0, x1, z1]`) and `bounds`. Owner: core (`src/walk.js`,
  `src/interior-flat.js`, `src/materials/flat.js`, `src/tex/recipes-flat.js`).
- Flat budget (`npm test`): dollhouse <= 45 draw calls, walk <= 90 (the floor reflection draws the room twice), <= 150k tris.
## Tour and motion blur (v1.16)
- `SPEC.tour` (exterior view ids) and `SPEC.tourTime` (same length, time of day 0..1 per stop; spec test enforces).
- `app.setView(id, { duration, instant, v0, tod })`: `v0` = camera velocity carried into the flight, `tod` = time of
  day reached on landing (exterior only). Events: `tour`, `tourStep`, `tourCut` ({ seconds }: loop restart fade),
  `tourEnd`, `motionblur`.
- `app.motionBlur`: `set(on)` (async; compiles the blur pass first), `enabled()`, `setShutter(deg)`, `shutter()`.
  On by default for the high tier (owner decision 2026-11-20), off on low; never in `?shot`. Owner-approved exception
  to "no composer by default". `params.mblur`: null = auto, true/false = forced.
- Motion blur target: HalfFloat, MSAA 4 (0 on the low tier), DepthTexture, `isXRRenderTarget = true`, texture
  colour space sRGB. If a three upgrade changes how XR targets pick tone mapping / output colour space, re-run the
  pixel-identity probe in HANDOVER v1.16.
