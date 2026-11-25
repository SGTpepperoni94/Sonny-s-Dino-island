# Contracts — Pirate & Dino Island Discovery

## 1. Spatial Contract (`TerrainQuery` & `WORLD_ANCHORS`)
- `getTerrainHeight(x, z): number` — Deterministic finite ground height.
- `getTerrainNormal(x, z): { nx, ny, nz }` — Surface normal from finite differences.
- `isWalkable(x, z): boolean` — False in deep ocean (`h < -1.15m`), inside volcano lava hazard, outside island radius (`ISLAND_WORLD_RADIUS = 205m`), or on sheer cliffs (`ny < 0.62`).
- `isShallowWater(x, z): boolean` — True for splashable beach & lagoon water (`-1.15m <= h < 0.08m`).
- `isLavaHazard(x, z): boolean` — True inside far-NE volcano crater (`r < 16.5m` around `96, -94`) and recessed lava channel (`dist < 5.6m`).
- `WORLD_ANCHORS`: `harborSpawn` (`-6, 122`), `ranchCenter` (`2, 82`), `jungleTrail` (`-106, 32`), `ruinsTerrace` (`-88, -84`), `volcanoSummit` (`68, -56`), `lagoonDock` (`118, 26`), `skullCaveMouth` (`85.8, 118.6`), `skullCaveInterior` (`95.6, 103.2`).
- `INITIAL_RESERVED_FOOTPRINTS` (enforced by `TerrainQuery.isFootprintReserved()` across palms, rocks, bushes, grass tufts, barrels, chests, and village structures in `ScatterLayout` / `PropScatterSystem`):
  - `spawn-clear` (`-6, 122`, `r = 11`) + `harbor-family-hub` (`8, 117`, `r = 11`) — flat golden-sand hub beside Sonny's spawn reserved for the **Pirate Bed Ship**, **Captain Seahawk**, and **Artie**.
  - `harbor-ranch-sightline` (`-2, 102`, `r = 11`) — unobstructed sightline corridor along the dirt path linking `harborSpawn` to `ranchCenter` (`40.8m`).
  - `ranch-plateau` (`2, 76`, `r = 28`) + `ranch-amy-hub` (`2, 88`, `r = 11`) — flat grassy sanctuary hub reserved for **Mum (Amy)** and the Dino Ranch.
  - Landmark & biome pads: `skull-cave-mouth` (`91, 114`, `r = 12`), `skull-cave-interior` (`100, 103`, `r = 15`), `waterfall-basin` (`132, 8`, `r = 20`), `volcano-crater` (`96, -94`, `r = 24`), `ruins-center-pad` (`-94, -88`, `r = 16`).

## 2. Semantic Asset & Family Cast Contract (`ASSET_CATALOG`)
- **Live in Build 1:** `character.sonny` (`Characters_Henry`, scale `1.0`, `yOffset: 0`) + Pirate Kit harbor/island props (`ship.sloop` = `1.05`, village shacks = `0.66–0.70`).
- **Reserved Phase 2+ Family Cast (config slots only — NOT instantiated in Build 1):**
  - `npc.amy`: `{ packId: 'pirate', modelKey: 'Characters_Anne', scale: 1.0, yOffset: 0, rigged: true, reserved: true, verifiedClips: ['Idle', 'Wave', 'Yes'] }` — Mum (Amy) stationed at `ranchCenter`, greeting every hatched dinosaur with Animalese chatter, `Wave`/`Yes` clips, and picture-bubble cues for the Free Sticker-Stamp Builder & Picture Dino-Dex.
  - `npc.seahawk`: `{ packId: 'pirate', modelKey: 'Characters_Captain_Barbarossa', scale: 1.05, yOffset: 0, rigged: true, reserved: true }` — Captain Seahawk (Dad) stationed at `harborSpawn` beside the Pirate Bed Ship; waves in Animalese with picture bubbles pointing to the first glowing Dino Egg.
  - `npc.artie`: `{ packId: 'pirate', modelKey: 'Characters_Mako', scale: 0.82, yOffset: 0, rigged: true, reserved: true }` — Artie (sidekick) stationed at `harborSpawn` beside Captain Seahawk & Pirate Bed Ship; tags along and cheers.
  - **Pirate Pete:** Goofy LEGO-style villain reserved for Phase 3+.
