# CLAUDE.md

Real-time Three.js (r170, vendored, no build step) showcase of a two-tower residential project.

**Read these first, in order:**
1. `SESSION-HANDOVER.md`: current state, the owner's preferences, open items and how to resume.
2. `docs/HANDOVER.md`: the per-version change log (v1.1 to v1.11) and the client-use checklist.
3. `.claude/skills/threejs-property-showcase/SKILL.md`: the house rules and method. Module contracts are in `docs/CONTRACTS.md`.

## Run and check
- Run: `start.bat`, or `powershell -File tools\serve.ps1 -NoOpen`. The page is at `http://127.0.0.1:8765/`. Opening `index.html` directly does not work.
- Check changes visually with `tools/shoot-cdp.ps1` (headless Chrome on the real GPU; usage is in its header). Show before/after screenshots for every visual change.
- Node/npm and Python may not be installed on this machine. If `npm test` cannot run, say so. Do not claim the tests pass.

## Rules that are easy to break
- No CSS `filter` or `backdrop-filter`, even in comments: a test greps for the literal text `filter:`.
- No `Math.random` in `src/`; use `ctx.rng`.
- No new lights, materials or shader programs after the scene is ready. Light counts are fixed at boot.
- Loader animation uses only `transform` and `opacity`.
- Every `t('...')` literal must be in `STRINGS` and in both the hi and mr dictionaries in `src/i18n.js`.
- Branding comes from `src/spec/brand.js` (placeholders for now). Never publish the builder's reference images or real names; `Reference/`, `_internal/` and `shots/` stay out of git.

## Working agreements
- Commit and push only when the owner asks. The commit identity is the owner's choice, because it is published on GitHub. Never set it for them.
- GitHub Pages serves `main` at `https://cactiq.github.io/BuildIQ/`. Files are cached for 10 minutes, so a missing update is usually a stale browser copy: suggest a hard refresh before assuming a bug.
- The owner wants a vibrant, clean-air look, one window type, clean low-poly surroundings, and a minimal UI that works on phones. Details are in `SESSION-HANDOVER.md` section 4.
