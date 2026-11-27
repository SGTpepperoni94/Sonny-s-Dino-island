import * as THREE from 'three';
import { DINO_ALL_ACTIONS, DINO_SPECIES_SPECS } from '../config/dinoCatalog';
import type { DinoActionName, DinoSpecies } from '../types/game';

/** Distance beyond which dinosaur animation mixers are throttled (resolving TD-03). */
export const DINO_ANIM_THROTTLE_DIST = 90;
const THROTTLE_DIST_SQ = DINO_ANIM_THROTTLE_DIST * DINO_ANIM_THROTTLE_DIST;

/** Distance beyond which far-side dinosaurs and shadows are culled during aerial Title orbit. */
export const DINO_TITLE_CULL_DIST = 160;
const TITLE_CULL_DIST_SQ = DINO_TITLE_CULL_DIST * DINO_TITLE_CULL_DIST;

const _sphere = new THREE.Sphere();

/** Zero-GC distance check for aerial Title far-side dinosaur culling. */
export function shouldCullDinoAtDistance(
  cameraPos: THREE.Vector3,
  dinoPos: THREE.Vector3,
  maxDist = DINO_TITLE_CULL_DIST,
): boolean {
  const dx = cameraPos.x - dinoPos.x;
  const dy = cameraPos.y - dinoPos.y;
  const dz = cameraPos.z - dinoPos.z;
  const limitSq = maxDist === DINO_TITLE_CULL_DIST ? TITLE_CULL_DIST_SQ : maxDist * maxDist;
  return dx * dx + dy * dy + dz * dz > limitSq;
}

/**
 * Strictly exact-name clip lookup (`${species}_${action}`), never blind substring matching.
 */
export function findExactDinoClip(
  clips: readonly THREE.AnimationClip[],
  species: DinoSpecies,
  action: DinoActionName,
): THREE.AnimationClip | null {
  const expected = DINO_SPECIES_SPECS[species].clipNames[action];
  for (let i = 0; i < clips.length; i++) {
    if (clips[i].name === expected) return clips[i];
  }
  return null;
}

export function shouldUpdateDinoMixer(
  cameraPos: THREE.Vector3,
  dinoPos: THREE.Vector3,
  boundingRadius: number,
  frustum?: THREE.Frustum,
): boolean {
  const dx = cameraPos.x - dinoPos.x;
  const dy = cameraPos.y - dinoPos.y;
  const dz = cameraPos.z - dinoPos.z;
  if (dx * dx + dy * dy + dz * dz > THROTTLE_DIST_SQ) return false;
  if (frustum) {
    _sphere.center.copy(dinoPos);
    _sphere.radius = boundingRadius;
    if (!frustum.intersectsSphere(_sphere)) return false;
  }
  return true;
}

const LOOPING_ACTIONS: ReadonlySet<DinoActionName> = new Set(['Idle', 'Walk', 'Run']);

export class DinoAnimator {
  public readonly species: DinoSpecies;
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;
  private readonly actions: Partial<Record<DinoActionName, THREE.AnimationAction>> = {};
  private readonly availableList: DinoActionName[] = [];
  private readonly boundingRadius: number;

  private activeActionName: DinoActionName = 'Idle';
  private activeAction: THREE.AnimationAction | null = null;
  private lastThrottled = false;

  constructor(
    species: DinoSpecies,
    root: THREE.Object3D,
    clips: readonly THREE.AnimationClip[],
    initialAction: DinoActionName = 'Idle',
    phaseOffset = 0,
    timeScale = 1,
  ) {
    this.species = species;
    this.root = root;
    this.boundingRadius = DINO_SPECIES_SPECS[species].boundingRadius;
    this.mixer = new THREE.AnimationMixer(root);

    // Register all 6 actions (Idle, Walk, Run, Attack, Death, Jump) via exact name match
    for (let i = 0; i < DINO_ALL_ACTIONS.length; i++) {
      const name = DINO_ALL_ACTIONS[i];
      const clip = findExactDinoClip(clips, species, name);
      if (!clip) continue;
      const action = this.mixer.clipAction(clip);
      const isLoop = LOOPING_ACTIONS.has(name);
      action.setLoop(isLoop ? THREE.LoopRepeat : THREE.LoopOnce, isLoop ? Infinity : 1);
      action.clampWhenFinished = !isLoop;
      action.timeScale = timeScale;
      this.actions[name] = action;
      this.availableList.push(name);
    }

    const startName = this.actions[initialAction] ? initialAction : 'Idle';
    const startAction = this.actions[startName];
    if (startAction) {
      this.activeActionName = startName;
      this.activeAction = startAction;
      startAction.reset();
      const duration = startAction.getClip().duration;
      if (duration > 0.01 && phaseOffset > 0) {
        startAction.time = phaseOffset % duration;
      }
      startAction.play();
      // Evaluate initial posed frame immediately so distant Title views never show bind pose
      this.mixer.update(0.016);
    }
  }

  public getActiveAction(): DinoActionName {
    return this.activeActionName;
  }

  public getAvailableActions(): DinoActionName[] {
    return [...this.availableList];
  }

  public hasAction(action: DinoActionName): boolean {
    return Boolean(this.actions[action]);
  }

  public isThrottled(): boolean {
    return this.lastThrottled;
  }

  public playAction(action: DinoActionName, fadeSec = 0.15): boolean {
    const next = this.actions[action];
    if (!next) return false;
    if (this.activeAction === next && this.activeActionName === action) {
      if (!next.isRunning()) next.play();
      return true;
    }

    const prev = this.activeAction;
    this.activeActionName = action;
    this.activeAction = next;

    if (prev && prev !== next) {
      next.enabled = true;
      next.reset();
      next.setEffectiveWeight(1);
      next.play();
      prev.crossFadeTo(next, fadeSec, false);
    } else {
      next.reset().fadeIn(fadeSec).play();
    }
    return true;
  }

  /**
   * Advances mixer with zero per-frame allocations; skips distant or off-frustum instances.
   */
  public update(
    dt: number,
    cameraPos: THREE.Vector3,
    dinoPos: THREE.Vector3,
    frustum?: THREE.Frustum,
  ): boolean {
    if (!shouldUpdateDinoMixer(cameraPos, dinoPos, this.boundingRadius, frustum)) {
      this.lastThrottled = true;
      return false;
    }
    this.lastThrottled = false;
    this.mixer.update(dt);
    return true;
  }

  public dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.activeAction = null;
  }
}
