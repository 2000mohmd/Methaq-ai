// node src/lib/legal/gold-cli.ts <gold.json> <corpus.json> [minRecall]
import { readFileSync } from "node:fs";
import { scoreRetrieval, validateGold, type Chunk, type GoldEntry } from "./legal.ts";

const [goldPath, corpusPath, min = "0.9"] = process.argv.slice(2);
if (!goldPath || !corpusPath) {
  console.error("usage: gold-cli <gold.json> <corpus.json> [minRecall]");
  process.exit(2);
}
const gold = JSON.parse(readFileSync(goldPath, "utf8")) as GoldEntry[];
const corpus = JSON.parse(readFileSync(corpusPath, "utf8")) as Chunk[];

let bad = 0;
for (const g of gold) {
  for (const e of validateGold(g)) {
    console.error(`INVALID ${g.id}: ${e}`);
    bad++;
  }
}
const r = scoreRetrieval(gold, corpus);
console.log(`approved=${r.total} recall@5=${(r.recall * 100).toFixed(1)}% misses=[${r.misses.join(", ")}]`);
process.exit(bad || r.total === 0 || r.recall < Number(min) ? 1 : 0);
