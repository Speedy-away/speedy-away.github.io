'use strict';
function apply(file,html){
 if(!/^hosts\//.test(file)||/^hosts\/runtime\//.test(file)||/http-equiv="refresh"/.test(html))return html;
 if(!html.includes('host-taskbar')&&!html.includes('host-tool-taskbar')){
  const parent=file==='hosts/index.html'?'/':/^hosts\/ps[45]\/index\.html$/.test(file)?'/hosts/':file.includes('/ps5/')?'/hosts/ps5/':'/hosts/ps4/';
  html=html.replace(/<body\b([^>]*)>/,(_,attrs)=>'<body'+(attrs.includes('class=')?attrs.replace(/class="([^"]*)"/,'class="$1 host-selector"'):attrs+' class="host-selector"')+'><nav class="host-taskbar" aria-label="Webhost taskbar"><a href="'+parent+'">← Back</a><a class="host-taskbar-brand" href="/hosts/">whatwhatboy webhost</a><a href="/hosts/ps4/">PS4</a><a href="/hosts/ps5/">PS5</a><a href="/">Site home</a></nav>');
 }
 if(!html.includes('/assets/host-webhost.css'))html=html.replace('</head>','<link rel="stylesheet" href="/assets/host-webhost.css?v=2"></head>');
 return require('./site-ads.cjs').applyAds(file,require('./host-download-navigation.cjs').apply(file,html));
}
module.exports={apply};
