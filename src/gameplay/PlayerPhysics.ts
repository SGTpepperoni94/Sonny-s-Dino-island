import { applyStickDeadzone } from '../engine/InputGamepad';
import { computeTerrainHeight, isInShallowWater, isPositionWalkable } from '../world/terrainMath';

export { applyStickDeadzone };

export interface PlayerKinematicsState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  grounded: boolean;
  coyoteTimer: number;
  jumpBufferTimer: number;
  inShallowWater: boolean;
  speed: number;
  squashX: number;
  squashY: number;
  hitGuardrail: boolean;
}

export interface StepInput {
  wishX: number;
  wishZ: number;
  jumpJustPressed: boolean;
  jumpHeld: boolean;
  dt: number;
}

export interface StepEvents {
  jumped: boolean;
  landed: boolean;
  splashed: boolean;
}

const MAX_RUN_SPEED = 10.6;
const SHALLOW_WATER_SPEED = 7.4;
const GROUND_ACCEL = 38.0;
const AIR_ACCEL = 16.0;
const GRAVITY = -26.0;
const JUMP_VELOCITY = 10.6;
const COYOTE_TIME = 0.11;
const JUMP_BUFFER_TIME = 0.13;
const GUARDRAIL_OFFSETS = [0.65, -0.65, 1.15, -1.15] as const;

export function shortestAngleDelta(from: number, to: number): number {
  let diff = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function createPlayerKinematics(x: number, z: number, yaw: number): PlayerKinematicsState {
  const groundY = computeTerrainHeight(x, z);
  return {
    x,
    y: groundY,
    z,
    vx: 0,
    vy: 0,
    vz: 0,
    yaw,
    grounded: true,
    coyoteTimer: COYOTE_TIME,
    jumpBufferTimer: 0,
    inShallowWater: isInShallowWater(x, z),
    speed: 0,
    squashX: 1,
    squashY: 1,
    hitGuardrail: false,
  };
}

/**
 * Pure kid-safe movement step: smooth guardrail sliding along deep water & volcano lava rim,
 * coyote time, jump buffering, and squash-and-stretch damping.
 */
export function stepPlayerKinematics(
  state: PlayerKinematicsState,
  input: StepInput,
  outEvents?: StepEvents,
): StepEvents {
  const dt = Math.max(0.001, Math.min(0.05, input.dt));
  const events: StepEvents = outEvents ?? { jumped: false, landed: false, splashed: false };
  events.jumped = false;
  events.landed = false;
  events.splashed = false;

  const wishMag = Math.min(1, Math.hypot(input.wishX, input.wishZ));
  const maxSpd = state.inShallowWater ? SHALLOW_WATER_SPEED : MAX_RUN_SPEED;
  const targetVx = wishMag > 0.01 ? (input.wishX / Math.max(1, wishMag)) * maxSpd * Math.min(1, wishMag) : 0;
  const targetVz = wishMag > 0.01 ? (input.wishZ / Math.max(1, wishMag)) * maxSpd * Math.min(1, wishMag) : 0;

  const accel = state.grounded ? GROUND_ACCEL : AIR_ACCEL;
  const blend = 1 - Math.exp(-accel * dt * 0.35);
  state.vx += (targetVx - state.vx) * blend;
  state.vz += (targetVz - state.vz) * blend;

  // Gentle invisible guardrail resolution: test full step -> slide X -> slide Z -> soft tangential slide
  const nextX = state.x + state.vx * dt;
  const nextZ = state.z + state.vz * dt;
  state.hitGuardrail = false;

  if (isPositionWalkable(nextX, nextZ)) {
    state.x = nextX;
    state.z = nextZ;
  } else if (isPositionWalkable(nextX, state.z)) {
    state.x = nextX;
    state.vz *= 0.25;
    state.hitGuardrail = true;
  } else if (isPositionWalkable(state.x, nextZ)) {
    state.z = nextZ;
    state.vx *= 0.25;
    state.hitGuardrail = true;
  } else {
    // Try gentle 45-degree deflection so Sonny glides smoothly along shorelines/rims
    const speed = Math.hypot(state.vx, state.vz);
    if (speed > 0.1) {
      const ang = Math.atan2(state.vz, state.vx);
      let moved = false;
      for (let i = 0; i < GUARDRAIL_OFFSETS.length; i++) {
        const off = GUARDRAIL_OFFSETS[i];
        const tx = state.x + Math.cos(ang + off) * speed * dt * 0.72;
        const tz = state.z + Math.sin(ang + off) * speed * dt * 0.72;
        if (isPositionWalkable(tx, tz)) {
          state.x = tx;
          state.z = tz;
          moved = true;
          break;
        }
      }
      if (!moved) {
        state.vx *= 0.2;
        state.vz *= 0.2;
      }
      state.hitGuardrail = true;
    }
  }

  // Smooth facing yaw toward horizontal velocity
  const horizSpeed = Math.hypot(state.vx, state.vz);
  state.speed = horizSpeed;
  if (horizSpeed > 0.35) {
    const targetYaw = Math.atan2(state.vx, state.vz);
    const delta = shortestAngleDelta(state.yaw, targetYaw);
    state.yaw += delta * (1 - Math.exp(-12.5 * dt));
  }

  // Jump buffering & coyote time
  if (input.jumpJustPressed) {
    state.jumpBufferTimer = JUMP_BUFFER_TIME;
  } else {
    state.jumpBufferTimer = Math.max(0, state.jumpBufferTimer - dt);
  }

  if (state.grounded) {
    state.coyoteTimer = COYOTE_TIME;
  } else {
    state.coyoteTimer = Math.max(0, state.coyoteTimer - dt);
  }

  if (state.jumpBufferTimer > 0 && state.coyoteTimer > 0) {
    state.vy = JUMP_VELOCITY;
    state.grounded = false;
    state.coyoteTimer = 0;
    state.jumpBufferTimer = 0;
    state.squashX = 0.84;
    state.squashY = 1.2;
    events.jumped = true;
  }

  // Variable jump height cut when released early
  if (!input.jumpHeld && state.vy > 3.5) {
    state.vy *= 0.65;
  }

  // Vertical gravity + ground snapping
  const groundY = computeTerrainHeight(state.x, state.z);
  const wasGrounded = state.grounded;
  state.vy += GRAVITY * dt;
  state.y += state.vy * dt;

  if (state.y <= groundY + 0.02 && state.vy <= 0) {
    state.y = groundY;
    if (!wasGrounded && state.vy < -1.5) {
      state.squashX = 1.2;
      state.squashY = 0.8;
      events.landed = true;
    }
    state.vy = 0;
    state.grounded = true;
  } else if (wasGrounded && Math.abs(state.y - groundY) < 0.45 && state.vy <= 0) {
    // Keep Sonny smoothly glued when running down ramps/hills
    state.y = groundY;
    state.vy = 0;
    state.grounded = true;
  } else {
    state.grounded = false;
  }

  const prevShallow = state.inShallowWater;
  state.inShallowWater = isInShallowWater(state.x, state.z) && state.y <= 0.25;
  if (state.inShallowWater && (!prevShallow || events.landed)) {
    events.splashed = true;
  }

  // Exponentially damp squash-and-stretch back to 1
  const sqDamp = 1 - Math.exp(-12 * dt);
  state.squashX += (1 - state.squashX) * sqDamp;
  state.squashY += (1 - state.squashY) * sqDamp;

  return events;
}
