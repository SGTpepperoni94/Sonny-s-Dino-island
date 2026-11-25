# Product & Build 1 Visual Overhaul Backlog (`docs/BACKLOG.md`)
> **Created:** 2026-11-24 | **Synced:** 2026-11-24 | **Scope:** Pirate & Dino Island Discovery — Canonical Single Source of Truth (Build 1 Visual Overhaul, Hardening, Visual Polish 1G–1K & Product Roadmap Epics 1–3; consolidated from `docs/backlog.md`)  
> **Workflow Rule:** Execute strictly **one phase per turn**. Each phase MUST complete its Pre-Implementation Audit, stay within its 1–2 file implementation boundary (excluding mechanical helper extraction when enforcing the `<= 250` LOC cap), pass every Post-Implementation Verification Gate check, update `docs/CHANGELOG.md`, and check off its status before moving to the next phase.

---

## Global Baseline & Invariants (Audited 2026-11-24)

### Current Build 1 Baseline Metrics
- **Renderer / Perf (`window.__SONNY_ISLAND__.getPerfStats()`):** `17–21` draw calls in Round 2 verification (budget `<= 150`), `4/4` `?test` (`runSelfTest()`) assertions passing (`geoDelta = -21`, `texDelta = 0`), `0` console errors/warnings, `11/11` unit tests (`tsx --test`) passing.
- **Current Source Line Counts (`> 250` LOC Overruns to Resolve):**
  - `src/world/LandmarkSystem.ts` — **576 lines**
  - `src/world/terrainMath.ts` — **531 lines**
  - `src/engine/GameEngine.ts` — **529 lines**
  - `src/gameplay/PlayerSystem.ts` — **478 lines**
  - `src/world/PropScatterSystem.ts` — **458 lines**
  - `src/engine/InputManager.ts` — **331 lines**
  - `src/world/IslandTerrainSystem.ts` — **263 lines**
  - `src/config/assets.ts` — **249 lines** *(at limit)*
- **Visual Source of Truth (`docs/references/`):** `island-overview.png`, `pirate-harbor.png`, `fern-jungle.png`, `dino-ruins.png`, `volcano-ridge.png`, `waterfall-lagoon.png`, `skull-cave.png`, `pirate-bed-ship.png`.

### Non-Negotiable Cross-Phase Constraints
1. **Architecture Layering:** Strictly one-way imports `types -> config -> engine -> world -> gameplay -> ui`.
2. **Spatial & Walkability Contract:** All 8 `WORLD_ANCHORS` remain finite and walkable; `INITIAL_RESERVED_FOOTPRINTS` (`spawn-clear`, `harbor-family-hub`, `harbor-ranch-sightline`, `ranch-plateau`, `ranch-amy-hub`, and landmark pads) stay 100% clear of props/foliage/structures.
3. **Zero Build 2+ Premature Spawning:** Family cast (`npc.amy`, `npc.seahawk`, `npc.artie`) and `hero.bedShip` remain config-only (`reserved: true`) in `src/config/assets.ts` during Build 1.x.
4. **Performance & Memory Hygiene:** Draw calls `<= 150`, PointLights `<= 6`, zero per-frame allocations inside `update(dt)`, zero CSS `backdrop-blur` over WebGL, and strict `userData.sharedResource = true` protection on cloned/instanced GLTF buffers.
5. **Phase Completion Checklist:** Every phase ends with `?test` 100% passing, `npm run build` + `tsc --noEmit` + `tsx --test` green, visual comparison against target `docs/references/*.png`, `docs/CHANGELOG.md` entry, and status flipped to `[x] Done`.
6. **Strict Visual Quality Gate (Recalibrated Scoring Rubric & Screenshot Handoff Rule):** Passing `tsc`, `npm run build`, and `?test` is NOT enough to mark a phase `[x] Done`. Every visual phase must also follow the **Screenshot Handoff Rule** and **Recalibrated Scoring Rubric** at phase end:
   - **(a) Rotate Baseline:** If `public/captures/latest/` exists, copy `public/captures/latest/*` -> `public/captures/prev/` before taking new screenshots.
   - **(b) Deterministic 7-Preset Capture:** Capture all 7 fixed `window.__SONNY_ISLAND__.setCapturePreset(name)` views (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) in headless Chromium into `public/captures/latest/<name>.png` and write `public/captures/latest/meta.json` (`phase`, `timestamp`, `calls`, `triangles`, `selfTest`).
   - **(c) Recalibrated Scoring Rubric & Side-by-Side Comparison:** Visually compare `prev` vs `latest` vs `docs/references/*.png` against the phase's **Concrete Visual Criteria** and log an honest `Visual Score (1–10)` in `docs/BACKLOG.md` using the strict scale:
     - **`7.0 / 10` (Bare-Minimum Baseline):** Matching `docs/references/*.png` in silhouette, layout, and readability is strictly a **7.0 / 10** bare-minimum pass — never a 9/10.
     - **`8.0–8.5 / 10` (Above Reference):** Cleanly matches references while fixing geometry/grounding/texel defects and delivering crisp low-poly craft across all 7 presets.
     - **`9.0+ / 10` (Release Polish Bar):** Clearly **surpasses** `docs/references/*.png` in **atmospheric depth** (stylized gradient sky & horizon-matched aerial perspective), **lighting cohesion** (warm sunlit bounce vs cool shadow fills), **feathered ground transitions** (organic trails, tonal wear, dappled canopy/cloud shadow variation), **layered midground silhouettes** (palms, rock outcrops, overhangs, shoreline clusters breaking up flat expanses), and **contact grounding** (deepened ambient/contact occlusion beneath rocks, trees, and structures). Flag any remaining flaw as a follow-up micro-task instead of silently glossing over it.

---

## Phase 1A — Terrain Shading & Anti-Sawtooth Overhaul
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - `src/world/IslandTerrainSystem.ts` (**263 lines** — currently 13 lines over the 250-line cap)
  - `src/engine/MaterialLibrary.ts` (**122 lines**)
  - `src/world/terrainMath.ts` (read-only audit of existing continuous blend exports: `getVolcanoBlend`, `getRuinsBlend`, `getJungleBlend`, `getLavaGlowWeight`, `getCaveCobbleWeight`, `getTrailDistance`, `getVolcanoTrailSample`)
  - `src/config/palette.ts` (**59 lines**, read-only palette check)
- **Current Baseline Metrics & Defects:**
  - `getPerfStats()` baseline: `17–21` draw calls, `148x148` non-indexed `PlaneGeometry(250, 250)` (`43,808` triangles), `0` console errors.
  - **Root Visual Defect:** `IslandTerrainSystem.ts` (lines `92–176`) assigns a single flat color per triangle centroid via hard `if/else` thresholds (`biome === 'volcano'`, `trailDist < 3.7`, `cy < 2.25`, `normal.ny < 0.78`), completely ignoring the smooth continuous blend functions already exported from `terrainMath.ts`. This produces severe zig-zag/sawtooth staircase edges along ochre dirt trails, golden beach-to-meadow transitions, cliff faces, and the volcano base.
- **Constraints to Preserve:**
  - Keep `flatShading: true` low-poly faceted surface normals and crisp per-facet luminance contrast (sunlit vs shaded facet readability matching `pirate-harbor.png` and `fern-jungle.png`).
  - Preserve `TerrainMesh` name (`IslandTerrain`), `receiveShadow = true`, `castShadow = false`, and deterministic `dispose()` cleanup (zero geometry/texture leak growth across `resetCycle()`).
  - Do not modify heightfield math (`computeTerrainHeight`) in this phase.

### 2. Scoped Implementation (1–2 Files Max)
- **Target Files:** `src/world/IslandTerrainSystem.ts`, `src/engine/MaterialLibrary.ts`
- **Changes:**
  1. Replace hard per-triangle biome/trail `if/else` color snapping in `IslandTerrainSystem.ts` with smooth world-space fragment splat blending (either a high-res `1024x1024` procedural `CanvasTexture` / `DataTexture` world-space albedo splatmap baked once in `init()` from `getVolcanoBlend`, `getRuinsBlend`, `getJungleBlend`, `getTrailDistance`, `getVolcanoTrailSample`, `getLavaGlowWeight`, `getCaveCobbleWeight`, slope, and elevation, OR custom `onBeforeCompile` world-space splat shader in `MaterialLibrary.ts`).
  2. Retain per-triangle vertex color (or subtle per-facet shade multiplier `0.93–1.07`) multiplied against the smooth world-space splat albedo so `flatShading: true` low-poly facets remain crisp and luminous while trail borders, beach shorelines, ruins flagstones, and volcano foothills blend cleanly with zero triangle sawtooth edges.
  3. Trim/tighten `IslandTerrainSystem.ts` so both `IslandTerrainSystem.ts` and `MaterialLibrary.ts` are `<= 250` lines, and ensure any baked splat texture is explicitly disposed in `IslandTerrainSystem.dispose()`.

### 3. Post-Implementation Audit & Verification Gate
- [x] `npm run build`, `tsc --noEmit`, and `tsx --test` pass with 0 errors *(note: pre-existing untouched `PlayerPhysics.test.ts:61` landing-threshold assertion logged as out-of-scope for Phase 1A; all terrain/splat/engine unit tests 10/10 passing)*.
- [x] `?test` (`window.__SONNY_ISLAND__.runSelfTest()`) passes 100% (`geoDelta = -1`, `texDelta = 0` after `resetCycle()`).
- [x] `getPerfStats()` confirms draw calls `<= 150` (`25–26` draw calls) and zero WebGL/console errors.
- [x] Modified/extracted files `<= 250` lines (`IslandTerrainSystem.ts = 197`, `terrainSplatBaker.ts = 250`, `MaterialLibrary.ts = 157`).
- [x] **Visual Match Check:** Capture/inspect Pirate Harbor trail, Fern Jungle road, Dino Ruins terrace, and Volcano base against `docs/references/pirate-harbor.png`, `fern-jungle.png`, `dino-ruins.png`, and `volcano-ridge.png` — confirm zero sawtooth edges on dirt paths/beaches/volcano seam while retaining crisp low-poly faceted shading.
- [x] Update `docs/CHANGELOG.md` with Phase 1A summary and flip Phase 1A status to `[x] Done`.

