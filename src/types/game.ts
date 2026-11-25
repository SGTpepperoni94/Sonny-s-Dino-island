import type * as THREE from 'three';

export type BiomeId =
  | 'harbor'
  | 'ranch'
  | 'jungle'
  | 'ruins'
  | 'volcano'
  | 'lagoon'
  | 'skullCave'
  | 'ocean';

export type AnchorId =
  | 'harborSpawn'
  | 'ranchCenter'
  | 'jungleTrail'
  | 'ruinsTerrace'
  | 'volcanoSummit'
  | 'lagoonDock'
  | 'skullCaveMouth'
  | 'skullCaveInterior';

export type GamePhase = 'title' | 'playing';

export interface WorldAnchor {
  id: AnchorId;
  biome: BiomeId;
  x: number;
  z: number;
  facingYaw: number;
  label: string;
}

export interface ReservedFootprint {
  id: string;
  x: number;
  z: number;
  radius: number;
}

export interface PerfStats {
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  fps: number;
  isSoftwareGl: boolean;
}

export interface HudSnapshot {
  phase: GamePhase;
  biome: BiomeId;
  muted: boolean;
  isTouch: boolean;
  isWaving: boolean;
  inShallowWater: boolean;
  hasInteractable: boolean;
  interactableIcon: string | null;
  playerX: number;
  playerY: number;
  playerZ: number;
  perf: PerfStats;
}

export interface InputState {
  moveX: number;
  moveZ: number;
  cameraYawDelta: number;
  cameraPitchDelta: number;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  waveJustPressed: boolean;
  clickTargetActive: boolean;
  clickTargetX: number;
  clickTargetZ: number;
  manualOrbitActive: boolean;
}

export interface IInteractable {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  priority: number;
  icon: string;
  canInteract: () => boolean;
  onInteract: () => void;
}

export interface EngineContext {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
  elapsedTime: number;
  getPhase: () => GamePhase;
}

export interface IGameSystem {
  readonly id: string;
  init(ctx: EngineContext): void;
  update(dt: number, elapsedTime: number): void;
  dispose(): void;
}

export interface SelfTestCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface SelfTestReport {
  passed: boolean;
  checks: SelfTestCheck[];
  perf: PerfStats;
}

export type CapturePresetId =
  | 'title'
  | 'harbor'
  | 'jungle'
  | 'ruins'
  | 'volcano'
  | 'lagoon'
  | 'skull-cave';

export interface SonnyIslandDebugApi {
  teleportToBiome: (anchorOrBiome: AnchorId | BiomeId) => boolean;
  setCapturePreset: (name: CapturePresetId | null) => boolean;
  getPerfStats: () => PerfStats;
  runSelfTest: () => SelfTestReport;
  getSnapshot: () => HudSnapshot;
  triggerWave: () => void;
  triggerJump: () => void;
  startGame: () => void;
  resetCycle: () => { before: PerfStats; after: PerfStats };
}

declare global {
  interface Window {
    __SONNY_ISLAND__?: SonnyIslandDebugApi;
  }
}
