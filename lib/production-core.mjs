export function normalizeProviders(registry){
  return (registry?.providers||[]).map(p=>({
    ...p,
    estimated_cost_usd: Number.isFinite(Number(p.estimated_cost_usd)) ? Number(p.estimated_cost_usd) : null
  }));
}

export function productionPlan({capability='GENERATE_ASSET',authorized_usd=0,registry,allow_on_demand=false}={}){
  const providers=normalizeProviders(registry);
  const eligible=providers.filter(p=>{
    if(!p.capabilities?.includes(capability)) return false;
    if(p.status==='ACTIVE') return true;
    if(allow_on_demand && p.status==='ON_DEMAND') return true;
    return false;
  });

  const priced=eligible.filter(p=>p.estimated_cost_usd!==null);
  const affordable=priced.filter(p=>p.estimated_cost_usd<=Number(authorized_usd||0));
  const local=affordable.filter(p=>p.mode==='LOCAL_FREE').sort((a,b)=>(b.quality_score||0)-(a.quality_score||0))[0];
  const paid=affordable.filter(p=>p.mode!=='LOCAL_FREE').sort((a,b)=>(b.quality_score||0)-(a.quality_score||0))[0];
  const chosen=local||paid||null;

  if(chosen){
    return {
      status:'READY',
      capability,
      authorized_usd:Number(authorized_usd||0),
      provider:chosen,
      expected_cost_usd:chosen.estimated_cost_usd,
      requires_owner_approval:Boolean(chosen.requires_spend_approval && chosen.estimated_cost_usd>0)
    };
  }

  const unpriced=eligible.filter(p=>p.estimated_cost_usd===null);
  return {
    status:'BLOCKED',
    capability,
    authorized_usd:Number(authorized_usd||0),
    provider:null,
    blockers:[
      ...(eligible.length===0?['NO_ACTIVE_PROVIDER_FOR_CAPABILITY']:[]),
      ...(unpriced.length?['PROVIDER_PRICE_UNKNOWN']:[]),
      ...(priced.length && !affordable.length?['AUTHORIZED_SPEND_TOO_LOW']:[])
    ],
    candidates:eligible.map(p=>({id:p.id,status:p.status,mode:p.mode,estimated_cost_usd:p.estimated_cost_usd}))
  };
}
