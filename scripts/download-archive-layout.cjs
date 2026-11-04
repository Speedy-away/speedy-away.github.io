const path=require('node:path');
const safeName=value=>{let name=String(value||'Unsorted').replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').replace(/[. ]+$/,'').trim().slice(0,120)||'Unsorted';return /^(?:CON|PRN|AUX|NUL|COM\d|LPT\d)(?:\.|$)/i.test(name)?'_'+name:name;};
function projectName(item){
 let repo;try{const u=new URL(item.url);if(u.hostname==='github.com')repo=u.pathname.split('/')[2];}catch{}
 if(repo){const names={'apollo-ps3':'Apollo Save Tool','apollo-ps4':'Apollo Save Tool','apollo-vita':'Apollo Save Tool','ps5upload':'PS5upload','ps5-y2jb-installer':'Y2JB Installer','ps5-y2jb-autoloader':'Y2JB Autoloader','orbit-store-ps5':'Orbit Store','PS4-RDR2-Havana-Mod-Menu-Releases':'Havana','GoldHEN_Plugins_Repository':'GoldHEN Plugins','Xbox360PeerPressure':'Peer Pressure','srgh-matrix-trinity':'Matrix RGH Hardware'};return names[repo]||repo.replaceAll('_',' ').replaceAll('-',' ');}
 return String(item.project||item.title||'Unsorted').replace(/\s+(?:source code|sources)$/i,'').replace(/\s*[·|]\s*(?:PS3|PS4|PS5|PS Vita|GTA V.*)$/i,'').replace(/\s+\(?v?\d+(?:\.\d+)+(?:[^ ]*)?\)?(?:\s+Windows(?: x64)?)?$/i,'').replace(/^Apollo Save Tool.*$/i,'Apollo Save Tool');
}
function resourceLocation(item,file={}){
 const pages=(item.pages||[]).join(' '),url=item.url||'',title=item.title||'',name=file.name||file.filename||'';
 if(item.platform&&item.category)return [item.platform,...(Array.isArray(item.category)?item.category:[item.category]),projectName(item)];
 if(/console\/mods\/ps4\/gta5/.test(pages))return ['PS4','Games','GTA5',item.gameVersion||item.group||(/1\.56|156/.test(title+' '+name)?'156':/1\.57|157/.test(title+' '+name)?'157':'Scripts'),projectName(item)];
 if(/console\/mods\/ps4\/call-of-duty/.test(pages))return ['PS4','Games','Call of Duty','Black Ops 3',item.mode||item.group||(/\bZM\b|zombie/i.test(title)?'Zombies':/\bMP\b|Recovery|Synergy/i.test(title)?'Multiplayer':'Shared'),projectName(item)];
 if(/console\/mods\/ps4\/rdr2/.test(pages))return ['PS4','Games','RDR2',projectName(item)];
 if(/apollo-vita|VitaShell/i.test(url)||/console\/psvita/.test(pages))return ['PS Vita','Tools',projectName(item)];
 if(/console\/ps3(?:\.|\/)/.test(pages)||/apollo-ps3/.test(url))return ['PS3','Tools',projectName(item)];
 if(/console\/xbox360|Xbox360PeerPressure|srgh-matrix/i.test(pages+' '+url))return ['Xbox 360','Tools',projectName(item)];
 if(/console\/ps4(?:\/|\.)/.test(pages)||/apollo-ps4/.test(url))return ['PS4',/emulators/.test(pages)?'Emulators':'Tools',projectName(item)];
 if(/console\/ps5(?:\/|\.)/.test(pages))return ['PS5',/emulators/.test(pages)?'Emulators':'Tools',projectName(item)];
 if(/console\/nintendo-switch/.test(pages))return [/\.rpx$|\.wuhb$|wiiu/i.test(name)?'Wii U':'Nintendo Switch','Tools',projectName(item)];
 if(/console\/steamdeck/.test(pages))return ['Steam Deck','Tools',projectName(item)];
 if(/console\/retro/.test(pages))return ['Retro Consoles','Tools',projectName(item)];
 if(/(?:games\/gta|mods\/gta5|scooby)/.test(pages))return ['PC','Games','GTA5',projectName(item)];
 if(/(?:games\/rdr2|mods\/rdr2)/.test(pages))return ['PC','Games','RDR2',projectName(item)];
 if(/games\/cs2/.test(pages)||/asphyxia.*cs2|cs2.*source/i.test(title+' '+url))return ['PC','Games','CS2',projectName(item)];
 if(/pc\//.test(pages))return ['PC','Emulators',projectName(item)];
 return ['PC',/mods\//.test(pages)?'Game Mods':'Tools',projectName(item)];
}
function versionFor(item,file){
 if(file.releaseTag)return file.releaseTag;
 try{const version=new URL(file.resolvedUrl||'').pathname.match(/\/releases\/download\/([^/]+)/)?.[1];if(version)return decodeURIComponent(version);}catch{}
 if(item.release)return item.release;
 if(item.kind==='github-source'&&file.archivedAt)return file.archivedAt.slice(0,10);
 return 'Unversioned';
}
function roleFor(item,file){
 const name=file.name||file.filename||'';
 const explicitRole=file.archiveRole||item.archiveRole;
 if(explicitRole){
  const allowed=new Set(['Builds','Helpers','Source Code','Metadata','Development','Windows','Linux','macOS','Android','iOS']);
  if(!Array.isArray(explicitRole)||!explicitRole.length||!explicitRole.every(part=>allowed.has(part)))throw Error('Invalid explicit download archive role');
  return explicitRole;
 }
 if(/\.sha\d*|^SHA\d*SUMS|\.zsync$|\.json$|commits\.txt$/i.test(name))return ['Metadata'];
 if(item.kind==='github-source')return ['Source Code'];
 if(/developer|development|_dev\./i.test(name))return ['Development'];
 if(/(?:^|[-_. ])(?:source|src|sdk)(?:[-_. ]|$)/i.test(name))return ['Source Code'];
 const os=/android|\.apk$/i.test(name)?'Android':/ios|\.ipa$/i.test(name)?'iOS':/linux|ubuntu|\.deb$|\.rpm$|\.AppImage(?:\.zsync)?$/i.test(name)?'Linux':/macos|mac-|osx|\.dmg$/i.test(name)?'macOS':/win(?:dows)?|\.exe$|\.msi$/i.test(name)?'Windows':null;
 return os?[resourceLocation(item,file)[0]==='PC'?'Builds':'Helpers',os]:['Builds'];
}
function layoutFor(item,file){
 const location=resourceLocation(item,file),role=roleFor(item,file);
 return [...location,...role,versionFor(item,file)].map(safeName);
}
function destinationForFile(backup,item,file){return path.join(path.resolve(backup),'files',...layoutFor(item,file),safeName(file.name||file.filename));}
module.exports={safeName,projectName,resourceLocation,roleFor,versionFor,layoutFor,destinationForFile};
