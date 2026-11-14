/* Optional UI observer: only explicit upstream results may navigate away. */
(function(){
 'use strict';
 var settings={},retryKey='wwb.afterglow.1402.retry',usedKey=retryKey+'.used',finished=false,kernelSeen=false;
 try{settings=JSON.parse(localStorage.getItem('wwb.afterglow.1402.settings.v1')||'{}')||{};}catch(e){}
 var retry=settings.retry!==false,reload=settings.reload!==false,bare=settings.barebone===true;
 if(bare)document.documentElement.className+=' barebone';
 if(!(retry||reload||bare)||typeof MutationObserver==='undefined')return;
 var out=document.getElementById('out'),status=document.getElementById('bare-status');
 function inspect(){
  if(finished)return;
  var log=out.textContent||'',success=/(?:^|\n)AG  done(?:\n|$)/.test(log),defused=/(?:^|\n)AG  handles defused(?:\n|$)/.test(log);
  kernelSeen=kernelSeen||/(?:^|\n)AG(?:  |-)/.test(log);
  var early=/(?:^|\n)JB-THREW(?:  |\n|$)/.test(log)&&!kernelSeen;
  if(success){
   status.textContent='Jailbreak complete';
   if(defused){
    try{sessionStorage.setItem('wwb.afterglow.1402.completed','1');}catch(e){}
    finished=true;observer.disconnect();
    if(reload){
     var left=5,notice=document.createElement('p');notice.setAttribute('role','status');notice.style.cssText='text-align:center;color:#b9d5ff;font:16px Arial';out.parentNode.insertBefore(notice,out);
     function countdown(){notice.textContent='Jailbreak complete. Returning to the launcher in '+left+' seconds…';status.textContent=notice.textContent;}
     countdown();var timer=setInterval(function(){left--;if(left<=0){clearInterval(timer);location.replace('index.html?restored=1&result=success');}else countdown();},1000);
     window.addEventListener('pagehide',function(){clearInterval(timer);});
    }
   }
  }
  else if(early){
   status.textContent='WebKit attempt failed';
   if(retry){try{if(sessionStorage.getItem(usedKey)!=='1'){sessionStorage.setItem(usedKey,'1');sessionStorage.setItem(retryKey,String(Date.now()));finished=true;observer.disconnect();location.replace('index.html?restored=1&retry=1');}}catch(e){}}
  }else if(document.body.className.indexOf('fail')>=0)status.textContent='Attempt stopped. Reopen the browser; restart the console if the kernel stage ran.';
 }
 var observer=new MutationObserver(inspect);
 observer.observe(out,{childList:true});observer.observe(document.body,{attributes:true,attributeFilter:['class']});
}());
