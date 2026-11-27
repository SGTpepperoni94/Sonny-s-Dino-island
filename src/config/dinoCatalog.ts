import type { BiomeId, DinoActionName, DinoSpecies } from '../types/game';

/** Immutable pinned jsDelivr CDN base URL for quaternius-dinosaur-kit@v1.0.0 (CC0 1.0). */
export const DINO_KIT_BASE_URL =
  'https://cdn.jsdelivr.net/gh/SGTpepperoni94/quaternius-dinosaur-kit@v1.0.0/';
export const DINO_KIT_MANIFEST_URL = `${DINO_KIT_BASE_URL}manifest.json`;

export const DINO_SPECIES_ORDER: readonly DinoSpecies[] = [
  'TRex',
  'Triceratops',
  'Stegosaurus',
  'Velociraptor',
  'Apatosaurus',
  'Parasaurolophus',
];

export const DINO_ALL_ACTIONS: readonly DinoActionName[] = [
  'Idle',
  'Walk',
  'Run',
  'Attack',
  'Death',
  'Jump',
];

export const DINO_SHOWCASE_ACTIONS: readonly DinoActionName[] = ['Idle', 'Walk', 'Run'];

export interface DinoSpeciesSpec {
  readonly species: DinoSpecies;
  readonly targetHeightMeters: number;
  readonly nativeHeightFallback: number;
  readonly shadowRadiusX: number;
  readonly shadowRadiusZ: number;
  readonly boundingRadius: number;
  readonly clipNames: Readonly<Record<DinoActionName, string>>;
}

function buildClipMap(species: DinoSpecies): Readonly<Record<DinoActionName, string>> {
  return {
    Idle: `${species}_Idle`,
    Walk: `${species}_Walk`,
    Run: `${species}_Run`,
    Attack: `${species}_Attack`,
    Death: `${species}_Death`,
    Jump: `${species}_Jump`,
  };
}

export const DINO_SPECIES_SPECS: Readonly<Record<DinoSpecies, DinoSpeciesSpec>> = {
  TRex: {
    species: 'TRex',
    targetHeightMeters: 5.2,
    nativeHeightFallback: 15.225,
    shadowRadiusX: 2.1,
    shadowRadiusZ: 3.8,
    boundingRadius: 7.5,
    clipNames: buildClipMap('TRex'),
  },
  Apatosaurus: {
    species: 'Apatosaurus',
    targetHeightMeters: 4.8,
    nativeHeightFallback: 11.678,
    shadowRadiusX: 2.2,
    shadowRadiusZ: 4.8,
    boundingRadius: 12.5,
    clipNames: buildClipMap('Apatosaurus'),
  },
  Stegosaurus: {
    species: 'Stegosaurus',
    targetHeightMeters: 3.6,
    nativeHeightFallback: 10.616,
    shadowRadiusX: 1.9,
    shadowRadiusZ: 3.6,
    boundingRadius: 6.0,
    clipNames: buildClipMap('Stegosaurus'),
  },
  Triceratops: {
    species: 'Triceratops',
    targetHeightMeters: 3.4,
    nativeHeightFallback: 9.433,
    shadowRadiusX: 2.0,
    shadowRadiusZ: 3.4,
    boundingRadius: 5.5,
    clipNames: buildClipMap('Triceratops'),
  },
  Parasaurolophus: {
    species: 'Parasaurolophus',
    targetHeightMeters: 3.2,
    nativeHeightFallback: 5.979,
    shadowRadiusX: 1.5,
    shadowRadiusZ: 2.9,
    boundingRadius: 5.0,
    clipNames: buildClipMap('Parasaurolophus'),
  },
  Velociraptor: {
    species: 'Velociraptor',
    targetHeightMeters: 2.1,
    nativeHeightFallback: 5.514,
    shadowRadiusX: 1.15,
    shadowRadiusZ: 2.2,
    boundingRadius: 4.0,
    clipNames: buildClipMap('Velociraptor'),
  },
};

