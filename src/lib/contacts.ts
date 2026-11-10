import { contactDisplayName } from "./conversations";
import type { Contact } from "./types";

/** Alphabetical by display name; nameless (phone-only) contacts sort after named ones. */
export function sortContacts(contacts: Contact[]): Contact[] {
  return [...contacts].sort((a, b) => {
    const an = !!a.name?.trim();
    const bn = !!b.name?.trim();
    if (an !== bn) return an ? -1 : 1;
    return contactDisplayName(a).localeCompare(contactDisplayName(b), undefined, { sensitivity: "base" });
  });
}

/** Case-insensitive match on name, phone, company and email. */
export function filterContacts(contacts: Contact[], query: string): Contact[] {
  const q = query.trim().toLowerCase();
  if (!q) return contacts;
  const qDigits = q.replace(/\D/g, "");
  return contacts.filter((c) => {
    const text = [c.name, c.company, c.email, c.wa_username].map((v) => v?.toLowerCase() ?? "");
    if (text.some((v) => v.includes(q))) return true;
    return qDigits.length > 0 && (c.phone ?? "").replace(/\D/g, "").includes(qDigits);
  });
}

/** First letter used for the section headers in the contact list. */
export function contactInitial(contact: Contact): string {
  const first = contactDisplayName(contact).trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(first) ? first : "#";
}
