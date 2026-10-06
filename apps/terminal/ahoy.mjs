#!/usr/bin/env node
import { createHash } from "node:crypto";
import { constants as fsConstants, existsSync, realpathSync } from "node:fs";
import { access, copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { Worker } from "node:worker_threads";
import { artColumns, brailleMask, clockLabel, terminalText, spinningDisc } from "./terminal-art.mjs";
import { getAhoyId, startLoginFlow, logout } from "./auth.mjs";

import { AudioMixer } from "./audio-mixer.mjs";

// This is deliberately the same path and JSON shape used by the native player.
// AHOY_PLAYER_HOME remains useful for tests and portable installs.
const appHome = process.env.AHOY_PLAYER_HOME || join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "ahoy-player");
const legacyAppHome = process.env.AHOY_PLAYER_LEGACY_HOME || (process.env.AHOY_PLAYER_HOME ? join(appHome, "legacy") : join(homedir(), ".ahoy-player"));
const modulePath = fileURLToPath(import.meta.url);
const moduleDirectory = dirname(modulePath);
const bundledDemoPath = join(moduleDirectory, "assets", "ahoy-demo.mp3");
const packagePath = join(moduleDirectory, "package.json");
const demoDirectory = join(appHome, "demo");
const libraryPath = join(appHome, "library.json");
const playbackLockPath = join(appHome, "playback.lock");
const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const tint = (code, value) => useColor ? `\x1b[${code}m${value}\x1b[0m` : value;
const accent = (value) => tint("38;5;156", value);
const dim = (value) => tint("2", value);

let ahoyId = await getAhoyId();

async function keyboardBacklightStatus() {
  if (platform() !== "linux") return { supported: false, message: "Keyboard backlight controls are currently supported on Linux only." };
  const leds = "/sys/class/leds";
  let names;
  try { names = await readdir(leds); } catch { return { supported: false, message: "Linux keyboard backlight controls were not found." }; }
  for (const name of names.filter((entry) => /kbd_backlight/i.test(entry))) {
    const path = join(leds, name);
    try {
      const [level, max] = await Promise.all([readFile(join(path, "brightness"), "utf8"), readFile(join(path, "max_brightness"), "utf8")]);
      return { supported: true, path: join(path, "brightness"), level: Number(level.trim()), max: Number(max.trim()), device: name };
    } catch {}
  }
  return { supported: false, message: "No Linux keyboard backlight control was found." };
}

async function keyboardBacklightCommand() {
  const status = await keyboardBacklightStatus();
  if (!status.supported) return console.log(status.message);
  console.log(`Keyboard backlight: ${status.level}/${status.max} (${status.device}).`);
  console.log("To enable TUI control for one session, run: AHOY_KEYBOARD_BACKLIGHT=1 ahoy player");
  try { await access(status.path, fsConstants.W_OK); }
  catch { console.log("This device is read-only for your user. Configure an appropriate udev permission before enabling control."); }
}

async function createBacklightControl() {
  if (process.env.AHOY_KEYBOARD_BACKLIGHT !== "1") return null;
  const status = await keyboardBacklightStatus();
  if (!status.supported) return { message: status.message };
  try { await writeFile(status.path, String(status.level)); }
  catch { return { message: `Backlight control unavailable: ${status.device} is not writable by this user.` }; }
  let level = status.level;
  return {
    get label() { return `kbd ${level}/${status.max}`; },
    async adjust(delta) {
      level = Math.max(0, Math.min(status.max, level + delta));
      await writeFile(status.path, String(level));
    },
    async restore() { await writeFile(status.path, String(status.level)); }
  };
}

export const pianoKeyMap = {
  // Top row: Sharps/black keys aligned above naturals + edge accents
  q: { note: "A#3", frequency: 233.08, label: "A#3", row: "top", type: "accent" },
  w: { note: "C#4", frequency: 277.18, label: "C#4", row: "top", type: "sharp" },
  e: { note: "D#4", frequency: 311.13, label: "D#4", row: "top", type: "sharp" },
  r: { note: "E4",  frequency: 329.63, label: "E4",  row: "top", type: "accent" },
  t: { note: "F#4", frequency: 369.99, label: "F#4", row: "top", type: "sharp" },
  y: { note: "G#4", frequency: 415.30, label: "G#4", row: "top", type: "sharp" },
  u: { note: "A#4", frequency: 466.16, label: "A#4", row: "top", type: "sharp" },
  i: { note: "B4",  frequency: 493.88, label: "B4",  row: "top", type: "accent" },
  o: { note: "C#5", frequency: 554.37, label: "C#5", row: "top", type: "sharp" },
  p: { note: "D#5", frequency: 622.25, label: "D#5", row: "top", type: "sharp" },

  // Home row: Naturals/white keys (C4–D5)
  a: { note: "C4",  frequency: 261.63, label: "C4",  row: "home", type: "natural" },
  s: { note: "D4",  frequency: 293.66, label: "D4",  row: "home", type: "natural" },
  d: { note: "E4",  frequency: 329.63, label: "E4",  row: "home", type: "natural" },
  f: { note: "F4",  frequency: 349.23, label: "F4",  row: "home", type: "natural" },
  g: { note: "G4",  frequency: 392.00, label: "G4",  row: "home", type: "natural" },
  h: { note: "A4",  frequency: 440.00, label: "A4",  row: "home", type: "natural" },
  j: { note: "B4",  frequency: 493.88, label: "B4",  row: "home", type: "natural" },
  k: { note: "C5",  frequency: 523.25, label: "C5",  row: "home", type: "natural" },
  l: { note: "D5",  frequency: 587.33, label: "D5",  row: "home", type: "natural" },

  // Bottom row: Bass naturals (C3–B3)
  z: { note: "C3",  frequency: 130.81, label: "C3",  row: "bottom", type: "bass" },
  x: { note: "D3",  frequency: 146.83, label: "D3",  row: "bottom", type: "bass" },
  c: { note: "E3",  frequency: 164.81, label: "E3",  row: "bottom", type: "bass" },
  v: { note: "F3",  frequency: 174.61, label: "F3",  row: "bottom", type: "bass" },
  b: { note: "G3",  frequency: 196.00, label: "G3",  row: "bottom", type: "bass" },
  n: { note: "A3",  frequency: 220.00, label: "A3",  row: "bottom", type: "bass" },
  m: { note: "B3",  frequency: 246.94, label: "B3",  row: "bottom", type: "bass" }
};

