import { describe, expect, it } from "vitest";
import { candidatesFromFiles } from "./browser-files";

describe("browser MP3 imports", () => {
  it("reads embedded ID3 metadata locally before normalizing the candidate", async () => {
    const bytes = makeTaggedMp3();
    const file = new File([bytes.buffer as ArrayBuffer], "01 Neon Skyline.mp3", {
      type: "audio/mpeg",
      lastModified: 1_000
    });
    const [candidate] = await candidatesFromFiles([file]);

    expect(candidate.embeddedMetadata).toMatchObject({
      source: "id3",
      title: "Neon Skyline",
      artistName: "Test Artist",
      albumTitle: "Night Drive"
    });
  });
});

function makeTaggedMp3(): Uint8Array {
  const encoder = new TextEncoder();
  const frames = [
    textFrame("TIT2", "Neon Skyline"),
    textFrame("TPE1", "Test Artist"),
    textFrame("TALB", "Night Drive")
  ];
  const tagSize = frames.reduce((size, frame) => size + frame.length, 0);
  const header = new Uint8Array([
    0x49, 0x44, 0x33, // ID3
    0x03, 0x00, 0x00, // ID3v2.3, no flags
    (tagSize >>> 21) & 0x7f,
    (tagSize >>> 14) & 0x7f,
    (tagSize >>> 7) & 0x7f,
    tagSize & 0x7f
  ]);
  return new Uint8Array([...header, ...frames.flatMap((frame) => [...frame]), 0xff, 0xfb, 0x90, 0x64]);

  function textFrame(identifier: string, value: string): Uint8Array {
    const payload = new Uint8Array([0x03, ...encoder.encode(value)]); // UTF-8
    const frameHeader = new Uint8Array(10);
    frameHeader.set(encoder.encode(identifier));
    new DataView(frameHeader.buffer).setUint32(4, payload.length);
    return new Uint8Array([...frameHeader, ...payload]);
  }
}
