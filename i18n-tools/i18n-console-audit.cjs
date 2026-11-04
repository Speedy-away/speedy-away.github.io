// Audit public-page lookup coverage without claiming that every proper name or prose block is translated.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {norm} = require('./i18n-extract.js');
const root = path.resolve(__dirname, '..');
const skip = new Set(['.git','.agents','.codex','.claude','.playwright','.playwright-cli','node_modules','assets','docs','downloads','languages','i18n-tools','design-references','backup','api','css2','css2-1']);
const skipTags = new Set(['script','style','code','pre','textarea','noscript','svg','canvas']);
const voidTags = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
function files(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory()
    ? skip.has(entry.name) ? [] : files(path.join(dir,entry.name))
    : entry.name.endsWith('.html') ? [path.join(dir,entry.name)] : []);
}
function candidates(html) {
  const found = new Set(), stack = [];
  const add = text => {
    const value = norm(text);
    if (value.length > 1 && /[A-Za-z]/.test(value) && !/^(?:https?:\/\/|[/#])/.test(value)) found.add(value);
  };
  const tokens = html.replace(/<!--[\s\S]*?-->/g,'').match(/<[^>]*>|[^<]+/g) || [];
  for (const token of tokens) {
    const closing = /^<\/([\w:-]+)/.exec(token);
    if (closing) {
      const index = stack.map(node=>node.tag).lastIndexOf(closing[1].toLowerCase());
      if (index >= 0) stack.splice(index);
      continue;
    }
    const opening = /^<([\w:-]+)\b/.exec(token);
    if (opening) {
      const tag = opening[1].toLowerCase();
      const hidden = stack.some(node=>node.skip) || skipTags.has(tag) || /\bdata-i18n-skip(?:\s|=|>)/i.test(token) || /\btranslate=["']no["']/i.test(token) || /\bclass=["'][^"']*\bnotranslate\b/.test(token);
      if (!hidden) {
        for (const attr of token.matchAll(/\b(?:placeholder|title|alt|aria-label|aria-description|aria-valuetext|data-tooltip)=["']([^"']*)["']/gi)) add(attr[1]);
        if (tag === 'meta' && /\bname=["']description["']/i.test(token)) add(token.match(/\bcontent=["']([^"']*)["']/i)?.[1] || '');
      }
      if (!voidTags.has(tag) && !/\/>$/.test(token)) stack.push({tag,skip:hidden});
      continue;
    }
    if (!token.startsWith('<') && !stack.some(node=>node.skip)) add(token);
  }
  return found;
}
function dictionary(code) {
  const sandbox={window:{}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'languages',code+'.js'),'utf8'),sandbox);
  const entry = sandbox.window.__scoobyI18nQueue?.find(item=>item[0]===code);
  if (!entry) throw Error('Dictionary did not register: '+code);
  return entry[1];
}
// Evaluate the runtime's actual pure lookup functions, avoiding a divergent second template matcher.
const runtime=fs.readFileSync(path.join(root,'languages/i18n.js'),'utf8');
const start=runtime.indexOf('  var norm = '), end=runtime.indexOf('  function translateText(',start);
if (start<0 || end<0) throw Error('Runtime lookup functions moved; update this audit extraction.');
const runtimeSandbox={current:'en',DEFAULT_LANG:'en'};
vm.runInNewContext('var templateCache = new WeakMap();\n'+runtime.slice(start,end)+'\nthis.lookup=lookup;',runtimeSandbox);
const lookup=runtimeSandbox.lookup;
const publicFiles=require('../scripts/site-public-pages.cjs').pages();
const pages=[];
const all=new Map();
for(const file of publicFiles) {
  const html=fs.readFileSync(file,'utf8');
  const name=path.relative(root,file).replaceAll('\\','/');
  if (/whatsite-ps[45]\.html$/.test(name) || /<meta[^>]+name="robots"[^>]+content="[^"]*noindex/i.test(html) || /http-equiv="refresh"/i.test(html)) continue;
  const strings=candidates(html);
  pages.push({path:name,candidates:strings,loader:/<script\b[^>]*src="[^"]*\/languages\/i18n\.js(?:\?[^" ]*)?"/.test(html)});
  for(const text of strings) {if(!all.has(text))all.set(text,[]);all.get(text).push(name);}
}
const codes=fs.readdirSync(path.join(root,'languages')).filter(name=>/^[a-z]{2}\.js$/.test(name)).map(name=>name.slice(0,2)).sort();
const pack=require('./console-translations.cjs');
const reference=dictionary(codes[0]);
const rows=codes.map(code=>{
  runtimeSandbox.current=code;
  const table=dictionary(code), keys=Object.keys(table);
  const missingPack=Object.keys(pack).filter(key=>!table[key]);
  const invalidTokens=keys.filter(key=>(key.match(/\{\w+\}/g)||[]).sort().join(',')!==(table[key].match(/\{\w+\}/g)||[]).sort().join(','));
  const missingReference=Object.keys(reference).filter(key=>!Object.hasOwn(table,key));
  if(missingPack.length||invalidTokens.length||missingReference.length||keys.length!==Object.keys(reference).length) throw Error('Dictionary validation failed: '+code);
  const matched=[...all.keys()].filter(text=>lookup(text,table)!==undefined);
  return {code,keys:keys.length,templateKeys:keys.filter(key=>/\{\w+\}/.test(key)).length,packKeys:Object.keys(pack).length,lookupMatchedCandidates:matched.length,unmatchedCandidates:all.size-matched.length};
});
const missing=[...all.entries()].filter(([text])=>lookup(text,reference)===undefined).map(([text,paths])=>({text,occurrences:paths.length,pages:paths})).sort((a,b)=>b.occurrences-a.occurrences||a.text.localeCompare(b.text));
const protectedNames=new Set(['Discord','YouTube','Telegram','Instagram','Twitter','TikTok','whatwhatboy',"whatwhatboy’s","whatwhatboy's",'PC','PS3','PS4','PS5','PlayStation 3','PlayStation 4','PlayStation 5','PS Vita','Xbox 360','Nintendo Switch','Steam Deck','Call of Duty','GoldHEN','etaHEN','webMAN','CCAPI','Artemis','multiMAN','PSNinja','JSON','PKG','FPKG','SPRX','PRX','ELF','RAR','ZIP','SHA-256','BLES / BLUS','BLES / BLUS / NPUB / NPEB','Windows','Linux','macOS','FTP','USB','ESP','GameCube','Wii']);
const keepUntranslated=text=>protectedNames.has(text)||/^[\w.() -]+\.(?:pkg|fpkg|bin|elf|prx|sprx|zip|rar|7z|iso|json|vpk|pup|jar|csc|gsc|lua|txt|ini)$/i.test(text);
const report={
  scope:'Public HTML text nodes and translatable attributes; code, scripts, archives, standalone console helpers, redirects and explicit translation opt-outs excluded.',
  limitation:'Lookup matches are not a complete linguistic translation percentage. Unmatched candidates include proper names, technical metadata and full English prose. New content needs translated source keys. Dynamic JavaScript-only strings are validated by the source pack and runtime tests, not this HTML scan.',
  publicPages:pages.length,uniqueCandidates:all.size,
  missingLoaders:pages.filter(page=>!page.loader).map(page=>page.path),
  languages:rows,
  recognizedProtectedCandidates:missing.filter(item=>keepUntranslated(item.text)).length,
  highestUseUnmatchedCandidates:missing.filter(item=>!keepUntranslated(item.text)).slice(0,100),
  consolePages:pages.filter(page=>/^(?:console\/(?:ps[345]|psvita)|hosts\/)/.test(page.path)).map(page=>({path:page.path,candidates:page.candidates.size,lookupMatches:[...page.candidates].filter(text=>lookup(text,reference)!==undefined).length}))
};
if(process.argv.includes('--write')) fs.writeFileSync(path.join(root,'docs/language-coverage.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({publicPages:report.publicPages,uniqueCandidates:all.size,missingLoaders:report.missingLoaders,languages:rows.length,keysPerLanguage:rows[0].keys,templatesPerLanguage:rows[0].templateKeys,packKeys:rows[0].packKeys,lookupMatches:rows[0].lookupMatchedCandidates,unmatched:rows[0].unmatchedCandidates,recognizedProtectedCandidates:report.recognizedProtectedCandidates,topUnmatched:report.highestUseUnmatchedCandidates.slice(0,8).map(item=>({text:item.text,occurrences:item.occurrences}))},null,2));
