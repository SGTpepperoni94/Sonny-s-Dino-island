import { useState } from 'react';
import { WORLD_ANCHORS } from '../config/worldAnchors';
import type { AnchorId, HudSnapshot, SelfTestReport } from '../types/game';
import { TouchThumbstick } from './TouchThumbstick';

interface GameHudProps {
  snapshot: HudSnapshot;
  debugMode: boolean;
  onToggleMute: () => void;
  onToggleGallery: () => void;
  onWave: () => void;
  onJumpDown: () => void;
  onJumpUp: () => void;
  onTouchStick: (x: number, y: number) => void;
  onTeleport: (anchor: AnchorId) => void;
  onRunSelfTest: () => SelfTestReport | null;
}

const ANCHOR_ORDER: AnchorId[] = [
  'harborSpawn',
  'ranchCenter',
  'jungleTrail',
  'ruinsTerrace',
  'volcanoSummit',
  'lagoonDock',
  'skullCaveMouth',
  'skullCaveInterior',
];

export function GameHud({
  snapshot,
  debugMode,
  onToggleMute,
  onToggleGallery,
  onWave,
  onJumpDown,
  onJumpUp,
  onTouchStick,
  onTeleport,
  onRunSelfTest,
}: GameHudProps) {
  const [debugOpen, setDebugOpen] = useState(true);
  const [testReport, setTestReport] = useState<SelfTestReport | null>(null);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      {/* Top-Right: Subtle Camera Audit Button & Mute Music Button */}
      <div className="fixed top-4 right-4 flex items-center gap-2">
        <button
          type="button"
          tabIndex={-1}
          data-ui-interactive="true"
          aria-label="Open visual audit gallery"
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleGallery();
          }}
          className="pointer-events-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border-2 border-[#5A3217]/80 bg-[#FFF5D6]/85 shadow-[0_3px_0_#8C5222,0_6px_12px_rgba(7,37,64,0.22)] transition-transform duration-150 hover:scale-105 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 8.5C4 7.4 4.9 6.5 6 6.5H8L9.5 4.5H14.5L16 6.5H18C19.1 6.5 20 7.4 20 8.5V17.5C20 18.6 19.1 19.5 18 19.5H6C4.9 19.5 4 18.6 4 17.5V8.5Z" fill="#17B5C9" stroke="#5A3217" strokeWidth="2" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.2" fill="#FFFDF5" stroke="#5A3217" strokeWidth="2" />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          data-ui-interactive="true"
          aria-label={snapshot.muted ? 'Unmute music' : 'Mute music'}
          aria-pressed={snapshot.muted}
          onClick={(e) => {
            e.currentTarget.blur();
            onToggleMute();
          }}
          className="pointer-events-auto flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border-[3px] border-[#5A3217] bg-[#FFF5D6] shadow-[0_4px_0_#8C5222,0_8px_16px_rgba(7,37,64,0.28)] transition-transform duration-150 hover:scale-105 active:translate-y-0.5 focus-visible:outline-2 focus-visible:outline-white"
        >
          {snapshot.muted ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 5L6 9H3V15H6L11 19V5Z"
                fill="#C84630"
                stroke="#5A3217"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M16 9L21 15M21 9L16 15"
                stroke="#C84630"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M11 5L6 9H3V15H6L11 19V5Z"
                fill="#17B5C9"
                stroke="#5A3217"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M15.5 8.5C16.8 9.8 16.8 14.2 15.5 15.5M18.5 6C21 8.5 21 15.5 18.5 18"
                stroke="#5A3217"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Bottom-Left: Touch Virtual Thumbstick (Auto-Shown on Touch Devices) */}
      {snapshot.isTouch && (
        <div className="fixed bottom-6 left-6">
          <TouchThumbstick onMove={onTouchStick} />
        </div>
      )}

      {/* Bottom-Right: Playful Wave & Jump Icon-Only Buttons (Big on Touch, Compact on Desktop) */}
      <div className="fixed right-5 bottom-5 flex items-end gap-3.5">
        <button
          type="button"
          tabIndex={-1}
          data-ui-interactive="true"
          aria-label="Wave"
          onClick={(e) => {
            e.currentTarget.blur();
            onWave();
          }}
          className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-full border-[4px] border-[#663614] bg-[#FFB81C] shadow-[0_6px_0_#9E550A,0_10px_20px_rgba(7,37,64,0.32)] transition-transform duration-150 hover:scale-105 active:translate-y-1 ${
            snapshot.isTouch ? 'h-20 w-20' : 'h-14 w-14'
          } ${snapshot.isWaving ? 'scale-105 bg-[#FFE055]' : ''}`}
        >
          <svg
            width={snapshot.isTouch ? 40 : 28}
            height={snapshot.isTouch ? 40 : 28}
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            {/* Friendly cartoon waving hand icon */}
            <path
              d="M10.5 16V8.5C10.5 7.4 11.4 6.5 12.5 6.5C13.6 6.5 14.5 7.4 14.5 8.5V14.5M14.5 14V6.5C14.5 5.4 15.4 4.5 16.5 4.5C17.6 4.5 18.5 5.4 18.5 6.5V14.5M18.5 14.5V8C18.5 6.9 19.4 6 20.5 6C21.6 6 22.5 6.9 22.5 8V16.5M22.5 15V11.5C22.5 10.4 23.4 9.5 24.5 9.5C25.6 9.5 26.5 10.4 26.5 11.5V19C26.5 24 22.5 27.5 17.5 27.5H15.5C11.5 27.5 8.5 24.5 7.2 20.5L5.8 16.2C5.4 15 6.1 13.8 7.3 13.5C8.4 13.2 9.5 13.8 10 14.8L10.5 16Z"
              fill="#FFFDF5"
              stroke="#663614"
              strokeWidth="2.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          tabIndex={-1}
          data-ui-interactive="true"
          aria-label="Jump"
          onPointerDown={(e) => {
            e.currentTarget.blur();
            onJumpDown();
          }}
          onPointerUp={onJumpUp}
          onPointerCancel={onJumpUp}
          onPointerLeave={onJumpUp}
          className={`pointer-events-auto flex cursor-pointer items-center justify-center rounded-full border-[4px] border-[#0E4F5C] bg-[#1FD1DF] shadow-[0_6px_0_#0F7D8F,0_10px_20px_rgba(7,37,64,0.32)] transition-transform duration-150 hover:scale-105 active:translate-y-1 ${
            snapshot.isTouch ? 'h-20 w-20' : 'h-14 w-14'
          }`}
        >
          <svg
            width={snapshot.isTouch ? 38 : 26}
            height={snapshot.isTouch ? 38 : 26}
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M16 5L26 16H20V26H12V16H6L16 5Z"
              fill="#FFFDF5"
              stroke="#0E4F5C"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Collapsible ?debug Biome Teleport & Perf Bar (ONLY when ?debug is in URL) */}
      {debugMode && (
        <div
          data-ui-interactive="true"
          className="pointer-events-auto fixed top-4 left-4 max-w-md rounded-xl border border-white/25 bg-[#0a2338]/90 p-2.5 text-xs text-white shadow-lg"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono tabular-nums text-[11px] text-cyan-200">
              {snapshot.biome} · {snapshot.perf.calls} calls · {snapshot.perf.fps} fps
            </span>
            <button
              type="button"
              onClick={() => setDebugOpen((v) => !v)}
              className="rounded bg-white/15 px-2 py-0.5 text-[11px] font-medium hover:bg-white/25"
            >
              {debugOpen ? 'Hide' : 'Biomes'}
            </button>
          </div>
          {debugOpen && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ANCHOR_ORDER.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onTeleport(id)}
                  className="rounded bg-cyan-600/80 px-2 py-1 text-[11px] font-medium hover:bg-cyan-500"
                >
                  {WORLD_ANCHORS[id].label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTestReport(onRunSelfTest())}
                className="rounded bg-amber-500 px-2 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
              >
                Self-Test
              </button>
            </div>
          )}
          {debugOpen && testReport && (
            <div className="mt-2 border-t border-white/15 pt-1.5 font-mono text-[10px]">
              <div className={testReport.passed ? 'text-emerald-300' : 'text-rose-300'}>
                {testReport.passed ? 'PASS' : 'FAIL'} ({testReport.perf.calls} calls)
              </div>
              {testReport.checks.map((c) => (
                <div key={c.name} className={c.passed ? 'text-white/80' : 'text-rose-300'}>
                  {c.passed ? 'OK' : 'X'} {c.name}: {c.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
