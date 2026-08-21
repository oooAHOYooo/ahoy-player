import { buildLibraryFromImports } from "./library";
import type { NormalizedTrackImport } from "./types";

const importedAt = "2026-08-21T12:00:00.000Z";

export const demoImports: NormalizedTrackImport[] = [
  demo("harbor-lights", "Harbor Lights", "Night Ferry", "Low Water", 1, 4_240_000),
  demo("paper-sail", "Harbor Lights", "Night Ferry", "Paper Sail", 2, 5_180_000),
  demo("countercurrent", "Mainspring", "Soundings", "Countercurrent", 1, 4_920_000),
  demo("white-buoy", "Mainspring", "Soundings", "White Buoy", 2, 4_620_000),
  demo("signal-glass", "Field Office", "Channel Study", "Signal Glass", 1, 6_040_000),
  demo("after-weather", "Field Office", "Channel Study", "After Weather", 2, 5_730_000)
];

export const demoLibrary = buildLibraryFromImports(demoImports, importedAt);

function demo(
  slug: string,
  artistName: string,
  albumTitle: string,
  title: string,
  trackNumber: number,
  byteSize: number
): NormalizedTrackImport {
  const filename = `${String(trackNumber).padStart(2, "0")} ${artistName} - ${title}.mp3`;
  return {
    id: `local:demo-${slug}`,
    filename,
    sourceLocator: `/demo/${filename}`,
    title,
    artistName,
    albumTitle,
    trackNumber,
    byteSize,
    fingerprint: `demo-${slug}`,
    duplicateKey: `sha256:demo-${slug}`,
    importedAt,
    metadataPolicy: "filename-only"
  };
}
