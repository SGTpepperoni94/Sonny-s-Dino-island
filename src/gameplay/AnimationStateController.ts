import * as THREE from 'three';
import type { PlayerKinematicsState } from './PlayerPhysics';

export type AnimState = 'Idle' | 'Walk' | 'Run' | 'Jump' | 'Jump_Idle' | 'Jump_Land' | 'Wave';

/**
 * Pure verified Quaternius clip matcher: exact match first so 'Idle' never matches 'Jump_Idle'.
 */
export function matchAnimationClipName(clipNames: readonly string[], target: AnimState): number {
  if (clipNames.length === 0) return -1;
  for (let i = 0; i < clipNames.length; i++) {
    if (clipNames[i] === target) return i;
  }
  const targetLower = target.toLowerCase();
  for (let i = 0; i < clipNames.length; i++) {
    if (clipNames[i].toLowerCase() === targetLower) return i;
  }
  for (let i = 0; i < clipNames.length; i++) {
    const lower = clipNames[i].toLowerCase();
    if (targetLower === 'idle' && lower.includes('jump')) continue;
    if (lower.includes(targetLower)) return i;
  }
  return -1;
}

export function selectDesiredAnimState(
  kinematics: Readonly<PlayerKinematicsState>,
  waveTimer: number,
  landAnimTimer: number,
): AnimState {
  if (waveTimer > 0) return 'Wave';
  if (!kinematics.grounded) {
    return kinematics.vy > 1.2 ? 'Jump' : 'Jump_Idle';
  }
  if (landAnimTimer > 0 && kinematics.speed < 1.2) return 'Jump_Land';
  if (kinematics.speed > 5.2) return 'Run';
  if (kinematics.speed > 0.5) return 'Walk';
  return 'Idle';
}

export class AnimationStateController {
  private mixer: THREE.AnimationMixer | null = null;
  private clips: THREE.AnimationClip[] = [];
  private clipNames: string[] = [];
  private activeAnim: AnimState = 'Idle';

  public attachModel(scene: THREE.Object3D, animations: THREE.AnimationClip[]): void {
    this.clips = animations;
    this.clipNames = animations.map((c) => c.name);
    this.mixer = new THREE.AnimationMixer(scene);
    this.activeAnim = 'Idle';
    this.playClip('Idle', true);
  }

  public playClip(name: AnimState, loop: boolean): void {
    if (!this.mixer) return;
    const idx = matchAnimationClipName(this.clipNames, name);
    if (idx < 0) return;
    const clip = this.clips[idx];
    this.activeAnim = name;
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    action.reset().fadeIn(0.12).play();
  }

  public update(
    dt: number,
    elapsedTime: number,
    kinematics: Readonly<PlayerKinematicsState>,
    waveTimer: number,
    landAnimTimer: number,
    fallbackModel: THREE.Group | null,
  ): void {
    const desired = selectDesiredAnimState(kinematics, waveTimer, landAnimTimer);
    if (this.mixer) {
      if (desired !== this.activeAnim) {
        const shouldLoop =
          desired === 'Idle' || desired === 'Walk' || desired === 'Run' || desired === 'Jump_Idle';
        this.playClip(desired, shouldLoop);
      }
      this.mixer.update(dt);
    } else if (fallbackModel) {
      const runBob =
        kinematics.grounded && kinematics.speed > 0.5
          ? Math.abs(Math.sin(elapsedTime * 11)) * 0.14
          : 0;
      const waveWiggle = waveTimer > 0 ? Math.sin(elapsedTime * 16) * 0.18 : 0;
      fallbackModel.position.y = runBob;
      fallbackModel.rotation.z = waveWiggle;
    }
  }

  public dispose(): void {
    if (this.mixer) {
      this.mixer.stopAllAction();
      this.mixer = null;
    }
    this.clips = [];
    this.clipNames = [];
    this.activeAnim = 'Idle';
  }
}
