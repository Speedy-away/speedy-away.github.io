const allowed=new Set(['rgh','avatar','badupdate','unsigned']);
function requirementsFor(item){
  const values=item.requirementFilters||[item.requirementFilter||(item.id==='balatro360'?'avatar':/^(?:RGH\s*\/\s*JTAG|JTAG\s*\/\s*RGH)/.test(item.runtime)?'rgh':'unsigned')];
  if(!Array.isArray(values)||!values.length||values.some(x=>!allowed.has(x)))throw Error('Invalid requirement filter for '+item.id);
  return [...new Set(values)];
}
module.exports={requirementsFor};
