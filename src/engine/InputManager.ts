import type * as THREE from 'three';
import type { InputState } from '../types/game';
import { GamepadPoller } from './InputGamepad';
import { TerrainPointerRaycaster } from './InputPointer';

const UI_INTERACTIVE_SELECTOR = 'button, input, [data-ui-interactive="true"]';

export class InputManager {
  private readonly keys = new Set<string>();
  private readonly pointerRay = new TerrainPointerRaycaster();
  private readonly gamepad = new GamepadPoller();

  private canvas: HTMLCanvasElement | null = null;
  private camera: THREE.PerspectiveCamera | null = null;
  private terrainRaycastTarget: THREE.Object3D | null = null;
  private unlockListener: (() => void) | null = null;

  private jumpQueued = false;
  private waveQueued = false;
  private touchStickX = 0;
  private touchStickY = 0;
  private touchJumpHeld = false;

  private leftMouseDown = false;
  private rightMouseDown = false;
  private lastMouseX = 0;
  private lastMouseY = 0;
  private mouseYawAccum = 0;
  private mousePitchAccum = 0;
  private clickTargetActive = false;
  private clickTargetX = 0;
  private clickTargetZ = 0;
  private lastPointerClientX = 0;
  private lastPointerClientY = 0;

  private readonly state: InputState = {
    moveX: 0, moveZ: 0, cameraYawDelta: 0, cameraPitchDelta: 0,
    jumpHeld: false, jumpJustPressed: false, waveJustPressed: false,
    clickTargetActive: false, clickTargetX: 0, clickTargetZ: 0, manualOrbitActive: false,
  };

  public attach(
    canvas: HTMLCanvasElement,
    camera: THREE.PerspectiveCamera,
    onFirstGesture?: () => void,
  ): void {
    this.canvas = canvas;
    this.camera = camera;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.clearAllHeld);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    canvas.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    canvas.addEventListener('dblclick', this.onDoubleClick);
    canvas.addEventListener('contextmenu', this.onContextMenu);

