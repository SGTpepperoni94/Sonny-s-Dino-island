import * as THREE from 'three';
import { PALETTE } from '../config/palette';
import type { MaterialLibrary } from '../engine/MaterialLibrary';
import { WATERFALL_ORIGIN_X, WATERFALL_ORIGIN_Z } from './terrainMath';

export interface LandmarkTracker {
  trackGeo: <T extends THREE.BufferGeometry>(geo: T) => T;
  trackMat: <T extends THREE.Material>(mat: T) => T;
}

export interface WaterfallBuildOptions extends LandmarkTracker {
  presets: ReturnType<MaterialLibrary['getPalettePresets']>;
  timeUniform: { value: number };
}

export const WATERFALL_ROT_Y = 0.12;
export const WATERFALL_PLUNGE_LOCAL_Z = 9.4;

export const WATERFALL_CLIFF_PILLARS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-8.6, -5.6, 4.4, 22.8], [-14.2, -5.2, 5.0, 17.6], [-9.8, -0.4, 3.8, 12.6], [-15.2, 0.6, 4.4, 9.2],
  [8.8, -5.4, 4.6, 23.4], [14.4, -4.8, 5.0, 18.8], [10.2, 0.2, 3.9, 13.2], [15.6, 1.8, 4.4, 9.4],
];

const FOAM_MOUNDS: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
  [-4.4, 0.26, 8.9, 1.35, 0.72, 1.25], [-2.9, 0.45, 9.4, 1.58, 0.98, 1.4],
  [-1.4, 0.58, 9.7, 1.75, 1.18, 1.5], [0.0, 0.64, 9.9, 1.88, 1.26, 1.55],
  [1.5, 0.56, 9.6, 1.72, 1.12, 1.48], [3.0, 0.44, 9.3, 1.55, 0.94, 1.38],
  [4.5, 0.26, 8.8, 1.32, 0.7, 1.22], [-2.2, 0.22, 10.6, 1.28, 0.52, 1.18],
  [0.1, 0.26, 10.9, 1.42, 0.58, 1.25], [2.4, 0.22, 10.5, 1.24, 0.5, 1.15],
];

