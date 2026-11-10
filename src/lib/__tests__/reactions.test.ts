import { applyReactionChange, groupReactions, nextBusinessEmoji, withBusinessReaction } from "../reactions";
import type { MessageReaction } from "../types";

const r = (id: string, extra: Partial<MessageReaction> = {}): MessageReaction => ({
  id,
  message_id: "m1",
  conversation_id: "c1",
  actor_type: "customer",
  emoji: "👍",
  created_at: "2026-01-01T00:00:00Z",
  ...extra,
});

describe("reactions", () => {
  it("groups by emoji and flags the business", () => {
    const groups = groupReactions([r("1"), r("2", { emoji: "❤️" }), r("3", { actor_type: "agent", actor_id: "u" })]);
    expect(groups).toEqual([
      { emoji: "👍", count: 2, byBusiness: true },
      { emoji: "❤️", count: 1, byBusiness: false },
    ]);
  });

  it("toggles off when the same emoji is tapped again", () => {
    const mine = r("1", { actor_type: "agent", emoji: "❤️" });
    expect(nextBusinessEmoji(mine, "❤️")).toBe("");
    expect(nextBusinessEmoji(mine, "👍")).toBe("👍");
    expect(nextBusinessEmoji(undefined, "👍")).toBe("👍");
  });

  it("sets, swaps and removes the optimistic business reaction", () => {
    const change = { messageId: "m1", conversationId: "c1", userId: "u", now: new Date("2026-01-01") };
    const added = withBusinessReaction([], { ...change, emoji: "🙏" });
    expect(added).toHaveLength(1);
    expect(added[0].id.startsWith("temp-")).toBe(true);
    const swapped = withBusinessReaction(added, { ...change, emoji: "😂" });
    expect(swapped).toHaveLength(1);
    expect(swapped[0].emoji).toBe("😂");
    expect(withBusinessReaction(swapped, { ...change, emoji: "" })).toEqual([]);
  });

  it("realtime insert replaces the optimistic temp row, delete removes by id", () => {
    const temp = r("temp-1", { actor_type: "agent", actor_id: "u" });
    const real = r("real-1", { actor_type: "agent", actor_id: "u" });
    expect(applyReactionChange([temp], "INSERT", real)).toEqual([real]);
    expect(applyReactionChange([real], "INSERT", real)).toEqual([real]);
    expect(applyReactionChange([real], "UPDATE", { ...real, emoji: "😮" })[0].emoji).toBe("😮");
    expect(applyReactionChange([real], "DELETE", { id: "real-1" })).toEqual([]);
  });
});
