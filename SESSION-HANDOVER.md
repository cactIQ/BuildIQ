# Session handover: 3D property showcase (state at v1.11, 2026-11-19)

Read this first when resuming the project. The per-version change log is in `docs/HANDOVER.md`. The house rules and
method are in `.claude/skills/threejs-property-showcase/SKILL.md`. Module contracts are in `docs/CONTRACTS.md`.

## 1. What this is
A real-time Three.js (r170, vendored, no build step) showcase of a two-tower residential project (Tower A 28×23 m and
Tower B 46×20 m, each stilt + 14 floors), with pool, clubhouse, plaza, gym interior and a procedural low-poly
surrounding. It runs offline.

- **Branding is placeholder:** the name is "Project Name" and the developer is "Developer Name", set in
  `src/spec/brand.js`. All dimensions are estimates from marketing images and are a draft until the builder's drawings
  arrive.
- **Run locally:** double-click `start.bat`. It uses Python if installed, otherwise `tools/serve.ps1`. The page opens
  at `http://127.0.0.1:8765/`. The server is bound to this machine only. Opening `index.html` directly does not work.
- **Repo:** `https://github.com/cactIQ/BuildIQ`, branch `main`.
- **Live (GitHub Pages):** `https://cactiq.github.io/BuildIQ/`. It is public.
  - Last pushed commit: `1c06ddd` "v1.11: new sky, lighting, loader, compass, time ruler, mobile layout".
  - Local and live matched byte for byte at the last check.
  - Pages caches files for 10 minutes. If someone cannot see an update, suggest Ctrl + Shift + R, then a private
    window.
- **Not in git:** `shots/` (about 466 MB of test renders), `_internal/` and `Reference/` are in `.gitignore`.
  - `Reference/` holds the builder's marketing images. An early push included it, so it may still be in the repo
    history. If that matters, the history needs cleaning.

## 2. This machine
- **No Node/npm and no real Python.** `npm test` has never run this session; run it once Node is installed. Git is
  installed. Chrome is installed.
- **Commit identity is the owner's choice,** because it is published. Do not set it for them. Commit and push only when
  asked.
- **Checking changes:** `tools/shoot-cdp.ps1` screenshots any view or time of day through headless Chrome on the real
  GPU. Usage is in its header. Start the server first, then for example:
  `.\tools\shoot-cdp.ps1 -Views hero -Out C:\temp\s -Query tod=1`
  The query takes `tod` from 0 to 1 (0 day, 0.35 golden, 0.65 dusk, 1 night).
  Also use `-Eval "(() => { const r = app.report(); return [r.programs, r.drawCalls, r.grounding.floating.length]; })()"`.
- **Phone layouts:** headless Chrome will not render narrower than 504 px. Test phone sizes by putting the page in an
  iframe of the exact size (390×844, 360×740, 844×390).
- **Python tools** (`tools/shoot.py`, `tools/serve.py`) exist but cannot run here.

## 3. What was done (v1.1 → v1.11)
Details and exact numbers are in `docs/HANDOVER.md`.

| Area | Result | Where to tune |
|---|---|---|
| Sky | Art-directed sky replaces Preetham: 3-stop gradient, thin haze, sun disc, stars, moon. Fog cut to about a third. | `src/sky.js`; per-keyframe `sky` blocks in `src/spec/global.js` |
| Colour | `CustomToneMapping` (Neutral/ACES blend, saturation, contrast, warmth). No post-processing pass. | `src/grade.js` (`GRADE`) |
| Time of day | Four keyframes. Nine baked environment maps along the range, so scrubbing is smooth. Shadows follow the sun. | `timeOfDay.keyframes` in `src/spec/global.js`; `ENV_STEPS` in `src/core.js` |
| Dusk / night | Dusk is a natural sunset. Night is a moonlit blue hour with a visible moon. | `moon` in `src/spec/global.js` |
| Tower lighting | Even warm floodlight wash plus a crown light at night. All windows lit, warm-white. | `src/materials/tower.js` (`uLitI`, `WASH_I` in `src/tower.js`) |
| Windows | One window type everywhere (same sheer curtain). Glass casts shadows. Reflectance raised. | `src/tower.js`, `src/materials/tower.js` |
| Towers | Dense flank facades (inferred, not measured). Real relief geometry. | `sides` in `src/spec/towers.js` |
| Surroundings | Low-poly trees; far tree groves; flat pastel background blocks (about 70 of them); no scrub and no patches; flat roofs. | `src/vegetation.js`, `src/site.js`, `src/spec/site.js` |
| Night landscape | About 15 post lamps and 40 bollards. Eight pooled point lights (lobbies, clubhouse, plaza, parking, gates, pool). | `src/site.js`, `src/core.js` |
| Roof glitter (fixed) | Two causes: a coplanar slab (z-fighting), and the textured roof aliasing. | `src/site.js` (context neighbours) |
| UI | Phone-camera-style time ruler. Presentation, snapshot, fullscreen and size buttons removed (keys P and B still work). Compass top-left. | `buildTimeRuler` in `src/ui.js` (`MINS` maps phases to clock times) |
| Tour | After 30 s idle, an endless slow tour (4.8 s flights, 11 s dwell with eased orbit). | `TOUR` in `src/core.js`; `IDLE_MS` in `src/ui.js` |
| Loader | Poster-first, large two-line wordmark, tower-emblem that fills with gold. | `src/ui.js` (`TOWERS_PATH`), `styles.css` (`.ld-*`) |
| Mobile | 13.5 px rem base on phones, dock fixed, compact ruler and sheet, landscape layout. | `@media` blocks at the end of `styles.css` |
| Sharpness | High-tier pixel cap raised to 3.7 MP; dynamic-resolution floor 0.75. | `src/spec/quality.js` |

