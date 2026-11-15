# WorldClaw: findings used in this project

**Source:** "WorldClaw: Agentic 3D Open-World Generation at Scale", arXiv:2608.05248v1 [cs.AI], submitted 5 Aug 2026.
Contributors (paper §8): Chunchao Guo, Yang Li (project leads), Jinpeng Li, Zilong Huang. Affiliation is not stated in the
paper (the project page is on tencent-hunyuan.github.io).

> Read via the arXiv HTML version through a summarising fetch. Quotes are near-verbatim. Check them against the PDF
> before quoting in anything client-facing. The paper reports **no quantitative metrics, ablations or user studies**
> (only qualitative figures), so everything below is a design pattern, not a measured benefit.

## 1. What the paper does (in its own terms)
Coarse-to-fine, multi-agent pipeline. Agents talk through **shared structured intermediate representations** (§2):
1. **Intent analysis + planning (§2.1).** One intent agent *only* normalises what the prompt states. A scene planning
   agent fills the gaps to a predefined schema. The plan is 𝒫 = (ℛ regions, 𝒞_terrain, 𝒞_object), plus shared
   global attributes: theme, visual style, material preferences, atmosphere (Eq. 3).
2. **Global terrain (§2.2).** Terrain spec 𝒫_terrain = (layout, assets, materials, θ numeric params) (Eq. 4) →
   colour-coded semantic layout map → asset prototypes → height field → scatter filtered by elevation, slope and normal →
   **render-based terrain refinement**.
3. **Regional objects (§2.3).** Per-region spec (role φ_r, object categories/counts/densities, spatial relations,
   appearance) (Eq. 7) → per-object record (mesh, appearance, placement transform) (Eq. 8) → scale calibration →
   grounding by contact ratio → **scene refinement** in Blender via MCP with a task queue of diagnostic renders.

## 2. Refinement loops: what the critics look for
- **Terrain (§2.2.3):** abrupt regional transitions, inconsistent landform scales, mismatched texture proportions,
  unnatural asset distributions, local rendering artefacts. Fixes are *localised parameter edits* (blend width, texture
  scale, density, transforms, lighting) that keep the layout and global organisation fixed.
- **Objects (§2.3.3):** pose, mesh quality, scale vs semantic category and region design.
- **Support (§2.3.3):** floating, excessive penetration, unstable support. Fixed by moving or partly embedding the object
  and flattening only the **local support patch**, never the global landform.
- **Scale (§2.3.2, Eq. 11):** iterate the scale until the projected size is within tolerance. The tolerance is
  **asymmetric**: it penalises oversized objects more.
- **Stopping:** "until no substantial issue is detected or a predefined iteration budget is reached." The budget
  values are **not stated** in the paper.
- Order: refine objects first, then terrain/support (§2.3.3).

## 3. Stated limitations (§5–6)
- Generated code is unstable: errors in **scale, numeric parameters, node connectivity**, so several
  render–inspect–refine rounds are needed. Complex node graphs get simplified.
- Cost and latency grow with object count. The full loop is "unnecessarily lengthy" for simpler scenes.
- Recovering part hierarchies and parametric structure is weak. The authors point to **code-native modelling** as future
  work, which is exactly what our hand-coded Three.js approach is.

## 4. How we apply it (tag: [P] from the paper, [A] our adaptation)
1. [P] **Two-pass planning.** Pass 1 records only what the references show (an "observed" field). Pass 2 fills the gaps and
   marks every value `inferred`. Explicit client facts always override inferences and reference renders.
2. [A] **`SPEC` mirrors Eq. 3/4/7:** `global` (style, palette, time of day), `site` (θ: metres, plot bounds, levels,
   floor height, setbacks), `layout` (regions with role, polygon, material), `regions[]` (objects, counts, relations),
   `buildings[]`, `cameras[]`. One source of truth; no magic numbers in builders.
3. [A] **Layout map:** the site plan is a list of 2D polygons in the SPEC (roads, drive, lawn, pool, deck, plots).
   Materials, scatter masks and ground height all read from it.
4. [P] **Coarse to fine:** site base → tower massing → facade kit → roofscape → amenities → scatter → lighting.
   Don't detail towers until the massing matches the references.
5. [P] **Prototype vs instance:** build each palm, car, lamp, window bay or ornament once, then place it with `InstancedMesh`.
6. [P] **Scatter filtering:** sample inside region polygons at a target density, with a jittered (non-grid) layout,
   min-spacing rejection and per-instance scale/rotation variation.
7. [A] **Scale calibration against known sizes:** floor-to-floor 3.0 m, door 2.1 m, car 4.5 m, palm 6–9 m. Tolerance
   is asymmetric, stricter on oversize (e.g. −10 % / +5 %).
8. [A] **Grounding pass in code:** for every placed object, raycast or check its bounding-box min-y against the support
   surface. Log `floating` (> 2 cm) or `buried` (> 5 cm) and fix locally.
9. [P] **Render–inspect–refine loop** from fixed diagnostic viewpoints: one per reference image (matched camera), plus
   aerial, street eye-level and a close-up of each hero element.
10. [P] **Diagnostic passes:** besides the beauty shot, render normals, depth and flat ID colours to expose z-fighting,
    flipped normals and floating objects.
11. [P] **Checklist critic** using the failure modes in §2 above, plus the architecture-fidelity items (floor count, bay
    rhythm, cornice bands, turret/pediment shape, colour).
12. [P] **Task queue with a budget:** each issue is a task that closes on a pass or after 3 rounds (our number; the paper
    gives none).
13. [P] **Edits are parameter changes, not rewrites.** Keep the plan fixed and save a checkpoint before each round.
14. [P] **Validate units and ranges in code; prefer simple PBR** (`MeshStandardMaterial`/`MeshPhysicalMaterial`) over
    elaborate shaders.
15. [P] **Everything stays an editable, named scene-graph node** (tower → floor band → bay; amenity → part) so sales can
    highlight units later.
16. [P] **Spend refinement on hero views** (front elevation, aerial, pool); background context gets one pass.
