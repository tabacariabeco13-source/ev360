import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { buildCreativeTaxonomy, scoreNextBestTest, selectProvider, deriveLearning, commercialReadiness, policyEnvelope } from './lib/decision-core.mjs';
import { scoreProspect, buildOutreachBrief } from './lib/sales-core.mjs';
import { capacityAssessment, quoteGuard } from './lib/capacity-core.mjs';
import { classifyReply, buildReplyPlan } from './lib/reply-core.mjs';
import { summarizeLearning, applyLearningToConcept, learningScenePrefix } from './lib/learning-core.mjs';
import { createLocalAssetStore, distinctAssetCount } from './lib/storage-core.mjs';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '18mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false } }) : null;
const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH || path.join(__dirname, 'data', 'local-db.json');
const ASSET_ROOT = process.env.ASSET_ROOT || path.join(__dirname,'data','assets');
const assetStore = createLocalAssetStore({rootDir:ASSET_ROOT,publicPrefix:'/assets'});
app.use('/assets', express.static(ASSET_ROOT));
const emptyMem = () => ({ tenants: [], products: [], jobs: [], feedback: [], prospects: [], stockPlans: [], economics: [], evidence: [], experiments: [], providerInvocations: [], policyChecks: [], state: null });
let mem = emptyMem();

function loadLocal(){
  if(pool) return;
  try{
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive:true });
    if(fs.existsSync(LOCAL_DB_PATH)){
      const parsed = JSON.parse(fs.readFileSync(LOCAL_DB_PATH,'utf8'));
      mem = { ...emptyMem(), ...parsed };
    } else {
      fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(mem,null,2));
    }
  }catch(e){ console.error('Local persistence load failed',e); }
}
function saveLocal(){
  if(pool) return;
  try{
    fs.mkdirSync(path.dirname(LOCAL_DB_PATH), { recursive:true });
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(mem,null,2));
  }catch(e){ console.error('Local persistence save failed',e); }
}

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

async function initDb(){
  if(!pool) return;
  await pool.query(`
    create table if not exists tenants(
      id text primary key, name text not null, country text not null default 'BR', locale text not null default 'pt-BR', currency text not null default 'BRL', created_at timestamptz not null default now()
    );
    create table if not exists products(
      id text primary key, tenant_id text not null references tenants(id) on delete cascade, name text not null, category text not null default 'general', price numeric, cost numeric, stock integer not null default 0, objective text, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
    );
    create table if not exists jobs(
      id text primary key, tenant_id text not null references tenants(id) on delete cascade, product_id text references products(id) on delete set null, status text not null, country text not null, channel text not null, business_model text, vertical text, objective text, direction jsonb not null default '{}'::jsonb, policy jsonb not null default '{}'::jsonb, cost_guard jsonb not null default '{}'::jsonb, scenes jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists feedback(
      id text primary key, tenant_id text not null references tenants(id) on delete cascade, job_id text not null references jobs(id) on delete cascade, verdict text not null, notes text, created_at timestamptz not null default now()
    );
    create table if not exists prospects(
      id text primary key, tenant_id text references tenants(id) on delete set null, company text not null, country text not null, url text, observed_need text, product text, vertical text, channel text, spec jsonb not null default '{}'::jsonb, stage text not null default 'QUALIFIED', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists stock_plans(
      id text primary key, tenant_id text not null references tenants(id) on delete cascade, product_id text not null references products(id) on delete cascade, deadline date not null, target_stock integer not null default 0, plan jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists economics(
      id text primary key, tenant_id text references tenants(id) on delete set null, prospect_id text references prospects(id) on delete set null, job_id text references jobs(id) on delete set null,
      quote_usd numeric not null default 0, cash_received_usd numeric not null default 0, provider_cost_usd numeric not null default 0,
      infra_cost_usd numeric not null default 0, payment_fees_usd numeric not null default 0, owner_hours numeric not null default 0,
      owner_hour_value_usd numeric not null default 0, notes text, created_at timestamptz not null default now()
    );
    create table if not exists evidence_events(
      id text primary key, tenant_id text references tenants(id) on delete cascade, product_id text references products(id) on delete set null,
      prospect_id text references prospects(id) on delete set null, evidence_type text not null, source_url text, source_name text,
      confidence numeric not null default 50, observed_at timestamptz, payload jsonb not null default '{}'::jsonb, taxonomy jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    );
    create table if not exists experiments(
      id text primary key, tenant_id text references tenants(id) on delete cascade, product_id text references products(id) on delete set null,
      parent_job_id text references jobs(id) on delete set null, hypothesis text not null, changed_variable text not null,
      target_metric text, baseline jsonb not null default '{}'::jsonb, status text not null default 'PLANNED',
      result jsonb not null default '{}'::jsonb, learning jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists provider_invocations(
      id text primary key, tenant_id text references tenants(id) on delete cascade, job_id text references jobs(id) on delete set null,
      provider text not null, capability text not null, mode text not null default 'MANUAL', prompt_hash text,
      estimated_cost_usd numeric not null default 0, actual_cost_usd numeric not null default 0,
      authorized_usd numeric not null default 0, status text not null default 'PLANNED', provenance jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    );
    create table if not exists policy_checks(
      id text primary key, tenant_id text references tenants(id) on delete cascade, product_id text references products(id) on delete set null,
      country text not null, channel text not null, category text not null, decision jsonb not null default '{}'::jsonb,
      source_url text, checked_at timestamptz not null default now(), expires_at timestamptz, created_at timestamptz not null default now()
    );
  `);
}

const sensitiveCategories = new Set(['tobacco','nicotine','smoking_accessory','vape','pod']);
const regulatedCategories = new Set(['supplement','alcohol','gambling','financial','medical']);
const paidAdChannels = new Set(['Meta / Instagram','TikTok','Google Ads','YouTube Ads']);

