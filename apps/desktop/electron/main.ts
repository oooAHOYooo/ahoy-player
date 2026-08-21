import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import { parseFile } from "music-metadata";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | undefined;
let deckWindow: BrowserWindow | undefined;

app.whenReady().then(() => {
  registerDesktopBridge();
  mainWindow = createMainWindow();
  app.on("activate", () => {
    if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createMainWindow();
    else mainWindow.focus();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: "#0b1113",
    title: "Ahoy Library",
    show: false,
    webPreferences: {
      preload: join(currentDirectory, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.once("ready-to-show", () => window.show());
  if (process.env.AHOY_RENDERER_URL) {
    void window.loadURL(process.env.AHOY_RENDERER_URL);
  } else {
    void window.loadFile(join(currentDirectory, "../dist/index.html"));
  }
  window.on("closed", () => {
    mainWindow = undefined;
    if (deckWindow && !deckWindow.isDestroyed()) deckWindow.close();
  });
  return window;
}

function registerDesktopBridge() {
  ipcMain.handle("ahoy:choose-mp3-files", async () => {
    const result = await dialog.showOpenDialog({
      title: "Import MP3 files",
      properties: ["openFile", "multiSelections"],
      filters: [{ name: "MP3 audio", extensions: ["mp3"] }]
    });
    if (result.canceled) return [];

    return Promise.all(result.filePaths.map(async (sourceLocator) => {
      const [details, fingerprint, audioDetails] = await Promise.all([
        stat(sourceLocator),
        hashFile(sourceLocator),
        readAudioDetails(sourceLocator)
      ]);
      return {
        filename: sourceLocator.split(/[\\/]/).at(-1) ?? sourceLocator,
        sourceLocator,
        byteSize: details.size,
        modifiedAt: details.mtime.toISOString(),
        mimeType: "audio/mpeg",
        fingerprint,
        ...audioDetails
      };
    }));
  });

  ipcMain.handle("ahoy:open-deck", (event) => {
    if (deckWindow && !deckWindow.isDestroyed()) {
      if (deckWindow.isMinimized()) deckWindow.restore();
      deckWindow.show();
      deckWindow.focus();
      return;
    }

    const parent = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
    deckWindow = new BrowserWindow({
      width: 430,
      height: 660,
      minWidth: 360,
      minHeight: 540,
      backgroundColor: "#0b1113",
      title: "Ahoy Deck",
      parent: parent && parent !== deckWindow ? parent : undefined,
      show: false,
      webPreferences: {
        preload: join(currentDirectory, "preload.mjs"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      }
    });
    deckWindow.once("ready-to-show", () => deckWindow?.show());
    deckWindow.on("closed", () => { deckWindow = undefined; });

    if (process.env.AHOY_RENDERER_URL) {
      const url = new URL(process.env.AHOY_RENDERER_URL);
      url.searchParams.set("view", "deck");
      void deckWindow.loadURL(url.toString());
    } else {
      void deckWindow.loadFile(join(currentDirectory, "../dist/index.html"), {
        query: { view: "deck" }
      });
    }
  });
}

function hashFile(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const digest = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("error", reject);
    stream.on("data", (chunk) => digest.update(chunk));
    stream.on("end", () => resolve(digest.digest("hex")));
  });
}

async function readAudioDetails(path: string) {
  try {
    const metadata = await parseFile(path, { duration: true, skipCovers: true });
    const title = metadata.common.title?.trim();
    const artistName = metadata.common.artist?.trim();
    const albumTitle = metadata.common.album?.trim();
    const trackNumber = metadata.common.track.no || undefined;
    const durationMs = metadata.format.duration ? Math.round(metadata.format.duration * 1_000) : undefined;
    return {
      ...(title || artistName || albumTitle || trackNumber
        ? { embeddedMetadata: { source: "id3" as const, title, artistName, albumTitle, trackNumber } }
        : {}),
      ...(durationMs ? { durationMs } : {})
    };
  } catch {
    return {};
  }
}
