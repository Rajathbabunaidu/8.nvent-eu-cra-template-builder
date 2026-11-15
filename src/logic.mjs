/** Presentation-only helpers. Preview never writes submissions or runs decisions. */
export const sorted=(rows=[])=>[...rows].sort((a,b)=>(Number(a.display_order??a.stage_order??0)-Number(b.display_order??b.stage_order??0))||(Number(a.id)-Number(b.id)));
export const asId=x=>Number(x?.id||0);
export function belong(graph,domainId) {
  const domain=graph.domains.find(d=>Number(d.id)===Number(domainId));
  const contributors=sorted(graph.contributors.filter(c=>Number(c.domain_id)===Number(domainId)));
  return {domain,contributors};
}
export function questionsForContributor(g,contributorId) {
  const instanceIds=new Set(g.instances.filter(i=>Number(i.contributor_assessment_id)===Number(contributorId)&&i.is_enabled!==false).map(asId));
  const sectionIds=new Set(g.sections.filter(s=>instanceIds.has(asId(g.instances.find(i=>asId(i)===Number(s.tool_instance_id))))&&s.is_enabled!==false).map(asId));
  return sorted(g.questions.filter(q=>sectionIds.has(Number(q.tool_section_id))&&q.is_enabled!==false));
}
export function compare(value,operator,compareValue) {
  const op=String(operator||'').toUpperCase();
  if(op==='IS_EMPTY')return value===undefined||value===null||value===''||(Array.isArray(value)&&!value.length);
  if(op==='IS_NOT_EMPTY')return !compare(value,'IS_EMPTY',null);
  if(op==='EQUALS'||op==='EQ'||op==='=')return Array.isArray(value)?value.map(String).includes(String(compareValue)):String(value??'')===String(compareValue??'');
  if(op==='NOT_EQUALS'||op==='NEQ'||op==='!=')return !compare(value,'EQUALS',compareValue);
  if(op==='CONTAINS')return Array.isArray(value)?value.map(String).includes(String(compareValue)):String(value??'').includes(String(compareValue??''));
  return null; // unsupported rule operator: do NOT imply behavior
}
export function evaluateRule(rule,conditions,answers) {
  const list=conditions.filter(c=>Number(c.conditional_rule_id)===Number(rule.id)&&c.is_enabled!==false);
  if(!list.length)return null;
  const results=list.map(c=>{
    if(c.source_type!=='QUESTION')return null;
    const x=c.condition_value||{};
    const expected=x.value??x.values??x.expected_value??x.option_value??null;
    return compare(answers[Number(c.source_id)],c.condition_operator,expected);
  });
  if(results.some(x=>x===null))return null;
  return rule.condition_logic==='OR'?results.some(Boolean):results.every(Boolean);
}
export function visibilityFor(targetType,targetId,g,answers) {
  const matching=g.conditional.filter(r=>r.is_enabled!==false&&r.target_type===targetType&&Number(r.target_id)===Number(targetId));
  let hidden=false,required=null,disabled=false,unknown=false;
  for(const r of matching){
    const result=evaluateRule(r,g.conditions,answers);
    if(result===null){unknown=true;continue;}
    if(result){
      if(r.action_type==='HIDE')hidden=true;
      if(r.action_type==='SHOW')hidden=false;
      if(r.action_type==='REQUIRE')required=true;
      if(r.action_type==='MAKE_OPTIONAL')required=false;
      if(r.action_type==='DISABLE')disabled=true;
      if(r.action_type==='ENABLE')disabled=false;
    }
  }
  return {hidden,required,disabled,unknown};
}
export function emptyGraph(){return {domains:[],contributors:[],instances:[],sections:[],questions:[],options:[],conditional:[],conditions:[],risk:[],stages:[],stageTeams:[]};}