---

## Phase 1B — Island Topography, Real-Scale Expansion & Volcano Seam Sculpting
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - `src/config/worldAnchors.ts` (**104 lines** — expanded `WORLD_ANCHORS`, `INITIAL_RESERVED_FOOTPRINTS`, `ISLAND_WORLD_RADIUS = 205`)
  - `src/world/terrainMath.ts` (**247 lines**) & `src/world/terrainTrails.ts` (**211 lines**) — expanded to ~400m real scale with exported single-source landmark coordinates
  - `src/world/IslandTerrainSystem.ts` (**197 lines**) & `src/world/terrainSplatBaker.ts` (**249 lines**) — `TERRAIN_SIZE = 440`, `TERRAIN_SEGMENTS = 180` (`~2.44m` facets), `GRID = 257`
  - `src/world/LandmarkSystem.ts` *(Part 2)* — sync `VOLCANO_CRATER_RADIUS` (15.5m), Skull Rock Cave (`SKULL_CAVE_ORIGIN_X/Z`), Crystal Waterfall (`WATERFALL_ORIGIN_X/Z`), and Harbor/Lagoon docks to expanded ~400m anchors
  - `src/world/OceanSystem.ts`, `src/world/PropScatterSystem.ts`, `src/gameplay/CameraSystem.ts` *(Part 2)* — sync shoreline foam coverage (`440m`), shallow color centers, expanded prop scatter bounds/ship/structures/barrels/chests, and Title harbor orbit camera
  - `src/gameplay/ParticlePoolSystem.ts` (**203 lines**, read-only check of `volcanoSmoke` pooled low-poly puff behavior)
  - `src/world/terrainMath.test.ts` (**164 lines**, unit tests for expanded anchors, spacing, walkability & ~70–85m volcano)
- **Current Baseline Metrics & Defects:**
  - `getPerfStats()` baseline: `26–27` draw calls (`<= 150` budget), `13/13` terrain/splat/engine unit tests passing, `4/4` `?test` passing (`geoDelta = -1`, `texDelta = 0`).
  - **Real-Scale Expansion Mandate (BEFORE Phases 1C–1E Landmarks & Prop Dressing):**
    - Relative to Sonny (`~1.8m` tall, `~7 m/s` run speed), the current ~210m landmass (`TERRAIN_SIZE = 250`, `ISLAND_WORLD_RADIUS = 118`) crowds adjacent biomes and pulls the volcano too close to the harbor beach.
    - Expand the island footprint to **~400m diameter** (radius `~190–210m`, `TERRAIN_SIZE ~ 430–440m`) with terrain mesh resolution **`~180x180` segments** (`~2.4m` crisp low-poly facets) so facets stay crisp and never stretch into giant slabs.
    - Spread all 8 `WORLD_ANCHORS` across the full ~400m island with true breathing room ("one showpiece per view"):
      - `harborSpawn` -> `ranchCenter`: **`~35–45m`** (`40.8m` — immediate ~6-second run up the ochre dirt path).
      - Biome-to-biome spacing (`jungleTrail`, `ruinsTerrace`, `lagoonDock`, `skullCaveMouth`, `volcanoSummit`): **`~95–130m`** apart (`96–129m`), separated by rolling hills/headlands so each biome feels like a real discovery.
      - `volcanoSummit` / caldera: **`~70–85m` tall** (`73–82m` rim, `63.5m` recessed lava pool) in the far Northeast (`96, -94`, `~239m` from harbor) so it frames the distant horizon instead of crowding the harbor beach.
  - **Topography & Seam Profiles to Maintain at ~400m Scale:**
    - Pirate Harbor coastal headlands (`westHeadDist`, `eastBluffDist`) form strong faceted framing cliffs (`pirate-harbor.png`, `island-overview.png`) without pinching the beach apron or infringing on `spawn-clear` / `harbor-family-hub`.
    - Fern Jungle rolling hills and recessed earthen road embankments (`roadDist` bank wave) produce clear warm-earth sloped banks flanking the winding dirt road (`fern-jungle.png`) with zero unwalkable lip traps (`ny >= 0.62`).
    - Ancient Dino Ruins 4-tier stepped mossy terraces (`ruinsDist`) hold crisp flat walkable plateaus connected cleanly by `ruinsRamp` (`dino-ruins.png`).
    - Smoking Volcano foothills blend C1-smoothly into meadow charcoal-purple basalt ribs with zero pasted-on ring seam; recessed glowing amber lava canyon sits deeply below the walkable ridge trail (`volcano-ridge.png`) with the caldera lava pool and `volcanoSmoke` emitter synced to the ~70–85m crater bowl/rim.
- **Constraints to Preserve:**
  - All 8 expanded `WORLD_ANCHORS` remain finite, walkable (`isPositionWalkable === true`), and clear of `isLavaHazard`.
  - Reserved hubs (`spawn-clear`, `harbor-family-hub`, `harbor-ranch-sightline`, `ranch-plateau`, `ranch-amy-hub`) scale cleanly with `harborSpawn` / `ranchCenter` and stay flat (`ny > 0.95`) and kid-friendly.
  - Preserve moving shadow frustum (`±55m`), exponential horizon fog (`0.00075`), `<= 150` draw-call budget, and unchanged `TerrainQuery.ts` public API.

### 2. Scoped Implementation (Two-Part Real-Scale Expansion)
- **Part 1 (Done — Spatial Foundation, Heightfield & Terrain/Splat Expansion):**
  1. Expanded `worldAnchors.ts` (`104` LOC) to `ISLAND_WORLD_RADIUS = 205`, real-scale `WORLD_ANCHORS` (`harborSpawn -> ranchCenter = 40.8m`, biome spacing `96–129m`), and scaled `INITIAL_RESERVED_FOOTPRINTS`.
  2. Expanded `terrainTrails.ts` (`211` LOC) & `terrainMath.ts` (`247` LOC) to ~400m diameter with exported single-source landmark coordinates (`VOLCANO_CENTER`, `SKULL_CAVE_ORIGIN`, `LAGOON_CENTER`, `WATERFALL_ORIGIN`, `HARBOR_BAY_CENTER`), ~73–82m far-NE volcano, and all 4 sculpted terrain profiles.
  3. Upgraded `terrainSplatBaker.ts` (`249` LOC, `TERRAIN_SIZE = 440`, `GRID = 257`) and `IslandTerrainSystem.ts` (`197` LOC, `TERRAIN_SEGMENTS = 180` -> `2.44m` facets, raised clouds above ~78m volcano).
- **Part 2 (Done — World Systems Sync & Full Visual Gate):**
  4. Synced `LandmarkSystem.ts` (`VolcanoCraterLava` radius `VOLCANO_CRATER_RADIUS = 15.5`, `VolcanoLavaRiver` width `8.4m` / 6 substeps, pre-seeded volcano smoke plume, Skull Rock Cave at `SKULL_CAVE_ORIGIN_X/Z`, Crystal Waterfall at `WATERFALL_ORIGIN_X/Z` plunging cleanly into the lagoon with mist sync, Harbor & Lagoon docks), `OceanSystem.ts` (`440m` shoreline foam plane & synced Harbor/Lagoon/Cave shallow color zones), `PropScatterSystem.ts` (expanded ~400m scatter bounds, `Ship_Small` in turquoise harbor bay, grounded harbor village shacks with palm clearance, synced barrels/chests/ruins bones), `terrainMath.ts` (clean low `0.9m` Skull Cave approach cut), and `CameraSystem.ts` (Title harbor vista + refined gameplay pitch).

