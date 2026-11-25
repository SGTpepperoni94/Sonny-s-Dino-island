import assert from 'node:assert/strict';
import test from 'node:test';
import { ASSET_CATALOG } from '../config/assets';
import { INITIAL_RESERVED_FOOTPRINTS } from '../config/worldAnchors';
import { generateScatterLayout } from './ScatterLayout';
import { TerrainQuery } from './TerrainQuery';

test('Phase 1D ASSET_CATALOG scales Ship_Small to 1.05 and normalizes harbor shacks to 0.66..0.70', () => {
  assert.equal(ASSET_CATALOG['ship.sloop'].scale, 1.05);
  for (const key of ['structure.house1', 'structure.house2', 'structure.sawmill'] as const) {
    const s = ASSET_CATALOG[key].scale;
    assert.ok(s >= 0.66 && s <= 0.7, `${key} scale (${s}) must be within 0.66..0.70`);
  }
});

test('Phase 1D ScatterLayout is deterministic and leaves all reserved hubs & sightlines 100% clear', () => {
  const terrain = new TerrainQuery();
  const a = generateScatterLayout(terrain);
  const b = generateScatterLayout(terrain);

  assert.deepEqual(a, b, 'Scatter layout must be 100% deterministic');
  assert.equal(a.structures.length, 3, 'All 3 Pirate Harbor shacks should place cleanly');
  assert.equal(a.ruinsProps.length, 3, 'All 3 Dino Ruins bone landmarks should place cleanly');
  assert.ok(a.palms.length >= 115, `Expected >= 115 leaning palms, got ${a.palms.length}`);
  assert.ok(a.palms.some((p) => Math.hypot(p.leanX ?? 0, p.leanZ ?? 0) >= 0.15), 'Expected varied coastal palm lean');
  assert.ok(a.midgroundTrees.length >= 45, `Expected >= 45 darker midground canopy trees, got ${a.midgroundTrees.length}`);
  assert.ok(a.overhangFerns.length >= 90, `Expected >= 90 overhanging jungle ferns, got ${a.overhangFerns.length}`);
  assert.ok(a.rockOutcrops.length >= 16, `Expected >= 16 layered coastal/jungle rock outcrops, got ${a.rockOutcrops.length}`);
  assert.ok(a.contactShadows.length >= 300, `Expected >= 300 grounded contact shadow decals, got ${a.contactShadows.length}`);
  assert.ok(a.rocks.length >= 95, `Expected >= 95 rocks across rock.1-3, got ${a.rocks.length}`);
  assert.ok(a.bushes.length >= 340, `Expected >= 340 doubled stylized bushes, got ${a.bushes.length}`);
  assert.ok(a.grassTufts.length >= 700, `Expected >= 700 doubled grass tufts, got ${a.grassTufts.length}`);
  assert.ok(a.pebbles.length >= 300, `Expected >= 300 small instanced pebbles, got ${a.pebbles.length}`);
  assert.ok(a.barrels.length >= 12, `Expected >= 12 curated barrels, got ${a.barrels.length}`);
  assert.ok(a.chests.length >= 4, `Expected >= 4 curated chests, got ${a.chests.length}`);

  // Offshore Pirate Ship anchors in open bay water clearly below sea level
  const shipFloor = terrain.getTerrainHeight(a.shipAnchor.x, a.shipAnchor.z);
  assert.ok(
    shipFloor < -1.5,
    `Ship_Small anchor (${a.shipAnchor.x}, ${a.shipAnchor.z}) must sit in open bay water, got h=${shipFloor.toFixed(2)}`,
  );

  // Verify ZERO intrusions across every scatter category into any reserved footprint
  const groups: ReadonlyArray<readonly [string, ReadonlyArray<{ x: number; z: number }>, number]> = [
    ['structures', a.structures, 3.5],
    ['ruinsProps', a.ruinsProps, 1.0],
    ['palms', a.palms, 2.5],
    ['midgroundTrees', a.midgroundTrees, 2.8],
    ['overhangFerns', a.overhangFerns, 1.5],
    ['rockOutcrops', a.rockOutcrops, 2.0],
    ['rocks', a.rocks, 2.0],
    ['bushes', a.bushes, 1.5],
    ['grassTufts', a.grassTufts, 1.0],
    ['pebbles', a.pebbles, 1.0],
    ['barrels', a.barrels, 1.0],
    ['chests', a.chests, 1.0],
  ];

  for (const [label, items, clearance] of groups) {
    for (const item of items) {
      assert.equal(
        terrain.isFootprintReserved(item.x, item.z, clearance - 1e-4),
        false,
        `${label} item at (${item.x.toFixed(1)}, ${item.z.toFixed(1)}) intruded on a reserved footprint`,
      );
      for (const fp of INITIAL_RESERVED_FOOTPRINTS) {
        const d = Math.hypot(item.x - fp.x, item.z - fp.z);
        assert.ok(
          d > fp.radius,
          `${label} item at (${item.x.toFixed(1)}, ${item.z.toFixed(1)}) breached ${fp.id} (d=${d.toFixed(2)} <= ${fp.radius})`,
        );
      }
    }
  }

  // Verify harbor shacks sit on dry, reasonably gentle ground and never crowd/overlap each other
  for (let i = 0; i < a.structures.length; i++) {
    const s = a.structures[i];
    const h = terrain.getTerrainHeight(s.x, s.z);
    const n = terrain.getTerrainNormal(s.x, s.z);
    assert.ok(h > 1.2 && h < 12, `Harbor shack ${s.key} height ${h.toFixed(2)} must be grounded on dry harbor flank`);
    assert.ok(n.ny > 0.85, `Harbor shack ${s.key} slope ny=${n.ny.toFixed(2)} should be gentle`);
    for (let j = i + 1; j < a.structures.length; j++) {
      const other = a.structures[j];
      const sep = Math.hypot(s.x - other.x, s.z - other.z);
      assert.ok(sep >= 15, `Harbor shacks ${s.key} and ${other.key} too close (${sep.toFixed(1)}m < 15m)`);
    }
  }
});

