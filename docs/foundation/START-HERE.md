# Sonny’s Island | Foundation repair brief for Muse, Neon and the reviewer

**Baseline:** [af2a666](https://github.com/SGTpepperoni94/Sonny-s-Dino-island/tree/af2a666af4782969dfc304cb3ae5a22a0ef1ab8d). **Milestone:** a child can walk the island, trust what looks solid, see Sonny while turning, and recognise the character of each place from the normal camera. Keep the egg adventure on the roadmap. The next milestone is the physical and visual foundation.

## Dock fix on the foundation branch

Branch `foundation/dock-support-and-handover` carries the dock fix and [six traversal tests](../../src/gameplay/DockTraversal.test.ts) for review against `main`. In the baseline, Sonny stands below the harbour planks. With the fix, the same position places him on deck and clears the shallow-water state. The following measurements use game metres with Y up. The other work orders are recommendations for Neon.

| Reproduction on the baseline | Finding | Work to open |
|---|---|---|
| Start 4 m west of the house at (−26, 109), palm at (−51, 118), or boulder at (−48, 130). Drive the real movement step east for 60 frames at 60 Hz. | In all three cases Sonny passes within 0.06 m of the authored centre and exits on the other side. Zero guardrail contacts. This measures the placement centre, not the exact mesh outline. | Body collision for visible solids. |
| Stand on the last harbour plank at (−25.084, 138.195) or last lagoon plank at (129.844, 18.643). | The boards top out at Y=0.86. Sonny’s feet settle 1.787 m and 1.620 m below them respectively, with shallow-water feedback. | Deck support, including click targeting, shadow and walking/jumping/return. Implemented on this branch. |
| Stand at (−51, 122), face +Z, let the normal camera snap behind Sonny. | The real palm-trunk geometry intersects the camera-to-aim-point segment 6.197 m from the camera; the aim point is 10.659 m away. In a deliberate sweep around this trunk, 16 of 24 aligned angles were obstructed. This is a targeted camera test, not a frequency estimate for the island. | Camera obstruction near solid objects. |
| Compare the rendered surface with the player’s analytic ground query at the centres of the actual walkable terrain triangles. | 2,325 of 30,442 samples differ by more than 0.25 m. Within 2 m of a mapped trail, 15 of 986 do. The largest overall difference was +4.931 m at (64.738, −65.209); the largest absolute trail difference was +0.456 m at (−94.238, −35.002). Positive means the physics surface is higher. These samples establish geometry disagreement, not how often a player reaches those spots. | Unify visible ground and player footing. Inspect the outliers; change the walkable mask where the intended surface is a cliff. |

**Why existing checks pass.** Player motion calls terrain walkability and analytic ground height in `PlayerPhysics.ts`. Drawable props have separate positions and transforms in `PropScatterSystem.ts` and `LandmarkSystem.ts`. Reserved footprints keep scatter away from important locations at build time. They serve a different purpose from runtime body collision. The rendered land is a jittered triangular mesh in `IslandTerrainSystem.ts`; interpolation across a triangle can differ substantially from the continuous function. The dino grounding code already recognises that difference. Current checks for anchor walkability, finite positions and drawing budgets can all pass in a world with an unusable dock.

## Work orders in recommended sequence

### 1. Review the dock fix in ordinary play

The [shared dock configuration](../../src/config/docks.ts) drives both rendered plank dimensions and deck support. The implementation handles angled mouse clicks, places shadows and click markers on the deck, and blocks a high side-entry from shallow water. Narrow plank gaps give continuous support.

All six sampled plank positions placed the feet at 0.86 m without splash feedback. **Review in ordinary play:** enter each dock from land, stop at the last plank, jump, land, turn and leave; approach from the water and verify a gentle response. Try stick and click-to-run. Watch the feet, shadow and click marker. Physical controller and phone acceptance is still open.

### 2. Make hard scenery solid and soft scenery forgiving

**Neon brief:** Trace a house, palm and boulder from their authored placements through rendering to the movement step. Introduce inexpensive character-sized collision for these three classes first. A rotated footprint suits the shack, a narrow cylinder suits a trunk and a coarse convex shape suits a boulder. Generate the proxies from the same placements as the visuals. Use the current and proposed positions to prevent high-speed crossings; slide along a wall and release cleanly on reversal. Include vertical extent so an object overhead does not become a floor-to-sky wall. Keep grass, leaves, splash particles and tiny pebbles passable. Keep the existing lava and deep-water protections.

**Reviewer’s route:** rerun the three centre crossings. Approach front-on, diagonally and along the side, including the gap between adjacent objects. Try low and full stick, keyboard, click beyond an obstacle and a slower frame cadence. A pass means Sonny stays outside the visible solid, can slide around it and can back away immediately. A click behind a wall should terminate or redirect cleanly when progress stops. Check that loading, a partial asset failure or a reset cannot leave an invisible blocker. After these pass, apply the pattern to large cave jambs, boulders and dinosaur bodies using deliberately chosen shapes. A whole-dinosaur bounding box would block empty space under tails.

### 3. Bring ground and camera into agreement with the world

**Ground:** derive a cheap local triangle lookup from the exact grid vertices, jitter and diagonal used by the terrain renderer. Query nearby cells and interpolate the containing triangle; keep it usable headlessly. The player, shadow and click marker should agree on the support surface, including elevated decks. Keep biome generation and artistic height functions where they belong. Avoid a full-island raycast on every movement step. Use the reproduced trail point and the steep outlier as permanent fixtures. An initial tolerance of 5 cm on designated walking routes is a proposed engineering target. Verify both sides of triangle boundaries and run the same route uphill and downhill.

**Camera:** test a small volume from Sonny’s look target back to the desired camera position. Use the nearest blocking surface to shorten the camera arm; restore its length smoothly when clear. Use camera-blocking layers for trunks, architecture and rock walls. Treat soft foliage separately. Begin with the reproduced palm, then a shack corner, the skull mouth and an interior turn. A pass means Sonny stays visible and the camera neither snaps repeatedly nor goes through the roof. Capture uninterrupted movement in both directions. Keep optional orbit and existing automatic follow usable with one stick.

### 4. Take one connected region to reference quality

Use [the art direction work order](art-direction.md). Start with harbour → skull cave: it exposes composition, coast shape, material contrast, a navigable entrance and the limit of the camera in one short walk. First pass is shape and framing. Second pass is colour, light, contact and motion. Promote the treatment to the other biomes only after the slice holds up from ordinary player height. Keep working low-poly assets and the existing performance ceilings.

## Working together in GitHub and AI Studio

Keep this brief and the [art direction](art-direction.md) together in `docs/foundation/`. Use the existing [backlog](../BACKLOG.md) for work status and the [changelog](../CHANGELOG.md) for landed changes.

After the reviewed change merges into `main`, pull it in **AI Studio → Settings → GitHub**. Have Neon open `src/config/docks.ts` and this brief, then walk the acceptance route in section 1. Record which revision was previewed and which device was used. If newer Studio-only edits appear, preserve them before syncing.

## Verification in a checkout

With the locked dependencies installed, run these from the repo root:

```sh
npm run build
npm run lint
node --import tsx --test src/*/*.test.ts
```

The automated suite exercises approaching, jumping on and returning from both docks, high side-entry from the water, and angled pointer selection. The camera, prop and terrain examples in the table are baseline diagnostics for subsequent work.
