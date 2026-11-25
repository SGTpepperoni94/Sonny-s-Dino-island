# User Stories — Pirate & Dino Island Discovery
> Synced: 2026-11-24 | Source: `project-dna.md`, `docs/BACKLOG.md`, personas (Sonny Age 3–5, Co-Playing Parent)

## Epic 1: Phase 1 — Sunlit 6-Biome Island & Playable Sonny (Build 1)

### US-1-01 — Instant Zero-Reading Entry from Live Harbor Title Screen
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want to see the sunny pirate island alive on the Title Screen and tap one big Play icon button without reading any words, so that I can jump straight into playing.
* **Priority:** P0 | **Status:** Done | **Dependencies:** None
* **Acceptance Criteria:**
  1. Given the app loads without `?autostart=1`, when the Title Screen renders, then a live orbiting 3D showcase of Pirate Harbor displays with a custom zero-text pirate emblem, one giant icon-only Play CTA (`data-start="true"`), and silent music.
  2. Given Sonny clicks the Play button or presses `Enter`/`Space`, when gameplay begins, then `document.body.dataset.state` immediately transitions to `'playing'`, the title overlay hides, the camera settles behind Sonny at `harborSpawn`, and `audio/calm.mp3` fades in smoothly over `1.5s`.

### US-1-02 — Explore All 6 Biomes & Skull Rock Pirate Cave
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want to run freely across Pirate Harbor, Sunny Meadow, Whispering Fern Jungle, Ancient Dino Ruins, Smoking Volcano Ridge, Crystal Waterfall Lagoon, and into Skull Rock Pirate Cave, so that every horizon has an exciting landmark to discover.
* **Priority:** P0 | **Status:** Done | **Dependencies:** `US-1-01`
* **Acceptance Criteria:**
  1. Given Sonny stands at `harborSpawn`, when looking inland and along the Southeast coastline, then the golden bay, Pirate Harbor shacks, bobbing `Ship_Small`, Skull Rock Pirate Cave (with red bandana, eyepatch, glowing amber eye, and open-jaw archway), Crystal Waterfall, Ancient Dino Ruins, and Smoking Volcano are clearly visible and reachable.
  2. Given Sonny enters Skull Rock Pirate Cave from the Southeast beach trail, when walking inside, then he can walk along the torchlit cobblestone ledge right beside the shallow turquoise water inlet channel.
  3. Given all 8 `WORLD_ANCHORS` are queried, when `runSelfTest()` executes, then every anchor returns a finite height, is walkable, and matches its biome classification.

### US-1-03 — Effortless 4-Mode Controls & Playful Wave Emote
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want to move, jump, and playfully wave using a gamepad, keyboard, desktop click-to-run mouse, or touch screen with an auto-following camera, so that I never struggle with twin-stick controls.
* **Priority:** P0 | **Status:** Done | **Dependencies:** `US-1-01`
* **Acceptance Criteria:**
  1. Given Sonny moves with WASD/Arrow keys, Left Stick (`0.15` deadzone, `moveZ = -ly`), Left-Click & Hold click-to-run on terrain, or Mobile Touch thumbstick, when running across the island, then the camera smoothly auto-follows behind him while still honoring optional Right-Drag / Right-Stick / Q-R manual orbit.
  2. Given Sonny presses `Space` / A / Double-Click / Jump icon, when jumping and landing, then Sonny plays `Jump` / `Jump_Idle` / `Jump_Land` clips with squash-and-stretch, dust/water particles, and jump audio.
  3. Given Sonny presses `E` / `F` / X / RT / Wave icon, when stationary, then Sonny plays the verified `Wave` clip with a cheerful chime and sparkle particles (canceling cleanly if he starts running).

