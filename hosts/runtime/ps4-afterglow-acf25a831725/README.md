# Afterglow PS4 13.52 / 14.00

Upstream: https://github.com/well0nez/afterglow-web/tree/acf25a831725f0d44fcb64725d4ce35acbba8f9d

Pinned acf25a831725f0d44fcb64725d4ce35acbba8f9d. Hardware execution has not been tested. Do not use on PS5 or other firmware. Open web/index.html in the PS4 browser. Start selects the bundled patched ps4-hen pre-release-main-182 or bundled GoldHEN (numeric version not established). These files belong to this runtime; no generic TCP/HTTP loader ABI is asserted.

Changes (2026-11-03, integration v2): full-page landing layout and top back/navigation bar; opt-in autostart default; exact PS4 browser firmware gate before module import; five-second countdown; cancellation clears pending cache starts; one-use session entry ticket consumed before import; reload/back/restore refused; cache updates require reopening. Original jb.js failure/watchdog/referrer guards and all exploit/native bytes unchanged. No ads, analytics, shared site scripts or translated dictionaries enter the run document.

Serve web/ using its serve.sh (requires Python3 and a POSIX shell), or a server with .js text/javascript, .appcache text/cache-manifest and Cache-Control: no-cache, must-revalidate on code/payload/manifest. Open http://HOST-LAN-IP:8000/index.html from PS4; 127.0.0.1 on a PC is not reachable by the console. Offline persistence requires console testing. Changing runtime bytes requires rebuilding the manifest. No service worker may rewrite this runtime.

Source and licensing: upstream/ contains every pinned file, web/ all readable modified deployable source; integration source and exact original files are included in separate downloadable source ZIP. afterglow.js and patchsets: AGPL-3.0-or-later, see LICENSE. raw13g scaffolding: MIT, see LICENSE-raw13g. Preserve both licenses and credits. core.js/mem.js/int64.js descend from jordyidk/slopkit via raw13g and aminegold0/silverps4hen; upstream explicitly declares no separate license for those primitive files. This is recorded, not represented as blanket AGPL/MIT coverage. TECHNICAL.md describes lineage and patch generation; upstream does not supply fully reproducible corresponding source for all bundled native payloads.

GoldHEN is credited to SiSTRo. The pinned README states author permission for this bundled copy; independent permission correspondence and numeric GoldHEN release identity were not supplied. Do not substitute the separately advertised Ko-fi beta or an arbitrary newer binary. Patched hen.bin MD5: 6417a84a72f9c7988f0e33b3ae190542.

If handles are NOT defused, do not close the browser: cold start the console. Ordinary WebKit failure asks to reopen the browser. A hard kernel crash may give no message. Preserve unsaved work before attempting a run. See original README and TECHNICAL.
