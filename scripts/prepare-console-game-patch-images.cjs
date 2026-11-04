// Optional artwork capture from official game/store pages. Images only.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),data=require('../docs/ps4-ps5-game-patches.json');
const manifestFile=path.join(root,'docs/ps4-ps5-game-patch-images.json');
const manifest=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{reviewed:'2026-11-02',images:{}};
const steam={
  'RedDeadRedemption2-Orbis.xml':[1174180,'red dead redemption 2'], 'BatmanArkhamKnight-Orbis.xml':[208650,'arkham knight'],
  'DarkSoulsIII-Orbis.xml':[374320,'dark souls iii'], 'SekiroShadowsDieTwice-Orbis.xml':[814380,'sekiro'],
  'TheWitcher3-Orbis.xml':[292030,'witcher 3'], 'GodOfWar-Orbis.xml':[1593500,'god of war'],
  'DyingLight.xml':[239140,'dying light'], 'DyingLight2StayHuman.xml':[534380,'dying light 2'],
  'DeadIsland2-Orbis.xml':[934700,'dead island 2'], 'AssassinsCreedUnity-Orbis.xml':[289650,'unity'],
  'AssassinsCreedSyndicate.xml':[368500,'syndicate'], 'FarCry6-Orbis.xml':[2369390,'far cry 6'],
  'FarCryPrimal.xml':[371660,'far cry primal'], 'CrashBandicootNSaneTrilogy-Orbis.xml':[731490,'n. sane'],
  'MadMax-Orbis.xml':[234140,'mad max'], 'Fallout4-Orbis.xml':[377160,'fallout 4'],
  'JustCause3-Orbis.xml':[225540,'just cause 3'], 'JustCause4-Orbis.xml':[517630,'just cause 4'],
  'ResidentEvil4Remake-Orbis.xml':[2050650,'resident evil 4'], 'RedDeadRedemption-Orbis.xml':[2668510,'red dead redemption'],
  'GrandTheftAutoV-Orbis.xml':[271590,'grand theft auto v'], 'Cyberpunk2077.xml':[1091500,'cyberpunk 2077'],
  'TheEvilWithin-Orbis.xml':[268050,'evil within'], 'Dishonored-Orbis.xml':[205100,'dishonored'],
  'MGS_SnakeEater.xml':[2417610,'snake eater'],
  'HorizonZeroDawn-Orbis.xml':[1151640,'horizon zero dawn'],
  'HorizonForbiddenWest-Orbis.xml':[2420110,'horizon forbidden west'],
  'EldenRing-Orbis.xml':[1245620,'elden ring'],
  'GhostOfTsushimaDC-Orbis.xml':[2215430,'ghost of tsushima'],
  'DaysGone-Orbis.xml':[1259420,'days gone'],
  'MarvelsSpider-Man-Orbis.xml':[1817070,'spider man'],
  'MarvelsSpider-ManMilesMorales-Orbis.xml':[1817190,'miles morales'],
  'FinalFantasyVIIRemake-Orbis.xml':[1462040,'final fantasy vii remake'],
  'FinalFantasyXV-orbis.xml':[637650,'final fantasy xv'],
  'AlienIsolation-Orbis.xml':[214490,'alien isolation'],
  'SleepingDogs-Orbis.xml':[307690,'sleeping dogs'],
  'Persona5Royal-Orbis.xml':[1687950,'persona 5 royal'],
  'Stray-Orbis.xml':[1332010,'stray'],
  'ArmoredCoreVI-Orbis.xml':[1888160,'armored core vi'],
  'DetroitBecomeHuman.xml':[1222140,'detroit become human'],
  'AssassinsCreedIVBlackFlag.xml':[242050,'black flag'],
  'AssassinsCreedRougeRemastered-Orbis.xml':[311560,'rogue'],
  'KenaBridgeofSpirits-Orbis.xml':[1954200,'kena'],
  'Skyrim-Orbis.xml':[489830,'skyrim special edition'],
  'RiseoftheTombRaider-Orbis.xml':[391220,'rise of the tomb raider'],
  'DeusExMankindDivided-Orbis.xml':[337000,'mankind divided'],
  'DragonAgeInquisition-Orbis.xml':[1222690,'inquisition'],
  'Wreckfest-Orbis.xml':[228380,'wreckfest'],
  'LiesOfP-Orbis.xml':[1627720,'lies of p'],
  'SonicFrontiers-Orbis.xml':[1237320,'sonic frontiers']
};
Object.assign(steam, {
  'GodofWarRagnarok-Orbis.xml':[2322010,'god of war ragnarok'],
  'CrisisCoreFinalFantasyVIIReunion-Orbis.xml':[1608070,'crisis core'],
  'ResidentEvilHD-Orbis.xml':[304240,'resident evil'],
  'HogwartsLegacy-Orbis.xml':[990080,'hogwarts legacy'],
  'TheOuterWorlds-Orbis.xml':[578650,'the outer worlds'],
  'DragonsDogmaDarkArisen-Orbis.xml':[367500,'dragon'],
  'LifeisStrange3-TrueColors-Orbis.xml':[936790,'true colors'],
  'NeedforSpeedHeat-Orbis.xml':[1222680,'need for speed heat'],
  'WoLong-Orbis.xml':[1448440,'wo long']
});
Object.assign(steam, {
  'StreetFighter6-Orbis.xml':[1364780,'street fighter 6'],
  'Persona3Reload.xml':[2161700,'persona 3 reload'],
  'SoulHacker2-Orbis.xml':[1777620,'soul hackers 2'],
  'LifeIsStrange-BeforeTheStorm-Orbis.xml':[554620,'before the storm'],
  'AssassinsCreedIII-LiberationRemastered-Orbis.xml':[911400,'assassin'],
  'MirrorsEdgeCatalyst-Orbis.xml':[1233570,'mirror'],
  'GrandTheftAutoViceCityDefinitive-Orbis.xml':[1546990,'vice city'],
  'JudgmentEU-orbis.xml':[2058180,'judgment'],
  'ResidentEvilOrigins-Orbis.xml':[339340,'resident evil'],
  'Vampyr-Orbis.xml':[427290,'vampyr'],
  'AtomicHeart-Orbis.xml':[668580,'atomic heart'],
  'NeedforSpeedPayback-Orbis.xml':[1262580,'need for speed payback'],
  'SpyroReignitedTrilogyEU-Orbis.xml':[996580,'spyro'],
  'FatalFrame_MaidenofBlackWater-Orbis.xml':[1732190,'maiden of black water']
});
Object.assign(steam, {
  'SonicXShadowGenerations-Orbis.xml':[2513280,'sonic'],
  'Daymare1998-Orbis.xml':[842100,'daymare'],
  'AmnesiaTheBunker-Orbis.xml':[1944430,'amnesia the bunker'],
  'LostJudgmentJP-orbis.xml':[2058190,'lost judgment'],
  'TheTechnomancer-Orbis.xml':[338390,'technomancer'],
  'HellbladeGame-Orbis.xml':[414340,'hellblade'],
  'FarCry3BloodDragonClassicEdition.xml':[233270,'blood dragon'],
  'Mafia1Remake-Orbis.xml':[1030840,'mafia'],
  'Back4Blood.xml':[924970,'back 4 blood'],
  'TheSinkingCity-Orbis.xml':[750130,'sinking city'],
  'AssettoCorsaCompetizione-Orbis.xml':[805550,'assetto corsa competizione'],
  'Homefront2-Orbis.xml':[223100,'homefront'],
  'FatalFrame_MaskoftheLunarEclipse-Orbis.xml':[2130460,'mask of the lunar eclipse']
});
const reusable={'HorizonZeroDawn-Orbis.xml':'/assets/images/ps4-ps5/horizon-zero-dawn.jpg','EldenRing-Orbis.xml':'/assets/images/ps4-ps5/elden-ring.jpg'};
const playstation={'Bloodborne-Orbis.xml':'bloodborne','TheLastGuardian-Orbis.xml':'the-last-guardian','ShadowoftheColossus-Orbis.xml':'shadow-of-the-colossus','GravityDaze2-Orbis.xml':'gravity-rush-2','TheOrder1886-Orbis.xml':'the-order-1886','Driveclub-Orbis.xml':'driveclub','DemonSouls.xml':'demons-souls','TheLastOfUs2-Orbis.xml':'the-last-of-us-part-ii','TheLastOfUs1-Orbis.xml':'the-last-of-us-remastered'};
playstation['ConcreteGenie-Orbis.xml']='concrete-genie';
Object.assign(playstation,{'FinalFantasyXV-orbis.xml':'final-fantasy-xv','FinalFantasyVIIRemake-Orbis.xml':'final-fantasy-vii-remake','MarvelsSpider-Man-Orbis.xml':'marvels-spider-man','AssassinsCreedRougeRemastered-Orbis.xml':'assassins-creed-rogue-remastered'});
const ps4Artwork=new Set(['FinalFantasyXV-orbis.xml','FinalFantasyVIIRemake-Orbis.xml','MarvelsSpider-Man-Orbis.xml','AssassinsCreedRougeRemastered-Orbis.xml']);
// The Spider-Man page's current og:image advertises Remastered; the page still
// publishes the original PS4 hero separately. Verify its presence before capture.
const pageArtwork={'MarvelsSpider-Man-Orbis.xml':'https://gmedia.playstation.com/is/image/SIEPDC/marvel-spiderman-pdp-hero-desktop-01-ps4-en-11nov20?$1200px$'};
async function request(url){const response=await fetch(url,{signal:AbortSignal.timeout(20000),headers:{'User-Agent':'whatsite-artwork-check/1.0'}});if(!response.ok)throw Error('HTTP '+response.status);return response;}
async function main(){
  const onlyArg=process.argv.find(arg=>arg.startsWith('--only=')),only=onlyArg?new Set(onlyArg.slice(7).split(',')):null;
  for(const game of data.games){
    if(only&&!only.has(game.id))continue;
    if(manifest.images[game.id])continue;
    try{
      let sourcePage,imageUrl,sourceTitle;
      if(steam[game.sourceFile]&&!ps4Artwork.has(game.sourceFile)){
        const [id,expected]=steam[game.sourceFile];sourcePage='https://store.steampowered.com/app/'+id+'/';
        const json=await(await request('https://store.steampowered.com/api/appdetails?appids='+id+'&l=english&cc=us')).json();const app=json[id]?.data;
        const clean=value=>String(value||'').replace(/[™®©]/g,'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9\s.]/g,' ').replace(/\s+/g,' ').trim();
        if(!clean(app?.name).includes(clean(expected)))throw Error('Store title did not match expected game');
        sourceTitle=app.name;imageUrl=app.header_image;
      }else if(playstation[game.sourceFile]){
        sourcePage='https://www.playstation.com/en-gb/games/'+playstation[game.sourceFile]+'/';
        const html=await(await request(sourcePage)).text();
        const tag=html.match(/<meta\b[^>]*property=["']og:image["'][^>]*>/i)?.[0];
        imageUrl=tag?.match(/content=["']([^"']+)/i)?.[1]?.replaceAll('&amp;','&');sourceTitle=game.title;
        if(pageArtwork[game.sourceFile]){if(!html.includes(pageArtwork[game.sourceFile]))throw Error('Expected original PS4 artwork absent from publisher page');imageUrl=pageArtwork[game.sourceFile];}
      }else continue;
      if(!imageUrl?.startsWith('https://'))throw Error('Official page exposes no HTTPS artwork');
      const reused=reusable[game.sourceFile];
      const bytes=reused&&fs.existsSync(path.join(root,reused.slice(1)))?fs.readFileSync(path.join(root,reused.slice(1))):Buffer.from(await(await request(imageUrl)).arrayBuffer());
      if(bytes.length<1000||bytes.length>8*1024*1024)throw Error('Artwork size outside expected range');
      const signature=bytes.subarray(0,12),extension=signature.subarray(0,3).toString('hex')==='ffd8ff'?'.jpg':signature.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'.png':signature.subarray(0,4).toString()==='RIFF'&&signature.subarray(8).toString()==='WEBP'?'.webp':null;
      if(!extension)throw Error('Unsupported image signature');
      const sha256=crypto.createHash('sha256').update(bytes).digest('hex'),file=reused?reused.slice(1):`assets/images/game-patches/${game.id}${pageArtwork[game.sourceFile]?'-ps4-hero':ps4Artwork.has(game.sourceFile)?'-ps4':''}-official${extension}`,full=path.join(root,file);
      if(fs.existsSync(full)){if(crypto.createHash('sha256').update(fs.readFileSync(full)).digest('hex')!==sha256)throw Error('Preserving existing different artwork');}
      else fs.writeFileSync(full,bytes,{flag:'wx'});
      manifest.images[game.id]={image:'/'+file,sourcePage,sourceTitle,source:imageUrl,bytes:bytes.length,sha256,kind:reused?'Existing publisher artwork reused; store game identity verified. Image does not imply PC patch compatibility':sourcePage.startsWith('https://store.steampowered.com/')?'Official Steam store game artwork; image does not imply PC patch compatibility':'Official PlayStation game artwork'};
      fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2)+'\n');console.log(game.title+': official artwork captured');
    }catch(error){console.log(game.title+': original title artwork retained ('+error.message+')');}
  }
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1});