### US-1-04 — Kid-Safe Water Splashing & Volcano Lava Guardrails
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want to splash happily in shallow beach and lagoon water while invisible guardrails gently guide me away from deep ocean and volcano lava, so that I can never drown, burn, or get stuck.
* **Priority:** P0 | **Status:** Done | **Dependencies:** `US-1-02`, `US-1-03`
* **Acceptance Criteria:**
  1. Given Sonny walks into shallow harbor or lagoon water (`-1.15m <= h < 0.08m`), when moving or landing, then cartoon water splash droplets and splash sound play cleanly.
  2. Given Sonny pushes continuously toward deep ocean (`h < -1.15m`) or into the volcano crater/lava channel, when movement steps run, then invisible guardrails slide him smoothly along the boundary with zero damage, zero drowning, and zero NaN transforms.

### US-1-05 — Performance Budget, Zero-Text Audio Control & Verification Harness
* **Persona:** Co-Playing Parent / Product Engineer
* **Story:** As a parent and engineer, I want smooth performance (`<= 150` draw calls), an instant Mute Music icon button, and automated `?test` / `?debug` verification tools, so that the island runs cleanly on laptops, tablets, and headless checks.
* **Priority:** P1 | **Status:** Done | **Dependencies:** `US-1-02`
* **Acceptance Criteria:**
  1. Given the island is fully loaded with real Quaternius `.gltf` props, when `window.__SONNY_ISLAND__.runSelfTest()` runs, then draw calls stay `<= 150` (verified `17–21`), zero NaN transforms exist, and a full `resetCycle()` shows `<= 0` geometry/texture leak growth.
  2. Given the user clicks the top-right Mute icon button during play, when toggled, then `calm.mp3` and SFX mute/unmute immediately and the preference persists in `SaveManager`.

---

## Epic 2: Phase 2 — First-Minute Hook & Dino Discovery (Build 2) — `Draft`

### US-2-01 — Meet Captain Seahawk & Artie by the Pirate Bed Ship & Hatch First Dino Egg
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want Captain Seahawk and Artie beside our Pirate Bed Ship on Pirate Harbor Beach to greet me in goofy Animalese with a picture bubble pointing at a sparkling Dino Egg I can pick up and throw to hatch a friendly dino, so that my first 60 seconds feel magical.
* **Priority:** P0 | **Status:** Draft | **Dependencies:** `US-1-03`, `InteractionArbitrator`, `harbor-family-hub`
* **Acceptance Criteria:**
  1. Given Sonny stands at `harborSpawn`, when looking beside his spawn at `harbor-family-hub`, then the Pirate Bed Ship (`hero.bedShip`), Captain Seahawk (`npc.seahawk`), and cheering sidekick Artie (`npc.artie`) sit on a clean unobstructed beach clearing with clear sightlines up the dirt path to `ranchCenter`.
  2. Given Sonny walks near Captain Seahawk, when entering his greeting radius, then Captain Seahawk waves, plays Animalese gibberish audio, and displays a language-free picture speech bubble showing an Egg -> Dino icon while Artie cheers/tags along.
  3. Given Sonny approaches a sparkling Dino Egg and presses Action/Wave, when picking up and throwing it, then the egg pops with confetti and hatches a friendly dino that follows Sonny up the dirt path toward the Sunny Meadow Dino Ranch.

### US-2-02 — Welcome Hatched Dinos with Mum (Amy) at Sunny Meadow Dino Ranch
* **Persona:** Sonny (Age 3–5 Captain)
* **Story:** As Sonny, I want Mum (Amy) waiting up the dirt path at Sunny Meadow Dino Ranch to cheer every newly hatched dinosaur with Animalese and picture-bubble cues for the Free Sticker-Stamp Builder and Picture Dino-Dex, so that bringing dinos home feels warm and rewarding.
* **Priority:** P0 | **Status:** Draft | **Dependencies:** `US-2-01`, `ranch-amy-hub`
* **Acceptance Criteria:**
  1. Given Sonny follows the clear ochre dirt path from `harborSpawn` to `ranchCenter`, when arriving at `ranch-amy-hub`, then Mum (Amy) (`npc.amy` / `Characters_Anne`) greets him using verified `Idle`, `Wave`, and `Yes` clips with warm Animalese chatter.
  2. Given a newly hatched dinosaur arrives at the Dino Ranch, when Amy celebrates, then language-free picture-bubble cues introduce the Free Sticker-Stamp Builder and Picture Dino-Dex.
