(function () {
  'use strict';
  var box = document.getElementById('container-fd0a4dcec74a63f4d2662af5273f9d5b');
  var stage = document.querySelector('.site-ad-stage');
  if (!box || !stage) return;
  var empty = stage.querySelector('.site-ad-empty');
  var timedOut = false;
  function update() {
    var filled = !!box.querySelector('a[href],img,iframe') && box.getBoundingClientRect().height > 24;
    if (filled || timedOut) stage.style.minHeight = '0';
    if (empty) empty.hidden = filled || !timedOut;
    stage.setAttribute('data-ad-status', filled ? 'filled' : 'empty');
  }
  if (window.MutationObserver) new MutationObserver(update).observe(box,{childList:true,subtree:true,attributes:true});
  document.addEventListener('load',update,true);
  window.addEventListener('resize',update,false);
  window.setTimeout(function () { timedOut = true; update(); },12000);
  update();
}());
