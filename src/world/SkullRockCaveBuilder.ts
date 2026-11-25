import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import type { MaterialLibrary } from '../engine/MaterialLibrary';
import { SKULL_CAVE_ORIGIN_X, SKULL_CAVE_ORIGIN_Z } from './terrainMath';
import { createCraggyPillarGeo, type LandmarkTracker } from './WaterfallLagoonBuilder';

export interface SkullCaveBuildOptions extends LandmarkTracker {
  presets: ReturnType<MaterialLibrary['getPalettePresets']>;
  timeUniform: { value: number };
  torchLights: THREE.PointLight[];
}

export const SKULL_CAVE_FACE_ANGLE = Math.atan2(-0.56, 0.8285);

// Stepped craggy headland buttresses embedding skull facade & flanking mouth (flanks rooted at y=-2.8; crown above vault)
export const SKULL_FLANK_PILLARS: ReadonlyArray<readonly [number, number, number, number, number, boolean, number]> = [
  [-9.8, 5.2, 2.35, -2.8, 4.1, true, 0xb8a38c], [-9.1, 1.2, 2.75, -2.8, 9.8, true, 0xbfa88e],
  [-10.4, -2.8, 3.4, -2.8, 13.6, true, 0x9b928b], [-12.6, -7.2, 4.0, -2.8, 15.2, true, 0x8e8682],
  [-11.8, -12.0, 3.8, -2.8, 13.4, true, 0x87817f], [9.6, 5.0, 2.45, -2.8, 4.3, true, 0xcab498],
  [9.1, 1.0, 2.75, -2.8, 9.8, true, 0xc6ae92], [10.4, -3.0, 3.4, -2.8, 13.4, true, 0xb09b86],
  [12.6, -7.4, 4.0, -2.8, 14.8, true, 0x9e8f82], [11.8, -12.2, 3.8, -2.8, 12.8, true, 0x92877e],
  [-5.0, -4.6, 4.4, 8.2, 16.0, true, 0xa39588], [5.0, -4.6, 4.4, 8.2, 15.8, true, 0xb29f8a],
  [0.0, -7.6, 5.8, 8.4, 17.2, true, 0xa8998a], [0.0, -21.4, 7.2, -2.8, 12.5, false, 0x766d68],
];

type Vec3 = readonly [number, number, number];

function addPart(
  parent: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material,
  pos: Vec3, scale: Vec3 = [1, 1, 1], rot: Vec3 = [0, 0, 0], castShadow = false,
): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.scale.set(scale[0], scale[1], scale[2]);
  m.rotation.set(rot[0], rot[1], rot[2]);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function createBeveledShapeGeo(pts: ReadonlyArray<readonly [number, number]>, depth: number, bevel = 0.16): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.9, bevelSegments: 1 });
  geo.center();
  return geo;
}

