/* Original Blue Current scene: CSS motion only, with no requests, timers or storage. */
(function(w,d){
 'use strict';
 if(/\/hosts\/runtime\//.test(w.location.pathname))return;
 var p=w.location.pathname,b=d.body;if(!b)return;
 var art=/gta5/.test(p)?'gta5':/rdr2/.test(p)?'rdr2':/cod|black-ops|other-games/.test(p)?'cod':/\/ps5\//.test(p)?'ps5':/\/ps4\//.test(p)?'ps4':'';
 if(art)b.className+=' ps-art-'+art;
 if(w.WWB_HOST_CONSOLE||/PlayStation [45]/i.test(w.navigator.userAgent)||w.matchMedia&&w.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 var scene=d.createElement('div');scene.className='ps-atmosphere';scene.setAttribute('aria-hidden','true');
 scene.innerHTML='<div class="ps-current ps-current--one"></div><div class="ps-current ps-current--two"></div><div class="ps-current ps-current--three"></div><div class="ps-orbit ps-orbit--triangle">&#9651;</div><div class="ps-orbit ps-orbit--circle">&#9675;</div><div class="ps-orbit ps-orbit--cross">&#215;</div><div class="ps-orbit ps-orbit--square">&#9633;</div>';
 b.appendChild(scene);
}(window,document));