**Verified in the browser (last checks):** 0 console errors in every view at day, golden, dusk and night; 37 shader
programs; about 88 draw calls; vegetation about 191k triangles; 0 floating or buried objects.

## 4. The owner's preferences (learned in this session)
- **Look:** vibrant and clean-air, not dull or hazy. Natural light only. Dusk must not look pink: amber sun and neutral
  shade, with the sunset kept in the sky. Night should be even, soft and warm-white, with no hard shadows.
- **Windows:** one type only. At night, a soothing glow rather than sharp bright rectangles.
- **Surroundings:** clean low-poly. No smudgy textures, dark patches or rocks. No black glitter or shimmer anywhere.
- **UI:** minimal. Remove clutter; premium look; phone-friendly.
- **Process the owner liked:** one agent drafts a prompt, a second validates and challenges it against the code, then the
  prompt is rewritten and executed. Before/after screenshots for every visual change.

## 5. Open items (priority order)
1. **Run `npm test`** after installing Node. `tests/params.test.mjs` was edited for the new sun values; the i18n test
   gained the key `'N'`. Nothing has run against the new code.
2. **Test on real phones and on the pitch laptop.** Check frame time: the resolution cap is 3.7 MP and there are 8 point
   lights and 9 environment maps. Fallbacks if it stutters: `maxPx` in `src/spec/quality.js`, the light count in
   `src/core.js` (about line 101), and `ENV_STEPS`.
3. **Real branding:** names and facts in `src/spec/brand.js`; swap `TOWERS_PATH` for the real logo's SVG path.
4. **Verify against the builder's drawings:** floor counts, Tower B size, the dense flank facades, and the amenities. See
   the client checklist at the end of `docs/HANDOVER.md`.
5. **Cold load is 7–10 s** (target 5 s). The poster hides it. Options: bake textures, or cache them.
6. **About 37 shader programs** against a guideline of 30.
7. **Hindi and Marathi** strings are hidden until native speakers review them.
8. **Not done:** palm height and lean variety; plan notches (recesses) in the tower plans.

## 6. Rules that bite (full list in the skill file)
- No CSS `filter` or `backdrop-filter`, even in comments: a test greps for the literal text `filter:`.
- No `Math.random` in `src/`; use `ctx.rng`.
- No new lights, materials or shader programs after the scene is ready. Light counts are fixed at boot.
- Loader animation uses only `transform` and `opacity`.
- Every `t('…')` literal must be in `STRINGS` and in both the hi and mr dictionaries in `src/i18n.js`.
- Never publish the builder's reference images or real names.

## 7. Resuming in a new Claude session
- Open Claude in the new folder and say: "Read SESSION-HANDOVER.md and docs/HANDOVER.md, then continue."
- Claude Code stores conversations by folder path. To keep the old conversation and saved notes after moving, copy
  `%USERPROFILE%\.claude\projects\<old-path-name>` to a folder named after the new path (path with `\`, `:` and spaces
  turned into `-`).
  - Close the old session first.
  - Keep the old copy until the new one works.
  - Do not copy onto a path that already has its own record.
