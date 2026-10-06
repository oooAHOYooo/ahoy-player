import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";

const appHome = process.env.AHOY_PLAYER_HOME || join(process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "ahoy-player");
const authPath = join(appHome, "auth.json");
const issuer = (process.env.AHOY_ID_ISSUER || "https://id.ahoy.ooo").replace(/\/$/, "");
const clientId = "app.ahoy.player";
const redirectUri = "http://127.0.0.1:3021/callback";

export async function getAhoyId() {
  try {
    const data = JSON.parse(await readFile(authPath, "utf-8"));
    return data.ahoy_id || null;
  } catch {
    return null;
  }
}

export async function saveAhoyId(ahoy_id) {
  await mkdir(appHome, { recursive: true });
  await writeFile(authPath, JSON.stringify({ ahoy_id }), { encoding: "utf-8", mode: 0o600 });
}

export async function logout() {
  await mkdir(appHome, { recursive: true });
  await writeFile(authPath, JSON.stringify({}), { encoding: "utf-8", mode: 0o600 });
}

export function openBrowser(url) {
  if (process.env.AHOY_ID_NO_BROWSER === "1") return;
  const [command, args] = platform() === "darwin"
    ? ["open", [url]]
    : platform() === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

export async function startLoginFlow(showQr = false) {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(3021, "127.0.0.1", resolve);
  });

  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const loginUrl = new URL(`${issuer}/oauth/authorize`);
  Object.entries({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).forEach(([key, value]) => loginUrl.searchParams.set(key, value));

  try {
    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("AHOY ID sign-in timed out")), 5 * 60_000);
      server.once("close", () => clearTimeout(timeout));
      server.on("request", (req, res) => {
        const callback = new URL(req.url || "/", redirectUri);
        if (req.method !== "GET" || callback.pathname !== "/callback") {
          res.writeHead(404).end("Not found");
          return;
        }
        const returnedState = callback.searchParams.get("state") || "";
        const expected = Buffer.from(state);
        const received = Buffer.from(returnedState);
        if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
          res.writeHead(400, { "cache-control": "no-store" }).end("Sign-in state did not match. Return to Ahoy Player and try again.");
          server.close();
          reject(new Error("AHOY ID callback state did not match"));
          return;
        }
        const error = callback.searchParams.get("error");
        if (error) {
          res.writeHead(400, { "cache-control": "no-store" }).end("Sign-in was cancelled. You can close this tab.");
          server.close();
          reject(new Error(`AHOY ID authorization failed: ${error}`));
          return;
        }
        const authCode = callback.searchParams.get("code");
        if (!authCode) {
          res.writeHead(400, { "cache-control": "no-store" }).end("AHOY ID did not return an authorization code.");
          return;
        }
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" })
          .end("<!doctype html><meta charset=utf-8><title>Ahoy Player</title><h1>Sign-in complete</h1><p>You can close this tab and return to Ahoy Player.</p>");
        server.close();
        resolve(authCode);
      });
      openBrowser(loginUrl.toString());
      if (showQr) {
        console.log("\nIf the browser did not open, visit this link:");
        console.log(`\n  ${loginUrl}\n`);
        console.log("Open the link on this computer so the callback can return to the player.\n");
        import("qrcode-terminal").then(({ default: qrcode }) => qrcode.generate(loginUrl.toString(), { small: true })).catch(() => {});
      }
    });

    const tokenResponse = await fetch(`${issuer}/api/v1/oauth/token`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "authorization_code", code, client_id: clientId, redirect_uri: redirectUri, code_verifier: verifier }),
    });
    if (!tokenResponse.ok) throw new Error(`AHOY ID token exchange failed (HTTP ${tokenResponse.status})`);
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || token.token_type?.toLowerCase() !== "bearer") throw new Error("AHOY ID returned an invalid token response");

    const userinfoResponse = await fetch(`${issuer}/api/v1/oauth/userinfo`, { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!userinfoResponse.ok) throw new Error(`AHOY ID identity lookup failed (HTTP ${userinfoResponse.status})`);
    const userinfo = await userinfoResponse.json();
    if (typeof userinfo.sub !== "string" || !userinfo.sub.trim()) throw new Error("AHOY ID returned an invalid identity");
    await saveAhoyId(userinfo.sub);
    return userinfo.sub;
  } finally {
    server.close();
  }
}
