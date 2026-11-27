import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from './engine/GameEngine';
import type { AnchorId, HudSnapshot } from './types/game';
import { CaptureGallery } from './ui/CaptureGallery';
import { GameHud } from './ui/GameHud';
import { TitleOverlay } from './ui/TitleOverlay';

const BUILD_STAMP = 'B1 · 2026.11.23';

const INITIAL_SNAPSHOT: HudSnapshot = {
  phase: 'title',
  biome: 'harbor',
  muted: false,
  isTouch: false,
  isWaving: false,
  inShallowWater: false,
  hasInteractable: false,
  interactableIcon: null,
  playerX: -6,
  playerY: 1.4,
  playerZ: 122,
  perf: {
    calls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
    fps: 60,
    isSoftwareGl: false,
  },
};

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [snapshot, setSnapshot] = useState<HudSnapshot>(INITIAL_SNAPSHOT);
  const queryFlags = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      debug: params.has('debug'),
      autostart: params.get('autostart') === '1',
      runTest: params.has('test'),
      gallery: params.has('gallery'),
    };
  }, []);
  const [galleryOpen, setGalleryOpen] = useState(() => queryFlags.gallery);

  // Mount WebGLRenderer & GameEngine exactly once; never tear down on React state updates
  useEffect(() => {
    const host = mountRef.current;
    if (!host) return;

    const engine = new GameEngine(host, (nextSnap) => {
      setSnapshot(nextSnap);
    });
    engineRef.current = engine;

    if (queryFlags.autostart) {
      engine.startGame();
    }

    let testTimer = 0;
    if (queryFlags.runTest) {
      const startedAt = performance.now();
      const pollReady = () => {
        const ready = engine.getDinoStats().ready;
        const timedOut = performance.now() - startedAt > 8000;
        if (ready || timedOut) {
          const report = engine.runSelfTest();
          (window as unknown as { __SONNY_TEST_REPORT__?: unknown }).__SONNY_TEST_REPORT__ = report;
          console.info('[SonnyIsland ?test]', report);
        } else {
          testTimer = window.setTimeout(pollReady, 250);
        }
      };
      testTimer = window.setTimeout(pollReady, 500);
    }

    return () => {
      window.clearTimeout(testTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [queryFlags.autostart, queryFlags.runTest]);

  const handlePlay = useCallback(() => {
    engineRef.current?.startGame();
  }, []);

  const handleToggleMute = useCallback(() => {
    engineRef.current?.toggleMute();
  }, []);

  const handleToggleGallery = useCallback(() => {
    setGalleryOpen((open) => !open);
  }, []);

  const handleWave = useCallback(() => {
    engineRef.current?.triggerWave();
  }, []);

  const handleJumpDown = useCallback(() => {
    engineRef.current?.input.setTouchJump(true);
  }, []);

  const handleJumpUp = useCallback(() => {
    engineRef.current?.input.setTouchJump(false);
  }, []);

  const handleTouchStick = useCallback((x: number, y: number) => {
    engineRef.current?.input.setTouchStick(x, y);
  }, []);

  const handleTeleport = useCallback((anchor: AnchorId) => {
    engineRef.current?.teleportToBiome(anchor);
  }, []);

  const handleRunSelfTest = useCallback(() => {
    return engineRef.current?.runSelfTest() ?? null;
  }, []);

  return (
    <main className="relative h-full w-full overflow-hidden bg-[#1d9bf0]">
      {/* Isolated WebGL canvas host */}
      <div
        ref={mountRef}
        data-testid="game-canvas-host"
        className="fixed inset-0 h-full w-full"
      />

      {snapshot.phase === 'title' ? (
        <TitleOverlay onPlay={handlePlay} buildStamp={BUILD_STAMP} />
      ) : (
        <GameHud
          snapshot={snapshot}
          debugMode={queryFlags.debug}
          onToggleMute={handleToggleMute}
          onToggleGallery={handleToggleGallery}
          onWave={handleWave}
          onJumpDown={handleJumpDown}
          onJumpUp={handleJumpUp}
          onTouchStick={handleTouchStick}
          onTeleport={handleTeleport}
          onRunSelfTest={handleRunSelfTest}
        />
      )}

      {galleryOpen && <CaptureGallery onClose={() => setGalleryOpen(false)} />}
    </main>
  );
}
