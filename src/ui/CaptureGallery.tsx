import { useEffect, useState } from 'react';
import { CAPTURE_PRESETS, CAPTURE_PRESET_ORDER } from '../config/capturePresets';

interface CaptureMeta {
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

function drawSlot(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, fallback: string) {
  ctx.fillStyle = '#132a42';
  ctx.fillRect(x, y, CELL_W, CELL_H);
  if (img) { ctx.drawImage(img, x, y, CELL_W, CELL_H); return; }
  ctx.strokeStyle = '#2d4e70';
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, CELL_W - 2, CELL_H - 2);
  ctx.fillStyle = '#8eb3d4';
  ctx.font = '600 18px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(fallback, x + CELL_W / 2, y + CELL_H / 2 + 6);
  ctx.textAlign = 'left';
}

export function CaptureGallery({ onClose }: { onClose: () => void }) {
  const [meta, setMeta] = useState<CaptureMeta | null>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/captures/latest/meta.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CaptureMeta | null) => { if (active && data) setMeta(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const markMissing = (key: string) => setMissing((p) => (p[key] ? p : { ...p, [key]: true }));

  const exportContactSheet = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = SHEET_W;
      canvas.height = BANNER_H + CAPTURE_PRESET_ORDER.length * ROW_H + PAD;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = '#091827';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#102942';
      ctx.fillRect(0, 0, canvas.width, BANNER_H - 6);
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 22px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(`Sonny Island Visual Audit — ${meta?.phase ?? 'Baseline'}`, PAD, 32);
      ctx.fillStyle = '#8de0f5';
      ctx.font = '600 15px ui-monospace, SFMono-Regular, monospace';
      const stats = meta
        ? `${meta.timestamp}  |  ${meta.calls} calls  |  ${meta.triangles.toLocaleString()} tris  |  ?test: ${meta.selfTest}`
        : 'Telemetry metadata pending (/captures/latest/meta.json)';
      ctx.fillText(stats, PAD, 58);

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
        drawSlot(ctx, prev, PAD, rowY + 30, 'No Previous Baseline');
        drawSlot(ctx, latest, PAD + CELL_W + PAD, rowY + 30, 'Missing Latest Capture');
      });

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sonny-island-audit.png';
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div data-ui-interactive="true" className="fixed inset-0 z-40 flex flex-col bg-[#081726]/95 text-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/15 bg-[#0d243b] px-4 py-3">
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-wide text-[#FFE066]">
            Visual Audit Gallery {meta ? `· ${meta.phase}` : ''}
          </div>
          <div className="truncate font-mono text-[11px] text-cyan-200/90 tabular-nums">
            {meta ? `${meta.timestamp} · ${meta.calls} calls · ${meta.triangles.toLocaleString()} tris · ?test ${meta.selfTest}` : 'Loading telemetry…'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" disabled={exporting} onClick={exportContactSheet} className="cursor-pointer rounded-lg bg-[#FFB81C] px-3 py-1.5 text-xs font-bold text-[#3b1f08] transition-colors hover:bg-[#ffd059] disabled:opacity-50">
            {exporting ? 'Exporting…' : 'Export Contact Sheet'}
          </button>
          <button type="button" aria-label="Close visual audit gallery" onClick={onClose} className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold hover:bg-white/20">
            ✕
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        <div className="mx-auto flex max-w-5xl flex-col gap-3.5">
          {CAPTURE_PRESET_ORDER.map((id) => (
            <section key={id} className="rounded-xl border border-white/15 bg-[#0e2236] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#FFE066]">
                <span>{CAPTURE_PRESETS[id].label}</span>
                <span className="font-mono text-[11px] text-white/60">{id}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(['prev', 'latest'] as const).map((slot) => {
                  const key = `${slot}:${id}`;
                  return (
                    <div key={slot} className="flex flex-col gap-1">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-200/80">{slot === 'prev' ? 'Previous' : 'Current'}</span>
                      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-[#091624]">
                        {missing[key] ? (
                          <span className="px-2 text-center text-[11px] text-white/45">No {slot} capture yet</span>
                        ) : (
                          <img src={`/captures/${slot}/${id}.png`} alt={`${CAPTURE_PRESETS[id].label} ${slot}`} loading="lazy" onError={() => markMissing(key)} className="h-full w-full object-cover" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
