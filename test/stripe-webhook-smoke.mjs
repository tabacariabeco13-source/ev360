import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import crypto from 'node:crypto';

const port=3219;
const secret='whsec_test_creative_ops';
const db='./data/test-stripe-local-db.json';
try{fs.rmSync(db,{force:true})}catch{}
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:db,ASSET_ROOT:'./data/test-stripe-assets',STRIPE_WEBHOOK_SECRET:secret},
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
function stripeHeader(payload,t){
  const sig=crypto.createHmac('sha256',secret).update(String(t)+'.'+payload).digest('hex');
  return 't='+t+',v1='+sig;
}

try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await json('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);

  await json('/api/seed/universal-demo',{method:'POST',body:'{}'});
  const e=await json('/api/engagements',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',delivery_mode:'FULL_PILOT',price_usd:500,provider_cost_usd:20,infra_cost_usd:5,payment_fees_usd:15,human_hours:4,owner_hour_value_usd:30,minimum_margin:0.35
  })});

  const event={
    id:'evt_test_creative_ops_001',
    type:'checkout.session.completed',
    data:{object:{
      id:'cs_test_001',
      amount_total:50000,
      currency:'usd',
      payment_intent:'pi_test_001',
      metadata:{engagement_id:e.id}
    }}
  };
  const raw=JSON.stringify(event);
  const t=Math.floor(Date.now()/1000);
  const r=await fetch(base+'/api/payments/stripe/webhook',{
    method:'POST',
    headers:{'content-type':'application/json','stripe-signature':stripeHeader(raw,t)},
    body:raw
  });
  const j=await r.json();
  if(!r.ok) throw new Error('webhook '+r.status+' '+JSON.stringify(j));
  if(j.payment?.state!=='PAID_VERIFIED') throw new Error('stripe payment not verified');

  const duplicate=await fetch(base+'/api/payments/stripe/webhook',{
    method:'POST',
    headers:{'content-type':'application/json','stripe-signature':stripeHeader(raw,t)},
    body:raw
  });
  const dj=await duplicate.json();
  if(!dj.duplicate) throw new Error('duplicate webhook not detected');

  const engagements=await json('/api/engagements');
  const updated=engagements.find(x=>x.id===e.id);
  if(updated?.status!=='PAID_VERIFIED') throw new Error('engagement status not updated');

  const audit=await json('/api/audit?tenant_id=northstar-demo');
  if(!audit.some(x=>x.event_type==='STRIPE_WEBHOOK'&&x.payload?.event_id===event.id)) throw new Error('stripe audit missing');

  console.log('STRIPE_WEBHOOK_SMOKE_OK',JSON.stringify({engagement:e.id,state:updated.status,duplicate:dj.duplicate}));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('STRIPE_WEBHOOK_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
