const cq=s=>document.querySelector(s);
async function cApi(url,opt={}){
  const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.error||'request failed');
  return j;
}

function money(n){return '$'+Number(n||0).toFixed(2)}

async function loadCommercial(){
  const status=cq('#commercialStatus');
  try{
    status.textContent='Carregando operação comercial…';
    const [board,bootstrap,owner,admission,brand,providers,engagements,audit,performance]=await Promise.all([
      cApi('/api/sales/leads'),
      cApi('/api/bootstrap'),
      cApi('/api/owner'),
      cApi('/api/admission-policy'),
      cApi('/api/brand'),
      cApi('/api/providers'),
      cApi('/api/engagements'),
      cApi('/api/audit'),
      cApi('/api/performance-events')
    ]);

    if(cq('#brandName')) cq('#brandName').textContent=brand.brand||'AdNimbly';
    if(cq('#productName')) cq('#productName').textContent=(brand.product||'Creative Ops Autopilot')+' • '+(brand.category||'Creative Revenue Operating System')+' • v0.13';
    cq('#providerTruth').innerHTML=(providers.providers||[]).map(p=>'<div class="item"><b>'+p.label+'</b><small>'+p.status+' • '+p.mode+' • '+(p.estimated_cost_usd===null?'preço desconhecido':'US$ '+p.estimated_cost_usd)+'</small></div>').join('');
    if(cq('#pilotTenant')) cq('#pilotTenant').innerHTML=(bootstrap.tenants||[]).map(t=>'<option value="'+t.id+'">'+t.name+' • '+t.country+'</option>').join('');
    if(cq('#perfTenant')){
      cq('#perfTenant').innerHTML=(bootstrap.tenants||[]).map(t=>'<option value="'+t.id+'">'+t.name+' • '+t.country+'</option>').join('');
      const syncPerf=()=>{
        const tid=cq('#perfTenant').value;
        const jobs=(bootstrap.jobs||[]).filter(j=>j.tenant_id===tid);
        const exps=(bootstrap.experiments||[]).filter(x=>x.tenant_id===tid);
        cq('#perfJob').innerHTML='<option value="">sem job</option>'+jobs.map(j=>'<option value="'+j.id+'">'+(j.vertical||'job')+' • '+j.status+' • '+j.id.slice(0,8)+'</option>').join('');
        cq('#perfExperiment').innerHTML='<option value="">sem experimento</option>'+exps.map(x=>'<option value="'+x.id+'">'+(x.changed_variable||'variable')+' • '+x.status+' • '+x.id.slice(0,8)+'</option>').join('');
      };
      cq('#perfTenant').onchange=syncPerf;
      syncPerf();
    }
    if(cq('#engagementList')) cq('#engagementList').innerHTML=(engagements||[]).slice(0,12).map(e=>'<div class="item"><b>'+e.status+' • '+money(e.quote?.price_usd)+'</b><small>'+(e.tenant_id||'sem tenant')+' • payment '+(e.payment?.state||'UNPAID')+' • '+e.id+'</small></div>').join('')||'<div class="muted">Nenhum engagement.</div>';
    if(cq('#auditList')) cq('#auditList').innerHTML=(audit||[]).slice(0,10).map(a=>'<div class="item"><b>'+a.event_type+'</b><small>'+a.entity_type+' '+(a.entity_id||'')+' • '+new Date(a.created_at).toLocaleString()+'</small></div>').join('')||'<div class="muted">Sem eventos ainda.</div>';
    if(cq('#performanceList')) cq('#performanceList').innerHTML=(performance||[]).slice(0,12).map(p=>'<div class="item"><b>'+p.channel+' • '+(p.evaluation?.outcome||'UNKNOWN')+'</b><small>'+p.primary_metric+' = '+(p.evaluation?.primary_value??'-')+' • sample '+(p.evaluation?.sample??0)+' • '+new Date(p.observed_at).toLocaleString()+'</small></div>').join('')||'<div class="muted">Sem performance real registrada.</div>';

    const contacted=(bootstrap.prospects||[]).filter(p=>p.stage==='CONTACTED').length;
    const replied=(bootstrap.prospects||[]).filter(p=>p.stage==='REPLIED').length;
    const paid=(bootstrap.prospects||[]).filter(p=>['PAID_TEST','PROPOSAL','WON'].includes(p.stage)).length;

    cq('#commercialKpis').innerHTML=[
      ['Alvos mapeados',board.mapped_count||0],
      ['Contactados',contacted],
      ['Respostas',replied],
      ['Em dinheiro',paid],
      ['Pilotos full máx.',admission.simultaneous_full_pilots_cap||0],
      ['Ativos escalonados',admission.maximum_active_buyers_with_staggered_phases||0]
    ].map(([k,v])=>'<div class="kpi"><b>'+v+'</b><span>'+k+'</span></div>').join('');

    cq('#leadBoard').innerHTML=(board.ranked||[]).slice(0,10).map((x,i)=>{
      const d=x.decision||{};
      return '<div class="item"><b>#'+(i+1)+' '+(x.company||x.title)+'</b>'+
        '<small>'+[x.title,x.budget,x.posted].filter(Boolean).join(' • ')+'</small>'+
        '<div style="margin-top:6px"><span class="pill">'+(d.band||'UNRANKED')+'</span> <span class="pill">score '+(d.score??'-')+'</span></div>'+
        '<small style="margin-top:6px">'+(x.attack||'')+'</small></div>';
    }).join('')||'<div class="muted">Nenhum alvo carregado.</div>';

    cq('#admissionBox').innerHTML=
      '<div class="gate"><span>Pilotos completos simultâneos</span><b class="allow">'+admission.simultaneous_full_pilots_cap+'</b></div>'+
      '<div class="gate"><span>Clientes ativos com fases escalonadas</span><b class="allow">'+admission.maximum_active_buyers_with_staggered_phases+'</b></div>'+
      '<div class="gate"><span>Prometer 8 operações completas agora</span><b class="'+(admission.eight_full_deliveries_claim_allowed?'allow':'review')+'">'+(admission.eight_full_deliveries_claim_allowed?'SIM':'NÃO')+'</b></div>'+
      '<div class="status">'+(admission.promotion_rule||'')+'</div>';

    cq('#commercialOwnerSnapshot').textContent=JSON.stringify({
      db:owner.db,
      prospects:owner.prospects,
      economics:owner.economics,
      experiments:owner.experiments,
      providerInvocations:owner.providerInvocations||owner.provider_invocations,
      policyChecks:owner.policyChecks||owner.policy_checks,
      engagements:owner.engagements,
      auditEvents:owner.auditEvents||owner.audit_events,
      performanceEvents:owner.performanceEvents||owner.performance_events
    },null,2);

    status.textContent='Comercial sincronizado. Sem receita inventada: resposta ≠ pagamento.';
  }catch(e){
    status.textContent='Falha ao carregar comercial: '+e.message;
  }
}

