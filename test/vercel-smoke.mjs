import fs from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

process.env.VERCEL='1';
process.env.AUTH_REQUIRED='false';
process.env.LOCAL_DB_PATH='/tmp/creative-ops-vercel-smoke-db.json';
process.env.ASSET_ROOT='/tmp/creative-ops-vercel-smoke-assets';
try{fs.rmSync(process.env.LOCAL_DB_PATH,{force:true})}catch{}
try{fs.rmSync(process.env.ASSET_ROOT,{recursive:true,force:true})}catch{}

const mod=await import('../api/index.js?vercel-smoke='+Date.now());
const app=mod.default;
if(!app || typeof app.listen!=='function') throw new Error('Vercel entrypoint did not export Express app');

const port=3221;
const server=app.listen(port);
await sleep(100);
const base='http://127.0.0.1:'+port;

try{
  const health=await (await fetch(base+'/api/health')).json();
  if(!health.ok) throw new Error('health failed');
  if(health.version!=='0.14.0') throw new Error('wrong version '+health.version);
  if(health.runtime!=='VERCEL') throw new Error('runtime not marked VERCEL');

  const readiness=await (await fetch(base+'/api/deploy-readiness')).json();
  if(!readiness.states?.private_preview?.ready) throw new Error('private preview should be structurally ready');
  if(readiness.states?.paid_pilot?.ready) throw new Error('paid pilot must not be called ready without production env');
  if(!readiness.states?.paid_pilot?.blockers?.includes('DURABLE_DATABASE_REQUIRED')) throw new Error('database blocker missing');
  if(!readiness.states?.full_product?.blockers?.includes('DURABLE_OBJECT_STORAGE_REQUIRED')) throw new Error('object storage blocker missing');

  const html=await (await fetch(base+'/')).text();
  if(!html.includes('AdNimbly')) throw new Error('SPA not served through Vercel adapter');

  console.log('VERCEL_SMOKE_OK',JSON.stringify({
    version:health.version,
    runtime:health.runtime,
    preview:readiness.states.private_preview,
    paidPilot:readiness.states.paid_pilot,
    fullProduct:readiness.states.full_product
  }));
}finally{
  await new Promise(resolve=>server.close(resolve));
}
