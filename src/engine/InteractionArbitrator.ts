import type { IInteractable } from '../types/game';

/**
 * Picks a single best interactable inside Sonny's facing cone so the
 * 3-button kid layout never fires two competing actions in Build 2+.
 */
export class InteractionArbitrator {
  private readonly items = new Map<string, IInteractable>();

  public register(item: IInteractable): void {
    this.items.set(item.id, item);
  }

  public unregister(id: string): void {
    this.items.delete(id);
  }

  public clear(): void {
    this.items.clear();
  }

  public count(): number {
    return this.items.size;
  }

  public selectBest(
    originX: number,
    originY: number,
    originZ: number,
    facingYaw: number,
    minFacingDot = -0.15,
  ): IInteractable | null {
    const fwdX = Math.sin(facingYaw);
    const fwdZ = Math.cos(facingYaw);

    let winner: IInteractable | null = null;
    let bestScore = -Infinity;

    for (const item of this.items.values()) {
      if (!item.canInteract()) continue;
      const dx = item.position.x - originX;
      const dy = item.position.y - originY;
      const dz = item.position.z - originZ;
      const distSq = dx * dx + dy * dy + dz * dz;
      const maxDistSq = item.radius * item.radius;
      if (distSq > maxDistSq) continue;

      const horizLen = Math.hypot(dx, dz);
      const facingDot = horizLen > 1e-4 ? (dx * fwdX + dz * fwdZ) / horizLen : 1;
      if (facingDot < minFacingDot) continue;

      const distNorm = 1 - Math.sqrt(distSq) / Math.max(0.001, item.radius);
      const score = item.priority * 10 + facingDot * 2.5 + distNorm * 1.5;
      if (score > bestScore) {
        bestScore = score;
        winner = item;
      }
    }

    return winner;
  }

  public triggerBest(
    originX: number,
    originY: number,
    originZ: number,
    facingYaw: number,
  ): IInteractable | null {
    const best = this.selectBest(originX, originY, originZ, facingYaw);
    if (best) {
      best.onInteract();
    }
    return best;
  }
}
