// SPEC: single source of truth. Pure data: no THREE, no DOM (loadable by node --test).
import { brand } from './brand.js';
import { global } from './global.js';
import { site } from './site.js';
import { towers } from './towers.js';
import { cameras, tour, orbitLimits } from './cameras.js';
import { quality, embed, i18n } from './quality.js';

export const SPEC = { brand, global, site, towers, cameras, tour, orbitLimits, quality, embed, i18n, facts: [] };
export default SPEC;
