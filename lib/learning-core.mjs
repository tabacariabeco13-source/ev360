export function summarizeLearning(experiments=[]){
  const completed=(experiments||[]).filter(x=>String(x.status).toUpperCase()==='COMPLETED');
  if(!completed.length){
    return {
      mode:'EXPLORE',
      confidence:'LOW',
      directive:'No completed experiment exists. Explore materially different hypotheses and change one meaningful variable per test.',
      source_experiment_id:null,
      changed_variable:null
    };
  }
  const latest=[...completed].sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0))[0];
  const learning=latest.learning||{};
  const outcome=String(learning.outcome||latest.result?.outcome||'NEUTRAL').toUpperCase();
  const changed=learning.changed_variable||latest.changed_variable||'unknown';

  if(outcome==='WINNER'){
    return {
      mode:'CONTROLLED_CHILD',
      confidence:'MEDIUM',
      directive:`Preserve the winning body/angle where possible and change only the tested variable: ${changed}. Do not count cosmetic copies as new concepts.`,
      source_experiment_id:latest.id,
      changed_variable:changed,
      source_hypothesis:latest.hypothesis||''
    };
  }
  if(outcome==='LOSER'){
    return {
      mode:'DIAGNOSE_FAILURE',
      confidence:'MEDIUM',
      directive:`Do not discard the entire angle from one loss. Isolate whether ${changed} failed before changing multiple variables.`,
      source_experiment_id:latest.id,
      changed_variable:changed,
      source_hypothesis:latest.hypothesis||''
    };
  }
  return {
    mode:'COLLECT_SIGNAL',
    confidence:'LOW',
    directive:'Result is neutral or insufficient. Preserve test structure and collect more signal before a confident pivot.',
    source_experiment_id:latest.id,
    changed_variable:changed,
    source_hypothesis:latest.hypothesis||''
  };
}

export function applyLearningToConcept(concept={},learning={}){
  const next={...concept,learning:{...learning}};
  if(learning.mode==='CONTROLLED_CHILD'){
    next.variable='controlled-'+(learning.changed_variable||concept.variable||'single-variable');
    next.production_directive=learning.directive;
  }else if(learning.mode==='DIAGNOSE_FAILURE'){
    next.variable='diagnostic-'+(learning.changed_variable||concept.variable||'failure');
    next.production_directive=learning.directive;
  }else if(learning.mode==='COLLECT_SIGNAL'){
    next.variable='signal-'+(concept.variable||'single-variable');
    next.production_directive=learning.directive;
  }else{
    next.production_directive=learning.directive;
  }
  return next;
}

export function learningScenePrefix(learning={}){
  if(!learning?.directive) return '';
  return `LEARNING LOOP DIRECTIVE: ${learning.directive} `;
}