function buildPirateSkullFacade(parent: THREE.Group, opts: SkullCaveBuildOptions): void {
  const { presets, trackGeo, trackMat, torchLights } = opts;
  const skull = new THREE.Group();
  skull.name = 'PirateSkullFacade';
  skull.position.set(0, 8.45, 0.72);
  skull.scale.setScalar(0.84);
  skull.rotation.x = 0.04;

  // Cranium dome, heavy faceted brow ridges, glabella, beveled maxilla & seated cheek/jamb blocks
  addPart(skull, trackGeo(new THREE.DodecahedronGeometry(6.35, 1)), presets.skullBone, [0, 0.95, -0.65], [1.18, 0.92, 0.88], [0, 0, 0], true);
  const browGeo = trackGeo(createBeveledShapeGeo([[-1.95, 0.62], [1.95, 0.62], [1.8, -0.56], [-1.8, -0.56]], 2.1, 0.22));
  const cheekGeo = trackGeo(new THREE.DodecahedronGeometry(3.15, 0));
  const jambGeo = trackGeo(new THREE.DodecahedronGeometry(2.65, 0));
  for (const s of [-1, 1] as const) {
    addPart(skull, browGeo, presets.skullBone, [s * 2.55, 1.44, 4.02], [1, 1, 1], [0.08, s * -0.14, s * -0.14], true);
    addPart(skull, cheekGeo, presets.skullBone, [s * 4.85, -1.55, 2.45], [1.24, 0.88, 0.96], [0, 0, 0], true);
    addPart(skull, jambGeo, presets.skullBoneDark, [s * 5.95, -3.55, 0.95], [1.2, 1.38, 1.15]);
  }
  addPart(skull, trackGeo(new THREE.DodecahedronGeometry(1.65, 0)), presets.skullBone, [0, 1.22, 4.44], [1.1, 0.9, 0.85]);
  addPart(skull, trackGeo(createBeveledShapeGeo([[-4.35, 0.85], [4.35, 0.85], [3.65, -0.95], [-3.65, -0.95]], 2.35, 0.28)), presets.skullBone, [0, -2.42, 3.65], [1, 1, 1], [0, 0, 0], true);
  addPart(skull, trackGeo(new THREE.ConeGeometry(1.42, 2.55, 3)), presets.caveInterior, [0, -0.95, 4.82], [1, 1, 1], [0.12, Math.PI, 0]);

  // Recessed warm amber-lit left eye socket + flickering lantern flame + PointLight (1 of 3)
  const socketGeo = trackGeo(new THREE.CylinderGeometry(2.04, 1.42, 2.25, 6)).rotateX(Math.PI / 2);
  addPart(skull, socketGeo, presets.caveInterior, [-2.85, 0.12, 4.22]);
  addPart(skull, socketGeo, presets.caveInterior, [2.85, 0.12, 4.18]);
  const eyeLinerMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffb340, emissive: new THREE.Color(0xff7c14), emissiveIntensity: 1.15, flatShading: true, roughness: 0.55,
  }));
  addPart(skull, trackGeo(new THREE.CylinderGeometry(1.62, 1.08, 1.15, 6)).rotateX(Math.PI / 2), eyeLinerMat, [-2.85, 0.1, 4.45]);
  addPart(skull, trackGeo(new THREE.OctahedronGeometry(0.88, 0)), presets.torchGlow, [-2.85, -0.12, 4.88], [0.8, 1.38, 0.8]);

  const eyeLight = new THREE.PointLight(0xffa733, 24, 28, 1.5);
  eyeLight.position.set(-2.85, 0.1, 6.2);
  skull.add(eyeLight);
  torchLights.push(eyeLight);

  // Right-eye pirate eyepatch + diagonal leather strap tucked cleanly under red bandana rim with zero overhang
  const patchGeo = trackGeo(new THREE.CylinderGeometry(2.32, 2.04, 0.82, 7)).rotateX(Math.PI / 2);
  addPart(skull, patchGeo, presets.eyepatchDark, [2.85, 0.08, 4.92], [1.12, 0.94, 1.0]);
  addPart(skull, trackGeo(new THREE.BoxGeometry(7.2, 0.52, 0.54)), presets.eyepatchDark, [0.42, 1.14, 4.86], [1, 1, 1], [0, 0, -0.25]);

  // Faceted Red Pirate Bandana crown + rolled forehead rim + side knot + sweeping dual ribbons
  addPart(skull, trackGeo(new THREE.SphereGeometry(7.25, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.45)), presets.bandanaRed, [0, 1.4, -0.45], [1.22, 0.92, 0.98], [0, 0, -0.06], true);
  addPart(skull, trackGeo(new THREE.TorusGeometry(6.55, 0.86, 5, 12, Math.PI * 1.1)), presets.bandanaRed, [0.1, 2.26, 0.24], [1.22, 0.92, 1.0], [Math.PI / 2 + 0.14, -0.06, -0.14]);
  addPart(skull, trackGeo(new THREE.DodecahedronGeometry(1.78, 0)), presets.bandanaRed, [7.85, 1.7, 1.85]);
  const ribbonGeo = trackGeo(new THREE.OctahedronGeometry(1, 0));
  addPart(skull, ribbonGeo, presets.bandanaRed, [11.35, 2.65, 1.55], [4.1, 1.32, 0.52], [0.12, -0.18, 0.18]);
  addPart(skull, ribbonGeo, presets.bandanaRed, [10.15, -1.5, 1.95], [4.25, 1.38, 0.52], [0.18, -0.15, -0.96]);

  // 5 Chunky Beveled Overhanging Stone Teeth framing the vaulted open-jaw cavern
  const toothGeo = trackGeo(createBeveledShapeGeo([[-0.6, 0.9], [0.6, 0.9], [0.46, -0.82], [-0.46, -0.82]], 1.05, 0.16));
  [-3.6, -1.8, 0, 1.8, 3.6].forEach((tx, i) => {
    addPart(skull, toothGeo, i % 2 === 0 ? presets.skullBone : presets.skullBoneDark, [tx, -4.02 - Math.abs(tx) * 0.1, 4.52 - Math.abs(tx) * 0.24], [1, 1, 1], [0.06, tx * -0.06, tx * 0.05], true);
  });
  parent.add(skull);
}

