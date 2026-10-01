import express from 'express';
import pg from 'pg';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const app = express();
const port = Number(process.env.PORT || 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: '18mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false } }) : null;
const mem = { tenants: [], products: [], jobs: [], feedback: [], prospects: [], stockPlans: [], state: null };

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

function makeScenes({productName, concept, vertical}){
  const common = `PRODUCT FIDELITY LOCK. Preserve the real ${productName} as the mandatory SKU reference. Do not invent physical features, marks or claims. Vertical 9:16 native-feed composition.`;
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

app.get('/api/health', async (req,res)=>{ let db='memory'; if(pool){ try{ await pool.query('select 1'); db='postgres'; } catch(e){ db='error'; } } res.json({ok:true,version:'0.10.0',db,time:now(),costMode:'ZERO_CASH_GUARD'}); });

app.get('/api/bootstrap', async (req,res)=>{
  if(!pool) return res.json(mem);
  const [tenants,products,jobs,feedback,prospects,stockPlans] = await Promise.all([
    rows('select * from tenants order by created_at'),rows('select * from products order by created_at'),rows('select * from jobs order by created_at desc limit 200'),rows('select * from feedback order by created_at desc limit 200'),rows('select * from prospects order by created_at desc limit 200'),rows('select * from stock_plans order by created_at desc limit 200')
  ]);
  res.json({tenants,products,jobs,feedback,prospects,stockPlans});
});

app.post('/api/tenants', async (req,res)=>{
  const t={id:req.body.id||id(),name:req.body.name||'New tenant',country:req.body.country||'US',locale:req.body.locale||'en-US',currency:req.body.currency||'USD',created_at:now()};
  if(!pool){mem.tenants.push(t);return res.json(t)}
  res.json((await pool.query('insert into tenants(id,name,country,locale,currency) values($1,$2,$3,$4,$5) returning *',[t.id,t.name,t.country,t.locale,t.currency])).rows[0]);
});

app.post('/api/products', async (req,res)=>{
  const p={id:req.body.id||id(),tenant_id:req.body.tenant_id,name:req.body.name,category:req.body.category||'general',price:Number(req.body.price||0),cost:Number(req.body.cost||0),stock:Number(req.body.stock||0),objective:req.body.objective||'',metadata:req.body.metadata||{},created_at:now()};
  if(!p.tenant_id||!p.name) return res.status(400).json({error:'tenant_id and name required'});
  if(!pool){mem.products.push(p);return res.json(p)}
  res.json((await pool.query('insert into products(id,tenant_id,name,category,price,cost,stock,objective,metadata) values($1,$2,$3,$4,$5,$6,$7,$8,$9) returning *',[p.id,p.tenant_id,p.name,p.category,p.price,p.cost,p.stock,p.objective,p.metadata])).rows[0]);
});

app.post('/api/direct', (req,res)=>{
  const policy=policyGate(req.body); const direction=director(req.body); const concepts=direction.concepts.map(c=>({...c,scenes:makeScenes({productName:req.body.productName||'product',concept:c,vertical:direction.vertical})}));
  res.json({policy,direction:{...direction,concepts},costGuard:{authorizedUsd:0,paidProvider:false,mode:'ATLAS_MANUAL_ZERO_CASH'}});
});

app.post('/api/jobs', async (req,res)=>{
  const policy=policyGate(req.body); if(policy.level==='BLOCKED') return res.status(409).json({error:'POLICY_BLOCKED',policy});
  const d=director(req.body); const chosen=d.concepts[Number(req.body.conceptIndex||0)%d.concepts.length]; const scenes=makeScenes({productName:req.body.productName||'product',concept:chosen,vertical:d.vertical});
  const j={id:id(),tenant_id:req.body.tenant_id,product_id:req.body.product_id||null,status:'AWAITING_ASSETS',country:req.body.country||'US',channel:req.body.channel||'Meta / Instagram',business_model:req.body.business_model||'DTC',vertical:req.body.vertical||'general',objective:req.body.objective||'sales',direction:{...chosen,vertical:d.vertical},policy,cost_guard:{authorizedUsd:0,paidProvider:false,mode:'ATLAS_MANUAL_ZERO_CASH'},scenes,created_at:now(),updated_at:now()};
  if(!pool){mem.jobs.unshift(j);return res.json(j)}
  res.json((await pool.query('insert into jobs(id,tenant_id,product_id,status,country,channel,business_model,vertical,objective,direction,policy,cost_guard,scenes) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning *',[j.id,j.tenant_id,j.product_id,j.status,j.country,j.channel,j.business_model,j.vertical,j.objective,j.direction,j.policy,j.cost_guard,j.scenes])).rows[0]);
});

app.post('/api/jobs/:id/assets', async (req,res)=>{
  const assets=Array.isArray(req.body.assets)?req.body.assets:[];
  if(assets.length<3) return res.status(400).json({error:'At least 3 fresh scene assets required'});
  const unique=new Set(assets.map(a=>String(a.dataUrl||a.url||a.name||''))).size;
  if(unique<3) return res.status(400).json({error:'Similarity Guard: at least 3 distinct scene assets required'});
  const patch={assets,assetCount:assets.length,importedAt:now(),qa:{freshAssets:true,distinctAssets:true,productFidelity:'MANUAL_REVIEW_REQUIRED',ctaPresent:true}};
  if(!pool){const j=mem.jobs.find(x=>x.id===req.params.id);if(!j)return res.status(404).json({error:'job not found'});j.direction={...j.direction,...patch};j.status='READY_FOR_RENDER';j.updated_at=now();return res.json(j)}
  const out=(await pool.query("update jobs set direction=direction || $2::jsonb,status='READY_FOR_RENDER',updated_at=now() where id=$1 returning *",[req.params.id,JSON.stringify(patch)])).rows[0]; return out?res.json(out):res.status(404).json({error:'job not found'});
});

app.post('/api/jobs/:id/feedback', async (req,res)=>{
  const verdict=String(req.body.verdict||'NEUTRAL').toUpperCase(); const f={id:id(),tenant_id:req.body.tenant_id,job_id:req.params.id,verdict,notes:req.body.notes||'',created_at:now()};
  if(!pool){mem.feedback.unshift(f);return res.json({...f,nextAction:verdict==='WINNER'?'CONTROLLED_VARIATIONS':verdict==='LOSER'?'NEW_HYPOTHESIS':'KEEP_LEARNING'})}
  await pool.query('insert into feedback(id,tenant_id,job_id,verdict,notes) values($1,$2,$3,$4,$5)',[f.id,f.tenant_id,f.job_id,f.verdict,f.notes]);
  res.json({...f,nextAction:verdict==='WINNER'?'CONTROLLED_VARIATIONS':verdict==='LOSER'?'NEW_HYPOTHESIS':'KEEP_LEARNING'});
});

app.post('/api/stock-recovery', async (req,res)=>{
  const plan=stockRecovery(req.body); const s={id:id(),tenant_id:req.body.tenant_id,product_id:req.body.product_id,deadline:req.body.deadline,target_stock:0,plan,created_at:now(),updated_at:now()};
  if(!pool){mem.stockPlans.unshift(s);return res.json(s)}
  res.json((await pool.query('insert into stock_plans(id,tenant_id,product_id,deadline,target_stock,plan) values($1,$2,$3,$4,$5,$6) returning *',[s.id,s.tenant_id,s.product_id,s.deadline,s.target_stock,s.plan])).rows[0]);
});

app.post('/api/prospects/spec', async (req,res)=>{
  const d=director({vertical:req.body.vertical||'general',productName:req.body.product||req.body.company}); const policy=policyGate({country:req.body.country||'US',channel:req.body.channel||'Meta / Instagram',category:req.body.category||'general'});
  const spec={observedNeed:req.body.observed_need||'',direction:d.concepts[0],hypotheses:d.concepts.slice(0,3),policy,cta:'Reply to review the private creative direction and test plan.',commercialReadiness:policy.level==='BLOCKED'?'BLOCKED':'SPEC_READY'};
  const p={id:id(),tenant_id:req.body.tenant_id||null,company:req.body.company,country:req.body.country||'US',url:req.body.url||'',observed_need:req.body.observed_need||'',product:req.body.product||'',vertical:req.body.vertical||'general',channel:req.body.channel||'Meta / Instagram',spec,stage:'QUALIFIED',created_at:now(),updated_at:now()};
  if(!pool){mem.prospects.unshift(p);return res.json(p)}
  res.json((await pool.query('insert into prospects(id,tenant_id,company,country,url,observed_need,product,vertical,channel,spec,stage) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *',[p.id,p.tenant_id,p.company,p.country,p.url,p.observed_need,p.product,p.vertical,p.channel,p.spec,p.stage])).rows[0]);
});

app.post('/api/seed/beco13', async (req,res)=>{
  const tenant={id:'beco13',name:'Beco 13',country:'BR',locale:'pt-BR',currency:'BRL'};
  const products=[
    {id:'miniatura',name:'Miniatura 1:36',category:'general',price:150,cost:75,stock:0,objective:'creative_benchmark'},
    {id:'oculos',name:'Óculos',category:'fashion',price:90,cost:0,stock:0,objective:'sales'},
    {id:'fone',name:'Fone AirDots',category:'tech',price:35,cost:0,stock:0,objective:'sales'},
    {id:'bone',name:'Boné',category:'fashion',price:35,cost:0,stock:0,objective:'sales'},
    {id:'doce',name:'Doce',category:'food',price:2,cost:0,stock:0,objective:'impulse_sales'},
    {id:'plastic-cone',name:'Plastic Cone',category:'smoking_accessory',price:8,cost:2.5,stock:4000,objective:'stock_recovery'}
  ];
  if(!pool){if(!mem.tenants.some(x=>x.id==='beco13'))mem.tenants.push({...tenant,created_at:now()});for(const x of products)if(!mem.products.some(p=>p.id===x.id))mem.products.push({...x,tenant_id:'beco13',metadata:{caseZero:true},created_at:now()});return res.json({ok:true,tenant,products})}
  await pool.query('insert into tenants(id,name,country,locale,currency) values($1,$2,$3,$4,$5) on conflict(id) do nothing',[tenant.id,tenant.name,tenant.country,tenant.locale,tenant.currency]);
  for(const x of products)await pool.query("insert into products(id,tenant_id,name,category,price,cost,stock,objective,metadata) values($1,'beco13',$2,$3,$4,$5,$6,$7,$8) on conflict(id) do update set price=excluded.price,cost=excluded.cost,stock=excluded.stock,objective=excluded.objective",[x.id,x.name,x.category,x.price,x.cost,x.stock,x.objective,{caseZero:true}]);
  res.json({ok:true,tenant,products});
});

app.get('/api/jobs', async (req,res)=>{ if(!pool)return res.json(mem.jobs);res.json(await rows('select * from jobs order by created_at desc limit 200')); });
app.get('/api/jobs/:id', async (req,res)=>{ if(!pool){const j=mem.jobs.find(x=>x.id===req.params.id);return j?res.json(j):res.status(404).json({error:'job not found'})} const out=(await pool.query('select * from jobs where id=$1',[req.params.id])).rows[0];return out?res.json(out):res.status(404).json({error:'job not found'}); });

app.get('/api/owner', async (req,res)=>{
  if(!pool)return res.json({tenants:mem.tenants.length,products:mem.products.length,jobs:mem.jobs.length,winners:mem.feedback.filter(x=>x.verdict==='WINNER').length,prospects:mem.prospects.length,stockPlans:mem.stockPlans.length,db:'memory'});
  const q=await pool.query("select (select count(*) from tenants)::int tenants,(select count(*) from products)::int products,(select count(*) from jobs)::int jobs,(select count(*) from feedback where verdict='WINNER')::int winners,(select count(*) from prospects)::int prospects,(select count(*) from stock_plans)::int stock_plans");
  res.json({...q.rows[0],db:'postgres'});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
initDb().then(()=>app.listen(port,()=>console.log(`Creative Ops listening on ${port}`))).catch(err=>{console.error('DB init failed',err);process.exit(1)});
