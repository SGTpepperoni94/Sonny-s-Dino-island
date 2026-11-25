# Main User Journey — Pirate & Dino Island Discovery
> Synced: 2026-11-23 | Personas: Sonny (Age 3–5 Captain), Co-Playing Parent (Dad / Captain Seahawk)

## Journey: Sonny (Age 3–5 Captain)

### Stage 1: Arrival & Title Screen Wonder
| Field | Detail |
| :--- | :--- |
| **Goal** | Recognize the sunlit pirate island immediately and enter play with zero reading. |
| **Touchpoints** | Live 3D orbiting Pirate Harbor canvas, Pirate-Wheel SVG crest, giant golden Play button (`TitleOverlay`). |
| **Actions** | Watch bobbing `Ship_Small`, Skull Rock, and smoking volcano -> Tap/click giant Play button (or press `Enter`/`Space`). |
| **Emotion** | 🤩 Excited & Curious |
| **Pain Points** | Text clutter or sudden loud music on load can overwhelm a 3-year-old; slow CDN model fetches could leave an empty beach. |
| **Opportunities** | Verified in Build 1: zero-text UI, silent Title Screen with `1.5s` `calm.mp3` fade-in on Play, instant procedural fallbacks that seamlessly upgrade to real Quaternius `.gltf` assets. |
| **Stories** | `US-1-01`, `US-1-05` |

### Stage 2: First Steps & Harbor Discovery (0–60 Seconds)
| Field | Detail |
| :--- | :--- |
| **Goal** | Move Sonny effortlessly, jump, wave, and splash in the shallow turquoise bay. |
| **Touchpoints** | `PlayerSystem` (`Characters_Henry`), `CameraSystem` auto-follow, `InputManager` (4 modes), `GameHud` Wave/Jump icon buttons, `ParticlePoolSystem` splash/sparkle bursts. |
| **Actions** | Push stick / WASD / click-and-hold golden sand -> Splash into shallow harbor water -> Tap Wave button for cheerful animation + chime -> Hop along the beach. |
| **Emotion** | 😄 Joyful & Confident |
| **Pain Points** | Twin-stick camera control is hard for ages 3–5; accidentally clicking HUD buttons could misdirect click-to-run; deep water could trap or punish the player. |
| **Opportunities** | Verified in Build 1: auto-follow camera, `data-ui-interactive` click guard, gentle invisible deep-water guardrails, and reserved unobstructed footprints (`harbor-family-hub`, `harbor-ranch-sightline`, `ranch-amy-hub`). Build 2 opportunity: station Captain Seahawk + Artie + Pirate Bed Ship (`hero.bedShip`) right beside `harborSpawn` pointing to the first glowing Dino Egg, leading straight up the clear dirt path to Mum (Amy) at `ranchCenter` (`US-2-01`, `US-2-02`). |
| **Stories** | `US-1-03`, `US-1-04`, `US-2-01`, `US-2-02` |

### Stage 3: Landmarks Expedition (Skull Rock Cave, Waterfall Lagoon, Ruins & Volcano)
| Field | Detail |
| :--- | :--- |
| **Goal** | Follow ochre trails and visual landmarks across all 6 biomes without ever getting lost or hurt. |
| **Touchpoints** | Winding ochre trails (`IslandTerrainSystem`), Skull Rock Pirate Cave (`LandmarkSystem`), Crystal Waterfall Lagoon, stepped Ancient Dino Ruins, Smoking Volcano Ridge trail + lava guardrail. |
| **Actions** | Follow SE beach trail into torchlit Skull Rock Cave cobblestone ledge -> Explore Crystal Waterfall splash cove -> Climb jungle footpath to mossy Dino Ruins -> Ascend safe volcano ridge trail beside glowing lava river. |
| **Emotion** | 🧭 Adventurous & Safe |
| **Pain Points** | Steep cliffs, accidental lava falls, or camera clipping inside caves can frustrate young kids. |
| **Opportunities** | Verified in Build 1: terrain clearance camera pull-in, wide flat volcano ridge trail with lava channel guardrail, walkable cobblestone ledge inside Skull Cave. Build 2+ opportunity: add coastal rafting into the Skull Cave turquoise inlet, pull-levers, smashable barrels, and fishing piers. |
| **Stories** | `US-1-02`, `US-1-04` |

---

## Journey: Co-Playing Parent (Dad / Technical Reviewer)

### Stage 1: Instant Session Setup & Audio/Device Comfort
| Field | Detail |
| :--- | :--- |
| **Goal** | Hand a gamepad, laptop mouse, or tablet directly to Sonny with smooth frame rates and quick audio control. |
| **Touchpoints** | Zero-setup browser URL, top-right Mute Music toggle (`GameHud`), `SaveManager` persisted mute preference, `?debug` biome teleport bar & `?test` verification harness. |
| **Actions** | Launch URL -> Hand controller/mouse to Sonny (or toggle Mute if needed) -> Optionally open `?debug` to tour all 8 `WORLD_ANCHORS` or run `Self-Test`. |
| **Emotion** | 😌 Relaxed & Delighted |
| **Pain Points** | Frame drops on modest laptops/tablets; noisy console errors or memory leaks across sessions; manual testing across 6 biomes takes time without teleports. |
| **Opportunities** | Verified in Build 1: `17–21` draw calls (`<= 150` ceiling), `0` console errors, zero leak growth on `resetCycle()`, `?debug` 8-anchor teleport bar. Next: verify physical gamepad hardware & tablet touch ergonomics (`TD-02`, `TD-04`). |
| **Stories** | `US-1-05` |
