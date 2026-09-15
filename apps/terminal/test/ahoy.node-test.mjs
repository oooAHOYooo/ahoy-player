import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { buildToneWav, labelsForPath } from "../ahoy.mjs";

const execFileAsync = promisify(execFile);

test("ships a bundled demo MP3 for first-run testing", () => {
  assert.equal(existsSync(new URL("../assets/ahoy-demo.mp3", import.meta.url)), true);
});

test("derives readable labels from conventional MP3 filenames", () => {
  assert.deepEqual(labelsForPath("/Music/Apollo/01 - Brian Eno - An Ending (Ascent).mp3"), {
    artist: "Brian Eno", title: "An Ending (Ascent)", album: "Apollo"
  });
});

test("uses a useful fallback for unstructured filenames", () => {
  assert.deepEqual(labelsForPath("/Music/Mixes/morning_walk.mp3"), {
    artist: "Unknown Artist", title: "morning walk", album: "Mixes"
  });
});

test("creates a valid mono WAV file for remix notes", () => {
  const wav = buildToneWav(440);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.ok(wav.length > 44);
});

test("scan writes the native player library schema", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ahoy-terminal-test-"));
  try {
    await writeFile(join(directory, "song.mp3"), "not audio, but enough to index");
    await execFileAsync(process.execPath, ["../ahoy.mjs", "scan", directory], {
      cwd: new URL(".", import.meta.url),
      env: { ...process.env, AHOY_PLAYER_HOME: join(directory, "data") }
    });
    const library = JSON.parse(await readFile(join(directory, "data", "library.json"), "utf8"));
    assert.equal(library.schema_version, 1);
    assert.equal(library.tracks.length, 1);
    assert.equal(library.tracks[0].id.startsWith("local:"), true);
    assert.equal(typeof library.tracks[0].fingerprint, "string");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
