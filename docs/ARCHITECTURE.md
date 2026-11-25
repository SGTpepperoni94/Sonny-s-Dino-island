# Architecture — Pirate & Dino Island Discovery (Build 1)

## Layered One-Way Module Graph
Imports strictly flow downward: `types -> config -> engine -> world -> gameplay -> ui`.

- `src/types/game.ts`: Pure interfaces (`IGameSystem`, `EngineContext`, `IInteractable`, `PerfStats`, `HudSnapshot`, `SelfTestReport`).
- `src/config/`:
  - `worldAnchors.ts`: 8 named `WORLD_ANCHORS` across the 6 biomes + reserved spatial footprints (`spawn-clear`, `harbor-family-hub`, `harbor-ranch-sightline`, `ranch-plateau`, `ranch-amy-hub`, and landmark pads).
  - `assets.ts`: Semantic `ASSET_CATALOG` mapping logical keys (`character.sonny`, `flora.palm`, `ship.sloop`, plus reserved Build 2+ slots `npc.amy`, `npc.seahawk`, `npc.artie`, `hero.bedShip`, `dino.trex`, `ranch.fence`) to pinned Quaternius CDN models and custom hero `.glb` sockets.
  - `palette.ts`: Tropical low-poly sunlit color register matching the 7 visual reference images.
- `src/engine/`:
  - `GameEngine.ts`: Thin coordinator (`<= 250` LOC) owning the tick loop (single `input.sample(dt)` per frame before system updates), `IGameSystem` lifecycle, throttled ~9 Hz React HUD snapshots, and `resetCycle()` / `dispose()`.
  - `RendererFactory.ts`: Software-WebGL detection (`UNMASKED_RENDERER_WEBGL`), `WebGLRenderer` + `RoomEnvironment` PMREM + sun shadow stage creation, and WebGL2 `fenceSync` `scheduleAfterDraw()` pacing.
  - `EngineBootstrap.ts`: Composition root wiring world & gameplay systems, sun shadow frustum tracking, `PerfStats` / `HudSnapshot` builders, and `window.__SONNY_ISLAND__` bridge registration.
  - `SelfTestRunner.ts`: Automated `?test` runner asserting `calls <= 150`, all 8 `WORLD_ANCHORS` valid & walkable, 0 NaN transforms, `PointLight <= 6`, and zero geometry/texture leak growth across `resetCycle()`.
  - `AssetManager.ts`: Pinned Quaternius manifest loader with `baseUrl` override, failed-promise eviction, `SkeletonUtils.clone` for rigged models, `userData.sharedResource` buffer protection, and `InstancedMesh` geometry extraction.
  - `AudioEngine.ts`: `calm.mp3` CDN streaming (silent on Title Screen, `navigator.userActivation` guard, 1.5s fade-in on Play) + procedural Web Audio SFX.
  - `InputManager.ts` / `InputGamepad.ts` / `InputPointer.ts`: 4-mode zero-GC input (Gamepad with deadzone scratch vector, WASD+Arrows, Desktop Left-Click/Hold Click-to-Run with reusable raycaster hits array + Right-Drag Orbit, Mobile Touch).
  - `InteractionArbitrator.ts`: Single facing-cone winner selector for Build 2+ 3-button ergonomics.
  - `SaveManager.ts`: Versioned `localStorage` persistence (`schemaVersion: 1`, `migrateSave()`).
  - `MaterialLibrary.ts`: Centralized flat-shaded low-poly PBR material registry with terrain splatmap & volcanic emissive bounce hook.
- `src/world/`:
  - `terrainMath.ts` / `terrainTrails.ts` / `TerrainQuery.ts`: Pure deterministic ~400m island heightfield (`ISLAND_WORLD_RADIUS = 205`), biome classification, trails, lava gully hazard, Skull Rock Cave tunnel/ledge floor, reserved footprint exclusion checks, and walkability rules.
  - `IslandTerrainSystem.ts` / `terrainSplatBaker.ts`: Non-indexed faceted low-poly terrain (`180x180`, ~2.44m facets) with baked world-space splatmap + instanced drifting clouds.
  - `OceanSystem.ts` / `oceanShaders.ts`: Radially-warped faceted GPU-wave ocean (`140x140`) + CPU `getOceanWaveHeight()` mirror + bilinear `coastTexture` sparse coastal ribbon shoreline foam with `polygonOffset`.
  - `LandmarkSystem.ts` / `SkullRockCaveBuilder.ts` / `WaterfallLagoonBuilder.ts`: Skull Rock Pirate Cave (SE coastline), Crystal Waterfall Lagoon (East), Smoking Volcano lava crater/river (far NE, ~73–82m), and harbor/lagoon wooden docks.
  - `PropScatterSystem.ts` / `ScatterLayout.ts`: Deterministic placement layout + batched `InstancedMesh` Quaternius Pirate Kit props, offshore bobbing `Ship_Small` (`1.05`), harbor shacks (`0.66–0.70`), instant procedural fallbacks, and strict `TerrainQuery.isFootprintReserved(...)` clearance.