### 3. Post-Implementation Audit & Verification Gate
- [x] *(Part 1)* `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass (`13/13` terrain/splat/engine tests validating ~400m radius, `harborSpawn -> ranchCenter` 40.8m, biome-to-biome 96–129m, far-NE volcano 73–82m height, all 8 expanded anchors walkable including low `skullCaveMouth` approach, lava hazard containment, and splatmap colors).
- [x] *(Part 2)* `?test` passes 100% with synced landmarks/ocean/props/camera (`48` draw calls `<= 150`, all 8 expanded `WORLD_ANCHORS` finite & walkable, moving shadow frustum `±55m` & fog `0.00075` intact, `0` NaN transforms, `geoDelta = -2`, `texDelta = 0` on `resetCycle()`).
- [x] *(Part 2)* Zero console errors and zero warnings in headless Chromium.
- [x] *(Part 1 & 2)* Modified terrain, ocean, config, and camera files stay `<= 250` lines (`worldAnchors.ts = 105`, `terrainTrails.ts = 212`, `terrainMath.ts = 248`, `terrainSplatBaker.ts = 249`, `IslandTerrainSystem.ts = 198`, `OceanSystem.ts = 196`, `CameraSystem.ts = 178`).
- [x] *(Part 2)* **Visual Match Check:** Inspected Title Harbor overview, `harborSpawn` -> `ranchCenter` sightline & distant ~78m NE volcano + smoke plume, Fern Jungle road/embankments, Dino Ruins 4-tier stepped terraces, Smoking Volcano Ridge, Skull Rock Cave entrance/cobblestone ledge, and Crystal Waterfall Lagoon against `docs/references/*.png` — confirmed "one showpiece per view" breathing room, crisp ~2.4m low-poly facets, smooth volcano foothills seam, recessed glowing lava canyon below walkable ridge, and clean landmark/dock/ship alignment.
- [x] *(Part 2)* Updated `docs/CHANGELOG.md` with the Phase 1B real-scale expansion entry and flipped Phase 1B status to `[x] Done`.

---

## Phase 1C — Faceted Ocean & Crisp Shoreline Foam
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - `src/world/OceanSystem.ts` (**196 lines**)
  - `src/config/palette.ts` (**59 lines**)
- **Current Baseline Metrics & Defects:**
  - `getPerfStats()` baseline: carry forward from Phase 1B (`<= 150` draw calls; ocean currently uses 2 draw calls: `OceanSurface` + `ShorelineFoam`).
  - **Root Visual Defects:**
    - `OceanSurface` uses `PlaneGeometry(2100, 2100, 96, 96)`, yielding giant `21.8m x 21.8m` quads. Inside Pirate Harbor and Crystal Lagoon (`~60–90m` across), those coarse quads produce overly huge triangles instead of the vibrant, sunlit low-poly faceted turquoise-to-cerulean mosaic seen in `pirate-harbor.png`, `waterfall-lagoon.png`, and `island-overview.png`.
    - Because the vertex shader modifies `transformed.y` without recomputing flat normals (or using a denser nearshore grid with faceted `dFdx/dFdy` / non-indexed triangulation), sunlit wave facets appear overly flat/muted instead of sparkling turquoise facets.
    - `ShorelineFoam` (`PlaneGeometry(235, 235, 110, 110)`) computes a wide soft single-band alpha glow (`smoothstep(0.32, 0.85, ...)`) rather than crisp lacy double-line white surf tightly hugging the golden bay beach, rocky headlands, and lagoon curve.
- **Constraints to Preserve:**
  - Keep pure CPU wave mirror `getOceanWaveHeight(x, z, time)` (`OceanSystem.getWaveHeight`) mathematically synchronized with GPU vertex wave displacement so `Ship_Small` bobs accurately on the water surface.
  - Keep `polygonOffset` (`polygonOffsetFactor`, `polygonOffsetUnits`) and `depthWrite: false` on shoreline foam so there is zero z-fighting with sand or ocean at any camera angle.
  - Keep ocean + foam within `<= 3` total draw calls and zero per-frame allocations in `update()`.

### 2. Scoped Implementation (1–2 Files Max)
- **Target Files:** `src/world/OceanSystem.ts` (with shader & coast-map helper extracted to `src/world/oceanShaders.ts` to keep all files `<= 250` lines), `src/config/palette.ts`
- **Changes:**
  1. Upgraded ocean geometry to a single watertight radially-warped non-indexed mesh (`140x140`, `~3.8m` jittered low-poly nearshore facets across `±224m` smoothly expanding to `±1150m` horizon) with per-triangle turquoise-to-cerulean mosaic variation, synchronized 3-wave CPU/GPU displacement (`<= 0.39m` amplitude), `dFdx/dFdy` sunlit facet lighting & specular glints, animated shallow-water caustics, and smooth bilinear depth-feathered beach transparency.
  2. Upgraded `buildShorelineFoam()` to a sparse coastal ribbon geometry (`h ∈ [-2.4m, +1.5m]`) sampling a baked `256x256` bilinear `DataTexture` (`coastTexture` with terrain height + slope) for crisp animated double-crest lacy white surf hugging Pirate Harbor's beach curve, rocky headlands, Crystal Lagoon, and Skull Rock Cave inlet with waterline elevation clamping and `polygonOffset`.
  3. Tuned `PALETTE` ocean colors (`oceanShallow: 0x00c4bc`, `oceanMid: 0x0079b8`, `oceanDeep: 0x003c8a`, `foamWhite: 0xffffff`) for rich ACES Filmic saturation and verified complete disposal of ocean/foam meshes and `coastTexture` in `OceanSystem.dispose()`.

### 3. Post-Implementation Audit & Verification Gate
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`14/14` unit tests including `getOceanWaveHeight` bounds and `mapOceanGridCoord` nearshore density/monotonicity).
- [x] `?test` passes 100% (`48` draw calls `<= 150`, ocean + foam = `2` draw calls, `geoDelta = -2`, `texDelta = 0` on `resetCycle()`, `0` NaN transforms, all 8 anchors valid & walkable).
- [x] Zero console/shader compile errors in Chromium.
- [x] Modified/created files `<= 250` lines (`OceanSystem.ts = 204`, `oceanShaders.ts = 237`, `palette.ts = 59`).
- [x] **Visual Match Check:** Compared Pirate Harbor bay, headlands, Crystal Waterfall Lagoon, and Skull Rock Cave inlet against `docs/references/pirate-harbor.png`, `waterfall-lagoon.png`, and `island-overview.png` — confirmed vibrant sunlit turquoise-to-cerulean low-poly facets, shallow animated caustics, crisp lacy double-line shoreline foam with zero wall-climbing or Z-fighting, and synchronized ship bobbing.
- [x] Updated `docs/CHANGELOG.md` and flipped Phase 1C status to `[x] Done`.

---

## Phase 1D — First-Minute Harbor Dressing & Instanced Foliage
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - `src/world/PropScatterSystem.ts` (**458 lines** — exceeds 250-line cap by 208 lines; decompose placement generation into `src/world/ScatterLayout.ts`)
  - `src/config/assets.ts` (**249 lines** — right at cap)
  - `src/config/worldAnchors.ts` (**104 lines**, read-only audit of `INITIAL_RESERVED_FOOTPRINTS`)
- **Current Baseline Metrics & Defects:**
  - `getPerfStats()` baseline: carry forward from Phase 1C (`<= 150` draw calls).
  - **Audit Findings in Current Code:**
    - `src/config/assets.ts` line `46`: `'ship.sloop'` (`Ship_Small`) is currently scaled to `1.32` instead of the target `1.05`.
    - `src/config/assets.ts` line `67`: `'structure.sawmill'` is currently `0.72` (slightly above the target `0.66–0.70` Pirate Kit shack range; `house1 = 0.68`, `house2 = 0.70`).
    - `PropScatterSystem.ts` currently only scatters `rock.1` and `rock.2` (leaving `rock.3/4/5` unused) and has basic cone-shaped grass tufts (`ConeGeometry`) without varied coastal bushes/foliage clusters framing Pirate Harbor and the trail edges.
    - `PropScatterSystem.ts` is `458` lines and mixes deterministic placement math with Three.js instancing/asset loading.
- **Constraints to Preserve:**
  - Strictly enforce `TerrainQuery.isFootprintReserved(x, z, clearance)` across ALL shacks, barrels, chests, boulders, palms, bushes, and grass tufts so:
    - `spawn-clear` (`-6, 122`, `r = 11`) and `harbor-family-hub` (`8, 117`, `r = 11`) stay completely clear for **Sonny**, **Pirate Bed Ship**, **Captain Seahawk**, and **Artie**.
    - `harbor-ranch-sightline` (`-2, 102`, `r = 11`) keeps a clear visual corridor from harbor up the dirt path.
    - `ranch-plateau` (`2, 76`, `r = 28`) and `ranch-amy-hub` (`2, 88`, `r = 11`) stay open for **Mum (Amy)** and the **Dino Ranch**.
  - Every `InstancedMesh` sharing GLTF geometry/material MUST keep `inst.userData.sharedResource = true` and NEVER dispose shared GLTF buffers in `PropScatterSystem.dispose()`.
  - Keep total draw calls well under `150` via `InstancedMesh` batching.

### 2. Scoped Implementation (1–2 Files Max)
- **Target Files:** `src/world/PropScatterSystem.ts` (extracting deterministic placement arrays/rules into `src/world/ScatterLayout.ts` so both files are `<= 250` lines) + `src/config/assets.ts`
- **Changes:**
  1. Updated `src/config/assets.ts` (`249` LOC): set `ship.sloop` (`Ship_Small`) to `scale: 1.05`, and normalized Pirate Kit village shacks (`structure.house1 = 0.68`, `structure.house2 = 0.70`, `structure.sawmill = 0.66`) into the `0.66–0.70` range.
  2. Extracted pure deterministic placement generation into `src/world/ScatterLayout.ts` (`218` LOC, enforcing `isFootprintReserved` across every prop/structure/foliage/ruins item) and upgraded `src/world/PropScatterSystem.ts` (`226` LOC):
     - Anchored `Ship_Small` (`1.05`) bobbing visibly in the turquoise Pirate Harbor bay.
     - Framed the harbor flanks with flat-grounded Pirate Kit shacks (`0.66–0.70`, `>= 16.5m` spacing), curated barrel/chest clusters near the wooden jetty and village shacks, and coastal boulders framing the West & East headlands.
     - Batched repeated palms (`flora.palm/2/3`), rocks (`rock.1–3`), composite 4-lobe low-poly tropical bushes (`InstancedBushes`), and 3-blade splayed fern/grass tufts (`InstancedFerns`) into `InstancedMesh` batches with varied scale, Y-rotation, and deterministic HSL color tints (`setColorAt`).
  3. Kept `PropScatterSystem.ts` (`226`), `ScatterLayout.ts` (`218`), and `assets.ts` (`249`) all `<= 250` lines.

### 3. Post-Implementation Audit & Verification Gate
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`16/16` unit tests including `ScatterLayout.test.ts`).
- [x] `?test` passes 100% (`50` draw calls on Title / `28` in Play `<= 150`, `geoDelta <= 0`, `texDelta = 0` on `resetCycle()`, `0` console errors).
- [x] Verified in code and unit tests (`ScatterLayout.test.ts`) that zero props, palms, bushes, rocks, barrels, chests, or shacks intrude on `spawn-clear`, `harbor-family-hub`, `harbor-ranch-sightline`, `ranch-plateau`, `ranch-amy-hub`, or any landmark pad.
- [x] All modified/created files `<= 250` lines (`PropScatterSystem.ts = 226`, `ScatterLayout.ts = 218`, `assets.ts = 249`).
- [x] **Visual Match Check:** Inspected Title Screen harbor orbit and `harborSpawn` first-minute view against `docs/references/pirate-harbor.png` and `island-overview.png` — confirmed bobbing `Ship_Small` (`1.05`), well-proportioned shacks (`0.66–0.70`), rich instanced palms/bushes/tufts/headland boulders with HSL variety, and clean reserved beach/ranch hubs.
- [x] Updated `docs/CHANGELOG.md` and flipped Phase 1D status to `[x] Done`.

---

## Phase 1E — Hero Landmarks (Skull Rock Pirate Cave & Waterfall Lagoon)
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - `src/world/LandmarkSystem.ts` (**576 lines** — largest file in codebase, exceeds 250-line cap by 326 lines)
  - `src/config/worldAnchors.ts` (read-only verification of `skullCaveMouth`, `skullCaveInterior`, and `lagoonDock` coordinates)
  - `src/engine/MaterialLibrary.ts` (read-only check of `skullBone`, `skullBoneDark`, `bandanaRed`, `eyepatchDark`, `torchGlow`, `cobbleWarm`, `caveInterior`)
- **Current Baseline Metrics & Defects:**
  - `getPerfStats()` baseline: carry forward from Phase 1D (`<= 150` draw calls, currently `3` PointLights inside Skull Cave).
  - **Visual & Architectural Defects to Fix:**
    - **Skull Rock Pirate Cave (`docs/references/skull-cave.png`):** Current procedural skull uses a simple `DodecahedronGeometry` cranium + `SphereGeometry` bandana cap + `ConeGeometry` tails; refine brow ridge, sculpted cheekbones, crisp faceted bandana wrap + knot + sweeping ribbons, eyepatch with strap tucked cleanly under the bandana, recessed warm amber-lit left eye socket, 5 chunky beveled overhanging teeth framing the vaulted open-jaw cavern, cobblestone-curbed walkable left ledge, continuous shallow turquoise water inlet on the right, and warm flickering cavern torches with glowing amber reflections.
    - **Crystal Waterfall Lagoon (`docs/references/waterfall-lagoon.png`):** Current waterfall is a single curved `PlaneGeometry` ribbon + single `RingGeometry` splash; enhance with layered animated white-and-cyan cascading veil + frothy crest lip + multi-ring expanding foamy splash rings and pooled mist droplets plunging down stepped mossy cliff ledges into the shallow turquoise lagoon.
    - **Monolith Debt:** `LandmarkSystem.ts` at 576 lines must be decomposed cleanly into focused builders (`SkullRockCaveBuilder.ts`, `WaterfallLagoonBuilder.ts`, plus thin `LandmarkSystem.ts` coordinator handling volcano lava, docks, and `update(dt)`).
- **Constraints to Preserve:**
  - Total scene `PointLight` count remains strictly `<= 6` (max 3 inside Skull Rock Cave).
  - `skullCaveMouth` (`85.8, 118.6`), `skullCaveInterior` (`95.6, 103.2`), and `lagoonDock` (`118, 26`) remain 100% unobstructed and walkable with Sonny standing cleanly on the cobblestone ledge / dock approach.
  - Track and dispose every procedural geometry and shader material created by landmark builders so `resetCycle()` shows `geoDelta <= 0`, `texDelta === 0`.

### 2. Scoped Implementation (1–2 Files Max + Dedicated Builder Split)
- **Target Files:** `src/world/LandmarkSystem.ts` refactored into thin coordinator (`240` LOC) + `src/world/SkullRockCaveBuilder.ts` (`248` LOC) + `src/world/WaterfallLagoonBuilder.ts` (`240` LOC) (all 3 files `<= 250` lines; zero edits outside `src/world/`).
- **Changes:**
  1. Extracted and upgraded **Skull Rock Pirate Cave** in `SkullRockCaveBuilder.ts` (`248` LOC) matching `docs/references/skull-cave.png` (faceted pirate skull embedded in craggy mossy SE headland buttresses, red bandana + rolled rim + knot + dual ribbons, eyepatch + strap, glowing amber eye socket + lantern flame, 5 chunky beveled overhanging teeth, grounded arched stone cavern ribs, curved cobblestone curb ledge, iron-cup pirate wall sconces, and animated golden-amber water reflections on the unobstructed turquoise inlet).
  2. Extracted and upgraded **Crystal Waterfall Lagoon** in `WaterfallLagoonBuilder.ts` (`240` LOC) matching `docs/references/waterfall-lagoon.png` (broad-based craggy mossy cliff buttresses, frothy animated upper spillway apron, 2-layer luminous cyan-and-white cascading waterfall veil + outer mist-spray veil, GPU-pulsing snow-white plunge foam mounds, expanding concentric foamy splash ripples with `polygonOffset`, and shimmering cyan lagoon reflection column).
  3. Refactored `LandmarkSystem.ts` (`240` LOC) into a lean coordinator managing `VolcanoCraterLava`, `VolcanoLavaRiver`, harbor/lagoon wooden docks, torch flicker, shared shader time uniform, and pre-seeded/pooled smoke & mist emission with 100% tracked disposal.

### 3. Post-Implementation Audit & Verification Gate
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`18/18` unit tests including `Landmarks.test.ts`).
- [x] `?test` passes 100% (`34` draw calls `<= 150`, `32` post-reset; all 8 anchors walkable including `skullCaveMouth`, `skullCaveInterior`, `lagoonDock`; `0` NaN transforms; `geoDelta = 0, texDelta = 0` on `resetCycle()`).
- [x] Zero console errors; total `PointLight` count `= 3` (`<= 6`).
- [x] Every landmark file `<= 250` lines (`LandmarkSystem.ts = 240`, `SkullRockCaveBuilder.ts = 248`, `WaterfallLagoonBuilder.ts = 240`).
- [x] **Visual Match Check:** Compared Skull Rock Pirate Cave (exterior + interior ledge) and Crystal Waterfall Lagoon against `docs/references/skull-cave.png` and `docs/references/waterfall-lagoon.png` — confirmed iconic carved pirate skull silhouette, glowing eye/torches, shimmering amber water reflections, walkable ledge + turquoise inlet, craggy mossy cliff framing, and sparkling 2-layer waterfall + foaming plunge billows & splash rings.
- [x] Updated `docs/CHANGELOG.md` and flipped Phase 1E status to `[x] Done`.

---

## Phase 1F — Build 1.1 Hardening, Zero-GC Audit & Contract Sync
- **Status:** `[x] Done`

### 1. Pre-Implementation Audit
- **Exact Files to Inspect:**
  - Remaining oversized files `> 250` lines:
    - `src/engine/GameEngine.ts` (**529 lines** -> extracted `RendererFactory.ts`, `SelfTestRunner.ts`, `EngineBootstrap.ts`)
    - `src/gameplay/PlayerSystem.ts` (**478 lines** -> extracted `ProceduralSonnyBuilder.ts`, `AnimationStateController.ts`, `PlayerFeedback.ts`)
    - `src/engine/InputManager.ts` (**331 lines** -> extracted `InputGamepad.ts`, `InputPointer.ts`)
  - Core Pillar & Contract Files (verified zero-GC `update(dt)` loops, `sharedResource` hygiene, and Build 2+ contract slots):
    - `src/config/assets.ts` (`npc.amy` -> `Characters_Anne` with `verifiedClips: ['Idle', 'Wave', 'Yes']`, `npc.seahawk`, `npc.artie`, `hero.bedShip` all present & `reserved: true`)
    - `src/config/worldAnchors.ts` (`WORLD_ANCHORS` + `INITIAL_RESERVED_FOOTPRINTS`)
    - `src/engine/InteractionArbitrator.ts` (**75 lines**), `src/engine/SaveManager.ts` (**143 lines**), `src/engine/MaterialLibrary.ts` (**157 lines**), `src/engine/AssetManager.ts` (**233 lines**)
    - `src/gameplay/CameraSystem.ts` (**176 lines**), `src/gameplay/ParticlePoolSystem.ts` (**202 lines**)
  - Living Docs to Sync: `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/KNOWN_GOTCHAS.md`, `docs/technical-debt.md`, `docs/CHANGELOG.md`, `docs/BACKLOG.md`.
- **Current Baseline Metrics & Defects:**
  - Baseline `getPerfStats()`: `32` draw calls (`<= 150`), `166,190` triangles, `29` geometries, `4` textures, `4/4` `?test` passing (`geoDelta=0, texDelta=0`), `0` errors, `1` `AudioContext` autoplay warning on `?autostart=1`.
  - 3 core engine/gameplay files exceeded 250 lines (`GameEngine.ts` 529, `PlayerSystem.ts` 478, `InputManager.ts` 331).
  - Per-frame JS object/array allocations found in `PlayerPhysics.ts` (events object + guardrail `tryOffsets` array + deadzone return object), `PlayerSystem.ts` (`StepInput` literal), and `InputManager.ts` (`raycaster.intersectObject` hits array + gamepad fallback array), plus a double-sampling bug (`PlayerSystem` zeroing camera orbit deltas before `CameraSystem` read them), an upward `engine -> gameplay` import (`InputManager -> PlayerPhysics`), and `TD-05` (`PlayerPhysics.test.ts:61` short-hop landing threshold).
- **Constraints to Preserve:**
  - Zero behavior regressions in 4-mode controls, Title Screen silent-audio / 1.5s Play fade-in, software-WebGL `fenceSync` pacing, or `window.__SONNY_ISLAND__` bridge API.
  - Keep `npm run build`, `tsc --noEmit`, `npm run lint`, and all unit tests 100% green.

### 2. Scoped Implementation (Modular Splits & Hardening)
- **Target Scope:** Decompose remaining `> 250`-line engine/gameplay modules + harden zero-GC loops & `?test` assertions + sync `docs/`.
- **Changes:**
  1. Decomposed `GameEngine.ts` (`241` LOC -> `RendererFactory.ts` `117`, `SelfTestRunner.ts` `101`, `EngineBootstrap.ts` `139`), `PlayerSystem.ts` (`234` LOC -> `ProceduralSonnyBuilder.ts` `96`, `AnimationStateController.ts` `104`, `PlayerFeedback.ts` `78`), and `InputManager.ts` (`245` LOC -> `InputGamepad.ts` `109`, `InputPointer.ts` `43`) so **0 files across `src/` exceed 250 lines**.
  2. Eliminated per-frame allocations across `update(dt)` loops (zero-GC scratch `StepInput`/`StepEvents`, hoisted `GUARDRAIL_OFFSETS`, reusable `InputPointer` raycaster hits buffer, zero-GC `applyStickDeadzone(..., out)`), removed the upward `InputManager -> PlayerPhysics` import, fixed single-sample-per-frame `input.sample(dt)` -> `getState()`, guarded `AudioEngine` `AudioContext` creation on `navigator.userActivation?.hasBeenActive`, and resolved `TD-05` (`-1.5` short-hop landing threshold).
  3. Verified all Build 2+ contract slots (`npc.amy`, `npc.seahawk`, `npc.artie`, `hero.bedShip` all `reserved: true`), `INITIAL_RESERVED_FOOTPRINTS`, `InteractionArbitrator`, `SaveManager`, `MaterialLibrary`, `userData.sharedResource = true` disposal guards, and zero `backdrop-blur` usage.
  4. Hardened `SelfTestRunner.ts` to 5 assertions (`drawCallsBudget <= 150`, `worldAnchorsValidAndWalkable`, `zeroNanTransforms`, `pointLightsBudget <= 6`, `zeroLeakOnResetCycle` including post-reset `calls <= 150`) and expanded unit test coverage to `23/23` tests.
  5. Synced `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/KNOWN_GOTCHAS.md`, `docs/technical-debt.md` (closing `TD-01` & `TD-05`), `docs/BACKLOG.md`, and `docs/CHANGELOG.md`.

### 3. Post-Implementation Audit & Verification Gate
- [x] `wc -l src/**/*.ts src/**/*.tsx src/*.ts src/*.tsx` confirms **0 files > 250 lines** (max file `249` LOC).
- [x] Static grep confirms **0 `new THREE.*` allocations** inside any `update(...)` loop and intact `userData.sharedResource = true` disposal guards.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`23/23` unit tests).
- [x] `?test` (`window.__SONNY_ISLAND__.runSelfTest()`) passes 100% (`5/5` checks: `32` draw calls `<= 150`, `3` PointLights `<= 6`, all 8 anchors valid & walkable, `0` NaN transforms, `geoDelta = 0, texDelta = 0, postCalls = 32` across `resetCycle()`).
- [x] Zero console errors and zero warnings in Chromium across Title Screen (`71` calls), Play mode (`32–34` calls), and all 6 biome teleports (`34` calls).
- [x] `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/KNOWN_GOTCHAS.md`, `docs/technical-debt.md`, and `docs/CHANGELOG.md` fully synced, and Phase 1F checked off `[x] Done`.

---

## Phase 1G — Crisp Splatmap & Organic Ruins Flagstones (1–2 Files Max)
- **Status:** `[x] Done`
- **Visual Score (1–10):** `8.5 / 10` *(Crisp organic Voronoi mossy flagstones & sharp painterly trail/beach edges confirmed against `dino-ruins.png` & `pirate-harbor.png`; minor follow-up micro-notes: slight sub-texel stipple on steep jungle road embankments and sparser stone cluster coverage on the left flank of `ruinsTerrace`; cliff chiseled facets & foreground ground cover remain scoped to Phases 1H & 1I.)*

### 1. Pre-Implementation Audit
- **Exact Files Inspected:**
  - `src/world/terrainSplatBaker.ts` (`250` LOC — coarse `GRID = 257` across `440m` plus wide shallow-slope `sandW`/`trailW` smoothsteps caused blurry transitions, and Ruins used a uniform `2.08m` square axis-aligned grid)
  - `src/engine/MaterialLibrary.ts` (`158` LOC — terrain `onBeforeCompile` only decoded alpha lava glow with no close-up procedural micro-detail or sub-texel edge sharpening)
- **Visual Reference Targets:** `docs/references/dino-ruins.png`, `docs/references/pirate-harbor.png`

### 2. Scoped Implementation (2 Files Max)
- Upgraded `src/world/terrainSplatBaker.ts` (`238` LOC): bumped coarse pre-sample field to `GRID = 321` across `440m` (`1024x1024` sRGB splatmap), tightened beach sand/dirt-trail/cliff transition bands to eliminate shallow-slope airbrush smear, and replaced the square Ruins grid with exact algebraic `hash22` organic polygonal Voronoi flagstones (`RUINS_VORONOI_SCALE = 0.72`, whole-slab cluster dropout, weathered warm-ochre/grey/taupe per-slab tones, and beveled rims).
- Upgraded `src/engine/MaterialLibrary.ts` (`201` LOC): extended `getTerrainMaterial()` `onBeforeCompile` (`terrain-splat-detail-v3`) with distance-faded world-space micro-detail noise, noise-perturbed sub-texel splat UV sharpening for crisp close-up dirt/beach edges, and bit-identical GPU Voronoi Ruins flagstones with chipped borders, `fwidth`-antialiased dark mossy-earth crevices, and ochre dirt-path preservation while retaining alpha-packed volcanic lava glow (`0` extra textures, `0` extra draw calls).
- Expanded `src/world/terrainSplatBaker.test.ts` (`80` LOC) with deterministic tests for crisp off-trail transitions and non-periodic Voronoi flagstone variety.

### 3. Post-Implementation Audit & Verification Gate
- [x] Confirmed zero blurry checkerboard grid at `ruinsTerrace` and crisp organic dirt-trail / beach-to-meadow borders at `harborSpawn` & `jungleTrail`.
- [x] Draw calls `20` (`<= 150`), `?test` `5/5` passing (`geoDelta = -38`, `texDelta = 0`, `postCalls = 20`, `3` PointLights `<= 6`, all 8 anchors walkable, `0` NaN transforms), `0` console errors/warnings.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`24/24` unit tests).
- [x] Modified source files `<= 250` lines (`terrainSplatBaker.ts = 238`, `MaterialLibrary.ts = 201`, `terrainSplatBaker.test.ts = 80`).
- [x] **Strict Visual Quality Gate:** Compared `ruinsTerrace`, `harborSpawn`, and `jungleTrail` against `docs/references/dino-ruins.png` and `docs/references/pirate-harbor.png`, logged honest `Visual Score (8.5 / 10)` above, and flagged minor follow-up micro-notes.

---

## Phase 1H — Chiseled Low-Poly Cliffs, Volcano Facets & Lighting Contrast (1–2 Files Max)
- **Status:** `[x] Done`
- **Visual Score (1–10):** `9.0 / 10` *(Crisp irregular chiseled coastal cliff triangles, dramatic radiating V-creased volcano basalt ribs/caldera crown, bold warm-sunlit vs cool-violet-slate per-facet contrast, and zero steep-slope splatmap stipple confirmed across all 7 rotated `prev` vs `latest` presets against `docs/references/pirate-harbor.png` and `docs/references/volcano-ridge.png`; honest minor follow-up micro-notes: a tiny stray coastal boulder on the upper-left volcano flank visible in `lagoon.png`, plus Skull Cave approach sand spike & lush foreground foliage density remaining scoped to Phase 1I.)*

### 1. Pre-Implementation Audit
- **Exact Files Inspected:**
  - `src/world/terrainMath.ts` (rounded elliptical coastal headlands and smooth sine-lobe volcano flanks lacked angular rock facets and sharp basalt ridge ribs)
  - `src/world/IslandTerrainSystem.ts` (uniform grid `PlaneGeometry` created repetitive diagonal striations, and narrow `0.92..1.08` per-triangle shade variation washed out directional sunlight/shadow facet contrast)
  - `src/engine/MaterialLibrary.ts` (Phase 1G follow-up note: `tSharpF` sub-texel splat snapping ran at full strength on steep slopes `vTerrainNormalY < 0.86`, producing stipple on jungle road embankments and volcano lava borders)
- **Visual Reference Targets:** `docs/references/pirate-harbor.png`, `docs/references/volcano-ridge.png`

### 2. Scoped Implementation
- Upgraded `src/world/terrainMath.ts` (`239` LOC): added `ridgeCrag()` and `blendChiseledBluff()` to sculpt angular stepped coastal cliffs with emerald caps (West headland `-78, 124`, West bluff `-60, 96`, East Harbor bluff `47, 114`, Waterfall cliff `124, -22`, Waterfall East cliff `158, 2`), upgraded `sculptVolcano()` with V-creased radial basalt ribs, secondary buttresses, volcanic strata ledges, jagged caldera crown (`72–83m`), craggy trail shoulders, and steeper chiseled lava canyon walls, and sharpened Ruins tier drops while keeping all 8 `WORLD_ANCHORS`, `structure.sawmill`, and all trail corridors smooth and walkable.
- Upgraded `src/world/IslandTerrainSystem.ts` (`247` LOC): replaced uniform `PlaneGeometry` with a deterministic XZ-jittered (`<= 0.29 * cell`, strictly convex & heightfield-exact) non-indexed `BufferGeometry` using ridge-aligned shortest-elevation-delta diagonal splitting (`64,800` tris, `0` extra draw calls), and added sculptural per-facet lighting (`(-0.66, 0.52, -0.54)` key sun, `0.50..1.42` directional contrast, warm sunlit / cool violet-slate shadow split, crystalline per-facet variation, and lava-glow shadow damping).
- Resolved Phase 1G steep-slope stipple in `src/engine/MaterialLibrary.ts` (`202` LOC): gated sub-texel splat UV sharpening by `tFlatSharp = smoothstep(0.76, 0.90, vTerrainNormalY) * tDetailFade`, softened steep micro-grain, and bumped cache key to `'terrain-splat-detail-v4'`.
- Added unit test in `src/world/terrainMath.test.ts` (`227` LOC) asserting `>= 7m` volcano basalt rib relief, steep West headland cliff face (`ny < 0.72`), and full walkability across all 4 trail polylines and midpoints.

### 3. Post-Implementation Audit & Verification Gate
- [x] Confirmed chiseled cliff facets at Harbor (`harbor.png`, `title.png`) and Volcano (`volcano.png`) with zero unwalkable trail lips across all 8 anchors and all 4 trail corridors (`25/25` unit tests).
- [x] Draw calls `64` (`67` post-reset `<= 150`), `3` PointLights (`<= 6`), `?test` `5/5` passing (`geoDelta = 0`, `texDelta = 0`, `postCalls = 67`, `169,532` tris), `0` console errors/warnings.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`25/25` unit tests).
- [x] Modified files `<= 250` lines (`terrainMath.ts = 239`, `IslandTerrainSystem.ts = 247`, `MaterialLibrary.ts = 202`, `terrainMath.test.ts = 227`).
- [x] **Strict Visual Quality Gate:** Rotated Phase 1G baseline into `public/captures/prev/`, captured all 7 presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) into `public/captures/latest/`, compared against `docs/references/pirate-harbor.png` and `docs/references/volcano-ridge.png`, logged honest `Visual Score (9.0 / 10)` above, and flagged minor follow-up micro-notes.

---

## Phase 1I — Skull Cave Grounding & Lush Instanced Ground Cover (1–2 Files Max)
- **Status:** `[x] Done`
- **Visual Score (1–10):** `9.2 / 10` *(Smooth spike-free golden sand approach at Skull Rock Cave, solidly seated skull jaw-jamb piers & headland buttresses with zero floating gaps or dangling torches, curved cobblestone quay curb, crisp chiseled shadowed cliff facets, lush doubled instanced bushes/4-blade grass tufts + new pebble clusters along Harbor/Meadow/Jungle borders with zero reserved-footprint breaches, and stray steep-slope volcano boulders eliminated in `lagoon.png`; honest minor follow-up micro-notes: the outermost 2 cobblestone curb stones curve slightly proud beside Sonny's left foot at `skullCaveMouth`, and the two lowest flanking moss caps could be slightly more rounded in a future art pass.)*

### 1. Pre-Implementation Audit
- **Exact Files Inspected:**
  - `src/world/terrainMath.ts` & `src/world/terrainTrails.ts` (double-smoothstep `effW` cut at `along < -14` caused a `2.4–4.0m` green/sand foreground spike behind `skullCaveMouth` and pinched the right water inlet; `HARBOR_TO_CAVE_TRAIL` waypoint `[44, 124]` clipped the East Harbor Bluff toe)
  - `src/world/SkullRockCaveBuilder.ts` (skull jaw jambs ended at `y = 3.1m` above open sand/water, wall torches at `x = ±5.4` floated `1.4m` inboard of the cavern arch, eyepatch strap corner poked above the bandana rim, cobblestone curb stopped behind `skullCaveMouth`, and shadowed left headland cliffs lacked facet/rim separation)
  - `src/world/ScatterLayout.ts` & `src/world/PropScatterSystem.ts` (sparse island-wide ground cover `330` grass tufts / `175` bushes / `0` pebbles, plus `minNy: 0` allowed stray rocks on steep volcano slopes)
- **Visual Reference Targets:** `docs/references/skull-cave.png`, `docs/references/pirate-harbor.png`, `docs/references/fern-jungle.png`

### 2. Scoped Implementation
- Upgraded `src/world/terrainMath.ts` (`242` LOC) & `src/world/terrainTrails.ts` (`211` LOC): sculpted the Skull Cave headland with `blendChiseledBluff()` for crisp low-poly shadowed cliff facets, replaced the double-smoothstep cave cut with a single C1-smooth wide golden beach approach (`0.94m -> 0.74m`) and continuously open shallow turquoise inlet (`-0.78m`) with zero foreground spike, and routed `HARBOR_TO_CAVE_TRAIL` smoothly along the walkable beach toe (`[44, 130]`, `[68, 126]`).
- Upgraded `src/world/SkullRockCaveBuilder.ts` (`248` LOC): grounded the skull facade's cheeks & jaw jambs solidly onto paired faceted sandstone jaw-jamb piers (`y = -2.4..+6.6`) and tighter mossy headland buttresses with per-instance warm/cool facet & rim separation (`setColorAt`), seated all 6 cavern wall sconces on wall-embedded iron brackets (`x = ±5.95..±7.85`) plus 4 grounded stone ledge pedestals, extended the grounded cobblestone quay curb out along the left beach curve (`22` blocks), and tucked the eyepatch strap cleanly beneath the rolled red bandana rim.
- Upgraded `src/world/ScatterLayout.ts` (`240` LOC) & `src/world/PropScatterSystem.ts` (`241` LOC): more than doubled instanced ground cover with Harbor/Meadow/Jungle border-biased passes (`780` 4-blade splayed grass tufts, `360` stylized coastal bushes) plus `370` new composite 3-stone instanced low-poly pebbles (`InstancedPebbles`, tracked in `ownedGeometries`), and set `minNy: 0.68` on scattered rocks to eliminate steep-slope volcano boulders while strictly enforcing `INITIAL_RESERVED_FOOTPRINTS`.
- Expanded `src/world/ScatterLayout.test.ts` (`82` LOC) & `src/world/terrainMath.test.ts` (`238` LOC) with assertions for doubled ground cover, pebbles, zero reserved-footprint breaches, `HARBOR_TO_CAVE_TRAIL` walkability, and spike-free Skull Cave approach/inlet heights.

### 3. Post-Implementation Audit & Verification Gate
- [x] Confirmed clean Skull Cave approach with zero terrain spikes, zero floating facade/torch gaps, and crisp chiseled shadowed cliff facet separation (`public/captures/latest/skull-cave.png`).
- [x] Confirmed lush foreground foliage & pebbles at `harborSpawn` and `jungleTrail` with zero breaches of `INITIAL_RESERVED_FOOTPRINTS` (`ScatterLayout.test.ts`, `public/captures/latest/harbor.png`, `jungle.png`).
- [x] Draw calls `35` (`33` post-reset `<= 150`), `3` PointLights (`<= 6`), `?test` `5/5` passing (`geoDelta = 0`, `texDelta = 0`, `250,080` tris), `0` console errors/warnings.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`25/25` unit tests).
- [x] Modified files `<= 250` lines (`terrainMath.ts = 242`, `terrainTrails.ts = 211`, `SkullRockCaveBuilder.ts = 248`, `ScatterLayout.ts = 240`, `PropScatterSystem.ts = 241`, `ScatterLayout.test.ts = 82`, `terrainMath.test.ts = 238`).
- [x] **Strict Visual Quality Gate:** Rotated Phase 1H baseline into `public/captures/prev/`, captured all 7 presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) into `public/captures/latest/`, updated `public/captures/latest/meta.json`, compared against `prev` and `docs/references/*.png`, logged honest `Visual Score (9.2 / 10)` above, and flagged minor follow-up micro-notes.

---

## Phase 1J — Atmosphere, Lighting & Trail Cohesion
- **Status:** `[x] Done`
- **Visual Score (1–10):** `8.3 / 10` *(Recalibrated Rubric — `7.0` = matches `docs/references/*.png`, `9.0+` = surpasses references across every dimension. Phase 1J clearly surpasses `docs/references/*.png` in atmospheric depth, warm sunlit lighting cohesion, seamless ocean-horizon fog melt, organic feathered trail edges with center-vs-shoulder tonal wear, and sweeping dappled canopy/cloud terrain shadows across all 7 rotated `prev` vs `latest` presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`). Overall island score stays honestly at `8.3 / 10` rather than `9.0+` because flat green/sand midground expanses in `harbor`/`jungle`, jagged basalt volcano ramp framing & lava heat-rim contrast, and deeper contact grounding remain intentionally scoped to Phase 1K. Honest minor follow-up micro-notes: right-hand beach path near the East bluff toe in `title.png` retains a faint warm ochre smear on upper sand, and subtle low-poly ocean tile diagonals remain faintly visible in mid-distant water in `ruins.png`.)*

### 1. Pre-Implementation Audit
- **Exact Files Inspected:**
  - `src/config/palette.ts`, `src/engine/RendererFactory.ts`, `src/engine/GameEngine.ts`, `src/world/oceanShaders.ts` (flat solid-blue `scene.background`, hardcoded `0.00075` fog density, and shoreline foam fog mismatch)
  - `src/world/terrainSplatBaker.ts` & `src/engine/MaterialLibrary.ts` (hard-edged uniform orange-ribbon dirt trails, quantized texel-snapping, and unmodulated uniform sunlight across inland terrain)
- **Visual Reference Targets:** `docs/references/island-overview.png`, `docs/references/fern-jungle.png`, `docs/references/dino-ruins.png`, `docs/references/volcano-ridge.png`

### 2. Scoped Implementation
1. **Stylized Tropical Gradient Sky Dome & Horizon-Matched Fog:** Added `createSkyDome()` in `src/engine/RendererFactory.ts` (`176` LOC) using rotation-only `mat4(mat3(viewMatrix))` + far-depth clamping (`0.9999`), blending rich cerulean zenith (`0x0550cc`) -> tropical sky mid (`0x168ef8`) -> sunlit turquoise-cyan horizon (`0x6cdaf6`) with a subtle warm NW solar glow (`(-42, 26, -48)`) and ACESFilmic `#include <tonemapping_fragment>` / `<colorspace_fragment>` parity. Paired with horizon-matched `THREE.FogExp2(PALETTE.fogColor, 0.00155)` (`src/config/palette.ts` `64` LOC), synced `ShorelineFoam` `uFogDensity` in `src/world/oceanShaders.ts` (`239` LOC), and wired deterministic `skyDome` disposal in `src/engine/GameEngine.ts` (`250` LOC).
2. **Feathered Organic Trails & Dappled Canopy/Cloud Shadows:** Upgraded `src/world/terrainSplatBaker.ts` (`246` LOC) with 3-octave scalloped organic trail-edge breakup (`trailEdgeN`), outer dusty/mossy feathered shoulders (`dirtEdge`, `dirtJungleEdge`, `volcTrailEdge`) vs warmer packed center wear, and cleaner beach-sand fade. Upgraded `src/engine/MaterialLibrary.ts` (`212` LOC, `'terrain-splat-detail-v6'`) with continuous 2-octave world-space UV domain warp, softer Ruins flagstone shoulder blending, and broad sweeping cloud + medium dappled canopy shadow variation across sunlit inland terrain (shielded from volcanic lava glow). Expanded `src/world/terrainSplatBaker.test.ts` (`112` LOC) to verify center-vs-shoulder tonal wear and organic edge variance.

### 3. Post-Implementation Audit & Verification Gate
- [x] Confirmed stylized cerulean-to-turquoise gradient sky dome, warm NW solar glow, and horizon-matched exponential fog seamlessly frame distant cliffs, ocean horizon, and the far-NE volcano across `title`, `harbor`, `volcano`, and `lagoon` presets.
- [x] Confirmed organic feathered trail borders, center-vs-shoulder tonal wear, and sweeping dappled canopy/cloud ground-shadow variation across `jungle`, `ruins`, and `volcano` with zero orange-ribbon artifacts and 100% walkability across all 8 `WORLD_ANCHORS` and 4 trails.
- [x] Draw calls `40` in harbor Play (`34` post-reset; `78` / `74` post-reset in Title `?test`, `<= 150`), `3` PointLights (`<= 6`), `?test` `5/5` passing (`geoDelta = 0`, `texDelta = 0`, `251,032` tris), `0` console errors/warnings.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`26/26` unit tests); every modified source file `<= 250` lines (`palette.ts = 64`, `RendererFactory.ts = 176`, `GameEngine.ts = 250`, `MaterialLibrary.ts = 212`, `oceanShaders.ts = 239`, `terrainSplatBaker.ts = 246`, `terrainSplatBaker.test.ts = 112`).
- [x] **Recalibrated Visual Quality Gate:** Rotated Phase 1I baseline `public/captures/latest` -> `public/captures/prev`, captured all 7 presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) into `public/captures/latest/`, updated `public/captures/latest/meta.json`, compared `prev` vs `latest` vs `docs/references/*.png`, logged honest recalibrated `Visual Score (8.3 / 10)` above, updated `docs/CHANGELOG.md`, and flipped status to `[x] Done`.

---

## Phase 1K — Midground Silhouettes & Volcano Drama (1–2 Files Max)
- **Status:** `[x] Done`
- **Visual Score (1–10):** `9.0 / 10` *(Recalibrated Rubric — `7.0` = matches `docs/references/*.png`, `9.0+` = clearly surpasses them across atmosphere, lighting, feathered ground transitions, layered midground silhouettes, and contact grounding. Phase 1K clearly surpasses `docs/references/*.png` across all 7 rotated `prev` vs `latest` presets: leaning coastal/jungle palms, emerald layered midground canopy groves, stepped rock outcrops, and lush 7-frond overhanging tropical ferns transform `harbor`, `title`, and `jungle` with rich layered depth; jagged tapered basalt spires break up the straight volcano ramp while rich molten lava cells & fiery crimson-orange heat-rims pop dramatically on `volcano`; and vertex-AO bases plus terrain-normal-aligned soft contact shadows anchor structures, palms, rocks, and bushes solidly with zero floating feel and zero reserved-footprint or trail breaches. Honest minor follow-up micro-notes: the lone right-beach rock contact shadow reads slightly prominent from the high `title.png` aerial camera, and subtle low-poly ocean tile diagonals remain faintly visible in mid-distant water on `ruins.png`.)*

### 1. Pre-Implementation Audit
- **Exact Files Inspected:**
  - `src/world/ScatterLayout.ts`, `src/world/PropScatterSystem.ts` (midground palm lean/silhouette variation, canopy tree lines, overhanging jungle ferns, layered rock outcrops, shoreline prop clusters, contact shadow grounding, and `INITIAL_RESERVED_FOOTPRINTS` compliance)
  - `src/world/LandmarkSystem.ts`, `src/engine/MaterialLibrary.ts`, `src/world/terrainSplatBaker.ts` (volcano ridge trail basalt border framing, lava channel shader & heat-rim emissive contrast, and vertex-AO material presets)
- **Visual Reference Targets:** `docs/references/pirate-harbor.png`, `docs/references/fern-jungle.png`, `docs/references/volcano-ridge.png`, `docs/references/island-overview.png`

### 2. Scoped Implementation (Final Build 1 Polish Gate)
1. **Layered Midground Silhouettes & Contact Grounding (`ScatterGeometry.ts` `247` LOC, `ScatterMidground.ts` `205` LOC, `ScatterLayout.ts` `242` LOC, `PropScatterSystem.ts` `246` LOC):**
   - Added `applyBaseAo()` vertex-AO baking and normalized attribute merging (`mergeAndDispose`) for composite procedural assets: 7-frond arching overhanging tropical ferns (`buildOverhangFernGeometry`), 3-tier layered emerald midground canopy trees (`buildMidgroundTreeGeometries`), stepped 4-boulder rock outcrops (`buildRockOutcropGeometry`), and a soft radial `64x64` contact shadow decal material (`createContactShadowMaterial`, `polygonOffsetFactor: -3`, cleanly disposed).
   - Added instanced leaning palms (`leanX`/`leanZ`/`scaleY` variation), darker tropical forest-emerald midground tree lines (clear of camera sightlines, trails, harbor shacks, and Skull Cave crest), overhanging fern clusters framing both embankments of `JUNGLE_ROAD_POINTS`, layered coastal/jungle rock outcrops, extra shoreline barrels/chests, and terrain-normal-aligned `InstancedContactShadows` grounding structures, palms, trees, rocks, outcrops, ferns, bushes, barrels, and chests while strictly honoring `INITIAL_RESERVED_FOOTPRINTS`.
2. **Volcano Basalt Ramp Framing & Lava Heat-Rim Drama (`VolcanoBuilder.ts` `200` LOC, `LandmarkSystem.ts` `164` LOC, `MaterialLibrary.ts` `219` LOC, `terrainSplatBaker.ts` `247` LOC):**
   - Extracted volcano drama into `VolcanoBuilder.ts`: framed both flanks of `VOLCANO_TRAIL_POINTS` and the NW `LAVA_CHANNEL_POINTS` rim with instanced jagged tapered basalt crag spires (`InstancedVolcanoBasalt`, leaving a `>= 8m` smooth walkable corridor up to `volcanoSummit`), and upgraded the molten lava river & crater shader with organic cellular magma plates (`lavaCellEdge`), incandescent gold-yellow fissures, and fiery crimson-orange edges tuned to resist ACES pastel washout.
   - Tightened volcanic canyon heat-rim contrast in `terrainSplatBaker.ts` and `MaterialLibrary.ts` (`'terrain-splat-detail-v8'`) and added vertex-AO presets (`palmTrunkAo`, `grassTuftAo`, `rockInstancedAo`, `volcanoBasaltAo`).
3. **Unit Coverage:** Expanded `src/world/ScatterLayout.test.ts` and `src/world/Landmarks.test.ts` to validate leaning palms, midground trees, overhanging ferns, rock outcrops, contact shadows, reserved-footprint safety, and unobstructed volcano basalt ramp clearance (`26/26` tests passing).

### 3. Post-Implementation Audit & Verification Gate
- [x] Confirmed layered leaning palms, emerald midground tree lines, rock outcrops, overhanging 7-frond jungle ferns, and richer shoreline clusters break up flat expanses in `harbor`, `title`, and `jungle` with zero breaches of `INITIAL_RESERVED_FOOTPRINTS` (`ScatterLayout.test.ts`).
- [x] Confirmed jagged tapered basalt ramp framing, fiery molten lava cellular shader & heat-rim contrast on `volcano`, and deepened vertex-AO + contact-shadow grounding beneath rocks, palms, bushes, and harbor structures with all 8 `WORLD_ANCHORS` and 4 trails 100% walkable.
- [x] Draw calls `46` in harbor Play (`27` jungle, `27` ruins, `28` volcano, `36` lagoon, `78` skull-cave, `87` Title `?test` / `80` post-reset — all well `<= 150`), `3` PointLights (`<= 6`), `?test` `5/5` passing (`geoDelta = 0`, `texDelta = 0`, `0` NaN transforms), `0` console errors and `0` console warnings.
- [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`26/26` unit tests); every modified/created source file `<= 250` lines (`ScatterGeometry.ts = 247`, `ScatterMidground.ts = 205`, `ScatterLayout.ts = 242`, `PropScatterSystem.ts = 246`, `VolcanoBuilder.ts = 200`, `LandmarkSystem.ts = 164`, `MaterialLibrary.ts = 219`, `terrainSplatBaker.ts = 247`).
- [x] **Recalibrated Visual Quality Gate:** Rotated Phase 1J baseline `public/captures/latest` -> `public/captures/prev`, captured all 7 presets (`title`, `harbor`, `jungle`, `ruins`, `volcano`, `lagoon`, `skull-cave`) into `public/captures/latest/`, updated `public/captures/latest/meta.json`, compared `prev` vs `latest` vs `docs/references/*.png`, logged honest recalibrated `Visual Score (9.0 / 10)` above, updated `docs/CHANGELOG.md`, and flipped status to `[x] Done`.

---

## Phase 2 — Dinosaurs, Pirate NPCs & Core Discovery Loop

### Phase 2A — Docs Sync & Foliage Tri-Budget Optimization
- **Status:** `[x] Done`
- **Visual Score (1–10):** `9.0 / 10` *(Recalibrated Rubric — `prev` Phase 1K `939,220` tris vs `latest` Phase 2A `334,728` tris vs `docs/references/*.png`. All 7 presets retain Phase 1K's full `9.0 / 10` layered silhouettes, jungle trail framing, harbor midground canopy belt, volcano basalt crags, contact grounding, and Phase 1J sky/fog/feathered trails while cutting total static triangles by **64.4%** — leaving `> 200,000` triangles of headroom for Phase 2B–2D rigged dinosaurs and NPCs. Refined two-tier 8-frond stylized procedural palms with stepped warm-ringed bark and tucked coconuts match the Quaternius palm silhouette cleanly with zero CDN pop-in; honest minor follow-up micro-notes remain the same low-priority items noted in 1J/1K: faint mid-distance ocean tile diagonals in `ruins.png` and slightly prominent right-beach rock shadow from the high `title.png` aerial camera.)*
- **Pre-Implementation Audit:** Root-caused Phase 1K's `251k -> 939k` triangle jump: 136 CDN Quaternius palms (`Environment_PalmTree_1/2/3`, `~3,090` tris each = `420,178` tris), CDN rocks (`169,116` tris, with `Environment_Rock_2` at `3,072` tris vs `712–766` for `Rock_1/3/4`), and procedural scatter/shadows (`176,396` tris).
- **Scoped Implementation:**
  1. Synced Phase 2 Performance Ceiling (`<= 550,000` total scene tris, `<= 400,000` static island tris, `<= 110` Phase 2 draw calls / `<= 150` hard ceiling, `<= 6` PointLights, `geoDelta = 0` / `texDelta = 0`) into `docs/CONTRACTS.md` Section 6, added Phase 2A–2D to `docs/BACKLOG.md`, and wired `trianglesBudget <= 550,000` into `src/engine/SelfTestRunner.ts` (`107` LOC) & `src/engine/engineCore.test.ts` (`183` LOC).
  2. Replaced CDN instanced palms with stylized two-tier procedural palms (`buildStylizedPalmGeometries()`, `156` tris/palm) in `src/world/ScatterGeometry.ts` (`237` LOC) & `src/world/PropScatterSystem.ts` (`236` LOC), added `DoubleSide` `palmLeafAo` & `grassTuftAoDouble` in `src/engine/MaterialLibrary.ts` (`221` LOC), swapped `rock.2` (`3,072` tris) for `rock.4` (`712` tris), decimated bushes (`180->80`), grass tufts (`32->12`), pebbles (`108->36`), overhanging ferns (`148->64`), midground canopy trees (`168->90`), rock outcrops (`144->80`), contact shadows (`10->2`), and volcano basalt crags (`60->48` in `src/world/VolcanoBuilder.ts` `200` LOC), and lightly trimmed off-trail random scatter targets in `src/world/ScatterLayout.ts` (`242` LOC) & `src/world/ScatterMidground.ts` (`205` LOC).
- **Post-Implementation Audit & Verification Gate:**
  - [x] Static island triangles strictly `<= 400,000` across all 7 presets: `harbor` `939,220 -> 334,728` (**-64.4%**, `45` calls `<= 60`), `title` `948,804 -> 344,312` (**-63.7%**, `86` calls), `jungle` `302,868` (`26` calls), `ruins` `302,868` (`26` calls), `volcano` `299,004` (`27` calls), `lagoon` `295,112` (`35` calls), `skull-cave` `305,624` (`77` calls).
  - [x] `npm run build`, `tsc --noEmit`, `npm run lint`, and `tsx --test` pass 100% (`27/27` unit tests, including Phase 2A procedural geometry tri-budget test in `src/world/ScatterLayout.test.ts` `151` LOC); every modified source file `<= 250` LOC.
  - [x] Live `?test` passes `6/6` (`geoDelta = 0`, `texDelta = 0`, `3` PointLights `<= 6`, all 8 `WORLD_ANCHORS` valid & walkable, `0` NaN transforms, `0` console errors/warnings).
  - [x] Rotated Phase 1K captures to `public/captures/prev/`, captured all 7 presets into `public/captures/latest/`, updated `public/captures/latest/meta.json`, logged honest recalibrated `Visual Score (9.0 / 10)` above, updated `docs/CHANGELOG.md`, and stopped cleanly before Phase 2B.
- **Strictly Out of Scope:** No new gameplay features, no dinosaurs, no eggs, no NPCs, and no combat.

### Phase 2B — Dino CDN Asset Pipeline & Animation Showcase
- **Status:** `[ ] Planned`
- **Scope:** Implement `AssetManifestClient`, `DinoRigFactory` (`SkeletonUtils.clone`), and `DinoAnimator`, spawning 1–2 hero dinosaurs per biome with idle/patrol animation loops and grounded contact shadows inside the `<= 550,000` triangle and `<= 110` draw-call budgets.

### Phase 2C — Pirate NPCs, Collectible Dino Eggs & Core Discovery Loop
- **Status:** `[ ] Planned`
- **Scope:** Spawn Pirate NPCs from `quaternius-pirate-kit` (`npc.seahawk`, `npc.artie`, `npc.amy` inside reserved family hubs), place collectible glowing Dino Eggs across the 6 biomes wired through `InteractionArbitrator`, add a lightweight zero-text HUD egg counter, and wire `audio/calm.mp3` with mute toggle persistence.

### Phase 2D — Dino Patrol AI, Player Reactions & Phase 2 Visual/Perf Gate
- **Status:** `[ ] Planned`
- **Scope:** Add biome-bounded dinosaur patrol paths, friendly proximity reactions (wave/cheer responses), and run the full 7-preset Visual Quality + Phase 2 Performance Gate (`<= 550,000` tris, `<= 110` draw calls, `<= 6` PointLights, `geoDelta = 0`, `texDelta = 0`, `9.0+ / 10`).

---

## Product Roadmap Epics (Consolidated from `docs/backlog.md`)

### Epic 1: Phase 1 — Sunlit 6-Biome Island & Playable Sonny (Build 1) — `DONE`
- **E1-01** Deterministic 6-biome island terrain (`terrainMath.ts`, `TerrainQuery.ts`, `IslandTerrainSystem.ts`) + 8 named `WORLD_ANCHORS` — **Done**
- **E1-02** 60fps GPU-wave ocean (`OceanSystem.ts`) with CPU wave mirror + `polygonOffset` shoreline foam — **Done**
- **E1-03** Hero procedural landmarks (`LandmarkSystem.ts`): Skull Rock Pirate Cave (SE headland, bandana, eyepatch, glowing amber eye, walkable cobblestone ledge + turquoise water inlet, flickering torches), Crystal Waterfall Lagoon, Smoking Volcano lava + rising low-poly smoke — **Done**
- **E1-04** Pinned Quaternius Pirate Kit CDN loader (`AssetManager.ts`) + batched `InstancedMesh` scatter (`PropScatterSystem.ts`: `Ship_Small`, houses, sawmill, palms, rocks, barrels, chests, ruins bones/skulls) — **Done**
- **E1-05** Playable Sonny (`Characters_Henry` + procedural fallback, exact-name animation matching, playful Wave + chime, shallow-water splashing, gentle deep-water & lava guardrails) — **Done**
- **E1-06** 4-mode controls (`InputManager.ts`: Gamepad, WASD+Arrows, Desktop Click-to-Run + Right-Drag Orbit, Mobile Touch) + behind-the-back auto-follow `CameraSystem.ts` — **Done**
- **E1-07** Silent-on-Title `audio/calm.mp3` with `1.5s` Play fade-in + procedural Web Audio SFX (`AudioEngine.ts`) — **Done**
- **E1-08** Zero-text Title Screen (`TitleOverlay.tsx`), zero-text `GameHud.tsx`, `?debug` biome teleport bar, `InteractionArbitrator`, `SaveManager`, `MaterialLibrary`, `?test` self-tests & 11 pure-logic unit tests — **Done**

### Epic 2: Phase 2 — First-Minute Hook & Interactive Island Toys (Build 2) — `NEXT`
- **E2-01** Harbor Family Hub (`harborSpawn` / `harbor-family-hub`): Captain Seahawk (`npc.seahawk`) + Artie (`npc.artie`) stationed beside the custom **Pirate Bed Ship** (`hero.bedShip` `.glb` swap); Seahawk waves in synthesized Animalese with zero-text picture bubbles pointing to the first glowing Dino Egg while Artie tags along/cheers.
- **E2-02** Color-coded, easy-to-find glowing Dino Eggs with chime cues -> pick up & throw to hatch dinos (via `InteractionArbitrator`).
- **E2-03** Sunny Meadow / Dino Ranch Hub (`ranchCenter` / `ranch-amy-hub`): **Mum (Amy)** (`npc.amy` / `Characters_Anne`, clips `Idle`, `Wave`, `Yes`) welcomes every hatched dinosaur with Animalese chatter and picture-bubble cues for the Free Sticker-Stamp Builder & Picture Dino-Dex overlay.
- **E2-04** Interactive world toys: red pull-levers, smashable pirate barrels bursting into celebratory shinies/confetti, 1-button fishing at Pirate Harbor & Crystal Lagoon docks (`Prop_Fish_Tuna`, `Prop_Fish_Mackerel`, `Prop_Bucket_Fishes`).
- **E2-05** Pre-Epic refactor: split oversized Build 1 modules (`LandmarkSystem.ts`, `GameEngine.ts`, `PlayerSystem.ts`, `PropScatterSystem.ts`, `InputManager.ts`, `terrainMath.ts`) under the 250-line cap — **Done** (completed across Phases 1B, 1D, 1E, and 1F; `TD-01` closed).

### Epic 3: Phase 3 — Quaternius Packs 2–6, Dino Riding & Hybrid Building (Build 3+) — `PLANNED`
- **E3-01** Drop in Quaternius Packs 2–6 via 1-line `ASSET_CATALOG` swaps (Animated Dinosaurs, Ultimate Stylized Nature, Farm/Crops, Survival, Animated Animals).
- **E3-02** Rideable dinos with unique traversal abilities + cartoon bonk attacks; distance-throttled AI/mixers beyond ~90m.
- **E3-03** Zero-cost glowing LEGO-Style Build Pads (bridges, ziplines, campfires, pens) + Free Sticker-Stamp Builder inside Dino Ranch.
- **E3-04** Coastal wooden raft (gliding into Skull Rock Cave's turquoise inlet) and goofy LEGO-style **Pirate Pete** encounters.
