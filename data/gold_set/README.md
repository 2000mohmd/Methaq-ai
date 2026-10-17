# Gold set

One JSON file per practice area (`<area>.gold.json`) containing `GoldEntry[]` (see `src/lib/legal/legal.ts`),
written by a senior lawyer and signed off by a second lawyer (`reviewed_by` must differ from `authored_by`).
Only `status: "approved"` entries are scored. Pair with a corpus file (`<area>.corpus.json`, `Chunk[]`).

    node src/lib/legal/gold-cli.ts data/gold_set/<area>.gold.json data/gold_set/<area>.corpus.json [minRecall]

Exits non-zero if any entry is invalid or recall is below `minRecall` (default 0.9) — use it as the launch gate.
`_fixture.*` files use fake identifiers and exist only to test the tooling. Do not add real client data here.
