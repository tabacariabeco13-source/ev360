import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const port=3212;
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-sales-local-db.json'},
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
  const board=await req('/api/sales/leads');
  if(board.mapped_count<10) throw new Error('less than ten mapped prospects');
  if(board.ranked.length!==board.mapped_count) throw new Error('ranking count mismatch');
  if(!board.ranked[0].decision?.band) throw new Error('missing prospect decision band');
  const sample=await req('/api/sales/rank',{method:'POST',body:JSON.stringify({leads:[
    {company:'Low barrier',fit:90,urgency:90,budget_score:70,recurring_potential:90,public_evidence:90,competition:20,portfolio_barrier:20,compliance_complexity:20},
    {company:'High barrier',fit:90,urgency:70,budget_score:90,recurring_potential:90,public_evidence:90,competition:90,portfolio_barrier:100,compliance_complexity:90}
  ]})});
  if(sample.recommended.company!=='Low barrier') throw new Error('sales prioritization failed');
  if(!sample.recommended.outreach?.honesty_line) throw new Error('outreach honesty line missing');
  console.log('SALES_SMOKE_OK',JSON.stringify({mapped:board.mapped_count,top:board.ranked[0].id,band:board.ranked[0].decision.band}));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('SALES_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
