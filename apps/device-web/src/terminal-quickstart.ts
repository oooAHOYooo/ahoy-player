const terminalCommand = "cd ~/ahoyMp3 && npm run ahoy -- scan ~/Music && npm run ahoy -- tui";

export function mountTerminalQuickstart() {
  const host = document.createElement("aside");
  host.className = "ahoy-terminal-quickstart";
  host.innerHTML = `
    <button class="ahoy-terminal-quickstart__trigger" type="button" aria-expanded="false">
      <span aria-hidden="true">›_</span> Use in Terminal
    </button>
    <section class="ahoy-terminal-quickstart__panel" hidden aria-label="Use Ahoy in Terminal">
      <button class="ahoy-terminal-quickstart__close" type="button" aria-label="Close terminal instructions">×</button>
      <p>AHOYCLI</p>
      <h2>Your music, in a terminal.</h2>
      <span>Scan your Music folder, then browse a waveform deck and play one local track at a time. Works in macOS Terminal with no extra audio package.</span>
      <code>${terminalCommand}</code>
      <button class="ahoy-terminal-quickstart__copy" type="button">Copy command</button>
      <small>Linux: install <b>mpv</b>, VLC, or FFmpeg first.</small>
    </section>`;
  document.body.append(host);

  let cardAttempts = 12;
  const addLibraryCard = () => {
    const hero = document.querySelector(".hero-row");
    const content = document.querySelector(".content");
    if (document.querySelector(".ahoy-terminal-card")) return;
    if (!hero && !content) {
      if (cardAttempts-- > 0) requestAnimationFrame(addLibraryCard);
      return;
    }
    const card = document.createElement("section");
    card.className = "ahoy-terminal-card";
    card.setAttribute("aria-label", "AHOYCLI terminal player");
    card.innerHTML = `
      <div><p>AHOYCLI / LOCAL TERMINAL PLAYER</p><h2>Take your library to the terminal.</h2><span>Browse a waveform deck, play one local track at a time, and keep the controls under your hands.</span><div class="ahoy-terminal-card__features"><span>WAVEFORM DECK</span><span>ONE TRACK</span><span>↑↓ + ENTER</span></div></div>
      <pre class="ahoy-terminal-card__preview" aria-label="Terminal player preview">▶ NOW PLAYING
▂▅▃▇▄█▃▆▂▇▅█▄▆▃▇
one track at a time</pre>
      <div class="ahoy-terminal-card__command"><code>${terminalCommand}</code><button type="button" data-terminal-copy>Copy for Terminal</button></div>`;
    if (hero) hero.insertAdjacentElement("afterend", card);
    else content?.prepend(card);
    card.querySelector<HTMLButtonElement>("[data-terminal-copy]")!.addEventListener("click", () => copyCommand(card.querySelector<HTMLButtonElement>("[data-terminal-copy]")!));
  };
  requestAnimationFrame(addLibraryCard);

  const trigger = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__trigger")!;
  const panel = host.querySelector<HTMLElement>(".ahoy-terminal-quickstart__panel")!;
  const close = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__close")!;
  const copy = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__copy")!;
  const setOpen = (open: boolean) => { panel.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); };
  trigger.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  copy.addEventListener("click", () => copyCommand(copy));
}

async function copyCommand(button: HTMLButtonElement) {
    try {
      await navigator.clipboard.writeText(terminalCommand);
      const initialText = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = initialText; }, 1400);
    } catch {
      button.textContent = "Copy: command shown above";
    }
}
