# Handover: Project Name 3D Experience (v1 draft)

Status: **draft, ready with caveats for an internal demo.** It is NOT ready for client delivery until the checklist at
the end is complete.

## What is delivered
- A real-time Three.js (r170, vendored, offline) showcase of a 2-tower neoclassical residential project, rebuilt from
  6 reference marketing images.
- **Views:** Hero (our own 3/4 golden-hour composition), Elevation (ref A), Aerial (B), Aerial North (C), Pool (D),
  Clubhouse (E), Gym interior (F), Explore.
- **Experience:** Day, Golden, Dusk and Night lighting. A guided tour, presentation mode with clicker keys, snapshot,
  embed mode, gallery fallback for weak devices, and a poster-first loader.
- Neutral placeholder branding throughout (`src/spec/brand.js`). All dimensions are **estimates**.

## Quality evidence
- **`npm test`:** 39/39 pass. This covers SPEC validation, every module built under node (no NaN, grounded,
  scale-checked, within draw-call and triangle budgets), URL and postMessage sanitising, i18n, and compliance (no third-
  party names, no `Math.random`, no CSS filters, no cost figures).
- **Hard gates in the last shoot (`shots/r8`, `r82`):** 0 console errors in every view. Grounding OK, with 1,331 placed
  objects checked and none floating or buried.
- **Real-GPU frame time** (Intel Iris Xe, headed Chrome, D3D11, vsync off, 300 frames): median 1.8–4.8 ms and p95
  ≤ 9 ms per view, roughly 200+ fps against a 45 fps target. These are rAF-interval figures, not GPU timer queries, so
  treat them as indicative. Retest on the actual pitch laptop and on a mid-range phone.
- **Independent critic** (fresh context, images only): weighted score 56 at round 7 and 36 at round 8, with 22 issues
  fixed and 0 regressed. The hero flat-light issue it raised in round 8 was then fixed (r82).

## Open issues (refine budget reached; candidates for v1.1)

| Priority | Issue | Owner area | Note |
|---|---|---|---|
| 1 | **Window glass still reads dark and matte** in several views (HERO-003, ELEV-002, AER-003, CLUB-004) | tower / amenities materials | A Fresnel environment term exists but is too subtle at shot distance. Raise its gain or add a sky-gradient fake reflection. |
| 2 | **Cold load 7–10 s** (target ≤ 5 s; HERO-007) | core `textures.js` | Texture generation stalls about 3 s with idle workers. Root cause not found. Options: IndexedDB cache of generated textures, deferring non-hero textures until after the first frame, or pre-baked compressed textures. The poster covers the wait visually. |
| 3 | **Tower flank faces look sparse** (AERN-006, HERO-010) | SPEC `towers.js` sides | Inferred as "plain + 2 window stacks", but ref C suggests denser bays. **Needs real drawings.** |
| 4 | Facade ornament and cornice shadow lines are still faint in the frontal elevation (ELEV-001) | tower | Improved in r8; more relief contrast is possible. |
| 5 | Clubhouse forecourt is mostly bare pavers; ref E has planters and a car (CLUB-002, CLUB-008). Pavers in shade read blue. | amenities / site / core env | |
| 6 | Gym: contact shadows are subtle and the floor is too bright (GYM-001, GYM-004) | gym | |
| 7 | Minor: thin elevation road band (inherent to the long-lens match); a far treeline silhouette band; a pool-house upper terrace tier (ref D vs E conflict); a lit-window cluster at night; ~38 shader programs against a ~30 guideline. | various | |

## v1.1 update (2026-11-18): atmosphere, lighting and modelling pass

**What changed**
- **Clean-air sky** (`src/sky.js`, new): an art-directed gradient sky replaces the Preetham sky and the night dome. The
  visible sky and the environment-lighting bake now use the same sky. Per-keyframe colours live in the `sky` block of
  each time-of-day keyframe in `src/spec/global.js`.
  - Fog densities are cut to about ⅓ and coloured to each keyframe's own horizon, which removes the grey "smog" band.
  - The environment bake pulls the zenith toward the horizon, so shade reads softly cool rather than saturated blue.