export const remixKeys = Object.keys(pianoKeyMap);
export const remixFrequencies = remixKeys.map((k) => pianoKeyMap[k].frequency);
const remixTonePaths = new Map();
const remixScales = [
  { name: "Chromatic", notes: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { name: "C Major", notes: [0, 2, 4, 5, 7, 9, 11] },
  { name: "C Minor", notes: [0, 2, 3, 5, 7, 8, 10] },
  { name: "C Pentatonic", notes: [0, 2, 4, 7, 9] }
];
const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const remixSounds = ["Triangle", "Sine", "Square"];
function quantizeRemixFrequency(frequency, scale) {
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const pitch = ((midi % 12) + 12) % 12;
  const snapped = scale.notes.reduce((best, note) => {
    const distance = Math.min((note - pitch + 12) % 12, (pitch - note + 12) % 12);
    const bestDistance = Math.min((best - pitch + 12) % 12, (pitch - best + 12) % 12);
    return distance < bestDistance ? note : best;
  }, scale.notes[0]);
  const up = (snapped - pitch + 12) % 12;
  const down = (pitch - snapped + 12) % 12;
  const adjusted = midi + (up < down ? up : -down);
  return { midi: adjusted, frequency: 440 * 2 ** ((adjusted - 69) / 12), label: `${noteNames[((adjusted % 12) + 12) % 12]}${Math.floor(adjusted / 12) - 1}` };
}

export function labelsForPath(filePath) {
  const stem = basename(filePath, extname(filePath)).replace(/[_]+/g, " ").trim();
  const numbered = stem.replace(/^\s*\d{1,3}\s*[-_.]\s*/, "");
  const parts = numbered.split(/\s+-\s+/).map((part) => part.trim()).filter(Boolean);
  return {
    artist: parts.length > 1 ? parts[0] : "Unknown Artist",
    title: parts.length > 1 ? parts.slice(1).join(" - ") : (numbered || "Untitled"),
    album: basename(dirname(filePath)) || "Local Imports"
  };
}

async function loadLibrary() {
  try {
    const parsed = JSON.parse(await readFile(libraryPath, "utf8"));
    return normalizeLibrary(parsed);
  } catch (error) {
    if (error.code === "ENOENT") return migrateLegacyLibrary();
    throw new Error(`Could not read ${libraryPath}: ${error.message}`);
  }
}

function nativeTrack(track) {
  const path = track.path;
  const labels = labelsForPath(path);
  const fingerprint = track.fingerprint || createHash("sha256").update(path).digest("hex");
  return {
    id: track.id?.startsWith("local:") ? track.id : `local:${fingerprint.slice(0, 24)}`,
    path,
    filename: track.filename || basename(path),
    title: track.title || labels.title,
    artist: track.artist || labels.artist,
    album: track.album || labels.album,
    track_number: track.track_number ?? null,
    fingerprint,
    duration_ms: track.duration_ms ?? null,
    imported_at: track.imported_at || track.addedAt || String(Math.floor(Date.now() / 1000))
  };
}

function normalizeLibrary(parsed) {
  return {
    schema_version: 1,
    tracks: Array.isArray(parsed?.tracks) ? parsed.tracks.filter((track) => typeof track?.path === "string").map(nativeTrack) : []
  };
}

async function migrateLegacyLibrary() {
  const legacyPath = join(legacyAppHome, "library.json");
  try {
    const legacy = normalizeLibrary(JSON.parse(await readFile(legacyPath, "utf8")));
    await saveLibrary(legacy);
    console.error(`Migrated terminal library from ${legacyPath} to ${libraryPath}`);
    return legacy;
  } catch (error) {
    if (error.code === "ENOENT") return { schema_version: 1, tracks: [] };
    throw new Error(`Could not migrate ${legacyPath}: ${error.message}`);
  }
}

async function saveLibrary(library) {
  await mkdir(appHome, { recursive: true });
  await writeFile(libraryPath, `${JSON.stringify(library, null, 2)}\n`, "utf8");
}

async function mp3Files(root) {
  const files = [];
  async function visit(current) {
    let entries;
    try { entries = await readdir(current, { withFileTypes: true }); }
    catch (error) { console.error(`Skipping ${current}: ${error.message}`); return; }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = join(current, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile() && extname(entry.name).toLowerCase() === ".mp3") files.push(path);
    }
  }
  await visit(root);
  return files;
}

export async function scanDirectories(directories) {
  const library = await loadLibrary();
  const known = new Map(library.tracks.map((track) => [track.path, track]));
  let added = 0;
  let updated = 0;
  for (const source of directories) {
    const root = resolve(source);
    if (!existsSync(root)) { console.error(`Not found: ${root}`); continue; }
    for (const path of await mp3Files(root)) {
      const info = await stat(path);
      const existing = known.get(path);
      const labels = labelsForPath(path);
      const fingerprint = createHash("sha256").update(await readFile(path)).digest("hex");
      const track = {
        id: existing?.id || `local:${fingerprint.slice(0, 24)}`,
        path,
        filename: basename(path),
        ...labels,
        track_number: existing?.track_number ?? null,
        fingerprint,
        duration_ms: existing?.duration_ms ?? null,
        imported_at: existing?.imported_at || String(Math.floor(Date.now() / 1000))
      };
      if (existing) { Object.assign(existing, track); updated += 1; }
      else { library.tracks.push(track); known.set(path, track); added += 1; }
    }
  }
  library.tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.title.localeCompare(b.title));
  await saveLibrary(library);
  return { added, updated, total: library.tracks.length };
}

export async function rescanLibrary(directories = []) {
  const library = await loadLibrary();
  const roots = directories.length
    ? directories
    : [...new Set(library.tracks.map((track) => dirname(track.path)))];
  if (!roots.length) return { added: 0, updated: 0, total: 0 };
  return scanDirectories(roots);
}

const ignoredSearchDirectories = new Set([".cache", ".config", ".local", ".npm", ".rustup", ".var", "node_modules", "vendor"]);

async function discoverMusicFolders() {
  const home = homedir();
  const roots = ["Music", "Downloads", "Desktop", "Documents", "Audio", "Sound", "Shared", "Public"].map((name) => join(home, name));
  if (platform() === "darwin") roots.push("/Volumes");
  if (platform() === "linux") {
    roots.push("/media", "/mnt", join("/run/media", process.env.USER || ""));
  }
  const seen = new Set();
  const candidates = [];
  let visited = 0;
  async function visit(directory, depth = 0) {
    if (visited >= 500 || depth > 3 || seen.has(directory)) return;
    seen.add(directory);
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); } catch { return; }
    visited += 1;
    if (entries.some((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".mp3")) {
      candidates.push({ path: directory, count: entries.filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".mp3").length });
    }
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && !ignoredSearchDirectories.has(entry.name)) {
        await visit(join(directory, entry.name), depth + 1);
      }
    }
  }
  for (const root of roots) await visit(root);
  return candidates.sort((a, b) => b.count - a.count || a.path.localeCompare(b.path));
}

async function scanWizard() {
  clearScreen();
  console.log(accent("AHOY PLAYER  ·  SETUP 1/2"));
  console.log(dim("Your library stays on this machine. Choose a folder to scan."));
  console.log("\n  Searching Music, Downloads, Documents, and attached drives…");
  const candidates = await discoverMusicFolders();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    if (candidates.length) {
      console.log("\n  MUSIC FOLDERS FOUND");
      candidates.slice(0, 12).forEach((candidate, index) => console.log(`  ${index + 1}  ${candidate.path}  ·  ${candidate.count} track${candidate.count === 1 ? "" : "s"}`));
      const answer = (await rl.question("\n  Choose a folder number, A for all, or type a path (Enter to skip): ")).trim();
      if (!answer) return null;
      if (/^a$/i.test(answer)) return candidates.map((candidate) => candidate.path);
      if (/^\d+$/.test(answer) && Number(answer) >= 1 && Number(answer) <= Math.min(candidates.length, 12)) return [candidates[Number(answer) - 1].path];
      return [resolve(answer.replace(/^~(?=$|[/\\])/, homedir()))];
    }
    console.log("\n  No music folders found yet. Your files stay on this machine.");
    const answer = (await rl.question("  Enter a folder path, or press Enter to continue: ")).trim();
    return answer ? [resolve(answer.replace(/^~(?=$|[/\\])/, homedir()))] : null;
  } finally { rl.close(); }
}

