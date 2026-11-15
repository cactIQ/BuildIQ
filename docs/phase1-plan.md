# Phase 1 — Plan: Oswal Heights 3D showcase (Three.js)

## Goal
A realistic, premium, single-page Three.js presentation of the Oswal Heights project (Palghar, Vikas Construction Co.)
that a builder can embed on a website or present in a pitch. Built from 6 reference images (Reference/*.avif).

## Reference inventory (what each image gives us)
| # | File | View | What it pins down |
|---|------|------|-------------------|
| A | vikas_oswal_heights-...avif (1160x794) | Front elevation from the road | Facade language, tower heights ratio, turrets + pediments, cornice rhythm, gates, compound wall, palms, cars |
| B | fs.avif (655x531) | Aerial, 3/4 from the south-west (est.) | Tower footprints (stepped/L-shaped), roof mumties + rooftop planters, internal drive, pool + clubhouse, garden, play area, context |
| C | fs (1).avif (619x538) | Aerial, opposite side | Second gate, circular lawn + fountain, landscaped garden, road layout, zebra crossing |
| D | fs (2).avif (1160x638) | Pool deck | Pool with raised square centre, round jacuzzi, timber deck, mosaic, steel ladders; stilt parking columns; clubhouse terrace |
| E | fs (3).avif (1160x653) | Clubhouse | Neoclassical pavilion, glass curtain wall, fluted frieze, stepped attic, gold "CLUB HOUSE" letters, paver drive |
| F | fs (4).avif (1160x633) | Gym / yoga interior | Beige room, LED cove rectangle, downlights, wood doors, 600x1200 grey tiles, equipment, mats, mural |

Images carry housing.com watermarks: they are third-party marketing renders. See the open questions on rights.

## Architectural read (estimates, to be confirmed by the client's drawings)
- **Two towers.** Tower A (larger, front) has a stepped plan with twin corner turrets, each with a triangular pediment and 3 small arched attic windows. Tower B (rear/side) is a smaller twin with the same language. Estimated ~14 floors each above stilt parking (count from A; confidence medium).
- **Facade kit:** full-height pilasters, a heavy cornice band about every 4 floors, ornamental relief panels under windows, dark-framed windows with dark glass, a recessed central balcony stack with glass railings, beige/cream render (~#E6D3A8), lighter trim (~#EFE3C4).
- **Ground:** stilt parking (columns, cars), compound wall with pillars and balustrade, two pedimented gate arches (4 clustered columns per side, "OSWAL HEIGHTS" gold letters, wrought-iron gates).
- **Amenities:** pool + jacuzzi + timber deck, clubhouse pavilion, landscaped garden with circular lawn and fountain, children's play area, palm-lined perimeter, gym/yoga room (interior).
- **Context:** roads with lane markings, a zebra crossing, low-rise G+3/G+4 neighbours, dense tree belts.

## Approach (old skill + WorldClaw methodology, adapted)
1. **Structured SPEC first** (the paper's planning stage). One `spec.js` holds regions, buildings, facade grid,
   materials, amenities, placements, spatial relations and camera presets. Every builder reads only from it.
2. **Coarse to fine:** site base (terrain, roads, plots), then tower massing, then the facade kit (instanced modules),
   then roofscape, then amenities, then vegetation and props, then lighting and atmosphere.
3. **Grounding/contact checks** in code: assert every object's base sits on its supporting surface (no float, no sinking).
4. **Render-and-compare loop:** camera presets matched to references A–F; a headless Playwright screenshot of each preset next to its reference;
   critic agents list mismatches; fix, then re-render. Stop on a pass or after N rounds.
5. **Premium-realism stack on a phone/iGPU budget:** PBR procedural materials, a sky with a PMREM environment, ACES,
   soft shadows, emissive night windows, light bloom, instanced vegetation. No SSAO (owner decision); fake AO with
   vertex/texture gradients and contact-shadow decals.

## Deliverable views (camera presets)
1. Hero front elevation (matches A), the signature shot
2. Aerial site (matches B), 3. Aerial reverse (matches C)
4. Pool deck (D), 5. Clubhouse (E), 6. Gym interior (F)
7. Free orbit + day/night slider + guided "tour" autoplay

## Architecture (from the old skill)
- No build step: `index.html` + import map `three@0.170.0` (jsDelivr) + plain modules; lazy plain-script parts.
- Files: `index.html`, `src/spec.js`, `src/core.js` (renderer/env/post), `src/materials.js`, `src/tower.js`,
  `src/site.js`, `src/amenities.js`, `src/vegetation.js`, `src/interior-gym.js`, `src/ui.js`, `src/i18n.js`,
  `tools/shoot.py` (Playwright screenshots + compare sheet), `.claude/skills/...` (updated skill + paper findings).

## Phase plan and agent use
| Phase | Who | Parallel? |
|-------|-----|-----------|
| 1 Plan | me + paper-research agent | parallel |
| 2 Prompt | me (needs full context) | — |
| 3 Review/challenge | 3 independent critics: (a) architectural fidelity vs images, (b) Three.js realism/perf on iGPU, (c) WorldClaw-method + product/pitch | parallel |
| 4 Refine | me, merging critiques | — |
| 5 Implement | me: core + spec + contract; then builder agents per module (towers / site+amenities / gym+UI) in parallel; me: integrate; critic agent: render-compare loop | mixed |

## Open questions for the user
- Rights: are we authorised by Vikas Construction Co. to recreate Oswal Heights and use its name and renders? (Watermarked housing.com images.)
- Floor count, dimensions, drawings: do we have any? Otherwise we label the model "indicative".
- Org rule: confirmation that a developer approved creating files in this project folder.
