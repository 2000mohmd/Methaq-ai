// Run: node src/lib/legal/selfcheck.ts   (uses fake identifiers only; no real statute text)
import assert from "node:assert/strict";
import { chunkByArticle, councilDisagreement, expandReferences, rank, scoreRetrieval, sourceLabel, validateGold, verifyAnswer, type Chunk, type GoldEntry } from "./legal.ts";

const parts = chunkByArticle("Preamble\nArticle 1\nalpha rule\nالمادة ٢\nbeta rule");
assert.deepEqual(parts.map((p) => p.ref), ["", "1", "2"]);

const mk = (ref: string, text: string, status = "in_force"): Chunk => ({ title: "TEST-LAW", jurisdiction: null, status, ref, text, sourceUrl: null });
const hits = rank("what does Article 2 say", [mk("1", "gamma delta"), mk("2", "epsilon zeta")]);
assert.equal(hits[0]?.ref, "2"); // exact article lookup wins even with no word overlap

const src = rank("alpha", [mk("1", "alpha rule"), mk("3", "alpha repealed rule", "repealed")]);
const v = verifyAnswer("Rule applies [S1]. Fake cite [S9]. See Article 77.", src);
assert.deepEqual(v.stripped, [9]);
assert.deepEqual(v.unverifiedArticles, ["77"]);
assert.ok(!v.text.includes("[S9]"));
assert.ok(verifyAnswer("x", []).text.includes("not grounded"));
const all = [mk("1", "alpha see Article 4"), mk("4", "omega rule")];
assert.deepEqual(expandReferences(rank("alpha", all), all).map((x) => x.ref), ["1", "4"]); // graph hop
assert.deepEqual(councilDisagreement([new Set([1, 2]), new Set([1])]), [2]);

const g: GoldEntry = { id: "G1", practice_area: "test", question: "Article 2 epsilon", expected: [{ title: "TEST-LAW", ref: "2" }], status: "approved", authored_by: "a", reviewed_by: "a" };
assert.ok(validateGold(g).length); // same author cannot self-approve
assert.equal(scoreRetrieval([{ ...g, reviewed_by: "b" }], [mk("1", "gamma"), mk("2", "epsilon")]).recall, 1);
import { applyRedlines, parseAudit, splitClauses } from "./audit.ts";
import { dualDate } from "./dates.ts";