async function scanDefaultMusic() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) return scanDirectories([join(homedir(), "Music")]);
  const folders = await scanWizard();
  return folders?.length ? scanDirectories(folders) : { added: 0, updated: 0, total: (await loadLibrary()).tracks.length };
}

export async function installDemo(destinationDirectory = demoDirectory) {
  await mkdir(destinationDirectory, { recursive: true });
  const destination = join(destinationDirectory, "Ahoy - Demo.mp3");
  await copyFile(bundledDemoPath, destination);
  return { destination, result: await scanDirectories([demoDirectory]) };
}

function printTracks(tracks) {
  if (!tracks.length) return console.log(dim("No local MP3s yet. Run: ahoy scan"));
  tracks.forEach((track, index) => console.log(`${accent(String(index + 1).padStart(3, " "))}  ${track.title}\n     ${dim(`${track.artist} · ${track.album}`)}`));
}

function playerCommand(volume = 1, startOffset = 0, liveMix = false) {
  const vol = Math.max(0, Math.min(2.0, volume));
  if (liveMix && spawnSync("which", ["mpv"], { stdio: "ignore" }).status === 0) return { command: "mpv", baseArgs: ["--no-video", ...(startOffset > 0 ? [`--start=${startOffset}`] : [])] };
  if (platform() === "darwin") return { command: "afplay", baseArgs: ["-v", String(vol)] };
  for (const candidate of [
    ["mpv", ["--no-video", `--volume=${Math.round(vol * 100)}`, ...(startOffset > 0 ? [`--start=${startOffset}`] : [])]],
    ["cvlc", ["--play-and-exit", `--gain=${vol}`, ...(startOffset > 0 ? [`--start-time=${startOffset}`] : [])]],
    ["ffplay", ["-nodisp", "-autoexit", "-volume", String(Math.round(vol * 100)), ...(startOffset > 0 ? ["-ss", String(startOffset)] : [])]]
  ]) {
    if (spawnSync("which", [candidate[0]], { stdio: "ignore" }).status === 0) return { command: candidate[0], baseArgs: candidate[1] };
  }
  return null;
}

const trackDurationCache = new Map();
function probeTrackDuration(trackPath) {
  if (trackDurationCache.has(trackPath)) return trackDurationCache.get(trackPath);
  const duration = new Promise((resolve) => {
    let output = "";
    let probe;
    try {
      probe = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", trackPath], { stdio: ["ignore", "pipe", "ignore"] });
    } catch { resolve(null); return; }
    probe.stdout.setEncoding("utf8");
    probe.stdout.on("data", (chunk) => { output += chunk; });
    probe.once("error", () => resolve(null));
    probe.once("close", (code) => {
      const seconds = Number(output.trim());
      resolve(code === 0 && Number.isFinite(seconds) && seconds > 0 ? seconds : null);
    });
  });
  trackDurationCache.set(trackPath, duration);
  return duration;
}

function sliceTrackForAfplay(trackPath, startOffset) {
  if (startOffset <= 0.2) return trackPath;
  try {
    if (spawnSync("which", ["ffmpeg"], { stdio: "ignore" }).status === 0) {
      const slicePath = join(tmpdir(), "ahoy-track-resume.mp3");
      const res = spawnSync("ffmpeg", ["-ss", String(startOffset), "-i", trackPath, "-c", "copy", slicePath, "-y", "-loglevel", "quiet"]);
      if (res.status === 0 && existsSync(slicePath)) return slicePath;
    }
  } catch {}
  return trackPath;
}

