import { capacityAssessment, quoteGuard } from '../lib/capacity-core.mjs';

const c=capacityAssessment({
  required_people:5,
  hours_per_person_week:30,
  measured_work_units_per_hour:2,
  operator_hours_available_week:20,
  automation_share:0.7,
  quality_pass_rate:0.95,
  work_units_per_person_week:10
});
if(c.requested_human_hours_week!==150) throw new Error('requested hours wrong');
if(c.can_claim_replaces_all_people) throw new Error('replacement claim should stay false without enough measured capacity');

const q=quoteGuard({
  price_usd:1000,
  provider_cost_usd:80,
  infra_cost_usd:20,
  payment_fees_usd:50,
  human_hours:8,
  owner_hour_value_usd:40,
  contingency_usd:30,
  minimum_margin:0.35
});
if(q.decision!=='ACCEPTABLE') throw new Error('quote guard expected acceptable');
console.log('CAPACITY_SMOKE_OK',JSON.stringify({capacity:c,quote:q}));
