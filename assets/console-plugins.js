(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.WWBPlugins=factory();}(this,function(){
  'use strict';
  var presets=[
    {id:'custom',name:'Custom game plugin',file:''},
    {id:'gta5',name:'GTA V — game section',file:''},
    {id:'rdr2',name:'Red Dead Redemption 2 — game section',file:''},
    {id:'bo3',name:'Call of Duty: Black Ops III — game section',file:''},
    {id:'cod',name:'Call of Duty — another game',file:''},
    {id:'afr',name:'Application File Redirector',file:'afr.prx'},
    {id:'watermark',name:'Remove share watermark',file:'no_share_watermark.prx'},
    {id:'patch',name:'GoldHEN game patches',file:'game_patch.prx'}
  ];
  function merge(text,section,file,enabled){
    if(!/^(?:CUSA\d{5}|default)$/.test(section))throw Error('Enter your installed CUSA title ID, such as CUSA00001, or choose All games.');
    if(!/^[a-zA-Z0-9_ .()-]+\.(?:sprx|prx)$/i.test(file)||file.length>180)throw Error('Enter the exact .prx or .sprx filename.');
    var eol=text.indexOf('\r\n')>=0?'\r\n':'\n',lines=text.split(/\r?\n/),current='',insert=-1,found=false;
    var target='/data/GoldHEN/plugins/'+file;
    for(var i=0;i<lines.length;i++){
      var heading=/^\s*\[([^\]]+)\]\s*(?:;.*)?$/.exec(lines[i]);
      if(heading){if(current===section&&insert<0)insert=i;current=heading[1];if(current===section)found=true;}
      if(current===section&&lines[i].replace(/^\s*;?\s*/,'').replace(/\s*(?:=(?:true|false))?\s*(?:;.*)?$/,'')===target)return {text:text,added:false};
    }
    var entry=(enabled?'':'; ')+target;
    if(!found){if(lines[lines.length-1]!=='')lines.push('');lines.push('['+section+']',entry,'');}
    else{if(insert<0)insert=lines.length;lines.splice(insert,0,entry);}
    return {text:lines.join(eol),added:true};
  }
  return {presets:presets,merge:merge};
}));
