import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PALETTE } from '../config/palette';

export interface EngineStage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  dirLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  envRenderTarget: THREE.WebGLRenderTarget;
  skyDome: THREE.Mesh;
}

function createSkyDome(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(1, 28, 18);
  const sunDir = new THREE.Vector3(-42, 26, -48).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
    uniforms: {
      uZenithColor: { value: new THREE.Color(PALETTE.skyZenith) },
      uMidColor: { value: new THREE.Color(PALETTE.skyMid) },
      uHorizonColor: { value: new THREE.Color(PALETTE.skyHorizon) },
      uSunGlowColor: { value: new THREE.Color(PALETTE.skySunGlow) },
      uSunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec3 vSkyDir;
      void main() {
        vec3 dir = normalize(position);
        vSkyDir = dir;
        vec4 clip = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(dir, 1.0);
        gl_Position = vec4(clip.xy, clip.w * 0.9999, clip.w);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenithColor;
      uniform vec3 uMidColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uSunGlowColor;
      uniform vec3 uSunDir;
      varying vec3 vSkyDir;
      void main() {
        vec3 dir = normalize(vSkyDir);
        float h = clamp(dir.y, 0.0, 1.0);
        vec3 skyCol = mix(uMidColor, uZenithColor, smoothstep(0.05, 0.42, h));
        float horizonBand = pow(1.0 - h, 7.2);
        float lowMist = pow(1.0 - h, 18.0) * 0.22;
        skyCol = mix(skyCol, uHorizonColor, clamp(horizonBand + lowMist, 0.0, 1.0));
        float sunAmt = max(dot(dir, uSunDir), 0.0);
        float aboveHorizon = smoothstep(0.015, 0.14, dir.y);
        float broadGlow = pow(sunAmt, 3.2) * 0.22 * aboveHorizon;
        float coreHalo = pow(sunAmt, 16.0) * 0.30 * smoothstep(0.03, 0.16, dir.y);
        skyCol = mix(skyCol, uSunGlowColor, clamp(broadGlow + coreHalo, 0.0, 0.48));
        gl_FragColor = vec4(skyCol, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'TropicalSkyDome';
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  return mesh;
}

export function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export function createEngineStage(
  container: HTMLElement,
  isSoftwareGl: boolean,
  isTouch: boolean,
): EngineStage {
  const width = container.clientWidth || window.innerWidth;
  const height = Math.max(1, container.clientHeight || window.innerHeight);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.99;
  renderer.setPixelRatio(
    isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2),
  );
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.skyBackground);
  scene.fog = new THREE.FogExp2(PALETTE.fogColor, PALETTE.fogDensity);

  const skyDome = createSkyDome();
  scene.add(skyDome);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomEnv = new RoomEnvironment();
  const envRenderTarget = pmrem.fromScene(roomEnv, 0.04);
  scene.environment = envRenderTarget.texture;
  scene.environmentIntensity = 0.42;
  roomEnv.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(52, width / height, 0.25, 1400);

  const hemiLight = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 0.9);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(PALETTE.sunColor, 1.54);
  dirLight.castShadow = !isSoftwareGl;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.left = -55;
  dirLight.shadow.camera.right = 55;
  dirLight.shadow.camera.top = 55;
  dirLight.shadow.camera.bottom = -55;
  dirLight.shadow.camera.near = 5;
  dirLight.shadow.camera.far = 220;
  dirLight.shadow.bias = -0.0005;
  dirLight.shadow.normalBias = 0.02;
  scene.add(dirLight);
  scene.add(dirLight.target);

  return { renderer, scene, camera, dirLight, hemiLight, envRenderTarget, skyDome };
}

/**
 * Software-WebGL pacing via WebGL2 fenceSync + 80ms breathing room so CPU rendering
 * never starves browser events or Playwright screenshots.
 */
export function scheduleAfterDraw(
  renderer: THREE.WebGLRenderer,
  isDisposed: () => boolean,
  setFrameId: (id: number) => void,
  cb: () => void,
): void {
  const gl = renderer.getContext() as WebGL2RenderingContext | null;
  if (!gl || typeof gl.fenceSync !== 'function') {
    setFrameId(window.setTimeout(cb, 80));
    return;
  }
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
  gl.flush();
  const poll = () => {
    if (isDisposed()) {
      if (sync) gl.deleteSync(sync);
      return;
    }
    const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
    if (status === gl.UNSIGNALED) {
      setFrameId(window.setTimeout(poll, 5));
    } else {
      if (sync) gl.deleteSync(sync);
      setFrameId(window.setTimeout(cb, 80));
    }
  };
  setFrameId(window.setTimeout(poll, 5));
}
