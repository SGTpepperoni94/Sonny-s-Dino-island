export const QUATERNIUS_PINNED_COMMIT = 'd630aa4139033709a52cd6ae8aa314deb77c83c9';

export const PIRATE_KIT_MANIFEST_URL = `https://cdn.jsdelivr.net/gh/SGTpepperoni94/quaternius-pirate-kit@${QUATERNIUS_PINNED_COMMIT}/manifest.json`;

export const PIRATE_KIT_MODELS_BASE_URL = `https://cdn.jsdelivr.net/gh/SGTpepperoni94/quaternius-pirate-kit@${QUATERNIUS_PINNED_COMMIT}/models/`;

export const CALM_AUDIO_URL =
  'https://cdn.jsdelivr.net/gh/SGTpepperoni94/quaternius-pirate-kit@main/audio/calm.mp3';

export type AssetPackId =
  | 'pirate'
  | 'pirate-kit-v1'
  | 'dinosaurs-pack-2'
  | 'stylized-nature-pack-3'
  | 'farm-pack-4'
  | 'survival-pack-5'
  | 'animals-pack-6'
  | 'custom-hero';

export interface AssetCatalogEntry {
  packId: AssetPackId;
  modelKey: string;
  scale: number;
  yOffset: number;
  tintRange: { h: number; s: number; l: number };
  rigged?: boolean;
  reserved?: boolean;
  verifiedClips?: readonly string[];
}

