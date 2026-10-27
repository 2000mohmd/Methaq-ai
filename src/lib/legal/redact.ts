// PII masking at the jurisdiction boundary: personal identifiers are swapped for stable tokens before any
// text leaves for the AI provider (outside KSA), and put back in what the user sees. Pure, no I/O.
// map: token -> original value. The same value always gets the same token within one map.
export type RedactMap = Record<string, string>;

const D = "[0-9٠-٩]"; // Western and Arabic-Indic digits
const ND = `(?<!${D})`;
const NA = `(?!${D})`;

// Order matters: longer/more specific patterns first so a card or IBAN is not eaten as an ID or phone.
const RULES: [kind: string, re: RegExp][] = [
  ["EMAIL", /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g],
  ["IBAN", new RegExp(`\\bSA(?:\\s?${D}){22}${NA}`, "gi")],
  ["CARD", new RegExp(`${ND}${D}{4}(?:[ -]?${D}{4}){3}${NA}`, "g")],
  // CR numbers are only masked when labelled; group 1 is the number.
  ["CR", new RegExp(`(?:السجل التجاري|سجل تجاري|\\bC\\.?R\\.?|commercial registration)\\s*(?:رقم|no\\.?|number|#)?\\s*[:：]?\\s*(${D}{10})${NA}`, "gi")],
  ["PHONE", new RegExp(`${ND}(?:(?:\\+|00)?966[\\s-]?0?|0)[1-9]${D}(?:[\\s-]?${D}){7}${NA}`, "g")],
  ["ID", new RegExp(`${ND}[12١٢]${D}{9}${NA}`, "g")],
];

function tokenFor(kind: string, value: string, map: RedactMap): string {
  for (const [t, v] of Object.entries(map)) if (v === value) return t;
  const n = Object.keys(map).filter((t) => t.startsWith(`⟦${kind}_`)).length + 1;
  const t = `⟦${kind}_${n}⟧`;
  map[t] = value;
  return t;
}

/** Mask known values already in the map (e.g. party names from redactFields), then regex-detectable identifiers. */
export function redact(text: string, map: RedactMap = {}): { text: string; map: RedactMap } {
  let out = text;
  for (const [t, v] of Object.entries(map).sort((a, b) => b[1].length - a[1].length)) out = out.split(v).join(t);
  for (const [kind, re] of RULES) {
    out = out.replace(re, (m: string, g1?: unknown) => (typeof g1 === "string" ? m.replace(g1, tokenFor(kind, g1, map)) : tokenFor(kind, m, map)));
  }
  return { text: out, map };
}

export function restore(text: string, map: RedactMap): string {
  let out = text;
  for (const [t, v] of Object.entries(map)) out = out.split(t).join(v);
  return out;
}

/** Contract-form fields whose key ends in _name/_id/_addr are personal by definition: seed the map with them. */
export function redactFields(inputs: Record<string, string>, map: RedactMap = {}): { inputs: Record<string, string>; map: RedactMap } {
  const masked: Record<string, string> = {};
  for (const [k, v] of Object.entries(inputs)) {
    const val = String(v ?? "").trim();
    if (/_(name|id|addr)$/.test(k) && val.length >= 3) {
      const t = `⟦PARTY_${k.toUpperCase()}⟧`;
      map[t] = val;
      masked[k] = t;
    } else masked[k] = redact(String(v ?? ""), map).text;
  }
  return { inputs: masked, map };
}

/** Mask every text part of a chat/completions message list (system, user, assistant; multimodal text parts too). */
export function redactMessages<T>(messages: T[], map: RedactMap): T[] {
  return messages.map((m) => {
    const msg = m as { content?: unknown };
    if (typeof msg.content === "string") return { ...msg, content: redact(msg.content, map).text } as T;
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((p: { type?: string; text?: string }) => (p?.type === "text" && typeof p.text === "string" ? { ...p, text: redact(p.text, map).text } : p)),
      } as T;
    }
    return m;
  });
}
