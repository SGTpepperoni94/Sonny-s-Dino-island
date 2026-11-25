import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function mergeAndDispose(parts: THREE.BufferGeometry[], fallback: () => THREE.BufferGeometry): THREE.BufferGeometry {
  const norm = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    if (g !== p) p.dispose();
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g;
  });
  const merged = mergeGeometries(norm, false);
  for (const p of norm) p.dispose();
  if (!merged) return fallback();
  merged.computeVertexNormals();
  return merged;
}

/**
 * Bakes smooth vertical base-contact ambient occlusion into vertex colors
 * so procedural foliage, trees, palms, and rock outcrops ground solidly into terrain.
 */
export function applyBaseAo(
  geo: THREE.BufferGeometry, minY: number, maxY: number, baseShade: number, topShade = 1.04, warmTint = 0,
): THREE.BufferGeometry {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const invSpan = 1 / Math.max(0.001, maxY - minY);
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, (pos.getY(i) - minY) * invSpan));
    const smooth = t * t * (3 - 2 * t);
    const shade = baseShade + (topShade - baseShade) * smooth;
    colors[i * 3] = Math.min(1.15, shade * (1 + warmTint * smooth));
    colors[i * 3 + 1] = Math.min(1.15, shade * (1 + warmTint * 0.45 * smooth));
    colors[i * 3 + 2] = Math.min(1.15, shade * (1 - warmTint * 0.55 * smooth + (1 - smooth) * 0.04));
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function buildArchedFrond(len: number, w: number, liftY: number, midY: number, dropY: number, yaw: number): THREE.BufferGeometry {
  const p0: [number, number, number] = [0, 0.06, 0];
  const p1L: [number, number, number] = [-w, liftY, len * 0.38];
  const p1C: [number, number, number] = [0, liftY + 0.16, len * 0.4];
  const p1R: [number, number, number] = [w, liftY, len * 0.38];
  const p2L: [number, number, number] = [-w * 0.64, midY, len * 0.76];
  const p2C: [number, number, number] = [0, midY + 0.12, len * 0.78];
  const p2R: [number, number, number] = [w * 0.64, midY, len * 0.76];
  const p3: [number, number, number] = [0, dropY, len * 1.06];
  const tris: Array<[number, number, number]> = [
    p0, p1C, p1L, p0, p1R, p1C, p1L, p1C, p2C, p1L, p2C, p2L,
    p1C, p1R, p2R, p1C, p2R, p2C, p2L, p2C, p3, p2C, p2R, p3,
  ];
  const verts = new Float32Array(tris.length * 3);
  for (let i = 0; i < tris.length; i++) verts.set(tris[i], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  return geo.rotateY(yaw);
}

/**
 * Stylized low-poly curved tropical palm (6 stepped bark rings + 3 coconuts + 8 two-tier arched fronds).
 * Matches Quaternius palm world scale (~6m tall, ~5.7m canopy span) at 156 tris/instance (-95% vs GLTF).
 */
export function buildStylizedPalmGeometries(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const trunkParts: THREE.BufferGeometry[] = [];
  const segCount = 6;
  const curveX = (t: number) => t * t * 0.82;
  for (let s = 0; s < segCount; s++) {
    const t0 = s / segCount, t1 = (s + 1) / segCount;
    const y0 = -0.22 + t0 * 5.42, y1 = -0.22 + t1 * 5.42;
    const x0 = curveX(t0), x1 = curveX(t1), dx = x1 - x0, dy = y1 - y0;
    const rBot = 0.4 * (1 - t0 * 0.44);
    trunkParts.push(
      new THREE.CylinderGeometry(rBot * 1.15, rBot * 0.92, Math.hypot(dx, dy) + 0.08, 5, 1, true)
        .rotateZ(-Math.atan2(dx, dy))
        .translate((x0 + x1) * 0.5, (y0 + y1) * 0.5, 0),
    );
  }
  const crownX = curveX(1);
  const segVerts = 10 * 3;
  const coconutVertStart = segCount * segVerts;
  for (let c = 0; c < 3; c++) {
    const ang = c * 2.1 + 0.4;
    trunkParts.push(
      new THREE.OctahedronGeometry(0.24, 0).scale(1, 0.92, 1).translate(crownX + Math.cos(ang) * 0.3, 4.98, Math.sin(ang) * 0.3),
    );
  }
  const trunk = mergeAndDispose(trunkParts, () => new THREE.CylinderGeometry(0.22, 0.4, 5.2, 5, 1, true));
  applyBaseAo(trunk, -0.22, 5.4, 0.58, 1.14, 0.07);
  const posAttr = trunk.attributes.position as THREE.BufferAttribute;
  const colAttr = trunk.attributes.color as THREE.BufferAttribute;
  for (let s = 0; s < segCount; s++) {
    const yMid = -0.22 + ((s + 0.5) / segCount) * 5.42;
    for (let i = s * segVerts; i < (s + 1) * segVerts; i++) {
      const band = posAttr.getY(i) >= yMid ? 1.08 : 0.86;
      colAttr.setXYZ(i, Math.min(1.18, colAttr.getX(i) * band), Math.min(1.18, colAttr.getY(i) * band), Math.min(1.18, colAttr.getZ(i) * band));
    }
  }
  for (let i = coconutVertStart; i < colAttr.count; i++) {
    colAttr.setXYZ(i, colAttr.getX(i) * 0.52, colAttr.getY(i) * 0.48, colAttr.getZ(i) * 0.44);
  }

  const crownParts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const yaw = (i / 5) * Math.PI * 2 + (i % 2) * 0.14;
    const len = 2.75 + (i % 2) * 0.28;
    crownParts.push(buildArchedFrond(len, 0.68, 0.72, 0.14, -0.78 - (i % 2) * 0.22, yaw));
  }
  for (let i = 0; i < 3; i++) {
    const yaw = ((i + 0.5) / 3) * Math.PI * 2 + 0.22;
    crownParts.push(buildArchedFrond(2.25 + (i % 2) * 0.2, 0.62, 1.12, 0.64, -0.18, yaw));
  }
  crownParts.push(new THREE.OctahedronGeometry(0.34, 0).scale(1.15, 0.68, 1.15).translate(0, 0.18, 0));
  const crown = mergeAndDispose(crownParts, () => new THREE.IcosahedronGeometry(2.1, 0));
  crown.translate(crownX, 5.22, 0);
  applyBaseAo(crown, 4.2, 6.45, 0.74, 1.12, 0.09);
  return { trunk, crown };
}

