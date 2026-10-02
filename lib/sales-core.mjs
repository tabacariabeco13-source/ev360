export function scoreProspect(input={}){
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const fit=clamp(input.fit);
  const urgency=clamp(input.urgency);
  const budget=clamp(input.budget_score);
  const recurring=clamp(input.recurring_potential);
  const proofAccess=clamp(input.public_evidence);
  const competition=clamp(input.competition);
  const portfolioBarrier=clamp(input.portfolio_barrier);
  const compliance=clamp(input.compliance_complexity);
  const score=Math.max(0,Math.round(
    fit*.28 + urgency*.17 + budget*.14 + recurring*.18 + proofAccess*.13
    - competition*.05 - portfolioBarrier*.08 - compliance*.05
  ));
  return {
    score,
    band: score>=70?'ATTACK_NOW':score>=55?'ATTACK_WITH_SPEC':score>=40?'QUEUE_AFTER_FIRST_CASE':'MARKET_PROOF_ONLY',
    factors:{fit,urgency,budget,recurring,proofAccess,competition,portfolioBarrier,compliance}
  };
}

export function buildOutreachBrief(p={}){
  return {
    buyer: p.company||p.title||'buyer',
    first_line: p.first_line||'We studied the role and prepared a buyer-specific outside-in spec before asking for a call.',
    proof_asset: p.proof_asset||'1 buyer-specific diagnosis + 1 concept + 3 hooks + 1 production-ready brief',
    honesty_line: 'This is a spec case study built from public evidence. We are not claiming private account access or performance we did not produce.',
    ask: p.ask||'Would you like the private spec and test plan before deciding whether to run a paid pilot?',
    no_spend_rule: 'No paid media or paid-generation spend is required before buyer approval.'
  };
}
