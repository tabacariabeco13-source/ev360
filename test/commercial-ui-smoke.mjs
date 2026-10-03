import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port=3213;
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-commercial-ui-local-db.json'},
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:'+port;

async function json(path,opt={}){
  const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(path+' '+r.status+' '+JSON.stringify(j));
  return j;
}

try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await json('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);

  const html=await (await fetch(base+'/')).text();
  if(!html.includes('Commercial Command Center')) throw new Error('commercial UI missing');
  if(!html.includes('AdNimbly')) throw new Error('provisional brand missing');
  if(!html.includes('Production Planner')) throw new Error('production planner UI missing');
  if(!html.includes('Paid Pilot Engine')) throw new Error('paid pilot UI missing');
  if(!html.includes('Audit Ledger')) throw new Error('audit ledger UI missing');
  if(!html.includes('/commercial.js')) throw new Error('commercial client script missing');

  const js=await (await fetch(base+'/commercial.js')).text();
  if(!js.includes('/api/sales/reply-triage')) throw new Error('reply triage UI wiring missing');
  if(!js.includes('/api/pricing/guard')) throw new Error('quote guard UI wiring missing');
  if(!js.includes('/api/production/plan')) throw new Error('production planner UI wiring missing');
  if(!js.includes('/api/engagements')) throw new Error('engagement UI wiring missing');
  if(!js.includes('/api/audit')) throw new Error('audit UI wiring missing');

  const admission=await json('/api/admission-policy');
  if(admission.simultaneous_full_pilots_cap!==2) throw new Error('admission policy cap drifted');

  const seed=await json('/api/seed/beco13',{method:'POST',body:'{}'});
  const mini=seed.products.find(p=>p.id==='miniatura');
  if(!mini) throw new Error('miniature seed missing');
  if(Number(mini.price)!==0 || Number(mini.cost)!==0) throw new Error('unverified miniature economics reintroduced');
  if(mini.metadata?.economicDataVerified!==false) throw new Error('miniature economics verification flag missing');

  console.log('COMMERCIAL_UI_SMOKE_OK',JSON.stringify({
    admission:admission.simultaneous_full_pilots_cap,
    mini:{price:mini.price,cost:mini.cost,verified:mini.metadata?.economicDataVerified}
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('COMMERCIAL_UI_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
