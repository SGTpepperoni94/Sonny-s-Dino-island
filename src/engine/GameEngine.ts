import * as THREE from 'three';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import type { CameraSystem } from '../gameplay/CameraSystem';
import type { PlayerSystem } from '../gameplay/PlayerSystem';
import type { AnchorId, BiomeId, CapturePresetId, GamePhase, HudSnapshot, IGameSystem, PerfStats, SelfTestReport } from '../types/game';
import { TerrainQuery } from '../world/TerrainQuery';
import { AssetManager } from './AssetManager';
import { AudioEngine } from './AudioEngine';
import { applyCapturePreset, buildHudSnapshot, createAndInitSystems, exposeSonnyDebugApi, readPerfStats, resolveAnchorId, updateSunShadowFrustum } from './EngineBootstrap';
import { InputManager } from './InputManager';
import { InteractionArbitrator } from './InteractionArbitrator';
import { MaterialLibrary } from './MaterialLibrary';
import { createEngineStage, detectSoftwareWebGL, scheduleAfterDraw } from './RendererFactory';
import { SaveManager } from './SaveManager';
import { executeEngineSelfTest } from './SelfTestRunner';

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly onHudSnapshot: (snap: HudSnapshot) => void;
  private readonly isSoftwareGl: boolean;
  private readonly isTouch: boolean;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly dirLight: THREE.DirectionalLight;
  private readonly envRenderTarget: THREE.WebGLRenderTarget;
  private readonly skyDome: THREE.Mesh;

  public readonly terrain = new TerrainQuery();
  public readonly materials = new MaterialLibrary();
  public readonly assets = new AssetManager();
  public readonly saveManager = new SaveManager();
  public readonly audio: AudioEngine;
  public readonly input = new InputManager();
  public readonly arbitrator = new InteractionArbitrator();

  private systems: IGameSystem[] = [];
  private playerSystem!: PlayerSystem;
  private cameraSystem!: CameraSystem;
  private phase: GamePhase = 'title';
  private elapsedTime = 0;
  private lastFrameMs = 0;
  private hudEmitAccum = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;
  private lastBiome: BiomeId = 'harbor';
  private frameId = 0;
  private disposed = false;
  private readonly _sonnyPos = new THREE.Vector3();

  constructor(container: HTMLElement, onHudSnapshot: (snap: HudSnapshot) => void) {
    this.container = container;
    this.onHudSnapshot = onHudSnapshot;
    this.isSoftwareGl = detectSoftwareWebGL();
    this.isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    this.audio = new AudioEngine(this.saveManager.getState().muted);

    const stage = createEngineStage(container, this.isSoftwareGl, this.isTouch);
    this.renderer = stage.renderer;
    this.scene = stage.scene;
    this.camera = stage.camera;
    this.dirLight = stage.dirLight;
    this.envRenderTarget = stage.envRenderTarget;
    this.skyDome = stage.skyDome;

    this.input.attach(this.renderer.domElement, this.camera, () => this.audio.unlock());
    window.addEventListener('resize', this.onResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);

    this.initSystems();
    if (!this.isSoftwareGl) this.renderer.compile(this.scene, this.camera);

    exposeSonnyDebugApi({
      teleportToBiome: (t) => this.teleportToBiome(t),
      setCapturePreset: (name) => this.setCapturePreset(name),
      getPerfStats: () => this.getPerfStats(),
      runSelfTest: () => this.runSelfTest(),
      getSnapshot: () => this.getSnapshot(),
      triggerWave: () => this.triggerWave(),
      triggerJump: () => this.triggerJump(),
      startGame: () => this.startGame(),
      resetCycle: () => this.resetCycle(),
    });
    document.body.dataset.state = this.phase;
    this.emitHudSnapshot();
    this.lastFrameMs = performance.now();
    this.scheduleNextTick();
  }

  private initSystems(): void {
    const wired = createAndInitSystems(
      { scene: this.scene, camera: this.camera, renderer: this.renderer, isSoftwareGl: this.isSoftwareGl, elapsedTime: this.elapsedTime, getPhase: () => this.phase },
      { terrain: this.terrain, materials: this.materials, assets: this.assets, audio: this.audio, input: this.input, arbitrator: this.arbitrator },
    );
    this.systems = wired.systems;
    this.playerSystem = wired.playerSystem;
    this.cameraSystem = wired.cameraSystem;
    updateSunShadowFrustum(this.dirLight, this.playerSystem, this._sonnyPos);
  }

  public startGame(): void {
    if (this.phase === 'playing') return;
    this.phase = 'playing';
    document.body.dataset.state = this.phase;
    this.input.clearAllHeld();
    this.cameraSystem.snapBehindPlayer();
    this.audio.startIslandMusic();
    this.emitHudSnapshot();
  }

  public toggleMute(): boolean {
    const muted = this.audio.toggleMute();
    this.saveManager.save({ muted });
    this.emitHudSnapshot();
    return muted;
  }

  public triggerWave(): void {
    if (this.phase !== 'playing') return;
    this.playerSystem.triggerWave();
    this.emitHudSnapshot();
  }

  public triggerJump(): void { if (this.phase === 'playing') this.input.triggerJump(); }

  public teleportToBiome(anchorOrBiome: AnchorId | BiomeId): boolean {
    const anchorKey = resolveAnchorId(anchorOrBiome);
    if (!anchorKey) return false;
    const anchor = WORLD_ANCHORS[anchorKey];
    this.playerSystem.teleport(anchor.x, anchor.z, anchor.facingYaw);
    this.saveManager.save({ lastAnchor: anchor.id });
    this.saveManager.markBiomeDiscovered(anchor.biome);
    this.cameraSystem.clearCaptureOverride();
    if (this.phase === 'playing') this.cameraSystem.snapBehindPlayer();
    updateSunShadowFrustum(this.dirLight, this.playerSystem, this._sonnyPos);
    this.emitHudSnapshot();
    return true;
  }

  public setCapturePreset(name: CapturePresetId | null): boolean {
    const ok = applyCapturePreset({ name, phase: this.phase, playerSystem: this.playerSystem, cameraSystem: this.cameraSystem, dirLight: this.dirLight, scratchPos: this._sonnyPos, renderFrame: () => this.renderer.render(this.scene, this.camera) });
    if (ok) this.emitHudSnapshot();
    return ok;
  }

  private tick = (): void => {
    if (this.disposed) return;
    const now = performance.now();
    const rawDt = (now - this.lastFrameMs) / 1000;
    this.lastFrameMs = now;
    const dt = Math.max(0.001, Math.min(0.05, rawDt > 0 ? rawDt : 0.016));
    this.elapsedTime += dt;

    this.fpsAccum += Math.max(0.001, rawDt);
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    this.audio.update(dt);
    this.input.sample(dt);
    for (let i = 0; i < this.systems.length; i++) this.systems[i].update(dt, this.elapsedTime);
    updateSunShadowFrustum(this.dirLight, this.playerSystem, this._sonnyPos);
    this.renderer.render(this.scene, this.camera);

    this.hudEmitAccum += dt;
    const biome = this.terrain.getBiomeAt(this.playerSystem.kinematics.x, this.playerSystem.kinematics.z);
    if (biome !== this.lastBiome) {
      this.lastBiome = biome;
      this.saveManager.markBiomeDiscovered(biome);
      this.hudEmitAccum = 0;
      this.emitHudSnapshot();
    } else if (this.hudEmitAccum >= 0.11) {
      this.hudEmitAccum = 0;
      this.emitHudSnapshot();
    }
    this.scheduleNextTick();
  };

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      scheduleAfterDraw(this.renderer, () => this.disposed, (id) => { this.frameId = id; }, this.tick);
    } else {
      this.frameId = window.requestAnimationFrame(this.tick);
    }
  }

  public getPerfStats(): PerfStats { return readPerfStats(this.renderer, this.currentFps, this.isSoftwareGl); }
  private emitHudSnapshot(): void { this.onHudSnapshot(this.getSnapshot()); }
  private onContextLost = (e: Event): void => { e.preventDefault(); };

  public getSnapshot(): HudSnapshot {
    return buildHudSnapshot({
      phase: this.phase, isTouch: this.isTouch, playerSystem: this.playerSystem,
      terrain: this.terrain, audio: this.audio, arbitrator: this.arbitrator, perf: this.getPerfStats(),
    });
  }

  public resetCycle(): { before: PerfStats; after: PerfStats } {
    this.renderer.render(this.scene, this.camera);
    const before = this.getPerfStats();
    const { x, z, yaw } = this.playerSystem.kinematics;
    for (let i = this.systems.length - 1; i >= 0; i--) this.systems[i].dispose();
    this.initSystems();
    this.playerSystem.teleport(x, z, yaw);
    if (this.phase === 'playing') this.cameraSystem.snapBehindPlayer();
    this.renderer.render(this.scene, this.camera);
    return { before, after: this.getPerfStats() };
  }

  public runSelfTest(): SelfTestReport {
    return executeEngineSelfTest({
      scene: this.scene, terrain: this.terrain,
      renderFrame: () => this.renderer.render(this.scene, this.camera),
      getPerfStats: () => this.getPerfStats(), resetCycle: () => this.resetCycle(),
    });
  }

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose(): void {
    this.disposed = true;
    window.cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.onResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    for (let i = this.systems.length - 1; i >= 0; i--) this.systems[i].dispose();
    this.systems.length = 0;
    this.input.dispose();
    this.audio.dispose();
    this.materials.dispose();
    this.assets.dispose();
    this.skyDome.geometry.dispose();
    (this.skyDome.material as THREE.Material).dispose();
    this.envRenderTarget.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) this.container.removeChild(this.renderer.domElement);
    delete window.__SONNY_ISLAND__;
  }
}
