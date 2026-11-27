import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {
  DINO_SHOWCASE_SPAWNS,
  DINO_SPECIES_SPECS,
  type DinoSpawnDef,
} from '../config/dinoCatalog';
import type { LoadedDinoAsset } from '../engine/AssetManifestClient';
import { buildContactShadowGeometry, createContactShadowMaterial } from '../world/ScatterGeometry';
import type { TerrainQuery } from '../world/TerrainQuery';

export interface BuiltDinoRig {
  readonly id: string;
  readonly root: THREE.Group;
  readonly model: THREE.Object3D;
  readonly scale: number;
  readonly groundY: number;
  readonly animations: THREE.AnimationClip[];
}

export interface DinoContactShadowBatch {
  readonly mesh: THREE.InstancedMesh;
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.MeshBasicMaterial;
  readonly texture: THREE.CanvasTexture | null;
  readonly baseMatrices: THREE.Matrix4[];
  readonly worldPos: THREE.Vector3[];
  readonly hidden: boolean[];
}

/**
 * Computes uniform scale from target real-world height (meters) divided by native GLB height.
 */
export function computeDinoUniformScale(targetHeightMeters: number, nativeHeight: number): number {
  if (!Number.isFinite(targetHeightMeters) || targetHeightMeters <= 0) {
    throw new Error(`Invalid targetHeightMeters: ${targetHeightMeters}`);
  }
  if (!Number.isFinite(nativeHeight) || nativeHeight <= 0) {
    throw new Error(`Invalid nativeHeight: ${nativeHeight}`);
  }
  return targetHeightMeters / nativeHeight;
}

const _hsl = { h: 0, s: 0, l: 0 };
const UP_AXIS = new THREE.Vector3(0, 1, 0);
const DOWN_AXIS = new THREE.Vector3(0, -1, 0);
const _raycaster = new THREE.Raycaster();
const _rayOrigin = new THREE.Vector3();
const _hits: THREE.Intersection[] = [];

interface GroundSample {
  readonly y: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
}

/**
 * Samples the exact rendered low-poly terrain triangle height & normal when the IslandTerrain
 * mesh is available (eliminating chord hover on convex ridges), falling back to TerrainQuery.
 */
function sampleDinoGroundSurface(
  x: number,
  z: number,
  terrain: TerrainQuery,
  terrainMesh: THREE.Mesh | null,
): GroundSample {
  const analyticalY = terrain.getTerrainHeight(x, z);
  const analyticalN = terrain.getTerrainNormal(x, z);
  if (terrainMesh) {
    terrainMesh.updateMatrixWorld();
    _rayOrigin.set(x, analyticalY + 18, z);
    _raycaster.set(_rayOrigin, DOWN_AXIS);
    _hits.length = 0;
    _raycaster.intersectObject(terrainMesh, false, _hits);
    if (_hits.length > 0) {
      const hit = _hits[0];
      const fn = hit.face?.normal;
      if (fn && fn.y > 0.5) {
        return { y: hit.point.y, nx: fn.x, ny: fn.y, nz: fn.z };
      }
      return { y: hit.point.y, nx: analyticalN.nx, ny: analyticalN.ny, nz: analyticalN.nz };
    }
  }
  return { y: analyticalY, nx: analyticalN.nx, ny: analyticalN.ny, nz: analyticalN.nz };
}

function liftSingleDinoMaterial(mat: THREE.Material): void {
  mat.userData.sharedResource = true;
  if (!(mat instanceof THREE.MeshStandardMaterial)) return;
  if (mat.userData.sunlitLifted === true) return;
  mat.userData.sunlitLifted = true;
  mat.roughness = 0.85;
  mat.metalness = 0;

  mat.color.getHSL(_hsl, THREE.SRGBColorSpace);
  // Preserve natural dark accents (eyes, pupils, claws) so they never wash out to grey
  if (_hsl.l < 0.14 || /black|eye|pupil/i.test(mat.name)) return;

  const liftedL = Math.min(0.75, _hsl.l * 1.08 + 0.16);
  const liftedS = _hsl.s > 0.02 ? Math.min(0.56, _hsl.s * 1.35 + 0.14) : _hsl.s;
  mat.color.setHSL(_hsl.h, liftedS, liftedL, THREE.SRGBColorSpace);
}

/**
 * Applies a calibrated, idempotent sunlit brightness and saturation lift to cached
 * dinosaur MeshStandardMaterials (strictly once per shared material via sunlitLifted guard).
 */
export function applySunlitDinoMaterialLift(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.material) return;
    if (Array.isArray(child.material)) {
      for (let i = 0; i < child.material.length; i++) {
        liftSingleDinoMaterial(child.material[i]);
      }
    } else {
      liftSingleDinoMaterial(child.material);
    }
  });
}

