import type {
  AlbumRecord,
  ArtistRecord,
  ImportBatchResult,
  LibraryRecord,
  NormalizedTrackImport,
  TrackRecord
} from "./types";

const EMPTY_DATE = "1970-01-01T00:00:00.000Z";

export function createEmptyLibrary(updatedAt = EMPTY_DATE): LibraryRecord {
  return { schemaVersion: 1, tracks: [], albums: [], artists: [], imports: [], updatedAt };
}

export function mergeImportBatch(library: LibraryRecord, batch: ImportBatchResult): LibraryRecord {
  const tracks = [...library.tracks, ...batch.accepted.map(toTrackRecord)];
  return {
    schemaVersion: 1,
    tracks,
    artists: buildArtists(tracks),
    albums: buildAlbums(tracks),
    imports: [batch.receipt, ...library.imports].slice(0, 50),
    updatedAt: batch.receipt.completedAt
  };
}

export function buildLibraryFromImports(
  imports: NormalizedTrackImport[],
  updatedAt = imports.at(-1)?.importedAt ?? EMPTY_DATE
): LibraryRecord {
  const tracks = imports.map(toTrackRecord);
  return {
    schemaVersion: 1,
    tracks,
    artists: buildArtists(tracks),
    albums: buildAlbums(tracks),
    imports: [],
    updatedAt
  };
}

export function findTrack(library: LibraryRecord, trackId?: string): TrackRecord | undefined {
  return trackId ? library.tracks.find((track) => track.id === trackId) : undefined;
}

export function trackIds(library: LibraryRecord): string[] {
  return library.tracks.map((track) => track.id);
}

export function slugId(prefix: string, value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "unknown";
  return `${prefix}:${slug}`;
}

function toTrackRecord(track: NormalizedTrackImport): TrackRecord {
  const artistId = slugId("artist", track.artistName);
  const albumId = slugId("album", `${track.artistName}-${track.albumTitle}`);
  return {
    id: track.id,
    title: track.title,
    artistId,
    artistName: track.artistName,
    albumId,
    albumTitle: track.albumTitle,
    trackNumber: track.trackNumber,
    importedAt: track.importedAt,
    source: {
      kind: "local-file",
      locator: track.sourceLocator,
      filename: track.filename,
      byteSize: track.byteSize,
      fingerprint: track.fingerprint,
      duplicateKey: track.duplicateKey
    },
    displayMetadata: {
      policy: track.metadataPolicy,
      originalFilename: track.filename
    }
  };
}

function buildArtists(tracks: TrackRecord[]): ArtistRecord[] {
  const records = new Map<string, ArtistRecord>();
  for (const track of tracks) {
    const current = records.get(track.artistId) ?? {
      id: track.artistId,
      name: track.artistName,
      trackIds: [],
      albumIds: []
    };
    current.trackIds.push(track.id);
    if (!current.albumIds.includes(track.albumId)) current.albumIds.push(track.albumId);
    records.set(current.id, current);
  }
  return [...records.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildAlbums(tracks: TrackRecord[]): AlbumRecord[] {
  const records = new Map<string, AlbumRecord>();
  for (const track of tracks) {
    const current = records.get(track.albumId) ?? {
      id: track.albumId,
      title: track.albumTitle,
      artistIds: [],
      trackIds: []
    };
    current.trackIds.push(track.id);
    if (!current.artistIds.includes(track.artistId)) current.artistIds.push(track.artistId);
    records.set(current.id, current);
  }
  return [...records.values()].sort((a, b) => a.title.localeCompare(b.title));
}
