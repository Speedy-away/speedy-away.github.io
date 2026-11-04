(function () {
  'use strict';
  var select=document.getElementById('firmware-choice');
  var match=navigator.userAgent.match(/PlayStation 4[\/ ](\d+\.\d{2})(?:\D|$)/i);
  var detected=document.getElementById('firmware-detected');
  if(match)detected.textContent='PS4 '+match[1];
  function update(){
    var value=new URL(location.href).searchParams.get('fw')||'',count=0;
    if(!/^\d+\.\d{2}$/.test(value)||!select.querySelector('option[value="'+value+'"]'))value='';
    select.value=value;
    document.getElementById('firmware-folders').hidden=!!value;
    document.getElementById('firmware-routes').hidden=!value;
    document.querySelectorAll('[data-firmwares]').forEach(function(card){
      var show=!!value&&card.getAttribute('data-firmwares').split(',').indexOf(value)>=0;
      card.hidden=!show;if(show)count++;
    });
    document.getElementById('firmware-empty').hidden=!value||count>0;
    document.getElementById('firmware-directory-title').textContent=value?'PS4 '+value:document.querySelector('option[value=""]').textContent;
    document.getElementById('firmware-current-path').textContent=value?' / '+value:'';
    document.getElementById('firmware-back').href=value?'/hosts/ps4/firmware/':'/hosts/ps4/';
    document.getElementById('firmware-mismatch').hidden=!(match&&value&&value!==match[1]);
  }
  select.addEventListener('change',function(){location.href='/hosts/ps4/firmware/'+(select.value?'?fw='+select.value:'');});
  window.addEventListener('popstate',update);update();
})();
