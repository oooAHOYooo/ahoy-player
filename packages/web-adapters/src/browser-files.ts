import type { FileImportAdapter, ImportCandidate } from "@ahoy/player-core";

export class BrowserFileImportAdapter implements FileImportAdapter {
  readonly availability = "available" as const;

  async chooseMp3Files(): Promise<ImportCandidate[]> {
    const files = await openFilePicker();
    return candidatesFromFiles(files);
  }
}

export async function candidatesFromFiles(files: File[] | FileList): Promise<ImportCandidate[]> {
  return Promise.all(Array.from(files).map(async (file) => ({
    filename: file.name,
    sourceLocator: `browser-file:${file.name}:${file.lastModified}:${file.size}`,
    byteSize: file.size,
    modifiedAt: new Date(file.lastModified).toISOString(),
    mimeType: file.type || "audio/mpeg",
    relativePath: file.webkitRelativePath || undefined,
    fingerprint: await sha256(file)
  })));
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
