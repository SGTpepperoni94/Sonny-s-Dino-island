import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PALETTE } from '../config/palette';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import { applyBaseAo } from './ScatterGeometry';
import {
  computeTerrainHeight, getVolcanoTrailSample, LAVA_CHANNEL_POINTS,
  VOLCANO_CENTER_X, VOLCANO_CENTER_Z, VOLCANO_CRATER_LAVA_Y,
  VOLCANO_CRATER_RADIUS, VOLCANO_TRAIL_POINTS,
} from './terrainMath';

export interface VolcanoBuildContext {
  basaltMat: THREE.Material;
  timeUniform: { value: number };
  trackGeo: <T extends THREE.BufferGeometry>(g: T) => T;
  trackMat: <T extends THREE.Material>(m: T) => T;
}

export interface VolcanoBasaltPlacement {
  x: number; y: number; z: number; rotY: number; tiltX: number; tiltZ: number;
  sx: number; sy: number; sz: number; lavaWarmth: number;
}

function detRand(seed: number): number {
  const v = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * Generates jagged stepped basalt borders framing VOLCANO_TRAIL_POINTS and canyon rim
 * (breaking up the straight dirt ramp while leaving >= 8m smooth walkable corridor).
 */
export function computeVolcanoBasaltPlacements(): VolcanoBasaltPlacement[] {
  const out: VolcanoBasaltPlacement[] = [];
  const summit = WORLD_ANCHORS.volcanoSummit;

  for (let s = 0; s < VOLCANO_TRAIL_POINTS.length - 1; s++) {
    const [ax, az] = VOLCANO_TRAIL_POINTS[s], [bx, bz] = VOLCANO_TRAIL_POINTS[s + 1];
    const dx = bx - ax, dz = bz - az, segLen = Math.hypot(dx, dz) || 1;
    const lx = dz / segLen, lz = -dx / segLen, steps = s === 0 ? 4 : 6;
    for (let k = 0; k < steps; k++) {
      const segFrac = (k + 0.35) / steps;
      const globalT = (s + segFrac) / (VOLCANO_TRAIL_POINTS.length - 1);
      if (globalT < 0.24) continue;
      const cx = ax + dx * segFrac, cz = az + dz * segFrac;
      for (const side of [-1, 1]) {
        const seed = s * 97 + k * 19 + (side > 0 ? 5 : 53);
        const r1 = detRand(seed), r2 = detRand(seed + 11), r3 = detRand(seed + 29);
        const lat = (4.35 + r1 * 2.35 + (k % 2) * 0.45) * side;
        const px = cx + lx * lat, pz = cz + lz * lat;
        if (getVolcanoTrailSample(px, pz).dist < 4.05 || Math.hypot(px - summit.x, pz - summit.z) < 4.2) continue;
        if (Math.hypot(px - 44, pz + 32) < 7.8) continue;
        const py = computeTerrainHeight(px, pz);
        const w = 1.25 + r3 * 1.1;
        out.push({
          x: px, y: py - 0.85, z: pz, rotY: r1 * Math.PI * 2,
          tiltX: (r2 - 0.5) * 0.28, tiltZ: (r3 - 0.5) * 0.28,
          sx: w, sy: (side < 0 ? 0.94 : 1.12) + r2 * 1.08 + globalT * 0.42, sz: w * (0.78 + r2 * 0.38),
          lavaWarmth: side > 0 ? 0.55 + r1 * 0.3 : 0.1 + r1 * 0.15,
        });
      }
    }
  }

  for (let s = 0; s < LAVA_CHANNEL_POINTS.length - 1; s++) {
    const [ax, az] = LAVA_CHANNEL_POINTS[s], [bx, bz] = LAVA_CHANNEL_POINTS[s + 1];
    const dx = bx - ax, dz = bz - az, segLen = Math.hypot(dx, dz) || 1;
    const nwX = -dz / segLen, nwZ = dx / segLen;
    for (let k = 0; k < 3; k++) {
      const t = (k + 0.45) / 3, seed = 401 + s * 31 + k * 13;
      const r1 = detRand(seed), r2 = detRand(seed + 7);
      const px = ax + dx * t + nwX * (7.2 + r1 * 2.4), pz = az + dz * t + nwZ * (7.2 + r1 * 2.4);
      if (getVolcanoTrailSample(px, pz).dist < 4.5) continue;
      out.push({
        x: px, y: computeTerrainHeight(px, pz) - 1.0, z: pz,
        rotY: r1 * Math.PI * 2, tiltX: (r2 - 0.5) * 0.24, tiltZ: (r1 - 0.5) * 0.24,
        sx: 1.6 + r2 * 1.1, sy: 1.7 + r1 * 1.4, sz: 1.4 + r1 * 0.9, lavaWarmth: 0.72,
      });
    }
  }
  return out;
}

function buildBasaltCragGeometry(): THREE.BufferGeometry {
  const pillars: ReadonlyArray<readonly [number, number, number, number, number, number, number, number]> = [
    [0.0, 0.85, 0.0, 0.16, 1.2, 2.65, 0.0, 0.12],
    [0.74, 0.54, 0.28, 0.12, 0.86, 1.92, 1.15, -0.22],
    [-0.66, 0.46, -0.26, 0.14, 0.82, 1.68, 2.35, 0.2],
  ];
  const parts = pillars.map(([x, y, z, rTop, rBot, h, ry, rz]) => {
    const raw = new THREE.CylinderGeometry(rTop, rBot, h, 4, 1, false);
    const g = raw.toNonIndexed();
    raw.dispose();
    if (g.hasAttribute('uv')) g.deleteAttribute('uv');
    g.computeVertexNormals();
    return g.rotateZ(rz).rotateY(ry).translate(x, y, z);
  });
  const merged = mergeGeometries(parts, false);
  for (const p of parts) p.dispose();
  const geo = merged ?? new THREE.OctahedronGeometry(1.1, 0);
  geo.computeVertexNormals();
  return applyBaseAo(geo, -0.45, 2.15, 0.44, 1.08, 0.03);
}

export function buildVolcanoDrama(parent: THREE.Group, ctx: VolcanoBuildContext): void {
  const { basaltMat, timeUniform, trackGeo, trackMat } = ctx;
  const lavaMat = trackMat(new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uCore: { value: new THREE.Color(0xffe042) },
      uGlow: { value: new THREE.Color(0xff5a06) },
      uEdge: { value: new THREE.Color(0xc81c00) },
      uCrust: { value: new THREE.Color(0x520b03) },
    },
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `varying vec2 vUv; varying vec3 vWorldPos;
      void main(){ vUv=uv; vec4 wp=modelMatrix*vec4(position,1.0); vWorldPos=wp.xyz; gl_Position=projectionMatrix*viewMatrix*wp; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCore,uGlow,uEdge,uCrust; varying vec2 vUv; varying vec3 vWorldPos;
      vec2 lvHash(vec2 p){ p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))); return fract(sin(p)*43758.5453); }
      float lavaCellEdge(vec2 x){
        vec2 n=floor(x), f=fract(x); float d1=8.0, d2=8.0;
        for(int j=-1;j<=1;j++){ for(int i=-1;i<=1;i++){
          vec2 g=vec2(float(i),float(j));
          vec2 o=0.5+0.42*sin(uTime*0.55+6.2831*lvHash(n+g));
          float d=length(g+o-f);
          if(d<d1){ d2=d1; d1=d; } else if(d<d2){ d2=d; }
        }}
        return d2-d1;
      }
      void main(){
        vec2 flow=vWorldPos.xz*0.44+vec2(uTime*0.14,-uTime*0.34);
        float cell=lavaCellEdge(flow);
        float crack=1.0-smoothstep(0.02,0.17,cell);
        float pulse=0.90+0.10*sin(uTime*2.1+vWorldPos.x*0.4-vWorldPos.z*0.35);
        float across=abs(vUv.x-0.5)*2.0;
        float hotRim=smoothstep(0.58,0.88,across)*(1.0-smoothstep(0.90,1.0,across));
        float darkEdge=smoothstep(0.86,1.0,across);
        vec3 magma=mix(uCrust,uGlow*1.08,smoothstep(0.10,0.52,1.0-cell*0.95));
        magma=mix(magma,uCore*1.28,clamp(crack*1.05+hotRim*0.48,0.0,1.0));
        magma=mix(magma,uEdge*1.18,darkEdge*0.76);
        gl_FragColor=vec4(magma*pulse,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));

  const craterGeo = trackGeo(new THREE.CircleGeometry(VOLCANO_CRATER_RADIUS, 20));
  craterGeo.rotateX(-Math.PI / 2);
  const craterMesh = new THREE.Mesh(craterGeo, lavaMat);
  craterMesh.position.set(VOLCANO_CENTER_X, VOLCANO_CRATER_LAVA_Y, VOLCANO_CENTER_Z);
  craterMesh.name = 'VolcanoCraterLava';
  parent.add(craterMesh);

  const lavaPts: Array<[number, number]> = [];
  const subSteps = 6;
  for (let s = 0; s < LAVA_CHANNEL_POINTS.length - 1; s++) {
    const a = LAVA_CHANNEL_POINTS[s], b = LAVA_CHANNEL_POINTS[s + 1];
    const steps = s === LAVA_CHANNEL_POINTS.length - 2 ? subSteps : subSteps - 1;
    for (let k = 0; k <= steps; k++) lavaPts.push([a[0] + (b[0] - a[0]) * (k / subSteps), a[1] + (b[1] - a[1]) * (k / subSteps)]);
  }
  const verts: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let i = 0; i < lavaPts.length; i++) {
    const [px, pz] = lavaPts[i];
    const next = lavaPts[Math.min(lavaPts.length - 1, i + 1)], prev = lavaPts[Math.max(0, i - 1)];
    const tx = next[0] - prev[0], tz = next[1] - prev[1], len = Math.hypot(tx, tz) || 1;
    const rx = (-tz / len) * 4.35, rz = (tx / len) * 4.35, py = computeTerrainHeight(px, pz) + 0.46;
    verts.push(px - rx, py, pz - rz, px + rx, py, pz + rz);
    const vCoord = i / (lavaPts.length - 1);
    uvs.push(0, vCoord, 1, vCoord);
    if (i < lavaPts.length - 1) { const b = i * 2; indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
  }
  const riverGeo = trackGeo(new THREE.BufferGeometry());
  riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  riverGeo.setIndex(indices);
  riverGeo.computeVertexNormals();
  const riverMesh = new THREE.Mesh(riverGeo, lavaMat);
  riverMesh.name = 'VolcanoLavaRiver';
  parent.add(riverMesh);

  const placements = computeVolcanoBasaltPlacements();
  const basaltInst = new THREE.InstancedMesh(trackGeo(buildBasaltCragGeometry()), basaltMat, placements.length);
  basaltInst.name = 'InstancedVolcanoBasalt';
  basaltInst.castShadow = basaltInst.receiveShadow = true;
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const darkBase = new THREE.Color(PALETTE.volcanoRockDark), warmBounce = new THREE.Color(0x6d3b4c);
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.tiltX, p.rotY, p.tiltZ);
    dummy.scale.set(p.sx, p.sy, p.sz);
    dummy.updateMatrix();
    basaltInst.setMatrixAt(i, dummy.matrix);
    basaltInst.setColorAt(i, col.copy(darkBase).lerp(warmBounce, p.lavaWarmth * 0.58));
  }
  basaltInst.instanceMatrix.needsUpdate = true;
  if (basaltInst.instanceColor) basaltInst.instanceColor.needsUpdate = true;
  basaltInst.computeBoundingSphere();
  parent.add(basaltInst);
}
