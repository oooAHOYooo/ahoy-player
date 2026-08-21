import { useEffect, useRef } from "react";
import { mapKeyboardToDialAction, type DialAction, type InputSource } from "@ahoy/player-core";

export function useAhoyInput(
  dispatch: (action: DialAction) => void,
  options: { keyboardSource?: InputSource; gamepad?: boolean } = {}
) {
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const source = options.keyboardSource ?? "keyboard";
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      const action = mapKeyboardToDialAction(event.key, source);
      if (!action) return;
      event.preventDefault();
      dispatchRef.current(action);
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [options.keyboardSource]);

  useEffect(() => {
    if (options.gamepad === false || typeof navigator.getGamepads !== "function") return;
    let frame = 0;
    const pressed = new Set<string>();

    function poll() {
      const pads = navigator.getGamepads();
      for (const pad of pads) {
        if (!pad) continue;
        const bindings: Array<[string, boolean, DialAction]> = [
          ["up", Boolean(pad.buttons[12]?.pressed || pad.axes[1] < -0.65), { type: "turn", direction: -1, source: "gamepad" }],
          ["down", Boolean(pad.buttons[13]?.pressed || pad.axes[1] > 0.65), { type: "turn", direction: 1, source: "gamepad" }],
          ["left", Boolean(pad.buttons[14]?.pressed || pad.axes[0] < -0.65), { type: "turn", direction: -1, source: "gamepad" }],
          ["right", Boolean(pad.buttons[15]?.pressed || pad.axes[0] > 0.65), { type: "turn", direction: 1, source: "gamepad" }],
          ["select", Boolean(pad.buttons[0]?.pressed), { type: "select", source: "gamepad" }],
          ["back", Boolean(pad.buttons[1]?.pressed), { type: "back", source: "gamepad" }],
          ["menu", Boolean(pad.buttons[2]?.pressed), { type: "menu", source: "gamepad" }],
          ["next", Boolean(pad.buttons[3]?.pressed), { type: "next", source: "gamepad" }],
          ["play", Boolean(pad.buttons[9]?.pressed), { type: "play", source: "gamepad" }]
        ];
        for (const [name, isPressed, action] of bindings) {
          const key = `${pad.index}:${name}`;
          if (isPressed && !pressed.has(key)) dispatchRef.current(action);
          if (isPressed) pressed.add(key); else pressed.delete(key);
        }
      }
      frame = requestAnimationFrame(poll);
    }

    frame = requestAnimationFrame(poll);
    return () => cancelAnimationFrame(frame);
  }, [options.gamepad]);
}
