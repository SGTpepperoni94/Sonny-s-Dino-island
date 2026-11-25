# Data & Contract Schema — Pirate & Dino Island Discovery
> Synced: 2026-11-23 | Source: `src/engine/SaveManager.ts`, `src/config/worldAnchors.ts`, `src/config/assets.ts`, `src/types/game.ts`

## 1. Durable Client Persistence (`localStorage` key: `sonny_island_save_v1`)
```ts
export const SAVE_SCHEMA_VERSION = 1;

export interface IslandSaveData {
  schemaVersion: number;       // Currently 1; validated/normalized by migrateSave()
  lastAnchor: AnchorId;        // Default: 'harborSpawn'
  discoveredBiomes: BiomeId[]; // Deduplicated; default: ['harbor']
  muted: boolean;              // Synced with AudioEngine mute toggle
  hatchedDinoIds: string[];    // Reserved Build 2+ socket
  builtPadIds: string[];       // Reserved Build 3+ socket
  updatedAt: number;           // Unix epoch ms
}
```
* **Recovery Guarantee:** Corrupt JSON, missing fields, or sandboxed `localStorage` access silently fall back to `createDefaultSave()` without throwing.

## 2. Spatial Anchors (`WORLD_ANCHORS`)
| AnchorId | Biome | X | Z | Facing Yaw (rad) | Verified Terrain Role |
| :--- | :--- | ---: | ---: | ---: | :--- |
| `harborSpawn` | `harbor` | -4.0 | 66.0 | `PI - 0.18` | Golden-sand harbor bay clearing facing inland |
| `ranchCenter` | `ranch` | 2.0 | 20.0 | `PI` | Flat lime-green Sunny Meadow / future Dino Ranch |
| `jungleTrail` | `jungle` | -54.0 | 14.0 | `PI + 0.35` | Winding ochre footpath in Whispering Fern Jungle |
| `ruinsTerrace` | `ruins` | -44.0 | -48.0 | `0.45` | Elevated stepped mossy-stone Ancient Dino Ruins |
| `volcanoSummit` | `volcano` | 42.5 | -37.5 | `PI - 0.55` | Safe wide sandy-rock ridge trail overlooking lava |
| `lagoonDock` | `lagoon` | 68.0 | 18.0 | `PI + 0.35` | Aquamarine cove beach & fishing pier |
| `skullCaveMouth` | `skullCave` | 37.8 | 62.6 | `PI - 0.58` | Beach approach framing full Skull Rock facade |
| `skullCaveInterior` | `skullCave` | 47.6 | 47.2 | `PI - 0.58` | Torchlit interior walkable cobblestone ledge |

## 3. Semantic Asset Catalog (`ASSET_CATALOG`)
Each logical key maps to `{ packId, modelKey, scale, yOffset, tintRange, rigged?, reserved?, verifiedClips? }`:
* **Active (`pirate-kit-v1` — `.gltf` via pinned commit `d630aa4139033709a52cd6ae8aa314deb77c83c9`):** `character.sonny` (`Characters_Henry`), `ship.sloop`, `structure.house1`, `structure.house2`, `structure.sawmill`, `flora.palm`, `flora.palm2`, `flora.palm3`, `rock.1..5`, `cliff.4`, `prop.barrel`, `prop.chest`, `bones.large`, `bones.skulls`.
* **Reserved Build 2+ Family Cast (`packId: 'pirate'`, config-only in Build 1):** `npc.amy` (`Characters_Anne`, verified clips `Idle`/`Wave`/`Yes`), `npc.seahawk` (`Characters_Captain_Barbarossa`), `npc.artie` (`Characters_Mako`).
* **Reserved Build 2+ Hero & Pack Sockets:** `hero.bedShip` (concept-locked Pirate Bed Ship on `#808080` studio grey pending Tripo/Meshy `.glb`), `dino.trex`, `dino.triceratops`, `ranch.fence`, `fish.tuna`.

## 4. Interaction Arbitrator Contract (`IInteractable`)
```ts
export interface IInteractable {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  priority: number;
  icon: string;
  canInteract: () => boolean;
  onInteract: () => void;
}
```
* Scoring formula: `priority * 10 + facingDot * 2.5 + distNorm * 1.5` (filtered by `radius` and `facingDot >= -0.15`).
