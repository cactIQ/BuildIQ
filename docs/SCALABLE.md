# Scalable tactics

What carries over to the next property with little or no change. These are the parts to grow, so each new project
costs less than the last.

## Tactic 1: looks ("LUTs")
Named colour grades, set live in the browser, then shipped as data.

- **Data:** `src/spec/looks.js`. Six presets (Natural, Vivid, Bright & airy, Warm, Crisp & cool, Soft) and a
  `default`. The looks are scene-independent, so a new project copies the file as is.
- **Engine:** `src/grade.js`.
  - Four numbers: exposure, contrast, vibrance, warmth. They are applied after the base grade in the tone-mapping
    chunk, and by the sky shader itself.
  - One shared uniform array reaches every material, so changing a look never recompiles a shader and adds no
    program and no extra pass.
- **Tool:** `src/look-panel.js`. It opens with `?tune=1` (Look button) or the **L** key.
  - Sliders, preset chips, and "Save…": saved looks stay in this browser.
  - "Copy template" gives one line to paste into `looks.js`.
  - Double-click a slider to reset it.
- **Use:** `?look=<id>` previews a preset by URL. Set `default` in `looks.js` to ship one to everyone.
- **To make one of your own looks the default for everyone:** tune it, click Copy template, then paste the line
  into `presets` in `looks.js` and set `default` to its id.
- **Next, if wanted:**
  - looks per time of day (a `byTime` map keyed by day, golden, dusk and night);
  - an embed API message `setLook`;
  - true 3D `.cube` LUT import. This needs a 3D texture sampled in the tone-mapping chunk: possible, but it adds a
    sampler to every program, so it should be measured first.

## Tactic 2: reusable 3D and UI assets
Built once, reused per project. Each one is driven by the spec, not by this site.

| Asset | Where | Inputs it needs from a new project |
|---|---|---|
| Low-poly trees, palms and far groves | `src/vegetation.js` (`build(ctx)`) | Planting zones and counts in `src/spec/site.js` |
| Compass | `src/ui.js` (the `compass` block) | None: it reads the camera heading every frame |
| Day-to-night time ruler | `src/ui.js` (`buildTimeRuler`) | The keyframe positions (`TOD`) and clock times (`MINS`) |
| Sky, sun, moon and stars | `src/sky.js` plus the `timeOfDay` keyframes in `src/spec/global.js` | The keyframe colours |
| Frosted-glass UI and liquid buttons | `src/frost.js`, `styles.css` (`.glass`, `--g-*`, `--lq-*`) | None |
| Look panel | `src/look-panel.js` | `SPEC.looks` |
| Portrait framing per view | `portrait: { fit, horizonY }` on a preset in `src/spec/cameras.js` | Per view, when needed |

**Suggested next step:** move the compass and the time ruler out of `ui.js` into their own modules
(`src/ui/compass.js`, `src/ui/time-ruler.js`), the way the look panel already is. Then each asset is one import plus
spec data, and the set can become a starter kit for the next project.

### v1.15 addition: sample-flat kit
| Asset | Where | Inputs it needs from a new project |
|---|---|---|
| Sample flat (dollhouse + walk) | `src/interior-flat.js`, `src/materials/flat.js` (`FLAT`) | The plan (`walls`, `zones`) and furniture positions |
| Walk controller | `src/walk.js` | Collider rectangles and bounds from the interior module |
| White marble floor | `src/tex/recipes-flat.js` (`flatMarble`) | None (slab size, grout and colours are parameters) |
| Polished-floor reflection | end of `src/interior-flat.js` (mirrored group) | None |

Next step for this kit: move the furniture pieces (sofa, bed, dining set, vanity, kitchen run) into a small
`src/furniture.js` library so a new floor plan only lists positions.
### v1.16 addition: cinematic kit
| Asset | Where | To reuse |
|---|---|---|
| Continuous tour (drift + velocity hand-off, push-in for level shots) | `src/core.js` tour block, `TOUR` | List views in `SPEC.tour` |
| Time-lapse tour | `SPEC.tourTime` | One time of day per stop |
| Fade-through-black cut | `.tour-veil` + `tourCut` event | Reusable for interior scene cuts |
| Camera motion blur | `src/motion-blur.js` | `createMotionBlur({ THREE, renderer })`, call `render(scene, camera, dt)` |
