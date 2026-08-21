import type {
  ImportBatchResult,
  ImportCandidate,
  ImportDuplicate,
  ImportRejection,
  LibraryRecord,
  NormalizedTrackImport
} from "@ahoy/player-core";

const UNKNOWN_ARTIST = "Unknown Artist";
const LOCAL_IMPORTS = "Local Imports";
const GENERIC_DIRECTORIES = new Set(["music", "downloads", "download", "audio", "mp3", "files"]);

export type ImportPipelineOptions = {
  now?: () => string;
};

export function runImportPipeline(
  candidates: ImportCandidate[],
  library?: LibraryRecord,
  options: ImportPipelineOptions = {}
): ImportBatchResult {
  const now = options.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const accepted: NormalizedTrackImport[] = [];
  const duplicates: ImportDuplicate[] = [];
  const rejected: ImportRejection[] = [];
  const existingKeys = new Map<string, string>();
  const batchKeys = new Set<string>();

  for (const track of library?.tracks ?? []) {
    if (track.source.kind === "local-file") existingKeys.set(track.source.duplicateKey, track.id);
  }

  for (const candidate of candidates) {
    const rejection = validateCandidate(candidate);
    if (rejection) {
      rejected.push({ candidate, reason: rejection });
      continue;
    }

    const duplicateKey = createDuplicateKey(candidate);
    const existingTrackId = existingKeys.get(duplicateKey);
    if (existingTrackId) {
      duplicates.push({ candidate, duplicateKey, existingTrackId, reason: "already-in-library" });
      continue;
    }
    if (batchKeys.has(duplicateKey)) {
      duplicates.push({ candidate, duplicateKey, reason: "repeated-in-batch" });
      continue;
    }

    batchKeys.add(duplicateKey);
    accepted.push(normalizeImport(candidate, startedAt, duplicateKey));
  }

  const completedAt = now();
  return {
    accepted,
    duplicates,
    rejected,
    receipt: {
      id: `import:${hashText(`${startedAt}:${candidates.length}:${accepted.map((item) => item.id).join(":")}`)}`,
      startedAt,
      completedAt,
      requested: candidates.length,
      imported: accepted.length,
      duplicates: duplicates.length,
      rejected: rejected.length
    }
  };
}

export function normalizeImport(
  input: ImportCandidate,
  importedAt = new Date().toISOString(),
  duplicateKey = createDuplicateKey(input)
): NormalizedTrackImport {
  const parsed = parseFilename(input.filename, input.relativePath);
  const embedded = normalizeEmbeddedMetadata(input.embeddedMetadata);
  return {
    id: createStableTrackId(duplicateKey),
    filename: input.filename,
    sourceLocator: input.sourceLocator,
    title: embedded.title ?? parsed.title,
    artistName: embedded.artistName ?? parsed.artist,
    albumTitle: embedded.albumTitle ?? parsed.album,
    trackNumber: embedded.trackNumber ?? parsed.trackNumber,
    durationMs: input.durationMs,
    byteSize: input.byteSize,
    fingerprint: input.fingerprint,
    duplicateKey,
    importedAt,
    metadataPolicy: embedded.hasValues
      ? "embedded-tag"
      : parsed.usedPathFallback
        ? "path-fallback"
        : "filename-only"
  };
}

export function normalizeImportBatch(imports: ImportCandidate[]): NormalizedTrackImport[] {
  return runImportPipeline(imports).accepted;
}

export function createDuplicateKey(input: ImportCandidate): string {
  if (input.fingerprint?.trim()) {
    return `sha256:${input.fingerprint.toLowerCase().replace(/^sha256:/, "").trim()}`;
  }
  const normalizedName = input.filename.normalize("NFKC").trim().toLowerCase();
  return `file:${normalizedName}:${input.byteSize}`;
}

