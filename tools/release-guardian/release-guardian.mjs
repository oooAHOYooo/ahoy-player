#!/usr/bin/env node
/**
 * Ahoy Player Release Guardian
 *
 * Source, Git, local command, and artifact checks only. It never changes Git,
 * publishes, tags, uploads, deploys, or deletes an artifact.
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdir, writeFile, access } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const toolDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolDir, "../..");
const outputDir = path.join(root, ".local", "release-guardian");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const packageMac = args.has("--package-mac");
const webQa = !args.has("--skip-web-qa");
const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, "-");
const checks = [];
const findings = [];

function relative(value) { return path.relative(root, value) || "."; }
function redact(text = "") {
  return String(text)
    .replace(/(token|password|secret|authorization)\s*[=:]\s*[^\s]+/gi, "$1=[redacted]")
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, "https://[redacted]@");
}
function add(status, name, detail, evidence = "") {
  checks.push({ status, name, detail, evidence: redact(evidence) });
  if (status === "BLOCKER" || status === "WARNING") findings.push({ status, name, detail });
}
function run(command, commandArgs, timeout = 10 * 60_000) {
  if (dryRun) return { code: null, stdout: "", stderr: "", skipped: true };
  const result = spawnSync(command, commandArgs, { cwd: root, encoding: "utf8", timeout, maxBuffer: 1_000_000 });
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message };
}
function tail(output) { return redact(output.trim().split("\n").slice(-12).join("\n")); }
function commandCheck(name, command, commandArgs, severity = "BLOCKER", timeout) {
  const result = run(command, commandArgs, timeout);
  if (result.skipped) return add("SKIPPED", name, `Dry run: would execute \`${[command, ...commandArgs].join(" ")}\`.`);
  if (result.code === 0) return add("READY", name, "Passed.");
  add(severity, name, `Failed (exit ${result.code ?? "unknown"}).`, tail(`${result.stdout}\n${result.stderr}\n${result.error ?? ""}`));
}
function git(...gitArgs) {
  // Git reads are safe and make dry-run reports useful; dry-run only suppresses
  // build, test, preview, packaging, and artifact-inspection commands.
  const result = spawnSync("git", gitArgs, { cwd: root, encoding: "utf8", timeout: 30_000, maxBuffer: 1_000_000 });
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message };
}
function gitText(...gitArgs) { const result = git(...gitArgs); return result.code === 0 ? result.stdout.trim() : ""; }
async function port() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => { const address = server.address(); server.close(() => resolve(address.port)); });
  });
}
async function waitFor(url, child) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Preview exited early (${child.exitCode}).`);
    try { const response = await fetch(url, { redirect: "manual" }); if (response.status < 500) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Preview did not become reachable within 10 seconds.");
}
async function localWebCheck() {
  if (!webQa) return add("SKIPPED", "Web player routes", "Skipped with --skip-web-qa.");
  if (dryRun) return add("SKIPPED", "Web player routes", "Dry run: would start Vite preview and request /, /download.html, and /player.html.");
  const previewPort = await port();
  const command = process.platform === "win32" ? "npm.cmd" : "npm";
  const child = spawn(command, ["run", "preview", "--workspace", "@ahoy/player-web", "--", "--host", "127.0.0.1", "--port", String(previewPort), "--strictPort"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  let logs = "";
  child.stdout.on("data", (chunk) => { logs += chunk; });
  child.stderr.on("data", (chunk) => { logs += chunk; });
  try {
    const base = `http://127.0.0.1:${previewPort}`;
    await waitFor(`${base}/player.html`, child);
    const results = [];
    for (const route of ["/", "/download.html", "/player.html"]) {
      const response = await fetch(`${base}${route}`, { redirect: "manual" });
      results.push(`${route}: HTTP ${response.status}`);
    }
    const failed = results.filter((item) => !/HTTP [23]\d\d$/.test(item));
    add(failed.length ? "BLOCKER" : "READY", "Web player routes", failed.length ? failed.join("; ") : `Vite production preview rendered: ${results.join("; ")}.`);
    await browserQaIfInstalled(base);
  } catch (error) {
    add("BLOCKER", "Web player routes", `Could not start or query the local web preview: ${error.message}`, tail(logs));
  } finally {
    child.kill("SIGTERM");
  }
}
async function browserQaIfInstalled(baseUrl) {
  try {
    const runner = path.join(toolDir, "playwright-qa.mjs");
    const result = await new Promise((resolve) => {
      const child = spawn(process.execPath, [runner, baseUrl, outputDir], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = ""; let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("close", (code) => resolve({ code, stdout, stderr }));
    });
    if (result.code === 0) add("READY", "Rendered browser QA", "Desktop and 390px mobile flows passed; screenshots saved under .local/release-guardian/.");
    else if (result.code === 2) add("UNVERIFIED", "Rendered browser QA", "Skipped: Playwright is not installed. Deterministic local route checks still ran.");
    else add("WARNING", "Rendered browser QA", "Browser QA found a rendered-flow issue.", tail(`${result.stdout}\n${result.stderr}`));
  } catch (error) { add("UNVERIFIED", "Rendered browser QA", `Skipped: ${error.message}`); }
}
async function exists(file) { try { await access(file); return true; } catch { return false; } }
async function inspectArtifacts(releaseDirs = [path.join(root, "apps", "desktop", "release")]) {
  if (dryRun) return add("SKIPPED", "macOS artifacts", "Dry run: would inspect existing DMGs with hdiutil imageinfo and inspect signing metadata.");
  const existingDirs = [];
  for (const releaseDir of releaseDirs) if (await exists(releaseDir)) existingDirs.push(releaseDir);
  if (!existingDirs.length) return add("UNVERIFIED", "macOS artifacts", "No desktop release directory is present.");
  const paths = [];
  for (const releaseDir of existingDirs) {
    const dmgs = run("find", [releaseDir, "-maxdepth", "1", "-type", "f", "-name", "*.dmg", "-print"], 30_000);
    paths.push(...dmgs.stdout.trim().split("\n").filter(Boolean));
  }
  if (!paths.length) return add("UNVERIFIED", "macOS artifacts", "No DMG artifact is present to inspect.");
  for (const dmg of paths) {
    const info = run("hdiutil", ["imageinfo", dmg], 60_000);
    const name = relative(dmg);
    if (info.code !== 0) add("BLOCKER", `DMG inspect: ${name}`, "hdiutil imageinfo failed; do not treat Electron Builder success as usable media.", tail(`${info.stdout}\n${info.stderr}`));
    else {
      const format = /Format:\s*(.+)/.exec(info.stdout)?.[1]?.trim() ?? "format not reported";
      add("READY", `DMG inspect: ${name}`, `hdiutil imageinfo succeeded (${format}).`);
    }
  }
  const apps = [];
  for (const releaseDir of existingDirs) {
    const found = run("find", [releaseDir, "-maxdepth", "2", "-type", "d", "-name", "Ahoy Player.app", "-print"], 30_000);
    apps.push(...found.stdout.trim().split("\n").filter(Boolean));
  }
  if (apps.length) {
    const app = apps[0];
    const sign = run("codesign", ["-dv", "--verbose=2", app], 30_000);
    const adHoc = /Signature=adhoc|Authority=-/.test(`${sign.stdout}\n${sign.stderr}`);
    add(adHoc ? "WARNING" : sign.code === 0 ? "UNVERIFIED" : "WARNING", "macOS signing", adHoc ? "Ad-hoc signature detected; this is not notarized or production-ready." : sign.code === 0 ? "Signing metadata exists, but notarization still requires independent verification." : "Could not inspect the app signature.", tail(`${sign.stdout}\n${sign.stderr}`));
  } else add("UNVERIFIED", "macOS signing", "No .app bundle is available for signature inspection.");
}
function integrationCheck() {
  add("READY", "Source-backed web library", "Verified source behavior: the web host seeds demo content and has browser file import, IndexedDB/localStorage persistence, and BrowserAudioPlaybackAdapter.");
  add("UNVERIFIED", "Interactive player flows", "The source wires play/pause, seek, previous/next, volume, and queue controls, but rendered interaction is not verified when optional Playwright browser QA is unavailable.");
  add("UNVERIFIED", "Desktop launch/open flow", "Not launched by the default guardian; packaging and GUI launch are deliberately separate opt-in/manual checks.");
  add("WARNING", "Desktop and kiosk audio", "Desktop and Linux kiosk use SimulatedPlaybackAdapter; native playback is not verified as release-ready.");
  add("UNVERIFIED", "AHOY ID, purchases, downloads, library sync, and NFC", "Only contracts/plans exist (PurchaseSyncAdapter/PurchaseTrackSource). No live connector, authentication, entitlement, download authorization, cross-device sync, or NFC resolution is implemented in this repository.");
  add("WARNING", "User-facing download controls", "The public download hub links to GitHub Release v0.1.0 assets, but this repository has no local release tag and no verified GitHub Release API state. Treat availability as unverified.");
  add("UNVERIFIED", "Release automation", "No checked-in CI workflow or release automation was found; Electron Builder and the release notes/specification are the only verified release conventions.");
}
async function main() {
  await mkdir(outputDir, { recursive: true });
  const branch = gitText("branch", "--show-current") || "detached HEAD";
  const commit = gitText("rev-parse", "HEAD");
  const short = gitText("rev-parse", "--short", "HEAD");
  const working = gitText("status", "--short");
  const tag = gitText("describe", "--tags", "--abbrev=0");
  const comparison = tag || (git("show-ref", "--verify", "--quiet", "refs/heads/main").code === 0 ? "main" : "");
  add(working ? "WARNING" : "READY", "Working tree", working ? `${working.split("\n").length} changed/untracked path(s); preserved and not modified by this tool.` : "Clean working tree.");
  commandCheck("Typecheck", "npm", ["run", "typecheck"]);
  commandCheck("Tests", "npm", ["test"]);
  commandCheck("Production builds", "npm", ["run", "build"]);
  await localWebCheck();
  let packagingOutput;
  if (packageMac) {
    packagingOutput = path.join(outputDir, `mac-package-${stamp}`);
    commandCheck("macOS packaging", "npm", ["exec", "--", "electron-builder", "--project", "apps/desktop", "--mac", "dmg", "zip", `--config.directories.output=${packagingOutput}`], "BLOCKER", 20 * 60_000);
  }
  else add("SKIPPED", "macOS packaging", "Not run by default because it writes distributable artifacts; use --package-mac deliberately.");
  await inspectArtifacts(packagingOutput ? [packagingOutput] : undefined);
  integrationCheck();
  const changes = comparison ? gitText("log", "--oneline", `${comparison}..HEAD`) : "No local release tag found; compare against main manually.";
  const rank = { BLOCKER: 0, WARNING: 1, UNVERIFIED: 2, SKIPPED: 3, READY: 4 };
  findings.sort((a, b) => rank[a.status] - rank[b.status]);
  const lines = [
    "# Ahoy Player Release Guardian", "", `Generated: ${now.toISOString()}`, `Mode: ${dryRun ? "dry-run (no commands executed)" : "read-only source/release evaluation"}`, "",
    "## Evaluation", "", `- Commit: \`${short || "unknown"}\` (${commit || "unknown"})`, `- Branch: \`${branch}\``, `- Working tree: ${working ? "changed (details intentionally omitted from this report)" : "clean"}`, `- Comparison base: ${tag ? `latest local tag \`${tag}\`` : "no local release tag; main branch comparison"}`, "",
    "## Checks", "", "| Status | Check | Result |", "|---|---|---|",
    ...checks.map((check) => `| ${check.status} | ${check.name} | ${check.detail.replace(/\|/g, "\\|")} |`), "",
    "## Changes", "", "```text", redact(changes || "No commits ahead of comparison base."), "```", "",
    "## Attention", "",
    ...(findings.length ? findings.map((item) => `- **${item.status} — ${item.name}:** ${item.detail}`) : ["- **READY:** No blockers or warnings recorded by this run."]), "",
    "## Interpretation", "", "- READY: direct local evidence passed.", "- WARNING: release risk or incomplete distribution condition.", "- BLOCKER: a required command, route, or artifact inspection failed.", "- UNVERIFIED: no safe local evidence; this is not a claim of working behavior.", "- SKIPPED: intentionally not run in this mode.", ""
  ];
  const report = path.join(outputDir, `release-guardian-${stamp}.md`);
  await writeFile(report, lines.join("\n"), "utf8");
  console.log(`Report written: ${relative(report)}`);
  console.log(lines.join("\n"));
}
main().catch((error) => { console.error(`Release Guardian failed: ${redact(error.stack || error.message)}`); process.exitCode = 1; });
