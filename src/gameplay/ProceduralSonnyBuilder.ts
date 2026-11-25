import * as THREE from 'three';
import { PALETTE } from '../config/palette';

export interface PlayerVisualShell {
  fallbackModel: THREE.Group;
  contactShadow: THREE.Mesh;
  clickRing: THREE.Mesh;
  ownedGeometries: THREE.BufferGeometry[];
  ownedMaterials: THREE.Material[];
}

export function buildProceduralSonnyShell(): PlayerVisualShell {
  const ownedGeometries: THREE.BufferGeometry[] = [];
  const ownedMaterials: THREE.Material[] = [];

  // 1. Charming composite 7-part procedural pirate kid (instant visual before GLTF finishes loading)
  const fallbackModel = new THREE.Group();
  const bootMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, flatShading: true, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x26547c, flatShading: true, roughness: 0.78 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xf7f4eb, flatShading: true, roughness: 0.72 });
  const vestMat = new THREE.MeshStandardMaterial({ color: 0xd93829, flatShading: true, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf5c69c, flatShading: true, roughness: 0.68 });
  const bandanaMat = new THREE.MeshStandardMaterial({ color: PALETTE.bandanaRed, flatShading: true, roughness: 0.6 });
  ownedMaterials.push(bootMat, pantsMat, shirtMat, vestMat, skinMat, bandanaMat);

  const legGeo = new THREE.BoxGeometry(0.24, 0.56, 0.26);
  const torsoGeo = new THREE.BoxGeometry(0.62, 0.66, 0.36);
  const armGeo = new THREE.BoxGeometry(0.2, 0.52, 0.22);
  const headGeo = new THREE.DodecahedronGeometry(0.34, 0);
  const capGeo = new THREE.SphereGeometry(0.36, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const tailGeo = new THREE.ConeGeometry(0.11, 0.34, 4);
  ownedGeometries.push(legGeo, torsoGeo, armGeo, headGeo, capGeo, tailGeo);

  const leftLeg = new THREE.Mesh(legGeo, pantsMat);
  leftLeg.position.set(-0.16, 0.28, 0);
  const rightLeg = new THREE.Mesh(legGeo, pantsMat);
  rightLeg.position.set(0.16, 0.28, 0);
  const torso = new THREE.Mesh(torsoGeo, shirtMat);
  torso.position.set(0, 0.88, 0);
  const vest = new THREE.Mesh(torsoGeo, vestMat);
  vest.position.set(0, 0.88, 0.01);
  vest.scale.set(1.06, 0.72, 1.04);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.42, 0.88, 0);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.42, 0.88, 0);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.position.set(0, 1.48, 0);
  const bandana = new THREE.Mesh(capGeo, bandanaMat);
  bandana.position.set(0, 1.54, 0);
  const tail = new THREE.Mesh(tailGeo, bandanaMat);
  tail.position.set(0.26, 1.56, -0.2);
  tail.rotation.set(-0.4, 0, -0.8);

  for (const m of [leftLeg, rightLeg, torso, vest, leftArm, rightArm, head, bandana, tail]) {
    m.castShadow = true;
    fallbackModel.add(m);
  }

  // 2. Soft contact shadow disc grounded flush on terrain
  const shadowGeo = new THREE.CircleGeometry(0.68, 16);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x0b2538,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  ownedGeometries.push(shadowGeo);
  ownedMaterials.push(shadowMat);
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.renderOrder = 1;

  // 3. Click-to-Run ground destination ring
  const ringGeo = new THREE.RingGeometry(0.42, 0.72, 18);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffe45e,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  ownedGeometries.push(ringGeo);
  ownedMaterials.push(ringMat);
  const clickRing = new THREE.Mesh(ringGeo, ringMat);
  clickRing.visible = false;
  clickRing.renderOrder = 3;

  return { fallbackModel, contactShadow, clickRing, ownedGeometries, ownedMaterials };
}
