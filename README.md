# Project Name: 3D Experience (draft)

A real-time Three.js presentation of a two-tower residential project. Builders can embed it on a website or use it to
pitch live. It runs offline on a laptop with no installs.

> Indicative visualisation. All dimensions are estimates from marketing images, and all brand and content data are
> placeholders (`src/spec/brand.js`). It is a draft until a second qualified reviewer signs it off.

## Run it
- **Windows:** double-click `start.bat`. It uses Python if installed, otherwise a built-in PowerShell server, then
  opens `http://127.0.0.1:8765/`.
- **macOS/Linux:** `./start.sh` (needs python3).
- Opening `index.html` directly (`file://`) shows a "please run start.bat" message, because ES modules need http.

## Use it
- **Views:**

  | View | Shows |
  |---|---|
  | Hero | the default landing view |
  | Aerial, Aerial North | the full site from above |
  | Elevation | the front facade |
  | Pool | the pool deck |
  | Clubhouse | the clubhouse exterior |
  | Gym | the gym interior |
  | Explore | free orbit |

- **Time of day:** Day, Golden, Dusk, Night.
- **Tour:** a guided 60–90 s tour.
- **P:** presentation mode. A clicker works: PageUp/PageDown, the arrow keys and Space step through views; B blanks
  the screen.
- **Snapshot:** saves a PNG with the disclaimer burned in.

## Embed on a website
See `embed-example.html`. Use `?embed=1&view=hero&ui=min` in a 16:9 iframe with `allow="fullscreen"`.
- The 3D starts on click, and gestures stay inert until the visitor clicks.
- The postMessage API only accepts origins listed in `SPEC.embed.allowedOrigins` (`src/spec/quality.js`).

URL parameters: `view`, `tod` (0–1), `q` (`high`/`low`), `ui` (`full`/`min`/`none`), `embed`, `lang`.

## Rebrand / change the project
Everything lives in **`src/spec/`**:
- `brand.js`: name, developer, colours, CTA links, facts, amenities, disclaimer, regulatory slot.
- `towers.js`: floors, bay sequence, cornices.
- `site.js`: layout of roads, gates, pool, clubhouse and plaza.
- `cameras.js`: views, plus an optional per-view sun.
- `global.js`: palette and time-of-day lighting.
- `quality.js`: tiers, budgets, embed origins.

## Develop
- `npm test` runs node:test with no dependencies:
  - SPEC validation;
  - every module built in node (no NaN, grounded, scale, draw-call and triangle budgets);
  - URL and postMessage sanitising;
  - i18n;
  - compliance (banned names, `Math.random`, no CSS filters, no pricing).
- `python tools/shoot.py`: renders each view, writes compare sheets against the internal references and
  `shots/rN/report.json`. Add `--perf` for headed real-GPU frame timing.
- Architecture and rules: `docs/CONTRACTS.md`, `docs/build-prompt-v2.md`,
  `.claude/skills/threejs-property-showcase/SKILL.md`.
- Method: WorldClaw (arXiv:2608.05248), adapted. See `.claude/skills/threejs-property-showcase/references/worldclaw-findings.md`.

## Licences
See `assets/CREDITS.md`: three.js r170 (MIT), Fraunces and Inter (OFL). All textures and models are procedural and
original. The reference images are internal measurement material only (`_internal/`, git-ignored, never deployed).
