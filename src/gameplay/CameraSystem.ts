import * as THREE from 'three';
import type { InputManager } from '../engine/InputManager';
import type { EngineContext, IGameSystem } from '../types/game';
import type { TerrainQuery } from '../world/TerrainQuery';
import { shortestAngleDelta } from './PlayerPhysics';
import type { PlayerSystem } from './PlayerSystem';

const FOLLOW_DISTANCE = 10.8;
const FOLLOW_HEIGHT = 4.2;
const LOOK_AHEAD_HEIGHT = 2.15;
const DEFAULT_PITCH = 0.24;
const MIN_PITCH = 0.12;
const MAX_PITCH = 0.72;

export class CameraSystem implements IGameSystem {
  public readonly id = 'camera';

  private readonly player: PlayerSystem;
  private readonly terrain: TerrainQuery;
  private readonly input: InputManager;

  private camera: THREE.PerspectiveCamera | null = null;
  private getPhase: () => 'title' | 'playing' = () => 'title';

  // Camera orbit angles (yaw is angle behind player; yaw = 0 puts camera at +Z looking -Z)
  private orbitYaw = 0.18;
  private orbitPitch = DEFAULT_PITCH;
  private manualOrbitCooldown = 0;
  private initializedPlayCamera = false;

  // Zero-GC scratch vectors
  private readonly _playerPos = new THREE.Vector3();
  private readonly _desiredPos = new THREE.Vector3();
  private readonly _lookTarget = new THREE.Vector3();
  private readonly _currentLook = new THREE.Vector3();
  private captureOverrideActive = false;
  private readonly _overridePos = new THREE.Vector3();
  private readonly _overrideLook = new THREE.Vector3();

  constructor(player: PlayerSystem, terrain: TerrainQuery, input: InputManager) {
    this.player = player;
    this.terrain = terrain;
    this.input = input;
  }

  public init(ctx: EngineContext): void {
    this.camera = ctx.camera;
    this.getPhase = ctx.getPhase;
    this.initializedPlayCamera = false;
    this.updateTitleCamera(0, true);
  }

  public setCaptureOverride(
    pos: readonly [number, number, number],
    lookAt: readonly [number, number, number],
  ): void {
    this.captureOverrideActive = true;
    this._overridePos.set(pos[0], pos[1], pos[2]);
    this._overrideLook.set(lookAt[0], lookAt[1], lookAt[2]);
    if (this.camera) {
      this.camera.position.copy(this._overridePos);
      this._currentLook.copy(this._overrideLook);
      this.camera.lookAt(this._overrideLook);
    }
  }

  public clearCaptureOverride(): void {
    this.captureOverrideActive = false;
  }

  public snapBehindPlayer(): void {
    if (!this.camera) return;
    this.captureOverrideActive = false;
    this.player.getPosition(this._playerPos);
    // Player facingYaw = PI means facing -Z -> camera sits at +Z -> orbitYaw = 0 (facingYaw - PI)
    this.orbitYaw = this.player.kinematics.yaw + Math.PI;
    this.orbitPitch = DEFAULT_PITCH;
    this.manualOrbitCooldown = 0;
    this.computePlayCameraVectors();
    this.camera.position.copy(this._desiredPos);
    this._currentLook.copy(this._lookTarget);
    this.camera.lookAt(this._currentLook);
    this.player.setCameraYaw(this.orbitYaw);
    this.initializedPlayCamera = true;
  }

  private updateTitleCamera(elapsedTime: number, snap: boolean): void {
    if (!this.camera) return;
    // Live sweeping showcase over expanded ~400m Pirate Harbor framing Bay, Ship_Small, Beach & distant NE Volcano
    const angle = -0.1 + Math.sin(elapsedTime * 0.14) * 0.32;
    const radius = 76;
    const targetX = -3;
    const targetY = 14.0;
    const targetZ = 122;

    this._desiredPos.set(
      targetX + Math.sin(angle) * radius,
      27.5 + Math.sin(elapsedTime * 0.22) * 2.0,
      targetZ + Math.cos(angle) * radius + 12,
    );
    this._lookTarget.set(10, targetY, 56);

    if (snap) {
      this.camera.position.copy(this._desiredPos);
      this._currentLook.copy(this._lookTarget);
    } else {
      this.camera.position.lerp(this._desiredPos, 0.08);
      this._currentLook.lerp(this._lookTarget, 0.08);
    }
    this.camera.lookAt(this._currentLook);
  }

