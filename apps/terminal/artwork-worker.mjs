import { parentPort } from "node:worker_threads";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { ArtCache, artworkHash, renderSize } from "./terminal-art.mjs";

const exec = promisify(execFile);
const sources = new ArtCache(64), images = new ArtCache(32), variants = new ArtCache(128);
const options = { encoding: "buffer", maxBuffer: 20 * 1024 * 1024, timeout: 8000 };

async function loadSource(path) {
  const info = await stat(path);
  return sources.get(`${path}:${info.size}:${info.mtimeMs}`, async () => {
    let metadata = {};
    try {
      const result = await exec("ffprobe", ["-v", "error", "-show_entries", "format=duration:format_tags=title,artist,album", "-of", "json", path], options);
      metadata = JSON.parse(result.stdout.toString()).format ?? {};
    } catch { /* Library labels and unknown duration remain usable. */ }
    let bytes;
    try {
      const result = await exec("ffmpeg", ["-v", "error", "-nostdin", "-i", path, "-map", "0:v:0", "-frames:v", "1", "-c:v", "copy", "-f", "image2pipe", "pipe:1"], options);
      if (result.stdout.length) bytes = result.stdout;
    } catch (error) {
      if (error.code === "ENOENT") return { metadata, message: "Install FFmpeg for album artwork." };
    }
    if (!bytes) for (const name of ["cover.jpg", "cover.png", "folder.jpg", "folder.png", "Cover.jpg", "Cover.png", "Folder.jpg", "Folder.png"]) {
      try { const candidate = join(dirname(path), name); if ((await stat(candidate)).size <= options.maxBuffer) bytes = await readFile(candidate); if (bytes) break; } catch { /* Try the next conventional cover name. */ }
    }
    if (!bytes) return { metadata, message: "No album artwork · embedded cover or cover.jpg / cover.png" };
    const hash = artworkHash(bytes);
    const gray = await images.get(hash, async () => {
      // Feed compressed cover bytes through stdin; no shell or temporary files.
      return new Promise((resolve, reject) => {
        const child = execFile("ffmpeg", ["-v", "error", "-nostdin", "-threads", "1", "-i", "pipe:0", "-vf", "scale=180:180:force_original_aspect_ratio=decrease,pad=180:180:(ow-iw)/2:(oh-ih)/2:black,format=gray", "-frames:v", "1", "-f", "rawvideo", "pipe:1"], options, (error, stdout) => {
          if (error || stdout.length !== 180 * 180) reject(new Error("Artwork could not be decoded.")); else resolve(stdout);
        });
        child.stdin.on("error", () => {}); child.stdin.end(bytes);
      });
    });
    return { metadata, hash, gray };
  });
}

let latest, busy = false;
parentPort.on("message", (request) => { latest = request; void drain(); });
async function drain() {
  if (busy) return;
  busy = true;
  while (latest) {
    const request = latest; latest = null;
    try {
      const source = await loadSource(request.path);
      const art = source.gray ? await variants.get(`${source.hash}:${request.columns}`, () => renderSize(source.gray, request.columns)) : null;
      parentPort.postMessage({ id: request.id, art, metadata: source.metadata, message: source.message });
    } catch { parentPort.postMessage({ id: request.id, message: "Artwork unavailable · normal deck is still available (v)." }); }
  }
  busy = false;
}
