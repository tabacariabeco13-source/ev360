export function classifyReply(text=''){
  const t=String(text||'').toLowerCase();
  const hit=(xs)=>xs.some(x=>t.includes(x));
  let intent='UNKNOWN', priority='NORMAL', next_action='REVIEW_MANUALLY';

  if(hit(['unsubscribe','remove me','stop emailing','do not contact','don’t contact',"don't contact"])){
    intent='DO_NOT_CONTACT'; priority='IMMEDIATE'; next_action='SUPPRESS_FUTURE_OUTREACH';
  } else if(hit(['not interested','no thanks','pass','decline'])){
    intent='DECLINE'; priority='LOW'; next_action='MARK_LOST_AND_CAPTURE_REASON';
  } else if(hit(['not now','later','next month','circle back','follow up later'])){
    intent='NOT_NOW'; priority='LOW'; next_action='SCHEDULE_FOLLOWUP';
  } else if(hit(['how much','price','pricing','cost','budget','rate'])){
    intent='PRICING'; priority='HIGH'; next_action='RUN_QUOTE_GUARD_AND_SEND_SCOPED_PRICE';
  } else if(hit(['send the spec','send spec','send it','show me','sample','portfolio','case study'])){
    intent='SPEC_REQUEST'; priority='HIGH'; next_action='SEND_BUYER_SPEC_AND_NARROW_PAID_NEXT_STEP';
  } else if(hit(['call','meeting','book','calendar','zoom','meet'])){
    intent='CALL_REQUEST'; priority='HIGH'; next_action='PROPOSE_SHORTEST_USEFUL_CALL_AND_PREP_CONTEXT';
  } else if(hit(['interested','sounds good','let’s try',"let's try",'pilot','start','go ahead','yes'])){
    intent='POSITIVE'; priority='HIGH'; next_action='QUALIFY_SCOPE_AND_MOVE_TO_PAID_PILOT';
  }

  return {
    intent, priority, next_action,
    rules:[
      'Do not invent performance or account access.',
      'Do not send a full free project.',
      'Run pricing guard before committing price/scope.',
      'Respect do-not-contact immediately.'
    ]
  };
}

export function buildReplyPlan({reply_text='',buyer={},capacity={}}={}){
  const classification=classifyReply(reply_text);
  const fullSlots=Math.max(0,Number(capacity.full_slots_available??0));
  const canStartFull=fullSlots>0;
  let operating_mode='MANUAL_REVIEW';
  if(classification.intent==='POSITIVE' || classification.intent==='PRICING' || classification.intent==='SPEC_REQUEST'){
    operating_mode=canStartFull?'QUALIFY_FOR_ACTIVE_PILOT':'DISCOVERY_OR_STAGGERED_START';
  }
  return {
    buyer:buyer.company||buyer.name||'unknown',
    classification,
    operating_mode,
    can_start_full_pilot_now:canStartFull,
    required_inputs:[
      'current offer / landing page',
      'approved and prohibited claims',
      'top winners and losers if available',
      'primary success metric',
      'raw product / creator assets if production is in scope'
    ]
  };
}
