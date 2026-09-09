#!/usr/bin/env node
// Optional runner: the guardian calls this only when the project's existing
// Node environment can import Playwright. It never installs a browser or npm package.
const [baseUrl, outputDir] = process.argv.slice(2);
let playwright;
try { playwright = await import("playwright"); } catch { process.exit(2); }
const { chromium } = playwright;
const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  for (const [name, width, height] of [["desktop", 1440, 1000], ["mobile", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("console", (message) => { if (message.type() === "error") errors.push(`${name}: console ${message.text()}`); });
    page.on("requestfailed", (request) => errors.push(`${name}: request failed ${request.url()}`));
    await page.goto(`${baseUrl}/player.html`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Play" }).click();
    await page.getByRole("button", { name: "Next" }).click();
    await page.getByLabel("Playback position").fill("1000");
    await page.getByLabel("Volume").fill("50");
    await page.getByText("Queue", { exact: true }).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (overflow) errors.push(`${name}: horizontal overflow`);
    await page.screenshot({ path: `${outputDir}/web-${name}.png`, fullPage: true });
    await page.close();
  }
} finally { await browser.close(); }
if (errors.length) { console.error(errors.join("\n")); process.exit(1); }
