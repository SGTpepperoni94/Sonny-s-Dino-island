import { useEffect, useState } from 'react';
import { CAPTURE_PRESETS, CAPTURE_PRESET_ORDER, ISLAND_ANGLE_PRESET_ORDER } from '../config/capturePresets';
import type { IslandAnglePresetId } from '../types/game';
import { type CaptureMeta, exportBiomeAuditSheet, exportIslandAnglesSheet } from './captureSheetExport';

type GalleryTab = 'angles' | 'biomes';
const COMPASS_LABELS = [
  ['N', 'top-2 left-1/2 -translate-x-1/2 text-[#FFE066]'],
  ['S', 'bottom-2 left-1/2 -translate-x-1/2 text-white/85'],
  ['W', 'top-1/2 left-2 -translate-y-1/2 text-white/85'],
  ['E', 'top-1/2 right-2 -translate-y-1/2 text-white/85'],
] as const;

export function CaptureGallery({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<GalleryTab>('angles');
  const [meta, setMeta] = useState<CaptureMeta | null>(null);
  const [missing, setMissing] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const [zoomId, setZoomId] = useState<IslandAnglePresetId | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/captures/latest/meta.json', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: CaptureMeta | null) => { if (active && data) setMeta(data); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!zoomId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const len = ISLAND_ANGLE_PRESET_ORDER.length;
      const idx = ISLAND_ANGLE_PRESET_ORDER.indexOf(zoomId);
      if (e.key === 'Escape') setZoomId(null);
      else if (e.key === 'ArrowRight') setZoomId(ISLAND_ANGLE_PRESET_ORDER[(idx + 1) % len]);
      else if (e.key === 'ArrowLeft') setZoomId(ISLAND_ANGLE_PRESET_ORDER[(idx - 1 + len) % len]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomId]);

  const markMissing = (key: string) => setMissing((p) => (p[key] ? p : { ...p, [key]: true }));
  const stepZoom = (delta: number) => {
    if (!zoomId) return;
    const len = ISLAND_ANGLE_PRESET_ORDER.length;
    setZoomId(ISLAND_ANGLE_PRESET_ORDER[(ISLAND_ANGLE_PRESET_ORDER.indexOf(zoomId) + delta + len) % len]);
  };
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      if (tab === 'angles') await exportIslandAnglesSheet(meta);
      else await exportBiomeAuditSheet(meta);
    } finally {
      setExporting(false);
    }
  };

  const birdsEyeId = ISLAND_ANGLE_PRESET_ORDER[0];
  const compassIds = ISLAND_ANGLE_PRESET_ORDER.slice(1);
  const zoomIdx = zoomId ? ISLAND_ANGLE_PRESET_ORDER.indexOf(zoomId) : -1;

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
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-lg border border-white/20 bg-[#081726] p-0.5 text-xs font-semibold">
            {([['angles', "360° & Bird's Eye (9)"], ['biomes', 'Biome Audit (7)']] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`cursor-pointer rounded-md px-2.5 py-1 transition-colors ${tab === key ? 'bg-[#17B5C9] text-[#062230]' : 'text-white/75 hover:text-white'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={exporting}
            onClick={handleExport}
            className="cursor-pointer rounded-lg bg-[#FFB81C] px-3 py-1.5 text-xs font-bold text-[#3b1f08] transition-colors hover:bg-[#ffd059] disabled:opacity-50"
          >
            {exporting ? 'Exporting…' : 'Export Contact Sheet'}
          </button>
          <button
            type="button"
            aria-label="Close visual audit gallery"
            onClick={onClose}
            className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-xs font-bold hover:bg-white/20"
          >
            ✕
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
        {tab === 'angles' ? (
          <div className="mx-auto flex max-w-6xl flex-col gap-4">
            <section className="rounded-xl border border-white/15 bg-[#0e2236] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#FFE066]">
                <span>{CAPTURE_PRESETS[birdsEyeId].label}</span>
                <span className="font-mono text-[11px] text-cyan-200/80">Click any shot to zoom</span>
              </div>
              <button
                type="button"
                onClick={() => setZoomId(birdsEyeId)}
                className="group relative block aspect-video w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#091624]"
              >
                {missing[`angles:${birdsEyeId}`] ? (
                  <span className="flex h-full items-center justify-center text-xs text-white/45">No bird&apos;s-eye capture yet</span>
                ) : (
                  <img
                    src={`/captures/angles/${birdsEyeId}.png`}
                    alt={CAPTURE_PRESETS[birdsEyeId].label}
                    onError={() => markMissing(`angles:${birdsEyeId}`)}
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.01]"
                  />
                )}
                {COMPASS_LABELS.map(([dir, posClass]) => (
                  <span key={dir} className={`pointer-events-none absolute rounded bg-[#081726]/80 px-2 py-0.5 font-mono text-[11px] font-bold ${posClass}`}>
                    {dir}
                  </span>
                ))}
              </button>
            </section>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2">
              {compassIds.map((id) => {
                const key = `angles:${id}`;
                return (
                  <section key={id} className="rounded-xl border border-white/15 bg-[#0e2236] p-3">
                    <div className="mb-2 flex items-center justify-between text-xs font-bold text-[#FFE066]">
                      <span>{CAPTURE_PRESETS[id].label}</span>
                      <span className="font-mono text-[11px] text-white/60">{id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setZoomId(id)}
                      className="group block aspect-video w-full cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-[#091624]"
                    >
                      {missing[key] ? (
                        <span className="flex h-full items-center justify-center text-[11px] text-white/45">No capture yet</span>
                      ) : (
                        <img
                          src={`/captures/angles/${id}.png`}
                          alt={CAPTURE_PRESETS[id].label}
                          loading="lazy"
                          onError={() => markMissing(key)}
                          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      )}
                    </button>
                  </section>
                );
              })}
            </div>
          </div>
        ) : (
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
                        <span className="font-mono text-[10px] uppercase tracking-wider text-cyan-200/80">
                          {slot === 'prev' ? 'Previous' : 'Current'}
                        </span>
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
        )}
      </div>

      {zoomId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[#040d17]/95 p-4" onClick={() => setZoomId(null)}>
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between pb-3" onClick={(e) => e.stopPropagation()}>
            <div className="text-sm font-bold text-[#FFE066]">
              {zoomIdx + 1} / {ISLAND_ANGLE_PRESET_ORDER.length} · {CAPTURE_PRESETS[zoomId].label}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => stepZoom(-1)} className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">← Prev</button>
              <button type="button" onClick={() => stepZoom(1)} className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold hover:bg-white/20">Next →</button>
              <a href={`/captures/angles/${zoomId}.png`} download={`${zoomId}.png`} className="rounded-lg bg-[#FFB81C] px-3 py-1 text-xs font-bold text-[#3b1f08] hover:bg-[#ffd059]">Download PNG</a>
              <button type="button" onClick={() => setZoomId(null)} className="cursor-pointer rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-xs font-bold hover:bg-white/20">✕</button>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <img src={`/captures/angles/${zoomId}.png`} alt={CAPTURE_PRESETS[zoomId].label} className="max-h-full max-w-full rounded-xl border border-white/15 object-contain shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
