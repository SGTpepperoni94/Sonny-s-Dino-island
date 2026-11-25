import type { ScatterPlacement, StructurePlacement } from './ScatterLayout';
import type { TerrainQuery } from './TerrainQuery';
import { JUNGLE_ROAD_POINTS } from './terrainTrails';

export interface ContactShadowPlacement {
  x: number; y: number; z: number; nx: number; ny: number; nz: number; radius: number; darkness: number;
}
export interface MidgroundScatterResult {
  midgroundTrees: ScatterPlacement[]; overhangFerns: ScatterPlacement[]; rockOutcrops: ScatterPlacement[];
  extraPalms: ScatterPlacement[]; extraBarrels: ScatterPlacement[]; extraChests: ScatterPlacement[];
}

// Leaning coastal & jungle palms (x, z, scale, scaleY, leanX, leanZ)
const LEANING_PALMS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-23.5, 125.5, 1.06, 1.12, 0.24, 0.18], [-30.5, 126.5, 1.18, 1.24, 0.28, 0.22],
  [-41.0, 125.0, 1.12, 1.18, 0.22, 0.26], [24.5, 123.5, 1.08, 1.16, -0.26, 0.18],
  [31.5, 122.0, 1.22, 1.28, -0.28, 0.20], [41.5, 122.5, 1.10, 1.12, -0.22, 0.24],
  [-36.0, 88.0, 1.24, 1.26, 0.18, 0.12], [-46.0, 82.0, 1.16, 1.22, 0.22, -0.08],
  [37.0, 92.0, 1.22, 1.24, -0.20, 0.14], [44.0, 82.0, 1.18, 1.22, -0.18, -0.10],
  [34.0, 56.0, 1.14, 1.20, -0.16, 0.12], [-118.0, 26.0, 1.26, 1.28, 0.26, -0.10],
  [-92.0, 24.0, 1.22, 1.24, -0.24, -0.06], [-122.0, 8.0, 1.28, 1.30, 0.28, 0.08],
  [-96.0, 6.0, 1.18, 1.22, -0.24, 0.10], [-119.0, -10.0, 1.24, 1.26, 0.22, 0.14],
  [-88.0, -12.0, 1.16, 1.20, -0.22, 0.12], [-74.0, 44.0, 1.20, 1.22, -0.18, 0.16],
  [-62.0, 56.0, 1.14, 1.18, 0.18, 0.12],
];

// Subtle darker midground canopy tree lines (harbor flanks, far ranch backdrop, jungle ridges)
const CURATED_TREES: ReadonlyArray<readonly [number, number, number, number]> = [
  [-40, 95, 1.12, 0x24822c], [-49, 90, 1.24, 0x207628], [-58, 86, 1.30, 0x288c2f],
  [-36, 78, 1.16, 0x2c9230], [-46, 74, 1.26, 0x227b2a], [-56, 70, 1.22, 0x26862e],
  [44, 93, 1.14, 0x24822c], [52, 88, 1.24, 0x207628], [58, 82, 1.28, 0x288c2f],
  [44, 77, 1.18, 0x227b2a], [52, 72, 1.26, 0x2c9230], [60, 68, 1.20, 0x24822c],
  [-34, 44, 1.22, 0x24822c], [-22, 42, 1.16, 0x227a29], [-10, 41, 1.20, 0x288b2e],
  [2, 41, 1.14, 0x24822c], [32, 42, 1.24, 0x207628], [44, 44, 1.26, 0x288c2f],
  [56, 48, 1.22, 0x227b2a], [-44, 48, 1.26, 0x207628], [-86, 36, 1.26, 0x1f7327],
  [-80, 24, 1.32, 0x24802b], [-84, 10, 1.28, 0x1e6f25], [-82, -4, 1.26, 0x25832c],
  [-76, 16, 1.34, 0x207628], [-72, 32, 1.24, 0x288c2f], [-92, 44, 1.20, 0x227b2a],
  [-126, 16, 1.12, 0x227b2a], [-125, -2, 1.16, 0x1f7327], [-68, 52, 1.22, 0x227b2a],
  [-54, 54, 1.18, 0x26862e],
];