    if (onFirstGesture) {
      const unlockOnce = () => {
        onFirstGesture();
        this.removeUnlockListeners();
      };
      this.unlockListener = unlockOnce;
      window.addEventListener('pointerdown', unlockOnce, { passive: true });
      window.addEventListener('keydown', unlockOnce, { passive: true });
    }
  }

  private removeUnlockListeners(): void {
    if (!this.unlockListener) return;
    window.removeEventListener('pointerdown', this.unlockListener);
    window.removeEventListener('keydown', this.unlockListener);
    this.unlockListener = null;
  }

  public setTerrainTarget(obj: THREE.Object3D | null): void { this.terrainRaycastTarget = obj; }
  public triggerWave(): void { this.waveQueued = true; }
  public triggerJump(): void { this.jumpQueued = true; }
  public clearClickTarget(): void { this.clickTargetActive = false; }
  public getState(): Readonly<InputState> { return this.state; }

  public setTouchStick(x: number, y: number): void {
    this.touchStickX = Math.max(-1, Math.min(1, x));
    this.touchStickY = Math.max(-1, Math.min(1, y));
    if (Math.hypot(x, y) > 0.1) this.clickTargetActive = false;
  }

  public setTouchJump(held: boolean): void {
    if (held && !this.touchJumpHeld) this.jumpQueued = true;
    this.touchJumpHeld = held;
  }

  public clearAllHeld = (): void => {
    this.keys.clear();
    this.leftMouseDown = this.rightMouseDown = this.touchJumpHeld = this.clickTargetActive = false;
    this.touchStickX = this.touchStickY = 0;
    this.gamepad.reset();
  };

  private onVisibilityChange = (): void => { if (document.hidden) this.clearAllHeld(); };

  private onKeyDown = (e: KeyboardEvent): void => {
    const code = e.code;
    if (
      document.body.dataset.state === 'playing' &&
      (code === 'Space' || code.startsWith('Arrow'))
    ) {
      e.preventDefault();
    }
    if (!this.keys.has(code)) {
      if (code === 'Space') this.jumpQueued = true;
      if (code === 'KeyE' || code === 'KeyF') this.waveQueued = true;
    }
    this.keys.add(code);
    if (code === 'KeyW' || code === 'KeyA' || code === 'KeyS' || code === 'KeyD' || code.startsWith('Arrow')) {
      this.clickTargetActive = false;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => { this.keys.delete(e.code); };

  private isUiTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(UI_INTERACTIVE_SELECTOR));
  }

  private onContextMenu = (e: MouseEvent): void => { e.preventDefault(); };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.isUiTarget(e.target) || document.body.dataset.state !== 'playing') return;
    this.lastMouseX = this.lastPointerClientX = e.clientX;
    this.lastMouseY = this.lastPointerClientY = e.clientY;
    if (e.button === 0) {
      this.leftMouseDown = true;
      this.pickClickTarget(e.clientX, e.clientY);
    } else if (e.button === 2) {
      this.rightMouseDown = true;
    } else if (e.button === 1) {
      e.preventDefault();
      this.jumpQueued = true;
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.lastPointerClientX = e.clientX;
    this.lastPointerClientY = e.clientY;
    if (this.rightMouseDown) {
      this.mouseYawAccum -= (e.clientX - this.lastMouseX) * 0.0055;
      this.mousePitchAccum += (e.clientY - this.lastMouseY) * 0.0038;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    } else if (this.leftMouseDown) {
      this.pickClickTarget(e.clientX, e.clientY);
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.leftMouseDown = false;
    else if (e.button === 2) this.rightMouseDown = false;
  };

  private onDoubleClick = (e: MouseEvent): void => {
    if (this.isUiTarget(e.target) || document.body.dataset.state !== 'playing') return;
    this.jumpQueued = true;
  };

  private pickClickTarget(clientX: number, clientY: number): void {
    const res = this.pointerRay.pick(this.canvas, this.camera, this.terrainRaycastTarget, clientX, clientY);
    if (res.hit) {
      this.clickTargetActive = true;
      this.clickTargetX = res.x;
      this.clickTargetZ = res.z;
    }
  }

  public sample(dt: number): Readonly<InputState> {
    let moveX = 0;
    let moveZ = 0;
    let cameraYawDelta = this.mouseYawAccum;
    let cameraPitchDelta = this.mousePitchAccum;
    this.mouseYawAccum = 0;
    this.mousePitchAccum = 0;

    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveX -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveX += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveZ += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveZ -= 1;
    if (this.keys.has('KeyQ')) cameraYawDelta += 1.9 * dt;
    if (this.keys.has('KeyR')) cameraYawDelta -= 1.9 * dt;

    if (Math.hypot(this.touchStickX, this.touchStickY) > 0.05) {
      moveX += this.touchStickX;
      moveZ += -this.touchStickY;
    }

    const gp = this.gamepad.poll(dt);
    if (gp.hasMoveInput) {
      moveX += gp.moveX;
      moveZ += gp.moveZ;
      this.clickTargetActive = false;
    }
    cameraYawDelta += gp.yawDelta;
    cameraPitchDelta += gp.pitchDelta;
    if (gp.jumpJustPressed) this.jumpQueued = true;
    if (gp.waveJustPressed) this.waveQueued = true;

    if (this.leftMouseDown) this.pickClickTarget(this.lastPointerClientX, this.lastPointerClientY);

    const mag = Math.hypot(moveX, moveZ);
    if (mag > 1) { moveX /= mag; moveZ /= mag; }

    this.state.moveX = moveX;
    this.state.moveZ = moveZ;
    this.state.cameraYawDelta = cameraYawDelta;
    this.state.cameraPitchDelta = cameraPitchDelta;
    this.state.jumpHeld = this.keys.has('Space') || this.touchJumpHeld || gp.jumpHeld;
    this.state.jumpJustPressed = this.jumpQueued;
    this.state.waveJustPressed = this.waveQueued;
    this.state.clickTargetActive = this.clickTargetActive;
    this.state.clickTargetX = this.clickTargetX;
    this.state.clickTargetZ = this.clickTargetZ;
    this.state.manualOrbitActive =
      this.rightMouseDown || gp.orbitActive || this.keys.has('KeyQ') || this.keys.has('KeyR');
    this.jumpQueued = this.waveQueued = false;
    return this.state;
  }

  public dispose(): void {
    this.removeUnlockListeners();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.clearAllHeld);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mouseup', this.onMouseUp);
    if (this.canvas) {
      this.canvas.removeEventListener('mousedown', this.onMouseDown);
      this.canvas.removeEventListener('dblclick', this.onDoubleClick);
      this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    }
    this.canvas = this.camera = this.terrainRaycastTarget = null;
    this.pointerRay.clear();
  }
}
