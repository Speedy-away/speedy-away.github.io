/* Navigation only: native firmware checks remain on each existing landing page. */
(function(){
 'use strict';
 var form=document.getElementById('ps4-firmware-picker');if(!form)return;
 var choice=document.getElementById('ps4-firmware-choice'),start=document.getElementById('ps4-jailbreak-open'),status=document.getElementById('host-family-detected');
 var match=/PlayStation\s*4[ /]+(\d+\.\d{2})(?:\D|$)/i.exec(navigator.userAgent);
 function selected(){return choice.options[choice.selectedIndex];}
 function update(){start.disabled=!choice.value;status.textContent=choice.value?'Selected PS4 '+choice.value+' · Load jailbreak opens the matching host.':'Select your installed PS4 firmware.';}
 if(match){for(var i=0;i<choice.options.length;i++)if(choice.options[i].value===match[1])choice.selectedIndex=i;}
 choice.addEventListener('change',update);
 form.addEventListener('submit',function(event){event.preventDefault();if(start.disabled)return;var route=selected().getAttribute('data-entry');if(route&&/^\/(?:ps4\/14\.(?:00|02)\/|hosts\/ps4\/exploit\/multi-firmware\/)$/.test(route))location.href=route;});
 update();if(match&&!choice.value)status.textContent='PS4 '+match[1]+' detected · no matching loader listed.';
}());
