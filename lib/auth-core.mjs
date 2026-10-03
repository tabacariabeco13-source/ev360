import crypto from 'crypto';

const ROLE_ORDER={VIEWER:10,OPERATOR:20,OWNER:100};

export function hashApiKey(key=''){
  return crypto.createHash('sha256').update(String(key)).digest('hex');
}

export function parseAuthKeys(json='[]'){
  let arr=[];
  try{arr=JSON.parse(json||'[]')}catch{throw new Error('INVALID_AUTH_KEYS_JSON')}
  if(!Array.isArray(arr)) throw new Error('INVALID_AUTH_KEYS_JSON');
  return arr.map(x=>({
    subject:String(x.subject||'unknown'),
    role:String(x.role||'VIEWER').toUpperCase(),
    tenant_ids:Array.isArray(x.tenant_ids)?x.tenant_ids.map(String):[],
    key_hash:String(x.key_hash||'').toLowerCase()
  })).filter(x=>x.key_hash);
}

export function extractBearer(headers={}){
  const auth=headers.authorization||headers.Authorization||'';
  const m=String(auth).match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():String(headers['x-api-key']||headers['X-Api-Key']||'').trim();
}

export function authenticateHeaders(headers={},keys=[]){
  const raw=extractBearer(headers);
  if(!raw) return null;
  const digest=hashApiKey(raw);
  const match=keys.find(x=>safeEqual(x.key_hash,digest));
  return match?{subject:match.subject,role:match.role,tenant_ids:match.tenant_ids,auth_mode:'API_KEY'}:null;
}

function safeEqual(a,b){
  const aa=Buffer.from(String(a));
  const bb=Buffer.from(String(b));
  if(aa.length!==bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

export function canAccessTenant(actor,tenantId){
  if(!tenantId) return true;
  if(!actor) return false;
  if(String(actor.role).toUpperCase()==='OWNER') return true;
  const allowed=new Set((actor.tenant_ids||[]).map(String));
  return allowed.has('*')||allowed.has(String(tenantId));
}

export function hasRole(actor,minimum='VIEWER'){
  if(!actor) return false;
  return (ROLE_ORDER[String(actor.role).toUpperCase()]||0)>=(ROLE_ORDER[String(minimum).toUpperCase()]||999);
}

export function visibleTenantIds(actor){
  if(!actor) return [];
  if(String(actor.role).toUpperCase()==='OWNER'||(actor.tenant_ids||[]).includes('*')) return ['*'];
  return (actor.tenant_ids||[]).map(String);
}
