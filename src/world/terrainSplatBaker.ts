import { PALETTE } from '../config/palette';
import {
  clamp,
  computeTerrainHeight,
  getCaveCobbleWeight,
  getJungleBlend,
  getLavaGlowWeight,
  getRuinsBlend,
  getTrailDistance,
  getVolcanoBlend,
  getVolcanoTrailSample,
  noise2D,
  smoothstep,
} from './terrainMath';

type Rgb = readonly [number, number, number];
export const TERRAIN_SIZE = 440;
export const SPLAT_SIZE = 1024;
const GRID = 321;
const STRIDE = 9;
export const RUINS_VORONOI_SCALE = 0.72;
const rgb = (h: number): Rgb => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const fract = (v: number): number => v - Math.floor(v);

const C = {
  sand: rgb(PALETTE.sandGolden), sandWet: rgb(PALETTE.sandWet), dirt: rgb(PALETTE.dirtOchre),
  dirtEdge: rgb(0xb88f5e), dirtJungleEdge: rgb(0x8a8244), embank: rgb(PALETTE.dirtEmbankment),
  meadow: rgb(PALETTE.meadowLime), meadowHi: rgb(PALETTE.meadowBright),
  jungle: rgb(PALETTE.jungleEmerald), jungleDeep: rgb(PALETTE.jungleDeep), cliff: rgb(PALETTE.cliffStone),
  cliffWarm: rgb(PALETTE.cliffWarm), ruinsStone: rgb(0xa89f8e), ruinsOchre: rgb(0xc2a87c),
  ruinsDark: rgb(0x847c6e), ruinsMoss: rgb(PALETTE.ruinsMoss), volcDark: rgb(PALETTE.volcanoRockDark),
  volcMid: rgb(PALETTE.volcanoRockMid), volcAsh: rgb(PALETTE.volcanoAsh),
  volcTrail: rgb(PALETTE.volcanoTrail), volcTrailEdge: rgb(0x8b6258),
  lavaEdge: rgb(PALETTE.lavaEdge), lavaGlow: rgb(PALETTE.lavaGlow), cobble: rgb(PALETTE.cobbleWarm),
};

export interface RuinsVoronoiSample { hasSlab: boolean; edgeDist: number; tone: number; warmth: number; }

/** Pure algebraic 2D hash matching GLSL `tHash22` in MaterialLibrary.ts bit-for-bit. */
export function hash22(ix: number, iz: number): [number, number] {
  let px = fract(ix * 0.1031), py = fract(iz * 0.1030), pz = fract(ix * 0.0973);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d; py += d; pz += d;
  return [fract((px + py) * pz), fract((px + pz) * py)];
}

/** Evaluates organic polygonal Voronoi flagstones for Ancient Dino Ruins terraces. */
export function sampleRuinsVoronoi(wx: number, wz: number): RuinsVoronoiSample {
  const sx = wx * RUINS_VORONOI_SCALE + Math.sin(wz * 0.78) * 0.14;
  const sz = wz * RUINS_VORONOI_SCALE + Math.cos(wx * 0.74) * 0.14;
  const ix = Math.floor(sx), iz = Math.floor(sz);
  let d1 = 9, d2 = 9, bestCx = ix, bestCz = iz, bestHx = 0, bestHz = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cz = iz + dz;
      const [hx, hz] = hash22(cx, cz);
      const dist = Math.hypot(cx + 0.15 + hx * 0.70 - sx, cz + 0.15 + hz * 0.70 - sz);
      if (dist < d1) { d2 = d1; d1 = dist; bestCx = cx; bestCz = cz; bestHx = hx; bestHz = hz; }
      else if (dist < d2) { d2 = dist; }
    }
  }
  const wcx = (bestCx + 0.5) / RUINS_VORONOI_SCALE, wcz = (bestCz + 0.5) / RUINS_VORONOI_SCALE;
  const cl = 0.5 + 0.5 * Math.sin(wcx * 0.19 + 0.45 + Math.cos(wcz * 0.17 - 0.3) * 1.45)
    * Math.cos(wcz * 0.18 - 0.35 - Math.sin(wcx * 0.16) * 1.35);
  const threshold = 0.90 + (0.10 - 0.90) * smoothstep(0.22, 0.68, cl);
  return { hasSlab: fract(bestHx * 3.7 + bestHz * 5.3) >= threshold, edgeDist: d2 - d1, tone: bestHx, warmth: bestHz };
}