function policyGate({country='US', channel='Meta / Instagram', category='general'}){
  const c = String(category||'general').toLowerCase();
  if(sensitiveCategories.has(c) && paidAdChannels.has(channel)) return { level:'BLOCKED', reason:'Categoria sensível bloqueada pelo preflight conservador para mídia paga. Requer canal permitido e revisão jurídica/política oficial.' };
  if(regulatedCategories.has(c) && paidAdChannels.has(channel)) return { level:'REVIEW', reason:`Categoria regulada em ${country}. Exige revisão de claims, público, landing page e política oficial do canal antes da publicação.` };
  return { level:'ALLOWED', reason:'Nenhum bloqueio interno conhecido. Ainda requer verificação das políticas oficiais antes de publicação automática.' };
}

const verticalPlaybooks = {
  beauty:{angles:['routine transformation','creator demonstration','proof/detail'], emotions:['confiança','desejo','autocuidado']},
  pet:{angles:['problem-solution','pet reaction','proof/demo'], emotions:['cuidado','alívio','diversão']},
  tech:{angles:['pain-to-benefit','daily utility','feature demo'], emotions:['praticidade','controle','curiosidade']},
  fashion:{angles:['identity shift','street/lifestyle','detail premium'], emotions:['atitude','pertencimento','desejo']},
  food:{angles:['sensory macro','impulse','occasion'], emotions:['vontade','prazer','urgência']},
  home:{angles:['problem-fix','visual transformation','utility'], emotions:['alívio','organização','conforto']},
  saas:{angles:['pain-to-workflow','time saved','proof/screen demo'], emotions:['controle','velocidade','clareza']},
  service:{angles:['pain-to-outcome','proof','local trust'], emotions:['segurança','alívio','confiança']},
  supplement:{angles:['routine','ingredient/mechanism','social proof'], emotions:['confiança','bem-estar','clareza']},
  general:{angles:['desire','problem-solution','proof'], emotions:['curiosidade','confiança','desejo']}
};

function director(input){
  const vertical = String(input.vertical || input.category || 'general').toLowerCase();
  const p = verticalPlaybooks[vertical] || verticalPlaybooks.general;
  const base = [
    {concept:'CONCEPT_A', angle:p.angles[0], emotion:p.emotions[0], hook:`Pare em 2 segundos: ${input.productName || 'este produto'} resolve uma tensão real do público.`, variable:'hook/first-3s'},
    {concept:'CONCEPT_B', angle:p.angles[1], emotion:p.emotions[1], hook:'Mostre o produto em uso cedo e prove o mecanismo sem enrolação.', variable:'demonstration/mechanism'},
    {concept:'CONCEPT_C', angle:p.angles[2], emotion:p.emotions[2], hook:'Transforme a principal objeção em prova visual e CTA específico.', variable:'proof/CTA'}
  ];
  return { vertical, playbook:p, concepts:base };
}

function makeScenes({productName, concept, vertical, learning={}}){
  const common = `${learningScenePrefix(learning)}PRODUCT FIDELITY LOCK. Preserve the real ${productName} as the mandatory SKU reference. Do not invent physical features, marks or claims. Vertical 9:16 native-feed composition.`;
  return [
    {order:1, brief:'Hook visual imediato com o produto aparecendo cedo.', prompt:`${common} Scene 1 for ${vertical}/${concept.angle}: high-impact opening, product visible immediately, strong visual tension, no promotional text baked in.`},
    {order:2, brief:'Demonstração do mecanismo, uso ou benefício.', prompt:`${common} Scene 2: demonstrate ${concept.angle} through environment, action or composition; preserve product identity; no fake evidence.`},
    {order:3, brief:'Prova visual, detalhe ou mudança de contexto.', prompt:`${common} Scene 3: proof/detail moment, different framing from scenes 1-2, visual evidence without unsupported claims.`},
    {order:4, brief:'Fechamento com espaço para CTA e oferta.', prompt:`${common} Scene 4: closing hero shot, clean negative space for later CTA overlay; no text baked into image.`}
  ];
}

function stockRecovery({stock=0,cost=0,price=0,deadline}){
  const today = new Date(); const end = new Date(deadline); const days = Math.max(1, Math.ceil((end-today)/(86400000)));
  const daily = Math.ceil(stock/days); const weekly = Math.ceil(stock/(days/7)); const invested = stock*cost; const grossAtCurrent = stock*price; const grossProfitCurrent = stock*(price-cost);
  const ladders = [
    {label:'varejo',qty:1,unit:Number((Math.max(cost*2.2, price*0.85)).toFixed(2))},
    {label:'combo',qty:5,unit:Number((Math.max(cost*1.8, price*0.68)).toFixed(2))},
    {label:'atacado',qty:50,unit:Number((Math.max(cost*1.55, price*0.56)).toFixed(2))},
    {label:'giro forte',qty:100,unit:Number((Math.max(cost*1.35, price*0.50)).toFixed(2))}
  ];
  return {days,daily,weekly,invested,grossAtCurrent,grossProfitCurrent,ladders};
}

async function rows(query, params=[]){ return (await pool.query(query,params)).rows; }

async function learningExperimentsFor(tenantId, productId=null){
  if(!tenantId) return [];
  if(!pool){
    return mem.experiments.filter(x=>x.tenant_id===tenantId && (!productId || !x.product_id || x.product_id===productId));
  }
  if(productId){
    return rows("select * from experiments where tenant_id=$1 and (product_id=$2 or product_id is null) order by updated_at desc limit 100",[tenantId,productId]);
  }
  return rows("select * from experiments where tenant_id=$1 order by updated_at desc limit 100",[tenantId]);
}


