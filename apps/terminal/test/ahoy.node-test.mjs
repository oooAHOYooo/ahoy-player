import assert from "node:assert/strict";
import test from "node:test";
import { buildToneWav, labelsForPath } from "../ahoy.mjs";

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
