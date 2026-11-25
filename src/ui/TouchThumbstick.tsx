import { useRef, useState } from 'react';

interface TouchThumbstickProps {
  onMove: (x: number, y: number) => void;
}

const MAX_RADIUS = 44;

export function TouchThumbstick({ onMove }: TouchThumbstickProps) {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const updateFromClient = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > MAX_RADIUS) {
      dx = (dx / dist) * MAX_RADIUS;
      dy = (dy / dist) * MAX_RADIUS;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / MAX_RADIUS, dy / MAX_RADIUS);
  };

  const reset = () => {
    pointerIdRef.current = null;
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={baseRef}
      data-ui-interactive="true"
      aria-label="Move stick"
      onPointerDown={(e) => {
        if (pointerIdRef.current !== null) return;
        pointerIdRef.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        updateFromClient(e.clientX, e.clientY);
      }}
      onPointerUp={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        reset();
      }}
      onPointerCancel={(e) => {
        if (pointerIdRef.current !== e.pointerId) return;
        reset();
      }}
      className="pointer-events-auto relative flex h-32 w-32 items-center justify-center rounded-full border-4 border-white/75 bg-[#0b4b75]/45 shadow-[0_8px_20px_rgba(5,32,56,0.35)]"
    >
      <div
        className="h-14 w-14 rounded-full border-4 border-[#663614] bg-[#FFD24C] shadow-[0_4px_0_#A66114]"
        style={{
          transform: `translate3d(${knob.x}px, ${knob.y}px, 0)`,
        }}
      />
    </div>
  );
}
