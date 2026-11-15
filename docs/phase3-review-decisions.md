# Phase 3 review: decision log

Three independent critics reviewed `build-prompt-v1.md` in parallel, each with fresh context:
(1) architectural fidelity against refs A–F, with pixel measurements;
(2) real-time graphics on Iris Xe, three r170;
(3) product, pitch, method and compliance.
Their outputs are model drafts. The numbers are estimates.

| # | Challenge | Source | Decision in v2 |
|---|---|---|---|
| 1 | Rear tower is the **largest** (≈46×20 m bar, 2 modules, ≈4 pediments, roof shaft), not 24×18 | Fidelity C1 | Adopted (inferred, low–med confidence) |
| 2 | Hero depth ≈23 m; numeric site layout needed | Fidelity C2 | Adopted: full layout in §3.4 |
| 3 | Front bay sequence: wing, small window, balcony, stair strip, balcony, small window, wing (27.9 m) | Fidelity C3 | Adopted |
| 4 | Cornices at floors 0,3,4,7,8,12,14 (band floors 4 and 8), not "every 4" | Fidelity C4 | Adopted |
| 5 | Ref A is a shift-lens elevation and looks composited | Fidelity C5 | `setViewOffset` matched view; Rear-tower mismatch accepted in A |
| 6 | Attic is a frontispiece parapet; gates are pier + 2 engaged columns; plaza (not curved garden); pool feature on the south edge, no glass rail; clubhouse 9×9 with clustered columns; gym 2.5 m ceiling, flush LED | Fidelity M1–M9 | Adopted |
| 7 | Palette too yellow; body #D6C6A4 | Fidelity M10 | Adopted; calibrate on compare sheets |
| 8 | Clubhouse roof: E (stepped attic) vs D/A/B (open canopy) | Fidelity M8 | **E chosen** (dedicated reference). Owner may override |
| 9 | DPR 2 + MSAA composer won't fit on Iris Xe | GFX C1 | Pixel-count cap + dynamic resolution; no composer by default; CSS-gradient vignette |
| 10 | Per-bay scene nodes vs instancing | GFX C2, Product C2 | Placement registry + `userData.ids` |
| 11 | Freeze contracts before parallel agents | GFX C3 | Stage 0 owns contracts; one owner per file |
| 12 | Shader-compile hitches on ANGLE/D3D11 | GFX C4 | ≤30 programs, no program changes after ready, full warm-up |
| 13 | Windows read as black tiles | GFX C5 | Interior mapping, 8-room atlas, curtain layer |
| 14 | Shadow extent ignores tower height; per-frame cost | GFX C6 | Static, fitted, texel-snapped map, updated only when time of day changes |
| 15 | PMREM regen on slider drag; hemi double-counts | GFX M1 | 4 pre-baked keyframes; hemi 0 by day |
| 16 | ACES shifts cream to ochre | GFX M2 | Neutral vs ACES A/B in round 1; grey-card calibration |
| 17 | Vertex-colour AO doesn't work on boxes | GFX M3 | AO painted into atlases + recess materials at env 0.3 |
| 18 | Foliage fringes, shimmer, overdraw | GFX M5 | Separate alphaMap, alphaToCoverage, icosphere tree belts |
| 19 | Main-thread texture generation stalls the load | GFX M6 | Worker → DataTexture; time budget logged |
| 20 | Python missing on a pitch laptop | Product C1, GFX M12 | `start.bat` → Python, else PowerShell HttpListener fallback |
| 21 | Unseeded randomness | Product C3 | mulberry32 streams; `Math.random` banned by test |
| 22 | Reference imagery could leak | Product C4 | Refs internal only; banned-strings test |
| 23 | Hero shot should be a 3/4 golden-hour view, not the flat elevation | Product M1 | Hero (3/4) + separate Elevation (matched A) |
| 24 | Poster-first, embed gating, postMessage, CTA, gallery fallback, a11y, OG | Product M2–M8 | Adopted |
| 25 | Scope too broad | Product B | v1/v2 split; gym is "lite" and lazy; hi/mr hidden until reviewed |
| 26 | Refine loop is hand-wavy | Product C | Critic JSON schema, hard gates, budgets, plateau/regression rules, log |
| 27 | Branch/commit gating | Product C5 | The folder is not a git repo, so round checkpoints are snapshots. Initialising git is offered to the owner |

## Verified facts (checked against the r170 tarball and the local machine)
- `three.module.js` r170 is self-contained (no `three.core.js` import).
- `NeutralToneMapping`, `environmentIntensity`, `alphaToCoverage` and `compileAsync` are present.
- Available addons include CSM, Sky, SMAA, GTAO, OrbitControls, BufferGeometryUtils, RectAreaLightUniformsLib.
- Installed Chrome is 157. Pillow 11.3 decodes AVIF. Python Playwright is installed. The GPU is Intel Iris Xe.

## Open for the owner / reviewer
- Tower B (Rear) size and floor count: refs conflict, and a client fact is needed.
- Clubhouse roof form (E vs D).
- RERA/regulatory display: legal to confirm.
- Native-speaker review of the Hindi and Marathi strings.