// Layered coastal, meadow & jungle embankment rock outcrops
const CURATED_OUTCROPS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-24.5, 128.5, 1.05, 0x9b8f7e], [-33.5, 130.0, 1.28, 0x8f8374], [-44.0, 128.5, 1.42, 0x887c6e],
  [25.5, 126.5, 1.08, 0x9c8f7d], [33.5, 124.5, 1.32, 0x8d8172], [44.0, 122.0, 1.44, 0x84786b],
  [-32.0, 100.0, 1.12, 0x918678], [-42.0, 86.0, 1.26, 0x897e70], [34.0, 100.0, 1.14, 0x918678],
  [44.0, 86.0, 1.22, 0x877c6f], [-16.0, 44.0, 1.18, 0x8c8276], [28.0, 44.0, 1.22, 0x8a8074],
  [-97.5, 31.0, 1.15, 0x7c7468], [-99.5, 18.0, 1.22, 0x787064], [-101.0, 4.0, 1.18, 0x80776b],
  [-94.5, -10.0, 1.24, 0x7a7266], [-115.5, 21.0, 1.08, 0x7c7468], [-119.5, 4.0, 1.14, 0x7a7266],
  [-86.0, 45.0, 1.20, 0x80776b], [-66.0, 56.0, 1.16, 0x847b6e],
];

const EXTRA_BARRELS: ReadonlyArray<readonly [number, number]> = [
  [-21.2, 127.8], [-20.1, 127.0], [22.8, 124.8], [24.0, 124.1], [32.0, 118.4],
];
const EXTRA_CHESTS: ReadonlyArray<readonly [number, number]> = [[-22.2, 128.6], [23.5, 125.6]];

function isClearOfStructs(x: number, z: number, structs: ReadonlyArray<StructurePlacement>, margin: number): boolean {
  for (let i = 0; i < structs.length; i++) {
    if (Math.hypot(x - structs[i].x, z - structs[i].z) < margin) return false;
  }
  return Math.hypot(x + 25.5, z - 134.5) >= 6.8 && Math.hypot(x - 126.5, z - 20.0) >= 6.4;
}

export function applyPalmLeanVariation(palms: ScatterPlacement[], rand: () => number): void {
  for (let i = 0; i < palms.length; i++) {
    const p = palms[i];
    if (p.leanX !== undefined) continue;
    const ang = rand() * Math.PI * 2;
    const mag = 0.08 + rand() * 0.16;
    p.leanX = Math.cos(ang) * mag;
    p.leanZ = Math.sin(ang) * mag;
    p.scaleY = 0.88 + rand() * 0.34;
  }
}

