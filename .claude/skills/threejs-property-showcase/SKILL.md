---
name: threejs-property-showcase
description: Build or extend a premium, realistic, real-time Three.js showcase of a real-estate project (towers, site, amenities, interiors) from reference photos/renders, for builders to embed on websites and pitch live. Use when starting, extending, matching-to-reference, refining or reviewing such a showcase; covers the agentic plan→prompt→critique→refine→build workflow (adapted from the WorldClaw paper), SPEC-driven architecture, iGPU-safe realism recipe, render-compare refine loop, embed/pitch UX and compliance. Builds on the owner's earlier Aurelia Heights / Row House Study lessons.
---

# Three.js property showcase (v2)

Read these with this file:
- `references/worldclaw-findings.md`: the research method and how we apply it.
- `docs/CONTRACTS.md`: module contract.
- `docs/build-prompt-v2.md`: the current master prompt.
- `Reference/oldskill.md`: v1 lessons. Its rules still apply unless overridden below.

## 1. Non-negotiables (old rules kept, new ones added)
1. **Smoothness first.** Measure frame cost on the target (an Intel Iris Xe class laptop and a mid-range phone) before
   adding effects. Perf numbers count only from **headed Chrome on the real GPU** (`--use-angle=d3d11`), never
   headless or SwiftShader.
2. No CSS `filter`/`blur`/`backdrop-filter` over the canvas (it crashed an Intel GPU process before). A test enforces it.
3. No GPU canvas rasterisation during load. Generate textures in a **Worker** into `DataTexture`s. Small canvases use a
   software 2D context (`willReadFrequently`).
4. The loader animates only transform and opacity. Show the poster image first; time-to-interactive ≤ 5 s on an iGPU.
5. **No shader-program changes after `ready`**:
   - never add, remove or toggle lights (a mesh's `visible` is fine; a light's is not);
   - no fog null↔set, no env null↔set, no new materials;
   - warm up with `compileAsync`, then render every preset once.
6. Seeded randomness only (`ctx.rng`). `Math.random` is banned, so screenshots are comparable between rounds.
7. **Reference images are measurement-only and internal.** Never texture from them or trace their art. Third-party
   names are banned by a test, and branding comes from `SPEC.brand`.
8. No pricing UI. Placeholder data is labelled. Every output is a draft until the owner and a second reviewer sign off.
9. Work in git with checkpoint commits per stage and refine round. Confirm developer approval before creating or
   changing project files (org rule).

## 2. Workflow that worked (phases)
1. **Plan:** inventory the references (what each image pins down). Run a research agent on the method paper in parallel.
2. **Prompt v1:** a single master build prompt covering method, what to build, rendering recipe, architecture, UX,
   budgets, validation and definition of done.
3. **Challenge** with 3 independent critics in parallel, each with fresh context and given files rather than conclusions:
   - architectural fidelity, with pixel measurements of the references;
   - real-time graphics on the target GPU and three version;
   - product, pitch, method and compliance.

   This found big errors in v1, for example the rear tower was the largest building, the cornice cadence was wrong,
   and DPR 2 with an MSAA composer would not fit the iGPU.
4. **Refine:** prompt v2 plus a decision log (`docs/phase3-review-decisions.md`). Verify the critics' API claims against
   the vendored three tarball.
5. **Implement:**
   - **Stage 0** (serial): SPEC, contracts, core, util, the texture worker, tests and tools. Freeze the interfaces.
   - Then parallel builder agents with strict file ownership and their own render-check loops.
   - Then integration and a refine loop judged by a fresh critic.

## 3. Architecture (no build step)
- `index.html` + import map → **vendored** `three@0.170.0`, so it works offline for pitches. ES modules need http:
  `start.bat` tries Python and falls back to a PowerShell HttpListener, so a stock Windows laptop works.
  A file:// visit shows a "run start.bat" message.
- SPEC as pure data (`src/spec/*`), loadable by node. Builders never hard-code numbers. Inferred values are tagged.
- Module contract: `async build(ctx) → {group, update, onTimeOfDay}`.
  - Materials via `M.define`/`M.use`.
  - Lights from a fixed pool.
  - Every placement goes through a **registry** (grounding, scale, IDs), and the scene graph stops at component level.
  - Unit addressing uses `userData.ids` plus index tables, not per-bay nodes.
- Tests (`npm test`, node:test, no dependencies, `three` resolved through a loader hook):
  - SPEC ranges and layout overlaps;
  - every module builds in node (no NaN, grounded, scale, draw/triangle budgets);
  - params and postMessage sanitising;
  - compliance (banned names, `Math.random`, CSS filters, refs never referenced, no pricing).

