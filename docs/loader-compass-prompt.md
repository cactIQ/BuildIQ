# Loader and compass: final build prompt

This prompt went through three steps:
1. Agent 1 wrote the first draft.
2. Agent 2 checked that draft against the code and challenged it.
3. The draft was rewritten with Agent 2's 10 required changes merged in.

**Scope:** change only `src/ui.js`, `styles.css` and `src/i18n.js`. Keep the `mountUI` contract as it is.

## House rules
- Never write the literal text `filter:` anywhere in CSS, comments included. The test regex catches it everywhere.
- The loader animates only `transform` and `opacity`.
- Do not use `Math.random`.
- All brand text comes from `SPEC.brand`.
- Use only the vendored fonts (Inter 400/500/600 and Fraunces).
- Every new `t('…')` literal must appear in STRINGS, in the hi dictionary and in the mr dictionary.
- Keep the `.wordmark`, `.loader-dev` and `.diamond` CSS. The embed gate and the gallery still use them.

## Loader
The style follows owner samples 16, 17 and 18.

### Layout
- **Scrim:** the loader background is transparent only when the poster has loaded (`complete && naturalWidth`). Otherwise it falls back to the old dark radial gradient. On top sits a dark left-to-right scrim, with a second gradient darkening the bottom.
- **Top-left mark:** `.ld-top` is aligned exactly with the `.brand` padding, so the crossfade into the live view is seamless.
- **Wordmark:**
  - Line 1 is Inter 500, uppercase, `clamp(2.75rem, 9vw, 7rem)`, line-height 0.95.
  - Line 2 is the last word of the name: uppercase Inter 400 with a synthesized italic, about 0.8× the size, opacity 0.78.
  - Line 2 is right-aligned to the end of line 1, using `inline-grid` with `justify-items: end`.
  - A single-word name renders on one line.
- **Tagline:** `.ld-tag` sits under the wordmark, at most 32rem wide.
- **Glass card** (bottom-left; samples 17 and 18):
  - The glass look is faked: a gradient background, a 1px hairline border and radius 14px.
  - Contents:
    - the developer name, next to a status dot that pulses its opacity;
    - the stage caption on the left and the percentage on the right (tabular numbers);
    - a 2px accent progress line, drawn with `scaleX`.

### Progress
- **Easing:** easing is time-based: `shown += (target - shown) * (1 - exp(-dt / 0.12))`.
- **Before the first event:** the bar creeps. When the first event arrives, `shown` is seeded from the creep's value so the bar never jumps back.
- **On attach:**
  - Set `target = 1`.
  - Hide the loader when `shown >= 0.995` or after 600 ms, whichever comes first.
  - Set an `attached` flag. After this, `ui.progress` ignores boot events.
- **Interior path:** set `shown = target = 0.15` and stop the rAF loop.

### Animation and reduced motion
- **Reveal:** the lines slide up from `translateY(105%)` inside an `overflow: hidden` wrapper, staggered. The card fades and rises in.
- **Drift:** an optional slow drift of under 4 s, only on the boot loader, with `will-change: transform`.
- **Reduced motion:** no reveal, no drift and no creep; the fill snaps to its value.

### Phones (≤699px)
- The hero sits at 22vh.
- The card is full width, with a bottom offset that respects the safe area.

## Compass
- **Placement:** in `.chrome`, decorative (`aria-hidden`).
  - Desktop: 3rem across, at `top 4.6rem; left 1.25rem`.
  - Phones: 2.5rem across, at `top 9.25rem; left .75rem`.
- **Pointer events:** use the selector `.chrome > .compass { pointer-events: none }`.
- **Visibility:** hidden while `body.interior` is set.
- **Graphics:** an inline SVG with a static ring and ticks, and a rose with an accent north needle and a dim south needle.
- **Heading:** computed per frame from `camera.matrixWorld` elements (`e`).
  - `h = atan2(-e[8], e[10])`.
  - When `hypot(e[8], e[10]) < 0.05`, use the fallback `atan2(e[4], -e[6])`.
  - Rotate with `setAttribute('transform', 'rotate(-h 24 24)')`, and only when the change exceeds 0.2°.
  - Skip the update while `app.isInterior()` is true.
- **Counter-rotation:** the N label counter-rotates so it stays upright.

## i18n
Add `'N'` to STRINGS, hi and mr.

## Housekeeping
- Fix the stale `body.presenting` rule to `body.present`.
- Fix the card width expression to `min(24rem, calc(100vw - 2rem))`.
