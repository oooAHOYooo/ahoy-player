const barHeights = [24, 42, 63, 35, 78, 56, 30, 68, 91, 45, 72, 38, 58, 84, 48, 66, 32, 75, 55, 88, 41, 64, 29, 70, 52, 82, 37, 61, 93, 46, 69, 33];

/** Turns the player dock's visual meter into an accessible, clickable seek waveform. */
export function mountWaveformPlayer() {
  let attempts = 20;
  const mount = () => {
    const waveform = document.querySelector<HTMLElement>(".waveform");
    if (!waveform) {
      if (attempts-- > 0) requestAnimationFrame(mount);
      return;
    }
    if (waveform.getAttribute("aria-hidden") !== "false") waveform.setAttribute("aria-hidden", "false");
    if (!waveform.querySelector(".ahoy-waveform-player")) {
      const player = document.createElement("div");
      player.className = "ahoy-waveform-player";
      player.setAttribute("role", "group");
      player.setAttribute("aria-label", "Waveform seek");
      player.innerHTML = barHeights.map((height, index) => `<button type="button" data-position="${index}" aria-label="Seek to ${Math.round(((index + 1) / barHeights.length) * 100)} percent"><i style="height:${height}%"></i></button>`).join("");
      waveform.append(player);
      player.addEventListener("click", (event) => seekFromWaveform(event, player));
    }
    // React owns the dock markup and may replace our enhancement after a state
    // update. Observe only this small meter and restore the enhancement then.
    new MutationObserver(() => {
      if (!waveform.querySelector(".ahoy-waveform-player")) mount();
    }).observe(waveform, { childList: true, attributes: true, attributeFilter: ["aria-hidden"] });
  };
  requestAnimationFrame(mount);
}

function seekFromWaveform(event: Event, player: HTMLElement) {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-position]");
  const position = Number(target?.dataset.position);
  const range = document.querySelector<HTMLInputElement>('input[aria-label="Playback position"]');
  if (!Number.isFinite(position) || !range) return;
  const nextValue = Math.round((position / Math.max(1, barHeights.length - 1)) * Number(range.max));
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(range, String(nextValue));
  range.dispatchEvent(new Event("input", { bubbles: true }));
  player.querySelectorAll("button").forEach((bar, index) => bar.classList.toggle("is-passed", index <= position));
}