app.get('/api/health', async (req,res)=>{ let db='local-json'; if(pool){ try{ await pool.query('select 1'); db='postgres'; } catch(e){ db='error'; } } res.json({ok:true,version:'0.12.0',db,time:now(),costMode:'ZERO_CASH_GUARD'}); });

app.get('/api/bootstrap', async (req,res)=>{
  if(!pool) return res.json(mem);
  const [tenants,products,jobs,feedback,prospects,stockPlans,economics,evidence,experiments,providerInvocations,policyChecks] = await Promise.all([
    rows('select * from tenants order by created_at'),
    rows('select * from products order by created_at'),
    rows('select * from jobs order by created_at desc limit 200'),
    rows('select * from feedback order by created_at desc limit 200'),
    rows('select * from prospects order by created_at desc limit 200'),
    rows('select * from stock_plans order by created_at desc limit 200'),
    rows('select * from economics order by created_at desc limit 200'),
    rows('select * from evidence_events order by created_at desc limit 500'),
    rows('select * from experiments order by created_at desc limit 500'),
    rows('select * from provider_invocations order by created_at desc limit 500'),
    rows('select * from policy_checks order by created_at desc limit 500')
  ]);
  res.json({tenants,products,jobs,feedback,prospects,stockPlans,economics,evidence,experiments,providerInvocations,policyChecks});
});

app.post('/api/tenants', async (req,res)=>{
  const t={id:req.body.id||id(),name:req.body.name||'New tenant',country:req.body.country||'US',locale:req.body.locale||'en-US',currency:req.body.currency||'USD',created_at:now()};
  if(!pool){mem.tenants.push(t);saveLocal();return res.json(t)}
  res.json((await pool.query('insert into tenants(id,name,country,locale,currency) values($1,$2,$3,$4,$5) returning *',[t.id,t.name,t.country,t.locale,t.currency])).rows[0]);
});