/**
 * Builds the single instanced contact-shadow batch aligned to each dinosaur's rendered ground surface.
 */
export function createDinoContactShadowBatch(
  terrain: TerrainQuery,
  terrainMesh: THREE.Mesh | null = null,
): DinoContactShadowBatch {
  const geometry = buildContactShadowGeometry();
  const hasDom = typeof document !== 'undefined';
  const created = hasDom ? createContactShadowMaterial() : null;
  const material = created
    ? created.material
    : new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.56, depthWrite: false });
  material.opacity = 0.56;
  const texture = created ? created.texture : null;

  const mesh = new THREE.InstancedMesh(geometry, material, DINO_SHOWCASE_SPAWNS.length);
  mesh.name = 'DinoContactShadows';
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 1;

  const dummy = new THREE.Object3D();
  const normal = new THREE.Vector3();
  const alignQuat = new THREE.Quaternion();
  const yawQuat = new THREE.Quaternion();
  const baseMatrices: THREE.Matrix4[] = [];
  const worldPos: THREE.Vector3[] = [];
  const hidden: boolean[] = [];

  for (let i = 0; i < DINO_SHOWCASE_SPAWNS.length; i++) {
    const s = DINO_SHOWCASE_SPAWNS[i];
    const spec = DINO_SPECIES_SPECS[s.species];
    const g = sampleDinoGroundSurface(s.x, s.z, terrain, terrainMesh);
    dummy.position.set(s.x, g.y + 0.04, s.z);
    alignQuat.setFromUnitVectors(UP_AXIS, normal.set(g.nx, g.ny, g.nz).normalize());
    yawQuat.setFromAxisAngle(UP_AXIS, s.rotY);
    dummy.quaternion.multiplyQuaternions(alignQuat, yawQuat);
    dummy.scale.set(spec.shadowRadiusX, 1, spec.shadowRadiusZ);
    dummy.updateMatrix();
    baseMatrices.push(dummy.matrix.clone());
    worldPos.push(new THREE.Vector3(s.x, g.y, s.z));
    hidden.push(false);
    mesh.setMatrixAt(i, dummy.matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();

  return { mesh, geometry, material, texture, baseMatrices, worldPos, hidden };
}

/**
 * Clones a cached rigged dinosaur via SkeletonUtils.clone, applies manifest-driven uniform scale,
 * lifts materials for sunlit readability, grounds feet flush to rendered terrain, and tags shared resources.
 */
export function buildDinoRig(
  loaded: LoadedDinoAsset,
  spawn: DinoSpawnDef,
  terrain: TerrainQuery,
  isSoftwareGl: boolean,
  terrainMesh: THREE.Mesh | null = null,
): BuiltDinoRig {
  const spec = DINO_SPECIES_SPECS[spawn.species];
  const scale = computeDinoUniformScale(spec.targetHeightMeters, loaded.entry.height);
  const g = sampleDinoGroundSurface(spawn.x, spawn.z, terrain, terrainMesh);
  const slopeSink = Math.min(0.24, Math.max(0, (1 - g.ny) * 1.15));
  const groundY = g.y - 0.04 - slopeSink;

  // Strictly clone skinned hierarchies with SkeletonUtils.clone (never Object3D.clone)
  const cloned = SkeletonUtils.clone(loaded.gltf.scene);
  cloned.scale.setScalar(scale);
  cloned.position.set(0, 0, 0);

  cloned.traverse((child) => {
    child.userData.sharedResource = true;
    if (child instanceof THREE.Mesh) {
      child.castShadow = !isSoftwareGl;
      child.receiveShadow = !isSoftwareGl;
      child.frustumCulled = true;
    }
  });
  applySunlitDinoMaterialLift(cloned);

  const root = new THREE.Group();
  root.name = `Dino_${spawn.id}`;
  root.position.set(spawn.x, groundY, spawn.z);
  root.rotation.y = spawn.rotY;
  root.add(cloned);

  return {
    id: spawn.id,
    root,
    model: cloned,
    scale,
    groundY,
    animations: loaded.gltf.animations,
  };
}

/**
 * Disposes only per-clone Skeleton boneTextures created by WebGLRenderer for SkinnedMeshes,
 * strictly leaving userData.sharedResource geometries and materials untouched.
 */
export function disposeClonedSkeletons(root: THREE.Object3D): void {
  const seen = new Set<THREE.Skeleton>();
  root.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.skeleton && !seen.has(child.skeleton)) {
      seen.add(child.skeleton);
      child.skeleton.dispose();
    }
  });
}
