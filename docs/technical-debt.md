# Technical Debt & Audit Log — Pirate & Dino Island Discovery
> Synced: 2026-11-24 | Audited through Build 1 Visual Overhaul — Phase 1F (Hardening & Zero-GC Audit)

## Active Debt Items

### TD-02 — Manual Hardware Verification Pending [Severity: Low]
* Physical Gamepad controller input (axes/triggers on Xbox/Switch/PlayStation pads) and live audible `audio/calm.mp3` + Web Audio SFX playback cannot be physically verified inside headless Chromium. Pure deadzone/stick math is unit-tested; verify on a real device/browser before Build 2.

### TD-03 — Distance Throttling & LOD Socket for Build 2+ Entities/Props [Severity: Low]
* Build 1 renders at `32–34` draw calls in Play (`71` on Title) using `InstancedMesh` batching without geometric mesh LODs. Once Build 2+ adds NPCs, dinosaurs, and Dino Ranch structures, add a shared `DistanceThrottler` / LOD tier helper in `src/engine/` to pause distant `AnimationMixer` updates and downgrade/cull high-density decorative foliage & props beyond `~90m`.

### TD-04 — Mobile Touch Viewport Visual Capture [Severity: Low]
* Build 1 verification captures desktop `1440x900` (with `TouchThumbstick` and touch-sized HUD buttons wired conditionally via `isTouch`). Add an explicit mobile touch emulation capture (`390x844`, `hasTouch: true`) in Build 2 verification.

## Resolved in Build 1 & Visual Overhaul Verification
* ~~`TD-01` — File Line-Count Cap Overruns (`> 250` LOC)~~ — Resolved completely across Phases 1A–1F (`0` files over 250 LOC across all `src/**/*.ts` and `src/**/*.tsx`; max file is `249` LOC):
  - `LandmarkSystem.ts` (588 -> 240 LOC + `SkullRockCaveBuilder.ts` 248 + `WaterfallLagoonBuilder.ts` 240 in Phase 1E).
  - `PropScatterSystem.ts` (458 -> 226 LOC + `ScatterLayout.ts` 218 in Phase 1D).
  - `GameEngine.ts` (529 -> 241 LOC + `RendererFactory.ts` 117 + `SelfTestRunner.ts` 101 + `EngineBootstrap.ts` 139 in Phase 1F).
  - `PlayerSystem.ts` (478 -> 234 LOC + `ProceduralSonnyBuilder.ts` 96 + `AnimationStateController.ts` 104 + `PlayerFeedback.ts` 78 in Phase 1F).
  - `InputManager.ts` (331 -> 245 LOC + `InputGamepad.ts` 109 + `InputPointer.ts` 43 in Phase 1F).
* ~~`TD-05` — Pre-Existing `PlayerPhysics.test.ts:61` Assertion & `ruinsTerrace` Ribcage Camera Framing~~ — Resolved in Phase 1D (ruins scatter clearance) and Phase 1F (lowered short-hop landing velocity threshold from `-3.0` to `-1.5` in `PlayerPhysics.ts`; all 23/23 unit tests green).
* ~~`src/world/terrainMath.ts` (> 250 LOC)~~ — Decomposed in **Phase 1B** into `terrainMath.ts` (`247` LOC) + `terrainTrails.ts` (`211` LOC).
* ~~`src/world/IslandTerrainSystem.ts` (> 250 LOC) & triangle sawtooth terrain edges~~ — Resolved in **Phase 1A** (`IslandTerrainSystem.ts = 197` LOC + `terrainSplatBaker.ts = 249` LOC).
* ~~Volcano floating crater lava plane & foothill shelf seam~~ — Resolved in **Phase 1B** (`VolcanoCraterLava` recessed cleanly inside 360-degree caldera rim, subdivided `VolcanoLavaRiver` hugging deep canyon below ridge trail).
* ~~Quaternius CDN `.glb` 404s~~ — Fixed `AssetManager.ts` to parse `manifest.assets` and resolve `.gltf` cleanly.
* ~~PMREM terrain washout~~ — Calibrated `scene.environmentIntensity = 0.42` and deepened `palette.ts` values.
* ~~Skull Rock side-boulder overlap & interior anchor offset~~ — Replaced smooth flank spheres with terraced mossy rock blocks and centered `skullCaveInterior` on the dry cobblestone ledge.