app.post('/api/products', async (req,res)=>{
  const p={id:req.body.id||id(),tenant_id:req.body.tenant_id,name:req.body.name,category:req.body.category||'general',price:Number(req.body.price||0),cost:Number(req.body.cost||0),stock:Number(req.body.stock||0),objective:req.body.objective||'',metadata:req.body.metadata||{},created_at:now()};
  if(!p.tenant_id||!p.name) return res.status(400).json({error:'tenant_id and name required'});
  if(!pool){mem.products.push(p);saveLocal();return res.json(p)}
  res.json((await pool.query('insert into products(id,tenant_id,name,category,price,cost,stock,objective,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[p.id,p.tenant_id,p.name,p.category,p.price,p.cost,p.stock,p.objective,p.metadata])).rows[0]);
});

app.post('/api/direct', (req,res)=>{
  const policy=policyGate(req.body); const direction=director(req.body); const concepts=direction.concepts.map(c=>({...c,scenes:makeScenes({productName:req.body.productName||'product',concept:c,vertical:direction.vertical})}));
  res.json({policy,direction:{...direction,concepts},costGuard:{authorizedUsd:0,paidProvider:false,mode:'ATLAS_MANUAL_ZERO_CASH'}});
});

app.post('/api/jobs', async (req,res)=>{
  const policy=policyGate(req.body); if(policy.level==='BLOCKED') return res.status(409).json({error:'POLICY_BLOCKED',policy});
  const d=director(req.body);
  const learning=summarizeLearning(await learningExperimentsFor(req.body.tenant_id,req.body.product_id||null));
  const baseChosen=d.concepts[Number(req.body.conceptIndex||0)%d.concepts.length];
  const chosen=applyLearningToConcept(baseChosen,learning);
  const scenes=makeScenes({productName:req.body.productName||'product',concept:chosen,vertical:d.vertical,learning});
  const j={id:id(),tenant_id:req.body.tenant_id,product_id:req.body.product_id||null,status:'AWAITING_ASSETS',country:req.body.country||'US',channel:req.body.channel||'Meta / Instagram',business_model:req.body.business_model||'DTC',vertical:req.body.vertical||'general',objective:req.body.objective||'sales',direction:{...chosen,vertical:d.vertical,learning_context:learning},policy,cost_guard:{authorizedUsd:0,paidProvider:false,mode:'ATLAS_MANUAL_ZERO_CASH'},scenes,created_at:now(),updated_at:now()};
  if(!pool){mem.jobs.unshift(j);saveLocal();return res.json(j)}
  res.json((await pool.query('insert into jobs(id,tenant_id,product_id,status,country,channel,business_model,vertical,objective,direction,policy,cost_guard,scenes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *',[j.id,j.tenant_id,j.product_id,j.status,j.country,j.channel,j.business_model,j.vertical,j.objective,j.direction,j.policy,j.cost_guard,j.scenes])).rows[0]);
});

app.post('/api/assets/import', async (req,res)=>{
  const tenantId=req.body.tenant_id||'unknown';
  const jobId=req.body.job_id||'unassigned';
  const incoming=Array.isArray(req.body.assets)?req.body.assets:[];
  if(!incoming.length) return res.status(400).json({error:'assets required'});
  const refs=[];
  for(const a of incoming){
    if(!a?.dataUrl) continue;
    refs.push(await assetStore.put({dataUrl:a.dataUrl,name:a.name||'',tenantId,jobId}));
  }
  res.json({provider:'LOCAL_FS',count:refs.length,assets:refs});
});

app.post('/api/jobs/:id/assets', async (req,res)=>{
  const incoming=Array.isArray(req.body.assets)?req.body.assets:[];
  if(incoming.length<3) return res.status(400).json({error:'At least 3 fresh scene assets required'});

  let job=null;
  if(!pool) job=mem.jobs.find(x=>x.id===req.params.id)||null;
  else job=(await pool.query('select * from jobs where id=$1',[req.params.id])).rows[0]||null;
  if(!job) return res.status(404).json({error:'job not found'});

  const refs=[];
  for(const a of incoming){
    if(a?.dataUrl){
      refs.push(await assetStore.put({dataUrl:a.dataUrl,name:a.name||'',tenantId:job.tenant_id,jobId:job.id}));
    }else if(a?.url){
      refs.push({...a,provider:a.provider||'EXTERNAL_REF'});
    }
  }
  const unique=distinctAssetCount(refs);
  if(unique<3) return res.status(400).json({error:'Similarity Guard: at least 3 distinct scene assets required'});
  const patch={
    assets:refs,
    assetCount:refs.length,
    assetStorage:{provider:'LOCAL_FS',inlinePayloads:false},
    importedAt:now(),
    qa:{freshAssets:true,distinctAssets:true,productFidelity:'MANUAL_REVIEW_REQUIRED',ctaPresent:true}
  };
  if(!pool){
    job.direction={...job.direction,...patch};job.status='READY_FOR_RENDER';job.updated_at=now();saveLocal();return res.json(job);
  }
  const out=(await pool.query("update jobs set direction=direction || $2::jsonb,status='READY_FOR_RENDER',updated_at=now() where id=$1 returning *",[req.params.id,JSON.stringify(patch)])).rows[0];
  return res.json(out);
});

app.post('/api/jobs/:id/feedback', async (req,res)=>{
  const verdict=String(req.body.verdict||'NEUTRAL').toUpperCase(); const f={id:id(),tenant_id:req.body.tenant_id,job_id:req.params.id,verdict,notes:req.body.notes||'',created_at:now()};
  if(!pool){mem.feedback.unshift(f);saveLocal();return res.json({...f,nextAction:verdict==='WINNER'?'CONTROLLED_VARIATIONS':verdict==='LOSER'?'NEW_HYPOTHESIS':'KEEP_LEARNING'})}
  await pool.query('insert into feedback(id,tenant_id,job_id,verdict,notes) values($1,$2,$3,$4,$5)',[f.id,f.tenant_id,f.job_id,f.verdict,f.notes]);
  res.json({...f,nextAction:verdict==='WINNER'?'CONTROLLED_VARIATIONS':verdict==='LOSER'?'NEW_HYPOTHESIS':'KEEP_LEARNING'});
});

app.post('/api/stock-recovery', async (req,res)=>{
  const plan=stockRecovery(req.body); const s={id:id(),tenant_id:req.body.tenant_id,product_id:req.body.product_id,deadline:req.body.deadline,target_stock:0,plan,created_at:now(),updated_at:now()};
  if(!pool){mem.stockPlans.unshift(s);saveLocal();return res.json(s)}
  res.json((await pool.query('insert into stock_plans(id,tenant_id,product_id,deadline,target_stock,plan) values($1,$2,$3,$4,$5,$6) returning *',[s.id,s.tenant_id,s.product_id,s.deadline,s.target_stock,s.plan])).rows[0]);
});

app.post('/api/prospects/spec', async (req,res)=>{
  const d=director({vertical:req.body.vertical||'general',productName:req.body.product||req.body.company}); const policy=policyGate({country:req.body.country||'US',channel:req.body.channel||'Meta / Instagram',category:req.body.category||'general'});
  const spec={observedNeed:req.body.observed_need||'',direction:d.concepts[0],hypotheses:d.concepts.slice(0,3),policy,cta:'Reply to review the private creative direction and test plan.',commercialReadiness:policy.level==='BLOCKED'?'BLOCKED':'SPEC_READY'};
  const p={id:id(),tenant_id:req.body.tenant_id||null,company:req.body.company,country:req.body.country||'US',url:req.body.url||'',observed_need:req.body.observed_need||'',product:req.body.product||'',vertical:req.body.vertical||'general',channel:req.body.channel||'Meta / Instagram',spec,stage:'QUALIFIED',created_at:now(),updated_at:now()};
  if(!pool){mem.prospects.unshift(p);saveLocal();return res.json(p)}
  res.json((await pool.query('insert into prospects(id,tenant_id,company,country,url,observed_need,product,vertical,channel,spec,stage) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',[p.id,p.tenant_id,p.company,p.country,p.url,p.observed_need,p.product,p.vertical,p.channel,p.spec,p.stage])).rows[0]);
});

app.post('/api/seed/beco13', async (req,res)=>{
  const tenant={id:'beco13',name:'Beco 13',country:'BR',locale:'pt-BR',currency:'BRL'};
  const products=[
    {id:'miniatura',name:'Miniatura 1:36',category:'general',price:0,cost:0,stock:0,objective:'creative_benchmark',metadata:{caseZero:true,economicDataVerified:false,economicDataNote:'Preço/custo desta escala não confirmados'}},
    {id:'oculos',name:'Óculos',category:'fashion',price:90,cost:0,stock:0,objective:'sales'},
    {id:'fone',name:'Fone AirDots',category:'tech',price:35,cost:0,stock:0,objective:'sales'},
    {id:'bone',name:'Boné',category:'fashion',price:35,cost:0,stock:0,objective:'sales'},
    {id:'doce',name:'Doce',category:'food',price:2,cost:0,stock:0,objective:'impulse_sales'},
    {id:'plastic-cone',name:'Plastic Cone',category:'smoking_accessory',price:8,cost:2.5,stock:4000,objective:'stock_recovery'}
  ];
  if(!pool){if(!mem.tenants.some(x=>x.id==='beco13'))mem.tenants.push({...tenant,created_at:now()});for(const x of products){const existing=mem.products.find(p=>p.id===x.id);const metadata={caseZero:true,...(x.metadata||{})};if(!existing)mem.products.push({...x,tenant_id:'beco13',metadata,created_at:now()});else if(x.id==='miniatura' && existing.metadata?.economicDataVerified!==true){existing.price=0;existing.cost=0;existing.metadata=metadata;}}saveLocal();return res.json({ok:true,tenant,products})}
  await pool.query('insert into tenants(id,name,country,locale,currency) values($1,$2,$3,$4,$5) on conflict(id) do nothing',[tenant.id,tenant.name,tenant.country,tenant.locale,tenant.currency]);
  for(const x of products)await pool.query("insert into products(id,tenant_id,name,category,price,cost,stock,objective,metadata) values($1,'beco13',$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set price=excluded.price,cost=excluded.cost,stock=excluded.stock,objective=excluded.objective",[x.id,x.name,x.category,x.price,x.cost,x.stock,x.objective,{caseZero:true,...(x.metadata||{})}]);
  res.json({ok:true,tenant,products});
});

app.get('/api/jobs', async (req,res)=>{ if(!pool)return res.json(mem.jobs);res.json(await rows('select * from jobs order by created_at desc limit 200')); });
app.get('/api/jobs/:id', async (req,res)=>{ if(!pool){const j=mem.jobs.find(x=>x.id===req.params.id);return j?res.json(j):res.status(404).json({error:'job not found'})} const out=(await pool.query('select * from jobs where id=$1',[req.params.id])).rows[0];return out?res.json(out):res.status(404).json({error:'job not found'}); });


app.patch('/api/prospects/:id/stage', async (req,res)=>{
  const stage=String(req.body.stage||'QUALIFIED').toUpperCase();
  const allowed=new Set(['DISCOVERED','QUALIFIED','SPEC_READY','APPROVED_FOR_CONTACT','CONTACTED','REPLIED','PAID_TEST','PROPOSAL','WON','LOST']);
  if(!allowed.has(stage)) return res.status(400).json({error:'invalid stage'});
  if(!pool){
    const p=mem.prospects.find(x=>x.id===req.params.id); if(!p)return res.status(404).json({error:'prospect not found'});
    p.stage=stage;p.updated_at=now();saveLocal();return res.json(p);
  }
  const out=(await pool.query('update prospects set stage=$2,updated_at=now() where id=$1 returning *',[req.params.id,stage])).rows[0];
  return out?res.json(out):res.status(404).json({error:'prospect not found'});
});

app.post('/api/seed/client-attack', async (req,res)=>{
  const leads=[
    {id:'lead-a1',company:'Upwork buyer — Meta Creative Strategist',country:'US',url:'https://www.upwork.com/freelance-jobs/apply/Creative-Strategist-for-Meta-Ads-Facebook-Instagram_~022104980694095225838/',observed_need:'Research → angles → hooks → scripts → briefs → QA → performance learning',product:'Creative Strategy',vertical:'general',channel:'Meta / Instagram',stage:'SPEC_READY',spec:{budget:'US$500 fixed',priority:'A1',barrier:'spec work accepted',next_action:'Owner approval then apply with CONCEPT pack'}},
    {id:'lead-a2',company:'Upwork buyer — Skincare Paid Social',country:'US',url:'https://www.upwork.com/freelance-jobs/apply/Creative-Strategist-Needed-for-Skincare-Brand-Paid-Social-Ads_~022105362420281732320/',observed_need:'Skincare angles/hooks/UGC brief with contract-to-hire potential',product:'Skincare',vertical:'beauty',channel:'Meta / Instagram',stage:'SPEC_READY',spec:{budget:'US$65 fixed',priority:'A2',barrier:'low ticket proof',next_action:'Strict-scope paid proof'}},
    {id:'lead-a3',company:'OnlineJobs buyer — Premium Wellness Creative Strategist',country:'US',url:'',observed_need:'Mini-test: 10 hooks + 2 scripts + testing plan; weekly research/hooks/scripts/testing board',product:'Premium wellness',vertical:'health',channel:'Meta / Instagram',stage:'SPEC_READY',spec:{budget:'500 shown / 10hr-week',priority:'A3',barrier:'mini-test requested',next_action:'Submit premium wellness mini-test'}},
    {id:'lead-b1',company:'Upwork buyer — DTC Wellness Supplements',country:'US',url:'https://www.upwork.com/freelance-jobs/apply/Performance-Creative-Strategist-Meta-DTC-Wellness-Supplements_~022105585975539887328/',observed_need:'Audit → research → angle/hook map → test plan → 5 production briefs',product:'Wellness supplements',vertical:'supplement',channel:'Meta / Instagram',stage:'SPEC_READY',spec:{budget:'US$1,000 fixed',priority:'B1',barrier:'50+ proposals',next_action:'Outside-in spec then apply'}},
    {id:'lead-p1',company:'Reddit buyer — AI UGC ecommerce',country:'US',url:'',observed_need:'15–30s realistic AI UGC with product fidelity; paid test; ongoing',product:'Ecommerce products',vertical:'general',channel:'Meta / Instagram',stage:'QUALIFIED',spec:{budget:'paid test',priority:'P1',barrier:'portfolio-grade finished AI UGC required',next_action:'Wait for one premium proof video'}}
  ];
  if(!pool){
    for(const x of leads) if(!mem.prospects.some(p=>p.id===x.id)) mem.prospects.unshift({...x,tenant_id:null,created_at:now(),updated_at:now()});
    saveLocal(); return res.json({ok:true,count:leads.length,leads});
  }
  for(const x of leads) await pool.query('insert into prospects(id,tenant_id,company,country,url,observed_need,product,vertical,channel,spec,stage) values($1,null,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(id) do update set observed_need=excluded.observed_need,spec=excluded.spec,stage=excluded.stage,updated_at=now()',[x.id,x.company,x.country,x.url,x.observed_need,x.product,x.vertical,x.channel,x.spec,x.stage]);
  res.json({ok:true,count:leads.length,leads});
});

app.post('/api/economics', async (req,res)=>{
  const e={id:id(),tenant_id:req.body.tenant_id||null,prospect_id:req.body.prospect_id||null,job_id:req.body.job_id||null,
    quote_usd:Number(req.body.quote_usd||0),cash_received_usd:Number(req.body.cash_received_usd||0),provider_cost_usd:Number(req.body.provider_cost_usd||0),
    infra_cost_usd:Number(req.body.infra_cost_usd||0),payment_fees_usd:Number(req.body.payment_fees_usd||0),owner_hours:Number(req.body.owner_hours||0),
    owner_hour_value_usd:Number(req.body.owner_hour_value_usd||0),notes:req.body.notes||'',created_at:now()};
  const cashCost=e.provider_cost_usd+e.infra_cost_usd+e.payment_fees_usd;
  const ownerCost=e.owner_hours*e.owner_hour_value_usd;
  const calc={cash_cost_usd:cashCost,gross_margin_cash_usd:e.cash_received_usd-cashCost,gross_margin_after_owner_time_usd:e.cash_received_usd-cashCost-ownerCost};
  if(!pool){mem.economics.unshift({...e,...calc});saveLocal();return res.json({...e,...calc})}
  const out=(await pool.query('insert into economics(id,tenant_id,prospect_id,job_id,quote_usd,cash_received_usd,provider_cost_usd,infra_cost_usd,payment_fees_usd,owner_hours,owner_hour_value_usd,notes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *',[e.id,e.tenant_id,e.prospect_id,e.job_id,e.quote_usd,e.cash_received_usd,e.provider_cost_usd,e.infra_cost_usd,e.payment_fees_usd,e.owner_hours,e.owner_hour_value_usd,e.notes])).rows[0];
  res.json({...out,...calc});
});


app.post('/api/evidence', async (req,res)=>{
  const e={
    id:id(),tenant_id:req.body.tenant_id||null,product_id:req.body.product_id||null,prospect_id:req.body.prospect_id||null,
    evidence_type:req.body.evidence_type||'market_signal',source_url:req.body.source_url||'',source_name:req.body.source_name||'',
    confidence:Number(req.body.confidence??50),observed_at:req.body.observed_at||now(),payload:req.body.payload||{},
    taxonomy:buildCreativeTaxonomy(req.body.taxonomy||req.body.payload||{}),created_at:now()
  };
  if(!e.tenant_id&&!e.prospect_id) return res.status(400).json({error:'tenant_id or prospect_id required'});
  if(!pool){mem.evidence.unshift(e);saveLocal();return res.json(e)}
  const out=(await pool.query('insert into evidence_events(id,tenant_id,product_id,prospect_id,evidence_type,source_url,source_name,confidence,observed_at,payload,taxonomy) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',[e.id,e.tenant_id,e.product_id,e.prospect_id,e.evidence_type,e.source_url,e.source_name,e.confidence,e.observed_at,e.payload,e.taxonomy])).rows[0];
  res.json(out);
});

app.get('/api/evidence', async (req,res)=>{
  const tenant=req.query.tenant_id||null, product=req.query.product_id||null, prospect=req.query.prospect_id||null;
  if(!pool){
    return res.json(mem.evidence.filter(x=>(!tenant||x.tenant_id===tenant)&&(!product||x.product_id===product)&&(!prospect||x.prospect_id===prospect)));
  }
  const where=[],vals=[]; let n=1;
  if(tenant){where.push('tenant_id=$'+n++);vals.push(tenant)}
  if(product){where.push('product_id=$'+n++);vals.push(product)}
  if(prospect){where.push('prospect_id=$'+n++);vals.push(prospect)}
  res.json(await rows('select * from evidence_events'+(where.length?' where '+where.join(' and '):'')+' order by created_at desc limit 500',vals));
});

app.post('/api/policy/check', async (req,res)=>{
  const base=policyGate(req.body);
  const decision=policyEnvelope({
    decision:base,source_url:req.body.source_url||'',checked_at:req.body.checked_at||now(),expires_at:req.body.expires_at||null,
    country:req.body.country||'US',channel:req.body.channel||'unknown',category:req.body.category||'general'
  });
  const p={id:id(),tenant_id:req.body.tenant_id||null,product_id:req.body.product_id||null,country:decision.country,channel:decision.channel,category:decision.category,decision,source_url:decision.source_url,checked_at:decision.checked_at,expires_at:decision.expires_at,created_at:now()};
  if(!pool){mem.policyChecks.unshift(p);saveLocal();return res.json(p)}
  const out=(await pool.query('insert into policy_checks(id,tenant_id,product_id,country,channel,category,decision,source_url,checked_at,expires_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning *',[p.id,p.tenant_id,p.product_id,p.country,p.channel,p.category,p.decision,p.source_url||null,p.checked_at,p.expires_at])).rows[0];
  res.json(out);
});

app.post('/api/next-best-test', (req,res)=>{
  const options=Array.isArray(req.body.options)?req.body.options:[req.body];
  const ranked=options.map((o,i)=>({id:o.id||('option-'+(i+1)),...o,decision:scoreNextBestTest(o)}))
    .sort((a,b)=>b.decision.score-a.decision.score);
  res.json({recommended:ranked[0]||null,ranked});
});

app.post('/api/experiments', async (req,res)=>{
  const x={id:id(),tenant_id:req.body.tenant_id||null,product_id:req.body.product_id||null,parent_job_id:req.body.parent_job_id||null,
    hypothesis:req.body.hypothesis||'',changed_variable:req.body.changed_variable||'hook',target_metric:req.body.target_metric||'CPA',
    baseline:req.body.baseline||{},status:'PLANNED',result:{},learning:{},created_at:now(),updated_at:now()};
  if(!x.hypothesis) return res.status(400).json({error:'hypothesis required'});
  if(!pool){mem.experiments.unshift(x);saveLocal();return res.json(x)}
  const out=(await pool.query('insert into experiments(id,tenant_id,product_id,parent_job_id,hypothesis,changed_variable,target_metric,baseline,status,result,learning) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',[x.id,x.tenant_id,x.product_id,x.parent_job_id,x.hypothesis,x.changed_variable,x.target_metric,x.baseline,x.status,x.result,x.learning])).rows[0];
  res.json(out);
});

app.post('/api/experiments/:id/result', async (req,res)=>{
  const result=req.body.result||req.body.metrics||{};
  const outcome=String(req.body.outcome||'NEUTRAL').toUpperCase();
  const changed=req.body.changed_variable||'unknown';
  const learning=deriveLearning({outcome,changed_variable:changed,metrics:result,notes:req.body.notes||''});
  if(!pool){
    const x=mem.experiments.find(e=>e.id===req.params.id);if(!x)return res.status(404).json({error:'experiment not found'});
    x.status='COMPLETED';x.result=result;x.learning=learning;x.updated_at=now();saveLocal();return res.json(x);
  }
  const out=(await pool.query("update experiments set status='COMPLETED',result=$2,learning=$3,updated_at=now() where id=$1 returning *",[req.params.id,result,learning])).rows[0];
  return out?res.json(out):res.status(404).json({error:'experiment not found'});
});

app.post('/api/provider/route', (req,res)=>{
  const defaults=[
    {id:'local-manual',enabled:true,capabilities:['GENERATE_ASSET','COMPOSE_VIDEO','WRITE_BRIEF'],estimated_cost_usd:0,quality_score:65,reliability_score:95,mode:'LOCAL_FREE'},
    {id:'external-human',enabled:true,capabilities:['GENERATE_ASSET','COMPOSE_VIDEO'],estimated_cost_usd:Number(req.body.human_cost_usd||999),quality_score:90,reliability_score:85,mode:'HUMAN'},
    {id:'paid-ai-provider',enabled:Boolean(req.body.paid_provider_enabled),capabilities:['GENERATE_ASSET','GENERATE_PREMIUM_VIDEO'],estimated_cost_usd:Number(req.body.paid_provider_estimated_cost_usd||999),quality_score:88,reliability_score:80,mode:'PAID_API'}
  ];
  res.json(selectProvider({capability:req.body.capability||'GENERATE_ASSET',authorized_usd:Number(req.body.authorized_usd||0),providers:req.body.providers||defaults}));
});

app.post('/api/provider-invocations', async (req,res)=>{
  const prompt=String(req.body.prompt||'');
  const v={id:id(),tenant_id:req.body.tenant_id||null,job_id:req.body.job_id||null,provider:req.body.provider||'manual',
    capability:req.body.capability||'GENERATE_ASSET',mode:req.body.mode||'MANUAL',prompt_hash:prompt?crypto.createHash('sha256').update(prompt).digest('hex'):null,
    estimated_cost_usd:Number(req.body.estimated_cost_usd||0),actual_cost_usd:Number(req.body.actual_cost_usd||0),authorized_usd:Number(req.body.authorized_usd||0),
    status:req.body.status||'PLANNED',provenance:req.body.provenance||{},created_at:now(),updated_at:now()};
  if(v.estimated_cost_usd>v.authorized_usd) return res.status(409).json({error:'COST_GUARD_BLOCKED',estimated_cost_usd:v.estimated_cost_usd,authorized_usd:v.authorized_usd});
  if(!pool){mem.providerInvocations.unshift(v);saveLocal();return res.json(v)}
  const out=(await pool.query('insert into provider_invocations(id,tenant_id,job_id,provider,capability,mode,prompt_hash,estimated_cost_usd,actual_cost_usd,authorized_usd,status,provenance) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *',[v.id,v.tenant_id,v.job_id,v.provider,v.capability,v.mode,v.prompt_hash,v.estimated_cost_usd,v.actual_cost_usd,v.authorized_usd,v.status,v.provenance])).rows[0];
  res.json(out);
});

app.post('/api/readiness', (req,res)=>{
  res.json(commercialReadiness(req.body||{}));
});

app.get('/api/tenant/:tenantId/summary', async (req,res)=>{
  const t=req.params.tenantId;
  if(!pool){
    return res.json({
      tenant:mem.tenants.find(x=>x.id===t)||null,
      products:mem.products.filter(x=>x.tenant_id===t),
      jobs:mem.jobs.filter(x=>x.tenant_id===t),
      evidence:mem.evidence.filter(x=>x.tenant_id===t),
      experiments:mem.experiments.filter(x=>x.tenant_id===t),
      economics:mem.economics.filter(x=>x.tenant_id===t),
      providerInvocations:mem.providerInvocations.filter(x=>x.tenant_id===t),
      policyChecks:mem.policyChecks.filter(x=>x.tenant_id===t)
    });
  }
  const [tenant,products,jobs,evidence,experiments,economics,providerInvocations,policyChecks]=await Promise.all([
    rows('select * from tenants where id=$1',[t]),
    rows('select * from products where tenant_id=$1',[t]),
    rows('select * from jobs where tenant_id=$1 order by created_at desc',[t]),
    rows('select * from evidence_events where tenant_id=$1 order by created_at desc',[t]),
    rows('select * from experiments where tenant_id=$1 order by created_at desc',[t]),
    rows('select * from economics where tenant_id=$1 order by created_at desc',[t]),
    rows('select * from provider_invocations where tenant_id=$1 order by created_at desc',[t]),
    rows('select * from policy_checks where tenant_id=$1 order by created_at desc',[t])
  ]);
  res.json({tenant:tenant[0]||null,products,jobs,evidence,experiments,economics,providerInvocations,policyChecks});
});

app.post('/api/seed/universal-demo', async (req,res)=>{
  const tenant={id:'northstar-demo',name:'Northstar Home',country:'US',locale:'en-US',currency:'USD'};
  const products=[
    {id:'northstar-lamp',name:'Portable Ambient Lamp',category:'home',price:79,cost:24,stock:220,objective:'sales'},
    {id:'northstar-organizer',name:'Desk Cable Organizer',category:'home',price:29,cost:7,stock:640,objective:'sales'}
  ];
  if(!pool){
    if(!mem.tenants.some(x=>x.id===tenant.id))mem.tenants.push({...tenant,created_at:now()});
    for(const x of products)if(!mem.products.some(p=>p.id===x.id))mem.products.push({...x,tenant_id:tenant.id,metadata:{caseZero:false},created_at:now()});
    saveLocal();return res.json({ok:true,tenant,products});
  }
  await pool.query('insert into tenants(id,name,country,locale,currency) values($1,$2,$3,$4,$5) on conflict(id) do nothing',[tenant.id,tenant.name,tenant.country,tenant.locale,tenant.currency]);
  for(const x of products)await pool.query('insert into products(id,tenant_id,name,category,price,cost,stock,objective,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(id) do update set price=excluded.price,cost=excluded.cost,stock=excluded.stock,objective=excluded.objective',[x.id,tenant.id,x.name,x.category,x.price,x.cost,x.stock,x.objective,{caseZero:false}]);
  res.json({ok:true,tenant,products});
});


app.get('/api/sales/leads', (req,res)=>{
  try{
    const p=path.join(__dirname,'data','live-prospects-2026-10-02.json');
    const board=JSON.parse(fs.readFileSync(p,'utf8'));
    const ranked=board.leads.map(x=>({...x,decision:scoreProspect(x)})).sort((a,b)=>b.decision.score-a.decision.score);
    res.json({...board,ranked});
  }catch(e){
    res.status(500).json({error:'live prospect board unavailable'});
  }
});

app.post('/api/sales/rank', (req,res)=>{
  const leads=Array.isArray(req.body.leads)?req.body.leads:[req.body];
  const ranked=leads.map(x=>({...x,decision:scoreProspect(x),outreach:buildOutreachBrief(x)}))
    .sort((a,b)=>b.decision.score-a.decision.score);
  res.json({recommended:ranked[0]||null,ranked});
});


app.post('/api/capacity/assess', (req,res)=>{
  res.json(capacityAssessment(req.body||{}));
});

app.post('/api/pricing/guard', (req,res)=>{
  res.json(quoteGuard(req.body||{}));
});


app.post('/api/sales/reply-triage', (req,res)=>{
  const reply_text=String(req.body.reply_text||'');
  const buyer=req.body.buyer||{};
  const capacity=req.body.capacity||{full_slots_available:0};
  res.json({
    classification:classifyReply(reply_text),
    plan:buildReplyPlan({reply_text,buyer,capacity})
  });
});


app.get('/api/tenant/:tenantId/brain', async (req,res)=>{
  const experiments=await learningExperimentsFor(req.params.tenantId,req.query.product_id||null);
  res.json({
    tenant_id:req.params.tenantId,
    product_id:req.query.product_id||null,
    completed_experiments:experiments.filter(x=>String(x.status).toUpperCase()==='COMPLETED').length,
    recommendation:summarizeLearning(experiments)
  });
});

app.get('/api/owner', async (req,res)=>{
  if(!pool)return res.json({
    tenants:mem.tenants.length,products:mem.products.length,jobs:mem.jobs.length,
    winners:mem.feedback.filter(x=>x.verdict==='WINNER').length,prospects:mem.prospects.length,
    stockPlans:mem.stockPlans.length,economics:mem.economics.length,evidence:mem.evidence.length,
    experiments:mem.experiments.length,providerInvocations:mem.providerInvocations.length,
    policyChecks:mem.policyChecks.length,db:'local-json'
  });
  const q=await pool.query("select (select count(*) from tenants)::int tenants,(select count(*) from products)::int products,(select count(*) from jobs)::int jobs,(select count(*) from feedback where verdict='WINNER')::int winners,(select count(*) from prospects)::int prospects,(select count(*) from stock_plans)::int stock_plans,(select count(*) from economics)::int economics,(select count(*) from evidence_events)::int evidence,(select count(*) from experiments)::int experiments,(select count(*) from provider_invocations)::int provider_invocations,(select count(*) from policy_checks)::int policy_checks");
  res.json({...q.rows[0],db:'postgres'});
});


app.get('/api/admission-policy', (req,res)=>{
  try{
    const p=path.join(__dirname,'config','admission-policy.json');
    res.json(JSON.parse(fs.readFileSync(p,'utf8')));
  }catch(e){
    res.status(500).json({error:'admission policy unavailable'});
  }
});

app.get('/api/capabilities', (req,res)=>{
  try{
    const p=path.join(__dirname,'config','capability-registry.json');
    const data=JSON.parse(fs.readFileSync(p,'utf8'));
    res.json(data);
  }catch(e){
    res.status(500).json({error:'capability registry unavailable'});
  }
});

app.use((req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
loadLocal();
initDb().then(()=>app.listen(port,()=>console.log(`Creative Ops listening on ${port}`))).catch(err=>{console.error('DB init failed',err);process.exit(1)});