const SIMPLE_UV_VERT = `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;

export function createCraggyPillarGeo(rTop: number, rBot: number): THREE.CylinderGeometry {
  const geo = new THREE.CylinderGeometry(rTop, rBot, 1.0, 7, 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (Math.hypot(x, z) > 0.05) {
      const crag = 0.86 + 0.26 * Math.abs(Math.sin(i * 19.7 + y * 6.3));
      pos.setX(i, x * crag);
      pos.setZ(i, z * crag);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function createCascadeGeometry(w: number, h: number, sx: number, sy: number, zOff: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, sx, sy);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const normY = (pos.getY(i) + h * 0.5) / h;
    const archZ = -3.9 + Math.sin((1 - normY) * Math.PI * 0.52) * 13.3 + zOff;
    pos.setZ(i, archZ + Math.sin(pos.getX(i) * 0.95) * 0.24 * Math.sin(normY * Math.PI));
  }
  geo.computeVertexNormals();
  return geo;
}

/** Builds Crystal Waterfall Lagoon matching docs/references/waterfall-lagoon.png. */
export function buildCrystalWaterfall(parent: THREE.Group, opts: WaterfallBuildOptions): THREE.Group {
  const { presets, trackGeo, trackMat, timeUniform } = opts;
  const group = new THREE.Group();
  group.name = 'CrystalWaterfall';
  group.position.set(WATERFALL_ORIGIN_X, 0, WATERFALL_ORIGIN_Z);
  group.rotation.y = WATERFALL_ROT_Y;

  // 1. Broad-based craggy stepped cliff buttresses + sunlit meadow-lime moss blankets
  const mossMat = trackMat(new THREE.MeshStandardMaterial({
    color: PALETTE.meadowLime, flatShading: true, roughness: 0.84, metalness: 0.02,
  }));
  const pillarInst = new THREE.InstancedMesh(trackGeo(createCraggyPillarGeo(0.85, 1.65)), presets.cliffStone, WATERFALL_CLIFF_PILLARS.length);
  const mossInst = new THREE.InstancedMesh(trackGeo(new THREE.DodecahedronGeometry(1.0, 0)), mossMat, WATERFALL_CLIFF_PILLARS.length);
  const dummy = new THREE.Object3D();
  WATERFALL_CLIFF_PILLARS.forEach(([px, pz, rTop, h], i) => {
    const totalH = h + 4.5;
    dummy.position.set(px, -4.5 + totalH * 0.5, pz);
    dummy.rotation.set(0, i * 0.85, 0);
    dummy.scale.set(rTop, totalH, rTop * 1.15);
    dummy.updateMatrix();
    pillarInst.setMatrixAt(i, dummy.matrix);
    dummy.position.set(px, h + 0.12, pz);
    dummy.scale.set(rTop * 1.02, 0.92, rTop * 1.14);
    dummy.updateMatrix();
    mossInst.setMatrixAt(i, dummy.matrix);
  });
  pillarInst.instanceMatrix.needsUpdate = true;
  mossInst.instanceMatrix.needsUpdate = true;
  pillarInst.castShadow = true;
  pillarInst.receiveShadow = true;
  group.add(pillarInst, mossInst);

  const cyan = new THREE.Color(PALETTE.waterfallCyan);
  const white = new THREE.Color(PALETTE.waterfallBright);

  // 2. Upper River Apron spilling smoothly into the frothy cliff crest lip
  const crestGeo = trackGeo(new THREE.PlaneGeometry(11.4, 8.2, 8, 6));
  crestGeo.rotateX(-Math.PI / 2);
  const cPos = crestGeo.attributes.position;
  for (let i = 0; i < cPos.count; i++) {
    const t = THREE.MathUtils.clamp((cPos.getZ(i) + 4.1) / 8.2, 0, 1);
    cPos.setY(i, 22.35 - Math.pow(t, 2.4) * 1.15);
  }
  crestGeo.computeVertexNormals();
  const crestMesh = new THREE.Mesh(
    crestGeo,
    trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uCyan: { value: cyan }, uWhite: { value: white } },
      transparent: true, vertexShader: SIMPLE_UV_VERT,
      fragmentShader: `uniform float uTime; uniform vec3 uCyan,uWhite; varying vec2 vUv;
        void main(){
          float st=sin(vUv.x*24.0+sin(vUv.y*5.0-uTime*2.6)*0.9)*0.5+0.5;
          float lip=smoothstep(0.62,1.0,1.0-vUv.y);
          float side=smoothstep(0.0,0.1,vUv.x)*smoothstep(1.0,0.9,vUv.x);
          gl_FragColor=vec4(mix(uCyan,uWhite,clamp(lip*0.85+st*0.35,0.0,1.0)),0.94*side);
        }`,
    })),
  );
  crestMesh.position.set(0, 0, -7.8);
  crestMesh.renderOrder = 3;
  group.add(crestMesh);

  // 3. Primary Luminous Cyan-and-White Cascading Veil + Secondary Outer Spray Veil
  const primaryMesh = new THREE.Mesh(
    trackGeo(createCascadeGeometry(11.0, 22.6, 14, 22, 0.0)),
    trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform, uCyan: { value: cyan }, uWhite: { value: white } },
      transparent: true, side: THREE.DoubleSide, vertexShader: SIMPLE_UV_VERT,
      fragmentShader: `uniform float uTime; uniform vec3 uCyan,uWhite; varying vec2 vUv;
        void main(){
          float f1=vUv.y*5.5+uTime*3.4, f2=vUv.y*9.0+uTime*5.1;
          float s1=sin(vUv.x*30.0+sin(f1*0.7)*0.8)*0.5+0.5;
          float s2=sin(vUv.x*62.0-sin(f2*0.5)*1.1)*0.5+0.5;
          float rib=smoothstep(0.42,0.88,s1*0.62+s2*0.38);
          float foam=clamp(rib*0.72+smoothstep(0.84,1.0,vUv.y)*0.85+(1.0-smoothstep(0.0,0.24,vUv.y))*0.95,0.0,1.0);
          float edge=smoothstep(0.0,0.09,vUv.x)*smoothstep(1.0,0.91,vUv.x);
          gl_FragColor=vec4(mix(uCyan,uWhite,smoothstep(0.28,0.82,foam)),(0.9+foam*0.1)*edge);
        }`,
    })),
  );
  primaryMesh.position.set(0, 10.75, 0);
  primaryMesh.renderOrder = 3;
  group.add(primaryMesh);

  const sprayMesh = new THREE.Mesh(
    trackGeo(createCascadeGeometry(11.9, 22.2, 10, 14, 0.65)),
    trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, vertexShader: SIMPLE_UV_VERT,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float ms=pow(sin(vUv.x*42.0+sin(vUv.y*7.5+uTime*4.8)*0.9)*0.5+0.5,2.4);
          float low=1.0-smoothstep(0.0,0.38,vUv.y);
          float edge=smoothstep(0.0,0.14,vUv.x)*smoothstep(1.0,0.86,vUv.x);
          gl_FragColor=vec4(0.95,1.0,1.0,(ms*0.34+low*0.46)*edge);
        }`,
    })),
  );
  sprayMesh.position.set(0, 10.65, 0);
  sprayMesh.renderOrder = 4;
  group.add(sprayMesh);

  // 4. Luminous Snow-White GPU-Pulsing Plunge Foam Mounds (single InstancedMesh)
  const moundMat = trackMat(new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: new THREE.Color(0xe6fbff), emissiveIntensity: 0.62,
    flatShading: true, roughness: 0.48, metalness: 0.0,
  }));
  moundMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float ph=instanceMatrix[3][0]*1.7+instanceMatrix[3][2]*1.3;
      transformed*=1.0+sin(uTime*5.2+ph)*0.11;
      transformed.y+=sin(uTime*6.4+ph*1.4)*0.12;`,
    );
  };
  moundMat.customProgramCacheKey = () => 'waterfall-foam-mounds-v2';

  const moundInst = new THREE.InstancedMesh(trackGeo(new THREE.IcosahedronGeometry(1.0, 1)), moundMat, FOAM_MOUNDS.length);
  FOAM_MOUNDS.forEach(([mx, my, mz, sx, sy, sz], i) => {
    dummy.position.set(mx, my, mz);
    dummy.rotation.set(i * 0.4, i * 0.9, i * 0.3);
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    moundInst.setMatrixAt(i, dummy.matrix);
  });
  moundInst.instanceMatrix.needsUpdate = true;
  moundInst.renderOrder = 4;
  group.add(moundInst);

  // 5. Crisp Expanding Multi-Ring Concentric Splash Ripples + Shimmering Lagoon Reflection Column
  const splashGeo = trackGeo(new THREE.CircleGeometry(15.2, 36));
  splashGeo.rotateX(-Math.PI / 2);
  const splashMesh = new THREE.Mesh(
    splashGeo,
    trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      vertexShader: SIMPLE_UV_VERT,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          vec2 p=(vUv-0.5)*2.0;
          float d=length(p)+sin(atan(p.y,p.x)*8.0+uTime*2.1)*0.032;
          float core=1.0-smoothstep(0.16,0.36,d);
          float rings=smoothstep(0.52,0.88,sin(d*26.0-uTime*4.8)*0.5+0.5);
          float fade=smoothstep(0.22,0.34,d)*(1.0-smoothstep(0.58,0.98,d));
          gl_FragColor=vec4(0.97,1.0,1.0,clamp(core*0.92+rings*fade*0.85,0.0,0.95));
        }`,
    })),
  );
  splashMesh.position.set(0, 0.14, WATERFALL_PLUNGE_LOCAL_Z + 0.5);
  splashMesh.renderOrder = 4;
  group.add(splashMesh);

  const reflGeo = trackGeo(new THREE.PlaneGeometry(11.6, 16.5, 2, 8));
  reflGeo.rotateX(-Math.PI / 2);
  const reflMesh = new THREE.Mesh(
    reflGeo,
    trackMat(new THREE.ShaderMaterial({
      uniforms: { uTime: timeUniform },
      transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      vertexShader: SIMPLE_UV_VERT,
      fragmentShader: `uniform float uTime; varying vec2 vUv;
        void main(){
          float w=sin(vUv.y*40.0-uTime*3.6+sin(vUv.x*12.0)*1.1)*0.5+0.5;
          float xf=smoothstep(0.0,0.22,vUv.x)*smoothstep(1.0,0.78,vUv.x);
          float yf=smoothstep(0.0,0.12,vUv.y)*smoothstep(1.0,0.18,vUv.y);
          gl_FragColor=vec4(0.8,0.99,1.0,xf*yf*(0.24+0.42*smoothstep(0.32,0.84,w)));
        }`,
    })),
  );
  reflMesh.position.set(0, 0.1, WATERFALL_PLUNGE_LOCAL_Z + 9.2);
  reflMesh.renderOrder = 3;
  group.add(reflMesh);

  parent.add(group);
  return group;
}
