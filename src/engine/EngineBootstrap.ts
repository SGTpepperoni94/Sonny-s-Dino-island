import * as THREE from 'three';
import { CAPTURE_PRESETS, isCapturePresetId } from '../config/capturePresets';
import { BIOME_DEFAULT_ANCHOR, WORLD_ANCHORS } from '../config/worldAnchors';
import { CameraSystem } from '../gameplay/CameraSystem';
import { ParticlePoolSystem } from '../gameplay/ParticlePoolSystem';
import { PlayerSystem } from '../gameplay/PlayerSystem';
import type {
  AnchorId,
  BiomeId,
  CapturePresetId,
  EngineContext,
  GamePhase,
  HudSnapshot,
  IGameSystem,
  PerfStats,
  SonnyIslandDebugApi,
} from '../types/game';
import { IslandTerrainSystem } from '../world/IslandTerrainSystem';
import { LandmarkSystem } from '../world/LandmarkSystem';
import { OceanSystem } from '../world/OceanSystem';
import { PropScatterSystem } from '../world/PropScatterSystem';
import type { TerrainQuery } from '../world/TerrainQuery';
import type { AssetManager } from './AssetManager';
import type { AudioEngine } from './AudioEngine';
import type { InputManager } from './InputManager';
import type { InteractionArbitrator } from './InteractionArbitrator';
import type { MaterialLibrary } from './MaterialLibrary';

export interface WiredSystems {
  systems: IGameSystem[];
  terrainSystem: IslandTerrainSystem;
  playerSystem: PlayerSystem;
  cameraSystem: CameraSystem;
}

export interface EngineServices {
  terrain: TerrainQuery;
  materials: MaterialLibrary;
  assets: AssetManager;
  audio: AudioEngine;
  input: InputManager;
  arbitrator: InteractionArbitrator;
}

export function createAndInitSystems(ctx: EngineContext, services: EngineServices): WiredSystems {
  const oceanSystem = new OceanSystem();
  const terrainSystem = new IslandTerrainSystem(services.materials);
  const particleSystem = new ParticlePoolSystem();
  const landmarkSystem = new LandmarkSystem(services.materials, particleSystem);
  const propSystem = new PropScatterSystem(services.terrain, services.assets, services.materials);
  const playerSystem = new PlayerSystem(
    services.terrain,
    services.assets,
    services.audio,
    services.input,
    particleSystem,
    services.arbitrator,
  );
  const cameraSystem = new CameraSystem(playerSystem, services.terrain, services.input);

  const systems: IGameSystem[] = [
    oceanSystem,
    terrainSystem,
    particleSystem,
    landmarkSystem,
    propSystem,
    playerSystem,
    cameraSystem,
  ];
  for (let i = 0; i < systems.length; i++) systems[i].init(ctx);
  services.input.setTerrainTarget(terrainSystem.getTerrainMesh());
  return { systems, terrainSystem, playerSystem, cameraSystem };
}

export function resolveAnchorId(anchorOrBiome: AnchorId | BiomeId): AnchorId | undefined {
  if (anchorOrBiome in WORLD_ANCHORS) return anchorOrBiome as AnchorId;
  if (anchorOrBiome !== 'ocean') {
    return BIOME_DEFAULT_ANCHOR[anchorOrBiome as Exclude<BiomeId, 'ocean'>];
  }
  return undefined;
}

export function readPerfStats(
  renderer: THREE.WebGLRenderer,
  fps: number,
  isSoftwareGl: boolean,
): PerfStats {
  const info = renderer.info;
  return {
    calls: info.render.calls,
    triangles: info.render.triangles,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    fps,
    isSoftwareGl,
  };
}

export function updateSunShadowFrustum(
  dirLight: THREE.DirectionalLight,
  playerSystem: PlayerSystem,
  scratchPos: THREE.Vector3,
): void {
  playerSystem.getPosition(scratchPos);
  dirLight.position.set(scratchPos.x - 45, scratchPos.y + 72, scratchPos.z - 35);
  dirLight.target.position.copy(scratchPos);
  dirLight.target.updateMatrixWorld();
}

export function buildHudSnapshot(params: {
  phase: GamePhase;
  isTouch: boolean;
  playerSystem: PlayerSystem;
  terrain: TerrainQuery;
  audio: AudioEngine;
  arbitrator: InteractionArbitrator;
  perf: PerfStats;
}): HudSnapshot {
  const k = params.playerSystem.kinematics;
  const biome = params.terrain.getBiomeAt(k.x, k.z);
  const best = params.arbitrator.selectBest(k.x, k.y, k.z, k.yaw);
  return {
    phase: params.phase,
    biome,
    muted: params.audio.isMuted(),
    isTouch: params.isTouch,
    isWaving: params.playerSystem.isWaving(),
    inShallowWater: k.inShallowWater,
    hasInteractable: Boolean(best),
    interactableIcon: best?.icon ?? null,
    playerX: Math.round(k.x * 10) / 10,
    playerY: Math.round(k.y * 10) / 10,
    playerZ: Math.round(k.z * 10) / 10,
    perf: params.perf,
  };
}

export function applyCapturePreset(params: {
  name: CapturePresetId | null;
  phase: GamePhase;
  playerSystem: PlayerSystem;
  cameraSystem: CameraSystem;
  dirLight: THREE.DirectionalLight;
  scratchPos: THREE.Vector3;
  renderFrame: () => void;
}): boolean {
  if (params.name === null) {
    params.cameraSystem.clearCaptureOverride();
    if (params.phase === 'playing') params.cameraSystem.snapBehindPlayer();
    params.renderFrame();
    return true;
  }
  if (!isCapturePresetId(params.name)) return false;
  const preset = CAPTURE_PRESETS[params.name];
  const anchor = WORLD_ANCHORS[preset.anchor];
  params.playerSystem.teleport(anchor.x, anchor.z, anchor.facingYaw);
  updateSunShadowFrustum(params.dirLight, params.playerSystem, params.scratchPos);
  params.cameraSystem.setCaptureOverride(preset.pos, preset.lookAt);
  params.renderFrame();
  return true;
}

export function exposeSonnyDebugApi(api: SonnyIslandDebugApi): void {
  window.__SONNY_ISLAND__ = api;
}
