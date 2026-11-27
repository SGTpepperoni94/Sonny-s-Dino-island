import { CAPTURE_PRESETS, CAPTURE_PRESET_ORDER, ISLAND_ANGLE_PRESET_ORDER } from '../config/capturePresets';

export interface CaptureMeta {
  phase: string;
  timestamp: string;
  calls: number;
  triangles: number;
  selfTest: string;
}

const SHEET_W = 1280;
const CELL_W = 604;
const CELL_H = 340;
const PAD = 24;
const BANNER_H = 80;
const ROW_H = CELL_H + 44;

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawSlot(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: string,
) {
  ctx.fillStyle = '#132a42';
  ctx.fillRect(x, y, w, h);
  if (img) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  ctx.strokeStyle = '#2d4e70';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.fillStyle = '#8eb3d4';
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(fallback, x + w / 2, y + h / 2 + 6);
  ctx.textAlign = 'left';
}

function drawBanner(ctx: CanvasRenderingContext2D, title: string, subtitle: string) {
  ctx.fillStyle = '#102942';
  ctx.fillRect(0, 0, SHEET_W, BANNER_H - 6);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(title, PAD, 32);
  ctx.fillStyle = '#8de0f5';
  ctx.font = '600 15px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(subtitle, PAD, 58);
}

async function downloadCanvas(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportBiomeAuditSheet(meta: CaptureMeta | null): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = BANNER_H + CAPTURE_PRESET_ORDER.length * ROW_H + PAD;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#091827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stats = meta
    ? `${meta.timestamp}  |  ${meta.calls} calls  |  ${meta.triangles.toLocaleString()} tris  |  ?test: ${meta.selfTest}`
    : 'Telemetry metadata pending (/captures/latest/meta.json)';
  drawBanner(ctx, `Sonny Island Visual Audit — ${meta?.phase ?? 'Baseline'}`, stats);

  const pairs = await Promise.all(
    CAPTURE_PRESET_ORDER.map(async (id) => ({
      id,
      prev: await loadImage(`/captures/prev/${id}.png`),
      latest: await loadImage(`/captures/latest/${id}.png`),
    })),
  );
  pairs.forEach(({ id, prev, latest }, i) => {
    const rowY = BANNER_H + i * ROW_H;
    ctx.fillStyle = '#ffd666';
    ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`${i + 1}. ${CAPTURE_PRESETS[id].label} (${id})`, PAD, rowY + 22);
    ctx.fillStyle = '#9ec0dc';
    ctx.font = '600 13px ui-monospace, monospace';
    ctx.fillText('PREVIOUS', PAD + CELL_W - 76, rowY + 22);
    ctx.fillText('CURRENT', PAD + CELL_W + PAD + CELL_W - 68, rowY + 22);
    drawSlot(ctx, prev, PAD, rowY + 30, CELL_W, CELL_H, 'No Previous Baseline');
    drawSlot(ctx, latest, PAD + CELL_W + PAD, rowY + 30, CELL_W, CELL_H, 'Missing Latest Capture');
  });

  await downloadCanvas(canvas, 'sonny-island-audit.png');
}

export async function exportIslandAnglesSheet(meta: CaptureMeta | null): Promise<void> {
  const heroW = SHEET_W - PAD * 2;
  const heroH = Math.round((heroW * 9) / 16);
  const compassIds = ISLAND_ANGLE_PRESET_ORDER.slice(1);
  const rows = Math.ceil(compassIds.length / 2);

  const canvas = document.createElement('canvas');
  canvas.width = SHEET_W;
  canvas.height = BANNER_H + (heroH + 44) + rows * ROW_H + PAD;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#091827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const stats = meta
    ? `${meta.timestamp}  |  9 Full-Island Angles (Bird's-Eye + 360° Compass)  |  ${meta.triangles.toLocaleString()} tris`
    : "9 Full-Island Angles (Bird's-Eye Top-Down + 8 Compass Bearings)";
  drawBanner(ctx, "Sonny Island — 360° Orbital & Bird's-Eye Survey", stats);

  const images = await Promise.all(
    ISLAND_ANGLE_PRESET_ORDER.map(async (id) => ({
      id,
      img: await loadImage(`/captures/angles/${id}.png`),
    })),
  );

  const hero = images[0];
  ctx.fillStyle = '#ffd666';
  ctx.font = '700 18px ui-sans-serif, system-ui, sans-serif';
  ctx.fillText(`1. ${CAPTURE_PRESETS[hero.id].label}`, PAD, BANNER_H + 22);
  drawSlot(ctx, hero.img, PAD, BANNER_H + 30, heroW, heroH, "Missing Bird's-Eye Capture");

  const gridStartY = BANNER_H + heroH + 54;
  images.slice(1).forEach(({ id, img }, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = PAD + col * (CELL_W + PAD);
    const y = gridStartY + row * ROW_H;
    ctx.fillStyle = '#ffd666';
    ctx.font = '700 17px ui-sans-serif, system-ui, sans-serif';
    ctx.fillText(`${idx + 2}. ${CAPTURE_PRESETS[id].label}`, x, y + 22);
    drawSlot(ctx, img, x, y + 30, CELL_W, CELL_H, `Missing ${id}`);
  });

  await downloadCanvas(canvas, 'sonny-island-360-birds-eye.png');
}