export const ASSET_CATALOG = {
  // Playable Sonny (Verified: scale 1.0, feet at y = 0, faces +Z)
  'character.sonny': {
    packId: 'pirate-kit-v1',
    modelKey: 'Characters_Henry',
    scale: 1.0,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    rigged: true,
  },

  // Pirate Harbor structures & ship
  'ship.sloop': {
    packId: 'pirate-kit-v1',
    modelKey: 'Ship_Small',
    scale: 1.05,
    yOffset: -0.18,
    tintRange: { h: 0, s: 0, l: 0 },
  },
  'structure.house1': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_House1',
    scale: 0.68,
    yOffset: -0.08,
    tintRange: { h: 0.01, s: 0.03, l: 0.03 },
  },
  'structure.house2': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_House2',
    scale: 0.7,
    yOffset: -0.08,
    tintRange: { h: 0.01, s: 0.03, l: 0.03 },
  },
  'structure.sawmill': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Sawmill',
    scale: 0.66,
    yOffset: -0.08,
    tintRange: { h: 0.01, s: 0.02, l: 0.02 },
  },

  // Flora & Rocks
  'flora.palm': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_PalmTree_1',
    scale: 2.05,
    yOffset: -0.15,
    tintRange: { h: 0.03, s: 0.08, l: 0.06 },
  },
  'flora.palm2': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_PalmTree_2',
    scale: 2.15,
    yOffset: -0.15,
    tintRange: { h: 0.03, s: 0.08, l: 0.06 },
  },
  'flora.palm3': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_PalmTree_3',
    scale: 1.9,
    yOffset: -0.15,
    tintRange: { h: 0.03, s: 0.08, l: 0.06 },
  },
  'rock.1': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Rock_1',
    scale: 1.6,
    yOffset: -0.25,
    tintRange: { h: 0.02, s: 0.05, l: 0.08 },
  },
  'rock.2': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Rock_2',
    scale: 1.8,
    yOffset: -0.25,
    tintRange: { h: 0.02, s: 0.05, l: 0.08 },
  },
  'rock.3': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Rock_3',
    scale: 1.5,
    yOffset: -0.2,
    tintRange: { h: 0.02, s: 0.05, l: 0.08 },
  },
  'rock.4': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Rock_4',
    scale: 1.9,
    yOffset: -0.28,
    tintRange: { h: 0.02, s: 0.05, l: 0.08 },
  },
  'rock.5': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Rock_5',
    scale: 1.7,
    yOffset: -0.25,
    tintRange: { h: 0.02, s: 0.05, l: 0.08 },
  },
  'cliff.4': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Cliff4',
    scale: 1.5,
    yOffset: -0.4,
    tintRange: { h: 0.01, s: 0.04, l: 0.06 },
  },

  // Pirate & Ruins Props
  'prop.barrel': {
    packId: 'pirate-kit-v1',
    modelKey: 'Prop_Barrel',
    scale: 1.15,
    yOffset: 0,
    tintRange: { h: 0.01, s: 0.04, l: 0.04 },
  },
  'prop.chest': {
    packId: 'pirate-kit-v1',
    modelKey: 'Prop_Chest_Closed',
    scale: 1.25,
    yOffset: 0,
    tintRange: { h: 0.01, s: 0.04, l: 0.04 },
  },
  'bones.large': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_LargeBones',
    scale: 1.75,
    yOffset: -0.1,
    tintRange: { h: 0.01, s: 0.02, l: 0.05 },
  },
  'bones.skulls': {
    packId: 'pirate-kit-v1',
    modelKey: 'Environment_Skulls',
    scale: 1.5,
    yOffset: 0,
    tintRange: { h: 0.01, s: 0.02, l: 0.04 },
  },

  // Reserved Build 2+ Family Cast & Hero Slots (config slots only — NOT instantiated in Build 1)
  // Mum (Amy) at ranchCenter — uses verified clips: Idle, Wave, Yes
  'npc.amy': {
    packId: 'pirate',
    modelKey: 'Characters_Anne',
    scale: 1.0,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    rigged: true,
    reserved: true,
    verifiedClips: ['Idle', 'Wave', 'Yes'],
  },
  // Captain Seahawk (Dad) — reserved Pirate Kit character slot at harborSpawn
  'npc.seahawk': {
    packId: 'pirate',
    modelKey: 'Characters_Captain_Barbarossa',
    scale: 1.05,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    rigged: true,
    reserved: true,
  },
  // Artie — reserved Pirate Kit sidekick slot at harborSpawn
  'npc.artie': {
    packId: 'pirate',
    modelKey: 'Characters_Mako',
    scale: 0.82,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    rigged: true,
    reserved: true,
  },

  // Reserved Build 2+ Sockets (Packs 2-6 drop-in via 1-line edit)
  'dino.trex': {
    packId: 'dinosaurs-pack-2',
    modelKey: 'Dino_TRex',
    scale: 1.4,
    yOffset: 0,
    tintRange: { h: 0.02, s: 0.05, l: 0.05 },
    rigged: true,
    reserved: true,
  },
  'dino.triceratops': {
    packId: 'dinosaurs-pack-2',
    modelKey: 'Dino_Triceratops',
    scale: 1.25,
    yOffset: 0,
    tintRange: { h: 0.02, s: 0.05, l: 0.05 },
    rigged: true,
    reserved: true,
  },
  'ranch.fence': {
    packId: 'farm-pack-4',
    modelKey: 'Farm_Fence_Wood',
    scale: 1.0,
    yOffset: 0,
    tintRange: { h: 0.01, s: 0.03, l: 0.03 },
    reserved: true,
  },
  // Concept-locked custom .glb slot for Sonny & Artie's Pirate Bed Ship:
  // low-poly gabled wooden house-bed frame fused with a boat hull, slatted guardrails,
  // red skull pennant, colorful bunting, hanging lantern, and striped bedding
  // (concept sheet on #808080 studio grey — ready for Tripo/Meshy .glb swap in Build 2+)
  'hero.bedShip': {
    packId: 'custom-hero',
    modelKey: 'Pirate_Bed_Ship',
    scale: 1.0,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    reserved: true,
  },
  'fish.tuna': {
    packId: 'pirate-kit-v1',
    modelKey: 'Prop_Fish_Tuna',
    scale: 1.0,
    yOffset: 0,
    tintRange: { h: 0, s: 0, l: 0 },
    reserved: true,
  },
} as const satisfies Record<string, AssetCatalogEntry>;

export type AssetKey = keyof typeof ASSET_CATALOG;