export function buildMidgroundScatter(
  terrain: TerrainQuery, structures: ReadonlyArray<StructurePlacement>, rand: () => number,
): MidgroundScatterResult {
  const extraPalms: ScatterPlacement[] = [];
  for (const [x, z, scale, scaleY, leanX, leanZ] of LEANING_PALMS) {
    const h = terrain.getTerrainHeight(x, z);
    if (h < 0.75 || h > 27 || terrain.getTrailDistance(x, z) < 5.0 || Math.hypot(x + 101, z - 43) < 9.0) continue;
    if (terrain.isFootprintReserved(x, z, 2.5) || !isClearOfStructs(x, z, structures, 7.2)) continue;
    extraPalms.push({ x, y: h - 0.18, z, rotY: rand() * Math.PI * 2, scale, scaleY, leanX, leanZ, tintShift: rand() * 2 - 1 });
  }

  const midgroundTrees: ScatterPlacement[] = [];
  for (const [x, z, scale, colorHex] of CURATED_TREES) {
    const h = terrain.getTerrainHeight(x, z);
    if (h < 1.6 || h > 28 || terrain.getTrailDistance(x, z) < 6.0 || Math.hypot(x + 101, z - 43) < 10.5) continue;
    if (terrain.isFootprintReserved(x, z, 2.8) || !isClearOfStructs(x, z, structures, 11.2)) continue;
    midgroundTrees.push({
      x, y: h - 0.32, z, rotY: rand() * Math.PI * 2, scale, scaleY: 0.92 + rand() * 0.26,
      leanX: (rand() - 0.5) * 0.09, leanZ: (rand() - 0.5) * 0.09, colorHex, tintShift: rand() * 2 - 1,
    });
  }
  for (let a = 0; midgroundTrees.length < 60 && a < 1600; a++) {
    const x = (rand() * 2 - 1) * 162, z = (rand() * 2 - 1) * 145;
    const h = terrain.getTerrainHeight(x, z);
    if (h < 3.0 || h > 25 || Math.hypot(x + 101, z - 43) < 12.0 || Math.hypot(x - 104, z - 97) < 36) continue;
    const b = terrain.getBiomeAt(x, z);
    if ((b !== 'jungle' && b !== 'ranch' && b !== 'harbor') || terrain.getTrailDistance(x, z) < 9.5) continue;
    if (terrain.isFootprintReserved(x, z, 3.0) || !isClearOfStructs(x, z, structures, 11.8) || terrain.getTerrainNormal(x, z).ny < 0.80) continue;
    midgroundTrees.push({
      x, y: h - 0.32, z, rotY: rand() * Math.PI * 2, scale: 0.94 + rand() * 0.4, scaleY: 0.9 + rand() * 0.28,
      leanX: (rand() - 0.5) * 0.08, leanZ: (rand() - 0.5) * 0.08, colorHex: b === 'jungle' ? 0x207628 : 0x288a2e, tintShift: rand() * 2 - 1,
    });
  }

  // Lush overhanging fern clusters lining BOTH embankments of Whispering Fern Jungle trail
  const overhangFerns: ScatterPlacement[] = [];
  for (let s = 2; s < JUNGLE_ROAD_POINTS.length - 1; s++) {
    const [ax, az] = JUNGLE_ROAD_POINTS[s], [bx, bz] = JUNGLE_ROAD_POINTS[s + 1];
    const dx = bx - ax, dz = bz - az, segLen = Math.hypot(dx, dz) || 1;
    const nx = -dz / segLen, nz = dx / segLen, steps = Math.max(3, Math.floor(segLen / 5.2));
    for (let k = 0; k < steps; k++) {
      const t = (k + 0.3 + rand() * 0.4) / steps, cx = ax + dx * t, cz = az + dz * t;
      for (const side of [-1, 1]) {
        const lat = (4.7 + rand() * 2.5) * side, fx = cx + nx * lat, fz = cz + nz * lat;
        const h = terrain.getTerrainHeight(fx, fz);
        if (h < 2.0 || h > 28 || terrain.getTrailDistance(fx, fz) < 4.2 || Math.hypot(fx + 101, fz - 43) < 7.2) continue;
        if (terrain.isFootprintReserved(fx, fz, 1.5) || !isClearOfStructs(fx, fz, structures, 4.8)) continue;
        const inward = -side * (0.14 + rand() * 0.16);
        overhangFerns.push({
          x: fx, y: h - 0.14, z: fz, rotY: rand() * Math.PI * 2, scale: 0.88 + rand() * 0.52,
          scaleY: 0.92 + rand() * 0.34, leanX: -nz * inward, leanZ: nx * inward,
          colorHex: rand() > 0.45 ? 0x268e23 : 0x38ab28, tintShift: rand() * 2 - 1,
        });
      }
    }
  }
  for (let a = 0; overhangFerns.length < 124 && a < 1800; a++) {
    const x = (rand() * 2 - 1) * 165, z = (rand() * 2 - 1) * 155, h = terrain.getTerrainHeight(x, z);
    if (h < 1.8 || h > 25) continue;
    const b = terrain.getBiomeAt(x, z), td = terrain.getTrailDistance(x, z);
    if ((b !== 'jungle' && b !== 'harbor' && b !== 'lagoon') || td < 4.5 || (b === 'jungle' && td > 22)) continue;
    if (terrain.isFootprintReserved(x, z, 1.6) || !isClearOfStructs(x, z, structures, 5.0) || terrain.getTerrainNormal(x, z).ny < 0.72) continue;
    overhangFerns.push({
      x, y: h - 0.14, z, rotY: rand() * Math.PI * 2, scale: 0.82 + rand() * 0.48, scaleY: 0.88 + rand() * 0.28,
      leanX: (rand() - 0.5) * 0.14, leanZ: (rand() - 0.5) * 0.14, colorHex: b === 'jungle' ? 0x299625 : 0x3cb42a, tintShift: rand() * 2 - 1,
    });
  }

  const rockOutcrops: ScatterPlacement[] = [];
  for (const [x, z, scale, colorHex] of CURATED_OUTCROPS) {
    const h = terrain.getTerrainHeight(x, z);
    if (h < -0.1 || h > 28 || terrain.getTrailDistance(x, z) < 4.8) continue;
    if (terrain.isFootprintReserved(x, z, 2.0) || !isClearOfStructs(x, z, structures, 5.8)) continue;
    rockOutcrops.push({ x, y: h - 0.34, z, rotY: rand() * Math.PI * 2, scale, scaleY: 0.85 + rand() * 0.32, colorHex, tintShift: rand() * 2 - 1 });
  }
  for (let a = 0; rockOutcrops.length < 28 && a < 1200; a++) {
    const x = (rand() * 2 - 1) * 172, z = (rand() * 2 - 1) * 162, h = terrain.getTerrainHeight(x, z);
    if (h < 1.2 || h > 26) continue;
    const b = terrain.getBiomeAt(x, z);
    if (b === 'volcano' || b === 'ocean' || b === 'skullCave' || terrain.getTrailDistance(x, z) < 6.2) continue;
    if (terrain.isFootprintReserved(x, z, 2.2) || !isClearOfStructs(x, z, structures, 6.8) || terrain.getTerrainNormal(x, z).ny < 0.72) continue;
    rockOutcrops.push({
      x, y: h - 0.34, z, rotY: rand() * Math.PI * 2, scale: 0.92 + rand() * 0.48,
      scaleY: 0.8 + rand() * 0.36, colorHex: b === 'jungle' ? 0x7c7468 : 0x8e8376, tintShift: rand() * 2 - 1,
    });
  }

  const extraBarrels = EXTRA_BARRELS
    .filter(([x, z]) => !terrain.isFootprintReserved(x, z, 1.0) && isClearOfStructs(x, z, structures, 4.0))
    .map(([x, z]) => ({ x, y: terrain.getTerrainHeight(x, z) - 0.04, z, rotY: rand() * Math.PI * 2, scale: 0.94 + rand() * 0.14, tintShift: rand() * 2 - 1 }));
  const extraChests = EXTRA_CHESTS
    .filter(([x, z]) => !terrain.isFootprintReserved(x, z, 1.0) && isClearOfStructs(x, z, structures, 4.0))
    .map(([x, z]) => ({ x, y: terrain.getTerrainHeight(x, z) - 0.04, z, rotY: rand() * Math.PI * 2, scale: 0.96, tintShift: rand() * 2 - 1 }));
  return { midgroundTrees, overhangFerns, rockOutcrops, extraPalms, extraBarrels, extraChests };
}

