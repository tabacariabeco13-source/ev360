import assert from "node:assert/strict";
import fs from "node:fs";
import { reconcileInvoiceAgainstContract } from "../lib/invoice-contract-reconciliation-core.mjs";

const fixture = JSON.parse(
  fs.readFileSync(new URL("../experiments/recovery-002/fixtures/benchmark.json", import.meta.url), "utf8")
);

for (const item of fixture.cases) {
  const result = reconcileInvoiceAgainstContract({
    invoice: item.invoice,
    contract: fixture.contract,
    priorInvoices: fixture.priorInvoices
  });

  const types = result.findings.map(f => f.type).sort();
  assert.deepEqual(types, [...item.expected.types].sort(), `${item.id} finding types`);
  assert.equal(result.potential_overcharge, item.expected.potential_overcharge, `${item.id} potential amount`);
  assert.equal(result.truth, "SYNTHETIC_STRUCTURED_BENCHMARK_ONLY");
}

console.log(JSON.stringify({
  ok: true,
  benchmark: fixture.benchmark_id,
  cases: fixture.cases.length,
  warning: "Structured synthetic benchmark only. Does not prove OCR/PDF extraction, client recovery, or willingness to pay."
}));