- **Golden hour:** a less saturated sun (`#FFD9AE`), so the facade stays cream instead of turning ochre.
- **Day:** a curated-view sun never drops below 80 % of the keyframe's elevation, so the hero at "Day" no longer has
  evening shadows.
- **Night:** a blue-hour sky (navy zenith, cobalt horizon, finer stars; the brown glow is gone).
  - Dim cool moonlight and low ambient.
  - The facade is lit as architectural accents: grazing uplights on the pilasters, a crown lit at about 3500 K, warm
    cornice soffits and uplight pools at the stilts.
- **Glass:** reflectance raised from 0.04 to 0.10 head-on (0.7 at grazing angles), with per-pane variation of ±20 %. By
  day the sheer curtains read light.
- **Context:** 43 more neighbour buildings in clusters (mid-rise at 150–300 m, towers at 400–650 m), far tree clumps out
  to 480 m, and a trees-only far treeline (no cardboard cut-out shapes). All are merged into existing draws.
- **Towers:**
  - The W and E flanks use the new `dense` pattern: per floor, 4 windows with relief panels plus 2 recessed balconies.
    This was open issue 3 and is still inferred; confirm it against the drawings.
  - The relief panels are now real geometry (an 8 cm moulded frame around a 5 cm panel).
  - The cornice shadow band is deeper (open issue 4).
- **Clubhouse:** white sheers instead of taupe "blinds"; brass/gold letters that no longer render black.
- **Pool:** a richer water blue.
- **Gym:** a honed, slightly darker floor with a soft sheen (GYM-004).

**Evidence** (headed-GPU headless Chrome, D3D11):
- 0 console errors across every view at day, golden, dusk and night.
- 36 shader programs, down from 38.
- Grounding: 0 floating, 0 buried and 0 scale problems over 2,001 placements.
- Module budgets: tower 204k tris / 28 draws; site 151k / 19; vegetation 191k / 13; total about 601k.
- Before/after sheets are in `shots/v1.1-compare/` (internal only).

**Not verified on this machine:** Node, Python and git were not installed, so `npm test` and `tools/shoot.py` did not
run, and the work was not committed. The budget and grounding figures above come from the same checks run in the
browser. `tests/params.test.mjs` was updated for the new day/golden sun values. Run `npm test` and commit before any
client use.

**Still open:** palm height and lean variety (left alone because of the palm scale validator); plan notches / utility
shafts on the tower flanks (needs drawings); the cold-load time of 7–10 s (unchanged).

## v1.2 update (2026-11-18): vibrant grade, sunlight and moonlight

This pass was benchmarked against the owner's Aurelia Heights showcase.
- **Colour grade** (`src/grade.js`, new): the renderer now uses `THREE.CustomToneMapping`, a 55 % ACES / 45 % Neutral
  blend with +16 % saturation, +7 % contrast and slight warmth.
  - It costs no extra pass, so there is still no composer.
  - The interior uses the same curve, so switching views does not recompile shaders.
  - The main dial is `GRADE.aces`: higher is punchier but pushes cream toward ochre.
- **Sunlight:** a stronger warm key (4.4 by day) against a lower environment fill, so shadows are crisper. The
  hemisphere fill gets per-keyframe colours (`hemiSky` / `hemiGround`); by day its ground colour is green, matching the
  lawns.
- **Moonlight:** after dusk the key light swings to `timeOfDay.moon` (front-left of the hero view, so the facades catch
  cool light). A visible moon disc with a halo is drawn at `moon.disc` and fades in from dusk.
- **Night:** 60 % of homes lit (was 40 %), brighter windows, and slightly more wall glow.
- **Greens:** fresher lawn and hedge colours; the off-site fields are mostly green, with dry and ochre patches as
  accents only.
- **Sharpness:** the high-tier resolution cap rises from 2.1 MP to 3.7 MP, and the dynamic-resolution floor from 0.6 to
  0.75.
  - **Re-measure the frame time on the pitch laptop.** If it drops below 45 fps, lower `quality.high.maxPx`.
- Sheets are in `shots/v1.2-compare/`. All views rendered with 0 console errors and 36 programs.

