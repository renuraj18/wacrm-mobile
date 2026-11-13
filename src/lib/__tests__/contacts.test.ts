import { contactInitial, filterContacts, sortContacts } from "../contacts";
import type { Contact } from "../types";

const c = (id: string, extra: Partial<Contact> = {}): Contact => ({ id, account_id: "a", phone: "", ...extra });

describe("contacts helpers", () => {
  const list = [
    c("1", { phone: "919632982245" }),
    c("2", { name: "Zoya", phone: "919000000001", company: "Silk House" }),
    c("3", { name: "anita", phone: "918888888888", email: "Anita@example.com" }),
  ];

  it("sorts named contacts alphabetically, phone-only last", () => {
    expect(sortContacts(list).map((x) => x.id)).toEqual(["3", "2", "1"]);
  });

  it("filters by name, company, email and phone digits", () => {
    expect(filterContacts(list, "zoy").map((x) => x.id)).toEqual(["2"]);
    expect(filterContacts(list, "silk").map((x) => x.id)).toEqual(["2"]);
    expect(filterContacts(list, "ANITA@").map((x) => x.id)).toEqual(["3"]);
    expect(filterContacts(list, "+91 96329").map((x) => x.id)).toEqual(["1"]);
    expect(filterContacts(list, "  ")).toBe(list);
  });

  it("groups non-letters under #", () => {
    expect(contactInitial(list[0])).toBe("#");
    expect(contactInitial(list[2])).toBe("A");
  });
});
