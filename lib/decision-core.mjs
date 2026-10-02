export function buildCreativeTaxonomy(input={}){
  const text=(input.text||'').toLowerCase();
  const pick=(pairs,fallback)=>pairs.find(([k])=>text.includes(k))?.[1]||fallback;
  return {
    audience: input.audience||'unknown',
    awareness: input.awareness||pick([['never heard','unaware'],['problem','problem-aware'],['solution','solution-aware'],['product','product-aware'],['offer','most-aware']],'unknown'),
    angle: input.angle||'unspecified',
    mechanism: input.mechanism||'unspecified',
    hook_tactic: input.hook_tactic||pick([['why','curiosity'],['stop','pattern-interrupt'],['before','contrast'],['review','social-proof'],['proof','evidence']],'unspecified'),
    visual_format: input.visual_format||'unspecified',
    creator: input.creator||'unspecified',
    proof_type: input.proof_type||'unspecified',
    offer: input.offer||'unspecified',
    cta: input.cta||'unspecified',
    channel: input.channel||'unspecified',
    placement: input.placement||'unspecified',
    duration_sec: Number(input.duration_sec||0),
    aspect_ratio: input.aspect_ratio||'unspecified',
    market: input.market||'unspecified',
    language: input.language||'unspecified'
  };
}

export function scoreNextBestTest(input={}){
  const clamp=n=>Math.max(0,Math.min(100,Number(n)||0));
  const learning=clamp(input.learning_value);
  const urgency=clamp(input.urgency);
  const fatigue=clamp(input.fatigue);
  const confidence=clamp(input.evidence_confidence);
  const margin=clamp(input.margin_score);
  const inventory=clamp(input.inventory_pressure);
  const cost=clamp(input.production_cost_score);
  const risk=clamp(input.risk_score);
  const policy=String(input.policy_level||'REVIEW').toUpperCase();
  const policyPenalty=policy==='BLOCKED'?100:policy==='REVIEW'?20:0;
  const score=Math.max(0,Math.round(
    learning*.24 + urgency*.16 + fatigue*.15 + confidence*.12 + margin*.12 + inventory*.09 + cost*.12
    - risk*.18 - policyPenalty
  ));
  return {
    score,
    band: score>=70?'RUN_NEXT':score>=45?'QUEUE':score>=25?'RESEARCH_MORE':'HOLD',
    factors:{learning,urgency,fatigue,confidence,margin,inventory,cost,risk,policy,policyPenalty},
    explanation:[
      `learning=${learning}`,`urgency=${urgency}`,`fatigue=${fatigue}`,`evidence=${confidence}`,
      `margin=${margin}`,`inventory=${inventory}`,`cost-efficiency=${cost}`,`risk=${risk}`,`policy=${policy}`
    ].join(' | ')
  };
}

export function selectProvider({capability='GENERATE_ASSET',authorized_usd=0,providers=[]}={}){
  const normalized=providers.filter(p=>p.enabled!==false && (!p.capabilities || p.capabilities.includes(capability)));
  const affordable=normalized.filter(p=>Number(p.estimated_cost_usd||0)<=Number(authorized_usd||0));
  const rank=p=>{
    const q=Number(p.quality_score||50), r=Number(p.reliability_score||50), c=Math.max(0,100-Number(p.estimated_cost_usd||0)*20);
    return q*.45+r*.35+c*.20;
  };
  const chosen=[...affordable].sort((a,b)=>rank(b)-rank(a))[0]||null;
  return {
    capability,
    authorized_usd:Number(authorized_usd||0),
    chosen,
    blocked:!chosen,
    reason:chosen?'provider selected inside cost guard':'no enabled provider fits capability + authorized spend'
  };
}

export function deriveLearning({outcome='NEUTRAL',changed_variable='unknown',metrics={},notes=''}={}){
  const o=String(outcome).toUpperCase();
  const action=o==='WINNER'
    ? 'PRESERVE_WINNING_BODY_AND_CREATE_CONTROLLED_CHILDREN'
    : o==='LOSER'
      ? 'DIAGNOSE_WHETHER_HOOK_OR_BODY_FAILED_BEFORE_NEW_CONCEPT'
      : 'COLLECT_MORE_SIGNAL';
  return {
    outcome:o,
    changed_variable,
    metrics,
    notes,
    next_action:action,
    rule:o==='WINNER'
      ? 'change one meaningful variable at a time'
      : o==='LOSER'
        ? 'do not kill the entire angle from one hook failure'
        : 'avoid confident conclusions without enough signal'
  };
}

export function commercialReadiness({policy_level='REVIEW',product_fidelity=false,distinct_assets=false,rights_known=false,cta_present=false,provenance_known=false,cost_authorized=false}={}){
  const blockers=[];
  if(String(policy_level).toUpperCase()==='BLOCKED') blockers.push('POLICY_BLOCKED');
  if(!product_fidelity) blockers.push('PRODUCT_FIDELITY');
  if(!distinct_assets) blockers.push('SIMILARITY');
  if(!rights_known) blockers.push('RIGHTS_UNKNOWN');
  if(!cta_present) blockers.push('CTA_MISSING');
  if(!provenance_known) blockers.push('PROVENANCE_UNKNOWN');
  if(!cost_authorized) blockers.push('COST_NOT_AUTHORIZED');
  return {ready:blockers.length===0,blockers};
}

export function policyEnvelope({decision,source_url='',checked_at=new Date().toISOString(),expires_at=null,country='US',channel='unknown',category='general'}={}){
  const sourceVerified=Boolean(source_url);
  return {
    ...decision,
    country,channel,category,
    source_url,
    source_verified:sourceVerified,
    checked_at,
    expires_at,
    verification_state:sourceVerified?'SOURCE_RECORDED':'SOURCE_REQUIRED_BEFORE_AUTOMATIC_PUBLISH'
  };
}
