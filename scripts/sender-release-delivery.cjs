'use strict';
const fs=require('node:fs'),path=require('node:path');
const MAX_GIT_BYTES=95*1024*1024;
function releaseInfo(info){const version=info.version.split('+')[0],snapshot=info.snapshot.slice(0,12);if(!/^[0-9.]+$/.test(version)||!/^[a-f0-9]{12}$/.test(snapshot)||!/^console-payload-sender-[a-zA-Z0-9.+-]+\.zip$/.test(info.name))throw Error('Invalid immutable sender identity');const tag='sender-'+version+'-'+snapshot;return {releaseTag:tag,publicDownloadURL:'https://github.com/Speedy-away/WWB-HOST/releases/download/'+tag+'/'+info.name};}
function markLocalOnly(info,root){if(info.bytes<MAX_GIT_BYTES)return;const name='/downloads/helpers/console-payload-sender/'+info.name,file=path.join(root,'.gitignore'),before=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';if(!before.split(/\r?\n/).includes(name))fs.appendFileSync(file,'\n# Sender ZIP retained locally and in F:; public download is a release asset.\n'+name+'\n');}
module.exports={MAX_GIT_BYTES,releaseInfo,markLocalOnly};
