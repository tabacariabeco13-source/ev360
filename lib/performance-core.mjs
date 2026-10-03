function n(v){const x=Number(v);return Number.isFinite(x)&&x>=0?x:0}
function ratio(a,b){return b>0?a/b:null}
function round(v,d=4){return v===null?null:Number(v.toFixed(d))}

export function normalizePerformance(input={}){
  const m={
    impressions:n(input.impressions),
    views:n(input.views),
    reach:n(input.reach),
    likes:n(input.likes),
    comments:n(input.comments),
    shares:n(input.shares),
    saves:n(input.saves),
    profile_visits:n(input.profile_visits),
    link_clicks:n(input.link_clicks),
    whatsapp_leads:n(input.whatsapp_leads),
    orders:n(input.orders),
    revenue:n(input.revenue),
    spend:n(input.spend),
    watch_time_sec:n(input.watch_time_sec),
    avg_watch_sec:n(input.avg_watch_sec),
    video_duration_sec:n(input.video_duration_sec)
  };
  const denominator=m.views||m.impressions||0;
  return {
    raw:m,
    derived:{
      engagement_rate:round(ratio(m.likes+m.comments+m.shares+m.saves,denominator)),
      click_rate:round(ratio(m.link_clicks,denominator)),
      whatsapp_lead_rate:round(ratio(m.whatsapp_leads,denominator)),
      order_rate:round(ratio(m.orders,denominator)),
      revenue_per_1000_views:denominator>0?round((m.revenue/denominator)*1000,2):null,
      roas:m.spend>0?round(m.revenue/m.spend,2):null,
      avg_watch_pct:m.video_duration_sec>0&&m.avg_watch_sec>0?round(m.avg_watch_sec/m.video_duration_sec):null
    }
  };
}

function metricValue(perf,metric){
  if(metric in perf.raw) return perf.raw[metric];
  if(metric in perf.derived) return perf.derived[metric];
  return null;
}

export function evaluatePerformance({metrics={},primary_metric='whatsapp_leads',baseline=null,target=null,min_sample=100}={}){
  const perf=normalizePerformance(metrics);
  const sample=perf.raw.views||perf.raw.impressions||0;
  const current=metricValue(perf,primary_metric);
  const baselineNum=baseline===null||baseline===undefined?null:Number(baseline);
  const targetNum=target===null||target===undefined?null:Number(target);

  let outcome='INSUFFICIENT_SIGNAL';
  let confidence='LOW';
  let reason='Need more representative signal or an explicit baseline/target before calling a winner or loser.';

  if(sample>=Number(min_sample||0) && current!==null){
    if(targetNum!==null && Number.isFinite(targetNum)){
      outcome=current>=targetNum?'WINNER':'LOSER';
      confidence=sample>=Number(min_sample||0)*3?'HIGH':'MEDIUM';
      reason=outcome==='WINNER'?'Primary metric met or exceeded the declared target.':'Primary metric did not reach the declared target.';
    }else if(baselineNum!==null && Number.isFinite(baselineNum)){
      if(current>baselineNum){outcome='WINNER';reason='Primary metric improved over the supplied baseline.'}
      else if(current<baselineNum){outcome='LOSER';reason='Primary metric underperformed the supplied baseline.'}
      else {outcome='NEUTRAL';reason='Primary metric matched the supplied baseline.'}
      confidence=sample>=Number(min_sample||0)*3?'HIGH':'MEDIUM';
    }
  }

  return {
    ...perf,
    primary_metric,
    primary_value:current,
    baseline:baselineNum,
    target:targetNum,
    sample,
    min_sample:Number(min_sample||0),
    outcome,
    confidence,
    reason,
    next_action:outcome==='WINNER'
      ?'PRESERVE_WINNING_BODY_AND_CREATE_CONTROLLED_CHILDREN'
      :outcome==='LOSER'
        ?'DIAGNOSE_FAILURE_BEFORE_REPLACING_MULTIPLE_VARIABLES'
        :outcome==='NEUTRAL'
          ?'TEST_ONE_MEANINGFUL_VARIABLE'
          :'COLLECT_MORE_SIGNAL'
  };
}
