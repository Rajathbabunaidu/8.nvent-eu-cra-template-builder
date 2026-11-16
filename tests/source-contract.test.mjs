import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const vue=readFileSync(new URL('../src/wwElement.vue',import.meta.url),'utf8');const sql=readFileSync(new URL('../sql/01_draft_deletion_rpc_v1_1.sql',import.meta.url),'utf8');
test('draft deletion UI covers four requested hierarchy levels',()=>{for(const kind of ['DOMAIN','CONTRIBUTOR','TOOL','STAGE'])assert.ok(vue.includes(`openDelete('${kind}'`));});
test('delete RPC requires draft-only and confirmation',()=>{assert.match(sql,/p_confirm boolean DEFAULT false/);assert.match(sql,/IF v_status IS DISTINCT FROM 'DRAFT'/);assert.match(sql,/REVOKE ALL ON FUNCTION.*FROM anon/);});
test('question UI is inline and rule condition selections are mapped by option IDs',()=>{assert.match(vue,/questionHasOptions/);assert.match(vue,/cra_tm_set_condition_answer_options/);assert.match(vue,/verifyOptions/);});