- **Reserved Custom Hero Asset (`hero.bedShip`):**
  - `hero.bedShip`: `{ packId: 'custom-hero', modelKey: 'Pirate_Bed_Ship', scale: 1.0, yOffset: 0, reserved: true }` — Concept-locked spec (low-poly gabled wooden house-bed frame fused with a boat hull, slatted guardrails, red skull pennant, colorful bunting, hanging lantern, and striped bedding on `#808080` studio grey), pending Tripo/Meshy `.glb` upload in Build 2+.

## 3. Plugin System Contract (`IGameSystem`)
Every subsystem implements `{ id: string, init(ctx: EngineContext), update(dt: number, elapsedTime: number), dispose(): void }`.

## 4. Interaction Contract (`InteractionArbitrator`)
Build 2+ interactables (Dino Eggs, Levers, Build Pads, Fishing Spots, NPCs) register `IInteractable { id, position, radius, priority, icon, canInteract, onInteract }`. `PlayerSystem.triggerWave()` consults `arbitrator.triggerBest(...)` before falling back to Sonny's Wave emote.

## 5. Debug & Verification Bridge (`window.__SONNY_ISLAND__`)
- `teleportToBiome(anchorOrBiome)`
- `getPerfStats()` -> `{ calls, triangles, geometries, textures, fps, isSoftwareGl }`
- `runSelfTest()` -> verifies 6 assertions: `drawCallsBudget` (`calls <= 150`), `trianglesBudget` (`triangles <= 550,000` Phase 2 ceiling; Build 1 static island target `<= 400,000`), `worldAnchorsValidAndWalkable` (all 8 `WORLD_ANCHORS` finite & walkable), `zeroNanTransforms`, `pointLightsBudget` (`<= 6`), and `zeroLeakOnResetCycle` (`geoDelta <= 0`, `texDelta <= 0`, post-reset `calls <= 150`).
- URL flags: `?autostart=1`, `?debug`, `?test`.

## 6. Visual Quality Gate Contract (Recalibrated Scoring Rubric)
- **7-Preset Deterministic Capture:** Every visual phase rotates `public/captures/latest/*` -> `public/captures/prev/`, captures all 7 fixed presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) via `window.__SONNY_ISLAND__.setCapturePreset(name)`, and logs an honest score in `docs/BACKLOG.md` against `docs/references/*.png`.
- **`7.0 / 10` (Bare-Minimum Baseline):** Matching `docs/references/*.png` is strictly the **7.0 / 10 bare-minimum baseline** (never a 9/10).
- **`9.0+ / 10` (Release Polish Bar):** Achieving **9.0+ / 10** requires clearly surpassing `docs/references/*.png` in **atmospheric depth**, **lighting cohesion**, **feathered ground transitions**, **layered midground silhouettes**, and **contact grounding**, while holding draw calls `<= 150`, PointLights `<= 6`, and 100% walkability across all 8 `WORLD_ANCHORS`.
- **Phase 2 Performance Ceiling:**
  - **Total Scene Triangles:** `<= 550,000` hard Phase 2 ceiling, with **Build 1 static island geometry capped at `<= 400,000` tris** to leave clean triangle headroom for rigged Phase 2 dinosaurs and pirate NPCs.
  - **Draw Calls:** `<= 110` Phase 2 target (`<= 150` hard ceiling; `<= 60` in Build 1 static harbor Play view).
  - **Dynamic Lights & Memory Hygiene:** `<= 6` `PointLight`s across the entire scene, and `geoDelta = 0` / `texDelta = 0` on `resetCycle()`.


