export function pilotQuote(input={}){
  const price=Math.max(0,Number(input.price_usd||0));
  const provider=Math.max(0,Number(input.provider_cost_usd||0));
  const infra=Math.max(0,Number(input.infra_cost_usd||0));
  const fees=Math.max(0,Number(input.payment_fees_usd||0));
  const hours=Math.max(0,Number(input.human_hours||0));
  const hourValue=Math.max(0,Number(input.owner_hour_value_usd||0));
  const contingency=Math.max(0,Number(input.contingency_usd||0));
  const minMargin=Math.max(0,Math.min(1,Number(input.minimum_margin??0.35)));
  const totalCost=provider+infra+fees+(hours*hourValue)+contingency;
  const contribution=price-totalCost;
  const margin=price>0?contribution/price:0;
  return {
    price_usd:price,
    estimated_total_cost_usd:Number(totalCost.toFixed(2)),
    estimated_contribution_usd:Number(contribution.toFixed(2)),
    estimated_margin:Number(margin.toFixed(4)),
    minimum_margin:minMargin,
    approved:price>0 && contribution>0 && margin>=minMargin,
    decision:price>0 && contribution>0 && margin>=minMargin?'QUOTE_READY':'REPRICE_OR_REDUCE_SCOPE'
  };
}

export function paymentTruth(input={}){
  const amount=Math.max(0,Number(input.amount_received_usd||0));
  const source=String(input.verification_source||'MANUAL').toUpperCase();
  const providerRef=String(input.provider_reference||'').trim();
  const verifiedSources=new Set(['STRIPE_WEBHOOK','BANK_CONFIRMED','PROCESSOR_API']);
  const verified=amount>0 && providerRef && verifiedSources.has(source);
  return {
    amount_received_usd:amount,
    verification_source:source,
    provider_reference:providerRef||null,
    verified,
    state:verified?'PAID_VERIFIED':amount>0?'PAYMENT_RECORDED_UNVERIFIED':'UNPAID',
    rule:'Only verified external payment evidence can activate paid delivery.'
  };
}

export function canActivatePilot({quote,payment,full_pilots_active=0,full_pilot_cap=2}={}){
  const blockers=[];
  if(!quote?.approved) blockers.push('QUOTE_NOT_APPROVED');
  if(payment?.state!=='PAID_VERIFIED') blockers.push('PAYMENT_NOT_VERIFIED');
  if(Number(full_pilots_active||0)>=Number(full_pilot_cap||0)) blockers.push('FULL_PILOT_CAP_REACHED');
  return {can_activate:blockers.length===0,blockers};
}
