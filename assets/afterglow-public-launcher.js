/* Public route adapter only. The isolated landing retains every native guard. */
(function(root,factory){var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.AfterglowPublicLauncher=api;api.install(root.document,root);}}(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function destination(entry,location){
    if(typeof entry!=='string'||!/^\/(?:(?:WWB-HOST|wwb-host)\/)?hosts\/runtime\/ps4-afterglow-[a-f0-9]{12}\/web\/index\.html$/.test(entry))throw Error('The isolated Afterglow landing is unavailable.');
    var url=new URL(entry,location.href);
    if(!/^https?:$/.test(url.protocol)||url.origin!==location.origin||url.username||url.password||url.search||url.hash)throw Error('The isolated Afterglow landing must stay on this host.');
    return url.href;
  }
  function install(document,window){
    if(!document||!window||!window.location)return;
    var config=document.getElementById('afterglow-public-data'),status=document.getElementById('afterglow-public-status'),link=document.getElementById('afterglow-public-continue');
    if(!config||!status||!link||config.__wwbAfterglowInstalled)return;config.__wwbAfterglowInstalled=true;
    function attribute(el,name,value){if(el.setAttribute)el.setAttribute(name,value);}
    function say(message,error){status.textContent=message;attribute(status,'role',error?'alert':'status');attribute(status,'aria-live',error?'assertive':'polite');attribute(status,'aria-atomic','true');}
    var handoff=false;
    if(link.addEventListener)link.addEventListener('click',function(event){if(handoff||link.hidden){event.preventDefault();return;}handoff=true;attribute(link,'aria-disabled','true');say('Opening the local ps4-hen / GoldHEN chooser…');});
    try{
      var data=JSON.parse(config.textContent),url=destination(data.entry,window.location);
      link.href=url;handoff=true;attribute(link,'aria-disabled','true');attribute(link,'aria-busy','true');
      say('Opening the local ps4-hen / GoldHEN chooser…');
      // This navigates only to the existing inert picker, never jb.html. Its
      // original PS4 firmware and opt-in autostart guards still own execution.
      window.location.replace(url);
    }catch(error){handoff=false;say(error.message,true);link.hidden=true;attribute(link,'aria-disabled','true');attribute(link,'aria-busy','false');}
  }
  return {destination:destination,install:install};
}));
