import { useRef, type PointerEvent, type WheelEvent } from "react";
import type { DialAction } from "@ahoy/player-core";

export type AhoyDialProps = {
  dispatch: (action: DialAction) => void;
  isPlaying?: boolean;
  size?: "compact" | "full" | "tv";
};

export function AhoyDial({ dispatch, isPlaying = false, size = "full" }: AhoyDialProps) {
  const lastAngle = useRef<number>();

  function angleFor(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    lastAngle.current = angleFor(event);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || lastAngle.current === undefined) return;
    const nextAngle = angleFor(event);
    let delta = nextAngle - lastAngle.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    if (Math.abs(delta) >= 17) {
      dispatch({ type: "turn", direction: delta > 0 ? 1 : -1, source: event.pointerType === "touch" ? "touch" : "pointer" });
      lastAngle.current = nextAngle;
    }
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    dispatch({ type: "turn", direction: event.deltaY > 0 ? 1 : -1, source: "pointer" });
  }

  return (
    <div className={`ahoy-dial ahoy-dial--${size}`} aria-label="Ahoy Dial">
      <div
        className="ahoy-dial__ring"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => { lastAngle.current = undefined; }}
        onPointerCancel={() => { lastAngle.current = undefined; }}
        onWheel={handleWheel}
      >
        <span className="ahoy-dial__tick ahoy-dial__tick--a" />
        <span className="ahoy-dial__tick ahoy-dial__tick--b" />
        <span className="ahoy-dial__tick ahoy-dial__tick--c" />
        <span className="ahoy-dial__tick ahoy-dial__tick--d" />
      </div>
      <DialButton className="ahoy-dial__menu" label="Menu" action="menu" dispatch={dispatch} />
      <DialButton className="ahoy-dial__back" label="Back" action="back" dispatch={dispatch} />
      <DialButton className="ahoy-dial__next" label="Next" action="next" dispatch={dispatch} />
      <DialButton className="ahoy-dial__play" label={isPlaying ? "Pause" : "Play"} action="play" dispatch={dispatch} />
      <button
        className="ahoy-dial__select"
        type="button"
        aria-label="Select"
        data-dial-action="select"
        onClick={() => dispatch({ type: "select", source: "pointer" })}
      >
        <span />
      </button>
    </div>
  );
}

function DialButton({
  className,
  label,
  action,
  dispatch
}: {
  className: string;
  label: string;
  action: "menu" | "back" | "next" | "play";
  dispatch: (action: DialAction) => void;
}) {
  return (
    <button
      className={className}
      type="button"
      data-dial-action={action}
      onClick={() => dispatch({ type: action, source: "pointer" })}
    >
      {label}
    </button>
  );
}
