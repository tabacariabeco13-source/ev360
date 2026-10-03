import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';

const port=3220;
const db='./data/test-performance-local-db.json';
try{fs.rmSync(db,{force:true})}catch{}
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:db,ASSET_ROOT:'./data/test-performance-assets'},
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
const body=x=>JSON.stringify(x);

try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await req('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);

  await req('/api/seed/beco13',{method:'POST',body:'{}'});

  const job1=await req('/api/jobs',{method:'POST',body:body({
    tenant_id:'beco13',product_id:'fone',productName:'Fone AirDots',category:'tech',
    country:'BR',channel:'TikTok Organic',business_model:'Retail',vertical:'tech',objective:'whatsapp_leads'
  })});
  if(job1.direction?.learning_context?.mode!=='EXPLORE') throw new Error('first Beco job should explore');

  const exp=await req('/api/experiments',{method:'POST',body:body({
    tenant_id:'beco13',product_id:'fone',parent_job_id:job1.id,
    hypothesis:'Product-first hook increases qualified WhatsApp interest',
    changed_variable:'hook',target_metric:'whatsapp_leads',baseline:{whatsapp_leads:0}
  })});

  const perf=await req('/api/performance-events',{method:'POST',body:body({
    tenant_id:'beco13',product_id:'fone',job_id:job1.id,experiment_id:exp.id,
    channel:'TikTok Organic',post_url:'https://www.tiktok.com/@beco13/video/test',
    primary_metric:'whatsapp_leads',target:2,min_sample:100,
    metrics:{views:1200,likes:110,comments:8,shares:12,saves:20,profile_visits:45,link_clicks:18,whatsapp_leads:3,orders:1,revenue:35,spend:0,avg_watch_sec:6.5,video_duration_sec:10}
  })});

  if(perf.evaluation.outcome!=='WINNER') throw new Error('Beco TikTok performance should be winner');
  if(perf.evaluation.derived.roas!==null) throw new Error('organic post must not invent ROAS with zero spend');

  const brain=await req('/api/tenant/beco13/brain?product_id=fone');
  if(brain.recommendation?.mode!=='CONTROLLED_CHILD') throw new Error('performance did not update tenant brain');

  const job2=await req('/api/jobs',{method:'POST',body:body({
    tenant_id:'beco13',product_id:'fone',productName:'Fone AirDots',category:'tech',
    country:'BR',channel:'TikTok Organic',business_model:'Retail',vertical:'tech',objective:'whatsapp_leads'
  })});
  if(job2.direction?.learning_context?.mode!=='CONTROLLED_CHILD') throw new Error('next Beco job ignored TikTok result');

  const events=await req('/api/performance-events?tenant_id=beco13');
  if(events.length!==1) throw new Error('performance event not persisted');

  console.log('PERFORMANCE_LOOP_SMOKE_OK',JSON.stringify({
    first:job1.direction.learning_context.mode,
    outcome:perf.evaluation.outcome,
    whatsapp_leads:perf.evaluation.primary_value,
    next:job2.direction.learning_context.mode,
    roas:perf.evaluation.derived.roas
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('PERFORMANCE_LOOP_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
