import { spawn } from "node:child_process";
import { connect } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const bindings = { "1": ["song", -5], "2": ["song", 5], "3": ["remix", -5], "4": ["remix", 5], "8": ["master", -5], "9": ["master", 5] };
export function adjustLevel(levels, key) {
  const binding = bindings[key];
  if (!binding) return false;
  const [channel, delta] = binding;
  levels[channel] = Math.max(0, Math.min(100, levels[channel] + delta));
  return true;
}
export const channelVolume = (levels, channel) => levels.master * levels[channel] / 100;
export function volumeArgs(command, volume) {
  if (command === "mpv") return [`--volume=${volume}`, "--volume-max=100", "--audio-display=no"];
  if (command === "ffplay") return ["-volume", String(Math.round(volume))];
  if (command === "afplay") return ["-v", String(volume / 100)];
  if (command === "cvlc") return ["--gain", String(volume / 100)];
  return [];
}

export function sendVolume(socketPath, volume) {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath);
    let buffer = "";
    const finish = (error) => { socket.destroy(); error ? reject(error) : resolve(); };
    socket.setTimeout(500, () => finish(new Error("Mixer connection timed out")));
    socket.once("error", finish);
    socket.once("connect", () => socket.write(`${JSON.stringify({ command: ["set_property", "volume", volume], request_id: 1 })}\n`));
    socket.on("data", data => {
      buffer += data.toString();
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        try {
          const result = JSON.parse(line);
          if (result.request_id === 1) finish(result.error === "success" ? null : new Error(result.error));
        } catch { finish(new Error("Invalid mixer response")); }
      }
    });
    socket.once("end", () => finish(new Error("Mixer connection closed")));
  });
}

export class AudioMixer {
  levels = { master: 100, song: 100, remix: 100 };
  voices = new Set();
  status = "";
  paused = false;
  closed = false;
  update = Promise.resolve();

  async launch(player, path, channel, stdio = "ignore") {
    const directory = player.command === "mpv" ? await mkdtemp(join(tmpdir(), "ahoy-mix-")) : null;
    if (this.closed) { if (directory) await rm(directory, { recursive: true, force: true }); throw new Error("Mixer closed"); }
    const socketPath = directory ? join(directory, "control.sock") : null;
    const args = [...player.baseArgs, ...volumeArgs(player.command, channelVolume(this.levels, channel)),
      ...(socketPath ? [`--input-ipc-server=${socketPath}`] : []), path];
    const child = spawn(player.command, args, { stdio });
    const voice = { child, channel, socketPath };
    this.voices.add(voice);
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return; cleaned = true;
      this.voices.delete(voice);
      if (directory) void rm(directory, { recursive: true, force: true }).catch(() => {});
    };
    child.once("exit", cleanup); child.once("error", cleanup);
    await new Promise((resolve, reject) => { child.once("spawn", resolve); child.once("error", reject); });
    if (!socketPath) this.status = "Install mpv for live mixing; levels apply on next playback.";
    return child;
  }

  adjust(key) {
    if (!adjustLevel(this.levels, key)) return false;
    this.apply(); return true;
  }

  apply() {
    // Serialize rapid key presses so an older IPC request cannot win the race.
    this.update = this.update.then(async () => {
      await Promise.all([...this.voices].map(async voice => {
        if (!voice.socketPath || (this.paused && voice.channel === "song")) return;
        for (let attempt = 0; attempt < 8; attempt++) {
          if (!this.voices.has(voice) || voice.child.killed) return;
          try { await sendVolume(voice.socketPath, channelVolume(this.levels, voice.channel)); this.status = ""; return; }
          catch { if (attempt < 7) await new Promise(resolve => setTimeout(resolve, 50)); }
        }
        if (this.voices.has(voice)) this.status = "Could not update playback volume.";
      }));
    });
    return this.update;
  }

  stopRemix() { for (const voice of this.voices) if (voice.channel === "remix") voice.child.kill(); }
  close() { this.closed = true; for (const voice of this.voices) { voice.child.kill("SIGCONT"); voice.child.kill(); } }
}
