#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir, platform, tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";

const appHome = process.env.AHOY_PLAYER_HOME || join(homedir(), ".ahoy-player");
const libraryPath = join(appHome, "library.json");
const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const tint = (code, value) => useColor ? `\x1b[${code}m${value}\x1b[0m` : value;
const accent = (value) => tint("38;5;156", value);
const dim = (value) => tint("2", value);
const remixKeys = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "a", "s", "d", "f", "g", "h"];
const remixFrequencies = [261.63, 293.66, 329.63, 349.23, 392, 440, 493.88, 523.25, 587.33, 659.25, 130.81, 146.83, 164.81, 174.61, 196, 220];
const remixTonePaths = new Map();

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
    return Array.isArray(parsed.tracks) ? parsed : { version: 1, tracks: [] };
  } catch (error) {
    if (error.code === "ENOENT") return { version: 1, tracks: [] };
    throw new Error(`Could not read ${libraryPath}: ${error.message}`);
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
      const track = {
        id: existing?.id || createHash("sha256").update(path).digest("hex").slice(0, 12),
        path, ...labels, bytes: info.size, modifiedMs: Math.round(info.mtimeMs), addedAt: existing?.addedAt || new Date().toISOString()
      };
      if (existing) { Object.assign(existing, track); updated += 1; }
      else { library.tracks.push(track); known.set(path, track); added += 1; }
    }
  }
  library.tracks.sort((a, b) => a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album) || a.title.localeCompare(b.title));
  library.updatedAt = new Date().toISOString();
  await saveLibrary(library);
  return { added, updated, total: library.tracks.length };
}

function printTracks(tracks) {
  if (!tracks.length) return console.log(dim("No local MP3s yet. Run: ahoy scan ~/Music"));
  tracks.forEach((track, index) => console.log(`${accent(String(index + 1).padStart(3, " "))}  ${track.title}\n     ${dim(`${track.artist} · ${track.album}`)}`));
}

function playerCommand() {
  if (platform() === "darwin") return { command: "afplay", baseArgs: [] };
  for (const candidate of [["mpv", ["--no-video"]], ["cvlc", ["--play-and-exit"]], ["ffplay", ["-nodisp", "-autoexit"]]]) {
    if (spawnSync("which", [candidate[0]], { stdio: "ignore" }).status === 0) return { command: candidate[0], baseArgs: candidate[1] };
  }
  return null;
}

function selectTrack(tracks, selector) {
  const numeric = Number(selector);
  if (Number.isInteger(numeric) && numeric > 0) return tracks[numeric - 1];
  const needle = selector.toLowerCase();
  return tracks.find((track) => track.id.startsWith(needle) || `${track.title} ${track.artist} ${track.album}`.toLowerCase().includes(needle));
}

export async function playTrack(track) {
  const player = playerCommand();
  if (!player) throw new Error("Install mpv, VLC (cvlc), or FFmpeg (ffplay) to play audio on Linux.");
  console.log(`${accent("▶")} ${track.title} ${dim(`— ${track.artist}`)}`);
  return spawn(player.command, [...player.baseArgs, track.path], { stdio: "inherit" });
}

export function buildToneWav(frequency) {
  const sampleRate = 22_050;
  const samples = Math.floor(sampleRate * 0.42);
  const wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples * 2, 4); wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
  wav.write("data", 36); wav.writeUInt32LE(samples * 2, 40);
  for (let index = 0; index < samples; index += 1) {
    const seconds = index / sampleRate;
    const envelope = Math.min(1, index / 220) * Math.max(0, 1 - seconds / 0.42);
    const phase = (seconds * frequency) % 1;
    const triangle = 1 - 4 * Math.abs(Math.round(phase) - phase);
    wav.writeInt16LE(Math.round(triangle * envelope * 0.22 * 32_767), 44 + index * 2);
  }
  return wav;
}

async function playRemixNote(index) {
  const player = playerCommand();
  if (!player) return;
  const frequency = remixFrequencies[index];
  let tonePath = remixTonePaths.get(frequency);
  if (!tonePath) {
    tonePath = join(tmpdir(), `ahoy-remix-${Math.round(frequency)}.wav`);
    await writeFile(tonePath, buildToneWav(frequency));
    remixTonePaths.set(frequency, tonePath);
  }
  spawn(player.command, [...player.baseArgs, tonePath], { stdio: "ignore" });
}

function clearScreen() { process.stdout.write("\x1b[2J\x1b[H"); }
function crop(value, width) { return value.length > width ? `${value.slice(0, Math.max(1, width - 1))}…` : value; }
function waveform(tick, active, width) {
  const levels = [2, 5, 3, 7, 4, 8, 3, 6, 2, 7, 5, 8, 4, 6, 3, 7, 5, 2, 8, 4, 6, 3, 7, 5, 2, 8, 4, 6, 3, 7, 5, 2];
  const glyphs = "▁▂▃▄▅▆▇█";
  return Array.from({ length: width }, (_, index) => {
    const level = levels[index % levels.length];
    const bounce = active ? ((tick + index * 3) % 5 === 0 ? 1 : 0) : 0;
    return glyphs[Math.min(7, level - 1 + bounce)];
  }).join("");
}

