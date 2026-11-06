import { sessionWindow } from "../session-window";

const H = 60 * 60 * 1000;
const now = Date.parse("2026-11-03T12:00:00Z");
const at = (msAgo: number) => new Date(now - msAgo).toISOString();

describe("sessionWindow", () => {
  it("is open when nothing is loaded yet", () => {
    expect(sessionWindow([], now)).toEqual({ expired: false, label: "" });
  });
  it("is closed when the customer never wrote", () => {
    expect(sessionWindow([{ sender_type: "agent", created_at: at(H) }], now).expired).toBe(true);
  });
  it("uses the LAST customer message, ignoring later agent replies", () => {
    const msgs = [
      { sender_type: "customer" as const, created_at: at(30 * H) },
      { sender_type: "customer" as const, created_at: at(2 * H) },
      { sender_type: "agent" as const, created_at: at(H) },
    ];
    expect(sessionWindow(msgs, now)).toEqual({ expired: false, label: "22h left" });
  });
  it("closes at exactly 24 hours", () => {
    expect(sessionWindow([{ sender_type: "customer", created_at: at(24 * H) }], now).expired).toBe(true);
    expect(sessionWindow([{ sender_type: "customer", created_at: at(24 * H - 1000) }], now).expired).toBe(false);
  });
});
