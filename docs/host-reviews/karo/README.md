# KARO screenshot builds

The local integration covers all 29 folders in the supplied screenshot, pinned to [KAR0218/KAR0218.github.io at 743646c9df9ab4c83821b660c12e23a3dda57b49](https://github.com/KAR0218/KAR0218.github.io/tree/743646c9df9ab4c83821b660c12e23a3dda57b49). The existing host file lists, downloads, firmware pins, receivers and older versions are preserved.

Open `/hosts/karo/` through the site's HTTP server. The main PS4/PS5 workspaces link to it. The chooser is inert on desktop and separates 71 firmware-specific original entries. Select an exact build, confirm the matching console state, then press Load in the actual matching console browser. Choosing an option starts nothing. This is original browser-native preparation, not a guessed desktop sender ABI.

Each of the 33 current web-host ZIPs includes an inert chooser, the original native scripts and payload bytes, and an authored static server. Extract the whole ZIP, install Node.js 20 or newer, then run `node "Serve KARO.cjs"` in that folder. Visit that computer's LAN address on port 8767 from the matching console. The server only serves files; it does not execute a payload or implement a console backend. Do not launch console files on a computer.

The HTML entry wrappers check console/firmware and an explicit session ticket before handing the original HTML to its normal parser. Relative paths and native script order are retained. Known original-domain URLs are adapted to the local runtime, and an authored resource guard refuses invalid/missing files and unsupported PHP endpoints. Original native JavaScript, module and BIN/ELF files are unchanged. One original cache round trip is allowed; repeated top-level entries and saved attempts require an explicit reset after checking the console.

Download saves to the viewing device. There are 1,473 enabled payload/package links: 33 ready web-host ZIPs plus the valid original/decoded files and official browser-launcher release asset. The 407 decoded BINs are separate from their original BZIP2 files. G755's GoldHEN is embedded JavaScript; it is retained in its complete web-host build and is not relabelled as a standalone BIN. Multi-file 5.05 chains and each original native listener port remain distinct.

## Source defects and verification limits

- The original native loaders for `binloader/702`, `restore/702d` and `restore/702N` start independently of the absent cache manifests. These three reviewed entries now work online, with no offline-cache claim. The cache-only5.05 XMB installer remains unavailable.
- Invalid originals remain retained as evidence. The active paths for Enable Browser7.02, PSPlay and CheatRunner0.17.2 now use separately verified original publisher/LFS files; their exact identity and provenance are in original-payload-repairs.json. The unused OnionHENv1.11.elf placeholder stays unavailable; the existing actual OnionHENv0.9.0 with kstuff1.11 build retains its correct name.
- Windows Defender event 1116 quarantined `900NM/payload.js` and `900New/payload.js` with a `Trojan:JS/Cryxos.AIDB!MTB` detection. Their optional WebActivator paths are blocked. They were not restored, refetched, renamed, encoded or otherwise recovered to bypass protection. The remaining root loader chains do not require these optional files.
- Other missing menu controls, cache entries, decorative references and dormant code are listed separately in [dependency-audit.json](dependency-audit.json). Missing assets are not replaced with a different firmware's files.
- Original optional server APIs and external libraries retain their original requirements. Offline AppCache behaviour, TLS, kernel execution and actual game/menu effects require physical console testing. No downloaded native source or payload was executed and no console was contacted during this work.
- Original project attributions remain in the runtime files. The repository has no declared top-level licence; nothing was committed, deployed or published by this work. Review third-party permissions before any future redistribution/publication.

## Organization and evidence

- Authored chooser: `hosts/karo/index.html`; source controls: `assets/host-karo-builds.js`.
- Immutable native snapshots: `hosts/runtime/karo-<source-commit>-<build-hash>/`.
- Ready web-host ZIPs: `downloads/hosts/karo/<source-commit>/<original-folder>/<build-hash>/`.
- The F: layout uses `download-archive-layout.cjs`: original sources under Source Code, ready payload/builds under Builds, invalid originals under Metadata. Every earlier package snapshot is retained.
- [Download checks](download-verification.json), [browser checks](browser-verification.json), [archive inventory](download-inventory.json), [final verification](verification.json).

For future work, use `build.json`, the current receiver metadata and the sender manifest as authoritative. Do not reactivate older snapshots or refetch quarantined dependencies. Rebuilds retain prior immutable artifacts and archive jobs; update the handoff after verification. The central console receiver catalogue has not been expanded beyond its existing bound for these separate KARO web-host downloads.

## Independent repository

This host site now lives at https://speedy-away.github.io/WWB-HOST/. The actual home page is root index.html. All71 native entries are enabled through their exact console gates; no hardware execution was performed. The main site links to this separate repository. Older copied runtimes and ZIPs remain in Git and in the organized F: archive; Pages deploys the active runtime and maps large downloads to exact repository revisions.
