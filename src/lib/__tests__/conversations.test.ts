import { applyInboxFilter } from "../conversations";
import type { Conversation } from "../types";

const conv = (id: string, extra: Partial<Conversation> = {}): Conversation => ({
  id,
  contact_id: `c-${id}`,
  status: "open",
  unread_count: 0,
  created_at: "2026-01-01",
  ...extra,
});

describe("applyInboxFilter", () => {
  const list = [
    conv("a", { unread_count: 2, contact: { id: "c", account_id: "x", phone: "919632982245", name: "Priya" } }),
    conv("b", { assigned_agent_id: "me", last_message_text: "Is the saree available?" }),
    conv("c", { assigned_agent_id: "other" }),
    conv("d", { status: "pending" }),
    conv("e", { status: "closed" }),
  ];
  it("filters unread and mine", () => {
    expect(applyInboxFilter(list, "unread", "me", "").map((c) => c.id)).toEqual(["a"]);
    expect(applyInboxFilter(list, "mine", "me", "").map((c) => c.id)).toEqual(["b"]);
    expect(applyInboxFilter(list, "pending", "me", "").map((c) => c.id)).toEqual(["d"]);
    expect(applyInboxFilter(list, "closed", "me", "").map((c) => c.id)).toEqual(["e"]);
    expect(applyInboxFilter(list, "mine", null, "")).toEqual([]);
  });
  it("searches name, phone and last message", () => {
    expect(applyInboxFilter(list, "all", "me", "9632").map((c) => c.id)).toEqual(["a"]);
    expect(applyInboxFilter(list, "all", "me", "SAREE").map((c) => c.id)).toEqual(["b"]);
  });
});
