import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import fs from 'node:fs';
import path from 'node:path';

const port=3215;
const assetRoot='./data/test-assets';
try{fs.rmSync(assetRoot,{recursive:true,force:true})}catch{}
const child=spawn(process.execPath,['server.js'],{
  env:{...process.env,PORT:String(port),LOCAL_DB_PATH:'./data/test-storage-local-db.json',ASSET_ROOT:assetRoot},
  stdio:['ignore','pipe','pipe']
});
let logs='';
child.stdout.on('data',d=>logs+=d);
child.stderr.on('data',d=>logs+=d);
const base='http://127.0.0.1:'+port;
async function req(p,opt={}){
  const r=await fetch(base+p,{headers:{'content-type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(p+' '+r.status+' '+JSON.stringify(j));
  return j;
}
function pngData(seed){
  const buf=Buffer.from('asset-'+seed);
  return 'data:image/png;base64,'+buf.toString('base64');
}
try{
  let live=false;
  for(let i=0;i<30;i++){await sleep(200);try{if((await req('/api/health')).ok){live=true;break}}catch{}}
  if(!live) throw new Error('boot failed '+logs);
  await req('/api/seed/universal-demo',{method:'POST',body:'{}'});
  const job=await req('/api/jobs',{method:'POST',body:JSON.stringify({
    tenant_id:'northstar-demo',product_id:'northstar-lamp',productName:'Portable Ambient Lamp',category:'home',vertical:'home',country:'US',channel:'organic'
  })});
  const stored=await req('/api/jobs/'+job.id+'/assets',{method:'POST',body:JSON.stringify({assets:[
    {name:'one.png',dataUrl:pngData('one')},
    {name:'two.png',dataUrl:pngData('two')},
    {name:'three.png',dataUrl:pngData('three')}
  ]})});
  const refs=stored.direction.assets;
  if(refs.length!==3) throw new Error('asset refs missing');
  if(refs.some(x=>x.dataUrl)) throw new Error('inline data URL leaked into job persistence');
  if(refs.some(x=>x.provider!=='LOCAL_FS')) throw new Error('wrong storage provider');
  for(const ref of refs){
    const abs=path.join(assetRoot,ref.storage_key);
    if(!fs.existsSync(abs)) throw new Error('asset file missing '+abs);
    const r=await fetch(base+ref.url);
    if(!r.ok) throw new Error('asset URL not served');
  }
  console.log('STORAGE_SMOKE_OK',JSON.stringify({count:refs.length,provider:refs[0].provider,inlinePayloads:stored.direction.assetStorage.inlinePayloads}));
  child.kill('SIGTERM');
  process.exit(0);
}catch(e){
  console.error('STORAGE_SMOKE_FAIL',e);
  console.error(logs);
  child.kill('SIGTERM');
  process.exit(1);
}
