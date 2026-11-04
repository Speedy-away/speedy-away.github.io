'use strict';
// Advertising belongs to authored browsing pages, never native execution documents.
const HEAD='https://accountut.com/1/5f0b4b1c14e59aac1d8c0da4350e58b2';
const NATIVE='https://bellnewyork.org/21/62821bf166fc6aeab021ec0455a62244';
const CONTAINER='container-62821bf166fc6aeab021ec0455a62244';
function eligible(file,html){return /^(?:index\.html|hosts\/(?!runtime\/).+\.html)$/.test(String(file).replaceAll('\\','/'))&&!/<meta\b[^>]*http-equiv=["']refresh/i.test(html);}
function strip(html){return html.replace(/<!-- BEGIN SITE AD -->[\s\S]*?<!-- END SITE AD -->/g,'').replace(/<!-- BEGIN WWB HOST AD -->[\s\S]*?<!-- END WWB HOST AD -->/g,'').replace(/<script\b[^>]*src=["'][^"']*(?:site-ads\.js|bellnewyork\.org\/21\/62821bf166fc6aeab021ec0455a62244|accountut\.com\/1\/5f0b4b1c14e59aac1d8c0da4350e58b2)[^"']*["'][^>]*>\s*<\/script>/gi,'').replace(/<div\b[^>]*id=["']container-62821bf166fc6aeab021ec0455a62244["'][^>]*>\s*<\/div>/gi,'');}
function apply(file,html,options={}){
 if(!eligible(file,html))return html;
 html=strip(html);
 const head='<script data-cfasync="false" src="'+HEAD+'"></script>';
 const banner='<!-- BEGIN WWB HOST AD --><aside class="wwb-host-ad" aria-label="Advertisement"><span>Advertisement</span><script async="async" data-cfasync="false" src="'+NATIVE+'"></script><div id="'+CONTAINER+'"></div></aside><!-- END WWB HOST AD -->';
 const base=String(options.base||'').replace(/\/$/,'');if(base&&!/^\/[A-Za-z0-9_-]+$/.test(base))throw Error('Invalid host project base');
 if(!html.includes('host-ads.css'))html=html.replace(/<\/head>/i,'<link rel="stylesheet" href="'+base+'/assets/host-ads.css?v=1"></head>');
 html=html.replace(/<\/head>/i,head+'</head>');
 return /<\/main>/i.test(html)?html.replace(/<\/main>/i,'</main>'+banner):html.replace(/<\/body>/i,banner+'</body>');
}
module.exports={HEAD,NATIVE,CONTAINER,eligible,strip,apply};
