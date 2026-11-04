# Historical GTA V menus for PS4 5.05

The PS4 host's GTA5 page now includes three additional original files under its existing ArabicGuy and WildeModz families. Select firmware **5.05**, show older builds and open **Choose version**. Match the GTA V game update separately from console firmware.

| Family | GTA V game update | Original file | Bytes |
| --- | --- | --- | --- |
| ArabicGuy | 1.00 | `arabic-guy100.bin` | 1,055,340 |
| WildeModz | 1.33 | `WildeModz-1.33.bin` | 1,074,320 |
| WildeModz | 1.46 | `WildeModz-1.46.bin` | 29,416 |

The matching game must already run on the console. These listings do not establish backport compatibility. Independent menu release numbers and regional title IDs were not supplied. Existing family artwork is retained; it does not verify these exact binaries on hardware.

**Download** uses the exact original upstream file, or the configured exact console receiver workflow. With no console address, it downloads to the viewing device. **Load stays disabled** because the original host's in-page native execution path does not establish a standalone GoldHEN HTTP, TCP BIN or ELF loader ABI. Installation, transfer acceptance and execution are separate steps.

Source: [GamerHack's pinned 5.05 host](https://github.com/GamerHack/GamerHack.github.io/blob/23c946a7f85f1338ea2b78163e72e0ce9bc82b68/505/index.html), commit `23c946a7f85f1338ea2b78163e72e0ce9bc82b68`. Preserve ArabicGuy, WildeModz and GamerHack attribution. No redistribution licence was established, so public downloads remain pinned original links. The private archive retains all three originals with versions, byte counts and SHA-256 hashes in the shared inventory.

The review on 3 November 2026 found both requested repositories unchanged, with one main branch each and no tags or releases. [raw13g](https://github.com/raw13g/raw13g.github.io) remains an external PS4 host for its exact existing firmware whitelist: its MIT licence excludes required primitives, patches and payloads, and original-source links still return 404. No new built-in runtime or PS5 support is asserted.

Three other 6.72 ArabicGuy candidates remain deferred: their host dispatch inserts scripts despite native BIN bytes. The misnamed 5.05 ArabicGuy 1.27 JavaScript remains excluded from ready BIN downloads. Full evidence, file URLs and hashes are in [the source refresh](qa/host-source-refresh-20261103.json) and [new action metadata](host-gta505-continuation-actions.json).

No payload, exploit runtime or real console was executed or contacted during review and verification.
