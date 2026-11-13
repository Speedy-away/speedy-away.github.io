'use strict';
// Main-site catalogue overlay: existing native transports and files stay unchanged.
const data=require('../docs/host-main-site-mods.json');
function apply(rows,platform){if(platform!=='ps4')return rows;const ids=new Set(rows.map(a=>a.id));return rows.map(a=>({...a,...data.overrides[a.id]})).concat(data.actions.filter(a=>!ids.has(a.id)));}
module.exports={apply};
