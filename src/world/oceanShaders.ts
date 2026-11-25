import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import { WATER_LEVEL } from '../config/worldAnchors';
import { computeTerrainHeight } from './terrainMath';
import { TERRAIN_SIZE } from './terrainSplatBaker';

export const COAST_MAP_RES = 256;
export const OCEAN_SEGMENTS = 140;
export const NEAR_U = 0.84;
export const NEAR_EXTENT = 224;
export const FAR_EXTENT = 1150;

/**
 * Pure CPU mirror of the GPU vertex-shader ocean wave equation.
 * Max amplitude = 0.16 + 0.14 + 0.09 = 0.39m (strictly within +-0.40m).
 */
export function getOceanWaveHeight(x: number, z: number, time: number): number {
  return (
    WATER_LEVEL +
    Math.sin(x * 0.065 + time * 1.65) * 0.16 +
    Math.cos(z * 0.055 + time * 1.35) * 0.14 +
    Math.sin(x * 0.28 - z * 0.24 + time * 2.15) * 0.09
  );
}

/**
 * Maps normalized grid coord u in [-1, 1] to world meters: dense ~3.8m nearshore
 * facets inside +-224m (island & coves), smoothly expanding out to +-1150m horizon.
 */
export function mapOceanGridCoord(u: number): number {
  const s = u < 0 ? -1 : 1;
  const a = Math.abs(u);
  if (a <= NEAR_U) return s * (a / NEAR_U) * NEAR_EXTENT;
  const t = (a - NEAR_U) / (1 - NEAR_U);
  return s * (NEAR_EXTENT + (FAR_EXTENT - NEAR_EXTENT) * (0.28 * t + 0.72 * t * t * t));
}

export function bakeCoastMap(): THREE.DataTexture {
  const res = COAST_MAP_RES;
  const heights = new Float32Array(res * res);
  const half = TERRAIN_SIZE * 0.5;
  const step = TERRAIN_SIZE / (res - 1);

  for (let gz = 0; gz < res; gz++) {
    const wz = -half + gz * step;
    for (let gx = 0; gx < res; gx++) {
      heights[gz * res + gx] = computeTerrainHeight(-half + gx * step, wz);
    }
  }

  const data = new Uint8Array(res * res * 4);
  const twoStep = step * 2;
  for (let gz = 0; gz < res; gz++) {
    const z0 = Math.max(0, gz - 1);
    const z1 = Math.min(res - 1, gz + 1);
    for (let gx = 0; gx < res; gx++) {
      const x0 = Math.max(0, gx - 1);
      const x1 = Math.min(res - 1, gx + 1);
      const idx = gz * res + gx;
      const h = heights[idx];
      const dhx = heights[gz * res + x1] - heights[gz * res + x0];
      const dhz = heights[z1 * res + gx] - heights[z0 * res + gx];
      const ny = twoStep / (Math.hypot(dhx, twoStep, dhz) || 1);
      data[idx * 4] = Math.round(THREE.MathUtils.clamp((h + 3.0) / 6.0, 0, 1) * 255);
      data[idx * 4 + 1] = Math.round(THREE.MathUtils.clamp((1 - ny) * 2.4, 0, 1) * 255);
      data[idx * 4 + 2] = 0;
      data[idx * 4 + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(data, res, res, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function createOceanSurfaceMaterial(
  uTime: { value: number },
  coastTex: THREE.DataTexture,
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 0.42,
    metalness: 0.04,
    envMapIntensity: 0.16,
    transparent: true,
    opacity: 0.96,
  });

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uTime;
    shader.uniforms.uCoastMap = { value: coastTex };
    shader.uniforms.uTerrainSize = { value: TERRAIN_SIZE };

    shader.vertexShader =
      'uniform float uTime;\nattribute float aDepth;\nvarying vec3 vOceanWorldPos;\nvarying float vOceanDepth;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float shoreCalm = mix(0.22, 1.0, smoothstep(0.0, 1.6, aDepth));
      float waveY = sin(transformed.x * 0.065 + uTime * 1.65) * 0.16
                  + cos(transformed.z * 0.055 + uTime * 1.35) * 0.14
                  + sin(transformed.x * 0.28 - transformed.z * 0.24 + uTime * 2.15) * 0.09;
      transformed.y += waveY * shoreCalm;
      vOceanDepth = aDepth;
      vOceanWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    );

    shader.fragmentShader =
      'uniform float uTime;\nuniform sampler2D uCoastMap;\nuniform float uTerrainSize;\nvarying vec3 vOceanWorldPos;\nvarying float vOceanDepth;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      vec2 cUv = vOceanWorldPos.xz / uTerrainSize + 0.5;
      float inC = step(0.002, cUv.x) * step(cUv.x, 0.998) * step(0.002, cUv.y) * step(cUv.y, 0.998);
      float cH = mix(-4.0, texture2D(uCoastMap, clamp(cUv, 0.0, 1.0)).r * 6.0 - 3.0, inC);
      float cDepth = max(0.0, -cH);
      vec3 fN = normalize(cross(dFdx(vOceanWorldPos), dFdy(vOceanWorldPos)));
      if (fN.y < 0.0) fN = -fN;
      vec3 sunD = normalize(vec3(0.45, 0.76, 0.46));
      diffuseColor.rgb *= 0.66 + clamp(dot(fN, sunD), 0.0, 1.0) * 0.42;
      float caustMask = (1.0 - smoothstep(0.18, 2.4, cDepth)) * smoothstep(0.02, 0.18, cDepth);
      float c1 = sin(vOceanWorldPos.x * 0.95 + uTime * 1.3 + sin(vOceanWorldPos.z * 0.72 - uTime * 0.9));
      float c2 = cos(vOceanWorldPos.z * 1.02 - uTime * 1.15 + cos(vOceanWorldPos.x * 0.8 + uTime * 0.8));
      float caust = pow(clamp(1.0 - abs(c1 + c2) * 0.52, 0.0, 1.0), 3.2) * caustMask;
      diffuseColor.rgb += vec3(0.24, 0.44, 0.30) * caust;
      diffuseColor.a = mix(0.32, 0.96, smoothstep(0.0, 0.85, cDepth));`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      vec3 gN = normalize(cross(dFdx(vOceanWorldPos), dFdy(vOceanWorldPos)));
      if (gN.y < 0.0) gN = -gN;
      vec3 gV = normalize(cameraPosition - vOceanWorldPos);
      vec3 gL = normalize(vec3(0.45, 0.76, 0.46));
      float glint = pow(max(0.0, dot(reflect(-gL, gN), gV)), 44.0);
      totalEmissiveRadiance += vec3(0.88, 0.98, 1.0) * glint * 0.85;`,
    );
  };

  return mat;
}

