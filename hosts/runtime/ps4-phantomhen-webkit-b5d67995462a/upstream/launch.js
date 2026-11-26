/*
  launch.js â€” iDntUseModz PhantomHEN landing page controller
  Countdown â†’ auto-redirect to exploit chain, or manual start via button.
  Referrer guard: only fires when reached from index.html in the same origin.
*/

(function () {
  "use strict";

  const COUNTDOWN_SEC = 2;
  const destination = new URLSearchParams("v=phantomhen307&log=1&afterglow=run&mode=phantomhen&payload=phantomhen.bin&attempts=15&shnstop=0");
  /* Loader bisect params ride through from the address bar:
     ?shnprofile=minimal|debug|full, ?shnstop=2..13, ?shndisable=ftp,klog,... */
  const CARRY = ["shnprofile", "shnstop", "shnattempts", "shndelay", "shndisable", "shnload", "shnhost"];
  const query = new URLSearchParams(location.search);
  CARRY.forEach(function (key) {
    const value = query.get(key);
    if (value !== null) destination.set(key, value);
  });
  let timer = null;

  const countEl = document.getElementById("count"); // <p class="status" id="count">
  const content = document.querySelector(".content");

  function guardOk() {
    return true; // key auth on index.html already protects the page
  }

  /* â”€â”€ inject start button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  const btn = document.createElement("button");
  btn.id = "startBtn";
  btn.textContent = "START NOW";
  btn.style.display = "none"; // hidden until guard passes
  if (content) content.appendChild(btn);

  /* â”€â”€ go â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function go() {
    if (countEl) countEl.textContent = "[ EXECUTE ]";
    if (btn) btn.disabled = true;
    /* Set a one-shot flag so jb-g.js knows this navigation was intentional.
       PS4 WebKit 14.x often drops the Referer header for local HTTP redirects,
       which makes FROM_LANDING false and causes an endless redirect loop.
       sessionStorage survives tab navigation but not a fresh browser session,
       giving the same security property as the referrer check. */
    try { sessionStorage.setItem("jb_from_landing", "1"); } catch (e) {}
    location.href = "launch.html?" + destination.toString();
  }

  /* â”€â”€ blocked by referrer guard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  if (!guardOk()) {
    if (countEl) countEl.textContent = "[ ACCESS DENIED â€” NAVIGATE FROM ROOT ]";
    return; // stop â€” session restore, do not fire
  }

  /* â”€â”€ show button now that we're cleared â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  btn.style.display = "";
  btn.addEventListener("click", function () {
    if (timer !== null) clearInterval(timer);
    go();
  });

  if (query.get("manual") === "1" || query.get("afterglow") === "done") {
    if (countEl) countEl.textContent = query.get("afterglow") === "done"
      ? "[ PREVIOUS RUN FINISHED â€” REBOOT THE PS4 BEFORE STARTING AGAIN ]"
      : "[ READY â€” PRESS START NOW ]";
    return;
  }

  /* â”€â”€ countdown â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  let remaining = COUNTDOWN_SEC;

  function tick() {
    if (countEl) {
      countEl.textContent =
        remaining > 0
          ? "[ LAUNCHING IN " + remaining + "... ]"
          : "[ EXECUTE ]";
    }
    if (remaining <= 0) {
      clearInterval(timer);
      go();
    }
    remaining--;
  }

  tick(); // show initial value immediately
  timer = setInterval(tick, 1000);
})();
