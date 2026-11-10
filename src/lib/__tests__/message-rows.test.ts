import { buildRows } from "../message-rows";
import type { Message } from "../types";

const msg = (id: string, sender: Message["sender_type"], at: string): Message => ({
  id,
  conversation_id: "c",
  sender_type: sender,
  content_type: "text",
  status: "sent",
  created_at: at,
});

describe("buildRows", () => {
  const now = new Date("2026-11-10T12:00:00Z");

  it("is newest-first and marks the first bubble of each run", () => {
    const rows = buildRows(
      [
        msg("1", "customer", "2026-11-10T08:00:00Z"),
        msg("2", "customer", "2026-11-10T08:01:00Z"),
        msg("3", "agent", "2026-11-10T08:02:00Z"),
        msg("4", "bot", "2026-11-10T08:03:00Z"),
      ],
      now,
    );
    const msgs = rows.filter((r) => r.type === "msg");
    expect(msgs.map((r) => (r.type === "msg" ? r.m.id : ""))).toEqual(["4", "3", "2", "1"]);
    // agent + bot share the "out" side, so only #3 starts a run there.
    expect(msgs.map((r) => (r.type === "msg" ? r.first : null))).toEqual([false, true, false, true]);
  });

  it("puts one day pill above each day's first message", () => {
    const rows = buildRows(
      [msg("1", "customer", "2026-11-09T08:00:00Z"), msg("2", "customer", "2026-11-10T08:00:00Z")],
      now,
    );
    expect(rows.map((r) => r.type)).toEqual(["msg", "day", "msg", "day"]);
    const days = rows.filter((r) => r.type === "day");
    expect(days.map((r) => (r.type === "day" ? r.label : ""))).toEqual(["Today", "Yesterday"]);
    // The first message of a new day always starts a new run.
    expect(rows[0].type === "msg" && rows[0].first).toBe(true);
  });
});
