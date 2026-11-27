import * as THREE from 'three';
import { ASSET_CATALOG } from '../config/assets';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import type { AssetManager } from '../engine/AssetManager';
import type { AudioEngine } from '../engine/AudioEngine';
import type { InputManager } from '../engine/InputManager';
import type { InteractionArbitrator } from '../engine/InteractionArbitrator';
import type { EngineContext, IGameSystem } from '../types/game';
import type { TerrainQuery } from '../world/TerrainQuery';
import { AnimationStateController } from './AnimationStateController';
import type { ParticlePoolSystem } from './ParticlePoolSystem';
import { PlayerFeedback } from './PlayerFeedback';
import {
  createPlayerKinematics,
  getPlayerSupportHeight,
  stepPlayerKinematics,
  type PlayerKinematicsState,
  type StepEvents,
  type StepInput,
} from './PlayerPhysics';
import { buildProceduralSonnyShell } from './ProceduralSonnyBuilder';

export class PlayerSystem implements IGameSystem {
  public readonly id = 'player';

  private readonly anim = new AnimationStateController();
  private readonly feedback: PlayerFeedback;

  private scene: THREE.Scene | null = null;
  private root: THREE.Group | null = null;
  private modelPivot: THREE.Group | null = null;
  private fallbackModel: THREE.Group | null = null;
  private contactShadow: THREE.Mesh | null = null;
  private clickRing: THREE.Mesh | null = null;

  private waveTimer = 0;
  private landAnimTimer = 0;
  private cameraYawRef = Math.PI;
  private disposed = false;

  private readonly ownedGeometries: THREE.BufferGeometry[] = [];
  private readonly ownedMaterials: THREE.Material[] = [];

  public readonly kinematics: PlayerKinematicsState;
  private readonly _pos = new THREE.Vector3();
  private readonly _stepInput: StepInput = {
    wishX: 0, wishZ: 0, jumpJustPressed: false, jumpHeld: false, dt: 0.016,
  };
  private readonly _stepEvents: StepEvents = { jumped: false, landed: false, splashed: false };

  constructor(
    private readonly terrain: TerrainQuery,
    private readonly assets: AssetManager,
    private readonly audio: AudioEngine,
    private readonly input: InputManager,
    private readonly particles: ParticlePoolSystem,
    private readonly arbitrator: InteractionArbitrator,
  ) {
    this.feedback = new PlayerFeedback(audio, particles);
    const spawn = WORLD_ANCHORS.harborSpawn;
    this.kinematics = createPlayerKinematics(spawn.x, spawn.z, spawn.facingYaw);
  }

  public setCameraYaw(yaw: number): void { this.cameraYawRef = yaw; }
  public isWaving(): boolean { return this.waveTimer > 0; }

  public getPosition(out: THREE.Vector3): THREE.Vector3 {
    return out.set(this.kinematics.x, this.kinematics.y, this.kinematics.z);
  }

  public teleport(x: number, z: number, facingYaw: number): void {
    Object.assign(this.kinematics, createPlayerKinematics(x, z, facingYaw));
    this.waveTimer = 0;
    this.landAnimTimer = 0;
    this.feedback.reset();
    this.input.clearClickTarget();
    this.syncVisualTransform();
  }

  public triggerWave(): void {
    const winner = this.arbitrator.triggerBest(
      this.kinematics.x,
      this.kinematics.y,
      this.kinematics.z,
      this.kinematics.yaw,
    );
    if (winner) return;

    this.waveTimer = 1.35;
    this.audio.playWaveChime();
    this.particles.spawn('waveSparkle', this.kinematics.x, this.kinematics.y, this.kinematics.z, 8);
    this.anim.playClip('Wave', false);
  }

  public init(ctx: EngineContext): void {
    this.disposed = false;
    this.scene = ctx.scene;

    const root = new THREE.Group();
    root.name = 'SonnyPlayer';
    const pivot = new THREE.Group();
    root.add(pivot);
    this.root = root;
    this.modelPivot = pivot;

    const shell = buildProceduralSonnyShell();
    this.ownedGeometries.push(...shell.ownedGeometries);
    this.ownedMaterials.push(...shell.ownedMaterials);
    this.fallbackModel = shell.fallbackModel;
    this.contactShadow = shell.contactShadow;
    this.clickRing = shell.clickRing;

    pivot.add(shell.fallbackModel);
    ctx.scene.add(shell.contactShadow, shell.clickRing, root);
    this.syncVisualTransform();

    void this.loadQuaterniusHenry();
  }

