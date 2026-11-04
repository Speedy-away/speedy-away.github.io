# ArabicGuy on PS4 6.72

Three distinct original builds are now grouped under **ArabicGuy** on the PS4 GTA V page: **game update 1.00, 1.27 and 1.32**. Console firmware stays **6.72 only**. Independent menu release numbers and regional title IDs are unknown. All previous 5.05 and 9.00 builds remain separate choices.

## Load through the original native chain

1. Restart the PS4 and use its own browser on firmware 6.72. Have the matching GTA V build available. Do not combine this chain with another active jailbreak or game menu.
2. Choose the exact 6.72 variant in the site's GTA V popup and choose **Load**. This opens an authored, first-party controller. Opening it performs no native preparation.
3. Confirm the installed game update and fresh console session, then choose **Prepare original loader**. The controller downloads the pinned original host HTML, `jb2.js`, `pl_loader.js` and the selected BIN directly from their upstream source. It verifies all four byte lengths and SHA-256 hashes, then preflights the Blob/ArrayBuffer readback, before starting any native code.
4. The controller uses the byte-identical first inline bootstrap from the verified HTML, then the exact `jb2.js` source. The original kernel stage must enter its documented success branch before the separate **Load** button becomes available.
5. Choose **Load** once. The exact verified BIN becomes an in-memory Blob; the unchanged original `pl_loader.js` reads those bytes with its own ArrayBuffer XHR and invokes its native ROP path. No BIN is inserted as a JavaScript element.
6. Inspect the PS4 for the actual result. The upstream message is written before its delayed native pivot, so it does **not** confirm successful execution. An interrupted attempt remains locked, and restored pages cannot reuse native state. Restart the console before clearing the warning and beginning another explicit attempt.

This is a first-party **controller with upstream runtime dependencies**, not a full offline mirror. Internet access, upstream availability/CORS and the required original PS4 browser features are necessary. Network, checksum or prerequisite failures stop before native preparation. There is no autostart or automatic retry. It does not use GoldHEN HTTP 9090, TCP 9020, an ELF loader or the desktop sender.

## What was matched

The pinned GamerHack `672/index.html` maps the three visible ArabicGuy buttons to their exact BIN filenames. Its script dispatch continues into `pl_loader.js`; that second file contains a real raw-BIN XHR branch and native `PL_loader` implementation. The earlier review stopped before this second stage and was incomplete.

The original initial dispatch also inserts the BIN as a script before reaching that loader, making it dependent on browser script-error/MIME behaviour. The authored controller avoids that step. Native bootstrap, kernel and loader source strings are unchanged, and the menu BINs are unchanged. The controller adds checksum validation, explicit stages, exact-browser gating and an uncertain-attempt lock. This is a scoped integration of the native path, not a claim that the surrounding original host UI was copied 1:1.

| GTA V game update | Original file | Bytes | SHA-256 |
| --- | --- | --- | --- |
| 1.00 | `pl_GTA_ArabicGuy100.bin` | 1,055,064 | `41a189bec891d371cb48fe5d727b986bdb0ae15a50fc6a0df4e2106caa6041d5` |
| 1.27 | `pl_GTA_ArabicGuy127.bin` | 1,055,384 | `1291b7a2f14b888bea93a076beb889a8980be8d92b489f62f742e0cc2126b5ee` |
| 1.32 | `pl_GTA_ArabicGuy132.bin` | 1,054,936 | `c868f5f52fa6ead0464f37066702865470f4010210b2ade595b47cf490b6e6ae` |

Source: [GamerHack 6.72 at commit 23c946a7f85f1338ea2b78163e72e0ce9bc82b68](https://github.com/GamerHack/GamerHack.github.io/tree/23c946a7f85f1338ea2b78163e72e0ce9bc82b68/672). Retain GamerHack, ArabicGuy, sleirsgoevy, Leeful and Al Azif attribution. GamerHack declares no repository licence. Original native code and menus are not publicly mirrored by this integration; source URLs and hashes remain explicit.

The supplied screenshot identifies [KAR0218/KAR0218.github.io](https://github.com/KAR0218/KAR0218.github.io), currently pinned here at `743646c9df9ab4c83821b660c12e23a3dda57b49`. Its 6.72 manual/auto/light and BIN-loader paths were compared as static source. Its tree supplies no ArabicGuy-named files or matching per-game contract. It is not substituted for the GamerHack chain, and the screenshot's other firmware folders do not establish compatibility for these menu files.

## Organization and verification

- Review records: `docs/host-reviews/ps4/6.72/arabicguy/`.
- Authored ready helper versions: `downloads/helpers/arabicguy-672/<hash>/`.
- Isolated controller entry: `hosts/runtime/ps4-672-arabicguy-23c946a7f85f/`.
- Private ready BINs: `F:/whatsite-backup-downloads-etc/files/PS4/Games/GTA5/<game-update>/ArabicGuy/Builds/<version>/`.
- Original source dependencies: separate `PS4/Hosts/6.72/GamerHack Original Loader/Source Code/` archive folders.
- Authored controllers: separate `PS4/Tools/6.72/ArabicGuy Original Loader/Helpers/` archive folders.

All earlier files and controller drafts remain preserved. The shared inventory records URLs, versions, bytes and SHA-256. Tests execute authored controller logic with inert native fixtures, and read original files as data. No downloaded exploit/payload was executed and no real console was contacted. Physical console loading and game-menu execution remain untested; static matching alone cannot establish that everything works on hardware.

## Download and Load recheck

The follow-up checks cover all three versions independently: live, bounded HTTPS downloads against the pinned size/SHA-256 and archived originals; popup Download links; exact native receiver IDs; controller query/build selection; and verified Blob bytes through preparation and one explicit Load attempt using inert native fixtures. Desktop, wrong-firmware, interrupted and restored-page guards remain checked.

See [live download verification](download-verification.json), [browser checks](browser-repair.json) and [repair closeout](repair-verification.json). The original plugin input examples now have byte-exact repository fixtures, and the local trainer/flasher ZIPs include their background assets. Old menu files, helpers and tool packages remain retained. Hardware execution still requires a real PS4 test.
