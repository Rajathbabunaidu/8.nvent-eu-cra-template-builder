/** Pure authoring helpers: the Supabase question-type rows are authoritative. */
export function typeMeta(questionTypes=[],typeCode='') {
  return questionTypes.find(t=>t.type_code===typeCode)||null;
}
export function isChoice(questionTypes=[],typeCode='') {
  return typeMeta(questionTypes,typeCode)?.supports_options===true;
}
export function isMany(questionTypes=[],typeCode='') {
  return typeMeta(questionTypes,typeCode)?.supports_multiple_values===true;
}
export function optionSeed(typeCode='') {
  if(typeCode==='YES_NO')return [
    {option_value:'YES',option_label:'Yes',option_hint:'',is_enabled:true,is_default:false},
    {option_value:'NO',option_label:'No',option_hint:'',is_enabled:true,is_default:false},
  ];
  return [];
}
export function verifyOptions(rows=[],typeCode='',many=false) {
  const visible=rows.filter(r=>r.is_enabled!==false);
  if(typeCode==='YES_NO'){
    const values=visible.map(x=>String(x.option_value||'').trim().toUpperCase());
    if(values.length!==2||!values.includes('YES')||!values.includes('NO'))throw new Error('Yes/No must contain enabled YES and NO options.');
  } else if(!visible.length)throw new Error('Add at least one enabled answer option before saving this choice question.');
  const seen=new Set();let defaults=0;
  for(const row of rows){
    const value=String(row.option_value??'').trim();
    const label=String(row.option_label??'').trim();
    if(!value||!label)throw new Error('Every answer option needs a value and a label. Remove incomplete rows or complete them.');
    if(seen.has(value))throw new Error(`Duplicate answer option value: ${value}`);
    seen.add(value);
    if(row.is_default){defaults++;if(row.is_enabled===false)throw new Error('A disabled answer option cannot be the default.');}
  }
  if(!many&&defaults>1)throw new Error('Single-choice questions can have only one default.');
  return true;
}
export function conditionOperators(typeCode) {
  const choices=['YES_NO','SINGLE_CHOICE','DROPDOWN'];
  if(choices.includes(typeCode))return ['EQUALS','NOT_EQUALS','CONTAINS_ANY'];
  if(typeCode==='MULTIPLE_CHOICE')return ['EQUALS','NOT_EQUALS','CONTAINS_ANY','CONTAINS_ALL','NOT_CONTAINS'];
  if(['TEXT','LONG_TEXT','EMAIL','URL'].includes(typeCode))return ['EQUALS','NOT_EQUALS','CONTAINS','NOT_CONTAINS','IS_EMPTY','IS_NOT_EMPTY'];
  if(['NUMBER','RATING'].includes(typeCode))return ['EQUALS','NOT_EQUALS','GREATER_THAN','GREATER_THAN_OR_EQUAL','LESS_THAN','LESS_THAN_OR_EQUAL','IS_EMPTY','IS_NOT_EMPTY'];
  if(['DATE','DATETIME'].includes(typeCode))return ['EQUALS','NOT_EQUALS','BEFORE','AFTER','IS_EMPTY','IS_NOT_EMPTY'];
  if(typeCode==='FILE')return ['IS_EMPTY','IS_NOT_EMPTY'];
  return ['EQUALS','NOT_EQUALS','IS_EMPTY','IS_NOT_EMPTY'];
}
export function conditionInputValue(typeCode,operator,input) {
  if(['IS_EMPTY','IS_NOT_EMPTY'].includes(operator))return {};
  const raw=String(input??'').trim();
  if(!raw)throw new Error('Enter a comparison value.');
  if(['NUMBER','RATING'].includes(typeCode)){
    const n=Number(raw);if(!Number.isFinite(n))throw new Error('Comparison value must be numeric.');return {value:n};
  }
  return {value:raw};
}
