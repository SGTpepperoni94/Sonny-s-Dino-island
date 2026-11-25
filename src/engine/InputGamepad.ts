export interface StickVector {
  x: number;
  y: number;
}

export interface GamepadSample {
  moveX: number;
  moveZ: number;
  yawDelta: number;
  pitchDelta: number;
  jumpHeld: boolean;
  jumpJustPressed: boolean;
  waveJustPressed: boolean;
  orbitActive: boolean;
  hasMoveInput: boolean;
}

const EMPTY_GAMEPADS: readonly (Gamepad | null)[] = [];

export function applyStickDeadzone(
  x: number,
  y: number,
  deadzone = 0.15,
  out: StickVector = { x: 0, y: 0 },
): StickVector {
  const mag = Math.hypot(x, y);
  if (mag <= deadzone) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  const scaled = Math.min(1, (mag - deadzone) / (1 - deadzone));
  out.x = (x / mag) * scaled;
  out.y = (y / mag) * scaled;
  return out;
}

export class GamepadPoller {
  private prevJump = false;
  private prevWave = false;
  private readonly _left: StickVector = { x: 0, y: 0 };
  private readonly _right: StickVector = { x: 0, y: 0 };
  private readonly _sample: GamepadSample = {
    moveX: 0,
    moveZ: 0,
    yawDelta: 0,
    pitchDelta: 0,
    jumpHeld: false,
    jumpJustPressed: false,
    waveJustPressed: false,
    orbitActive: false,
    hasMoveInput: false,
  };

  public poll(dt: number): Readonly<GamepadSample> {
    const s = this._sample;
    s.moveX = 0;
    s.moveZ = 0;
    s.yawDelta = 0;
    s.pitchDelta = 0;
    s.jumpHeld = false;
    s.jumpJustPressed = false;
    s.waveJustPressed = false;
    s.orbitActive = false;
    s.hasMoveInput = false;

    const gamepads =
      typeof navigator !== 'undefined' && navigator.getGamepads
        ? navigator.getGamepads()
        : EMPTY_GAMEPADS;

    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp || !gp.connected) continue;

      applyStickDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0, 0.15, this._left);
      if (this._left.x !== 0 || this._left.y !== 0) {
        s.moveX = this._left.x;
        s.moveZ = -this._left.y;
        s.hasMoveInput = true;
      }

      applyStickDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0, 0.15, this._right);
      if (this._right.x !== 0 || this._right.y !== 0) {
        s.yawDelta = -this._right.x * 2.2 * dt;
        s.pitchDelta = this._right.y * 1.4 * dt;
        s.orbitActive = true;
      }

      const aPressed = Boolean(gp.buttons[0]?.pressed);
      const xOrRtPressed = Boolean(
        gp.buttons[2]?.pressed || (gp.buttons[7]?.value ?? 0) > 0.35,
      );
      s.jumpJustPressed = aPressed && !this.prevJump;
      s.waveJustPressed = xOrRtPressed && !this.prevWave;
      this.prevJump = aPressed;
      this.prevWave = xOrRtPressed;
      s.jumpHeld = aPressed;
      break;
    }

    return s;
  }

  public reset(): void {
    this.prevJump = false;
    this.prevWave = false;
  }
}