## v1.3 update (2026-11-18): realistic dusk and night (owner references: archviz night stills)
- **Windows:** warm-white (about 3000–3500 K) instead of saturated orange.
  - Only gentle variation between homes, a soft ceiling-to-floor falloff, and rooms desaturated at night.
  - 55 % of homes lit, half of them glowing through sheers.
  - Window intensity is `uLitI` 1.95 in `materials/tower.js`.
- **Walls:** one even, soft floodlight wash (about 3300 K) from ground fixtures, fading gently with height, plus a modest
  crown light. The v1.1 pilaster stripes and cornice bands are removed. The plaster texture is smoother (its mottling
  and streaks were amplified by the grade).
- **Shadows:** the moon is a weak, soft key (0.3), and a stronger cool sky ambient (hemisphere 0.5, environment 0.9)
  gives evenly lit blue-grey walls with no hard night shadows.
- **Dusk:** now a true blue hour. A weak sun (0.45), a deep-blue sky and only a thin warm band on the horizon.
- **Grade:** saturation reduced from 1.16 to 1.1, so warm tones don't turn orange.
- **Neighbour windows:** warm-white and softer.
- Sheets are in `shots/v1.3-compare/`.

## v1.4 update (2026-11-18): window review
- **Shadow gaps fixed:** the window glass now casts shadows (`castShadow = true`), so sunlight no longer leaks through
  the window openings onto the road and lawns. This adds one depth-shader variant (37 programs).
- **One window type everywhere:** the same room, the same full-width ivory sheer and the same tint on every window
  (±4 % brightness only). The open, half-drawn and bright-room variants are removed. The lobby glazing stays clear.
- **Night windows:** calmer (`uLitI` 1.95 → 1.35) in a soft honey tone (about 2900–3200 K). Each pane glows brightest
  in the centre and falls off softly toward the frame, so it reads as lamp light through a sheer rather than a sharp
  rectangle.
- Evidence is in `shots/v1.4-compare/`.

## v1.5 update (2026-11-18): night lighting
- **Every apartment window is lit at night.** The per-window intensity is lowered to `uLitI` 1.15 so the whole facade
  stays soft. The neighbouring buildings' windows stay dark (`site.facade` emissive 0).
- **Landscape lighting:**
  - 15 more post lamps: plaza edges, lawn, play area, parking aisle, the clubhouse forecourt and both tower lobbies.
  - About 40 knee-high bollards: lawn paths, the play circle, the tree ring, the pool deck edge and the gate mouths.
  - Brighter lamp heads, halos and ground light pools.
  - These add 55 placements, all grounded. They merge into existing meshes, so there are no new draw calls (still 90).
- **Real light on the key areas:** the point-light pool grows from 4 to 8, fixed at boot so there are no recompiles.
  New lights cover the 2 tower lobbies, the clubhouse forecourt, the plaza and the parking.
  - **Re-check the frame time on the pitch laptop:** every lit material now evaluates 8 point lights.
- Shots are in `shots/v1.5-night-lighting/`.

## v1.6 update (2026-11-18): auto tour, low-poly surroundings, golden hour and dusk
- **Idle auto tour:** after 30 s with no input, a slow tour starts and loops endlessly through hero → aerial →
  elevation → pool → clubhouse → aerial north → explore → back to hero.
  - Flights are eased and last 4.8 s. Each view dwells for 11 s with a smooth eased orbit (26°, or 9° for the level
    shift-lens views), alternating direction.
  - Any input stops it. It also starts from the gym, and never runs in embed, shot or reduced-motion mode.
  - Tuning lives in `TOUR` (`core.js`) and `IDLE_MS` (`ui.js`).
- **Low-poly surroundings:**
  - All broadleaf trees are faceted low-poly models (`vegetation.lowpoly`, flat-shaded vertex colours). They replace
    the leaf-card clusters.
  - A far ring of tree groves (150–460 m) replaces the scrub mounds.
  - The field shader keeps only a soft green drift; the dark scrub and bare-earth patches are gone.
  - Background buildings are flat-shaded pastel blocks, with no window texture.
  - Vegetation is 191k triangles against a 250k budget; grounding shows 0 floating and 0 buried.
