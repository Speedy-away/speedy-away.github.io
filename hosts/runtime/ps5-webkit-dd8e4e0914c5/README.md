# PS5 WebKit Exploit 7.00–13.60

Local integration of [ntfargo/Relapse-Exploit](https://github.com/ntfargo/Relapse-Exploit/tree/dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0) at commit `dd8e4e0914c5e9d066ee1f9b056be76cb992c8e0`. MIT license, copyright Nathan Fargo2026. See LICENSE and the original source README for credits and source notes.

The49 selected original files are preserved byte-for-byte with Git blob identities and SHA-256 in build.json. `source/index.html.txt` contains the exact original auto-starting index as text; it is not used as an executable entry. All original runtime JavaScript,33 offset files and2 native payloads in web/ are unchanged. serve.py is a desktop hosting helper and is not needed for this browser closure.

Authored changes: inert entry, exact-whitelist PS5 browser guard, explicit trusted Start, one-use30second same-origin/session authorization, replay/reload/iframe/hidden-document checks and sequential loading in the original script order. web/index.html is an authored wrapper; it loads no original script before ticket validation. Original src/main.js creates its own same-origin firmware-offset script; its worker, module imports and payload fetches all stay under web/. No external runtime CDN, iframe or host redirect is used.

After successful original execution, ELF loader9021 readiness comes from the original status. No hardware execution was performed while preparing this integration. The two internal native files are not independently advertised as universal payloads.