function selectTrack(tracks, selector) {
  const numeric = Number(selector);
  if (Number.isInteger(numeric) && numeric > 0) return tracks[numeric - 1];
  const needle = selector.toLowerCase();
  return tracks.find((track) => track.id.startsWith(needle) || `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(needle));
}

export async function playTrack(track, options = 1, startOffset = 0) {
  const { quiet = false, mixer, volume = 1 } = typeof options === "number" ? { volume: options } : options;
  const player = playerCommand(volume, startOffset, Boolean(mixer));
  if (!player) throw new Error("Install mpv, VLC (cvlc), or FFmpeg (ffplay) to play audio on Linux.");
  await stopPreviousPlayback();
  if (!quiet) console.log(`${accent("▶")} ${track.title} ${dim(`— ${track.artist}`)}`);
  let sourcePath = track.path;
  if (player.command === "afplay" && startOffset > 0) {
    sourcePath = sliceTrackForAfplay(track.path, startOffset);
  }
  const child = mixer ? await mixer.launch(player, sourcePath, "song", quiet ? "ignore" : "inherit")
    : spawn(player.command, [...player.baseArgs, sourcePath], { stdio: quiet ? "ignore" : "inherit" });
  await writeFile(playbackLockPath, `${child.pid}\n`, "utf8");
  child.once("exit", () => { void releasePlaybackLock(child.pid); });
  return child;
}

async function stopPreviousPlayback() {
  try {
    const pid = Number.parseInt(await readFile(playbackLockPath, "utf8"), 10);
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return;
    try { process.kill(pid, "SIGTERM"); } catch (error) { if (error.code !== "ESRCH") throw error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function releasePlaybackLock(childPid) {
  try {
    const pid = Number.parseInt(await readFile(playbackLockPath, "utf8"), 10);
    if (pid === childPid) await writeFile(playbackLockPath, "", "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function buildToneWav(frequency, volume = 1.0, sfx = {}) {
  const sampleRate = 22_050;
  const duration = sfx.echo ? 0.72 : 0.42;
  const samples = Math.floor(sampleRate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);

  const raw = new Float32Array(samples);
  const noteDuration = 0.42;
  const noteSamples = Math.floor(sampleRate * noteDuration);

  for (let index = 0; index < noteSamples; index += 1) {
    const seconds = index / sampleRate;
    const envelope = Math.min(1, index / 220) * Math.max(0, 1 - seconds / noteDuration);
    const phase = (seconds * frequency) % 1;
    let triangle = sfx.waveform === "sine" ? Math.sin(2 * Math.PI * phase)
      : sfx.waveform === "square" ? (phase < 0.5 ? 1 : -1)
        : 1 - 4 * Math.abs(Math.round(phase) - phase);
    if (sfx.chorus) {
      const phase2 = (seconds * (frequency * 1.008)) % 1;
      const tri2 = 1 - 4 * Math.abs(Math.round(phase2) - phase2);
      triangle = triangle * 0.65 + tri2 * 0.35;
    }
    if (sfx.lofi) {
      triangle = Math.sin(triangle * 1.8);
    }
    raw[index] = triangle * envelope * 0.22;
  }

  const delayTaps = sfx.echo
    ? [{ delay: Math.floor(sampleRate * 0.12), gain: 0.42 }, { delay: Math.floor(sampleRate * 0.24), gain: 0.26 }]
    : [];

  const output = new Float32Array(samples);
  for (let index = 0; index < samples; index += 1) {
    let s = raw[index] || 0;
    for (const tap of delayTaps) {
      if (index >= tap.delay) s += output[index - tap.delay] * tap.gain;
    }
    output[index] = s;
    let sample = s * volume;
    sample = Math.max(-1, Math.min(1, sample));
    wav.writeInt16LE(Math.round(sample * 32_767), 44 + index * 2);
  }
  return wav;
}

export function buildSynthWav(frequency, volume = 1.0, sfx = {}) {
  const sampleRate = 22_050;
  const duration = sfx.echo ? 1.05 : 0.75;
  const samples = Math.floor(sampleRate * duration);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);

  const raw = new Float32Array(samples);
  const noteDuration = 0.35;
  const noteSamples = Math.floor(sampleRate * noteDuration);

  for (let i = 0; i < noteSamples; i += 1) {
    const t = i / sampleRate;
    const attack = Math.min(1, i / (sampleRate * 0.012));
    const decay = Math.pow(1 - i / noteSamples, 0.65);
    const envelope = attack * decay;

    // Sawtooth oscillator 1
    const p1 = (t * frequency) % 1;
    const saw1 = 2 * p1 - 1;

    // Detuned oscillator 2
    const detuneFactor = sfx.chorus ? 1.012 : 1.006;
    const p2 = (t * (frequency * detuneFactor)) % 1;
    const saw2 = 2 * p2 - 1;

    // Sub-bass sine oscillator
    const sub = Math.sin(2 * Math.PI * t * (frequency * 0.5));

    let tone = saw1 * 0.42 + saw2 * 0.34 + sub * 0.24;
    if (sfx.chorus) {
      const vibrato = Math.sin(2 * Math.PI * t * 4.5) * 0.15;
      tone = tone * (0.85 + vibrato);
    }
    if (sfx.lofi) {
      tone = Math.tanh(tone * 2.2) * 0.75;
    }
    raw[i] = tone * envelope;
  }

  // Multi-tap reverby delay
  const delayTaps = sfx.echo
    ? [
        { delay: Math.floor(sampleRate * 0.11), gain: 0.44 },
        { delay: Math.floor(sampleRate * 0.21), gain: 0.32 },
        { delay: Math.floor(sampleRate * 0.32), gain: 0.22 },
        { delay: Math.floor(sampleRate * 0.44), gain: 0.14 }
      ]
    : [
        { delay: Math.floor(sampleRate * 0.10), gain: 0.35 },
        { delay: Math.floor(sampleRate * 0.18), gain: 0.22 },
        { delay: Math.floor(sampleRate * 0.27), gain: 0.12 }
      ];

  const output = new Float32Array(samples);
  for (let i = 0; i < samples; i += 1) {
    let s = raw[i] || 0;
    for (const tap of delayTaps) {
      if (i >= tap.delay) s += output[i - tap.delay] * tap.gain;
    }
    output[i] = s;
    let sample = s * 0.32 * volume;
    sample = Math.max(-1, Math.min(1, sample));
    wav.writeInt16LE(Math.round(sample * 32_767), 44 + i * 2);
  }

  return wav;
}

export function buildSfxCueWav(cueType = 1) {
  const sampleRate = 22_050;
  const samples = Math.floor(sampleRate * 0.15);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);

  for (let i = 0; i < samples; i += 1) {
    const t = i / sampleRate;
    const env = Math.pow(1 - i / samples, 0.7);
    let sample = 0;
    if (cueType === 1) {
      // Dub Echo cue: fast upward chirp
      const freq = 440 + t * 1800;
      sample = Math.sin(2 * Math.PI * t * freq) * 0.28 * env;
    } else if (cueType === 2) {
      // Chorus cue: lush dual bell
      sample = (Math.sin(2 * Math.PI * t * 587.33) + Math.sin(2 * Math.PI * t * 595.0)) * 0.16 * env;
    } else {
      // Lo-Fi crunch cue: low crunchy zap
      const square = Math.sin(2 * Math.PI * t * 220) >= 0 ? 0.25 : -0.25;
      sample = square * env;
    }
    wav.writeInt16LE(Math.round(sample * 32_767), 44 + i * 2);
  }
  return wav;
}

export async function playRemixNote(keyOrIndex, synthMode = false, volume = 1.0, sfx = {}, mixer, remix = {}) {
  if (volume <= 0.001) return;
  const player = playerCommand(volume, 0, Boolean(mixer));
  if (!player) return;
  let frequency = 440;
  if (typeof keyOrIndex === "number") {
    frequency = remixFrequencies[keyOrIndex] || 440;
  } else if (typeof keyOrIndex === "string") {
    const lower = keyOrIndex.toLowerCase();
    frequency = pianoKeyMap[lower]?.frequency || 440;
  }
  if (remix.scale) frequency = quantizeRemixFrequency(frequency, remix.scale).frequency;
  const sfxKey = `${sfx.echo ? "1" : "0"}${sfx.chorus ? "1" : "0"}${sfx.lofi ? "1" : "0"}`;
  const typeKey = synthMode ? `synth-${sfxKey}` : `tone-${remix.sound || "triangle"}-${sfxKey}`;
  const cacheKey = `${typeKey}-${Math.round(frequency * 100)}`;
  let tonePath = remixTonePaths.get(cacheKey);
  if (!tonePath) {
    tonePath = join(tmpdir(), `ahoy-remix-${typeKey}-${Math.round(frequency * 100)}.wav`);
    const wav = synthMode ? buildSynthWav(frequency, 1.0, sfx) : buildToneWav(frequency, 1.0, { ...sfx, waveform: remix.sound || "triangle" });
    await writeFile(tonePath, wav);
    remixTonePaths.set(cacheKey, tonePath);
  }
  if (mixer) await mixer.launch(player, tonePath, "remix");
  else spawn(player.command, [...player.baseArgs, tonePath], { stdio: "ignore" });
}

export async function playSfxCue(cueType, volume = 1.0, mixer) {
  if (volume <= 0.001) return;
  const player = playerCommand(volume, 0, Boolean(mixer));
  if (!player) return;
  const cacheKey = `sfx-cue-${cueType}`;
  let cuePath = remixTonePaths.get(cacheKey);
  if (!cuePath) {
    cuePath = join(tmpdir(), `ahoy-sfx-cue-${cueType}.wav`);
    await writeFile(cuePath, buildSfxCueWav(cueType));
    remixTonePaths.set(cacheKey, cuePath);
  }
  if (mixer) await mixer.launch(player, cuePath, "remix");
  else spawn(player.command, [...player.baseArgs, cuePath], { stdio: "ignore" });
}

async function packageVersion() {
  const manifest = JSON.parse(await readFile(packagePath, "utf8"));
  return manifest.version;
}

async function update() {
  const npm = platform() === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["install", "--global", "@ahoy/player-terminal@latest"], { stdio: "inherit" });
  if (result.error) throw new Error(`Could not run npm: ${result.error.message}`);
  if (result.status !== 0) throw new Error("Update failed. Check that npm is installed and that you can install global packages.");
  console.log(`${accent("Ahoy Player updated")} · run \`ahoy --version\` to confirm the installed version.`);
}

function clearScreen() { process.stdout.write("\x1b[2J\x1b[H"); }
function crop(value, width) { return value.length > width ? `${value.slice(0, Math.max(1, width - 1))}…` : value; }
function brailleVisualizer(tick, active, width) {
  const cells = [];
  for (let column = 0; column < width; column += 1) {
    const phase = active ? tick / 3 : 0;
    const envelope = (Math.sin(column * 0.47 + phase) + Math.sin(column * 0.19 - phase * 0.7) + 2) / 4;
    const height = active ? 1 + Math.round(envelope * 7) : 2 + Math.round(envelope * 2);
    for (let row = 0; row < 2; row += 1) {
      const dots = Array.from({ length: 8 }, (_, index) => {
        const dotRow = Math.floor(index / 2), dotColumn = index % 2;
        const level = height - row * 4 + (dotColumn === 1 && column % 3 === 0 ? -1 : 0);
        return dotRow >= 4 - level;
      });
      cells[row] = (cells[row] || "") + String.fromCodePoint(0x2800 + brailleMask(dots));
    }
  }
  return cells;
}