test('Phase 2A foliage, palm, canopy, and contact-shadow geometries stay strictly within tri budget', async () => {
  const {
    buildContactShadowGeometry,
    buildGrassTuftGeometry,
    buildMidgroundTreeGeometries,
    buildOverhangFernGeometry,
    buildPebbleClusterGeometry,
    buildRockOutcropGeometry,
    buildStylizedBushGeometry,
    buildStylizedPalmGeometries,
  } = await import('./ScatterGeometry');
  const triCount = (g: import('three').BufferGeometry) =>
    g.index ? g.index.count / 3 : g.attributes.position.count / 3;

  const terrain = new TerrainQuery();
  const layout = generateScatterLayout(terrain);
  const palm = buildStylizedPalmGeometries();
  const tree = buildMidgroundTreeGeometries();
  const bush = buildStylizedBushGeometry();
  const tuft = buildGrassTuftGeometry();
  const pebble = buildPebbleClusterGeometry();
  const fern = buildOverhangFernGeometry();
  const outcrop = buildRockOutcropGeometry();
  const shadow = buildContactShadowGeometry();

  assert.ok(triCount(palm.trunk) + triCount(palm.crown) <= 160, 'Stylized palm must stay <= 160 tris');
  assert.ok(triCount(tree.trunk) + triCount(tree.crown) <= 100, 'Midground tree must stay <= 100 tris');
  assert.ok(triCount(bush) <= 84, 'Stylized bush must stay <= 84 tris');
  assert.ok(triCount(tuft) <= 16, 'Grass tuft must stay <= 16 tris');
  assert.ok(triCount(pebble) <= 40, 'Pebble cluster must stay <= 40 tris');
  assert.ok(triCount(fern) <= 72, 'Overhang fern must stay <= 72 tris');
  assert.ok(triCount(outcrop) <= 84, 'Rock outcrop must stay <= 84 tris');
  assert.equal(triCount(shadow), 2, 'Contact shadow quad must be 2 tris');

  const totalProceduralScatterTris =
    layout.palms.length * (triCount(palm.trunk) + triCount(palm.crown)) +
    layout.midgroundTrees.length * (triCount(tree.trunk) + triCount(tree.crown)) +
    layout.bushes.length * triCount(bush) +
    layout.grassTufts.length * triCount(tuft) +
    layout.pebbles.length * triCount(pebble) +
    layout.overhangFerns.length * triCount(fern) +
    layout.rockOutcrops.length * triCount(outcrop) +
    layout.contactShadows.length * triCount(shadow);

  assert.ok(
    totalProceduralScatterTris <= 100000,
    `Total procedural scatter (${totalProceduralScatterTris} tris) must stay <= 100,000 tris`,
  );
  palm.trunk.dispose();
  palm.crown.dispose();
  tree.trunk.dispose();
  tree.crown.dispose();
  bush.dispose();
  tuft.dispose();
  pebble.dispose();
  fern.dispose();
  outcrop.dispose();
  shadow.dispose();
});