function buildCaveSconcesAndReflections(group: THREE.Group, jambMat: THREE.Material, opts: SkullCaveBuildOptions): void {
  const { presets, trackGeo, trackMat, timeUniform, torchLights } = opts;
  const dummy = new THREE.Object3D();
  const torchPos: ReadonlyArray<Vec3> = [
    [-5.95, 2.55, -1.3], [-6.05, 2.55, -5.8], [-6.05, 2.55, -10.4],
    [-6.05, 2.55, -15.0], [6.05, 2.55, -2.0], [6.05, 2.55, -8.4],
  ];
  const poleInst = new THREE.InstancedMesh(trackGeo(new THREE.CylinderGeometry(0.14, 0.19, 1.55, 6)), presets.woodDock, torchPos.length);
  const cupInst = new THREE.InstancedMesh(trackGeo(new THREE.CylinderGeometry(0.32, 0.2, 0.38, 6)), presets.eyepatchDark, torchPos.length);
  const bracketInst = new THREE.InstancedMesh(trackGeo(new THREE.BoxGeometry(1.9, 0.34, 0.36)), presets.eyepatchDark, torchPos.length);
  const plinthInst = new THREE.InstancedMesh(trackGeo(new THREE.CylinderGeometry(0.42, 0.62, 2.35, 6)), jambMat, 4);
  const flameInst = new THREE.InstancedMesh(trackGeo(new THREE.OctahedronGeometry(0.46, 0)), presets.torchGlow, torchPos.length);
  const setM = (inst: THREE.InstancedMesh, idx: number, p: Vec3, r: Vec3, s: Vec3 = [1, 1, 1]) => {
    dummy.position.set(p[0], p[1], p[2]); dummy.rotation.set(r[0], r[1], r[2]); dummy.scale.set(s[0], s[1], s[2]);
    dummy.updateMatrix(); inst.setMatrixAt(idx, dummy.matrix);
  };
  let plinthIdx = 0;
  torchPos.forEach(([tx, ty, tz], i) => {
    const dir = tx < 0 ? 1 : -1;
    setM(poleInst, i, [tx, ty - 0.45, tz], [0, 0, dir * -0.18]);
    setM(bracketInst, i, [tx - dir * 0.9, ty - 0.35, tz], [0, 0, 0]);
    if (tx < 0 && plinthIdx < 4) setM(plinthInst, plinthIdx++, [tx - 0.15, ty - 1.48, tz], [0, 0, 0]);
    setM(cupInst, i, [tx + dir * 0.14, ty + 0.22, tz], [0, 0, dir * -0.18]);
    setM(flameInst, i, [tx + dir * 0.2, ty + 0.62, tz], [0, i * 0.9, 0], [0.72, 1.35, 0.72]);
  });
  poleInst.instanceMatrix.needsUpdate = cupInst.instanceMatrix.needsUpdate = true;
  bracketInst.instanceMatrix.needsUpdate = plinthInst.instanceMatrix.needsUpdate = flameInst.instanceMatrix.needsUpdate = true;
  group.add(poleInst, cupInst, bracketInst, plinthInst, flameInst);

  for (const [lx, ly, lz, color, intensity] of [[-1.2, 3.8, -3.5, 0xffa436, 28], [-0.8, 3.8, -11.5, 0xff9628, 26]] as const) {
    const light = new THREE.PointLight(color, intensity, 26, 1.5);
    light.position.set(lx, ly, lz);
    group.add(light);
    torchLights.push(light);
  }

  const reflMesh = new THREE.Mesh(trackGeo(new THREE.PlaneGeometry(5.2, 22.0, 2, 12)).rotateX(-Math.PI / 2), trackMat(new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      void main(){
        float r=sin(vUv.y*54.0-uTime*3.4+sin(vUv.x*11.0)*1.3)*0.5+0.5;
        float b=exp(-pow((vUv.x-0.17)/0.14,2.0))+exp(-pow((vUv.x-0.83)/0.13,2.0))*0.85;
        float s=b*smoothstep(0.0,0.1,vUv.y)*smoothstep(1.0,0.84,vUv.y)*(0.3+0.7*smoothstep(0.28,0.82,r));
        gl_FragColor=vec4(mix(vec3(1.0,0.62,0.08),vec3(1.0,0.96,0.52),s),s*0.84);
      }`,
  })));
  reflMesh.position.set(2.8, 0.09, -3.8);
  reflMesh.renderOrder = 4;
  group.add(reflMesh);
}

/** Builds Skull Rock Pirate Cave on the SE coastline matching docs/references/skull-cave.png. */
export function buildSkullRockPirateCave(parent: THREE.Group, opts: SkullCaveBuildOptions): THREE.Group {
  const { presets, trackGeo, trackMat } = opts;
  const group = new THREE.Group();
  group.name = 'SkullRockPirateCave';
  group.position.set(SKULL_CAVE_ORIGIN_X, 0, SKULL_CAVE_ORIGIN_Z);
  group.rotation.y = SKULL_CAVE_FACE_ANGLE;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  // 1. Vaulted dark-warm stone cavern shell + grounded jaw-jamb piers & faceted tunnel arch ribs
  const archGeo = trackGeo(new THREE.CylinderGeometry(7.2, 7.8, 22.4, 10, 2, true, 0, Math.PI)).rotateZ(Math.PI / 2).rotateY(Math.PI / 2);
  addPart(group, archGeo, trackMat(new THREE.MeshStandardMaterial({
    color: PALETTE.caveInterior, flatShading: true, roughness: 0.94, side: THREE.DoubleSide,
  })), [0, -0.65, -9.9], [1.06, 1.04, 1.0]);

  const jambPierGeo = trackGeo(createCraggyPillarGeo(0.88, 1.32));
  const jambMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xbda589, flatShading: true, roughness: 0.9 }));
  for (const s of [-1, 1] as const) {
    addPart(group, jambPierGeo, jambMat, [s * 6.35, 2.05, 2.4], [1.95, 9.1, 2.55], [0, s * 0.45, 0], true);
    addPart(group, jambPierGeo, jambMat, [s * 7.25, 0.95, 4.35], [1.75, 5.8, 2.0], [0, s * -0.55, 0], true);
  }

  const ribZ = [1.55, -0.85, -3.6, -6.8, -10.2, -13.6, -16.8];
  const ribMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.92 }));
  const ribInst = new THREE.InstancedMesh(trackGeo(new THREE.TorusGeometry(6.95, 1.12, 5, 10, Math.PI)), ribMat, ribZ.length);
  ribZ.forEach((rz, i) => {
    dummy.position.set(0, -0.65, rz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(i === 0 ? 1.02 : 1.06, 1.04, i === 0 ? 1.25 : 1.05);
    dummy.updateMatrix();
    ribInst.setMatrixAt(i, dummy.matrix);
    ribInst.setColorAt(i, tint.setHex(i <= 1 ? 0xb99d7d : i <= 3 ? 0xa38b74 : 0x8d7a6c));
  });
  ribInst.instanceMatrix.needsUpdate = true;
  if (ribInst.instanceColor) ribInst.instanceColor.needsUpdate = true;
  ribInst.receiveShadow = true;
  group.add(ribInst);

  // 2. Grounded craggy mossy-capped headland buttresses with warm/cool facet & rim separation
  const pillarMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xffffff, flatShading: true, roughness: 0.9, metalness: 0.02 }));
  const mossMat = trackMat(new THREE.MeshStandardMaterial({ color: PALETTE.meadowLime, flatShading: true, roughness: 0.84, metalness: 0.02 }));
  const pillarInst = new THREE.InstancedMesh(trackGeo(createCraggyPillarGeo(0.92, 1.38)), pillarMat, SKULL_FLANK_PILLARS.length);
  const capInst = new THREE.InstancedMesh(trackGeo(new THREE.DodecahedronGeometry(1.0, 0)), mossMat, SKULL_FLANK_PILLARS.filter((p) => p[5]).length);
  let mossIdx = 0;
  SKULL_FLANK_PILLARS.forEach(([fx, fz, rTop, baseY, topY, hasMoss, hex], i) => {
    const h = topY - baseY;
    dummy.position.set(fx, baseY + h * 0.5, fz);
    dummy.rotation.set(0, i * 0.72, 0);
    dummy.scale.set(rTop, h, rTop * 1.14);
    dummy.updateMatrix();
    pillarInst.setMatrixAt(i, dummy.matrix);
    pillarInst.setColorAt(i, tint.setHex(hex));
    if (hasMoss) {
      dummy.position.set(fx, topY - 0.08, fz);
      dummy.scale.set(rTop * 0.94, 0.72, rTop * 0.98);
      dummy.updateMatrix();
      capInst.setMatrixAt(mossIdx++, dummy.matrix);
    }
  });
  pillarInst.instanceMatrix.needsUpdate = capInst.instanceMatrix.needsUpdate = true;
  if (pillarInst.instanceColor) pillarInst.instanceColor.needsUpdate = true;
  pillarInst.castShadow = pillarInst.receiveShadow = true;
  group.add(pillarInst, capInst);

  buildPirateSkullFacade(group, opts);

  // 3. Extended grounded cobblestone-curbed walkable left quay ledge curving cleanly along beach-to-water edge
  const curbInst = new THREE.InstancedMesh(trackGeo(new THREE.BoxGeometry(1.12, 1.48, 1.42)), presets.cobbleWarm, 22);
  for (let i = 0; i < 22; i++) {
    const cz = 11.4 - i * 1.32;
    const curveOut = cz > 3.0 ? -Math.pow((cz - 3.0) * 0.28, 1.55) : 0;
    dummy.position.set(-0.22 + curveOut, 0.48, cz);
    dummy.rotation.set(0, cz > 3.0 ? -0.22 - (cz - 3.0) * 0.05 : (i % 2 === 0 ? 1 : -1) * 0.03, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    curbInst.setMatrixAt(i, dummy.matrix);
  }
  curbInst.instanceMatrix.needsUpdate = true;
  curbInst.receiveShadow = true;
  group.add(curbInst);

  buildCaveSconcesAndReflections(group, jambMat, opts);
  parent.add(group);
  return group;
}
