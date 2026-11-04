// Download only original artwork, never software releases or executable files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),dir='assets/images/original-xbox-more';
async function main(){
 fs.mkdirSync(path.join(root,dir),{recursive:true});
 const html=fs.readFileSync(path.join(root,'docs/qa/insignia-game-image-source.html'),'utf8');
 const icons=[...html.matchAll(/<img\b[^>]*src="([^"]+)"[^>]*alt="([^"]+)"[^>]*>/g)].map(m=>({url:m[1],title:m[2].replaceAll('&#039;',"'")}));
 const titles={'Halo 2':'halo-2','Doom 3':'doom-3','Call of Duty 2: Big Red One':'cod2-big-red-one','Forza Motorsport':'forza','Project Gotham Racing 2':'pgr2',"Tom Clancy's Rainbow Six 3":'rainbow-six-3',"Tom Clancy's Splinter Cell: Chaos Theory":'splinter-cell-chaos-theory'};
 const jobs=Object.entries(titles).map(([title,key])=>({key,url:icons.find(x=>x.title===title)?.url,title,source:'https://insignia.live/games',filename:key+'.png'}));
 jobs.push(
  {key:'insignia',url:'https://insignia.live/img/logo.svg',title:'Insignia original service logo',source:'https://insignia.live/',filename:'insignia.svg'},
  {key:'xlink',url:'https://www.teamxlink.co.uk/images/logo.png',title:'XLink Kai original service logo',source:'https://www.teamxlink.co.uk/',filename:'xlink.png'},
  {key:'lithiumx',url:'https://raw.githubusercontent.com/Ryzee119/LithiumX/master/images/dash_main.jpg',title:'LithiumX original dashboard screenshot',source:'https://github.com/Ryzee119/LithiumX',filename:'lithiumx.jpg'},
  {key:'peanut-gb',url:'https://raw.githubusercontent.com/Ryzee119/Peanut-GB/master/screencaps/MEGAMANV.png',title:'Peanut-GB upstream emulator screenshot',source:'https://github.com/Ryzee119/Peanut-GB',filename:'peanut-gb.png'},
  {key:'orbispatches',url:'https://www.orbispatches.com/assets/images/logo.svg',title:'OrbisPatches website logo',source:'https://www.orbispatches.com/',filename:'orbispatches.svg'}
 );
 const records=[],failures=[];
 for(const job of jobs){
  try{if(!job.url)throw Error('Source image not found');const response=await fetch(job.url,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw Error('HTTP '+response.status);const contentType=response.headers.get('content-type')||'';if(!/image\//.test(contentType))throw Error('Not image content: '+contentType);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.length>5000000)throw Error('Image too large');const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),file=path.join(root,dir,job.filename);if(fs.existsSync(file)&&!fs.readFileSync(file).equals(bytes))throw Error('Refusing overwrite of different image');fs.writeFileSync(file,bytes);records.push({...job,path:'/'+dir+'/'+job.filename,bytes:bytes.length,sha256,contentType});}
  catch(error){failures.push({...job,error:error.message});}
 }
 fs.writeFileSync(path.join(root,'docs/console-rest-image-sources.json'),JSON.stringify({checkedAt:new Date().toISOString(),records,failures},null,2)+'\n');
 console.log(JSON.stringify({saved:records.length,failures},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
