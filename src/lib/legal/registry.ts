// Registry of official Saudi legal sources = POINTERS to where a rule can be verified (portals, regulators).
// It is not law text and never counts as a verified citation; the app appends it as "where to verify" itself,
// so the model cannot invent or alter a URL.

export type RegistryRow = {
  authority: string;
  source_name: string;
  legal_domain: string;
  ai_agent_use?: string | null;
  priority_tier: "P1" | "P2" | "P3" | "P4";
  url: string;
  notes?: string | null;
};

// question keywords -> substrings of registry.legal_domain to look at
const DOMAINS: { keys: string[]; match: string[] }[] = [
  { keys: ["أحوال شخصية", "زواج", "نكاح", "طلاق", "خلع", "حضانة", "نفقة", "ميراث", "إرث", "ولاية", "personal status", "marriage", "divorce", "custody", "alimony", "inheritance"], match: ["تقاضي", "عام / جميع"] },
  { keys: ["عقد عمل", "عمل", "موظف", "عامل", "فصل", "إنهاء خدمة", "تجربة", "labor", "labour", "employment", "employee", "termination", "probation"], match: ["عمل"] },
  { keys: ["استثمار", "مستثمر", "investment", "investor"], match: ["استثمار"] },
  { keys: ["شركة", "شركات", "سجل تجاري", "امتياز", "رهن تجاري", "commercial", "company", "companies", "franchise"], match: ["تجاري"] },
  { keys: ["زكاة", "ضريبة", "قيمة مضافة", "vat", "zakat", "tax"], match: ["زكاة"] },
  { keys: ["جمارك", "customs"], match: ["جمارك"] },
  { keys: ["بنك", "تمويل", "مدفوعات", "غسل الأموال", "sama", "banking", "finance", "payment", "aml"], match: ["مصرفي"] },
  { keys: ["سوق مالية", "cma", "اندماج", "استحواذ", "مدرجة", "capital market", "listed"], match: ["سوق مالية"] },
  { keys: ["بيانات شخصية", "خصوصية", "pdpl", "privacy", "data protection"], match: ["خصوصية"] },
  { keys: ["علامة تجارية", "براءة", "حقوق مؤلف", "trademark", "patent", "copyright"], match: ["ملكية فكرية"] },
  { keys: ["عقار", "إيجار", "ايجار", "تملك", "وساطة عقارية", "real estate", "lease", "rent", "property"], match: ["عقار"] },
  { keys: ["دواء", "غذاء", "مستحضر", "sfda", "medical device", "cosmetic"], match: ["غذاء"] },
  { keys: ["تأمين", "insurance"], match: ["تأمين"] },
  { keys: ["إفلاس", "تصفية", "bankruptcy", "insolvency"], match: ["إفلاس"] },
  { keys: ["تحكيم", "وساطة", "arbitration", "mediation", "sadr"], match: ["تحكيم", "وساطة"] },
  { keys: ["اتصالات", "منصة رقمية", "telecom"], match: ["اتصالات"] },
  { keys: ["محكمة", "دعوى", "تقاضي", "حكم", "court", "lawsuit", "litigation", "judgment"], match: ["تقاضي", "قضاء"] },
  { keys: ["بلدي", "ترخيص", "اشتراطات", "municipal", "licence", "license"], match: ["بلدي"] },
];

const DRAFT_WORDS = ["مشروع نظام", "استطلاع", "draft law", "proposed", "consultation"];

export function classifyDomains(question: string): string[] {
  const q = question.toLowerCase();
  const out = new Set<string>();
  for (const d of DOMAINS) if (d.keys.some((k) => q.includes(k.toLowerCase()))) d.match.forEach((m) => out.add(m));
  return [...out];
}

const RANK = { P1: 0, P2: 1, P3: 2, P4: 3 } as const;

/** Relevant registry rows: domain matches by tier, plus the central official portal; drafts (P4) only when asked about. */
export function pickRegistry(rows: RegistryRow[], question: string, max = 5): RegistryRow[] {
  const domains = classifyDomains(question);
  const wantsDraft = DRAFT_WORDS.some((w) => question.toLowerCase().includes(w));
  const matched = rows
    .filter((r) => (r.priority_tier !== "P4" || wantsDraft) && domains.some((d) => r.legal_domain.includes(d)))
    .sort((a, b) => RANK[a.priority_tier] - RANK[b.priority_tier]);
  const central = rows.find((r) => r.priority_tier === "P1" && r.legal_domain.startsWith("عام / جميع"));
  const picked = [...matched.slice(0, max)];
  if (wantsDraft) picked.push(...rows.filter((r) => r.priority_tier === "P4" && !picked.includes(r))); // asked about drafts: show the monitoring source
  if (central && !picked.includes(central) && domains.length > 0) picked.push(central);
  return picked.slice(0, max + 2);
}

/** Context for the model: pointers only, with the policy that they are not citable article text. */
export function registryForModel(rows: RegistryRow[]): string {
  if (!rows.length) return "";
  return (
    "\n\nOFFICIAL SOURCE REGISTRY (websites that govern this topic; pointers only, NOT article text). Use them to decide which authority and tier applies. " +
    "Never cite them with [S#] and never present them as verifying a claim; the app lists them to the user separately.\n" +
    rows.map((r) => `- ${r.priority_tier} | ${r.authority} — ${r.source_name}${r.notes ? ` (${r.notes})` : ""}`).join("\n")
  );
}

const TIER_NOTE = {
  P1: { ar: "", en: "" },
  P2: { ar: " (مصدر قضائي/مؤسسي وليس نصاً نظامياً)", en: " (judicial/institutional source, not statute)" },
  P3: { ar: " (إجرائي وليس نصاً نظامياً)", en: " (procedural guide, not law)" },
  P4: { ar: " (مشروع غير نافذ)", en: " (draft, NOT in force)" },
} as const;

/** Deterministic "where to verify" block appended to answers (never written by the model). */
export function pointersBlock(rows: RegistryRow[], ar: boolean): string {
  if (!rows.length) return "";
  const lines = rows.map((r) => `• ${r.authority} — ${r.source_name}${ar ? TIER_NOTE[r.priority_tier].ar : TIER_NOTE[r.priority_tier].en}: ${r.url}`);
  return `\n\n${ar ? "للتحقق من المصادر الرسمية:" : "Verify against the official sources:"}\n${lines.join("\n")}`;
}