function sampleCoarseField(terrainSize: number): Float32Array {
  const f = new Float32Array(GRID * GRID * STRIDE);
  const half = terrainSize * 0.5;
  const step = terrainSize / (GRID - 1);
  for (let gz = 0; gz < GRID; gz++) {
    const wz = -half + gz * step;
    for (let gx = 0; gx < GRID; gx++) {
      const wx = -half + gx * step;
      const b = (gz * GRID + gx) * STRIDE;
      f[b] = computeTerrainHeight(wx, wz);
      f[b + 2] = getTrailDistance(wx, wz);
      f[b + 3] = getVolcanoTrailSample(wx, wz).dist;
      f[b + 4] = getVolcanoBlend(wx, wz);
      f[b + 5] = getRuinsBlend(wx, wz);
      f[b + 6] = getJungleBlend(wx, wz);
      f[b + 7] = getLavaGlowWeight(wx, wz);
      f[b + 8] = getCaveCobbleWeight(wx, wz);
    }
  }
  const twoStep = step * 2;
  for (let gz = 0; gz < GRID; gz++) {
    const z0 = Math.max(0, gz - 1), z1 = Math.min(GRID - 1, gz + 1);
    for (let gx = 0; gx < GRID; gx++) {
      const x0 = Math.max(0, gx - 1), x1 = Math.min(GRID - 1, gx + 1);
      const hL = f[(gz * GRID + x0) * STRIDE], hR = f[(gz * GRID + x1) * STRIDE];
      const hD = f[(z0 * GRID + gx) * STRIDE], hU = f[(z1 * GRID + gx) * STRIDE];
      f[(gz * GRID + gx) * STRIDE + 1] = twoStep / (Math.hypot(hL - hR, twoStep, hD - hU) || 1);
    }
  }
  return f;
}

/**
 * Bakes a 1024x1024 world-space RGBA sRGB splatmap (alpha = 255 - lavaEmissive)
 * with crisp trail/beach/cliff borders and organic Voronoi mossy Ruins flagstones.
 */
