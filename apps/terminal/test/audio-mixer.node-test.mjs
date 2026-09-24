import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { connect } from "node:net";
import { once } from "node:events";
import { AudioMixer, adjustLevel, channelVolume, volumeArgs } from "../audio-mixer.mjs";
import { spinningDisc } from "../terminal-art.mjs";

test("mixer routes keys, clamps gain, and master multiplies both channels", () => {
  const levels = { master: 100, song: 100, remix: 100 };
  assert.equal(adjustLevel(levels, "q"), false);
  adjustLevel(levels, "8"); adjustLevel(levels, "1"); adjustLevel(levels, "3");
  assert.deepEqual(levels, { master: 95, song: 95, remix: 95 });
  assert.equal(channelVolume(levels, "song"), 90.25);
  for (let i = 0; i < 30; i++) adjustLevel(levels, "8");
  assert.equal(channelVolume(levels, "song"), 0); assert.equal(channelVolume(levels, "remix"), 0);
  for (let i = 0; i < 30; i++) for (const key of ["9", "2", "4"]) adjustLevel(levels, key);
  assert.deepEqual(levels, { master: 100, song: 100, remix: 100 });
  assert.ok(volumeArgs("mpv", 25).includes("--volume=25"));
  assert.deepEqual(volumeArgs("afplay", 25), ["-v", "0.25"]);
});

test("CD frames loop, remain bounded, and support ASCII without artwork dependencies", () => {
  const first = spinningDisc(36, 8, 0), rotated = spinningDisc(36, 8, 5);
  assert.equal(first.braille.length, 8);
  assert.ok(first.braille.every(line => line.length === 36 && /^[\u2800-\u28ff]+$/.test(line)));
  assert.ok(first.ascii.every(line => /^[ .:\-=+*#@]+$/.test(line)));
  assert.notDeepEqual(first.braille, rotated.braille);
  assert.equal(spinningDisc(36, 8, 24), first);
});

function getVolume(socketPath) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath); let buffer = "";
    socket.setTimeout(1000, () => { socket.destroy(); reject(new Error("Timeout")); });
    socket.on("error", reject);
    socket.on("connect", () => socket.write('{"command":["get_property","volume"],"request_id":2}\n'));
    socket.on("data", data => {
      buffer += data.toString(); let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const result = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
        if (result.request_id === 2) { socket.destroy(); resolve(result.data); }
      }
    });
  });
}

test("live mpv mixing updates both playing channels without replacing processes", {
  skip: spawnSync("mpv", ["--version"], { stdio: "ignore" }).status !== 0, timeout: 10000
}, async () => {
  const mixer = new AudioMixer();
  const player = { command: "mpv", baseArgs: ["--no-config", "--no-video", "--ao=null", "--loop-file=inf", "--really-quiet"] };
  const track = new URL("../assets/ahoy-demo.mp3", import.meta.url).pathname;
  try {
    const song = await mixer.launch(player, track, "song");
    const remix = await mixer.launch(player, track, "remix");
    const songVoice = [...mixer.voices].find(v => v.channel === "song");
    const remixVoice = [...mixer.voices].find(v => v.channel === "remix");
    mixer.adjust("8"); mixer.adjust("1"); mixer.adjust("3"); mixer.adjust("3"); await mixer.update;
    assert.equal(mixer.status, "");
    assert.equal(await getVolume(songVoice.socketPath), 90.25);
    assert.equal(await getVolume(remixVoice.socketPath), 85.5);
    assert.equal(song.exitCode, null); assert.equal(remix.exitCode, null);
    for (let i = 0; i < 20; i++) mixer.adjust("8"); await mixer.update;
    assert.equal(await getVolume(songVoice.socketPath), 0);
    assert.equal(await getVolume(remixVoice.socketPath), 0);
    mixer.adjust("9"); await mixer.update;
    assert.equal(await getVolume(songVoice.socketPath), 4.75);
    const exits = [once(song, "exit"), once(remix, "exit")];
    mixer.close(); await Promise.all(exits); assert.equal(mixer.voices.size, 0);
  } finally { mixer.close(); }
});
