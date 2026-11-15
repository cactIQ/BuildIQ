# Credits and licences

Everything shipped with this viewer works offline. Third-party code and fonts are vendored with their licence files.

| Component | Version | Licence | Location | Source |
|---|---|---|---|---|
| three.js | 0.170.0 | MIT | `vendor/three/` (licence: `vendor/three/LICENSE`) | npm package `three` |
| Fraunces (serif; latin 300, 400, 400 italic) | 5.3.0 (Fontsource package) | SIL Open Font License 1.1 | `vendor/fonts/fraunces-latin-*.woff2` (licence: `vendor/fonts/Fraunces-OFL.txt`) | npm package `@fontsource/fraunces`; font copyright 2020 The Fraunces Project Authors |
| Inter (sans; latin 400, 500, 600) | 5.3.0 (Fontsource package) | SIL Open Font License 1.1 | `vendor/fonts/inter-latin-*.woff2` (licence: `vendor/fonts/Inter-OFL.txt`) | npm package `@fontsource/inter`; font copyright 2016 The Inter Project Authors |

Notes
- The fonts are unmodified woff2 subsets copied from the npm packages. Under the OFL they may be bundled and
  redistributed with this software; the licence files must travel with them.
- Devanagari text (hi / mr, hidden until reviewed) uses system fonts (Nirmala UI, Mangal, Kohinoor Devanagari).
  No Noto Devanagari font is vendored yet. If one is added, record it here (it is also OFL).

Original work (no third-party assets)
- All textures are generated procedurally at run time (`src/tex/`, `src/materials/*.js`): plaster, pavers,
  tiles, wood, lawn, clouds, lightmaps.
- The gym's framed abstract artwork, the "YOGA" wall graphic, the walnut door grooves and the perforated lamp
  pattern are original procedural drawings made from generic shapes. They are not traced from any image.
- Icons in the UI are simple original line drawings (inline SVG).
- The poster, Open Graph image and gallery stills (`assets/poster.jpg`, `assets/og-image.jpg`,
  `assets/views/*.jpg`) must be our own renders of this scene.

Before client use: a second qualified reviewer confirms this list (licences checked, no unlicensed assets).
