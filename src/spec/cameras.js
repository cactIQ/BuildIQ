// Camera presets. fov = vertical degrees. shift = {horizonY} => level camera with lens shift (setViewOffset):
// horizonY is the horizon position as a fraction of frame height from the TOP. ref = internal reference id.
export const cameras = {
  // sun (optional): {azim, elev} art-directed sun for that curated view (azim degrees from north, clockwise).
  // Free orbit ('Explore') and user time-of-day changes keep it until another view is chosen.
  // hero (round 8): from the SW both towers stand side by side (no overlap in projection), the ornate south face and
  // the pool/clubhouse corner face the camera; evening sun from WSW rakes the visible faces. ~10 deg pitch.
  hero:      { label: 'Hero', pos: [-93, 42, 107], target: [-14, 18, -6], fov: 34, tod: 0.35, sun: { azim: 172, elev: 20 } },   // low sun from S, 45 deg off the camera: ornate fronts lit, flanks in shade (critic HERO-008)
  // ref A is a long-lens shot: camera well back across the road so gates and tower keep A's relative scale
  elevation: { label: 'Elevation', ref: 'A', pos: [3, 1.7, 112], target: [3, 1.7, 0], hfov: 52, shift: { horizonY: 0.95 }, aspect: 1160 / 794, tod: 0.0 },
  aerial:    { label: 'Aerial', ref: 'B', pos: [-88, 90, 135], target: [-10, 0, 0], fov: 33, aspect: 655 / 531, tod: 0.0 },
  // aerialN (round 8): WNW bearing, ~40% closer, so the far tower clears the near one (critic AERN-001)
  aerialN:   { label: 'Aerial North', ref: 'C', pos: [-130, 112, -70], target: [-10, 12, 0], fov: 35, aspect: 619 / 538, tod: 0.0, sun: { azim: 255, elev: 42 } },   // afternoon sun from the W lights the faces this view sees (ref C)
  pool:      { label: 'Pool', ref: 'D', pos: [-31, 3.1, 44.5], target: [-31, 3.1, 20], hfov: 88, shift: { horizonY: 0.56 }, aspect: 1160 / 638, tod: 0.0 },
  clubhouse: { label: 'Clubhouse', ref: 'E', pos: [-18.5, 1.4, 7.5], target: [-28.5, 1.4, 18.5], hfov: 65, shift: { horizonY: 0.66 }, aspect: 1160 / 653, tod: 0.0, sun: { azim: 75, elev: 72 } },   // high E sun: east face lit; hero-tower shadow (16 m) stops short of the clubhouse
  gym:       { label: 'Gym', ref: 'F', interior: true, pos: [0, 1.25, 4.6], target: [0, 1.25, -4.75], hfov: 78, shift: { horizonY: 0.505 }, aspect: 1160 / 633, tod: 0.0 },
  orbit:     { label: 'Explore', pos: [70, 55, 110], target: [-5, 12, 0], fov: 40 },
};
export const tour = ['hero', 'aerial', 'elevation', 'pool', 'clubhouse', 'aerialN', 'hero'];
export const orbitLimits = { minDistance: 12, maxDistance: 320, minPolar: 0.15, maxPolar: 1.48, minTargetY: 0.5 };