## 4. Realism recipe on an iGPU (r170)
- **Resolution:** cap the drawing buffer by pixel count (2.1 MP high / 0.9 MP low), not DPR, plus dynamic resolution.
  - Use `antialias:true` straight to the canvas, with **no composer by default**.
  - The vignette is a CSS radial-gradient div.
  - Night glow comes from emissive plus halo sprites, not bloom.
- **Tone mapping:** `NeutralToneMapping` keeps cream facades from turning ochre (A/B it against ACES on the hero).
  Calibrate with an 18 % grey card in the noon sun (sRGB 115–130).
- **Environment:**
  - 4 pre-baked PMREM keyframes (day, golden, dusk, night) from an env scene: Sky at scale 10, a ground disc and a
    silhouette horizon band, so glass reflects a horizon. The PMREM size is the same for all (r170 `fromScene` is
    always 256), so switching does not recompile.
  - Lerp `scene.environmentIntensity`. Hemisphere light 0 by day (the IBL already fills).
- **Shadows:** a static map (`autoUpdate=false`, updated when the time of day changes), with an ortho frustum fitted to
  the light-space AABB of the site *including tower height*. Sun elevation ≥ 12°.
- **Fog:** `FogExp2` is always on and coloured by the keyframe horizon, which gives the hazy archviz depth.
- **Windows:** interior mapping, with per-instance variant, curtain and lit attributes. This is the single biggest
  "real vs CG" factor on facades.
- **Detail:** geometry for anything readable at 40 m or more (cornices as extruded profiles with a 2 cm bevel, pilasters,
  attics); normal/ORM maps below 5 cm. AO is painted into atlases, recess materials get `envMapIntensity` 0.3, and
  contact decals replace SSAO (the owner vetoed SSAO).
- **Foliage:** an opaque colour map plus a separate alpha map, `alphaTest` with `alphaToCoverage`. Background trees are
  icosphere clumps with no alpha.
- **Ground:** a site atlas (AO, markings, wear) × a 2-scale rotated detail texture under a macro mask, so there is no
  tiling.
- **Water:** a Standard material with Fresnel opacity and scrolling normals, plus emissive caustics. No reflector passes.

## 5. Matching references
- Use the internal refs plus a **camera table per reference**. Elevation renders need a **shift lens** (a level camera
  with `setViewOffset`; see `src/params.js` `shiftLens`).
- Marketing renders are often composited (in A the rear tower's scale is off by about 30 %). Precedence: client facts >
  aerials for layout > elevation for detail > close-ups for local detail. Record conflicts.
- Massing gate: ratios (tower height:width, rear:hero length) within ±5 % before any facade work.

## 6. Refine loop (render–inspect–refine)
- `tools/shoot.py` produces matched shots, compare sheets, a diff against the previous round, and `report.json`
  (console errors, draws, programs, grounding).
- A **fresh critic agent** sees only the sheets, the report and the checklist, never the code. It outputs
  `critique.json` issues with a severity weight (blocker 5 / major 2 / minor 1), the spec path, the proposed fix type
  and acceptance criteria.
- **Hard gates:** 0 console errors, 0 floating or buried objects, tests green, no new programs after ready, budgets met.
- **Budgets:**
  - ≤3 attempts per issue;
  - 4 rounds for hero, elevation, aerial and pool; 2 for the others;
  - 8 rounds overall.
- Stop on a pass, an exhausted budget or a plateau; revert on regression. Fixes are parameter edits first.

## 7. UX that sells
- Default view: a **3/4 golden-hour hero** (not the flat elevation).
- Views: elevation, aerial, pool, clubhouse, gym; a 60–90 s guided tour.
- Presentation mode with clicker keys. A snapshot with the disclaimer burned in.
- Embed:
  - lazy start;
  - gestures inert until clicked;
  - a postMessage API accepted only from allow-listed origins;
  - a pause when off-screen;
  - a 16:9 example snippet.
- A gallery fallback for weak devices or context loss. Hindi and Marathi stay hidden until native speakers review them.

## 8. Troubleshooting (additions)
- Python's `http.server` on Windows can serve `.js` as `text/plain`, which breaks modules. `tools/serve.py` forces the
  MIME types.
- SphereGeometry with `thetaLength = PI/2` already maps uv.y from 1 (zenith) to 0 (horizon). Don't remap it for sky domes.
- Batch files: the shell layer can rewrite `>nul`. Write `.bat` files with an editor and CRLF line endings.
- An `npm` loader hook (`tests/three-hooks.mjs`) lets node resolve the bare `three` specifiers to `vendor/`.
