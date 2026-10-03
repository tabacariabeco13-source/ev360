import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const MIME_EXT={
  'image/png':'png',
  'image/jpeg':'jpg',
  'image/webp':'webp',
  'image/gif':'gif',
  'video/webm':'webm',
  'video/mp4':'mp4'
};

export function decodeDataUrl(dataUrl=''){
  const m=String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if(!m) throw new Error('INVALID_DATA_URL');
  const mime=m[1].toLowerCase();
  const ext=MIME_EXT[mime];
  if(!ext) throw new Error('UNSUPPORTED_ASSET_TYPE');
  const buffer=Buffer.from(m[2],'base64');
  if(!buffer.length) throw new Error('EMPTY_ASSET');
  return {mime,ext,buffer};
}

export function assetDigest(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export function createLocalAssetStore({rootDir,publicPrefix='/assets'}){
  if(!rootDir) throw new Error('rootDir required');
  fs.mkdirSync(rootDir,{recursive:true});

  return {
    provider:'LOCAL_FS',
    async put({dataUrl,name='',tenantId='unknown',jobId='unassigned'}){
      const {mime,ext,buffer}=decodeDataUrl(dataUrl);
      const sha256=assetDigest(buffer);
      const tenantSafe=String(tenantId||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_');
      const jobSafe=String(jobId||'unassigned').replace(/[^a-zA-Z0-9_-]/g,'_');
      const rel=path.join(tenantSafe,jobSafe,sha256+'.'+ext);
      const abs=path.join(rootDir,rel);
      fs.mkdirSync(path.dirname(abs),{recursive:true});
      if(!fs.existsSync(abs)) fs.writeFileSync(abs,buffer);
      return {
        id:sha256,
        sha256,
        provider:'LOCAL_FS',
        mime,
        bytes:buffer.length,
        original_name:name||'',
        storage_key:rel.split(path.sep).join('/'),
        url:publicPrefix+'/'+rel.split(path.sep).join('/'),
        tenant_id:tenantId,
        job_id:jobId
      };
    },
    exists(ref){
      if(!ref?.storage_key) return false;
      return fs.existsSync(path.join(rootDir,ref.storage_key));
    }
  };
}

export function distinctAssetCount(refs=[]){
  return new Set((refs||[]).map(x=>x.sha256||x.id||x.url||x.name).filter(Boolean)).size;
}
