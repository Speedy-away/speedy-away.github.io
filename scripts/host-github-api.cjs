'use strict';
// Credentials stay in process memory and are never printed, persisted or passed
// in shell arguments. Limit responses to the fields needed for publication.
const {execFileSync}=require('node:child_process');
async function request(repo,route,method='GET',body){
 if(!/^Speedy-away\/(?:WWB-HOST|wwb-host|whatsite|speedy-away\.github\.io)$/.test(repo)||!/^\/(?:pages|actions|releases)(?:\/|$)/.test(route))throw Error('Unapproved publication endpoint');
 const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\nusername=Speedy-away\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe']});
 const token=raw.split('\n').find(x=>x.startsWith('password='))?.slice(9);if(!token)throw Error('GitHub credential unavailable');
 const response=await fetch('https://api.github.com/repos/'+repo+route,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'WWB-HOST-publisher',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(60000)});
 const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={};}if(!response.ok&&!(response.status===404&&method==='GET'))throw Error('GitHub '+method+' '+route+' HTTP '+response.status+': '+String(data.message||'Request failed'));return{status:response.status,data};
}
if(require.main===module)request(process.argv[2],process.argv[3],process.argv[4],process.argv[5]?JSON.parse(process.argv[5]):undefined).then(r=>{const d=r.data;console.log(JSON.stringify({status:r.status,url:d.html_url||d.url,buildType:d.build_type,source:d.source,runs:d.workflow_runs?.slice(0,4).map(x=>({id:x.id,status:x.status,conclusion:x.conclusion,url:x.html_url,head:x.head_sha})),pagesStatus:d.status}));}).catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={request};
