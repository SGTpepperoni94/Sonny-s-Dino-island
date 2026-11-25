import * as THREE from 'three';
import { PALETTE } from '../config/palette';

export class MaterialLibrary {
  private readonly materials = new Map<string, THREE.Material>();

  public getStandard(
    key: string,
    params: THREE.MeshStandardMaterialParameters,
  ): THREE.MeshStandardMaterial {
    const existing = this.materials.get(key);
    if (existing instanceof THREE.MeshStandardMaterial) {
      return existing;
    }
    const mat = new THREE.MeshStandardMaterial({
      flatShading: true,
      roughness: 0.85,
      metalness: 0.04,
      ...params,
    });
    this.materials.set(key, mat);
    return mat;
  }

  public register<T extends THREE.Material>(key: string, mat: T): T {
    const existing = this.materials.get(key);
    if (existing && existing !== mat) {
      existing.dispose();
    }
    this.materials.set(key, mat);
    return mat;
  }

  public setTerrainSplatMap(texture: THREE.Texture | null): THREE.MeshStandardMaterial {
    const mat = this.getTerrainMaterial();
    if (mat.map !== texture) {
      mat.map = texture;
      mat.needsUpdate = true;
    }
    return mat;
  }

  private getTerrainMaterial(): THREE.MeshStandardMaterial {
    const existing = this.materials.get('terrain');
    if (existing instanceof THREE.MeshStandardMaterial) {
      return existing;
    }
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      flatShading: true,
      roughness: 0.88,
      metalness: 0.02,
    });
    // World-space micro-detail noise + pixel-sharp Voronoi Ruins flagstones + alpha lava glow
    mat.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;
          varying float vTerrainNormalY;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTerrainWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          vTerrainNormalY = normalize(mat3(modelMatrix) * objectNormal).y;`,
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vTerrainWorldPos;
          varying float vTerrainNormalY;
          vec2 tHash22(vec2 p) {
            vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
            p3 += dot(p3, p3.yzx + 33.33);
            return fract((p3.xx + p3.yz) * p3.zy);
          }
          float tValueNoise(vec2 p) {
            vec2 i = floor(p);
            vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            float a = tHash22(i).x;
            float b = tHash22(i + vec2(1.0, 0.0)).x;
            float c = tHash22(i + vec2(0.0, 1.0)).x;
            float d = tHash22(i + vec2(1.0, 1.0)).x;
            return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
          }`,
        )
        .replace(
          '#include <map_fragment>',
          `#ifdef USE_MAP
            vec2 tWp = vTerrainWorldPos.xz;
            float tDetailFade = 1.0 - smoothstep(32.0, 130.0, length(vViewPosition));
            vec2 tSampleUv = vMapUv;
            float tMicro = 0.0;
            if (tDetailFade > 0.01) {
              float tN1 = tValueNoise(tWp * 0.62);
              float tN2 = tValueNoise(tWp * 2.15);
              tMicro = (tN1 * 0.56 + tN2 * 0.44) - 0.5;
              float tFlatWarp = smoothstep(0.68, 0.88, vTerrainNormalY) * tDetailFade;
              vec2 tWarpA = vec2(tN1 - 0.5, tValueNoise(tWp * 0.62 + 17.3) - 0.5);
              vec2 tWarpB = vec2(tN2 - 0.5, tValueNoise(tWp * 2.15 - 11.7) - 0.5);
              vec2 tJit = (tWarpA * 0.0022 + tWarpB * 0.00095) * tFlatWarp;
              tSampleUv = clamp(vMapUv + tJit, vec2(0.001), vec2(0.999));
            }
            vec4 sampledDiffuseColor = texture2D( map, tSampleUv );
            diffuseColor *= sampledDiffuseColor;
            if (tDetailFade > 0.01) {
              float tGrain = mix(0.11, 0.145, 1.0 - clamp(vTerrainNormalY, 0.0, 1.0));
              diffuseColor.rgb *= (1.0 + tMicro * tGrain * tDetailFade);

              vec2 tRd = (tWp - vec2(-94.0, -88.0)) / vec2(58.0, 50.0);
              float tRuinsZone = (1.0 - smoothstep(0.68, 1.08, length(tRd))) * smoothstep(0.84, 0.90, vTerrainNormalY);
              if (tRuinsZone > 0.01) {
                vec2 tSp = tWp * 0.72 + vec2(sin(tWp.y * 0.78), cos(tWp.x * 0.74)) * 0.14;
                vec2 tIp = floor(tSp);
                float tD1 = 9.0, tD2 = 9.0;
                vec2 tBestId = tIp, tBestH = vec2(0.0);
                for (int dz = -1; dz <= 1; dz++) {
                  for (int dx = -1; dx <= 1; dx++) {
                    vec2 c = tIp + vec2(float(dx), float(dz));
                    vec2 h = tHash22(c);
                    float dist = length(c + 0.15 + h * 0.70 - tSp);
                    if (dist < tD1) { tD2 = tD1; tD1 = dist; tBestId = c; tBestH = h; }
                    else if (dist < tD2) { tD2 = dist; }
                  }
                }
                vec2 tWc = (tBestId + 0.5) / 0.72;
                float tCl = 0.5 + 0.5 * sin(tWc.x * 0.19 + 0.45 + cos(tWc.y * 0.17 - 0.3) * 1.45)
                  * cos(tWc.y * 0.18 - 0.35 - sin(tWc.x * 0.16) * 1.35);
                float tHasSlab = step(mix(0.90, 0.10, smoothstep(0.22, 0.68, tCl)), fract(tBestH.x * 3.7 + tBestH.y * 5.3));
                float tDirtMask = smoothstep(0.20, 0.48, diffuseColor.r - diffuseColor.g * 1.06 - diffuseColor.b * 0.54);
                if (tHasSlab > 0.5 && tDirtMask < 0.94) {
                  float tChip = (tValueNoise(tWp * 3.4) - 0.5) * 0.055;
                  float tEdge = (tD2 - tD1) + tChip;
                  float tAa = max(0.014, fwidth(tD2 - tD1) * 1.35);
                  float tSlab = smoothstep(0.062 - tAa, 0.095 + tAa, tEdge);
                  float tBevel = smoothstep(0.055, 0.105, tEdge) - smoothstep(0.105, 0.21, tEdge);
                  vec3 tStone = mix(vec3(0.24, 0.215, 0.18), vec3(0.41, 0.365, 0.285), tBestH.x);
                  tStone = mix(tStone, vec3(0.51, 0.39, 0.22), tBestH.y * 0.62);
                  tStone *= (1.0 - tBevel * 0.22) * (1.0 + tMicro * 0.16);
                  vec3 tCrevice = mix(vec3(0.07, 0.20, 0.016), vec3(0.22, 0.13, 0.03), clamp(tDirtMask * 0.8 + tBestH.y * 0.35, 0.0, 1.0));
                  float tGroove = smoothstep(0.00, 0.075, tEdge);
                  vec3 tUnder = mix(diffuseColor.rgb * 0.82, tCrevice, tGroove * 0.72);
                  diffuseColor.rgb = mix(diffuseColor.rgb, mix(tUnder, tStone, tSlab), tRuinsZone * tDetailFade * (1.0 - tDirtMask * 0.80));
                }
              }
            }
            // Broad sweeping tropical cloud shadows + dappled canopy sunlight pools
            float tLavaShield = smoothstep(0.65, 0.96, sampledDiffuseColor.a);
            float tCloud = smoothstep(0.30, 0.70, tValueNoise(tWp * 0.018 + vec2(4.2, -2.7)) * 0.64 + tValueNoise(tWp * 0.038 + vec2(-6.1, 8.3)) * 0.36);
            vec3 tCloudTint = mix(vec3(0.76, 0.85, 0.99), vec3(1.09, 1.05, 0.95), tCloud);
            float tDapple = smoothstep(0.30, 0.70, tValueNoise(tWp * 0.088 + vec2(11.4, -3.8)) * 0.60 + tValueNoise(tWp * 0.195 + vec2(-7.2, 5.9)) * 0.40);
            float tCanopyMask = smoothstep(1.9, 4.4, vTerrainWorldPos.y)
              * smoothstep(46.0, 90.0, length(tWp - vec2(96.0, -94.0)))
              * smoothstep(0.60, 0.86, vTerrainNormalY);
            vec3 tDappleTint = mix(vec3(1.0), mix(vec3(0.76, 0.86, 0.97), vec3(1.08, 1.045, 0.95), tDapple), tCanopyMask * 0.84);
            diffuseColor.rgb *= mix(vec3(1.0), tCloudTint * tDappleTint, tLavaShield);
          #endif`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          #ifdef USE_MAP
            float terrainLavaGlow = clamp(1.0 - diffuseColor.a, 0.0, 1.0);
            diffuseColor.a = 1.0;
            float heatRim = smoothstep(0.08, 0.86, terrainLavaGlow);
            float heatCore = pow(terrainLavaGlow, 2.35);
            vec3 lavaBounce = mix(vec3(1.08, 0.15, 0.01), vec3(1.68, 0.48, 0.04), heatCore);
            totalEmissiveRadiance += lavaBounce * (heatRim * 0.72 + heatCore * 0.48);
          #endif`,
        );
    };
    mat.customProgramCacheKey = () => 'terrain-splat-detail-v8';
    this.materials.set('terrain', mat);
    return mat;
  }

  public getPalettePresets() {
    return {
      terrain: this.getTerrainMaterial(),
      skullBone: this.getStandard('skullBone', { color: PALETTE.skullBone, roughness: 0.86, metalness: 0.04 }),
      skullBoneDark: this.getStandard('skullBoneDark', { color: PALETTE.skullBoneDark, roughness: 0.9, metalness: 0.03 }),
      bandanaRed: this.getStandard('bandanaRed', { color: PALETTE.bandanaRed, roughness: 0.72, metalness: 0.04 }),
      eyepatchDark: this.getStandard('eyepatchDark', { color: PALETTE.eyepatchDark, roughness: 0.58, metalness: 0.14 }),
      cliffStone: this.getStandard('cliffStone', { color: PALETTE.cliffStone, roughness: 0.9, metalness: 0.04 }),
      cobbleWarm: this.getStandard('cobbleWarm', { color: PALETTE.cobbleWarm, roughness: 0.86, metalness: 0.03 }),
      caveInterior: this.getStandard('caveInterior', { color: PALETTE.caveInterior, roughness: 0.95, metalness: 0.02 }),
      torchGlow: this.getStandard('torchGlow', {
        color: PALETTE.torchFlame,
        emissive: new THREE.Color(0xff8c1a),
        emissiveIntensity: 2.2,
        roughness: 0.35,
        metalness: 0.0,
      }),
      cloudWhite: this.getStandard('cloudWhite', { color: PALETTE.cloudWhite, roughness: 0.92, metalness: 0.0 }),
      palmTrunk: this.getStandard('palmTrunk', { color: PALETTE.palmTrunk, roughness: 0.88, metalness: 0.02 }),
      palmTrunkAo: this.getStandard('palmTrunkAo', { color: PALETTE.palmTrunk, vertexColors: true, roughness: 0.88, metalness: 0.02 }),
      palmLeaf: this.getStandard('palmLeaf', { color: PALETTE.palmLeaf, roughness: 0.74, metalness: 0.02 }),
      palmLeafAo: this.getStandard('palmLeafAo', { color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.74, metalness: 0.02 }),
      woodDock: this.getStandard('woodDock', { color: PALETTE.woodDock, roughness: 0.82, metalness: 0.05 }),
      grassTuft: this.getStandard('grassTuft', { color: 0xffffff, roughness: 0.78, metalness: 0.02 }),
      grassTuftAo: this.getStandard('grassTuftAo', { color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0.02 }),
      grassTuftAoDouble: this.getStandard('grassTuftAoDouble', { color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, roughness: 0.76, metalness: 0.02 }),
      rockInstanced: this.getStandard('rockInstanced', { color: 0xffffff, roughness: 0.88, metalness: 0.04 }),
      rockInstancedAo: this.getStandard('rockInstancedAo', { color: 0xffffff, vertexColors: true, roughness: 0.88, metalness: 0.04 }),
      volcanoBasaltAo: this.getStandard('volcanoBasaltAo', { color: 0xffffff, vertexColors: true, roughness: 0.9, metalness: 0.06 }),
    };
  }

  public dispose(): void {
    for (const mat of this.materials.values()) {
      mat.dispose();
    }
    this.materials.clear();
  }
}