export function createShorelineFoamMaterial(
  uTime: { value: number },
  coastTex: THREE.DataTexture,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime,
      uColor: { value: new THREE.Color(PALETTE.foamWhite) },
      uFogColor: { value: new THREE.Color(PALETTE.fogColor) },
      uFogDensity: { value: PALETTE.fogDensity },
      uCoastMap: { value: coastTex },
      uTerrainSize: { value: TERRAIN_SIZE },
    },
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    vertexShader: `
      attribute float aTerrainH;
      uniform float uTime;
      varying vec3 vWorldPos;
      void main() {
        vec3 p = position;
        float d = max(0.0, -aTerrainH);
        float shoreCalm = mix(0.22, 1.0, smoothstep(0.0, 1.6, d));
        float waveY = sin(p.x * 0.065 + uTime * 1.65) * 0.16
                    + cos(p.z * 0.055 + uTime * 1.35) * 0.14
                    + sin(p.x * 0.28 - p.z * 0.24 + uTime * 2.15) * 0.09;
        // Keep foam anchored cleanly to the waterline plane (never climbing steep cliff walls)
        p.y = waveY * shoreCalm + 0.045 + clamp(aTerrainH, 0.0, 0.24) * 0.35;
        vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uColor;
      uniform vec3 uFogColor;
      uniform float uFogDensity;
      uniform sampler2D uCoastMap;
      uniform float uTerrainSize;
      varying vec3 vWorldPos;
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
                   mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      void main() {
        vec2 uv = vWorldPos.xz / uTerrainSize + 0.5;
        if (uv.x < 0.002 || uv.x > 0.998 || uv.y < 0.002 || uv.y > 0.998) discard;
        vec4 coast = texture2D(uCoastMap, uv);
        float h = coast.r * 6.0 - 3.0;
        float steep = coast.g;
        // Strict vertical waterline ceiling so foam never crawls up steep cave/cliff walls
        float topCut = 1.0 - smoothstep(0.14, 0.28, h);
        if (topCut < 0.02 || h < -1.15) discard;

        vec2 p = vWorldPos.xz;
        float wob = (vNoise(p * 0.26) - 0.5) * 0.14 + (vNoise(p * 0.72) - 0.5) * 0.06;
        float phase = uTime * 1.45 + p.x * 0.08 + p.y * 0.065 + wob * 3.2;
        float surge1 = sin(phase) * 0.055;
        float surge2 = sin(phase - 1.4) * 0.085;
        float he = h + wob;

        // Crest 1: crisp fine bright-white surf edge hugging the beach curve
        float w1 = 0.085 + steep * 0.065;
        float c1 = 1.0 - smoothstep(w1 * 0.42, w1, abs(he - (0.02 + surge1)));

        // Crest 2: lacy bubbly trailing surf line slightly seaward
        float c2Band = (1.0 - smoothstep(0.05, 0.24, abs(he - (-0.25 + surge2)))) * smoothstep(-0.66, -0.32, he);
        float laceA = abs(sin(p.x * 1.45 + p.y * 1.05 + vNoise(p * 0.85) * 3.4 - uTime * 0.8));
        float laceB = abs(cos(p.x * 1.12 - p.y * 1.52 + vNoise(p * 1.25 + 9.0) * 3.0 + uTime * 0.65));
        float web = smoothstep(0.28, 0.58, max(1.0 - laceA, 1.0 - laceB));
        float rockSurf = steep * (1.0 - smoothstep(0.14, 0.42, abs(he + 0.14))) * (0.4 + 0.6 * web);

        float foam = max(c1, max(c2Band * web * 0.94, rockSurf * 0.86)) * topCut;
        float alpha = smoothstep(0.34, 0.58, foam) * 0.95;
        if (alpha < 0.06) discard;
        float dCam = length(cameraPosition - vWorldPos);
        float fogF = clamp(1.0 - exp(-(uFogDensity * uFogDensity) * dCam * dCam), 0.0, 1.0);
        gl_FragColor = vec4(mix(uColor, uFogColor, fogF), alpha);
      }
    `,
  });
}
