const fs=require('node:fs');
const path=require('node:path');
const migrated=platform=>{
 const file=path.join(__dirname,'..','console',platform+'.html');
 return fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('data-console-migration="'+platform+'"');
};
const ps3Migrated=migrated('ps3'),xboxMigrated=migrated('xbox360');
if(ps3Migrated||xboxMigrated){
 if(ps3Migrated)require('./build-ps3-pages.cjs').buildPs3Pages();
 if(xboxMigrated)require('./build-xbox360-pages.cjs').buildXbox360Pages();
 console.log('Rebuilt migrated console pages; legacy redirects preserved.');
}else{
const {page,section,grid,resource,note,steps,video,ext,link,sourceList}=require('./build-console-guides.cjs');
const henFile='https://www.mediafire.com/file/iqohet6whm7bftd/HFW_4.93.1.rar/file';
const evilnat='https://www.psx-place.com/threads/4-93-evilnat-w-cobra-v8-5-cex-pex-d-pex.39743/';
const brew='https://store.brewology.com/homebrew.php?lang=';
const nav=[['/console/ps3.html','PS3 Homebrew'],['/console/ps3/hen.html','HEN 4.93'],['/console/ps3/cfw.html','CFW 4.93']];
const ps3Images=require('../docs/ps3-resource-images.json');
const ps3Expansion=require('./build-ps3-expanded.cjs');
const ps3ToolImages=require('../docs/expansion-ps3.json').toolImages;
page('console/ps3/hen.html','PS3 HEN Guide for 4.93','Install compatible hybrid firmware, set up PS3HEN and enable homebrew on a supported PS3 configuration.','/assets/images/consoles/ps3.png',nav,
section('requirements','HFW first, then HEN',note('<p><strong>HFW 4.93.1 is hybrid firmware, not the HEN installer.</strong> The PS3HEN project lists CEX HFW 4.93.1 as supported. Check the model, installed firmware and project instructions before starting.</p><p>HEN is a separate route from full CFW. Use HEN for supported consoles that cannot install full CFW. Back up saves and use stable power during firmware installation.</p>'))+
section('downloads','Files & homebrew',grid(resource('HFW 4.93.1','The supplied hybrid-firmware archive. Extract the PUP on your computer and compare its checksum with the official release reference before installing.',ext(henFile,'HFW archive'),ps3ToolImages.hfw),resource('PS3HEN installer','Use the official installer and support documentation for your firmware.',ext('https://ps3xploit.me/hen/installer/','HEN installer')+ext('https://github.com/PS3Xploit/PS3HEN','Supported firmware'),ps3ToolImages.hen),resource('Homebrew & multiMAN','Brewology app listings and multiMAN file/game management resources.',ext(brew,'Homebrew apps')+ext('https://store.brewology.com/ahomebrew.php?brewid=24','multiMAN'),ps3ToolImages.homebrew)))+
section('install','HEN installation steps',steps([
['Prepare the console and USB drive','Check Settings &gt; System Settings &gt; System Information. Back up saves. Prepare a FAT32 USB drive; formatting a drive erases its existing files.'],
['Prepare the HFW update file','Extract the supplied archive. Place its validated update PUP at <code>PS3/UPDATE/PS3UPDAT.PUP</code> on the USB drive. Do not copy the RAR archive itself to that path.'],
['Install hybrid firmware from storage','Insert the USB drive and choose Settings &gt; System Update &gt; Update via Storage Media. Confirm the displayed update is the intended HFW release. If it is not detected or a same-version install is refused, follow the release’s recovery-mode instructions.'],
['Open the official HEN installer','After the firmware installation finishes, open the PS3 Internet Browser and visit the HEN installer linked above. Turn off Confirm Browser Close in the browser Tools settings as directed by the installer.'],
['Initialize and install HEN','Choose Initialize HEN installer, then Install HEN when initialization succeeds. Let the installer complete and follow its reboot prompt. Use the official alternate installer instructions if this route fails.'],
['Enable HEN after starting the console','Use Enable HEN under Game on the XMB. Wait for its success notification before launching homebrew. Install compatible PKG apps through the available Package Manager.'],
['Keep firmware and HEN matched','Check the project release notes before updating either. The system version display alone does not prove that HFW and HEN installed correctly.']
])+sourceList([['https://ps3xploit.me/hen/installer/','Official HEN installer and browser requirement'],['https://github.com/PS3Xploit/PS3HEN','HEN firmware support'],['https://psx-place.com/threads/guide-to-installing-ps3-firmware-and-link-repo.32933/','PS3 firmware USB installation reference']]))+
section('video','Supplied HEN video',video('IlvWCdap5qk','Install HEN on PS3 firmware 4.93')+note('<p>No transcript was available for this video. The written guide uses the project documentation and firmware-installation reference linked above.</p>')),'#install','Read HEN steps');

page('console/ps3/cfw.html','PS3 4.93 CFW Guide','Check CFW eligibility, back up and validate flash memory, then use the matching Evilnat 4.93 release.','/assets/images/consoles/ps3.png',nav,
section('compatibility','Confirm CFW eligibility first',note('<p><strong>CFW is not supported on every PS3.</strong> Check the exact model and the PS3 Toolset compatibility report. Do not install a CFW PUP on an incompatible console; use the supported HEN route instead.</p><p>Flash operations can leave a console unable to boot. Keep an untouched flash backup and stop if a check fails. The exact procedure depends on model, flash type and whether CFW is already installed.</p>'))+
section('downloads','Tools & firmware',grid(
resource('PS3Xploit','Entry point for PS3 exploit tools and project instructions.',ext('http://ps3xploit.me/','PS3Xploit site'),ps3ToolImages.ps3xploit),
resource('PS3 Toolset','Inspect the console, check compatibility and follow the tool’s flash-backup and patch instructions.',ext('https://www.ps3toolset.com/','Open Toolset'),ps3ToolImages.toolset),
resource('Rufus','USB preparation tool. Choose the partition and filesystem settings required by the PS3 firmware guide; formatting erases the selected drive.',ext('https://rufus.ie/en_US/','Rufus'),ps3ToolImages.rufus),
resource('PyPS3checker / PyPS3tools','Tools for checking PS3 flash-memory dumps. Select the checker matching the dump type and read its documentation.',ext('https://github.com/littlebalup/PyPS3tools','PyPS3tools'),ps3ToolImages.pyps3tools),
resource('Evilnat 4.93 CFW','Current developer release page for the CEX/PEX/D-PEX builds. Choose the correct build for the console and existing configuration.',ext(evilnat,'Evilnat release'),ps3ToolImages.evilnat)
))+
section('install','CFW installation workflow',steps([
['Identify the starting state','Record the console model and firmware. If it already runs CFW, use Evilnat’s update instructions rather than repeating a retail-console flash-patching procedure.'],
['Read the Toolset report','Open the official Toolset in the PS3 browser and let the system inspection finish. Continue only when your specific console is reported CFW-compatible.'],
['Back up flash memory','Use the tool’s backup function and copy the untouched dump to your computer and a second storage location. Preserve it before any patch is applied.'],
['Validate the dump','Use the matching PyPS3tools checker and review its report alongside the Toolset results. Resolve every failure before proceeding; a backup with errors is not a reliable recovery copy.'],
['Follow the supported patch procedure','For a compatible retail system, follow the Toolset’s documented flash-patching sequence exactly. Keep power stable and wait for explicit completion. Do not improvise offsets, flash files or recovery actions.'],
['Prepare the correct Evilnat PUP','Download the matching 4.93 build from the developer’s release page and verify its published checksum. Put the validated file on FAT32 USB storage as <code>PS3/UPDATE/PS3UPDAT.PUP</code>.'],
['Install and verify','Follow the developer’s reboot/update sequence, using Update via Storage Media or the stated recovery method. After completion, check the installed CFW version and confirm Package Manager and homebrew work.']
])+sourceList([['https://www.ps3toolset.com/','PS3 Toolset'],['https://github.com/littlebalup/PyPS3tools','Flash dump validation tools'],[evilnat,'Evilnat developer release and supported builds']]))+
section('video','Supplied CFW video',video('LIVu3Px3eXY','PS3 4.93 jailbreak / CFW guide')+note('<p>No transcript was available for this video. This written workflow does not replace the model-specific instructions and validation shown by the official tools.</p>')),'#compatibility','Check compatibility');

const xboxContent=require('./build-xbox360-expanded.cjs').baseSections();
const ps3Content=section('setup493','PS3 4.93 · HEN & CFW guides',grid(
resource('HEN on HFW 4.93.1','Hybrid firmware, the official HEN installer and homebrew setup steps.',link('/console/ps3/hen.html','Read HEN guide'),ps3Images.hen.image),
resource('Evilnat 4.93 CFW','Model compatibility, flash-dump checks and a firmware installation workflow.',link('/console/ps3/cfw.html','Read CFW guide'),ps3Images.cfw.image)
))+
ps3Expansion.directoriesSection()+ps3Expansion.homebrewSection();
for(const [file,marker,content] of [['console/xbox360.html','        <!-- JTAG/RGH Section -->',xboxContent],['console/ps3.html','        <!-- Custom Firmware Section -->',ps3Content+require('./apollo-tools.cjs').section('ps3')]]){
 let h=fs.readFileSync(file,'utf8');
 const start='<!-- BEGIN UPDATED CONSOLE RESOURCES -->',end='<!-- END UPDATED CONSOLE RESOURCES -->';
 if(h.includes(start)){const a=h.indexOf(start),b=h.indexOf(end,a)+end.length;h=h.slice(0,a)+h.slice(b);}
 if(!h.includes('/assets/console-guides.css'))h=h.replace('</head>','<link rel="stylesheet" href="/assets/console-guides.css?v=1">\n</head>');
 if(!h.includes(marker))throw Error('Missing insert point in '+file);
 h=h.replace(marker,start+'\n'+content+'\n'+end+'\n'+marker);
 if(file.endsWith('ps3.html'))h=h.replace('PS3 HEN v3.3.0','PS3HEN for HFW 4.93.1');
 if(file.endsWith('xbox360.html'))h=require('./build-xbox360-expanded.cjs').transform(h);
 fs.writeFileSync(file,h);
}
console.log('Added Xbox 360 softmod resources, PS3 HEN/CFW guides and both game-library sections.');
}
