'use strict';
const fs=require('fs'),path=require('path');
function apply(html,name,{root=path.resolve(__dirname,'..')}={}){
 const route=name.match(/^hosts\/(ps[45])\/(files|payload-manager)\/index\.html$/);if(!route)return html;
 const platform=route[1],files=route[2]==='files',label=files?'File manager':'Payload manager',consoleName=platform.toUpperCase(),base='/hosts/'+platform+'/';
 if(!/<body\b[^>]*class="[^"]*\bhost-workspace-page\b/.test(html)){
  const main=html.indexOf('<main class="main-content"'),body=html.match(/<body\b[^>]*>/);if(main<0||!body)throw Error('Workspace shell boundary changed: '+name);
  const hub=fs.readFileSync(path.join(root,base.slice(1),'index.html'),'utf8'),nav=hub.match(/<nav\b[^>]*class="host-taskbar"[^>]*>[\s\S]*?<\/nav>/);
  if(!nav)throw Error('Shared host navigation missing');
  const bar=nav[0].replace(/(<a\b[^>]*class="host-top-back"[^>]*href=")[^"]+"/,'$1'+base+'"');
  html=html.slice(0,body.index)+body[0].replace('host-dashboard-page','host-dashboard-page host-workspace-page')+'<a class="skip-link" href="#main-content">Skip to content</a>'+bar+html.slice(main);
  const header='<header class="host-folder-heading host-workspace-heading"><div><p class="host-platform-label">PLAYSTATION '+platform.slice(-1)+'</p><h1>'+label+'</h1><p>'+(files?'Browse and organise files on your console.':'Manage payload files and startup settings.')+'</p></div><img src="/assets/images/host-selector/pepe-banner.png" width="104" height="104" alt="" aria-hidden="true"></header>';
  if(!/<header\b[^>]*class="guide-hero"/.test(html))throw Error('Expected workspace hero');
  html=html.replace(/<header\b[^>]*class="guide-hero"[^>]*>[\s\S]*?<\/header>/,header);
  const links=[['',consoleName+' host'],['?view=payloads','Payloads'],['?view=mods','Mods / Mod Menus'],['files/','File manager'],['payload-manager/','Payload manager'],['downloads/','Downloads']];
  const tabs='<nav class="host-file-tabs host-workspace-tabs" aria-label="'+consoleName+' workspaces"><div class="host-primary-tabs">'+links.map(([url,title])=>'<a href="'+base+url+'"'+(url===route[2]+'/'?' aria-current="page"':'')+'>'+title+'</a>').join('')+'</div></nav>';
  html=html.replace(/<div class="container"><nav class="guide-nav"[\s\S]*?<\/nav><\/div>/,tabs);
  html=html.replace('<h2 id="host-connect-title">Choose firmware. Choose what to run.</h2>','<h2 id="host-connect-title">Console connection</h2>');
  const toolbar=/(<div class="host-toolbar">)(<div class="host-firmware-control">[\s\S]*?)(<form id="host-address-form">[\s\S]*?<\/form>)(<\/div>)/;
  if(!toolbar.test(html))throw Error('Connection controls changed');
  html=html.replace(toolbar,(_,open,firmware,form,close)=>open+form+'<details class="host-workspace-firmware"><summary>Installed firmware</summary>'+firmware+'</details>'+close);
  html=html.replace(/<section class="host-native-workspace">/,'<div class="host-workspace-panels'+(files?' host-workspace-panels-single':'')+'"><section class="host-native-workspace">');
  html=html.replace('<p class="host-dashboard-status" id="host-status"','</div><p class="host-dashboard-status" id="host-status"');
  // The published pages contain a retained catalogue, even when the old status block was removed.
  if(!html.includes('</div><p class="host-dashboard-status" id="host-status"'))html=html.replace(/(\s*<script id="host-actions-data")/,'</div>$1');
 }
 // Append last so regenerated shared styles cannot restore the old green controls.
 html=html.replace(/<link\b[^>]*href="[^"]*host-workspace-pages\.css[^\"]*"[^>]*>/g,'');
 if(platform==='ps5'&&files)html=require('./ps5-web-file-manager.cjs').apply(html);
 return html.replace('</head>','<link rel="stylesheet" href="/assets/host-workspace-pages.css?v=20261113"></head>');
}
module.exports={apply};
