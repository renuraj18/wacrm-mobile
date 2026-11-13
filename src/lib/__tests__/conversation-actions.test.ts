import { changesFor } from "../conversation-actions";

// Only the pure helper is under test; keep the Supabase client out of the test run.
jest.mock("../supabase", () => ({ supabase: {} }));

const c = (assigned: string | null, status: "open" | "pending" | "closed" = "open") => ({
  assigned_agent_id: assigned,
  status,
});

describe("changesFor", () => {
  it("returns null with no targets or no user", () => {
    expect(changesFor([], "mark-unread", "me")).toBeNull();
    expect(changesFor([c(null)], "toggle-mine", null)).toBeNull();
  });

  it("assigns to me unless every target is already mine", () => {
    expect(changesFor([c(null)], "toggle-mine", "me")).toEqual({ assigned_agent_id: "me" });
    expect(changesFor([c("me"), c(null)], "toggle-mine", "me")).toEqual({ assigned_agent_id: "me" });
    expect(changesFor([c("me"), c("me")], "toggle-mine", "me")).toEqual({ assigned_agent_id: null });
  });

  it("closes unless every target is already closed", () => {
    expect(changesFor([c(null, "pending")], "toggle-closed", "me")).toEqual({ status: "closed" });
    expect(changesFor([c(null, "closed"), c(null, "open")], "toggle-closed", "me")).toEqual({ status: "closed" });
    expect(changesFor([c(null, "closed")], "toggle-closed", "me")).toEqual({ status: "open" });
  });

  it("marks unread", () => {
    expect(changesFor([c(null)], "mark-unread", "me")).toEqual({ unread_count: 1 });
  });
});
