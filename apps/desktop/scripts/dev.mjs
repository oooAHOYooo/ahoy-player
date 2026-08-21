import { spawn, spawnSync } from "node:child_process";
import electronPath from "electron";

const build = spawnSync("npm", ["run", "build:electron"], { stdio: "inherit", shell: false });
if (build.status !== 0) process.exit(build.status ?? 1);

const vite = spawn("npm", ["run", "dev:renderer"], { stdio: "inherit", shell: false });
await waitForServer("http://127.0.0.1:5173");
const electron = spawn(electronPath, ["."], {
  stdio: "inherit",
  shell: false,
  env: { ...process.env, AHOY_RENDERER_URL: "http://127.0.0.1:5173" }
});

function stop(code = 0) {
  vite.kill("SIGTERM");
  if (!electron.killed) electron.kill("SIGTERM");
  process.exit(code);
}

electron.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function waitForServer(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Vite is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  vite.kill("SIGTERM");
  throw new Error(`Timed out waiting for ${url}`);
}