export function buildStylizedBushGeometry(): THREE.BufferGeometry {
  const lobes: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
    [0.0, 0.5, 0.0, 0.94, 0.7, 0.92], [-0.58, 0.34, 0.28, 0.66, 0.52, 0.64],
    [0.54, 0.36, -0.22, 0.68, 0.54, 0.66], [0.08, 0.36, 0.54, 0.6, 0.48, 0.58],
  ];
  const merged = mergeAndDispose(
    lobes.map(([x, y, z, sx, sy, sz]) => new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).translate(x, y, z)),
    () => new THREE.IcosahedronGeometry(0.85, 0),
  );
  return applyBaseAo(merged, -0.18, 1.15, 0.44, 1.06, 0.05);
}

export function buildGrassTuftGeometry(): THREE.BufferGeometry {
  const blades: ReadonlyArray<readonly [number, number, number, number]> = [
    [0.0, 0.0, 1.1, 0.22], [1.55, 0.16, 0.94, 0.38], [3.2, -0.12, 0.86, 0.34], [4.75, 0.14, 0.78, 0.44],
  ];
  const merged = mergeAndDispose(
    blades.map(([yaw, off, hs, tilt]) =>
      new THREE.ConeGeometry(0.27, 1.24 * hs, 3, 1, true)
        .translate(0, 0.58 * hs, 0).rotateZ(tilt).rotateY(yaw).translate(Math.cos(yaw) * off, 0, Math.sin(yaw) * off),
    ),
    () => new THREE.ConeGeometry(0.55, 1.2, 3, 1, true),
  );
  return applyBaseAo(merged, 0.0, 1.25, 0.46, 1.08, 0.06);
}

