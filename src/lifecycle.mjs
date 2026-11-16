/** Draft lifecycle projection. Do not confuse removal with is_enabled=false.
 * Legacy published rows have removed_at=NULL and remain visible.
 * Preserves IDs and underlying history; provides raw tombstone counts to gate publish.
 */
export const LIFECYCLE_LEVELS=Object.freeze(['domains','contributors','instances','stages']);
export function activeGraph(raw) {
  const original={...raw};
  const active = item => item?.removed_at == null;
  const ids = rows => new Set(rows.map(x=>Number(x.id)));
  const domains=(raw.domains||[]).filter(active);
  const domainIds=ids(domains);
  const contributors=(raw.contributors||[]).filter(x=>active(x)&&domainIds.has(Number(x.domain_id)));
  const contributorIds=ids(contributors);
  const instances=(raw.instances||[]).filter(x=>active(x)&&contributorIds.has(Number(x.contributor_assessment_id)));
  const instanceIds=ids(instances);
  const stages=(raw.stages||[]).filter(x=>active(x)&&domainIds.has(Number(x.domain_id)));
  const stageIds=ids(stages);
  const sections=(raw.sections||[]).filter(x=>instanceIds.has(Number(x.tool_instance_id)));
  const sectionIds=ids(sections);
  const questions=(raw.questions||[]).filter(x=>sectionIds.has(Number(x.tool_section_id)));
  const questionIds=ids(questions);
  const options=(raw.options||[]).filter(x=>questionIds.has(Number(x.question_id)));
  const optionIds=ids(options);
  const conditional=(raw.conditional||[]).filter(r=>{
    const id=Number(r.target_id);
    if(r.target_type==='DOMAIN')return domainIds.has(id);
    if(r.target_type==='CONTRIBUTOR')return contributorIds.has(id);
    if(r.target_type==='TOOL_INSTANCE')return instanceIds.has(id);
    if(r.target_type==='TOOL_SECTION')return sectionIds.has(id);
    if(r.target_type==='QUESTION')return questionIds.has(id);
    return true; // Unknown target types are not silently discarded.
  });
  const ruleIds=ids(conditional);
  const conditions=(raw.conditions||[]).filter(c=>ruleIds.has(Number(c.conditional_rule_id)));
  const conditionIds=ids(conditions);
  const conditionOptions=(raw.conditionOptions||[]).filter(o=>conditionIds.has(Number(o.condition_id))&&optionIds.has(Number(o.answer_option_id)));
  const risk=(raw.risk||[]).filter(r=>instanceIds.has(Number(r.tool_instance_id)));
  const stageTeams=(raw.stageTeams||[]).filter(st=>stageIds.has(Number(st.domain_review_stage_id)));
  const removedCounts={
    domains:(original.domains||[]).filter(x=>!active(x)).length,
    contributors:(original.contributors||[]).filter(x=>!active(x)).length,
    instances:(original.instances||[]).filter(x=>!active(x)).length,
    stages:(original.stages||[]).filter(x=>!active(x)).length,
  };
  // Only top-most removed items can be restored directly; a removed parent must
  // be restored before exposing its nested removed items.
  const removedItems=[
    ...(raw.domains||[]).filter(x=>!active(x)).map(x=>({kind:'DOMAIN',id:x.id,name:x.domain_name,removed_at:x.removed_at})),
    ...(raw.contributors||[]).filter(x=>!active(x)&&domainIds.has(Number(x.domain_id))).map(x=>({kind:'CONTRIBUTOR',id:x.id,name:x.assessment_name,removed_at:x.removed_at})),
    ...(raw.instances||[]).filter(x=>!active(x)&&contributorIds.has(Number(x.contributor_assessment_id))).map(x=>({kind:'TOOL',id:x.id,name:x.instance_name,removed_at:x.removed_at})),
    ...(raw.stages||[]).filter(x=>!active(x)&&domainIds.has(Number(x.domain_id))).map(x=>({kind:'STAGE',id:x.id,name:x.stage_name,removed_at:x.removed_at})),
  ];
  const hiddenLinkedRules=(raw.conditional||[]).length-conditional.length;
  return {domains,contributors,instances,sections,questions,options,conditional,conditions,conditionOptions,risk,stages,stageTeams,removedCounts,removedItems,hiddenLinkedRules};
}
export function removedTotal(g){
  return Object.values(g?.removedCounts||{}).reduce((n,x)=>n+(Number(x)||0),0);
}
