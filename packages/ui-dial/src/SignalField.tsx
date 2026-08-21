import { useMemo, useRef, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";

export type SignalTheme = {
  field: string;
  accent: string;
  ink: string;
  pale: string;
};

const signalThemes: SignalTheme[] = [
  { field: "#b8c4bd", accent: "#487e86", ink: "#465d5b", pale: "#e1e4d9" },
  { field: "#afbeb2", accent: "#e76b48", ink: "#4d625c", pale: "#e7e1d5" },
  { field: "#c4c6ad", accent: "#ad604b", ink: "#5d6150", pale: "#ebe6d5" },
  { field: "#c2bcae", accent: "#7961a6", ink: "#605c57", pale: "#e7dfd3" }
];

export function signalThemeFor(seed?: string): SignalTheme {
  const value = seed ?? "ahoy";
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  return signalThemes[Math.abs(hash) % signalThemes.length];
}

export function SignalField({
  progress,
  isPlaying,
  onSeek,
  onToggle,
  theme
}: {
  progress: number;
  isPlaying: boolean;
  onSeek: (progress: number) => void;
  onToggle: () => void;
  theme?: SignalTheme;
}) {
  const activePointer = useRef<number>();
  const safeProgress = Math.min(1, Math.max(0, progress));
  const beaconPosition = useMemo(() => pointOnOrbit(safeProgress), [safeProgress]);

  function seekFromPointer(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.39);
    const y = (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.39);
    const angle = Math.atan2(y, x);
    const next = ((angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2);
    onSeek(next);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    activePointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromPointer(event);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId) return;
    seekFromPointer(event);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = 0.05;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") onSeek(safeProgress - step);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") onSeek(safeProgress + step);
    else if (event.key === "Home") onSeek(0);
    else if (event.key === "End") onSeek(1);
    else if (event.key === " " || event.key === "Enter") onToggle();
    else return;
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      className={`signal-field${isPlaying ? " is-playing" : ""}`}
      style={themeStyle(theme)}
      role="slider"
      tabIndex={0}
      aria-label="Signal Field playback position"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(safeProgress * 100)}
      aria-valuetext={`${Math.round(safeProgress * 100)} percent through track`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => { activePointer.current = undefined; }}
      onPointerCancel={() => { activePointer.current = undefined; }}
      onKeyDown={onKeyDown}
    >
      <span className="signal-field__axis" />
      <svg className="signal-field__wake" viewBox="0 0 100 100" aria-hidden="true">
        <ellipse className="signal-field__wake-base" cx="50" cy="50" rx="38" ry="36" pathLength="100" />
        <ellipse
          className="signal-field__wake-trace"
          cx="50"
          cy="50"
          rx="38"
          ry="36"
          pathLength="100"
          style={{ strokeDasharray: `${safeProgress * 100} 100` }}
        />
      </svg>
      <span className="signal-field__orbit signal-field__orbit--outer" />
      <span className="signal-field__orbit signal-field__orbit--inner" />
      <span
        className="signal-field__beacon"
        style={{ left: `${beaconPosition.x}%`, top: `${beaconPosition.y}%` } as CSSProperties}
        aria-hidden="true"
      />
      <button
        className="signal-field__core"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onToggle}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "PAUSE" : "PLAY"}
      </button>
      <span className="signal-field__hint" aria-hidden="true">DRAG THE BEACON</span>
    </div>
  );
}

function themeStyle(theme?: SignalTheme): CSSProperties | undefined {
  if (!theme) return undefined;
  return {
    "--signal-field": theme.field,
    "--signal-accent": theme.accent,
    "--signal-ink": theme.ink,
    "--signal-pale": theme.pale
  } as CSSProperties;
}

function pointOnOrbit(progress: number) {
  const angle = progress * Math.PI * 2 - Math.PI / 2;
  return {
    x: 50 + Math.cos(angle) * 38,
    y: 50 + Math.sin(angle) * 36
  };
}