- **Golden hour:** about 15 % softer sun and exposure, with a less saturated sun colour.
- **Dusk:** a natural sunset. The sky grades violet at the top, through magenta-pink, to an orange-gold horizon; the
  sky shader now supports an optional middle colour stop. Clouds are violet-lit, a low warm-pink sun grazes the
  facades, and there is a lavender fill. Clouds now have a colour and opacity per keyframe.
- Shots are in `shots/v1.6/`.

## v1.7 update (2026-11-18): time ruler, smooth transitions, cleanup
- **Time ruler** (replaces the Day / Golden / Dusk / Night chips and the range slider), in phone-camera-zoom style at
  the top centre:
  - A fixed gold needle over a sliding tick scale running 12 PM → 9:30 PM: 15-minute ticks and hour labels.
  - Gold dots mark the four phases; clicking one jumps there.
  - A bubble shows the time and phase.
  - Input: drag or swipe (with release inertia), mouse wheel, ←/→ in 15-minute steps, PgUp/PgDn in 1-hour steps,
    Home/End.
  - The shown time eases toward the target every frame.
  - Time mapping: Day 12:00, Golden 17:30, Dusk 19:00, Night 21:30 (`MINS` in `buildTimeRuler`, `ui.js`).
- **Smooth phase transitions:**
  - Nine environment maps are baked along k from blended keyframe states (was one per keyframe, which popped between
    phases).
  - Shadows now follow the sun while scrubbing (throttled to 30 Hz) instead of updating 150 ms after the change.
  - Memory cost: about 9 PMREMs. Lower `ENV_STEPS` in `core.js` if the pitch laptop is short of memory.
- **Toolbar:** the presentation, snapshot, fullscreen and UI-size buttons are removed. The keyboard shortcuts remain
  (P for presentation, B to blank).
- **Background roofs:** the black glitter is fixed. The dark parapet band that z-fought at distance is gone, the black
  tanks are now pale, the solar arrays are removed, and the background blocks no longer receive shadows (they streaked
  at the edge of the shadow map).
- **Dusk facade:** warmer and more natural. The amber sun (`#FFB984`) and dusty-blue fill replace the coral and
  lavender, and the environment lighting neutralises the magenta mid-sky. The visible sky keeps its sunset colours.

## v1.8 fix (2026-11-18): black glitter on background roofs (root cause)
- **Cause:** each background building had a full-footprint slab box whose top face sat at `H + 0.18`, exactly
  coplanar with the grey roof plane (`site.js`, context neighbours). Two coplanar surfaces of different colours
  z-fight. The camera's 0.5–2500 m depth range leaves only about 1–5 cm of precision at 150–600 m, so it showed as
  dark hatching that shimmered as the camera moved. The v1.7 fixes (AO band, black tanks, solar panels, receiveShadow)
  removed secondary noise, but not this.
- **Fix:** the slab is now a perimeter ring (an edge band under the parapet), so nothing lies under the roof plane. The
  other contacts with the roof are downward-facing bottoms (mumties, tanks) that are never drawn from above.
- **Verified** with the same close and far cameras, before and after: `shots/v1.8-roof-fix/`. Grounding: 0 floating,
  0 buried.

## v1.9 update (2026-11-18): roof shimmer, premium loader, compass
- **Roof shimmer (second cause):** background roofs used the textured `roofDeck` material (fine grain plus a normal
  map). At 100 m and more that detail aliased into a dark, shimmering speckle, most visible at night. Background roofs
  are now painted flat in the low-poly facade material. Before and after shots: `shots/v1.9/roof-night-*.png`.
- **Loader:** rebuilt following the owner's samples. The process (draft → validate/challenge → final) is recorded in
  `docs/loader-compass-prompt.md`.
  - Poster-first, with a dark left-to-right scrim.
  - A large two-line wordmark that slides up line by line, with a subtle drift. The second line is an oblique
    uppercase line, right-aligned to the first.
  - The tagline sits under the wordmark.
  - A glass card (faked; no blur filters) shows the developer name with a pulsing status dot, the stage caption, a live
    percentage, and a gold progress line with time-based easing.
  - The interior uses a centred card-only loader.
  - Reduced-motion is respected, and there is a dark fallback when the poster is missing.
