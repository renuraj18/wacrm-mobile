import { buildMediaPath, MEDIA_MAX_BYTES_BY_KIND, mimeForFile } from "../media-path";

describe("buildMediaPath", () => {
  const acct = "11111111-2222-3333-4444-555555555555";
  it("scopes by account and stamps the time (same as the web)", () => {
    expect(buildMediaPath(acct, "IMG 0001.JPG", 1700000000000)).toBe(`account-${acct}/1700000000000-IMG_0001.jpg`);
  });
  it("falls back to bin / file", () => {
    expect(buildMediaPath(acct, "README", 1)).toBe(`account-${acct}/1-README.bin`);
    expect(buildMediaPath(acct, "???.m4a", 1)).toBe(`account-${acct}/1-_.m4a`);
    expect(buildMediaPath(acct, ".m4a", 1)).toBe(`account-${acct}/1-file.m4a`);
  });
  it("caps the basename at 40 chars and supports no-stamp + subfolder", () => {
    const p = buildMediaPath(acct, `${"x".repeat(60)}.png`, null, "voice");
    expect(p).toBe(`account-${acct}/voice/${"x".repeat(40)}.png`);
  });
  it("maps voice notes to audio/mp4", () => {
    expect(mimeForFile("voice-1.m4a")).toBe("audio/mp4");
    expect(mimeForFile("photo.jpeg")).toBe("image/jpeg");
    expect(mimeForFile("clip.mp4")).toBe("video/mp4");
    expect(mimeForFile("catalog.pdf")).toBe("application/pdf");
    expect(MEDIA_MAX_BYTES_BY_KIND.document).toBe(25 * 1024 * 1024);
  });
});
