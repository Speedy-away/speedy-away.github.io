'use strict';
function isAllowed(value){try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)return false;return /^https:\/\/github\.com\/Speedy-away\/(?:WWB-HOST|wwb-host|speedy-away\.github\.io)\/releases\/download\/sender-[a-zA-Z0-9.+-]+\/console-payload-sender-[a-zA-Z0-9.+-]+\.zip$/.test(u.href)||/^https:\/\/raw\.githubusercontent\.com\/Speedy-away\/whatsite\/[a-f0-9]{40}\/downloads\/helpers\/console-payload-sender\/console-payload-sender-[a-zA-Z0-9.+-]+\.zip$/.test(u.href);}catch{return false;}}
module.exports={isAllowed};
