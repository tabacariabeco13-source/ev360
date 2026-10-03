import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const port=3218;
const db='./data/test-engagement-local-db.json';
try{fs.rmSync(db,{force:true})}catch{}
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:db,ASSET_ROOT:'./data/test-engagement-assets'},
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:'+port;
async function call(path,{expect=200,...opt}={}){
  const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(r.status!==expect) throw new Error(path+' got '+r.status+' expected '+expect+' '+JSON.stringify(j));
  return j;
}
const body=x=>JSON.stringify(x);

try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await call('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);
  await call('/api/seed/universal-demo',{method:'POST',body:'{}'});

  const quoteInput={
    tenant_id:'northstar-demo',
    price_usd:500,
    provider_cost_usd:20,
    infra_cost_usd:5,
    payment_fees_usd:15,
    human_hours:4,
    owner_hour_value_usd:30,
    contingency_usd:10,
    minimum_margin:0.35,
    delivery_mode:'FULL_PILOT',
    deliverables:['3 concepts','9 hooks','3 briefs']
  };

  const e1=await call('/api/engagements',{method:'POST',body:body(quoteInput)});
  if(e1.status!=='QUOTE_READY'||!e1.quote.approved) throw new Error('approved quote did not become QUOTE_READY');

  const unverified=await call('/api/engagements/'+e1.id+'/payment',{method:'POST',body:body({
    amount_received_usd:500,verification_source:'MANUAL',provider_reference:'note-1'
  })});
  if(unverified.payment.state!=='PAYMENT_RECORDED_UNVERIFIED') throw new Error('manual payment should stay unverified');
  await call('/api/engagements/'+e1.id+'/activate',{method:'POST',body:'{}',expect:409});

  const verified=await call('/api/engagements/'+e1.id+'/payment',{method:'POST',body:body({
    amount_received_usd:500,verification_source:'BANK_CONFIRMED',provider_reference:'bank-test-001'
  })});
  if(verified.payment.state!=='PAID_VERIFIED') throw new Error('verified payment state missing');

  const active1=await call('/api/engagements/'+e1.id+'/activate',{method:'POST',body:'{}'});
  if(active1.status!=='ACTIVE') throw new Error('first pilot not activated');

  const makePaid=async(ref)=>{
    const e=await call('/api/engagements',{method:'POST',body:body({...quoteInput,price_usd:600})});
    await call('/api/engagements/'+e.id+'/payment',{method:'POST',body:body({
      amount_received_usd:600,verification_source:'BANK_CONFIRMED',provider_reference:ref
    })});
    return e;
  };

  const e2=await makePaid('bank-test-002');
  const active2=await call('/api/engagements/'+e2.id+'/activate',{method:'POST',body:'{}'});
  if(active2.status!=='ACTIVE') throw new Error('second pilot not activated');

  const e3=await makePaid('bank-test-003');
  const blocked=await call('/api/engagements/'+e3.id+'/activate',{method:'POST',body:'{}',expect:409});
  if(!blocked.gate?.blockers?.includes('FULL_PILOT_CAP_REACHED')) throw new Error('capacity blocker missing');

  const delivered=await call('/api/engagements/'+e1.id+'/deliver',{method:'POST',body:body({job_ids:['job-a'],result_summary:'delivered'})});
  if(delivered.status!=='DELIVERED') throw new Error('delivery closeout failed');

  const audit=await call('/api/audit?tenant_id=northstar-demo');
  const types=new Set(audit.map(x=>x.event_type));
  for(const required of ['ENGAGEMENT_CREATED','PAYMENT_STATE_CHANGED','PILOT_ACTIVATED','PILOT_DELIVERED']){
    if(!types.has(required)) throw new Error('audit missing '+required);
  }

  console.log('ENGAGEMENT_SMOKE_OK',JSON.stringify({
    first:delivered.status,
    second:active2.status,
    third_blocked:blocked.gate.blockers,
    audit_events:audit.length
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('ENGAGEMENT_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
