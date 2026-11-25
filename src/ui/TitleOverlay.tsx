import { useEffect } from 'react';

interface TitleOverlayProps {
  onPlay: () => void;
  buildStamp: string;
}

export function TitleOverlay({ onPlay, buildStamp }: TitleOverlayProps) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onPlay();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onPlay]);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col items-center justify-between px-6 py-8">
      {/* Upper negative-space bespoke pirate-island SVG crest (zero reading required) */}
      <div className="mt-2 flex flex-col items-center">
        <svg
          width="184"
          height="118"
          viewBox="0 0 184 118"
          fill="none"
          aria-hidden="true"
          className="drop-shadow-[0_10px_18px_rgba(9,45,78,0.45)]"
        >
          {/* Ship Helm Wheel Outer Ring */}
          <circle cx="92" cy="58" r="42" stroke="#5A3217" strokeWidth="11" />
          <circle cx="92" cy="58" r="42" stroke="#C87A35" strokeWidth="6" />
          {/* 8 Helm Handles */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 92 58)`}>
              <rect x="88" y="4" width="8" height="16" rx="4" fill="#5A3217" />
              <rect x="89.5" y="5.5" width="5" height="12" rx="2.5" fill="#E39D49" />
            </g>
          ))}
          {/* Turquoise Sunlit Medallion Inside Wheel */}
          <circle cx="92" cy="58" r="34" fill="#17C3D6" stroke="#F8D264" strokeWidth="3.5" />
          {/* Golden Sun Disc */}
          <circle cx="108" cy="42" r="10" fill="#FFE052" />
          {/* Mini Island & Palm Silhouette */}
          <path d="M62 72 Q92 54 122 72 L120 79 Q92 86 64 79 Z" fill="#F2C864" />
          <path d="M68 69 Q92 55 116 69 Z" fill="#6FD126" />
          {/* Cute Pirate Skull Badge at Bottom Rim */}
          <circle cx="92" cy="84" r="13" fill="#5A3217" />
          <circle cx="92" cy="84" r="10.5" fill="#F4E5C8" />
          <path d="M82 81 Q92 71 102 81 L101 76 Q92 70 83 76 Z" fill="#D13B28" />
          <circle cx="88" cy="84" r="2.2" fill="#3B2416" />
          <circle cx="96" cy="84" r="2.6" fill="#3B2416" />
          <path d="M84 78 L99 85" stroke="#3B2416" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>

      {/* Giant joyful icon-only Play button anchored in lower-center negative space */}
      <div className="mb-10 flex flex-col items-center">
        <button
          type="button"
          data-start="true"
          data-ui-interactive="true"
          aria-label="Play"
          onClick={(e) => {
            e.currentTarget.blur();
            onPlay();
          }}
          className="pointer-events-auto group relative flex h-28 w-28 cursor-pointer items-center justify-center rounded-full border-[6px] border-[#663614] bg-[#FFB81C] shadow-[0_12px_0_#9E550A,0_20px_36px_rgba(6,38,68,0.45)] transition-transform duration-150 ease-out hover:scale-105 active:translate-y-2 active:shadow-[0_4px_0_#9E550A,0_10px_20px_rgba(6,38,68,0.4)] focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-1.5 rounded-full border-2 border-[#FFF2A6]/80"
          />
          <svg
            width="52"
            height="52"
            viewBox="0 0 48 48"
            fill="none"
            aria-hidden="true"
            className="ml-2 transition-transform duration-150 group-hover:scale-105"
          >
            <path
              d="M11 8.5C11 5.9 13.85 4.35 16.05 5.75L40.4 21.25C42.4 22.5 42.4 25.5 40.4 26.75L16.05 42.25C13.85 43.65 11 42.1 11 39.5V8.5Z"
              fill="#FFFDF5"
              stroke="#663614"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Subtle corner build-timestamp stamp (unboxed metadata, zero pill) */}
      <div className="pointer-events-none fixed bottom-3 left-4 text-[11px] font-medium tracking-wide text-white/75 [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
        {buildStamp}
      </div>
    </div>
  );
}