export interface DinoSpawnDef {
  readonly id: string;
  readonly species: DinoSpecies;
  readonly biome: BiomeId;
  readonly x: number;
  readonly z: number;
  readonly rotY: number;
  readonly clearance: number;
  readonly initialAction: DinoActionName;
  readonly phaseOffset: number;
  readonly timeScale: number;
}

/**
 * Deterministic Phase 2B hero showcase spawns: 9 grounded dinosaurs across all 6 biomes
 * representing every species, verified walkable, non-lava, and strictly outside reserved hubs.
 */
export const DINO_SHOWCASE_SPAWNS: readonly DinoSpawnDef[] = [
  // Pirate Harbor / Meadow Fringes (visible in harbor & title presets)
  {
    id: 'harbor-para',
    species: 'Parasaurolophus',
    biome: 'harbor',
    x: -17,
    z: 109,
    rotY: 1.08,
    clearance: 2.0,
    initialAction: 'Idle',
    phaseOffset: 0.0,
    timeScale: 1.0,
  },
  {
    id: 'harbor-trike',
    species: 'Triceratops',
    biome: 'harbor',
    x: 15,
    z: 104,
    rotY: -1.35,
    clearance: 2.5,
    initialAction: 'Idle',
    phaseOffset: 0.72,
    timeScale: 0.95,
  },
  // Whispering Fern Jungle (unobstructed flat sunlit grassy clearings framing both sides of the ochre footpath)
  {
    id: 'jungle-raptor',
    species: 'Velociraptor',
    biome: 'jungle',
    x: -112,
    z: 34,
    rotY: 1.25,
    clearance: 2.0,
    initialAction: 'Idle',
    phaseOffset: 1.35,
    timeScale: 1.04,
  },
  {
    id: 'jungle-trike',
    species: 'Triceratops',
    biome: 'jungle',
    x: -100,
    z: 24,
    rotY: -1.35,
    clearance: 2.5,
    initialAction: 'Idle',
    phaseOffset: 2.08,
    timeScale: 0.97,
  },
  // Ancient Dino Ruins (open flat mossy terrace flank outside ruins-center-pad, angled cleanly across terrace)
  {
    id: 'ruins-stego',
    species: 'Stegosaurus',
    biome: 'ruins',
    x: -91,
    z: -69.5,
    rotY: -0.82,
    clearance: 2.5,
    initialAction: 'Idle',
    phaseOffset: 0.48,
    timeScale: 0.94,
  },
  // Smoking Volcano Ridge (flat ny=0.987 summit overlook clear of ridge trail & lava canyon drop-off)
  {
    id: 'volcano-trex',
    species: 'TRex',
    biome: 'volcano',
    x: 82.5,
    z: -69.0,
    rotY: -1.1,
    clearance: 2.5,
    initialAction: 'Idle',
    phaseOffset: 1.62,
    timeScale: 0.96,
  },
  // Crystal Waterfall Lagoon (flat shoreline outside waterfall-basin, tail clear of hillside)
  {
    id: 'lagoon-apato',
    species: 'Apatosaurus',
    biome: 'lagoon',
    x: 110,
    z: 15,
    rotY: 2.45,
    clearance: 3.0,
    initialAction: 'Idle',
    phaseOffset: 0.94,
    timeScale: 0.92,
  },
  {
    id: 'lagoon-para',
    species: 'Parasaurolophus',
    biome: 'lagoon',
    x: 114,
    z: 22,
    rotY: 2.15,
    clearance: 2.0,
    initialAction: 'Idle',
    phaseOffset: 2.45,
    timeScale: 1.02,
  },
  // Skull Rock Pirate Cave Headland (flat ny=0.936 grassy coastal flank set well back from cliff brink)
  {
    id: 'cave-raptor',
    species: 'Velociraptor',
    biome: 'skullCave',
    x: 81,
    z: 102,
    rotY: 1.55,
    clearance: 1.5,
    initialAction: 'Idle',
    phaseOffset: 1.12,
    timeScale: 1.06,
  },
];