export function buildPebbleClusterGeometry(): THREE.BufferGeometry {
  const merged = mergeAndDispose(
    [
      new THREE.IcosahedronGeometry(1, 0).scale(0.52, 0.32, 0.44).rotateY(0.3).translate(0.0, 0.2, 0.0),
      new THREE.OctahedronGeometry(1, 0).scale(0.34, 0.24, 0.3).rotateY(1.4).translate(0.46, 0.15, 0.28),
      new THREE.OctahedronGeometry(1, 0).scale(0.28, 0.21, 0.26).rotateY(2.5).translate(-0.36, 0.13, 0.34),
    ],
    () => new THREE.OctahedronGeometry(0.42, 0),
  );
  return applyBaseAo(merged, -0.08, 0.52, 0.44, 1.03, 0.03);
}

/** Composite 7-frond arching tropical fern cluster (paired with DoubleSide material). */
export function buildOverhangFernGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 7; i++) {
    const archY = 1.08 + (i % 3) * 0.28;
    parts.push(
      buildArchedFrond(
        2.2 + (i % 3) * 0.4, 0.56 + (i % 2) * 0.12, archY, archY * 0.78, archY - (0.26 + (i % 2) * 0.2),
        (i / 7) * Math.PI * 2 + (i % 2) * 0.2,
      ),
    );
  }
  parts.push(new THREE.OctahedronGeometry(0.56, 0).scale(1.15, 0.62, 1.15).translate(0, 0.24, 0));
  const merged = mergeAndDispose(parts, () => new THREE.IcosahedronGeometry(1.1, 0));
  return applyBaseAo(merged, -0.05, 1.55, 0.44, 1.08, 0.06);
}

export function buildMidgroundTreeGeometries(): { trunk: THREE.BufferGeometry; crown: THREE.BufferGeometry } {
  const trunk = mergeAndDispose(
    [new THREE.CylinderGeometry(0.26, 0.54, 4.4, 5, 1, true).translate(0, 1.9, 0)],
    () => new THREE.CylinderGeometry(0.26, 0.54, 4.4, 5, 1, true),
  );
  applyBaseAo(trunk, -0.3, 3.8, 0.46, 0.98, 0.02);

  const canopyLobes: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
    [0.0, 4.65, 0.0, 3.0, 1.44, 2.9], [-1.65, 3.95, 0.95, 2.08, 1.16, 2.0],
    [1.58, 4.08, -0.82, 2.15, 1.2, 2.08], [0.22, 5.55, 0.15, 1.98, 1.1, 1.9],
  ];
  const crown = mergeAndDispose(
    canopyLobes.map(([x, y, z, sx, sy, sz]) => new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).translate(x, y, z)),
    () => new THREE.IcosahedronGeometry(2.2, 0).translate(0, 4.6, 0),
  );
  applyBaseAo(crown, 2.75, 6.65, 0.56, 1.08, 0.07);
  return { trunk, crown };
}

export function buildRockOutcropGeometry(): THREE.BufferGeometry {
  const rocks: ReadonlyArray<readonly [number, number, number, number, number, number, number, number]> = [
    [0.0, 0.62, 0.0, 1.4, 1.14, 1.2, 0.25, 0.12], [-1.18, 0.38, 0.46, 0.94, 0.8, 0.86, 1.35, -0.18],
    [1.06, 0.34, -0.34, 1.0, 0.74, 0.9, 2.4, 0.14], [0.24, 0.18, 0.92, 0.76, 0.58, 0.74, 0.85, -0.08],
  ];
  const merged = mergeAndDispose(
    rocks.map(([x, y, z, sx, sy, sz, ry, rz]) =>
      new THREE.IcosahedronGeometry(1, 0).scale(sx, sy, sz).rotateZ(rz).rotateY(ry).translate(x, y, z),
    ),
    () => new THREE.IcosahedronGeometry(1.2, 0),
  );
  return applyBaseAo(merged, -0.45, 1.72, 0.42, 1.05, 0.04);
}

export function buildContactShadowGeometry(): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(2, 2);
  geo.rotateX(-Math.PI / 2);
  return geo;
}

export function createContactShadowMaterial(): { material: THREE.MeshBasicMaterial; texture: THREE.CanvasTexture } {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
    grad.addColorStop(0.0, 'rgba(12, 18, 12, 0.92)');
    grad.addColorStop(0.42, 'rgba(14, 22, 14, 0.64)');
    grad.addColorStop(0.76, 'rgba(18, 26, 16, 0.22)');
    grad.addColorStop(1.0, 'rgba(18, 26, 16, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const material = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: 0.68, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
  });
  return { material, texture };
}
