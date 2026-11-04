'use strict';
// Exact membership table for hosted paths, without repeating each directory twice.
const assert=require('node:assert/strict');
function compact(hosted,mapping,base,main){
 const groups=Object.create(null);
 for(const name of hosted){assert.ok(!/[\r\n]/.test(name),'Unsupported path separator');const cut=name.lastIndexOf('/'),dir='/'+name.slice(0,cut+1),leaf=name.slice(cut+1);(groups[dir]||(groups[dir]=[])).push(leaf);}
 const directories=Object.create(null);
 for(const [dir,names]of Object.entries(groups))directories[dir]='\n'+names.sort().join('\n')+'\n';
 return {base,main,aliases:{...mapping},directories};
}
module.exports={compact};
