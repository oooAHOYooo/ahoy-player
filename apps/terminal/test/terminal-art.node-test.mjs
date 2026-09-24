import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { once } from "node:events";
import { execFileSync, spawnSync } from "node:child_process";
import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ArtCache, artworkHash, artColumns, brailleMask, imageToBraille, renderSize, clockLabel, terminalText } from "../terminal-art.mjs";

test("maps all eight braille dots to their Unicode bits", () => {
  for (const [index, bit] of [0, 3, 1, 4, 2, 5, 6, 7].entries()) {
    const dots = Array(8).fill(0); dots[index] = 1;
    assert.equal(brailleMask(dots), 1 << bit);
    assert.equal(imageToBraille(Uint8Array.from(dots, n => n * 255), 2, 4).braille[0], String.fromCodePoint(0x2800 + (1 << bit)));
  }
});
test("black/white extremes, contrast, dithering and ASCII fallback", () => {
  assert.deepEqual(imageToBraille(new Uint8Array(8), 2, 4), { braille: ["⠀"], ascii: [" "] });
  assert.deepEqual(imageToBraille(new Uint8Array(8).fill(255), 2, 4), { braille: ["⣿"], ascii: ["@"] });
  const mid = imageToBraille(new Uint8Array(32).fill(128), 8, 4);
  assert.ok(mid.braille[0].split("").every(c => c !== "⠀" && c !== "⣿"));
  assert.equal(imageToBraille(Uint8Array.from([100, 150, 100, 150, 100, 150, 100, 150]), 2, 4).braille[0], "⢸");
  assert.throws(() => imageToBraille(new Uint8Array(7), 2, 4));
});
test("adaptive dimensions respect both terminal axes", () => {
  for (const [width, height] of [[120,60],[80,24],[40,30],[160,80]]) {
    const columns = artColumns(width, height);
    const art = renderSize(new Uint8Array(180 * 180), columns);
    assert.ok(columns <= 90 && columns <= width - 4);
    assert.ok(art.braille.length + 15 <= height);
    assert.equal(art.braille[0].length, columns);
  }
});
test("cache shares in-flight and completed work by content hash", async () => {
  const cache = new ArtCache(2); let calls = 0;
  const create = () => { calls++; return { art: "cover" }; };
  const key = artworkHash(Buffer.from("cover"));
  const first = cache.get(key, create), second = cache.get(artworkHash(Buffer.from("cover")), create);
  assert.equal(first, second); assert.equal(await first, await cache.get(key, create)); assert.equal(calls, 1);
  await cache.get("b", create); await cache.get(key, create); await cache.get("c", create);
  assert.ok(!cache.entries.has("b")); assert.equal(cache.entries.size, 2);
  await assert.rejects(cache.get("bad", () => { throw new Error("bad"); }));
  assert.equal(await cache.get("bad", () => "retry"), "retry");
});
test("clock labels and terminal-safe metadata", () => {
  assert.equal(clockLabel(125), "2:05"); assert.equal(clockLabel(NaN), "--:--");
  assert.ok(!terminalText("bad\x1b[2J\nname").includes("\x1b"));
});

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;
test("worker extracts embedded art, shares album conversion, and reports missing covers", { skip: !hasFfmpeg, timeout: 15000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "ahoy-art-test-"));
  const worker = new Worker(new URL("../artwork-worker.mjs", import.meta.url));
  try {
    const cover = join(directory, "fixture.png"), track = join(directory, "covered.mp3");
    execFileSync("ffmpeg", ["-v","error","-f","lavfi","-i","testsrc=size=1000x1000","-frames:v","1",cover]);
    execFileSync("ffmpeg", ["-v","error","-f","lavfi","-i","sine=duration=1","-i",cover,"-map","0:a","-map","1:v","-c:a","libmp3lame","-c:v","copy","-disposition:v","attached_pic","-metadata","title=Test cover",track]);
    const request = async (id, path, columns) => { const response = once(worker, "message"); worker.postMessage({ id, path, columns }); return (await response)[0]; };
    const start = performance.now(); const result = await request(1, track, 72); const duration = performance.now()-start;
    assert.equal(result.art.braille.length, 36); assert.equal(result.metadata.tags.title, "Test cover");
    assert.ok(Number(result.metadata.duration) > 0);
    console.log(`1000px embedded artwork including worker/extraction: ${Math.round(duration)}ms`);
    // Timing is reported, not asserted: loaded CI hosts should not fail randomly.
    const cached = await request(2, track, 72); assert.deepEqual(cached.art, result.art);
    const sameAlbum = join(directory, "second.mp3"); await copyFile(track, sameAlbum);
    const shared = await request(6, sameAlbum, 72); assert.deepEqual(shared.art, result.art);
    const resized = await request(3, track, 36); assert.equal(resized.art.braille.length, 18);
    const empty = await request(4, new URL("../assets/ahoy-demo.mp3", import.meta.url).pathname, 36);
    assert.ok(empty.art || empty.message);
    const missing = await request(5, join(directory, "missing.mp3"), 36); assert.match(missing.message, /unavailable/);
    const sidecarTrack = join(directory, "sidecar.mp3");
    await copyFile(new URL("../assets/ahoy-demo.mp3", import.meta.url), sidecarTrack);
    execFileSync("ffmpeg", ["-v","error","-f","lavfi","-i","color=white:size=800x200","-frames:v","1",join(directory,"cover.png")]);
    const sidecar = await request(7, sidecarTrack, 72);
    assert.ok(sidecar.art);
    assert.ok(sidecar.art.braille[0].split("").every(c => c === "⠀"));
    assert.ok(sidecar.art.braille.at(-1).split("").every(c => c === "⠀"));
    assert.ok(sidecar.art.braille[18].includes("⣿"), "landscape art fits without stretching, with black padding");
  } finally { await worker.terminate(); await rm(directory, { recursive: true, force: true }); }
});
