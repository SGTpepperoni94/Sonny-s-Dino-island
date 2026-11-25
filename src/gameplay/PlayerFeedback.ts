import type { AudioEngine } from '../engine/AudioEngine';
import type { ParticlePoolSystem } from './ParticlePoolSystem';
import type { PlayerKinematicsState, StepEvents } from './PlayerPhysics';

export interface FeedbackStepResult {
  cancelWave: boolean;
  triggerLandAnim: boolean;
}

/**
 * Handles distance-synced footsteps, shallow-water splashes, and jump/landing SFX & particles
 * with zero per-frame object allocations.
 */
export class PlayerFeedback {
  private readonly audio: AudioEngine;
  private readonly particles: ParticlePoolSystem;
  private stepDistAccum = 0;
  private splashCooldown = 0;
  private readonly _result: FeedbackStepResult = {
    cancelWave: false,
    triggerLandAnim: false,
  };

  constructor(audio: AudioEngine, particles: ParticlePoolSystem) {
    this.audio = audio;
    this.particles = particles;
  }

  public update(
    dt: number,
    k: Readonly<PlayerKinematicsState>,
    events: Readonly<StepEvents>,
  ): Readonly<FeedbackStepResult> {
    this._result.cancelWave = false;
    this._result.triggerLandAnim = false;

    if (events.jumped) {
      this._result.cancelWave = true;
      this.audio.playJump();
      this.particles.spawn(k.inShallowWater ? 'waterSplash' : 'footstepDust', k.x, k.y, k.z, 5);
    }

    if (events.landed) {
      this._result.triggerLandAnim = true;
      if (k.inShallowWater) {
        this.audio.playSplash();
        this.particles.spawn('waterSplash', k.x, 0.05, k.z, 8);
      } else {
        this.audio.playFootstep(false);
        this.particles.spawn('footstepDust', k.x, k.y, k.z, 4);
      }
    } else if (events.splashed) {
      this.audio.playSplash();
      this.particles.spawn('waterSplash', k.x, 0.05, k.z, 6);
    }

    if (k.grounded && k.speed > 1.0) {
      this.stepDistAccum += k.speed * dt;
      if (this.stepDistAccum >= 2.2) {
        this.stepDistAccum = 0;
        this.audio.playFootstep(k.inShallowWater);
        this.particles.spawn(
          k.inShallowWater ? 'waterSplash' : 'footstepDust',
          k.x,
          k.inShallowWater ? 0.05 : k.y,
          k.z,
          k.inShallowWater ? 4 : 2,
        );
      }
    }

    this.splashCooldown = Math.max(0, this.splashCooldown - dt);
    if (k.inShallowWater && k.speed > 0.6 && this.splashCooldown <= 0) {
      this.splashCooldown = 0.22;
      this.particles.spawn('waterSplash', k.x, 0.05, k.z, 2);
    }

    return this._result;
  }

  public reset(): void {
    this.stepDistAccum = 0;
    this.splashCooldown = 0;
  }
}