cq('#loadCommercial')?.addEventListener('click',loadCommercial);

cq('#runReplyTriage')?.addEventListener('click',async()=>{
  try{
    const r=await cApi('/api/sales/reply-triage',{
      method:'POST',
      body:JSON.stringify({
        reply_text:cq('#replyText').value,
        buyer:{company:cq('#replyBuyer').value||'Prospect'},
        capacity:{full_slots_available:Number(cq('#replySlots').value||0)}
      })
    });
    cq('#replyOutput').textContent=JSON.stringify(r,null,2);
  }catch(e){cq('#replyOutput').textContent=e.message}
});

cq('#runQuoteGuard')?.addEventListener('click',async()=>{
  try{
    const body={
      price_usd:Number(cq('#qPrice').value||0),
      provider_cost_usd:Number(cq('#qProvider').value||0),
      infra_cost_usd:Number(cq('#qInfra').value||0),
      payment_fees_usd:Number(cq('#qFees').value||0),
      human_hours:Number(cq('#qHours').value||0),
      owner_hour_value_usd:Number(cq('#qHourValue').value||0),
      contingency_usd:Number(cq('#qContingency').value||0),
      minimum_margin:Number(cq('#qMargin').value||0.35)
    };
    const r=await cApi('/api/pricing/guard',{method:'POST',body:JSON.stringify(body)});
    cq('#quoteOutput').textContent=JSON.stringify(r,null,2);
  }catch(e){cq('#quoteOutput').textContent=e.message}
});

cq('#runCapacity')?.addEventListener('click',async()=>{
  try{
    const body={
      required_people:Number(cq('#capPeople').value||0),
      hours_per_person_week:Number(cq('#capHours').value||0),
      measured_work_units_per_hour:Number(cq('#capUnitsHour').value||0),
      operator_hours_available_week:Number(cq('#capOperatorHours').value||0),
      automation_share:Number(cq('#capAutomation').value||0),
      quality_pass_rate:Number(cq('#capQuality').value||0),
      work_units_per_person_week:Number(cq('#capUnitsSeat').value||0)
    };
    const r=await cApi('/api/capacity/assess',{method:'POST',body:JSON.stringify(body)});
    cq('#capacityOutput').textContent=JSON.stringify(r,null,2);
  }catch(e){cq('#capacityOutput').textContent=e.message}
});

loadCommercial();


cq('#runProductionPlan')?.addEventListener('click',async()=>{
  try{
    const r=await cApi('/api/production/plan',{method:'POST',body:JSON.stringify({
      capability:cq('#prodCapability').value,
      authorized_usd:Number(cq('#prodAuthorized').value||0)
    })});
    cq('#productionPlanOutput').textContent=JSON.stringify(r,null,2);
  }catch(e){cq('#productionPlanOutput').textContent=e.message}
});


