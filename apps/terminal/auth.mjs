import { join } from "node:path";
import { homedir, platform } from "node:os";
import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { exec } from "node:child_process";

const appHome = process.env.AHOY_PLAYER_HOME || join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "ahoy-player");
const authPath = join(appHome, "auth.json");

export async function getAhoyId() {
  try {
    const data = JSON.parse(await readFile(authPath, "utf-8"));
    return data.ahoy_id || null;
  } catch {
    return null;
  }
}

export async function saveAhoyId(ahoy_id) {
  await writeFile(authPath, JSON.stringify({ ahoy_id }), "utf-8");
}

export async function logout() {
  await writeFile(authPath, JSON.stringify({}), "utf-8");
}

export function openBrowser(url) {
  const start = platform() === 'darwin' ? 'open' : platform() === 'win32' ? 'start' : 'xdg-open';
  exec(`${start} "${url}"`);
}

import qrcode from "qrcode-terminal";

const useColor = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);
const tint = (code, value) => useColor ? `\x1b[${code}m${value}\x1b[0m` : value;
const accent = (value) => tint("38;5;156", value);

export async function startLoginFlow(useDeviceFlow = false) {
  return new Promise(async (resolve, reject) => {
    // 1. Hypothetical Device Flow (if backend supports it)
    if (useDeviceFlow) {
      console.log("\nInitiating Device Code flow...");
      try {
        const res = await fetch("https://id.ahoy.ooo/oauth/device/code", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          console.log(`\nPlease visit: ${accent(data.verification_uri)}`);
          console.log(`And enter the code: ${accent(data.user_code)}\n`);
          qrcode.generate(data.verification_uri + "?user_code=" + data.user_code, { small: true });
          
          // Poll for completion
          const interval = setInterval(async () => {
            const poll = await fetch(`https://id.ahoy.ooo/oauth/device/token?device_code=${data.device_code}`, { method: "POST" });
            if (poll.ok) {
              const tokenData = await poll.json();
              clearInterval(interval);
              await saveAhoyId(tokenData.ahoy_id);
              resolve(tokenData.ahoy_id);
            }
          }, (data.interval || 5) * 1000);
          return;
        }
      } catch (e) {
        console.log("Device flow endpoint not available yet. Falling back to local browser flow...");
      }
    }

    // 2. Standard Localhost Redirect Flow
    const server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, `http://localhost:3021`);
        if (url.pathname === "/callback") {
          const ahoy_id = url.searchParams.get("ahoy_id");
          if (ahoy_id) {
            await saveAhoyId(ahoy_id);
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end("<html><body><h1>Logged in!</h1><p>You can close this window and return to Ahoy Player.</p><script>setTimeout(() => window.close(), 3000)</script></body></html>");
            server.close();
            resolve(ahoy_id);
          } else {
            res.writeHead(400);
            res.end("Missing ahoy_id in callback");
          }
        } else {
          res.writeHead(404);
          res.end("Not found");
        }
      } catch (err) {
        res.writeHead(500);
        res.end(err.message);
      }
    });
    
    server.listen(3021, () => {
      const loginUrl = `https://id.ahoy.ooo/login?client_id=ahoy-player&redirect_uri=http://127.0.0.1:3021/callback`;
      openBrowser(loginUrl);
      if (useDeviceFlow) {
        console.log(`\nOpening your browser to authenticate...`);
        console.log(`If your browser doesn't open automatically, please visit this link:\n\n  ${loginUrl}\n`);
        console.log(`Or scan this QR code on a device that can reach localhost:3021:\n`);
        qrcode.generate(loginUrl, { small: true });
      }
    });
    
    server.on('error', (err) => {
      reject(err);
    });
  });
}
