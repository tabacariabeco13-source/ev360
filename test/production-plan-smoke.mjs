import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port=3217;
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-production-local-db.json'},
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

  const brand=await req('/api/brand');
  if(brand.brand!=='AdNimbly') throw new Error('brand config missing');

  const providers=await req('/api/providers');
  if(!providers.providers.some(p=>p.id==='local-manual'&&p.status==='ACTIVE')) throw new Error('local provider missing');

  const local=await req('/api/production/plan',{method:'POST',body:JSON.stringify({capability:'GENERATE_ASSET',authorized_usd:0})});
  if(local.status!=='READY'||local.provider?.id!=='local-manual') throw new Error('zero-cash production path failed');

  const premium=await req('/api/production/plan',{method:'POST',body:JSON.stringify({capability:'GENERATE_PREMIUM_VIDEO',authorized_usd:0})});
  if(premium.status!=='BLOCKED') throw new Error('premium video should be blocked');
  if(!premium.blockers.includes('NO_ACTIVE_PROVIDER_FOR_CAPABILITY')) throw new Error('premium blocker missing');

  console.log('PRODUCTION_PLAN_SMOKE_OK',JSON.stringify({brand:brand.brand,local:local.provider.id,premium:premium.blockers}));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('PRODUCTION_PLAN_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