export function bakeTerrainSplatRgba(splatSize = SPLAT_SIZE, terrainSize = TERRAIN_SIZE): Uint8Array {
  const f = sampleCoarseField(terrainSize);
  const data = new Uint8Array(splatSize * splatSize * 4);
  const gScale = (GRID - 1) / splatSize;

  for (let py = 0; py < splatSize; py++) {
    const fy = (py + 0.5) * gScale;
    const gy0 = Math.min(GRID - 2, Math.floor(fy));
    const ty = fy - gy0;
    const wz = ((py + 0.5) / splatSize - 0.5) * terrainSize;

    for (let px = 0; px < splatSize; px++) {
      const fx = (px + 0.5) * gScale;
      const gx0 = Math.min(GRID - 2, Math.floor(fx));
      const tx = fx - gx0;
      const wx = ((px + 0.5) / splatSize - 0.5) * terrainSize;

      const i00 = (gy0 * GRID + gx0) * STRIDE, i10 = i00 + STRIDE;
      const i01 = i00 + GRID * STRIDE, i11 = i01 + STRIDE;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const sample = (o: number) => f[i00 + o] * w00 + f[i10 + o] * w10 + f[i01 + o] * w01 + f[i11 + o] * w11;

      const h = sample(0), ny = sample(1), trailD = sample(2), vTrailD = sample(3);
      const volcW = sample(4), ruinsW = sample(5), jungleW = sample(6), lavaW = sample(7), cobbleW = sample(8);
      const macroN = noise2D(wx * 0.08, wz * 0.08);
      const fineN = noise2D(wx * 0.36, wz * 0.36);
      const crispN = noise2D(wx * 0.96 + 3.1, wz * 0.96 - 2.4);
      const edgeN = (fineN - 0.5) * 0.64 + (crispN - 0.5) * 0.48;

      // 1. Meadow, Fern Jungle & Mossy Ruins + Organic Voronoi Flagstones
      let r = C.meadow[0] + (C.meadowHi[0] - C.meadow[0]) * macroN * 0.65;
      let g = C.meadow[1] + (C.meadowHi[1] - C.meadow[1]) * macroN * 0.65;
      let b = C.meadow[2] + (C.meadowHi[2] - C.meadow[2]) * macroN * 0.65;

      if (jungleW > 0.005) {
        const jm = macroN * 0.55;
        r += (C.jungle[0] + (C.jungleDeep[0] - C.jungle[0]) * jm - r) * jungleW;
        g += (C.jungle[1] + (C.jungleDeep[1] - C.jungle[1]) * jm - g) * jungleW;
        b += (C.jungle[2] + (C.jungleDeep[2] - C.jungle[2]) * jm - b) * jungleW;
      }
      if (ruinsW > 0.005) {
        const rm = clamp(macroN * 0.45 + (fineN - 0.5) * 0.25, 0, 1);
        r += (C.ruinsMoss[0] + (C.meadowHi[0] - C.ruinsMoss[0]) * rm - r) * ruinsW;
        g += (C.ruinsMoss[1] + (C.meadowHi[1] - C.ruinsMoss[1]) * rm - g) * ruinsW;
        b += (C.ruinsMoss[2] + (C.meadowHi[2] - C.ruinsMoss[2]) * rm - b) * ruinsW;
        const flatW = ruinsW * smoothstep(0.84, 0.90, ny);
        if (flatW > 0.02) {
          const vor = sampleRuinsVoronoi(wx, wz);
          if (vor.hasSlab) {
            const slabW = smoothstep(0.06, 0.125, vor.edgeDist) * flatW;
            const rim = 1 - (smoothstep(0.045, 0.09, vor.edgeDist) - smoothstep(0.09, 0.17, vor.edgeDist)) * 0.18;
            const sr = (C.ruinsDark[0] + (C.ruinsStone[0] - C.ruinsDark[0]) * vor.tone + (C.ruinsOchre[0] - C.ruinsStone[0]) * vor.warmth * 0.65) * rim;
            const sg = (C.ruinsDark[1] + (C.ruinsStone[1] - C.ruinsDark[1]) * vor.tone + (C.ruinsOchre[1] - C.ruinsStone[1]) * vor.warmth * 0.65) * rim;
            const sb = (C.ruinsDark[2] + (C.ruinsStone[2] - C.ruinsDark[2]) * vor.tone + (C.ruinsOchre[2] - C.ruinsStone[2]) * vor.warmth * 0.65) * rim;
            r += (sr - r) * slabW; g += (sg - g) * slabW; b += (sb - b) * slabW;
          }
        }
      }

      // 2. Crisp organic golden beach & wet shoreline sand (tight band prevents shallow-slope smear)
      const sandW = clamp(
        Math.max((1 - smoothstep(0.0, 0.65, h + edgeN * 0.18)) * 0.96, (1 - smoothstep(1.94, 2.08, h + edgeN * 0.22)) * smoothstep(0.76, 0.83, ny)) * (1 - volcW * 0.92),
        0, 1,
      );
      if (sandW > 0.005) {
        const wet = (1 - smoothstep(-0.1, 0.95, h)) * 0.55;
        r += (C.sand[0] + (C.sandWet[0] - C.sand[0]) * wet - r) * sandW; g += (C.sand[1] + (C.sandWet[1] - C.sand[1]) * wet - g) * sandW; b += (C.sand[2] + (C.sandWet[2] - C.sand[2]) * wet - b) * sandW;
      }

      // 3. Crisp rocky cliffs & inland Fern Jungle earthen road embankments
      const cliffW = (1 - smoothstep(0.76, 0.805, ny + edgeN * 0.032)) * smoothstep(0.2, 0.75, h);
      const inlandRoad = smoothstep(104, 86, wz) * (1 - smoothstep(4.2, 12.0, trailD)) * (1 - ruinsW * 0.85) * (1 - volcW);
      const embW = (1 - smoothstep(0.76, 0.835, ny + edgeN * 0.028)) * inlandRoad * smoothstep(3.2, 4.2, h) * 0.92;
      if (cliffW > 0.005) {
        const sm = clamp(ruinsW * 0.85 + smoothstep(95, 138, wx) * 0.5, 0, 1);
        r += (C.cliffWarm[0] + (C.cliff[0] - C.cliffWarm[0]) * sm - r) * cliffW; g += (C.cliffWarm[1] + (C.cliff[1] - C.cliffWarm[1]) * sm - g) * cliffW; b += (C.cliffWarm[2] + (C.cliff[2] - C.cliffWarm[2]) * sm - b) * cliffW;
      }
      if (embW > 0.005) {
        const em = fineN * 0.35;
        r += (C.embank[0] + (C.dirt[0] - C.embank[0]) * em - r) * embW; g += (C.embank[1] + (C.dirt[1] - C.embank[1]) * em - g) * embW; b += (C.embank[2] + (C.dirt[2] - C.embank[2]) * em - b) * embW;
      }

      // 4. Organic feathered dirt trails (scalloped dusty/cooler verges -> worn warm center) & Skull Cave cobbles
      const trailEdgeN = (macroN - 0.5) * 1.25 + (fineN - 0.5) * 1.10 + (crispN - 0.5) * 0.68;
      const trailDetailN = (fineN - 0.5) * 0.72 + (crispN - 0.5) * 0.46;
      const shoulderW = (1 - smoothstep(2.05, 3.12, trailD + trailEdgeN)) * smoothstep(0.70, 0.80, ny) * smoothstep(1.90, 2.65, h + edgeN * 0.24) * (1 - volcW * 0.88);
      if (shoulderW > 0.005) {
        const coreW = (1 - smoothstep(0.95, 2.15, trailD + trailDetailN)) * shoulderW;
        const bf = (1 - smoothstep(2.0, 3.0, h)) * 0.52;
        const mt = clamp(jungleW * 0.65 + ruinsW * 0.26, 0, 0.72);
        const wear = 0.90 + fineN * 0.11 + crispN * 0.10;
        const vergeBreak = smoothstep(0.16, 0.74, shoulderW + (crispN - 0.48) * 0.42 * (1 - coreW));
        const er = (C.dirtEdge[0] + (C.dirtJungleEdge[0] - C.dirtEdge[0]) * mt) * (0.94 + crispN * 0.12);
        const eg = (C.dirtEdge[1] + (C.dirtJungleEdge[1] - C.dirtEdge[1]) * mt) * (0.94 + crispN * 0.12);
        const eb = (C.dirtEdge[2] + (C.dirtJungleEdge[2] - C.dirtEdge[2]) * mt) * (0.94 + crispN * 0.12);
        const cr = (C.dirt[0] + (C.sand[0] - C.dirt[0]) * bf) * wear;
        const cg = (C.dirt[1] + (C.sand[1] - C.dirt[1]) * bf) * wear;
        const cb = (C.dirt[2] + (C.sand[2] - C.dirt[2]) * bf) * wear;
        r += (er + (cr - er) * coreW - r) * vergeBreak; g += (eg + (cg - eg) * coreW - g) * vergeBreak; b += (eb + (cb - eb) * coreW - b) * vergeBreak;
      }
      if (cobbleW > 0.005) {
        const ct = 0.92 + crispN * 0.14;
        r += (C.cobble[0] * ct - r) * cobbleW; g += (C.cobble[1] * ct - g) * cobbleW; b += (C.cobble[2] * ct - b) * cobbleW;
      }

      // 5. Smoking Volcano basalt, scalloped terracotta/ash ridge trail & subtle canyon lava bounce
      let lavaEmissive = 0;
      if (volcW > 0.005) {
        const rm = clamp(smoothstep(0.42, 0.88, ny) * 0.72 + macroN * 0.28, 0, 1);
        const ash = smoothstep(42, 72, h) * smoothstep(0.68, 0.92, ny) * 0.28;
        let vr = C.volcDark[0] + (C.volcMid[0] - C.volcDark[0]) * rm + (C.volcAsh[0] - C.volcMid[0]) * ash;
        let vg = C.volcDark[1] + (C.volcMid[1] - C.volcDark[1]) * rm + (C.volcAsh[1] - C.volcMid[1]) * ash;
        let vb = C.volcDark[2] + (C.volcMid[2] - C.volcDark[2]) * rm + (C.volcAsh[2] - C.volcMid[2]) * ash;
        const vShoulderW = (1 - smoothstep(2.80, 4.15, vTrailD + trailEdgeN * 1.18)) * smoothstep(0.65, 0.78, ny) * (1 - smoothstep(0.50, 0.78, lavaW));
        if (vShoulderW > 0.005) {
          const vCoreW = (1 - smoothstep(1.35, 2.85, vTrailD + trailDetailN * 1.05)) * vShoulderW;
          const vWear = 0.89 + fineN * 0.12 + crispN * 0.12, vEm = 0.86 + macroN * 0.18 + crispN * 0.10;
          const vFe = smoothstep(0.14, 0.72, vShoulderW + (crispN - 0.5) * 0.44 * (1 - vCoreW));
          const vcr = (C.volcTrail[0] + (C.dirt[0] - C.volcTrail[0]) * fineN * 0.30) * vWear;
          const vcg = (C.volcTrail[1] + (C.dirt[1] - C.volcTrail[1]) * fineN * 0.30) * vWear;
          const vcb = (C.volcTrail[2] + (C.dirt[2] - C.volcTrail[2]) * fineN * 0.30) * vWear;
          vr += (C.volcTrailEdge[0] * vEm + (vcr - C.volcTrailEdge[0] * vEm) * vCoreW - vr) * vFe;
          vg += (C.volcTrailEdge[1] * vEm + (vcg - C.volcTrailEdge[1] * vEm) * vCoreW - vg) * vFe;
          vb += (C.volcTrailEdge[2] * vEm + (vcb - C.volcTrailEdge[2] * vEm) * vCoreW - vb) * vFe;
        }
        if (lavaW > 0.36) {
          const wg = smoothstep(0.42, 0.84, lavaW) * 0.88;
          const fh = smoothstep(0.74, 0.96, lavaW) * 0.85;
          vr += (C.lavaEdge[0] - vr) * wg + (C.lavaGlow[0] - C.lavaEdge[0]) * fh;
          vg += (C.lavaEdge[1] - vg) * wg + (C.lavaGlow[1] - C.lavaEdge[1]) * fh;
          vb += (C.lavaEdge[2] - vb) * wg + (C.lavaGlow[2] - C.lavaEdge[2]) * fh;
          lavaEmissive = smoothstep(0.46, 0.95, lavaW) * volcW;
        }
        r += (vr - r) * volcW; g += (vg - g) * volcW; b += (vb - b) * volcW;
      }

      const out = (py * splatSize + px) * 4;
      data[out] = clamp(Math.round(r), 0, 255); data[out + 1] = clamp(Math.round(g), 0, 255);
      data[out + 2] = clamp(Math.round(b), 0, 255); data[out + 3] = clamp(255 - Math.round(lavaEmissive * 255), 0, 255);
    }
  }
  return data;
}
