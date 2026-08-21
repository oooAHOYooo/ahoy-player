import { describe, expect, it } from "vitest";
import { buildLibraryFromImports, mergeImportBatch } from "@ahoy/player-core";
import { createDuplicateKey, normalizeImport, parseFilename, runImportPipeline } from "./metadata";

const candidate = {
  filename: "03 Harbor Lights - Low Water.mp3",
  sourceLocator: "/music/03 Harbor Lights - Low Water.mp3",
  byteSize: 4_200_000,
  fingerprint: "ABC123"
};

describe("metadata normalization", () => {
  it("uses the filename when embedded tags are absent", () => {
    const track = normalizeImport(candidate, "2026-08-21T12:00:00.000Z");
    expect(track).toMatchObject({
      title: "Low Water",
      artistName: "Harbor Lights",
      albumTitle: "Local Imports",
      trackNumber: 3,
      metadataPolicy: "filename-only"
    });
  });

  it("prefers embedded tags and fills any missing values from the filename", () => {
    const track = normalizeImport({
      ...candidate,
      embeddedMetadata: {
        source: "id3",
        title: "Tag Title",
        artistName: "Tag Artist"
      }
    }, "2026-08-21T12:00:00.000Z");
    expect(track).toMatchObject({
      title: "Tag Title",
      artistName: "Tag Artist",
      albumTitle: "Local Imports",
      trackNumber: 3,
      metadataPolicy: "embedded-tag"
    });
  });

  it("uses folders only when the filename cannot supply artist and album", () => {
    expect(parseFilename("01 Low_Water.mp3", "Harbor Lights/Night Ferry/01 Low_Water.mp3"))
      .toEqual({
        title: "Low Water",
        artist: "Harbor Lights",
        album: "Night Ferry",
        trackNumber: 1,
        usedPathFallback: true
      });
  });

  it("parses artist, album, track number, and title from a long filename", () => {
    expect(parseFilename("Mainspring - Soundings - 02 - White Buoy.mp3")).toMatchObject({
      artist: "Mainspring",
      album: "Soundings",
      title: "White Buoy"
    });
  });
});

describe("duplicate detection", () => {
  it("prefers a content fingerprint", () => {
    expect(createDuplicateKey(candidate)).toBe("sha256:abc123");
  });

  it("rejects both existing and same-batch duplicates", () => {
    const importedAt = "2026-08-21T12:00:00.000Z";
    const existing = buildLibraryFromImports([normalizeImport(candidate, importedAt)]);
    const second = { ...candidate, filename: "renamed.mp3", sourceLocator: "/music/renamed.mp3" };
    const batchOnly = { ...candidate, fingerprint: "different", sourceLocator: "/other.mp3" };
    const result = runImportPipeline([second, batchOnly, batchOnly], existing, { now: () => importedAt });

    expect(result.accepted).toHaveLength(1);
    expect(result.duplicates.map((item) => item.reason)).toEqual([
      "already-in-library",
      "repeated-in-batch"
    ]);
  });

  it("refreshes an existing track with embedded metadata when the same file is re-imported", () => {
    const importedAt = "2026-08-21T12:00:00.000Z";
    const existing = buildLibraryFromImports([normalizeImport(candidate, importedAt)]);
    const batch = runImportPipeline([{
      ...candidate,
      embeddedMetadata: {
        source: "id3",
        title: "Tagged Low Water",
        artistName: "Tagged Harbor",
        albumTitle: "Tagged Album"
      }
    }], existing, { now: () => importedAt });
    const refreshed = mergeImportBatch(existing, batch);

    expect(batch.accepted).toHaveLength(0);
    expect(batch.duplicates).toHaveLength(1);
    expect(refreshed.tracks[0]).toMatchObject({
      title: "Tagged Low Water",
      artistName: "Tagged Harbor",
      albumTitle: "Tagged Album",
      displayMetadata: { policy: "embedded-tag" }
    });
  });

  it("rejects non-MP3 and empty inputs", () => {
    const result = runImportPipeline([
      { filename: "notes.txt", sourceLocator: "notes.txt", byteSize: 1 },
      { filename: "empty.mp3", sourceLocator: "empty.mp3", byteSize: 0 }
    ]);
    expect(result.rejected.map((item) => item.reason)).toEqual(["not-mp3", "empty-file"]);
  });
});
