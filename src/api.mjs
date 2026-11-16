/** EU CRA Template Builder — public-key-only Supabase PostgREST adapter.
 * Contract based on uploaded 2026-11-15 schema and 3A–3H additive migrations.
 * No browser persistence, privileged keys, Supabase Auth impersonation, or RLS bypass.
 */
export const T = Object.freeze({
  templates:'cra_tm_templates',versions:'cra_tm_template_versions',versionStatuses:'cra_tm_version_statuses',
  templateStatuses:'cra_tm_template_statuses',teams:'teams',users:'user_profiles',
  domains:'cra_tm_domains',contributors:'cra_tm_contributor_assessments',
  tools:'cra_tm_tools',releases:'cra_tm_tool_releases',instances:'cra_tm_tool_instances',
  sections:'cra_tm_tool_sections',questions:'cra_tm_tool_questions',options:'cra_tm_tool_answer_options',
  questionTypes:'cra_tm_question_types',conditional:'cra_tm_conditional_rules',
  conditions:'cra_tm_conditional_rule_conditions',conditionOptions:'cra_tm_condition_answer_options',risk:'cra_tm_risk_issue_rules',
  stages:'cra_tm_domain_review_stages',stageTeams:'cra_tm_domain_review_stage_teams',
  validationRuns:'cra_tm_validation_runs',validationResults:'cra_tm_template_validation_results',
});

export const eq = (id) => `eq.${positiveId(id)}`;
export function positiveId(id) {
  const n = Number(id);
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error('A valid positive record ID is required.');
  return n;
}
export function projectUrl(text) {
  const source = String(text ?? '').trim().replace(/\/+$/, '');
  if (!source) throw new Error('Enter a Supabase Project URL.');
  let url;
  try { url = new URL(source); } catch { throw new Error('Invalid Supabase Project URL.'); }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname))) {
    throw new Error('Supabase Project URL must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('Enter only the Supabase project origin (no path, credentials or query string).');
  }
  return url.origin;
}
export function publicKey(text) {
  const k=String(text ?? '').trim();
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(k)) {
    throw new Error('Use your sb_publishable_… key. Never enter a secret/service_role key.');
  }
  return k;
}
export function codeToken(text) { return String(text || '').trim().replace(/[^A-Za-z0-9_-]/g,'_').toUpperCase().slice(0,80); }
export function unwrap(result) { return Array.isArray(result) ? result[0] : result; }
export function idList(rows) { return rows.map(x => positiveId(x.id)); }

export function createApi({url,key,fetchFn=fetch}) {
  const origin=projectUrl(url), apikey=publicKey(key);
  async function request(tableOrRpc,{method='GET',query={},body,signal}={}) {
    const endpoint=new URL(`${origin}/rest/v1/${tableOrRpc}`);
    Object.entries(query).forEach(([k,v])=>{if(v !== undefined && v !== null && v !== '') endpoint.searchParams.set(k,String(v));});
    const headers={apikey,Accept:'application/json'};
    if(body !== undefined) { headers['Content-Type']='application/json';headers.Prefer='return=representation'; }
    let resp;
    try {resp=await fetchFn(endpoint.toString(),{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal});}
    catch(e) {throw new Error('Supabase connection failed: '+(e.message||'network error'));}
    const raw=await resp.text();let json;
    try {json=raw?JSON.parse(raw):null;}catch {json=raw;}
    if(!resp.ok) {
      const message=typeof json==='object' && json !== null ? (json.message || json.error_description || json.error || resp.statusText) : (json||resp.statusText);
      throw new Error(`${resp.status} · ${String(message).slice(0,600)}`);
    }
    return json;
  }
  async function rows(name,filter={},select='*',order='id.asc') {
    const output=[];const size=500;let offset=0;
    for(;offset<10000;offset+=size){
      const page=await request(name,{query:{select,order,...filter,limit:size,offset}});
      if(!Array.isArray(page))throw new Error(`Expected list from ${name}`);
      output.push(...page);if(page.length<size)return output;
    }
    throw new Error(`${name} contains over 10,000 records. Narrow the selection.`);
  }
  function byIds(name,ids) {
    const clean=[...new Set(ids.map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))];
    if(!clean.length)return Promise.resolve([]);
    if(clean.length>300)throw new Error(`Too many linked IDs to load ${name}.`);
    return rows(name,{id:`in.(${clean.join(',')})`});
  }
  function childRows(name,fk,parents){
    const clean=[...new Set(parents.map(Number).filter(n=>Number.isSafeInteger(n)&&n>0))];
    if(!clean.length)return Promise.resolve([]);
    if(clean.length>300)throw new Error(`Too many related IDs for ${name}.`);
    return rows(name,{[fk]:`in.(${clean.join(',')})`});
  }
  const rpc=(name,params={})=>request(`rpc/${name}`,{method:'POST',body:params});
  const insert=(name,payload)=>request(name,{method:'POST',body:payload});
  const patch=(name,id,payload)=>request(name,{method:'PATCH',query:{id:eq(id)},body:payload});
  const remove=(name,id)=>request(name,{method:'DELETE',query:{id:eq(id)}});
  const get=(name,id)=>rows(name,{id:eq(id)}).then(x=>x[0]||null);
  async function catalogue() {
    const [templates,versions,versionStatuses,templateStatuses,teams,users,tools,releases,questionTypes]=await Promise.all([
      rows(T.templates),rows(T.versions),rows(T.versionStatuses),rows(T.templateStatuses),rows(T.teams),
      rows(T.users),rows(T.tools),rows(T.releases),rows(T.questionTypes)
    ]);
    return {templates,versions,versionStatuses,templateStatuses,teams,users,tools,releases,questionTypes};
  }
  async function graph(versionId) {
    const vid=positiveId(versionId);
    const [domains,conditional]=await Promise.all([rows(T.domains,{template_version_id:eq(vid)}),rows(T.conditional,{template_version_id:eq(vid)})]);
    const [contributors,stages,conditions]=await Promise.all([
      childRows(T.contributors,'domain_id',idList(domains)),childRows(T.stages,'domain_id',idList(domains)),
      childRows(T.conditions,'conditional_rule_id',idList(conditional))
    ]);
    const conditionOptions=await childRows(T.conditionOptions,'condition_id',idList(conditions));
    const [instances,stageTeams]=await Promise.all([
      childRows(T.instances,'contributor_assessment_id',idList(contributors)),
      childRows(T.stageTeams,'domain_review_stage_id',idList(stages))
    ]);
    const [sections,risk]=await Promise.all([
      childRows(T.sections,'tool_instance_id',idList(instances)),
      childRows(T.risk,'tool_instance_id',idList(instances))
    ]);
    const questions=await childRows(T.questions,'tool_section_id',idList(sections));
    const options=await childRows(T.options,'question_id',idList(questions));
    return {domains,contributors,instances,sections,questions,options,conditional,conditions,conditionOptions,risk,stages,stageTeams};
  }
  return {request,rows,byIds,childRows,rpc,insert,patch,remove,get,catalogue,graph};
}