  private async loadQuaterniusHenry(): Promise<void> {
    try {
      const { scene, animations } = await this.assets.loadInstance('character.sonny');
      if (this.disposed || !this.modelPivot) return;
      const entry = ASSET_CATALOG['character.sonny'];
      scene.scale.setScalar(entry.scale);
      scene.position.set(0, entry.yOffset, 0);

      if (this.fallbackModel) {
        this.modelPivot.remove(this.fallbackModel);
        this.fallbackModel = null;
      }

      this.modelPivot.add(scene);
      this.anim.attachModel(scene, animations);
    } catch {
      // Keeps charming procedural Sonny gracefully if CDN unavailable
    }
  }

  public update(dt: number, elapsedTime: number): void {
    const playing = document.body.dataset.state === 'playing';
    const inputState = this.input.getState();

    let wishX = 0;
    let wishZ = 0;

    if (playing) {
      if (inputState.waveJustPressed) this.triggerWave();

      const stickMag = Math.hypot(inputState.moveX, inputState.moveZ);
      if (stickMag > 0.02) {
        const sinY = Math.sin(this.cameraYawRef);
        const cosY = Math.cos(this.cameraYawRef);
        wishX = inputState.moveX * cosY - inputState.moveZ * sinY;
        wishZ = -inputState.moveX * sinY - inputState.moveZ * cosY;
      } else if (inputState.clickTargetActive) {
        const dx = inputState.clickTargetX - this.kinematics.x;
        const dz = inputState.clickTargetZ - this.kinematics.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.85) {
          this.input.clearClickTarget();
        } else {
          const factor = Math.min(1, dist / 2.2);
          wishX = (dx / dist) * factor;
          wishZ = (dz / dist) * factor;
        }
      }

      this._stepInput.wishX = wishX;
      this._stepInput.wishZ = wishZ;
      this._stepInput.jumpJustPressed = inputState.jumpJustPressed;
      this._stepInput.jumpHeld = inputState.jumpHeld;
      this._stepInput.dt = dt;
      const events = stepPlayerKinematics(this.kinematics, this._stepInput, this._stepEvents);
      const fb = this.feedback.update(dt, this.kinematics, events);
      if (fb.cancelWave) this.waveTimer = 0;
      if (fb.triggerLandAnim) this.landAnimTimer = 0.2;

      if (this.waveTimer > 0) {
        this.waveTimer = Math.max(0, this.waveTimer - dt);
        if (this.kinematics.speed > 1.2) this.waveTimer = 0;
      }
      if (this.landAnimTimer > 0) {
        this.landAnimTimer = Math.max(0, this.landAnimTimer - dt);
      }

      if (this.clickRing) {
        this.clickRing.visible = inputState.clickTargetActive;
        if (inputState.clickTargetActive) {
          const ry = getPlayerSupportHeight(inputState.clickTargetX, inputState.clickTargetZ);
          this.clickRing.position.set(inputState.clickTargetX, Math.max(0.08, ry + 0.08), inputState.clickTargetZ);
          this.clickRing.scale.setScalar(0.92 + Math.sin(elapsedTime * 6.5) * 0.14);
        }
      }
    } else if (this.clickRing) {
      this.clickRing.visible = false;
    }

    this.anim.update(dt, elapsedTime, this.kinematics, this.waveTimer, this.landAnimTimer, this.fallbackModel);
    this.syncVisualTransform();
  }

  private syncVisualTransform(): void {
    if (this.root && this.modelPivot) {
      this.root.position.set(this.kinematics.x, this.kinematics.y, this.kinematics.z);
      this.root.rotation.y = this.kinematics.yaw;
      this.modelPivot.scale.set(this.kinematics.squashX, this.kinematics.squashY, this.kinematics.squashX);
    }
    if (this.contactShadow) {
      const groundY = getPlayerSupportHeight(this.kinematics.x, this.kinematics.z);
      const lift = Math.max(0, this.kinematics.y - groundY);
      this.contactShadow.position.set(this.kinematics.x, Math.max(0.04, groundY + 0.04), this.kinematics.z);
      this.contactShadow.scale.setScalar(Math.max(0.45, 1 - lift * 0.12));
    }
  }

  public getWorldPositionScratch(): THREE.Vector3 {
    return this._pos.set(this.kinematics.x, this.kinematics.y, this.kinematics.z);
  }

  public dispose(): void {
    this.disposed = true;
    this.anim.dispose();
    if (this.root) { this.scene?.remove(this.root); this.root = null; }
    if (this.contactShadow) { this.scene?.remove(this.contactShadow); this.contactShadow = null; }
    if (this.clickRing) { this.scene?.remove(this.clickRing); this.clickRing = null; }
    for (const g of this.ownedGeometries) g.dispose();
    for (const m of this.ownedMaterials) m.dispose();
    this.ownedGeometries.length = 0;
    this.ownedMaterials.length = 0;
    this.fallbackModel = null;
    this.modelPivot = null;
    this.scene = null;
  }
}
