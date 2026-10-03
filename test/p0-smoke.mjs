import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port=3211;
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-p0-local-db.json'},
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:'+port;

async function req(path,opt={}){
  const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(path+' '+r.status+' '+JSON.stringify(j));
  return j;
}

try{
  let live=false;
  for(let i=0;i<30;i++){
    await sleep(200);
    try{if((await req('/api/health')).ok){live=true;break}}catch{}
  }
  if(!live) throw new Error('boot failed '+logs);

  const h=await req('/api/health');
  if(h.version!=='0.13.0') throw new Error('wrong version '+h.version);

  const caps=await req('/api/capabilities');
  if(!caps.capabilities.some(x=>x.id==='signal_to_brief')) throw new Error('capability registry missing');

  await req('/api/seed/beco13',{method:'POST',body:'{}'});
  await req('/api/seed/universal-demo',{method:'POST',body:'{}'});

  const evidence=await req('/api/evidence',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',evidence_type:'review_signal',
    source_url:'source:test-review',source_name:'public-review',confidence:82,
    payload:{text:'Customers value a simple warm-light routine.'},
    taxonomy:{market:'US',language:'en',channel:'organic',angle:'problem-fix'}
  })});
  if(evidence.tenant_id!=='northstar-demo') throw new Error('evidence mismatch');

  const policy=await req('/api/policy/check',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',country:'US',channel:'organic',category:'home',source_url:'source:test-policy'
  })});
  if(policy.decision.verification_state!=='SOURCE_RECORDED') throw new Error('policy source missing');

  const ranking=await req('/api/next-best-test',{method:'POST',body:JSON.stringify({options:[
    {id:'A',learning_value:90,urgency:75,fatigue:60,evidence_confidence:85,margin_score:80,inventory_pressure:50,production_cost_score:90,risk_score:15,policy_level:'ALLOWED'},
    {id:'B',learning_value:70,urgency:70,fatigue:70,evidence_confidence:40,margin_score:40,inventory_pressure:40,production_cost_score:20,risk_score:90,policy_level:'REVIEW'}
  ]})});
  if(ranking.recommended.id!=='A') throw new Error('ranking failed');

  const experiment=await req('/api/experiments',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',hypothesis:'Problem-fix opening improves intent',
    changed_variable:'hook',target_metric:'CTR',baseline:{ctr:1.1}
  })});
  const finished=await req('/api/experiments/'+experiment.id+'/result',{method:'POST',body:JSON.stringify({
    outcome:'WINNER',changed_variable:'hook',result:{ctr:1.7}
  })});
  if(finished.learning.next_action!=='PRESERVE_WINNING_BODY_AND_CREATE_CONTROLLED_CHILDREN') throw new Error('learning failed');

  const route=await req('/api/provider/route',{method:'POST',body:JSON.stringify({capability:'GENERATE_ASSET',authorized_usd:0})});
  if(route.chosen?.id!=='local-manual') throw new Error('cost router failed');

  const invocation=await req('/api/provider-invocations',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',provider:'local-manual',capability:'GENERATE_ASSET',mode:'LOCAL_FREE',
    estimated_cost_usd:0,actual_cost_usd:0,authorized_usd:0,status:'COMPLETED',provenance:{source:'p0-smoke'}
  })});
  if(invocation.status!=='COMPLETED') throw new Error('provider provenance failed');

  const readiness=await req('/api/readiness',{method:'POST',body:JSON.stringify({
    policy_level:'ALLOWED',product_fidelity:true,distinct_assets:true,rights_known:true,cta_present:true,provenance_known:true,cost_authorized:true
  })});
  if(!readiness.ready) throw new Error('readiness failed');

  const ns=await req('/api/tenant/northstar-demo/summary');
  const bz=await req('/api/tenant/beco13/summary');
  if(ns.products.some(p=>p.tenant_id==='beco13')) throw new Error('tenant leak into northstar');
  if(bz.products.some(p=>p.tenant_id==='northstar-demo')) throw new Error('tenant leak into case-zero');

  console.log('P0_SMOKE_OK',JSON.stringify({
    version:h.version,evidence:ns.evidence.length,experiments:ns.experiments.length,products:ns.products.length
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('P0_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