cq('#createPilot')?.addEventListener('click',async()=>{
  try{
    const fees=Number(cq('#pilotInfraFees').value||0);
    const r=await cApi('/api/engagements',{method:'POST',body:JSON.stringify({
      tenant_id:cq('#pilotTenant').value,
      delivery_mode:'FULL_PILOT',
      deliverables:['buyer-specific diagnosis','3 concepts','9 hooks','3 briefs','test plan'],
      price_usd:Number(cq('#pilotPrice').value||0),
      provider_cost_usd:Number(cq('#pilotProvider').value||0),
      infra_cost_usd:fees/2,
      payment_fees_usd:fees/2,
      human_hours:Number(cq('#pilotHours').value||0),
      owner_hour_value_usd:Number(cq('#pilotHourValue').value||0),
      minimum_margin:0.35
    })});
    cq('#pilotId').value=r.id;
    cq('#pilotOutput').textContent=JSON.stringify(r,null,2);
    await loadCommercial();
  }catch(e){cq('#pilotOutput').textContent=e.message}
});

cq('#recordPilotPayment')?.addEventListener('click',async()=>{
  try{
    const id=cq('#pilotId').value.trim();
    if(!id) throw new Error('Engagement ID obrigatório');
    const r=await cApi('/api/engagements/'+id+'/payment',{method:'POST',body:JSON.stringify({
      amount_received_usd:Number(cq('#pilotPaid').value||0),
      verification_source:cq('#pilotPaySource').value,
      provider_reference:cq('#pilotPayRef').value
    })});
    cq('#pilotOutput').textContent=JSON.stringify(r,null,2);
    await loadCommercial();
  }catch(e){cq('#pilotOutput').textContent=e.message}
});

cq('#activatePilot')?.addEventListener('click',async()=>{
  try{
    const id=cq('#pilotId').value.trim();
    if(!id) throw new Error('Engagement ID obrigatório');
    const r=await cApi('/api/engagements/'+id+'/activate',{method:'POST',body:'{}'});
    cq('#pilotOutput').textContent=JSON.stringify(r,null,2);
    await loadCommercial();
  }catch(e){cq('#pilotOutput').textContent=e.message}
});

cq('#deliverPilot')?.addEventListener('click',async()=>{
  try{
    const id=cq('#pilotId').value.trim();
    if(!id) throw new Error('Engagement ID obrigatório');
    const r=await cApi('/api/engagements/'+id+'/deliver',{method:'POST',body:JSON.stringify({job_ids:[],result_summary:'Delivery recorded from commercial cockpit'})});
    cq('#pilotOutput').textContent=JSON.stringify(r,null,2);
    await loadCommercial();
  }catch(e){cq('#pilotOutput').textContent=e.message}
});


cq('#recordPerformance')?.addEventListener('click',async()=>{
  try{
    const r=await cApi('/api/performance-events',{method:'POST',body:JSON.stringify({
      tenant_id:cq('#perfTenant').value,
      job_id:cq('#perfJob').value||null,
      experiment_id:cq('#perfExperiment').value||null,
      channel:cq('#perfChannel').value||'unknown',
      post_url:cq('#perfPostUrl').value||'',
      primary_metric:cq('#perfPrimary').value,
      target:Number(cq('#perfTarget').value||0),
      min_sample:Number(cq('#perfMinSample').value||100),
      metrics:{
        views:Number(cq('#perfViews').value||0),
        likes:Number(cq('#perfLikes').value||0),
        comments:Number(cq('#perfComments').value||0),
        shares:Number(cq('#perfShares').value||0),
        saves:Number(cq('#perfSaves').value||0),
        profile_visits:Number(cq('#perfProfile').value||0),
        link_clicks:Number(cq('#perfClicks').value||0),
        whatsapp_leads:Number(cq('#perfWhatsapp').value||0),
        orders:Number(cq('#perfOrders').value||0),
        revenue:Number(cq('#perfRevenue').value||0),
        spend:Number(cq('#perfSpend').value||0)
      }
    })});
    cq('#performanceOutput').textContent=JSON.stringify(r,null,2);
    await loadCommercial();
  }catch(e){cq('#performanceOutput').textContent=e.message}
});


cq('#prepareBecoTikTok')?.addEventListener('click',async()=>{
  try{
    const metric=cq('#becoTikTokMetric').value;
    const r=await cApi('/api/case-zero/beco13/tiktok-test',{method:'POST',body:JSON.stringify({
      product_id:cq('#becoTikTokProduct').value,
      objective:metric,
      primary_metric:metric,
      target:Number(cq('#perfTarget')?.value||1),
      min_sample:Number(cq('#perfMinSample')?.value||100)
    })});
    cq('#becoTikTokOutput').textContent=JSON.stringify(r,null,2);
    if(cq('#perfTenant')) cq('#perfTenant').value='beco13';
    await loadCommercial();
    if(cq('#perfTenant')) cq('#perfTenant').value='beco13';
    if(cq('#perfJob')) cq('#perfJob').value=r.job.id;
    if(cq('#perfExperiment')) cq('#perfExperiment').value=r.experiment.id;
    if(cq('#perfPrimary')) cq('#perfPrimary').value=metric;
    if(cq('#perfChannel')) cq('#perfChannel').value='TikTok Organic';
  }catch(e){cq('#becoTikTokOutput').textContent=e.message}
});
