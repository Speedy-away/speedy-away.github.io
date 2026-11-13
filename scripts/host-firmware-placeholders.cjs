'use strict';
// Display-only firmware choices. Native loader tables remain authoritative.
const versions=Object.freeze({ps4:Object.freeze([]),ps5:Object.freeze(['14.00','14.10','14.20'])});
function apply(html,name){
 const platform=name.match(/^hosts\/(ps[45])\//)?.[1];
 if(!platform||!html.includes('id="host-firmware-buttons"'))return html;
 html=html.replace(/(<script\b[^>]*\bid=["']host-actions-data["'][^>]*>)([\s\S]*?)(<\/script>)/i,(_,open,json,close)=>{
  const catalog=JSON.parse(json);if(catalog.platform!==platform)return open+json+close;
  catalog.placeholderFirmwares=versions[platform];return open+JSON.stringify(catalog).replaceAll('<','\\u003c')+close;
 });
 return html.replace(/(<div\b[^>]*\bid="host-firmware-buttons"[^>]*>)([\s\S]*?)(<\/div>)/,(_,open,buttons,close)=>{
  const choices=new Map();
  const buttonPattern=/<button\b[^>]*\bdata-host-firmware="(\d+\.\d{2})"[^>]*>[\s\S]*?<\/button>/g;
  buttons=buttons.replace(buttonPattern,(button,version)=>{
   choices.set(version,button);
   return '';
  });
  for(const version of versions[platform]){
   if(!choices.has(version))choices.set(version,'<button type="button" data-host-firmware="'+version+'" aria-pressed="false" translate="no">'+version+'</button>');
  }
  return open+[...choices].sort(([a],[b])=>Number(b)-Number(a)).map(([,button])=>button).join('')+buttons+close;
 });
}
module.exports={versions,apply};
