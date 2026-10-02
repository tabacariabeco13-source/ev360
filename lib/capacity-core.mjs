export function capacityAssessment(input={}){
  const people=Math.max(0,Number(input.required_people||0));
  const hoursPerPerson=Math.max(0,Number(input.hours_per_person_week||0));
  const requested=people*hoursPerPerson;
  const measuredThroughput=Math.max(0,Number(input.measured_work_units_per_hour||0));
  const weeklyOperatorHours=Math.max(0,Number(input.operator_hours_available_week||0));
  const automationShare=Math.max(0,Math.min(1,Number(input.automation_share||0)));
  const qualityPass=Math.max(0,Math.min(1,Number(input.quality_pass_rate||0)));
  const workUnitsPerSeat=Math.max(0,Number(input.work_units_per_person_week||0));
  const effectiveUnits=measuredThroughput*weeklyOperatorHours*qualityPass;
  const seatEquivalent=workUnitsPerSeat>0?effectiveUnits/workUnitsPerSeat:0;
  const humanHoursAvoided=requested*automationShare;
  const remainingHumanHours=Math.max(0,requested-humanHoursAvoided);
  return {
    requested_people:people,
    requested_human_hours_week:requested,
    measured_work_units_week:Number(effectiveUnits.toFixed(2)),
    measured_seat_equivalent:Number(seatEquivalent.toFixed(2)),
    estimated_human_hours_avoided:Number(humanHoursAvoided.toFixed(2)),
    estimated_remaining_human_hours:Number(remainingHumanHours.toFixed(2)),
    can_claim_replaces_all_people: people>0 && seatEquivalent>=people && qualityPass>=0.9,
    rule:'Do not claim human-seat replacement until throughput and quality are measured on representative work.'
  };
}

export function quoteGuard(input={}){
  const revenue=Math.max(0,Number(input.price_usd||0));
  const provider=Math.max(0,Number(input.provider_cost_usd||0));
  const infra=Math.max(0,Number(input.infra_cost_usd||0));
  const fees=Math.max(0,Number(input.payment_fees_usd||0));
  const humanHours=Math.max(0,Number(input.human_hours||0));
  const hourly=Math.max(0,Number(input.owner_hour_value_usd||0));
  const contingency=Math.max(0,Number(input.contingency_usd||0));
  const cashCost=provider+infra+fees+contingency;
  const laborCost=humanHours*hourly;
  const contribution=revenue-cashCost-laborCost;
  const margin=revenue>0?contribution/revenue:0;
  return {
    price_usd:revenue,
    cash_cost_usd:Number(cashCost.toFixed(2)),
    labor_cost_usd:Number(laborCost.toFixed(2)),
    contribution_usd:Number(contribution.toFixed(2)),
    contribution_margin:Number(margin.toFixed(4)),
    decision: contribution>0 && margin>=Number(input.minimum_margin||0.35)?'ACCEPTABLE':'REPRICE_OR_REDUCE_SCOPE',
    rule:'Price is accepted only after scope, cash cost and owner-time are measured or conservatively estimated.'
  };
}
