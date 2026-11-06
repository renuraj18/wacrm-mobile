import { previewText } from "../preview";

describe("previewText", () => {
  it("returns trimmed, whitespace-collapsed text", () => {
    expect(previewText("text", "  hello\n\n  there ")).toBe("hello there");
  });
  it("labels media with and without a caption", () => {
    expect(previewText("image", null)).toBe("📷 Photo");
    expect(previewText("image", "Red saree")).toBe("📷 Photo: Red saree");
    expect(previewText("audio", "")).toBe("🎤 Voice note");
  });
  it("falls back for empty text", () => {
    expect(previewText("text", "   ")).toBe("New message");
    expect(previewText("template", undefined)).toBe("New message");
  });
  it("truncates long text to 120 chars with an ellipsis", () => {
    const out = previewText("text", "a".repeat(300));
    expect(out).toHaveLength(120);
    expect(out.endsWith("…")).toBe(true);
  });
});
