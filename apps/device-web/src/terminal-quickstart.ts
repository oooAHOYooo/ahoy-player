const terminalCommand = "npm run ahoy -- scan ~/Music && npm run ahoy -- tui";

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
      <span>Scan your Music folder, then browse and play locally. Works in macOS Terminal with no extra audio package.</span>
      <code>${terminalCommand}</code>
      <button class="ahoy-terminal-quickstart__copy" type="button">Copy command</button>
      <small>Linux: install <b>mpv</b>, VLC, or FFmpeg first.</small>
    </section>`;
  document.body.append(host);

  const trigger = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__trigger")!;
  const panel = host.querySelector<HTMLElement>(".ahoy-terminal-quickstart__panel")!;
  const close = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__close")!;
  const copy = host.querySelector<HTMLButtonElement>(".ahoy-terminal-quickstart__copy")!;
  const setOpen = (open: boolean) => { panel.hidden = !open; trigger.setAttribute("aria-expanded", String(open)); };
  trigger.addEventListener("click", () => setOpen(panel.hidden));
  close.addEventListener("click", () => setOpen(false));
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(terminalCommand);
      copy.textContent = "Copied";
      window.setTimeout(() => { copy.textContent = "Copy command"; }, 1400);
    } catch {
      copy.textContent = "Copy: command shown above";
    }
  });
}
