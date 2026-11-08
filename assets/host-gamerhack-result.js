/* Interpret GamerHack's terminal output. This file does not start or retry the loader. */
(function (factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else factory().mount(window, document);
}(function () {
  'use strict';

  function result(log, heading) {
    var attempts = /^AG\s+gave up after (\d+) attempts\s*$/im.exec(log);
    if (attempts) return {
      state: 'error',
      message: 'The kernel stage stopped after ' + attempts[1] + ' attempts. GoldHEN was not started. Restart the PS4 before clearing the saved attempt.'
    };
    if (/^AG\s+the handles are NOT defused/im.test(log)) return {
      state: 'error',
      message: 'GamerHack reports that cleanup did not complete. Follow its cold boot instruction in the log before another attempt.'
    };
    if (/^AG\s+done -- jailbroken, rwx open, syscall 11 is a kexec gate, enabler running\s*$/im.test(log)) return {
      state: 'ready',
      message: 'GamerHack reports that the GoldHEN enabler started. Check the PS4 system menu for GoldHEN.'
    };
    if (/^AG\s+done -- jailbroken, rwx open, syscall 11 is a kexec gate\s*$/im.test(log)) return {
      state: 'error',
      message: 'The kernel stage finished, but GamerHack did not confirm a GoldHEN start. Check the payload messages in the log and restart before trying again.'
    };
    if (/^AG[ \t]+done[ \t]*$/im.test(log)) return {
      state: 'notice',
      message: 'GamerHack reports kernel completion. Its short log does not confirm the GoldHEN result. Check the PS4 system menu before retrying.'
    };
    if (/Content not Found/i.test(heading)) return {
      state: 'error',
      message: 'The loader could not open its WebKit module. Reopen the 14.00 launcher and apply the cache update if one is available.'
    };
    if (/GoldHEN is Already Loaded/i.test(heading)) return {
      state: 'notice',
      message: 'GamerHack detected a previous session or an already open kernel. Check for GoldHEN in the PS4 system menu. If it is missing, restart before clearing the saved attempt.'
    };
    return null;
  }

  function mount(win, doc) {
    if (!/PlayStation 4[ /]14\.00(?:\D|$)/i.test(win.navigator.userAgent)) return;
    var heading = doc.getElementById('msgs');
    var verdict = doc.getElementById('wwb-native-result');
    if (!heading || !verdict) return;
    function update() {
      var output = doc.getElementById('out');
      var state = result(output ? output.textContent : '', heading.textContent);
      if (!state) return;
      verdict.textContent = state.message;
      verdict.setAttribute('data-state', state.state);
      verdict.hidden = false;
      heading.hidden = true;
    }
    // Only observe the upstream status heading, which is updated at handoff
    // completion. Leave the high-frequency native log alone during the race.
    if (win.MutationObserver) new win.MutationObserver(update).observe(heading, {childList:true, characterData:true, subtree:true});
    update();
  }

  return {result: result, mount: mount};
}));
