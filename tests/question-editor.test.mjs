import test from 'node:test';import assert from 'node:assert/strict';
import {isChoice,isMany,optionSeed,verifyOptions,conditionOperators,conditionInputValue} from '../src/question-editor.mjs';
const rows=[{type_code:'MULTIPLE_CHOICE',supports_options:true,supports_multiple_values:true},{type_code:'TEXT',supports_options:false,supports_multiple_values:false}];
test('question type metadata',()=>{assert.equal(isChoice(rows,'MULTIPLE_CHOICE'),true);assert.equal(isMany(rows,'MULTIPLE_CHOICE'),true);assert.equal(isChoice(rows,'TEXT'),false);});
test('yes no defaults and validation',()=>{assert.deepEqual(optionSeed('YES_NO').map(x=>x.option_value),['YES','NO']);assert.equal(verifyOptions(optionSeed('YES_NO'),'YES_NO'),true);assert.throws(()=>verifyOptions([{option_value:'YES',option_label:'Yes'}],'YES_NO'),/YES and NO/);});
test('options guard duplicate/default values',()=>{assert.throws(()=>verifyOptions([{option_value:'A',option_label:'a',is_default:true},{option_value:'B',option_label:'b',is_default:true}],'SINGLE_CHOICE'),/one default/);assert.throws(()=>verifyOptions([{option_value:'A',option_label:'a'},{option_value:'A',option_label:'a'}],'MULTIPLE_CHOICE',true),/Duplicate/);});
test('operator sets match database validator',()=>{assert.ok(conditionOperators('MULTIPLE_CHOICE').includes('CONTAINS_ALL'));assert.ok(!conditionOperators('YES_NO').includes('GREATER_THAN'));});
test('numeric condition parses and validates',()=>{assert.deepEqual(conditionInputValue('NUMBER','EQUALS','3'),{value:3});assert.throws(()=>conditionInputValue('NUMBER','EQUALS','abc'),/numeric/);});
