// Add canonical URLs only for existing, indexable pages. Preserve every current sitemap entry.
const fs=require('node:fs'),path=require('node:path');
const scope=require('./site-public-pages.cjs');
function sync(write=false){
  const target=path.join(scope.root,'sitemap.xml'),before=fs.readFileSync(target,'utf8');
  let after=before;const added=[];
  for(const file of scope.pages()){
    const html=fs.readFileSync(file,'utf8');
    if(/<meta\b[^>]*http-equiv=["']refresh["']/i.test(html))continue;
    const robots=[...html.matchAll(/<meta\b[^>]*>/gi)].map(match=>match[0]).filter(tag=>/name=["']robots["']/i.test(tag));
    if(robots.some(tag=>/content=["'][^"']*\bnoindex\b/i.test(tag)))continue;
    const tag=[...html.matchAll(/<link\b[^>]*>/gi)].map(match=>match[0]).find(tag=>/rel=["']canonical["']/i.test(tag));
    const href=tag?.match(/href=["']([^"']+)["']/i)?.[1];if(!href)continue;
    const url=new URL(href);if(url.origin!=='https://whatwhatboy.com'||url.search||url.hash)continue;
    if(!after.includes('<loc>'+url.href+'</loc>')){
      after=after.replace('</urlset>','  <url><loc>'+url.href+'</loc></url>\n</urlset>');added.push(url.href);
    }
  }
  if(write&&after!==before)fs.writeFileSync(target,after);
  return {mode:write?'write':'check',added};
}
if(require.main===module){const result=sync(process.argv.includes('--write'));console.log(JSON.stringify(result,null,2));if(result.mode==='check'&&result.added.length)process.exitCode=1;}
module.exports={sync};
