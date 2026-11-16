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
  if(op==='NOT_CONTAINS')return !compare(value,'CONTAINS',compareValue);
  if(['CONTAINS_ANY','CONTAINS_ALL'].includes(op)){
    const actual=Array.isArray(value)?value.map(String):value==null?[]:[String(value)];
    const expected=Array.isArray(compareValue)?compareValue.map(String):[String(compareValue)];
    return op==='CONTAINS_ANY'?expected.some(v=>actual.includes(v)):expected.every(v=>actual.includes(v));
  }
  if(['GREATER_THAN','GREATER_THAN_OR_EQUAL','LESS_THAN','LESS_THAN_OR_EQUAL'].includes(op)){
    if(value===null||value===undefined||value===''||compareValue==null)return false;
    const a=Number(value),b=Number(compareValue);
    if(!Number.isFinite(a)||!Number.isFinite(b))return null;
    return ({GREATER_THAN:a>b,GREATER_THAN_OR_EQUAL:a>=b,LESS_THAN:a<b,LESS_THAN_OR_EQUAL:a<=b})[op];
  }
  if(op==='BEFORE'||op==='AFTER'){
    const a=Date.parse(String(value??'')),b=Date.parse(String(compareValue??''));
    if(!Number.isFinite(a)||!Number.isFinite(b))return false;
    return op==='BEFORE'?a<b:a>b;
  }
  return null; // unsupported rule operator: do NOT imply behavior
}
export function evaluateRule(rule,conditions,answers,graph=null) {
  const list=conditions.filter(c=>Number(c.conditional_rule_id)===Number(rule.id)&&c.is_enabled!==false);
  if(!list.length)return null;
  const results=list.map(c=>{
    if(c.source_type!=='QUESTION')return null;
    const x=c.condition_value||{};
    const mapped=(graph?.conditionOptions||[]).filter(o=>Number(o.condition_id)===Number(c.id));
    const mappedValues=mapped.map(m=>graph.options?.find(o=>Number(o.id)===Number(m.answer_option_id))?.option_value).filter(v=>v!==undefined);
    const expected=mappedValues.length ? (['CONTAINS_ANY','CONTAINS_ALL','NOT_CONTAINS'].includes(c.condition_operator)?mappedValues:mappedValues[0]) : (x.value??x.values??x.expected_value??x.option_value??null);
    return compare(answers[Number(c.source_id)],c.condition_operator,expected);
  });
  if(results.some(x=>x===null))return null;
  return rule.condition_logic==='OR'?results.some(Boolean):results.every(Boolean);
}
export function visibilityFor(targetType,targetId,g,answers) {
  const matching=g.conditional.filter(r=>r.is_enabled!==false&&r.target_type===targetType&&Number(r.target_id)===Number(targetId));
  // SHOW is an inclusion gate: an unmet SHOW condition hides the target.
  // An explicit matching HIDE always wins over SHOW.
  let hidden=false,required=null,disabled=false,unknown=false;
  let showPresent=false,showPassed=false,hidePassed=false;
  for(const r of matching){
    if(r.action_type==='SHOW')showPresent=true;
    const result=evaluateRule(r,g.conditions,answers,g);
    if(result===null){unknown=true;continue;}
    if(result){
      if(r.action_type==='HIDE')hidePassed=true;
      if(r.action_type==='SHOW')showPassed=true;
      if(r.action_type==='REQUIRE')required=true;
      if(r.action_type==='MAKE_OPTIONAL')required=false;
      if(r.action_type==='DISABLE')disabled=true;
      if(r.action_type==='ENABLE')disabled=false;
    }
  }
  hidden=(showPresent&&!showPassed)||hidePassed;
  return {hidden,required,disabled,unknown};
}
export function emptyGraph(){return {domains:[],contributors:[],instances:[],sections:[],questions:[],options:[],conditional:[],conditions:[],conditionOptions:[],risk:[],stages:[],stageTeams:[],removedCounts:{domains:0,contributors:0,instances:0,stages:0},hiddenLinkedRules:0,removedItems:[]};}
