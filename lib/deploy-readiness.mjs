export function deploymentReadiness({env={},providerRegistry={},runtime='local'}={}){
  const isVercel=String(env.VERCEL||'').toLowerCase()==='1' || String(env.VERCEL||'').toLowerCase()==='true';
  const hasDatabase=Boolean(env.DATABASE_URL);
  const authRequired=String(env.AUTH_REQUIRED||'false').toLowerCase()==='true';
  let authKeys=0;
  try{
    const parsed=JSON.parse(env.AUTH_KEYS_JSON||'[]');
    authKeys=Array.isArray(parsed)?parsed.filter(x=>x?.key_hash).length:0;
  }catch{}
  const stripeWebhook=Boolean(env.STRIPE_WEBHOOK_SECRET);
  const objectStorage=Boolean(env.OBJECT_STORAGE_URL||env.S3_BUCKET||env.BLOB_READ_WRITE_TOKEN);
  const providers=providerRegistry.providers||[];
  const premiumProvider=providers.some(p=>p.status==='ACTIVE' && (p.capabilities||[]).includes('GENERATE_PREMIUM_VIDEO'));
  const localProvider=providers.some(p=>p.status==='ACTIVE' && p.mode==='LOCAL_FREE');

  const previewBlockers=[];
  const paidPilotBlockers=[];
  const fullProductBlockers=[];

  if(!hasDatabase) paidPilotBlockers.push('DURABLE_DATABASE_REQUIRED');
  if(!authRequired) paidPilotBlockers.push('AUTH_REQUIRED_MUST_BE_TRUE');
  if(authRequired && authKeys<1) paidPilotBlockers.push('AT_LEAST_ONE_AUTH_KEY_REQUIRED');
  if(!stripeWebhook) paidPilotBlockers.push('STRIPE_WEBHOOK_SECRET_REQUIRED_FOR_VERIFIED_STRIPE_PAYMENTS');

  fullProductBlockers.push(...paidPilotBlockers);
  if(!objectStorage) fullProductBlockers.push('DURABLE_OBJECT_STORAGE_REQUIRED');
  if(!premiumProvider) fullProductBlockers.push('PREMIUM_VIDEO_PROVIDER_NOT_ACTIVE');

  if(!localProvider && !premiumProvider) previewBlockers.push('NO_PRODUCTION_PATH_AVAILABLE');

  return {
    runtime:isVercel?'VERCEL':String(runtime||'LOCAL').toUpperCase(),
    states:{
      private_preview:{ready:previewBlockers.length===0,blockers:[...new Set(previewBlockers)]},
      paid_pilot:{ready:paidPilotBlockers.length===0,blockers:[...new Set(paidPilotBlockers)]},
      full_product:{ready:fullProductBlockers.length===0,blockers:[...new Set(fullProductBlockers)]}
    },
    infrastructure:{
      durable_database:hasDatabase,
      auth_required:authRequired,
      auth_key_count:authKeys,
      stripe_webhook_configured:stripeWebhook,
      durable_object_storage:objectStorage,
      premium_video_provider_active:premiumProvider,
      local_free_provider_active:localProvider
    },
    truth:{
      local_json_on_serverless:'EPHEMERAL_NOT_PRODUCTION_DURABLE',
      local_fs_on_serverless:'EPHEMERAL_NOT_PRODUCTION_DURABLE',
      rule:'A public URL is not equivalent to production readiness.'
    }
  };
}
