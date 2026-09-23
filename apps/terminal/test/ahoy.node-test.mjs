import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { buildSfxCueWav, buildSynthWav, buildToneWav, labelsForPath, main, pianoKeyMap, remixFrequencies, remixKeys } from "../ahoy.mjs";

const execFileAsync = promisify(execFile);
const testDirectory = fileURLToPath(new URL(".", import.meta.url));
const cliPath = fileURLToPath(new URL("../ahoy.mjs", import.meta.url));

test("ships a bundled demo MP3 for first-run testing", () => {
  assert.equal(existsSync(new URL("../assets/ahoy-demo.mp3", import.meta.url)), true);
});

test("reports the package version through the public CLI command", async () => {
  const output = [];
  const log = console.log;
  console.log = (value) => output.push(value);
  try {
    await main(["--version"]);
  } finally {
    console.log = log;
  }
  const manifest = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.deepEqual(output, [manifest.version]);
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

test("maps all 26 alphabet keys (A-Z) in pianoKeyMap and remixKeys", () => {
  assert.equal(remixKeys.length, 26);
  assert.equal(remixFrequencies.length, 26);
  for (let code = 97; code <= 122; code += 1) {
    const letter = String.fromCharCode(code);
    assert.ok(pianoKeyMap[letter], `Key ${letter} should be present in pianoKeyMap`);
    assert.ok(pianoKeyMap[letter].frequency > 0, `Frequency for ${letter} should be positive`);
  }
});

test("arranges piano keys with sharps on top row and naturals on home row", () => {
  // Home row white keys
  assert.equal(pianoKeyMap.a.note, "C4");
  assert.equal(pianoKeyMap.s.note, "D4");
  assert.equal(pianoKeyMap.d.note, "E4");
  assert.equal(pianoKeyMap.f.note, "F4");
  assert.equal(pianoKeyMap.g.note, "G4");
  assert.equal(pianoKeyMap.h.note, "A4");
  assert.equal(pianoKeyMap.j.note, "B4");
  assert.equal(pianoKeyMap.k.note, "C5");
  assert.equal(pianoKeyMap.l.note, "D5");

  // Top row sharps aligned above naturals
  assert.equal(pianoKeyMap.w.note, "C#4");
  assert.equal(pianoKeyMap.e.note, "D#4");
  assert.equal(pianoKeyMap.t.note, "F#4");
  assert.equal(pianoKeyMap.y.note, "G#4");
  assert.equal(pianoKeyMap.u.note, "A#4");
  assert.equal(pianoKeyMap.o.note, "C#5");
  assert.equal(pianoKeyMap.p.note, "D#5");

  // Bottom row bass naturals
  assert.equal(pianoKeyMap.z.note, "C3");
  assert.equal(pianoKeyMap.m.note, "B3");
});

test("buildSynthWav creates a valid multi-tap delay synth WAV", () => {
  const synthWav = buildSynthWav(440, 1.0);
  assert.equal(synthWav.toString("ascii", 0, 4), "RIFF");
  assert.equal(synthWav.toString("ascii", 8, 12), "WAVE");
  assert.equal(synthWav.readUInt16LE(22), 1); // 1 channel
  assert.equal(synthWav.readUInt32LE(24), 22050); // sample rate
  assert.ok(synthWav.length > 44);

  // Volume scaling test
  const quietWav = buildSynthWav(440, 0.2);
  assert.equal(quietWav.length, synthWav.length);

  // Max amplitude of quiet wav should be lower than full wav
  let maxFull = 0;
  let maxQuiet = 0;
  for (let i = 44; i < synthWav.length; i += 2) {
    const sFull = Math.abs(synthWav.readInt16LE(i));
    const sQuiet = Math.abs(quietWav.readInt16LE(i));
    if (sFull > maxFull) maxFull = sFull;
    if (sQuiet > maxQuiet) maxQuiet = sQuiet;
  }
  assert.ok(maxFull > maxQuiet, "Full volume synth wave should have higher peak than quiet wave");
});

test("applies special SFX modifiers to synth notes", () => {
  const regularWav = buildSynthWav(440, 1.0);
  const echoWav = buildSynthWav(440, 1.0, { echo: true });
  const chorusWav = buildSynthWav(440, 1.0, { chorus: true });
  const lofiWav = buildSynthWav(440, 1.0, { lofi: true });

  assert.ok(echoWav.length > regularWav.length, "Dub echo mode should have extended delay length");
  assert.equal(chorusWav.toString("ascii", 0, 4), "RIFF");
  assert.equal(lofiWav.toString("ascii", 0, 4), "RIFF");
});

test("generates valid SFX audio cues for toggles 1, 2, and 3", () => {
  for (const cue of [1, 2, 3]) {
    const wav = buildSfxCueWav(cue);
    assert.equal(wav.toString("ascii", 0, 4), "RIFF");
    assert.ok(wav.length > 44);
  }
});

test("scan writes the native player library schema", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ahoy-terminal-test-"));
  try {
    await writeFile(join(directory, "song.mp3"), "not audio, but enough to index");
    await execFileAsync(process.execPath, [cliPath, "scan", directory], {
      cwd: testDirectory,
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

test("rescan refreshes folders already present in the saved library", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ahoy-terminal-rescan-test-"));
  const dataDirectory = join(directory, "data");
  try {
    await writeFile(join(directory, "first.mp3"), "first");
    await execFileAsync(process.execPath, [cliPath, "scan", directory], {
      cwd: testDirectory,
      env: { ...process.env, AHOY_PLAYER_HOME: dataDirectory }
    });
    await writeFile(join(directory, "second.mp3"), "second");
    await execFileAsync(process.execPath, [cliPath, "rescan"], {
      cwd: testDirectory,
      env: { ...process.env, AHOY_PLAYER_HOME: dataDirectory }
    });
    const library = JSON.parse(await readFile(join(dataDirectory, "library.json"), "utf8"));
    assert.equal(library.tracks.length, 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
