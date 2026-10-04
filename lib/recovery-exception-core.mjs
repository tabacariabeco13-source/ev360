export const RECOVERY_TYPES = Object.freeze({
  MISSING_CREDIT_MEMO: "MISSING_CREDIT_MEMO",
  PARTIAL_CREDIT_MEMO: "PARTIAL_CREDIT_MEMO",
  ISSUED_UNAPPLIED: "ISSUED_UNAPPLIED",
  PARTIALLY_APPLIED: "PARTIALLY_APPLIED",
  RESOLVED_NO_EXCEPTION: "RESOLVED_NO_EXCEPTION",
  INCONCLUSIVE_MISSING_APPROVAL: "INCONCLUSIVE_MISSING_APPROVAL",
  DATA_INCONSISTENCY: "DATA_INCONSISTENCY"
});

const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const sum = rows => money((rows || []).reduce((acc, row) => acc + Number(row.amount || 0), 0));

export function investigateRecoveryException(input = {}) {
  const approved = input.approval?.status === "APPROVED" ? money(input.approval.amount) : null;
  const memo = input.credit_memo ? money(input.credit_memo.amount) : null;
  const applied = sum(input.applications);

  const evidence = [];
  const missing = [];
  if (input.approval?.status === "APPROVED") evidence.push("approval");
  else missing.push("approval");
  if (input.rma?.id) evidence.push("rma");
  else missing.push("rma");
  if (input.credit_memo?.id) evidence.push("credit_memo");
  else missing.push("credit_memo");
  if ((input.applications || []).length) evidence.push("application_history");
  else missing.push("application_history");

  let classification = RECOVERY_TYPES.INCONCLUSIVE_MISSING_APPROVAL;
  let potential = 0;
  let confidence = "LOW";
  let nextAction = "Obter prova de aprovação antes de afirmar crédito devido.";

  if (approved !== null) {
    confidence = "MEDIUM";

    if (memo === null) {
      classification = RECOVERY_TYPES.MISSING_CREDIT_MEMO;
      potential = approved;
      confidence = input.rma?.id ? "HIGH" : "MEDIUM";
      nextAction = "Confirmar com o fornecedor a emissão do crédito aprovado.";
    } else if (memo > approved) {
      classification = RECOVERY_TYPES.DATA_INCONSISTENCY;
      potential = 0;
      nextAction = "Reconciliar aprovação e credit memo; valores são incompatíveis.";
    } else if (memo < approved) {
      classification = RECOVERY_TYPES.PARTIAL_CREDIT_MEMO;
      potential = money(approved - memo);
      confidence = "HIGH";
      nextAction = "Investigar por que o credit memo é inferior ao valor aprovado.";
    } else if (applied === 0) {
      classification = RECOVERY_TYPES.ISSUED_UNAPPLIED;
      potential = memo;
      confidence = "HIGH";
      nextAction = "Localizar onde o credit memo foi ou deveria ter sido aplicado.";
    } else if (applied < memo) {
      classification = RECOVERY_TYPES.PARTIALLY_APPLIED;
      potential = money(memo - applied);
      confidence = "HIGH";
      nextAction = "Rastrear o saldo do credit memo ainda não aplicado.";
    } else if (applied === memo) {
      classification = RECOVERY_TYPES.RESOLVED_NO_EXCEPTION;
      potential = 0;
      confidence = "HIGH";
      nextAction = "Nenhuma ação de recuperação; fechar como reconciliado.";
    } else {
      classification = RECOVERY_TYPES.DATA_INCONSISTENCY;
      potential = 0;
      nextAction = "Aplicações excedem o credit memo; revisar referências e duplicidades.";
    }
  }

  return {
    case_id: input.id || null,
    classification,
    approved_amount: approved,
    credit_memo_amount: memo,
    applied_amount: applied,
    potential_amount: potential,
    confidence,
    evidence_found: evidence,
    missing_evidence: missing,
    next_action: nextAction,
    truth: "SYNTHETIC_BENCHMARK_ONLY"
  };
}
