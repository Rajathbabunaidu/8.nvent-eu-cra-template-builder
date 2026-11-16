import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeGraph,removedTotal} from '../src/lifecycle.mjs';
import {createApi} from '../src/api.mjs';

const raw=()=>({
  domains:[{id:1,template_version_id:8,domain_name:'Active'},{id:2,template_version_id:8,domain_name:'Removed',removed_at:'2026-11-16T10:00:00Z'}],
  contributors:[{id:11,domain_id:1},{id:12,domain_id:2,removed_at:'2026-11-16T10:00:00Z'},{id:13,domain_id:1,removed_at:'2026-11-16T09:00:00Z'}],
  instances:[{id:21,contributor_assessment_id:11,is_enabled:false},{id:22,contributor_assessment_id:12,removed_at:'2026-11-16T10:00:00Z'},{id:23,contributor_assessment_id:13},{id:24,contributor_assessment_id:11,removed_at:'2026-11-16T11:00:00Z'}],
  stages:[{id:31,domain_id:1,stage_name:'Review',removed_at:'2026-11-16T11:00:00Z'},{id:32,domain_id:2,removed_at:'2026-11-16T10:00:00Z'}],
  stageTeams:[{id:41,domain_review_stage_id:31},{id:42,domain_review_stage_id:32}],
  sections:[{id:51,tool_instance_id:21},{id:52,tool_instance_id:22},{id:53,tool_instance_id:24}],
  questions:[{id:61,tool_section_id:51},{id:62,tool_section_id:52},{id:63,tool_section_id:53}],
  options:[{id:71,question_id:61},{id:72,question_id:62},{id:73,question_id:63}],
  conditional:[{id:81,target_type:'QUESTION',target_id:61},{id:82,target_type:'QUESTION',target_id:62}],
  conditions:[{id:91,conditional_rule_id:81},{id:92,conditional_rule_id:82}],
  conditionOptions:[{id:101,condition_id:91,answer_option_id:71},{id:102,condition_id:92,answer_option_id:72}],
  risk:[{id:111,tool_instance_id:21},{id:112,tool_instance_id:22}],
});

test('soft-removal projection retains disabled but active tools and filters removed descendants',()=>{
  const g=activeGraph(raw());
  assert.deepEqual(g.domains.map(x=>x.id),[1]);
  assert.deepEqual(g.contributors.map(x=>x.id),[11]);
  assert.deepEqual(g.instances.map(x=>x.id),[21]);
  assert.equal(g.instances[0].is_enabled,false); // disabling is NOT removal
  for(const key of ['sections','questions','options','conditional','conditions','conditionOptions','risk']){
    assert.equal(g[key].length,1,`${key} should contain only active descendants`);
  }
  assert.equal(g.stageTeams.length,0);
  assert.equal(g.hiddenLinkedRules,1);
  assert.deepEqual(g.removedCounts,{domains:1,contributors:2,instances:2,stages:2});
  assert.equal(removedTotal(g),7);
});

test('restore list exposes only top-most removed nodes with active parents',()=>{
  const g=activeGraph(raw());
  assert.deepEqual(g.removedItems.map(x=>[x.kind,x.id]),[
    ['DOMAIN',2],['CONTRIBUTOR',13],['TOOL',24],['STAGE',31]
  ]);
});

test('no removed items permits legacy behavior',()=>{
  const fresh=raw();
  for(const k of ['domains','contributors','instances','stages'])fresh[k]=fresh[k].map(x=>({...x,removed_at:null}));
  assert.equal(removedTotal(activeGraph(fresh)),0);
});

test('API graph composes into active projection instead of leaking nested removed content',async()=>{
  const fake=raw();
  const tables={cra_tm_domains:fake.domains,cra_tm_conditional_rules:fake.conditional,cra_tm_contributor_assessments:fake.contributors,
    cra_tm_domain_review_stages:fake.stages,cra_tm_conditional_rule_conditions:fake.conditions,
    cra_tm_condition_answer_options:fake.conditionOptions,cra_tm_tool_instances:fake.instances,
    cra_tm_domain_review_stage_teams:fake.stageTeams,cra_tm_tool_sections:fake.sections,
    cra_tm_risk_issue_rules:fake.risk,cra_tm_tool_questions:fake.questions,cra_tm_tool_answer_options:fake.options};
  const calls=[];
  const api=createApi({url:'https://example.supabase.co',key:'sb_publishable_demo',fetchFn:async url=>{
    const path=new URL(url).pathname.split('/').pop(),search=new URL(url).searchParams;
    calls.push({path,search});
    let values=tables[path]||[];
    for(const [k,v] of search){
      if(['select','order','limit','offset'].includes(k))continue;
      if(v.startsWith('eq.')) values=values.filter(x=>String(x[k])===v.slice(3));
      if(v.startsWith('in.(')) values=values.filter(x=>v.slice(4,-1).split(',').includes(String(x[k])));
    }
    return {ok:true,text:async()=>JSON.stringify(values)};
  }});
  const g=await api.graph(8);
  assert.equal(g.domains.length,1);
  assert.equal(g.instances.length,1);
  assert.equal(removedTotal(g),7);
  const sectionReq=calls.find(x=>x.path==='cra_tm_tool_sections');
  assert.equal(sectionReq.search.get('tool_instance_id'),'in.(21,23)');
});

test('new SQL uses draft-only status and retains history; blocks publish of tombstones',()=>{
  const sql=readFileSync(new URL('../sql/03_draft_soft_remove_rpc_v1_1_1.sql',import.meta.url),'utf8');
  for(const token of ['cra_tm_remove_draft_item','cra_tm_restore_draft_item',"v_status IS DISTINCT FROM 'DRAFT'",'cra_tm_block_publish_with_removed_items',"v_new_status <> 'PUBLISHED'",'SET removed_at=v_now','SET removed_at=NULL']){
    assert.ok(sql.includes(token),token);
  }
  assert.doesNotMatch(sql,/DELETE\s+FROM\s+public\.cra_tm_tool_configuration_history/i);
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.cra_tm_remove_draft_item.*FROM anon/);
});

test('UI routes hierarchy removal via soft RPC and gates legacy publish/validation',()=>{
  const vue=readFileSync(new URL('../src/wwElement.vue',import.meta.url),'utf8');
  for(const token of ['cra_tm_remove_draft_item','cra_tm_restore_draft_item','removalCount.value===0','removalCount.value>0','g.removedItems'])assert.ok(vue.includes(token),token);
});
