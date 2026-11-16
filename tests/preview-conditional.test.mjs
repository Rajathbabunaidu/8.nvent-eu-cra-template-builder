import test from 'node:test';import assert from 'node:assert/strict';
import {visibilityFor,emptyGraph,compare} from '../src/logic.mjs';
const make=(action,optionValue='YES')=>{
 const g=emptyGraph();g.conditional=[{id:1,target_type:'QUESTION',target_id:5,action_type:action,condition_logic:'AND',is_enabled:true}];
 g.conditions=[{id:10,conditional_rule_id:1,source_type:'QUESTION',source_id:2,condition_operator:'EQUALS',is_enabled:true,condition_value:{}}];
 g.conditionOptions=[{condition_id:10,answer_option_id:20}];g.options=[{id:20,question_id:2,option_value:optionValue}];return g;
};
test('SHOW hides when mapped answer is not selected and shows when selected',()=>{const g=make('SHOW');assert.equal(visibilityFor('QUESTION',5,g,{2:'NO'}).hidden,true);assert.equal(visibilityFor('QUESTION',5,g,{2:'YES'}).hidden,false);});
test('HIDE applies only on condition match',()=>{const g=make('HIDE');assert.equal(visibilityFor('QUESTION',5,g,{2:'NO'}).hidden,false);assert.equal(visibilityFor('QUESTION',5,g,{2:'YES'}).hidden,true);});
test('array selection and numeric comparisons',()=>{assert.equal(compare(['A','B'],'CONTAINS_ALL',['A','B']),true);assert.equal(compare(['A'],'CONTAINS_ALL',['A','B']),false);assert.equal(compare(3,'GREATER_THAN',2),true);});