- `src/gameplay/`:
  - `ParticlePoolSystem.ts`: Single `InstancedMesh` ring buffer (capacity 180, zero-GC) for smoke, mist, water splash, footstep dust, and wave sparkles.
  - `PlayerPhysics.ts` / `PlayerSystem.ts` / `ProceduralSonnyBuilder.ts` / `AnimationStateController.ts` / `PlayerFeedback.ts`: Pure zero-GC kid-safe movement + invisible guardrail sliding, Sonny (`Characters_Henry` + procedural fallback), exact-name animation matching, footsteps/splash/jump feedback, and Wave emote.
  - `CameraSystem.ts`: Live harbor orbit Title Screen + effortless auto-follow behind-the-back gameplay camera reading single-sampled input state.
- `src/ui/`: Zero-text `TitleOverlay`, `GameHud`, `TouchThumbstick`, plus URL-gated `?debug` biome bar.

## Family Cast & Phase 2 Hub Flow (Reserved in Build 1 — Spawning Begins in Build 2)
- **Sonny** (`character.sonny` / `Characters_Henry`): Playable captain (**live in Build 1**), spawns on the golden beach at `harborSpawn` (`-6, 122`).
- **Captain Seahawk** (Dad — `npc.seahawk`) + **Artie** (sidekick — `npc.artie`): Stationed at `harborSpawn` on the reserved flat sandy pad (`harbor-family-hub`, `x: 8, z: 117, r: 11`) beside the **Pirate Bed Ship**. Captain Seahawk waves in Animalese with zero-text picture bubbles pointing to the first glowing Dino Egg, while Artie tags along and cheers.
- **Mum (Amy)** (`npc.amy` / `Characters_Anne`): Stationed just up the clear ochre dirt path (`harbor-ranch-sightline`, `x: -2, z: 102, r: 11`) at `ranchCenter` (`ranch-amy-hub` `x: 2, z: 88, r: 11` / `ranch-plateau` `x: 2, z: 76, r: 28`), welcoming every hatched dinosaur with Animalese chatter, verified `Idle`/`Wave`/`Yes` animations, and picture-bubble cues for the Free Sticker-Stamp Builder and Picture Dino-Dex.
- **Pirate Pete**: Goofy LEGO-style villain reserved for Phase 3+ island encounters.

## Pirate Bed Ship Hero Asset Spec (`hero.bedShip`)
- **Status:** Concept-locked (`reserved: true` in `ASSET_CATALOG`, pending Tripo/Meshy `.glb` upload in Build 2+).
- **Visual Spec:** Low-poly gabled wooden house-bed frame fused with a boat hull, slatted guardrails, red skull pennant, colorful bunting, hanging lantern, and striped bedding — staged on `#808080` studio grey for clean 3D conversion and 1-line `.glb` swap at `harbor-family-hub`.

## Permanent Visual Source of Truth (`docs/references/`)
All UI-free visual reference renders are stored strictly inside `docs/references/` (never bundled into Vite's runtime `public/` output) so every build pass stays grounded to the target low-poly aesthetic:
- `docs/references/island-overview.png` — Aerial 6-biome island composition, curving golden harbor bay with rocky headlands, winding ochre path, stepped Dino Ruins plateau, Smoking Volcano with white plume, and Crystal Waterfall Lagoon.
- `docs/references/pirate-harbor.png` — Pirate Harbor curving golden beach, stepped rocky cliff headlands, smooth dirt trail curving inland, sunlit faceted emerald meadow, and faceted turquoise ocean with crisp double white foam.
- `docs/references/fern-jungle.png` — Rolling emerald hills, recessed warm-earth embankments with overhanging grass lips flanking the smooth winding dirt road, stepped ruins and volcano in the distance.
- `docs/references/dino-ruins.png` — Stepped mossy-stone Ancient Dino Ruins terraces with weathered flagstone paving patches, steep faceted grey-brown cliffs, and ochre ramp.
- `docs/references/volcano-ridge.png` — Walkable orange-ochre ridge trail above a deep recessed glowing polygonal-magma canyon carved through faceted dark purple-charcoal volcanic basalt, with smoking caldera.
- `docs/references/waterfall-lagoon.png` — Crystal cyan-and-white waterfall plunging down stepped mossy cliffs into a shallow turquoise lagoon ringed by golden sand, foamy splash rings, and lacy shoreline surf.
- `docs/references/skull-cave.png` — Giant carved low-poly pirate skull embedded in a mossy coastal headland with faceted red bandana + knot/tails, eyepatch, warm glowing amber eye, arched mouth with chunky teeth, torchlit cobblestone ledge, and continuous turquoise inlet.
- `docs/references/pirate-bed-ship.png` — Concept-locked hero prop reference for Sonny & Artie's Pirate Bed Ship (`hero.bedShip`, Build 2+).

