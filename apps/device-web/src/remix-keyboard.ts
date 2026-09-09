const remixKeys = ["q", "w", "e", "r", "t", "y", "u", "i"];
const frequencies = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25];

/** A small opt-in keyboard layer for the published player. It never starts a second music track. */
export function mountRemixKeyboard() {
  let attempts = 16;
  const mount = () => {
    if (document.querySelector(".synth-keyboard, .ahoy-remix-keyboard")) return;
    const deck = document.querySelector(".player-deck");
    if (!deck) {
      if (attempts-- > 0) requestAnimationFrame(mount);
      return;
    }
    const panel = document.createElement("section");
    panel.className = "ahoy-remix-keyboard";
    panel.setAttribute("aria-label", "Keyboard remix mode");
    panel.innerHTML = `<div><span>REMIX MODE</span><strong>Play keys over the current track</strong><small>One music track stays active; these are short local synth notes.</small></div><button type="button" aria-pressed="false">Enable keys</button><p>${remixKeys.map((key) => `<kbd>${key.toUpperCase()}</kbd>`).join("")}</p>`;
    deck.insertAdjacentElement("afterend", panel);
    const toggle = panel.querySelector<HTMLButtonElement>("button")!;
    let context: AudioContext | undefined;
    let enabled = false;
    const isMusicPlaying = () => document.querySelector('button[aria-label="Pause"]') !== null;
    const refresh = () => {
      const playable = isMusicPlaying();
      toggle.disabled = !playable;
      if (!playable && enabled) { enabled = false; toggle.setAttribute("aria-pressed", "false"); toggle.textContent = "Enable keys"; }
    };
    toggle.addEventListener("click", () => {
      if (!isMusicPlaying()) return;
      enabled = !enabled;
      toggle.setAttribute("aria-pressed", String(enabled));
      toggle.textContent = enabled ? "Keys active" : "Enable keys";
    });
    window.addEventListener("keydown", (event) => {
      const key = event.key.toLowerCase();
      const index = remixKeys.indexOf(key);
      const target = event.target as HTMLElement | null;
      if (!enabled || index < 0 || event.repeat || target?.matches("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      const Context = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      const audio = context ??= new Context();
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(frequencies[index], now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now); oscillator.stop(now + 0.45);
    });
    new MutationObserver(refresh).observe(deck, { childList: true, subtree: true, attributes: true });
    refresh();
  };
  requestAnimationFrame(mount);
}
