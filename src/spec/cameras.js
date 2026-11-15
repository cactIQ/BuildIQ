// Camera presets. fov = vertical degrees. shift = {horizonY} => level camera with lens shift (setViewOffset):
// horizonY is the horizon position as a fraction of frame height from the TOP. ref = internal reference id.
export const cameras = {
  hero:      { label: 'Hero', pos: [62, 46, 88], target: [12, 20, 18], fov: 38, tod: 0.35 },
  elevation: { label: 'Elevation', ref: 'A', pos: [5.5, 1.7, 65], target: [5.5, 1.7, 0], hfov: 96, shift: { horizonY: 0.95 }, aspect: 1160 / 794, tod: 0.0 },
  aerial:    { label: 'Aerial', ref: 'B', pos: [-88, 90, 135], target: [-10, 0, 0], fov: 33, aspect: 655 / 531, tod: 0.0 },
  aerialN:   { label: 'Aerial North', ref: 'C', pos: [-122, 115, -191], target: [-22, 15, -18], fov: 35, aspect: 619 / 538, tod: 0.0 },
  pool:      { label: 'Pool', ref: 'D', pos: [-31, 2.4, 44.5], target: [-31, 2.4, 20], hfov: 75, shift: { horizonY: 0.62 }, aspect: 1160 / 638, tod: 0.0 },
  clubhouse: { label: 'Clubhouse', ref: 'E', pos: [-18.5, 1.4, 7.5], target: [-28.5, 1.4, 18.5], hfov: 65, shift: { horizonY: 0.55 }, aspect: 1160 / 653, tod: 0.0 },
  gym:       { label: 'Gym', ref: 'F', interior: true, pos: [0, 1.25, 4.6], target: [0, 1.25, -4.75], hfov: 78, shift: { horizonY: 0.505 }, aspect: 1160 / 633, tod: 0.0 },
  orbit:     { label: 'Explore', pos: [70, 55, 110], target: [-5, 12, 0], fov: 40 },
};
export const tour = ['hero', 'aerial', 'elevation', 'pool', 'clubhouse', 'aerialN', 'hero'];
export const orbitLimits = { minDistance: 12, maxDistance: 320, minPolar: 0.15, maxPolar: 1.48, minTargetY: 0.5 };