const cl = splitClauses(["Preamble text here for the parties.", "1. First clause about payment terms.", "2. Second clause about termination.", "3. Third clause about disputes."].join(String.fromCharCode(10)));
assert.equal(cl.length, 4);
const asrc = rank("alpha", [mk("1", "alpha rule")]);
const fs = parseAudit('noise [{"n":2,"risk":"high","issue":"x","redline":"fixed","basis":[1,9]},{"n":99,"risk":"high","issue":"ghost","basis":[]},{"n":3,"risk":"high","issue":"y","basis":[]}]', cl, asrc);
assert.deepEqual(fs.find((f) => f.n === 2)?.basis, [1]); // fabricated [S9] dropped
assert.equal(fs.find((f) => f.n === 2)?.grounded, true);
assert.equal(fs.find((f) => f.n === 3)?.grounded, false); // high risk with no verified source is flagged
assert.equal(fs.length, cl.length); // ghost clause ignored, missing clauses reported as unaudited
assert.ok(applyRedlines(cl, fs, new Set([2])).includes("fixed"));
const dd = dualDate(new Date("2026-10-17T12:00:00Z"));
assert.ok(dd.includes("هـ") && dd.includes("م") && dd.includes("1448"), dd);
const probation = [mk("1", "A probation period must not exceed ninety days.")];
assert.equal(rank("What is the maximum notice period for a tenant under the rental law?", probation).length, 0); // one shared word ("period") is not a source
assert.equal(rank("probation period maximum", probation).length, 1); // real match still found
// Arabic ordinal articles, including flattened PDF text (no newlines) and in-text references that are not headings.
const flat = "مقدمة تجريبية. المادة الأولى: نص تجريبي اول. المادة الثانية عشرة: نص ثان وفقا للمادة الخامسة من هذا النظام. المادة الرابعة والسبعون: نص ثالث. المادة الخامسة بعد المائة: نص رابع.";
assert.deepEqual(chunkByArticle(flat).map((c) => c.ref), ["", "1", "12", "74", "105"]);
assert.deepEqual(chunkByArticle("المادة ( ٧ ) نص").map((c) => c.ref), ["7"]);
const arCorpus: Chunk[] = chunkByArticle(flat).map((c) => ({ title: "TEST-LAW", jurisdiction: null, status: "in_force", ref: c.ref, text: c.text, sourceUrl: null }));
assert.equal(rank("ماذا تقول المادة 74", arCorpus)[0]?.ref, "74"); // digit query finds the ordinal-numbered article
assert.deepEqual(chunkByArticle("ﺍﻟﻤﺎﺩﺓ ﺍﻟﺃﻭﻟﻰ: نص").map((c) => c.ref), ["1"]); // presentation-form Arabic
import { isCorruptArabic } from "./textquality.ts";
const garbled = "املادة األوىل: يف األحوال الشخصية. ".repeat(12);
assert.equal(isCorruptArabic(garbled), true); // swapped/dropped letters from a broken PDF font map
assert.equal(isCorruptArabic("المادة الأولى: نص سليم في الأحوال الشخصية على المال. ".repeat(12)), false);
import { buildCorpusSql } from "./corpus.ts";
const built = buildCorpusSql("المادة الأولى: نص تجريبي أول. المادة الثانية: نص ثان فيه $law$ رمز غريب. المادة الرابعة: نص رابع.", { title: "TEST-LAW", url: "https://example.invalid/test" });
assert.equal(built.report.articles, 3);
assert.deepEqual(built.report.missing, [3]); // gap between 2 and 4 is reported
assert.ok(built.sql.includes("$lawx$") && built.sql.includes("ON CONFLICT"), "dollar-quote tag avoids collisions");
assert.throws(() => buildCorpusSql("x", { title: "t", url: "" }), /official source/);
import { classifyDomains, pickRegistry, pointersBlock, type RegistryRow } from "./registry.ts";
const reg: RegistryRow[] = [
  { authority: "TEST-BOE", source_name: "central portal", legal_domain: "عام / جميع الأنظمة", priority_tier: "P1", url: "https://example.invalid/boe" },
  { authority: "TEST-MOJ", source_name: "justice laws", legal_domain: "تقاضي / عدلي", priority_tier: "P1", url: "https://example.invalid/moj" },
  { authority: "TEST-HRSD", source_name: "labour", legal_domain: "عمل", priority_tier: "P1", url: "https://example.invalid/hrsd" },
  { authority: "TEST-NCC", source_name: "draft laws", legal_domain: "مشاريع الأنظمة واللوائح", priority_tier: "P4", url: "https://example.invalid/ncc" },
  { authority: "TEST-COURT", source_name: "rulings", legal_domain: "عمل / قضاء", priority_tier: "P2", url: "https://example.invalid/court" },
];
assert.ok(classifyDomains("ما هي حقوق الحضانة بعد الطلاق؟").includes("تقاضي")); // family law routes to the justice portals
assert.deepEqual(pickRegistry(reg, "ما مدة فترة التجربة في عقد العمل؟").map((r) => r.authority), ["TEST-HRSD", "TEST-COURT", "TEST-BOE"]); // tier order + central portal
assert.ok(!pickRegistry(reg, "what is the probation period in an employment contract").some((r) => r.priority_tier === "P4")); // drafts only when asked
assert.ok(pickRegistry(reg, "any proposed draft law on labour consultation").some((r) => r.priority_tier === "P4"));
assert.ok(pointersBlock(reg.slice(3, 4), false).includes("draft, NOT in force"));
// User notes are context, not authority.
const note: Chunk = { ...mk("1", "alpha note"), title: "MY-NOTE", origin: "user" };
const onlyNotes = verifyAnswer("Based on my note [S1].", rank("alpha", [note]));
assert.equal(onlyNotes.grounded, false); // grounded only in user notes != grounded
assert.equal(onlyNotes.validCitations, 0);
assert.ok(onlyNotes.text.includes("Your notes (not verified)") && !onlyNotes.text.includes("Verified sources"));
const mixed = [{ ...mk("1", "alpha rule"), id: 1 }, { ...note, id: 2 }];
const mv = verifyAnswer("Rule [S1] and note [S2].", mixed);
assert.ok(mv.grounded && mv.validCitations === 1 && mv.text.includes("Verified sources:\n[S1]") && mv.text.includes("Your notes (not verified):\n[S2]"));
assert.ok(sourceLabel(note).includes("USER NOTE") && !sourceLabel(mk("1", "x")).includes("USER NOTE"));
assert.equal(parseAudit('[{"n":2,"risk":"high","issue":"x","basis":[1]}]', cl, rank("alpha", [note])).find((f) => f.n === 2)?.grounded, false);
// PII masking at the AI boundary (fake values only).
import { redact, redactFields, redactMessages, restore } from "./redact.ts";
const pii = "ID 1000000001, iqama 2000000002, mobile 0500000000 / +966500000000, IBAN SA00 0000 0000 0000 0000 0000, mail test@example.invalid, card 4000 0000 0000 0000, سجل تجاري رقم 1010000000, again 1000000001";
const r = redact(pii);
for (const raw of ["1000000001", "2000000002", "0500000000", "966500000000", "SA00 0000", "test@example.invalid", "4000 0000", "1010000000"]) assert.ok(!r.text.includes(raw), raw);
assert.ok(r.text.includes("⟦ID_1⟧") && r.text.includes("⟦ID_2⟧") && r.text.includes("⟦PHONE_1⟧") && r.text.includes("⟦IBAN_1⟧") && r.text.includes("⟦EMAIL_1⟧") && r.text.includes("⟦CR_1⟧"));
assert.equal(r.text.match(/⟦ID_1⟧/g)?.length, 2); // same value -> same token
assert.equal(restore(r.text, r.map), pii);
assert.equal(redact("Article 74 of TEST-LAW, 1445 AH, SAR 50000").text, "Article 74 of TEST-LAW, 1445 AH, SAR 50000"); // ordinary numbers untouched
const f = redactFields({ party_a_name: "TEST PERSON", party_a_id: "1000000001", party_a_addr: "TEST STREET", amount: "50000" });
assert.equal(f.inputs["party_a_name"], "⟦PARTY_PARTY_A_NAME⟧");
assert.equal(f.inputs["amount"], "50000");
const fm = redactMessages([{ role: "user", content: "Contract between TEST PERSON (1000000001) of TEST STREET" }], f.map);
assert.ok(!fm[0]!.content.includes("TEST PERSON") && !fm[0]!.content.includes("TEST STREET") && !fm[0]!.content.includes("1000000001"));
assert.equal(restore(fm[0]!.content, f.map), "Contract between TEST PERSON (1000000001) of TEST STREET");
console.log("legal selfcheck ok");