  private computePlayCameraVectors(): void {
    const horizDist = Math.cos(this.orbitPitch) * FOLLOW_DISTANCE;
    const vertOff = Math.sin(this.orbitPitch) * FOLLOW_DISTANCE + FOLLOW_HEIGHT * 0.35;

    let camX = this._playerPos.x + Math.sin(this.orbitYaw) * horizDist;
    let camZ = this._playerPos.z + Math.cos(this.orbitYaw) * horizDist;
    let camY = this._playerPos.y + vertOff;

    // Gentle terrain clearance pull-in so camera never dips inside cliffs or hills
    const groundAtCam = this.terrain.getTerrainHeight(camX, camZ);
    if (camY < groundAtCam + 1.6) {
      camY = groundAtCam + 1.6;
    }
    // Check mid-point clearance inside Skull Rock Cave & hills
    const midX = (this._playerPos.x + camX) * 0.5;
    const midZ = (this._playerPos.z + camZ) * 0.5;
    const midGround = this.terrain.getTerrainHeight(midX, midZ);
    if (midGround > this._playerPos.y + 4.5) {
      camX = THREE.MathUtils.lerp(this._playerPos.x, camX, 0.62);
      camZ = THREE.MathUtils.lerp(this._playerPos.z, camZ, 0.62);
      camY = Math.min(camY, this._playerPos.y + 4.2);
    }

    this._desiredPos.set(camX, camY, camZ);
    this._lookTarget.set(
      this._playerPos.x,
      this._playerPos.y + LOOK_AHEAD_HEIGHT,
      this._playerPos.z,
    );
  }

  public update(dt: number, elapsedTime: number): void {
    if (!this.camera) return;
    if (this.captureOverrideActive) {
      this.camera.position.copy(this._overridePos);
      this.camera.lookAt(this._overrideLook);
      return;
    }

    if (this.getPhase() === 'title') {
      this.initializedPlayCamera = false;
      this.updateTitleCamera(elapsedTime, false);
      return;
    }

    const inputState = this.input.getState();
    if (!this.initializedPlayCamera) {
      this.orbitYaw = this.player.kinematics.yaw + Math.PI;
      this.initializedPlayCamera = true;
    }

    // Optional manual orbit (Right-Drag, Right Stick, Q/R)
    if (Math.abs(inputState.cameraYawDelta) > 1e-5 || Math.abs(inputState.cameraPitchDelta) > 1e-5) {
      this.orbitYaw += inputState.cameraYawDelta;
      this.orbitPitch = THREE.MathUtils.clamp(
        this.orbitPitch + inputState.cameraPitchDelta,
        MIN_PITCH,
        MAX_PITCH,
      );
      this.manualOrbitCooldown = 1.6;
    } else if (inputState.manualOrbitActive) {
      this.manualOrbitCooldown = 1.6;
    } else {
      this.manualOrbitCooldown = Math.max(0, this.manualOrbitCooldown - dt);
    }

    // Effortless Auto-Follow behind Sonny while he runs (no right stick required!)
    if (this.manualOrbitCooldown <= 0 && this.player.kinematics.speed > 1.2) {
      const targetBehindYaw = this.player.kinematics.yaw + Math.PI;
      const diff = shortestAngleDelta(this.orbitYaw, targetBehindYaw);
      // Gentle auto-center only when running mostly sideways/forward (not fighting straight-back runs)
      if (Math.abs(diff) < Math.PI * 0.82) {
        this.orbitYaw += diff * (1 - Math.exp(-2.1 * dt));
      }
      this.orbitPitch += (DEFAULT_PITCH - this.orbitPitch) * (1 - Math.exp(-1.5 * dt));
    }

    this.player.setCameraYaw(this.orbitYaw);
    this.player.getPosition(this._playerPos);
    this.computePlayCameraVectors();

    const posDamp = 1 - Math.exp(-7.5 * dt);
    const lookDamp = 1 - Math.exp(-10.5 * dt);
    this.camera.position.lerp(this._desiredPos, posDamp);
    this._currentLook.lerp(this._lookTarget, lookDamp);
    this.camera.lookAt(this._currentLook);
  }

  public dispose(): void {
    this.camera = null;
  }
}
