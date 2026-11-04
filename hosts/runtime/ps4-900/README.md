# PS4 9.00 · PSFree / Lapse

Integration date: 2026-11-02. Original repository: https://github.com/kmeps4/PSFree
Pinned commit: 368d82aa40d3017c220757ce315761adb5f06678

Run the locally hosted PSFree / Lapse chain on PS4 9.00, then wait for the native BIN listener on port 9020. GoldHEN is not automatically loaded.

Licensing: AGPL-3.0-or-later; Liberation font OFL. Preserve all copyright and license files. There is no warranty. Original source is in upstream/; modified deployable source is in web/. Neither the exploit nor a payload was executed during preparation. Hardware execution has not been verified.

Firmwares: 9.00. Native listener: BIN over TCP 9020. Browser pages cannot send raw TCP by themselves: after bootstrap, use the paired desktop sender or a native console sender compatible with this listener. A successful transfer is not proof the payload executed.

PS4 application cache manifest included; actual cache persistence needs console verification.

PS4 changes: replaces automatic GoldHEN loading with the existing upstream BIN listener; retains AIO fix, normalizes appcache paths, removes missing cosmetic image references. PS5 changes: console/firmware guard and delayed script loading; restricts supported ELF firmware to the README's explicit list below 5.00; propagates ELF-load errors so a failed load cannot fall through to the readiness log. Native ELF is unchanged.

AGPL source: all modified JavaScript is shipped as readable source. PS4 kernel patch and AIO corresponding source is retained. PS5 elfldr is the exact binary distributed by the pinned PS5Dev build. Build history identifies v0.17, rebuilt on 2024-10-06 with an SDK supporting 1.01: https://github.com/PS5Dev/PS5-UMTX-Jailbreak/commit/33ef329d6480bb7bed6aadc144ba222ea5d14bbf and https://github.com/PS5Dev/PS5-UMTX-Jailbreak/commit/166f6ace30769f5803bae8398e03ef859b116c06 . Native loader v0.17 source, Makefile and GPL-3.0 license are retained in corresponding-source/elfldr-v0.17 (commit 9198efdb02535e6647b00db6d9dac223874b1a87). Source SDK prerequisite: https://github.com/ps5-payload-dev/sdk . The PS5Dev host does not record the SDK commit used for its rebuild, so bit-for-bit native rebuild reproducibility is not claimed.

Deployment: generated web modules use .js filenames with rewritten local imports so static servers send a JavaScript MIME type. Original .mjs sources remain unchanged. PS4 application caching additionally requires the server to send psfree_lapse.appcache as text/cache-manifest. The current local preview sends that manifest as application/octet-stream; offline installation there is unavailable until that MIME mapping is configured. This does not block the online JavaScript loader.
