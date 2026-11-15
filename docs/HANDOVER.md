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