export function buildContactShadows(
  terrain: TerrainQuery,
  src: {
    structures: ReadonlyArray<StructurePlacement>; ruinsProps: ReadonlyArray<StructurePlacement>;
    palms: ReadonlyArray<ScatterPlacement>; midgroundTrees: ReadonlyArray<ScatterPlacement>;
    rocks: ReadonlyArray<ScatterPlacement>; rockOutcrops: ReadonlyArray<ScatterPlacement>;
    overhangFerns: ReadonlyArray<ScatterPlacement>; bushes: ReadonlyArray<ScatterPlacement>;
    barrels: ReadonlyArray<ScatterPlacement>; chests: ReadonlyArray<ScatterPlacement>;
  },
): ContactShadowPlacement[] {
  const shadows: ContactShadowPlacement[] = [];
  const push = (x: number, z: number, radius: number, darkness: number) => {
    const y = terrain.getTerrainHeight(x, z);
    if (y < 0.05) return;
    const n = terrain.getTerrainNormal(x, z);
    if (n.ny < 0.55) return;
    shadows.push({ x, y: y + 0.055, z, nx: n.nx, ny: n.ny, nz: n.nz, radius, darkness });
  };
  for (const s of src.structures) push(s.x, s.z, s.key === 'structure.sawmill' ? 6.4 : 5.5, 1.0);
  for (const r of src.ruinsProps) push(r.x, r.z, 3.5, 0.88);
  for (const p of src.palms) push(p.x, p.z, 2.2 * p.scale, 0.92);
  for (const t of src.midgroundTrees) push(t.x, t.z, 3.1 * t.scale, 0.96);
  for (const r of src.rocks) push(r.x, r.z, 2.08 * r.scale, 0.95);
  for (const o of src.rockOutcrops) push(o.x, o.z, 2.85 * o.scale, 0.98);
  for (const f of src.overhangFerns) push(f.x, f.z, 1.8 * f.scale, 0.86);
  for (let i = 0; i < src.bushes.length; i++) {
    const b = src.bushes[i];
    if (b.scale >= 0.82 || i % 2 === 0) push(b.x, b.z, 1.48 * b.scale, 0.82);
  }
  for (const b of src.barrels) push(b.x, b.z, 1.1 * b.scale, 0.9);
  for (const c of src.chests) push(c.x, c.z, 1.38 * c.scale, 0.94);
  return shadows;
}
