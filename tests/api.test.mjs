import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi,projectUrl,publicKey,eq,positiveId,T} from '../src/api.mjs';
import {compare,visibilityFor,evaluateRule,emptyGraph} from '../src/logic.mjs';

test('publishable key only; rejects secret and legacy JWT',()=>{
  assert.equal(publicKey('sb_publishable_abcDEF90-'), 'sb_publishable_abcDEF90-');
  for(const bad of ['sb_secret_abc','eyJabc','', 'service_role'])assert.throws(()=>publicKey(bad));
});
test('project url validates scheme and origin',()=>{
  assert.equal(projectUrl('https://example.supabase.co/'),'https://example.supabase.co');
  for(const bad of ['http://example.supabase.co','https://user:pass@example.supabase.co','https://example.supabase.co/rest/v1','https://example.supabase.co?a=1']) assert.throws(()=>projectUrl(bad));
});
test('positive filters do not allow injection',()=>{
  assert.equal(eq(18),'eq.18');assert.throws(()=>positiveId('2;drop table'));assert.throws(()=>eq(-1));
});
test('public API builds an authenticated publishable key request',async()=>{
  const calls=[];
  const api=createApi({url:'https://example.supabase.co',key:'sb_publishable_demo',fetchFn:async(url,opts)=>{
    calls.push([url,opts]);return {ok:true,text:async()=>'[]'};
  }});
  await api.rpc('cra_tm_save_domain',{p_template_version_id:1,p_domain_name:'Safety'});
  assert.match(calls[0][0],/\/rest\/v1\/rpc\/cra_tm_save_domain$/);
  assert.equal(calls[0][1].headers.apikey,'sb_publishable_demo');
  assert.equal(calls[0][1].method,'POST');
  assert.ok(!('Authorization' in calls[0][1].headers));
  assert.equal(T.stages,'cra_tm_domain_review_stages');
});
test('preview supports known operators and fails open safely for unsupported',()=>{
  assert.equal(compare('Y','EQUALS','Y'),true);
  assert.equal(compare('Y','UNKNOWN','Y'),null);
  const g=emptyGraph();g.conditional=[{id:1,target_type:'QUESTION',target_id:5,action_type:'HIDE',is_enabled:true,condition_logic:'AND'}];
  g.conditions=[{id:1,conditional_rule_id:1,source_type:'QUESTION',source_id:3,condition_operator:'EQUALS',condition_value:{value:'Y'},is_enabled:true}];
  assert.equal(visibilityFor('QUESTION',5,g,{3:'Y'}).hidden,true);
  assert.equal(visibilityFor('QUESTION',5,g,{3:'N'}).hidden,false);
  g.conditions[0].condition_operator='UNKNOWN';
  assert.equal(evaluateRule(g.conditional[0],g.conditions,{3:'Y'}),null);
  assert.equal(visibilityFor('QUESTION',5,g,{3:'Y'}).unknown,true);
});
