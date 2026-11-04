// Reconcile against real, canonical, indexable pages. Runtime/download HTML is excluded.
const fs=require('node:fs'),path=require('node:path'),scope=require('./site-public-pages.cjs');
function refresh(write=false){
 const target=path.join(scope.root,'sitemap.xml'),before=fs.readFileSync(target,'utf8');
 const old=[...before.matchAll(/<url>\s*([\s\S]*?)<\/url>/g)].map(m=>({xml:m[0],url:m[1].match(/<loc>([^<]+)<\/loc>/)?.[1]}));
 const expected=new Set();
 for(const file of scope.pages()){const html=fs.readFileSync(file,'utf8');if(/http-equiv=["']refresh["']/i.test(html)||/<meta[^>]*name=["']robots["'][^>]*content=["'][^"']*\bnoindex\b/i.test(html))continue;
  const url=html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i)?.[1];if(!url)throw Error('Missing canonical: '+file);
  const parsed=new URL(url);if(parsed.origin!=='https://whatwhatboy.com'||parsed.search||parsed.hash)throw Error('Invalid canonical: '+file);expected.add(url);
 }
 const added=[...expected].filter(url=>!old.some(x=>x.url===url));const removed=old.filter(x=>!expected.has(x.url)).map(x=>x.url);const seen=new Set();let duplicates=0;
 const rows=[];for(const entry of old){if(!expected.has(entry.url))continue;if(seen.has(entry.url)){duplicates++;continue;}seen.add(entry.url);rows.push(entry.xml);}
 for(const url of added)rows.push('<url><loc>'+url+'</loc><lastmod>2026-11-02</lastmod></url>');
 const after=before.slice(0,before.indexOf('<url>')).trimEnd()+'\n'+rows.map(x=>'  '+x).join('\n')+'\n</urlset>\n';
 if(write&&after!==before){if(fs.readFileSync(target,'utf8')!==before)throw Error('Concurrent sitemap edit');fs.writeFileSync(target,after);}
 const report={mode:write?'write':'check',canonicalURLs:expected.size,previousEntries:old.length,added,removed,duplicatesRemoved:duplicates,changed:after!==before};
 if(write)fs.writeFileSync(path.join(scope.root,'docs/qa/all-pages-sitemap-refresh.json'),JSON.stringify(report,null,2)+'\n');return report;
}
if(require.main===module)console.log(JSON.stringify(refresh(process.argv.includes('--write')),null,2));
module.exports={refresh};
