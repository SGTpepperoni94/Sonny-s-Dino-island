import type { AnchorId, BiomeId, ReservedFootprint, WorldAnchor } from '../types/game';

/**
 * 8 named spatial anchors across the ~400m diameter 6-biome island.
 * Facing yaw uses Three.js right-handed Y rotation where 0 faces +Z (South)
 * and Math.PI faces -Z (North / inland).
 */
export const WORLD_ANCHORS: Record<AnchorId, WorldAnchor> = {
  harborSpawn: {
    id: 'harborSpawn',
    biome: 'harbor',
    x: -6,
    z: 122,
    facingYaw: Math.PI - 0.14,
    label: 'Pirate Harbor',
  },
  ranchCenter: {
    id: 'ranchCenter',
    biome: 'ranch',
    x: 2,
    z: 82,
    facingYaw: Math.PI,
    label: 'Sunny Meadow',
  },
  jungleTrail: {
    id: 'jungleTrail',
    biome: 'jungle',
    x: -106,
    z: 32,
    facingYaw: Math.PI + 0.32,
    label: 'Whispering Fern Jungle',
  },
  ruinsTerrace: {
    id: 'ruinsTerrace',
    biome: 'ruins',
    x: -88,
    z: -84,
    facingYaw: 0.45,
    label: 'Ancient Dino Ruins',
  },
  volcanoSummit: {
    id: 'volcanoSummit',
    biome: 'volcano',
    x: 68,
    z: -56,
    facingYaw: Math.PI - 0.62,
    label: 'Smoking Volcano Ridge',
  },
  lagoonDock: {
    id: 'lagoonDock',
    biome: 'lagoon',
    x: 118,
    z: 26,
    facingYaw: Math.PI + 0.35,
    label: 'Crystal Waterfall Lagoon',
  },
  skullCaveMouth: {
    id: 'skullCaveMouth',
    biome: 'skullCave',
    x: 85.8,
    z: 118.6,
    facingYaw: Math.PI - 0.58,
    label: 'Skull Rock Cave',
  },
  skullCaveInterior: {
    id: 'skullCaveInterior',
    biome: 'skullCave',
    x: 95.6,
    z: 103.2,
    facingYaw: Math.PI - 0.58,
    label: 'Skull Cave Tunnel',
  },
};

export const BIOME_DEFAULT_ANCHOR: Record<Exclude<BiomeId, 'ocean'>, AnchorId> = {
  harbor: 'harborSpawn',
  ranch: 'ranchCenter',
  jungle: 'jungleTrail',
  ruins: 'ruinsTerrace',
  volcano: 'volcanoSummit',
  lagoon: 'lagoonDock',
  skullCave: 'skullCaveMouth',
};

export const INITIAL_RESERVED_FOOTPRINTS: ReservedFootprint[] = [
  // Pirate Harbor Beach Hub: Sonny spawn + clear flat sandy pad beside spawn for Pirate Bed Ship, Captain Seahawk & Artie
  { id: 'spawn-clear', x: -6, z: 122, radius: 11 },
  { id: 'harbor-family-hub', x: 8, z: 117, radius: 11 },
  // Clean sightline corridor along the ochre dirt path linking harborSpawn -> ranchCenter (~41m)
  { id: 'harbor-ranch-sightline', x: -2, z: 102, radius: 11 },
  // Sunny Meadow / Dino Ranch Hub: flat grassy sanctuary & Mum (Amy) welcome pad just up the dirt path
  { id: 'ranch-plateau', x: 2, z: 76, radius: 28 },
  { id: 'ranch-amy-hub', x: 2, z: 88, radius: 11 },
  // Landmarks & Biome Feature Pads
  { id: 'skull-cave-mouth', x: 91, z: 114, radius: 12 },
  { id: 'skull-cave-interior', x: 100, z: 103, radius: 15 },
  { id: 'waterfall-basin', x: 132, z: 8, radius: 20 },
  { id: 'volcano-crater', x: 96, z: -94, radius: 24 },
  { id: 'ruins-center-pad', x: -94, z: -88, radius: 16 },
];

export const ISLAND_WORLD_RADIUS = 205;
export const WATER_LEVEL = 0.0;
export const SHALLOW_WATER_FLOOR = -1.15;
