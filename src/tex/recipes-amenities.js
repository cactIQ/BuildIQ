// Texture recipes owned by the amenities module. Same contract as recipes-base.js:
// (params) => { w, h, albedo, normal?, orm?, alpha?, emissive? } as RGBA8 Uint8ClampedArray, tiling, 1 UV unit per image.
// eslint-disable-next-line no-unused-vars
import { makeNoise, img, put, heightToNormal, packORM, rgb, mix, clamp01, smooth } from './noise.js';

export const recipes = {};
