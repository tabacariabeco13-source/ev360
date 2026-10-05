const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const RECONCILIATION_FINDINGS = Object.freeze({
  PRICE_MISMATCH: "PRICE_MISMATCH",
  DUPLICATE_INVOICE: "DUPLICATE_INVOICE",
  PO_MISMATCH: "PO_MISMATCH",
  UNSUPPORTED_SURCHARGE: "UNSUPPORTED_SURCHARGE",
  QUANTITY_MISMATCH: "QUANTITY_MISMATCH"
});

export function reconcileInvoiceAgainstContract({ invoice, contract, priorInvoices = [] } = {}) {
  if (!invoice || !contract) throw new Error("invoice and contract are required");

  const findings = [];
  const evidence = [];

  const sameInvoice = priorInvoices.find(item =>
    item.invoice_number === invoice.invoice_number &&
    item.supplier_id === invoice.supplier_id &&
    money(item.total) === money(invoice.total)
  );

  if (sameInvoice) {
    findings.push({
      type: RECONCILIATION_FINDINGS.DUPLICATE_INVOICE,
      severity: "HIGH",
      amount: money(invoice.total),
      evidence: ["invoice_number", "supplier_id", "total"],
      explanation: "Invoice number, supplier and total match a prior invoice."
    });
  }

  if (contract.po_number && invoice.po_number && contract.po_number !== invoice.po_number) {
    findings.push({
      type: RECONCILIATION_FINDINGS.PO_MISMATCH,
      severity: "MEDIUM",
      amount: 0,
      evidence: ["contract.po_number", "invoice.po_number"],
      explanation: "Invoice PO does not match the contract/approved PO."
    });
  }

  const contractLines = new Map((contract.lines || []).map(line => [line.sku, line]));
  for (const line of invoice.lines || []) {
    const expected = contractLines.get(line.sku);
    if (!expected) continue;

    const invoicedUnit = money(line.unit_price);
    const contractUnit = money(expected.unit_price);
    const qty = Number(line.quantity || 0);

    if (invoicedUnit !== contractUnit) {
      const delta = money((invoicedUnit - contractUnit) * qty);
      findings.push({
        type: RECONCILIATION_FINDINGS.PRICE_MISMATCH,
        severity: delta > 0 ? "HIGH" : "LOW",
        sku: line.sku,
        amount: delta > 0 ? delta : 0,
        evidence: ["invoice.unit_price", "contract.unit_price", "invoice.quantity"],
        explanation: `Invoice unit price ${invoicedUnit} differs from contract price ${contractUnit}.`
      });
    }

    if (expected.max_quantity != null && qty > Number(expected.max_quantity)) {
      const excessQty = qty - Number(expected.max_quantity);
      findings.push({
        type: RECONCILIATION_FINDINGS.QUANTITY_MISMATCH,
        severity: "MEDIUM",
        sku: line.sku,
        amount: money(excessQty * invoicedUnit),
        evidence: ["invoice.quantity", "contract.max_quantity"],
        explanation: "Invoice quantity exceeds the contracted/approved maximum."
      });
    }
  }

  const allowedSurcharges = new Set(contract.allowed_surcharges || []);
  for (const surcharge of invoice.surcharges || []) {
    if (!allowedSurcharges.has(surcharge.code)) {
      findings.push({
        type: RECONCILIATION_FINDINGS.UNSUPPORTED_SURCHARGE,
        severity: "HIGH",
        code: surcharge.code,
        amount: money(surcharge.amount),
        evidence: ["invoice.surcharge", "contract.allowed_surcharges"],
        explanation: "Invoice contains a surcharge not listed as allowed in the contract."
      });
    }
  }

  for (const finding of findings) {
    evidence.push(...finding.evidence);
  }

  const potentialOvercharge = money(findings.reduce((sum, f) => sum + Math.max(0, Number(f.amount || 0)), 0));

  return {
    invoice_number: invoice.invoice_number,
    supplier_id: invoice.supplier_id,
    finding_count: findings.length,
    findings,
    potential_overcharge: potentialOvercharge,
    evidence_fields: [...new Set(evidence)],
    confidence: findings.length ? "HIGH_ON_STRUCTURED_FIELDS" : "NO_EXCEPTION_FOUND",
    truth: "SYNTHETIC_STRUCTURED_BENCHMARK_ONLY"
  };
}
