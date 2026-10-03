import { classifyReply, buildReplyPlan } from '../lib/reply-core.mjs';

const cases=[
  ['How much would the pilot cost?','PRICING'],
  ['Send the spec, I want to see it.','SPEC_REQUEST'],
  ['Can we book a call tomorrow?','CALL_REQUEST'],
  ['Sounds good, let’s try a pilot.','POSITIVE'],
  ['Circle back next month.','NOT_NOW'],
  ['No thanks, not interested.','DECLINE'],
  ['Please unsubscribe me.','DO_NOT_CONTACT']
];
for(const [text,expected] of cases){
  const r=classifyReply(text);
  if(r.intent!==expected) throw new Error(text+' => '+r.intent+' expected '+expected);
}
const plan=buildReplyPlan({
  reply_text:'Sounds good, let’s try a pilot.',
  buyer:{company:'Test Buyer'},
  capacity:{full_slots_available:1}
});
if(!plan.can_start_full_pilot_now) throw new Error('available slot not recognized');
if(plan.operating_mode!=='QUALIFY_FOR_ACTIVE_PILOT') throw new Error('wrong operating mode');
console.log('REPLY_SMOKE_OK',JSON.stringify({intent:plan.classification.intent,mode:plan.operating_mode}));
