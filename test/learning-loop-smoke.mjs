import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port=3214;
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-learning-local-db.json'},
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
  for(let i=0;i<30;i++){await sleep(200);try{if((await req('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);

  await req('/api/seed/universal-demo',{method:'POST',body:'{}'});

  const first=await req('/api/jobs',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',productName:'Portable Ambient Lamp',
    category:'home',vertical:'home',country:'US',channel:'organic',objective:'creative_test'
  })});
  if(first.direction?.learning_context?.mode!=='EXPLORE') throw new Error('first job should explore');

  const exp=await req('/api/experiments',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',parent_job_id:first.id,
    hypothesis:'Problem-fix body is strong; hook is the variable',changed_variable:'hook',target_metric:'CTR'
  })});
  await req('/api/experiments/'+exp.id+'/result',{method:'POST',body:JSON.stringify({
    outcome:'WINNER',changed_variable:'hook',result:{ctr:1.8}
  })});

  const brain=await req('/api/tenant/northstar-demo/brain?product_id=northstar-lamp');
  if(brain.recommendation?.mode!=='CONTROLLED_CHILD') throw new Error('brain did not learn winner');

  const second=await req('/api/jobs',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',productName:'Portable Ambient Lamp',
    category:'home',vertical:'home',country:'US',channel:'organic',objective:'creative_test'
  })});
  if(second.direction?.learning_context?.mode!=='CONTROLLED_CHILD') throw new Error('next job ignored learning');
  if(!String(second.direction?.variable||'').startsWith('controlled-')) throw new Error('next job variable not controlled');
  if(!String(second.scenes?.[0]?.prompt||'').includes('LEARNING LOOP DIRECTIVE')) throw new Error('production prompt did not change from learning');

  console.log('LEARNING_LOOP_SMOKE_OK',JSON.stringify({
    first:first.direction.learning_context.mode,
    brain:brain.recommendation.mode,
    second:second.direction.learning_context.mode,
    variable:second.direction.variable
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('LEARNING_LOOP_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