async function tui() {
  const library = await loadLibrary();
  const tracks = library.tracks;
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("tui needs an interactive terminal. Use `ahoy library` in a piped shell.");
  if (!tracks.length) { console.log("No tracks yet. Run: ahoy scan ~/Music"); return; }
  let selected = 0;
  let child = null;
  let currentTrack = null;
  let tick = 0;
  let closed = false;
  let paused = false;
  let remixMode = false;
  const render = () => {
    if (closed) return;
    clearScreen();
    const active = Boolean(child && !child.killed && !paused);
    const track = currentTrack ?? tracks[selected];
    const width = Math.max(54, Math.min(104, (process.stdout.columns || 86) - 8));
    console.log(`${accent("AHOY / LIVE DECK")}${dim("  ↑↓ select · enter play · space pause · m remix · x quit")}`);
    console.log(dim("═".repeat(width)));
    console.log(`${accent(active ? "▶  NOW PLAYING" : paused ? "Ⅱ  PAUSED" : "○  READY")}  ${dim("ONE MUSIC TRACK · LOCAL OUTPUT")}`);
    console.log(`${accent(crop(track.title.toUpperCase(), width - 2))}`);
    console.log(dim(`${crop(track.artist, Math.floor(width / 2))}  ·  ${crop(track.album, Math.floor(width / 2) - 5)}`));
    console.log(`\n${accent(waveform(tick, active, width))}`);
    console.log(`${dim("▔".repeat(width))}  ${dim(active ? "PLAYING" : paused ? "PAUSED — SPACE TO RESUME" : "ENTER TO PLAY")}`);
    console.log(`${remixMode ? accent("REMIX MODE  Q W E R T Y U I O P  /  A S D F G H") : dim("Press M for QWERTY piano remix notes over this track")}`);
    console.log(dim("─".repeat(width)));
    const start = Math.max(0, Math.min(selected - 2, tracks.length - 5));
    tracks.slice(start, start + 5).forEach((track, offset) => {
      const index = start + offset;
      const marker = index === selected ? accent("›") : " ";
      const playing = active && currentTrack?.id === track.id ? accent("▶") : " ";
      console.log(`${marker}${playing} ${String(index + 1).padStart(3, " ")}  ${crop(track.title, Math.max(25, width - 29))} ${dim(`— ${crop(track.artist, 20)}`)}`);
    });
    console.log(`\n${dim(`${tracks.length} local tracks · ${libraryPath}`)}`);
  };
  const stop = () => {
    if (child && !child.killed) { if (paused) child.kill("SIGCONT"); child.kill(); }
    child = null; currentTrack = null; paused = false; remixMode = false;
  };
  const pauseOrResume = () => {
    if (!child || child.killed) return;
    child.kill(paused ? "SIGCONT" : "SIGSTOP");
    paused = !paused;
  };
  render();
  const animation = setInterval(() => { tick += 1; render(); }, 180);
  process.stdin.setRawMode(true); process.stdin.resume();
  await new Promise((done) => process.stdin.on("data", async (key) => {
    const value = key.toString();
    if ((value === "x" || value === "\u0003" || (value === "q" && !remixMode))) { closed = true; clearInterval(animation); stop(); process.stdin.setRawMode(false); process.stdin.pause(); clearScreen(); done(); return; }
    if (value === "\u001b[A" || value === "k") selected = Math.max(0, selected - 1);
    if (value === "\u001b[B" || value === "j") selected = Math.min(tracks.length - 1, selected + 1);
    if (value === " ") pauseOrResume();
    if (value === "m" && currentTrack && !paused) remixMode = !remixMode;
    if (remixMode) { const note = remixKeys.indexOf(value.toLowerCase()); if (note >= 0) void playRemixNote(note); }
    if (value === "\r") { stop(); currentTrack = tracks[selected]; try { child = await playTrack(currentTrack); child.on("exit", () => { child = null; currentTrack = null; paused = false; remixMode = false; render(); }); } catch (error) { currentTrack = null; console.error(error.message); } }
    render();
  }));
}

function help() {
  console.log(`\n${accent("AHOY PLAYER / TERMINAL")}\n\n  ahoy scan <folder...>      add MP3s from local folders\n  ahoy library               list your local library\n  ahoy search <words>        find tracks\n  ahoy play <number|words>   play one track\n  ahoy tui                   browse with a small terminal deck\n\nmacOS uses the built-in afplay. Linux uses mpv, VLC (cvlc), or ffplay.\nLibrary metadata stays local: ${libraryPath}\n`);
}

export async function main(args = process.argv.slice(2)) {
  const [command = "help", ...rest] = args;
  if (["help", "--help", "-h"].includes(command)) return help();
  if (command === "scan") {
    if (!rest.length) throw new Error("Choose at least one folder, for example: ahoy scan ~/Music");
    const result = await scanDirectories(rest);
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
  if (command === "tui") return tui();
  throw new Error(`Unknown command: ${command}. Run \`ahoy help\`.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => { console.error(`ahoy: ${error.message}`); process.exitCode = 1; });
}
