import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port = 3210;
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, PORT: String(port), LOCAL_DB_PATH: './data/test-local-db.json' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);

const base='http://127.0.0.1:'+port;
async function req(path, opt={}){
  const r=await fetch(base+path,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(path+' '+r.status+' '+JSON.stringify(j));
  return j;
}

try{
  let ok=false;
  for(let i=0;i<30;i++){
    await sleep(200);
    try{ const h=await req('/api/health'); if(h.ok){ok=true;break;} }catch{}
  }
  if(!ok) throw new Error('server did not boot\n'+logs);

  const health=await req('/api/health');
  const caps=await req('/api/capabilities');
  if(!Array.isArray(caps.capabilities)||!caps.capabilities.some(x=>x.id==='signal_to_brief')) throw new Error('capability registry missing');
  if(!['local-json','postgres'].includes(health.db)) throw new Error('unexpected db '+health.db);

  await req('/api/seed/beco13',{method:'POST',body:'{}'});
  const attack=await req('/api/seed/client-attack',{method:'POST',body:'{}'});
  if(attack.count<4) throw new Error('client attack map not seeded');

  const boot=await req('/api/bootstrap');
  if(!boot.tenants.some(t=>t.id==='beco13')) throw new Error('beco13 missing');
  if(!boot.prospects.some(p=>p.id==='lead-a1')) throw new Error('priority lead missing');

  const job=await req('/api/jobs',{method:'POST',body:JSON.stringify({
    tenant_id:'beco13', product_id:'miniatura', productName:'Miniatura 1:36', category:'general',
    country:'US', channel:'Meta / Instagram', business_model:'DTC', vertical:'general', objective:'creative_test'
  })});
  if(job.status!=='AWAITING_ASSETS') throw new Error('job status unexpected');

  const econ=await req('/api/economics',{method:'POST',body:JSON.stringify({
    prospect_id:'lead-a1',quote_usd:500,cash_received_usd:500,provider_cost_usd:20,infra_cost_usd:5,payment_fees_usd:15,owner_hours:4,owner_hour_value_usd:30
  })});
  if(Number(econ.gross_margin_cash_usd)!==460) throw new Error('economics calc wrong');
  if(Number(econ.gross_margin_after_owner_time_usd)!==340) throw new Error('owner-time margin calc wrong');

  await req('/api/prospects/lead-a1/stage',{method:'PATCH',body:JSON.stringify({stage:'APPROVED_FOR_CONTACT'})});
  const after=await req('/api/bootstrap');
  const lead=after.prospects.find(p=>p.id==='lead-a1');
  if(lead.stage!=='APPROVED_FOR_CONTACT') throw new Error('lead stage not persisted');

  console.log('SMOKE_OK', JSON.stringify({health,prospects:after.prospects.length,jobs:after.jobs.length,economics:after.economics.length}));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
