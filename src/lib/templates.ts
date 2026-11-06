import type { MessageTemplate } from "./types";

/** wacrm/src/lib/whatsapp/template-validators.ts `extractTemplateVariables`. */
export function extractTemplateVariables(text: string): string[] {
  const keys = new Set<string>();
  for (const m of text.matchAll(/\{\{([A-Za-z0-9_]+)\}\}/g)) keys.add(m[1]);
  const all = [...keys];
  if (all.length > 0 && all.every((k) => /^\d+$/.test(k))) {
    return all.map(Number).sort((a, b) => a - b).map(String);
  }
  return all.filter((k) => !/^\d+$/.test(k)).sort((a, b) => a.localeCompare(b));
}

/** Substitute placeholders; a missing value is left visible as `{{n}}`. */
export function renderTemplateBody(body: string, params: string[]): string {
  const keys = extractTemplateVariables(body);
  return body.replace(/\{\{([A-Za-z0-9_]+)\}\}/g, (match, key: string) => {
    const idx = keys.indexOf(key);
    const v = idx >= 0 ? params[idx] : undefined;
    return v && v.trim() ? v : match;
  });
}

export function templateHeaderMediaUrl(row: MessageTemplate): string | null {
  if (!row.header_type || row.header_type === "text") return null;
  return row.header_media_url || null;
}
