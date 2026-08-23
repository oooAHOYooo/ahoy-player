import type { FileImportAdapter, ImportCandidate } from "@ahoy/player-core";
import { parseBlob } from "music-metadata";

const browserFileUrls = new Map<string, string>();

export class BrowserFileImportAdapter implements FileImportAdapter {
  readonly availability = "available" as const;

  async chooseMp3Files(): Promise<ImportCandidate[]> {
    const files = await openFilePicker();
    return candidatesFromFiles(files);
  }
}

export async function candidatesFromFiles(files: File[] | FileList): Promise<ImportCandidate[]> {
  return Promise.all(Array.from(files).map(async (file) => {
    const sourceLocator = `browser-file:${file.name}:${file.lastModified}:${file.size}`;
    const previousUrl = browserFileUrls.get(sourceLocator);
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    browserFileUrls.set(sourceLocator, URL.createObjectURL(file));
    const [fingerprint, audioDetails] = await Promise.all([sha256(file), readAudioDetails(file)]);
    return {
      filename: file.name,
      sourceLocator,
      byteSize: file.size,
      modifiedAt: new Date(file.lastModified).toISOString(),
      mimeType: file.type || "audio/mpeg",
      relativePath: file.webkitRelativePath || undefined,
      fingerprint,
      ...audioDetails
    };
  }));
}

/** Resolves a browser-imported file for the current session. Browser File objects are not persisted. */
export function browserFileUrl(sourceLocator: string): string | undefined {
  return browserFileUrls.get(sourceLocator);
}

async function openFilePicker(): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".mp3,audio/mpeg";
    input.multiple = true;
    input.addEventListener("change", () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener("cancel", () => resolve([]), { once: true });
    input.click();
  });
}

async function sha256(file: File): Promise<string | undefined> {
  if (!globalThis.crypto?.subtle) return undefined;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readAudioDetails(file: File): Promise<Pick<ImportCandidate, "embeddedMetadata" | "durationMs">> {
  try {
    const metadata = await parseBlob(file, { duration: true, skipCovers: true });
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