function formatPianoDeck(width, lastNote, sfx, trackVol, overlayVol, scale, sound, recentAction) {
  const songPct = `${Math.round(trackVol * 100)}%`;
  const synthPct = `${Math.round(overlayVol * 100)}%`;
  const lastNoteAge = lastNote ? Date.now() - lastNote.time : Infinity;
  const isRecent = lastNoteAge < 2500;
  const pianoKeys = (keys) => keys.split(" ").map((key) => isRecent && lastNote.key.toLowerCase() === key.toLowerCase() ? accent(`[${key}]`) : accent(key)).join(" ");
  const echo = sfx.echo ? accent("Echo on") : dim("Echo off");
  const chorus = sfx.chorus ? accent("Chorus on") : dim("Chorus off");
  const lofi = sfx.lofi ? accent("Lo-fi on") : dim("Lo-fi off");
  return [
    accent("✦ REMIX") + dim(` ${scale.name} · ${sound} · Tab/Esc back`),
    width < 62 ? `${pianoKeys("Z X C V B N M")} bass · ${pianoKeys("A S D F G H J K L")} melody` : `${dim("LOW")}   ${pianoKeys("Z X C V B N M")}   ${dim("bass notes")}`,
    ...(width < 62 ? [] : [`${dim("MID")}   ${pianoKeys("A S D F G H J K L")}   ${dim("melody")}`, `${dim("HIGH")}  ${pianoKeys("W E · T Y U · O P")}   ${dim("sharps")}`]),
    `${dim("FX")}  5 ${echo} · 6 ${chorus} · 7 ${lofi} · [ ] scale · ; sound · 0 song mute · 9 remix mute`,
    `${dim("Shift + key = synth")} · Song ${songPct}${sfx.mutedSong ? " MUTED" : ""} · Remix ${synthPct}${sfx.mutedRemix ? " MUTED" : ""}${isRecent ? ` · ${accent(`${lastNote.key} ${lastNote.note}`)}` : ""}${recentAction ? ` · ${accent(recentAction)}` : ""}`
  ].join("\n");
}