export function parseFilename(
  filename: string,
  relativePath?: string
): { title: string; artist: string; album: string; trackNumber?: number; usedPathFallback: boolean } {
  const rawStem = decodeLabel(filename.replace(/\.mp3$/i, ""));
  const prefix = rawStem.match(/^\s*(?:\[)?(\d{1,3})(?:\])?[\s._-]+(.+)$/);
  const trackNumber = prefix ? Number(prefix[1]) : undefined;
  const stem = cleanLabel(prefix?.[2] ?? rawStem);
  const parts = stem.split(/\s+-\s+/).map(cleanLabel).filter(Boolean);
  const pathLabels = getPathLabels(relativePath);

  let title = stem;
  let artist = UNKNOWN_ARTIST;
  let album = LOCAL_IMPORTS;
  let usedPathFallback = false;

  if (parts.length >= 4 && /^\d{1,3}$/.test(parts.at(-2) ?? "")) {
    artist = parts[0];
    album = parts.slice(1, -2).join(" — ");
    title = parts.at(-1) ?? stem;
  } else if (parts.length >= 3) {
    artist = parts[0];
    album = parts.slice(1, -1).join(" — ");
    title = parts.at(-1) ?? stem;
  } else if (parts.length === 2) {
    artist = parts[0];
    title = parts[1];
    if (pathLabels.album) {
      album = pathLabels.album;
      usedPathFallback = true;
    }
  } else {
    title = parts[0] ?? stem;
    if (pathLabels.artist) {
      artist = pathLabels.artist;
      usedPathFallback = true;
    }
    if (pathLabels.album) {
      album = pathLabels.album;
      usedPathFallback = true;
    }
  }

  return {
    title: cleanLabel(title) || "Untitled",
    artist: cleanLabel(artist) || UNKNOWN_ARTIST,
    album: cleanLabel(album) || LOCAL_IMPORTS,
    trackNumber,
    usedPathFallback
  };
}

function validateCandidate(candidate: ImportCandidate): ImportRejection["reason"] | undefined {
  if (!/\.mp3$/i.test(candidate.filename) && candidate.mimeType !== "audio/mpeg") return "not-mp3";
  if (candidate.byteSize <= 0) return "empty-file";
  if (!candidate.filename.replace(/\.mp3$/i, "").trim()) return "invalid-name";
  return undefined;
}

function createStableTrackId(duplicateKey: string): string {
  const fingerprint = duplicateKey.startsWith("sha256:") ? duplicateKey.slice(7, 31) : hashText(duplicateKey);
  return `local:${fingerprint}`;
}

function getPathLabels(relativePath?: string): { artist?: string; album?: string } {
  if (!relativePath) return {};
  const segments = relativePath.split(/[\\/]/).map(cleanLabel).filter(Boolean);
  segments.pop();
  const album = meaningfulDirectory(segments.at(-1));
  const artist = meaningfulDirectory(segments.at(-2));
  return { artist, album };
}

function meaningfulDirectory(value?: string): string | undefined {
  if (!value || GENERIC_DIRECTORIES.has(value.toLowerCase())) return undefined;
  return value;
}

function decodeLabel(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function cleanLabel(value: string): string {
  return value
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[-–—\s]+|[-–—\s]+$/g, "")
    .trim();
}

function normalizeEmbeddedMetadata(input: ImportCandidate["embeddedMetadata"]): {
  hasValues: boolean;
  title?: string;
  artistName?: string;
  albumTitle?: string;
  trackNumber?: number;
} {
  const title = cleanLabel(input?.title ?? "") || undefined;
  const artistName = cleanLabel(input?.artistName ?? "") || undefined;
  const albumTitle = cleanLabel(input?.albumTitle ?? "") || undefined;
  const trackNumber = input?.trackNumber && input.trackNumber > 0 ? input.trackNumber : undefined;
  return {
    hasValues: Boolean(title || artistName || albumTitle || trackNumber),
    title,
    artistName,
    albumTitle,
    trackNumber
  };
}

/** Small deterministic hash for IDs only; file fingerprints should use SHA-256 in the host. */
function hashText(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