- **Compass:** at the top left (under the brand block on desktop; below the time ruler on phones). The gold needle
  shows world north relative to the camera heading. It updates per frame from the camera matrix, with no extra
  renders, and is hidden in the gym.
- **i18n:** adds the key `'N'`. Also fixes a stale `body.presenting` selector, which should be `body.present`.

## v1.10 update (2026-11-18): animated loader emblem
- **Emblem replaces the glass progress card** (owner request).
  - A two-tower monogram with pediment crowns sits inside two counter-rotating rings: a gold dashed ring and a faint
    dotted ring.
  - The towers fill with gold from the ground up as loading progresses. This is a `scaleY` on a clipped rectangle, so
    it is still transform-only and uses the same time-based easing as the bar.
  - Beside the emblem: the developer name, a large serif percentage and the stage caption.
- The interior mini-loader centres the emblem. Reduced-motion stops the rings.
- The tower outline is the `TOWERS_PATH` constant in `src/ui.js`. Swap it for the real logo's SVG path when the brand
  is final.
- Shots are in `shots/v1.10-emblem/`.

## v1.11 update (2026-11-18): mobile layout pass
Audited at true phone sizes: 390×844, 360×740 and landscape 844×390. The phone was emulated with an iframe of exact
size, because headless Chrome will not shrink below 504 px.
- **The view dock overflowed the phone.** It was 718 px wide on a 390 px screen: the base `width: max-content` beat
  the phone rule. It is now `width: auto` and fits (370 px), with all views reachable by swipe.
- **Phones use a 13.5 px rem base** (was the desktop 16 px), so every rem-sized element shrinks about 16 %. The topbar
  went from 58 to 49 px.
- **Compact time ruler on phones:** 79 → 55 px tall.
  - With the topbar and compass, the top chrome now ends at about 134 px instead of 188 px.
  - The compass moved below the ruler.
- **Details sheet:** 64vh (was 72vh), with a smaller title, facts and cards. Four amenities now show without scrolling
  (was 2.5).
- **Landscape phones** (height ≤ 500 px) get their own compact layout:
  - a 12 px base;
  - a slim topbar;
  - a 20rem ruler at the top centre;
  - a smaller compass and dock;
  - a 19rem side panel;
  - a smaller loader.
- Before and after shots: `shots/v1.11-mobile/`. A real-device check (iPhone Safari and an Android phone) is still
  recommended.

## Decisions the owner should confirm
- **Rear tower (Tower B) size and floor count:** the references conflict. The model uses a 46×20 m bar with 14 floors.
- **Clubhouse roof:** stepped attic per ref E (owner-confirmed).
- **Per-view art-directed sun:** curated views use their own sun direction, as archviz stills do. Free orbit uses the
  time-of-day sun.
- **RERA/regulatory display:** a placeholder slot exists. Legal must confirm the requirement.
- **Hindi and Marathi** strings exist but are hidden until reviewed by native speakers.

## Where things are
- Run: `start.bat` / `start.sh`. Rebrand: `src/spec/brand.js`. Layout and dimensions: `src/spec/*.js`.
- Method and decisions: `docs/` (plan, prompt v1→v2, review decisions, contracts, refine protocol).
- Skill: `.claude/skills/threejs-property-showcase/` (SKILL.md plus the WorldClaw findings).
- Internal only (git-ignored, never deploy): `_internal/` (references, observed facts), `shots/` (renders and
  critiques). `refine/log.jsonl` is the refine-loop log.
- Licences: `assets/CREDITS.md`.

## Before any client use (checklist)
- [ ] Facts verified: dimensions, floor counts and amenities confirmed against the builder's drawings and brochure
- [ ] Sources confirmed: the WorldClaw citations checked against the arXiv PDF; asset licences in CREDITS.md
- [ ] No sensitive data: real names appear only in internal references (`_internal/`), never in deliverables; the compliance test passes
- [ ] Builder authorisation to depict the project, and the final branding, received
- [ ] Second qualified reviewer assigned: **name: ____________**
- [ ] Security scan of the code, and a review of the embed `allowedOrigins` before website deployment
- [ ] Tested on the actual pitch laptop (offline, `start.bat` without Python) and on a mid-range phone
