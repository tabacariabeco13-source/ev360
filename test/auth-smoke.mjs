import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { hashApiKey } from '../lib/auth-core.mjs';

const port=3216;
const ownerKey='owner-test-secret';
const tenantKey='tenant-test-secret';
const authKeys=[
  {subject:'owner',role:'OWNER',tenant_ids:['*'],key_hash:hashApiKey(ownerKey)},
  {subject:'northstar-operator',role:'OPERATOR',tenant_ids:['northstar-demo'],key_hash:hashApiKey(tenantKey)}
];
const child=spawn(process.execPath,['server.js'],{
  env:{
    ...process.env,
    PORT:String(port),
    LOCAL_DB_PATH:'./data/test-auth-local-db.json',
    ASSET_ROOT:'./data/test-auth-assets',
    AUTH_REQUIRED:'true',
    AUTH_KEYS_JSON:JSON.stringify(authKeys)
  },
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:'+port;
async function call(path,{key,expect=200,...opt}={}){
  const headers={'content-type':'application/json',...(opt.headers||{})};
  if(key) headers.authorization='Bearer '+key;
  const r=await fetch(base+path,{...opt,headers});
  const j=await r.json().catch(()=>({}));
  if(r.status!==expect) throw new Error(path+' got '+r.status+' expected '+expect+' '+JSON.stringify(j));
  return j;
}

try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await call('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);

  await call('/api/bootstrap',{expect:401});
  await call('/api/seed/universal-demo',{key:ownerKey,method:'POST',body:'{}'});
  await call('/api/seed/beco13',{key:ownerKey,method:'POST',body:'{}'});

  await call('/api/seed/beco13',{key:tenantKey,method:'POST',body:'{}',expect:403});

  const me=await call('/api/auth/me',{key:tenantKey});
  if(me.actor.subject!=='northstar-operator') throw new Error('actor mismatch');

  const boot=await call('/api/bootstrap',{key:tenantKey});
  if(boot.tenants.length!==1 || boot.tenants[0].id!=='northstar-demo') throw new Error('bootstrap tenant leak');
  if(boot.products.some(x=>x.tenant_id==='beco13')) throw new Error('product leak');

  const ok=await call('/api/tenant/northstar-demo/summary',{key:tenantKey});
  if(ok.tenant?.id!=='northstar-demo') throw new Error('allowed tenant unavailable');

  await call('/api/tenant/beco13/summary',{key:tenantKey,expect:403});

  console.log('AUTH_SMOKE_OK',JSON.stringify({
    authRequired:true,
    actor:me.actor.subject,
    visibleTenants:boot.tenants.map(x=>x.id)
  }));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('AUTH_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
