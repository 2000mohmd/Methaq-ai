// Run: node src/lib/legal/selfcheck.ts   (uses fake identifiers only; no real statute text)
import assert from "node:assert/strict";
import { chunkByArticle, councilDisagreement, expandReferences, rank, scoreRetrieval, validateGold, verifyAnswer, type Chunk, type GoldEntry } from "./legal.ts";

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
console.log("legal selfcheck ok");
