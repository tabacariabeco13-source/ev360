import assert from "node:assert/strict";
import fs from "node:fs";
import { investigateRecoveryException } from "../lib/recovery-exception-core.mjs";

const fixture = JSON.parse(
  fs.readFileSync(new URL("../experiments/recovery-001/fixtures/benchmark.json", import.meta.url), "utf8")
);

let totalPotential = 0;
for (const item of fixture.cases) {
  const result = investigateRecoveryException(item);
  assert.equal(result.classification, item.expected.classification, `${item.id} classification`);
  assert.equal(result.potential_amount, item.expected.potential_amount, `${item.id} potential amount`);
  assert.equal(result.truth, "SYNTHETIC_BENCHMARK_ONLY");
  totalPotential += result.potential_amount;
}

assert.equal(fixture.cases.length, 10);
assert.equal(totalPotential, 870);

const falsePositive = investigateRecoveryException(fixture.cases.find(x => x.id === "R005"));
assert.equal(falsePositive.classification, "RESOLVED_NO_EXCEPTION");
assert.equal(falsePositive.potential_amount, 0);

console.log(JSON.stringify({
  ok: true,
  benchmark: fixture.benchmark_id,
  cases: fixture.cases.length,
  expected_potential_total: totalPotential,
  warning: "Synthetic fixture only; this does not prove extraction speed, recovery rate, or customer willingness to pay."
}));
