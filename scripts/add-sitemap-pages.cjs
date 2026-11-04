// Add existing canonical pages without replacing any shared sitemap entries.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
function addSitemapPages(files){
 const urls=files.map(file=>{
  const target=path.resolve(root,file),relative=path.relative(root,target);
  if(relative.startsWith('..')||path.isAbsolute(relative))throw Error('Page outside checkout');
  const html=fs.readFileSync(target,'utf8');
  const canonical=html.match(/<link\b[^>]*rel="canonical"[^>]*href="([^"]+)"/i)?.[1];
  if(canonical!=='https://whatwhatboy.com/'+relative.replaceAll('\\','/').replace(/index\.html$/,''))throw Error('Unexpected page canonical: '+file);
  return canonical;
 });
 const sitemap=path.join(root,'sitemap.xml');let xml=fs.readFileSync(sitemap,'utf8');
 const added=[...new Set(urls)].filter(url=>!xml.includes('<loc>'+url+'</loc>'));
 if(added.length){if(!xml.includes('</urlset>'))throw Error('Sitemap closing element missing');xml=xml.replace('</urlset>',added.map(url=>'  <url><loc>'+url+'</loc><lastmod>2026-11-02</lastmod></url>').join('\n')+'\n</urlset>');fs.writeFileSync(sitemap,xml);}
 return added;
}
module.exports={addSitemapPages};
