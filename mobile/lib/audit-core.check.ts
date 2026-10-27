// Run: node --experimental-strip-types lib/audit-core.check.ts
import assert from "node:assert/strict";

// @ts-ignore -- explicit .ts extension is required by Node's type stripping
import { applyRedlines, reportMarkdown, splitClauses, withSources } from "./audit-core.ts";

const text = "TEST-PREAMBLE between TEST-PARTY-A and TEST-PARTY-B\n1. TEST-ART-1 first clause body text\n2. TEST-ART-2 second clause body text\n3. TEST-ART-3 third clause body text";
const cl = splitClauses(text);
assert.equal(cl.length, 4);
assert.ok(cl[1]!.text.startsWith("1. TEST-ART-1"));
assert.deepEqual(splitClauses("   "), []);
assert.equal(splitClauses("TEST-PARA-A long enough text\n\nTEST-PARA-B long enough text").length, 2);
assert.equal(splitClauses("x".repeat(30) + " " + "y".repeat(30), 20).length >= 2, true);

const findings = [
  { n: 2, risk: "high" as const, issue: "TEST-ISSUE", redline: "TEST-REDLINE-2", basis: [1], grounded: true },
  { n: 3, risk: "ok" as const, issue: "", redline: "", basis: [], grounded: true },
];
assert.equal(applyRedlines(cl, findings, new Set([2, 3])).split("\n\n")[1], "TEST-REDLINE-2");
assert.equal(applyRedlines(cl, findings, new Set([3])).split("\n\n")[2], cl[2]!.text); // empty redline keeps original
const res = withSources(findings, [{ id: 1, title: "TEST-LAW", ref: "TEST-ART-9", status: "in_force", url: null }, { id: 2, title: "TEST-OTHER", ref: "", status: "in_force", url: null }]);
assert.equal(res[0]!.sources.length, 1);
assert.equal(res[1]!.sources.length, 0);
const md = reportMarkdown("TEST-CONTRACT", cl, res);
assert.ok(md.includes("TEST-LAW (م TEST-ART-9)") && md.includes("1 مرتفع"));
console.log("audit-core ok");