async function tui() {
  const library = await loadLibrary();
  let tracks = library.tracks;
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("tui needs an interactive terminal. Use `ahoy library` in a piped shell.");
  const playbackReady = Boolean(playerCommand());
  let selected = 0;
  let child = null;
  let currentTrack = null;
  let currentDuration = NaN;
  let tick = 0;
  let closed = false;
  let paused = false;
  let remixMode = false;
  let sfxEcho = false, sfxChorus = false, sfxLoFi = false, lastNote = null;
  let remixScaleIndex = 0, remixSoundIndex = 0, recentAction = "";
  let terminalMode = false;
  const mixer = new AudioMixer();
  const backlight = await createBacklightControl();
  let motion = process.env.AHOY_REDUCED_MOTION !== "1";
  let discFrame = 0;
  const mixerLine = () => `MIX  master ${mixer.levels.master}% [8/9]  song ${mixer.levels.song}% [1/2]  remix ${mixer.levels.remix}% [3/4]`;
  const channelMixLine = (width) => {
    const bar = (level, size) => {
      const filled = Math.round(level / 100 * size);
      return `${"■".repeat(filled)}${"·".repeat(size - filled)}`;
    };
    const song = `${mixer.muted.song ? "×" : bar(mixer.levels.song, width < 62 ? 5 : 10)} ${mixer.levels.song}%${mixer.muted.song ? " MUTE" : ""}`;
    const remix = `${mixer.muted.remix ? "×" : bar(mixer.levels.remix, width < 62 ? 5 : 10)} ${mixer.levels.remix}%${mixer.muted.remix ? " MUTE" : ""}`;
    return accent(crop(width < 62 ? `S ${song} [1/2]  R ${remix} [3/4]` : `SONG ${song} [1/2]   REMIX ${remix} [3/4]`, width));
  };
  const mixHelp = () => mixer.status || `${remixMode ? `Remix: Esc/M back · [ ] scale · ; sound · 0 song mute · 9 remix mute · 5–7 effects` : `m remix · 1/2 song · 3/4 remix · z motion ${motion ? "on" : "off"} · r repeat ${repeatQueue ? "on" : "off"}${backlight ? ` · K/J backlight ${backlight.label}` : backlight?.message ? ` · ${backlight.message}` : ""}`}${loadingSince && performance.now() - loadingSince >= 1000 ? " · Rendering artwork…" : ""}`;
  let emptyStatus = "Choose a setup step below to start listening.";
  let scanning = false;
  let wizardActive = false;
  let ascii = process.env.AHOY_ASCII === "1" || !/utf-?8/i.test(process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || "UTF-8");
  let artWorker, artKey = "", artId = 0, artwork = null, artMetadata = {}, artMessage = "", loadingSince = 0;
  let startedAt = 0, elapsedBeforePause = 0, focus = -1, launching = false;
  let repeatQueue = false;
  const elapsed = () => elapsedBeforePause + (child && !paused ? (performance.now() - startedAt) / 1000 : 0);
  const requestArt = (track, columns) => {
    const key = `${track.path}:${columns}`;
    if (key === artKey) return;
    artKey = key; artwork = null; artMetadata = {}; artMessage = ""; loadingSince = performance.now();
    if (!artWorker) {
      artWorker = new Worker(new URL("./artwork-worker.mjs", import.meta.url));
      artWorker.on("message", (result) => {
        if (closed || result.id !== artId) return;
        artwork = result.art; artMetadata = result.metadata ?? {}; artMessage = result.message ?? ""; loadingSince = 0; render();
      });
      artWorker.on("error", () => { loadingSince = 0; artMessage = "Artwork worker unavailable · press v for the deck."; render(); });
    }
    artWorker.postMessage({ id: ++artId, path: track.path, columns });
  };
  const renderTerminal = (track, active) => {
    const width = Math.max(16, (process.stdout.columns || 80) - 2), height = process.stdout.rows || 24;
    const queueRows = Math.min(tracks.length, height < 32 ? 1 : 5);
    const columns = artColumns(width, height - (width < 64 ? 6 : 3) - queueRows - (remixMode ? 3 : 0));
    requestArt(track, columns);
    const lines = [];
    const textLine = (value) => crop(terminalText(value), width);
    const deckHeader = ahoyId ? `AHOY / LIVE DECK — ⚓ AHOY ID: ${ahoyId}` : "AHOY / LIVE DECK";
    lines.push(accent(deckHeader), dim(textLine("↑↓ select · enter play · space pause · m remix · v waveform · x quit")), dim("═".repeat(width)),
      textLine(channelMixLine(width)),
      accent(active ? "▶  NOW PLAYING" : paused ? "Ⅱ  PAUSED" : "○  READY"));
    if (remixMode) lines.push(textLine(`REMIX ${remixScales[remixScaleIndex].name} · ${remixSounds[remixSoundIndex]} · Z–M/A–L piano · Shift synth · Tab/Esc back`));
    const artLines = artwork?.[ascii ? "ascii" : "braille"];
    if (artLines) lines.push(...artLines.map(textLine));
    else {
      lines.push(...spinningDisc(Math.min(40, width), Math.max(2, columns / 2), discFrame)[ascii ? "ascii" : "braille"]);
    }
    const tags = artMetadata.tags ?? {};
    const duration = Number(artMetadata.duration) || (track.duration_ms ? track.duration_ms / 1000 : NaN);
    const position = currentTrack ? Math.min(elapsed(), Number.isFinite(duration) ? duration : Infinity) : 0;
    const barWidth = Math.max(8, Math.min(50, width - 4));
    const filled = Number.isFinite(duration) ? Math.min(barWidth, Math.floor(position / duration * barWidth)) : 0;
    const buttons = ["[ Previous", active ? "Space Pause" : "Space Play", "] Next", "v Waveform"];
    const buttonLabels = buttons.map((label, index) => focus === index ? `>${label}<` : label);
    const controlLines = width < 64 ? buttonLabels.map(textLine) : [textLine(buttonLabels.join("  "))];
    lines.push("", accent(textLine((tags.title || track.title).toUpperCase())), dim(textLine(`${tags.artist || track.artist} · ${tags.album || track.album}`)),
      textLine(`${clockLabel(position)} / ${clockLabel(duration)}  ${active ? "PLAYING" : paused ? "PAUSED" : "READY"}`),
      textLine(`[${"=".repeat(filled)}${"-".repeat(barWidth - filled)}]`),
      ...controlLines,
      dim(textLine(remixMode ? "[ ] scale · ; sound · 0/9 mute · 1–4 layer level · 5–7 FX" : "Tab focus · Enter activate · b Braille/ASCII")),
      textLine(mixerLine()), dim(textLine(mixHelp())), dim("─".repeat(width)));
    const start = Math.max(0, Math.min(selected - Math.floor(queueRows / 2), tracks.length - queueRows));
    tracks.slice(start, start + queueRows).forEach((item, offset) => {
      const index = start + offset;
      const marker = index === selected ? ">" : " ";
      const playing = active && currentTrack?.id === item.id ? ">" : " ";
      lines.push(textLine(`${marker}${playing} ${String(index + 1).padStart(3, " ")}  ${item.title} — ${item.artist}`));
    });
    lines.push(dim(textLine(`${tracks.length} local tracks · ${libraryPath}`)));
    // Artwork is static; only the missing-cover CD animates during playback.
    process.stdout.write(`\x1b[0m\x1b[H${lines.slice(0, Math.max(1, height - 1)).map((line) => `${line}\x1b[K`).join("\n")}\x1b[J`);
  };
  const render = () => {
    if (closed) return;
    if (!tracks.length) {
      const width = Math.max(1, (process.stdout.columns || 80) - 2);
      const height = process.stdout.rows || 24;
      const deckHeader = ahoyId ? `AHOY / LIVE DECK — ⚓ AHOY ID: ${ahoyId}` : "AHOY / LIVE DECK";
      const welcomeLine = ahoyId ? `Welcome back, ${ahoyId}.` : "Welcome aboard. Let’s get your player ready.";
      const lines = [
        deckHeader, "═".repeat(width),
        welcomeLine, "Your library stays on this machine.", "",
        emptyStatus, "", "s  Scan music folders",
        "d  Try a demo track", "l  AHOY ID (optional)",
        playbackReady ? "Audio output ready." : "Audio output needs mpv, VLC, or FFmpeg.",
        "", "x  Quit"
      ].map(line => crop(terminalText(line), width));
      lines[0] = accent(lines[0]);
      lines[1] = dim(lines[1]);
      process.stdout.write(`\x1b[0m\x1b[H${lines.slice(0, Math.max(1, height - 1)).map(line => `${line}\x1b[K`).join("\n")}\x1b[J`);
      return;
    }
    const active = Boolean(child && !child.killed && !paused);
    const track = currentTrack ?? tracks[selected];
    if (terminalMode) { renderTerminal(track, active); return; }
    process.stdout.write("\x1b[0m");
    clearScreen();
    const width = Math.max(40, (process.stdout.columns || 86) - 4);
    const deckHeader = ahoyId ? `AHOY / LIVE DECK — ⚓ AHOY ID: ${ahoyId}` : "AHOY / LIVE DECK";
    console.log(accent(crop(`${deckHeader}  ·  s scan · ↑↓ browse · enter play · space pause · m remix · x quit`, width)));
    console.log(dim("═".repeat(width)));
    console.log(channelMixLine(width));
    console.log(`${accent(active ? "▶ NOW PLAYING" : paused ? "Ⅱ PAUSED" : "READY")}  ${crop(track.title, Math.max(1, width - 38))}  ${dim(`— ${track.artist}`)}`);
    const playbackHint = active ? "PLAYING" : paused ? "PAUSED — SPACE TO RESUME" : "ENTER TO PLAY";
    console.log(dim(`Album: ${track.album}  ·  ${playbackHint}`));
    const position = currentTrack ? elapsed() : 0;
    const durationKnown = Number.isFinite(currentDuration) && currentDuration > 0;
    const progressWidth = Math.min(36, Math.max(12, width - 30));
    const progressFilled = durationKnown ? Math.min(progressWidth, Math.floor(position / currentDuration * progressWidth)) : 0;
    console.log(`${dim("Track")}  [${accent("━".repeat(progressFilled))}${dim("─".repeat(progressWidth - progressFilled))}]  ${clockLabel(position)} / ${clockLabel(durationKnown ? currentDuration : NaN)}`);
    const volumeWidth = Math.min(20, Math.max(8, width - 24));
    const volumeFilled = Math.round(mixer.levels.master / 100 * volumeWidth);
    console.log(`Volume  [${accent("■".repeat(volumeFilled))}${dim("─".repeat(volumeWidth - volumeFilled))}]  ${mixer.levels.master}%  ${dim("+ / -")}`);
    if (remixMode) console.log(formatPianoDeck(width, lastNote, { echo: sfxEcho, chorus: sfxChorus, lofi: sfxLoFi, mutedSong: mixer.muted.song, mutedRemix: mixer.muted.remix }, mixer.levels.song / 100, mixer.levels.remix / 100, remixScales[remixScaleIndex], remixSounds[remixSoundIndex], recentAction));
    else console.log(dim("─".repeat(width)));
    console.log(accent("LIBRARY") + dim(`  ${tracks.length} songs`));
    console.log(dim(`${" ".repeat(7)}${"ARTIST".padEnd(Math.min(24, Math.max(10, Math.floor((width - 16) / 4))))}  SONG TITLE`));
    console.log(dim("─".repeat(width)));
    const rows = Math.max(1, (process.stdout.rows || 24) - (remixMode ? (width < 62 ? 18 : 20) : 14));
    const start = Math.max(0, Math.min(selected - Math.floor(rows / 2), tracks.length - rows));
    const artistWidth = Math.min(24, Math.max(10, Math.floor((width - 16) / 4)));
    const titleWidth = Math.max(10, width - artistWidth - 12);
    tracks.slice(start, start + rows).forEach((item, offset) => {
      const index = start + offset;
      const marker = index === selected ? accent("›") : " ";
      const playing = active && currentTrack?.id === item.id ? accent("▶") : " ";
      console.log(`${marker}${playing} ${String(index + 1).padStart(3, " ")}  ${dim(crop(item.artist, artistWidth).padEnd(artistWidth))}  ${crop(item.title, titleWidth)}`);
    });
    const footer = remixMode
      ? "Piano · Shift synth · [ ] scale · ; sound · 0/9 mute · 1–4 mix · Tab/Esc back"
      : "Up/Down Browse  Enter Play  Space Pause  S Scan  M Remix  R Repeat  Q Quit";
    console.log(dim(crop(footer, width)));
  };

  const stop = () => {
    mixer.stopRemix(); mixer.paused = false;
    if (child && !child.killed) { if (paused) child.kill("SIGCONT"); child.kill(); }
    child = null; currentTrack = null; paused = false; remixMode = false;
    currentDuration = NaN;
    elapsedBeforePause = 0;
  };

  const pauseOrResume = () => {
    if (!child || child.killed) return;
    if (!paused) elapsedBeforePause = elapsed(); else startedAt = performance.now();
    child.kill(paused ? "SIGCONT" : "SIGSTOP");
    paused = !paused;
    mixer.paused = paused;
    if (!paused) void mixer.apply();
  };
  const startSelected = async () => {
    if (launching || !tracks[selected]) return;
    launching = true;
    stop(); currentTrack = tracks[selected];
    try {
      const trackBeingStarted = currentTrack;
      const knownDuration = Number(trackBeingStarted.duration_ms) / 1000;
      currentDuration = Number.isFinite(knownDuration) && knownDuration > 0 ? knownDuration : NaN;
      const playingChild = await playTrack(trackBeingStarted, { quiet: true, mixer });
      if (closed) { playingChild.kill(); return; }
      child = playingChild; startedAt = performance.now();
      if (!Number.isFinite(currentDuration)) {
        void probeTrackDuration(trackBeingStarted.path).then((duration) => {
          if (duration && currentTrack?.id === trackBeingStarted.id) { currentDuration = duration; render(); }
        });
      }
      render();
      const finish = () => {
        if (child !== playingChild) return;
        const finishedIndex = currentTrack ? tracks.findIndex((item) => item.id === currentTrack.id) : selected;
        child = null; currentTrack = null; paused = false; remixMode = false; elapsedBeforePause = 0;
        if (finishedIndex < tracks.length - 1 || repeatQueue) {
          selected = (finishedIndex + 1) % tracks.length;
          void startSelected();
        } else render();
      };
      child.once("exit", finish); child.once("error", finish);
    } catch (error) { currentTrack = null; artMessage = terminalText(error.message); }
    finally { launching = false; }
  };
  const skip = async (offset) => { selected = Math.max(0, Math.min(tracks.length - 1, (currentTrack ? tracks.indexOf(currentTrack) : selected) + offset)); await startSelected(); };
  // First launch and the empty-library scan shortcut share the same setup flow.
  if (!tracks.length) {
    try {
      const folders = await scanWizard();
      if (folders?.length) {
        const result = await scanDirectories(folders);
        emptyStatus = `${result.added} tracks added · ${result.total} in your library.`;
        tracks = (await loadLibrary()).tracks;
      } else emptyStatus = "Scan skipped. Press s any time to scan for music.";
      selected = 0;
    } catch (error) {
      emptyStatus = `Scan could not finish: ${terminalText(error.message)}`;
    }
  }
  render();
  let lastTerminalSecond = -1, lastProgressSecond = -1;
  const animation = setInterval(() => {
    tick += 1;
    if (motion && child && !child.killed && !paused) discFrame = (discFrame + 1) % 24;
    if (!tracks.length) return;
    const second = Math.floor(performance.now() / 1000);
    if (!terminalMode) {
      if (child && !paused && second !== lastProgressSecond) { lastProgressSecond = second; render(); }
      return;
    }
    if ((!artwork && motion && child && !paused) || second !== lastTerminalSecond) { lastTerminalSecond = second; render(); }
  }, 180);
  const resize = () => render();
  process.stdout.on("resize", resize);
  process.stdin.setRawMode(true); process.stdin.resume();

  await new Promise((done) => process.stdin.on("data", async (key) => {
    if (wizardActive) return;
    const value = key.toString();
    if (remixMode && value !== "\u0003") {
      if (value === "\u001b" || value === "\t") {
        remixMode = false;
      } else if (value === " ") {
        pauseOrResume();
        recentAction = paused ? "Song paused" : "Song resumed";
      } else if (value === "[" || value === "]") {
        remixScaleIndex = (remixScaleIndex + (value === "]" ? 1 : remixScales.length - 1)) % remixScales.length;
        recentAction = `Scale: ${remixScales[remixScaleIndex].name}`;
      } else if (value === ";") {
        remixSoundIndex = (remixSoundIndex + 1) % remixSounds.length;
        recentAction = `Sound: ${remixSounds[remixSoundIndex]}`;
      } else if (value === "0" || value === "9") {
        const channel = value === "0" ? "song" : "remix";
        const muted = mixer.toggleMute(channel);
        recentAction = `${channel === "song" ? "Song" : "Remix"} ${muted ? "muted" : "unmuted"}`;
      } else if (["1", "2", "3", "4"].includes(value)) {
        mixer.adjust(value);
        recentAction = `Song ${mixer.levels.song}% · Remix ${mixer.levels.remix}%`;
      } else if (["+", "=", "-", "_"].includes(value)) {
        mixer.adjust(value === "+" || value === "=" ? "9" : "8");
      } else if (["5", "6", "7"].includes(value)) {
        if (value === "5") sfxEcho = !sfxEcho;
        if (value === "6") sfxChorus = !sfxChorus;
        if (value === "7") sfxLoFi = !sfxLoFi;
        recentAction = value === "5" ? `Echo ${sfxEcho ? "on" : "off"}` : value === "6" ? `Chorus ${sfxChorus ? "on" : "off"}` : `Lo-fi ${sfxLoFi ? "on" : "off"}`;
        void playSfxCue(Number(value) - 4, 1, mixer).catch(error => { mixer.status = terminalText(error.message); });
      } else if (!paused && pianoKeyMap[value.toLowerCase()]) {
        const letter = value.toLowerCase(), synth = value !== letter;
        const note = quantizeRemixFrequency(pianoKeyMap[letter].frequency, remixScales[remixScaleIndex]);
        lastNote = { key: value, note: note.label, synth, time: Date.now() };
        void playRemixNote(letter, synth, 1, { echo: sfxEcho, chorus: sfxChorus, lofi: sfxLoFi }, mixer, { scale: remixScales[remixScaleIndex], sound: remixSounds[remixSoundIndex].toLowerCase() })
          .catch(error => { mixer.status = terminalText(error.message); });
      }
      render();
      return;
    }
    if (value === "\u0003" || (!remixMode && (value === "x" || value === "q"))) { closed = true; clearInterval(animation); stop(); mixer.close(); void artWorker?.terminate(); process.stdout.off("resize", resize); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write("\x1b[0m"); clearScreen(); try { await backlight?.restore(); } catch (error) { console.error(`Could not restore keyboard backlight: ${error.message}`); } done(); return; }
    if (backlight && !remixMode && (value === "K" || value === "J")) { try { await backlight.adjust(value === "K" ? 1 : -1); } catch (error) { mixer.status = `Backlight control failed: ${error.message}`; } render(); return; }
    if (mixer.adjust(value)) { render(); return; }
    if (value === "\u001b") { remixMode = false; render(); return; }
    if (!remixMode && value === "z") motion = !motion;
    if (!remixMode && value === "r") repeatQueue = !repeatQueue;
    if (!remixMode && ["+", "=", "-", "_"].includes(value)) {
      mixer.adjust(value === "+" || value === "=" ? "9" : "8");
      render(); return;
    }
    if (!remixMode && value === "v") { terminalMode = !terminalMode; focus = -1; }
    if (!remixMode && value === "l") {
      if (ahoyId) {
        await logout();
        ahoyId = null;
        emptyStatus = "Logged out.";
      } else {
        process.stdout.write("\x1b[0m");
        clearScreen();
        console.log(accent("Starting AHOY ID login..."));
        try {
          ahoyId = await startLoginFlow(true);
          emptyStatus = "Logged in successfully.";
        } catch (e) {
          emptyStatus = "Login failed: " + e.message;
        }
      }
      render(); return;
    }
    if (value === "s" && !scanning) {
      scanning = true;
      wizardActive = true;
      process.stdin.setRawMode(false); process.stdin.pause();
      try {
        const folders = await scanWizard();
        if (folders?.length) {
          const result = await scanDirectories(folders);
          emptyStatus = `${result.added} tracks added · ${result.total} in your library.`;
        } else emptyStatus = "Scan skipped.";
        tracks = (await loadLibrary()).tracks;
        selected = Math.min(selected, Math.max(0, tracks.length - 1));
      } catch (error) { emptyStatus = terminalText(error.message); }
      finally {
        process.stdin.setRawMode(true); process.stdin.resume();
        wizardActive = false; scanning = false;
      }
      render(); return;
    }
    if (!tracks.length) {
      if ((value === "r" || value === "d") && !scanning) {
        scanning = true; emptyStatus = value === "d" ? "Adding the demo track…" : "Reloading library…"; render();
        try {
          if (value === "d") {
            const { result } = await installDemo();
            emptyStatus = `Demo added · ${result.total} track${result.total === 1 ? "" : "s"} in your library.`;
          }
          tracks = (await loadLibrary()).tracks; selected = 0;
          if (!tracks.length && value !== "d") emptyStatus = "No tracks yet. Scan a folder or add the demo.";
        } catch (error) { emptyStatus = terminalText(error.message); }
        finally {
          if (wizardActive) { process.stdin.setRawMode(true); process.stdin.resume(); wizardActive = false; }
          scanning = false;
        }
      }
      render(); return;
    }
    if (!remixMode && value === "b") ascii = !ascii;
    if (terminalMode && value === "\t") focus = (focus + 1) % 4;
    if (terminalMode && value === "\u001b[Z") focus = (focus + 3) % 4;
    if (value === "\u001b[A" || value === "\u001b[B") focus = -1;
    if (value === "\u001b[A" || (!remixMode && value === "k")) selected = Math.max(0, selected - 1);
    if (value === "\u001b[B" || (!remixMode && value === "j")) selected = Math.min(tracks.length - 1, selected + 1);
    if (value === " ") { if (terminalMode && !child) await startSelected(); else pauseOrResume(); }
    if (value === "m" || (!remixMode && value === "M")) { remixMode = !remixMode; render(); return; }
    const alias = { "\u001b[D": "1", "\u001b[C": "2" }[value];
    if (alias) { mixer.adjust(alias); render(); return; }
    if (!terminalMode && (value === "[" || value === "]")) { mixer.adjust(value === "[" ? "1" : "2"); render(); return; }
    if (terminalMode && value === "[") await skip(-1);
    if (terminalMode && value === "]") await skip(1);
    if (value === "\r") {
      if (!terminalMode || focus < 0) await startSelected();
      else if (focus === 0) await skip(-1);
      else if (focus === 1) { if (child) pauseOrResume(); else await startSelected(); }
      else if (focus === 2) await skip(1);
      else { terminalMode = false; focus = -1; }
    }
    render();
  }));
}

function help() {
  console.log("  ahoy rescan [folder...]     refresh the saved library from its folders");
  console.log(`\n${accent("AHOY PLAYER / TERMINAL")}\n\n  ahoy player                open the terminal player (same as ahoy tui)\n  ahoy scan [folder...]      add MP3s from local folders; interactive folder choice when run in a terminal\n  ahoy backlight             check Linux keyboard backlight support and permissions\n  ahoy demo [--music]        install and index a bundled demo MP3\n  ahoy library               list your local library\n  ahoy search <words>        find tracks\n  ahoy play <number|words>   play one track\n  ahoy tui                   browse with a small terminal deck\n  ahoy update                install the latest published terminal player\n\nIn the player, press s to scan and r to repeat the library.\nKeyboard backlight control is opt-in: set AHOY_KEYBOARD_BACKLIGHT=1; use K/J to adjust.\nmacOS uses the built-in afplay. Linux uses mpv, VLC (cvlc), or ffplay.\nLibrary metadata stays local: ${libraryPath}\n`);
}

export async function main(args = process.argv.slice(2)) {
  const [command = "help", ...rest] = args;
  if (["help", "--help", "-h"].includes(command)) return help();
  if (["--version", "-v", "version"].includes(command)) return console.log(await packageVersion());
  if (command === "update") return update();
  if (command === "backlight") return keyboardBacklightCommand();
  if (command === "scan") {
    const result = rest.length ? await scanDirectories(rest) : await scanDefaultMusic();
    console.log(`${accent("Library updated")} · ${result.added} added, ${result.updated} refreshed, ${result.total} total`);
    if (!result.total && process.stdin.isTTY && process.stdout.isTTY) return tui();
    return;
  }
  if (command === "rescan") {
    const result = await rescanLibrary(rest);
    console.log(`${accent("Library rescanned")} · ${result.added} added, ${result.updated} refreshed, ${result.total} total`);
    return;
  }
  if (command === "demo") {
    const destinationDirectory = rest.includes("--music") ? join(homedir(), "Music", "Ahoy") : demoDirectory;
    const { destination, result } = await installDemo(destinationDirectory);
    console.log(`${accent("Demo installed")} · ${destination}`);
    console.log(`${accent("Library updated")} · ${result.added} added, ${result.updated} refreshed, ${result.total} total`);
    return;
  }
  const library = await loadLibrary();
  if (command === "library") return printTracks(library.tracks);
  if (command === "search") return printTracks(library.tracks.filter((track) => `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(rest.join(" ").toLowerCase())));
  if (command === "play") {
    const track = selectTrack(library.tracks, rest.join(" "));
    if (!track) throw new Error("Track not found. Run `ahoy library` or `ahoy search <words>` first.");
    await playTrack(track);
    return;
  }
  if (command === "login") {
    console.log(accent("Starting AHOY ID login..."));
    try {
      const id = await startLoginFlow(true);
      console.log(`\nSuccessfully logged in as ${accent(id)}!`);
    } catch (e) {
      console.error("\nLogin failed:", e.message);
    }
    return;
  }
  if (command === "logout") {
    await logout();
    console.log("Logged out of AHOY ID.");
    return;
  }
  if (command === "player" || command === "tui") return tui();
  throw new Error(`Unknown command: ${command}. Run \`ahoy help\`.`);
}

if (process.argv[1] && realpathSync(resolve(process.argv[1])) === modulePath) {
  main().catch((error) => { console.error(`ahoy: ${error.message}`); process.exitCode = 1; });
}
