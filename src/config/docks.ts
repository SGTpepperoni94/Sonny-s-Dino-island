export const PLANK_WIDTH = 3.6;
export const PLANK_DEPTH = 0.72;
export const PLANK_THICKNESS = 0.28;
export const PLANK_SPACING = 0.85;
export const PLANK_CENTRE_Y = 0.72;
export const DECK_TOP = PLANK_CENTRE_Y + PLANK_THICKNESS / 2;

export const DOCKS = [
  { x: -26, z: 130.6, rotY: 0.12, planks: 10 },
  { x: 124.8, z: 21.8, rotY: 2.13, planks: 8 },
].map(d => ({ ...d, sin: Math.sin(d.rotY), cos: Math.cos(d.rotY),
  end: (d.planks - 1) * PLANK_SPACING + PLANK_DEPTH / 2 }));

// Treat the narrow gaps between planks as continuous support for small feet.
export function onDockDeck(x: number, z: number): boolean {
  for (const d of DOCKS) {
    const dx = x - d.x, dz = z - d.z;
    const along = dx * d.sin + dz * d.cos;
    if (along < -PLANK_DEPTH / 2 || along > d.end) continue;
    if (Math.abs(dx * d.cos - dz * d.sin) <= PLANK_WIDTH / 2) return true;
  }
  return false;
}
