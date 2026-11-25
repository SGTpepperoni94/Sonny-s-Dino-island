# Project DNA — Pirate & Dino Island Discovery
> Synced: 2026-11-23 | Build: Phase 1 (Build 1 — Verified)

## 1. Product Identity & Audience
* **Title:** Pirate & Dino Island Discovery
* **Audience:** Young kids (ages 3–5, starring Sonny & baby brother Artie) and co-playing parents.
* **Design Ethos:** 100% zero-reading / language-free discovery sandbox — joyful sunlit low-poly aesthetics, zero punishing game overs, zero drowning, zero lava damage, universal icons and expressive audio/visual cues.
* **World:** One expansive, continuous 6-biome tropical island (`Pirate Harbor`, `Sunny Meadow / Future Dino Ranch`, `Whispering Fern Jungle`, `Ancient Dino Ruins`, `Smoking Volcano Ridge`, `Crystal Waterfall Lagoon`) plus the signature `Skull Rock Pirate Cave` on the Southeast headland.

## 2. Tech Stack & Runtime Invariants
* **Frontend & 3D:** React 19, TypeScript (`"strict": true`), Vite 8, Tailwind CSS v4, Three.js (`three` + `GLTFLoader` + `SkeletonUtils` + `RoomEnvironment`).
* **Asset CDN:** Pinned Quaternius Pirate Kit (`@d630aa4139033709a52cd6ae8aa314deb77c83c9`, `manifest.assets` -> `.gltf`, `baseUrl` overridden for immutability) + `audio/calm.mp3`.
* **Rendering Pipeline:**
  * Hardware WebGL: `antialias: true`, `SRGBColorSpace`, `ACESFilmicToneMapping` (`exposure: 0.98`), `PCFSoftShadowMap` (`1024x1024` moving ortho frustum `±55` tracking Sonny), `RoomEnvironment` PMREM (`scene.environmentIntensity = 0.42`), `renderer.compile()` once post-init.
  * Software WebGL Guard (`SwiftShader|llvmpipe|softpipe|Software|Basic Render`): disables AA/shadows, caps pixelRatio to `1`, skips `renderer.compile()`, paces loop via WebGL2 `fenceSync` (`afterDraw()` + `80ms` yield).
* **Hard Performance Budget:**
  * Draw-call ceiling: `<= 150` calls/frame (Build 1 verified at **17–21 calls** via `InstancedMesh` batching and pooled particles).
  * Zero-GC render loop (module/class scratch vectors & flat typed-array particle ring buffer).
  * React HUD throttled to `~9 Hz` (`110ms`) or discrete events; zero CSS `backdrop-blur` over WebGL.
* **One-Way Import Graph:** `types -> config -> engine -> world -> gameplay -> ui`.

## 3. Visual & Design Tokens (`src/config/palette.ts`)
* **Sky & Atmosphere:** Sky `#1D9BF0`, FogExp2 `#5CC3FF` (`0.00075`), HemiSky `#6ECAFF`, HemiGround `#D99B4E`, Sun `#FFF3D1`.
* **Water:** Shallow Aquamarine `#00D8E0`, Mid Turquoise `#00B6CC`, Deep Cerulean `#0066B2`, Shoreline Foam `#F4FCFF`.
* **Terrain Biomes:** Golden Sand `#EAB652`, Ochre Trail `#C97B32`, Meadow Lime `#5BBD1C` / `#74D124`, Jungle Emerald `#2D9420`, Mossy Ruins `#55A820` / `#878175`, Volcano Rock `#3B2B47` / `#553D60`, Molten Lava `#FFF059` -> `#FF8C14` -> `#C93B0A`, Skull Bone `#D9C29E`, Pirate Bandana `#C43523`.
* **UI Surfaces:** Tactile pirate-wood borders (`#5A3217` / `#663614`), sunlit gold CTAs (`#FFB81C`), turquoise jump (`#1FD1DF`), crisp solid/rgba fills (zero `backdrop-blur`), `>= 90%` unobstructed 3D viewport.
