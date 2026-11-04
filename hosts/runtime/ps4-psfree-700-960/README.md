# PS4 7.00–9.60 · PSFree / Lapse

Pinned source: https://github.com/Al-Azif/psfree-lapse/tree/08ecf038c94aa99b56e46c9f32e2e486f83656b6

This is an additional locally prepared runtime; it does not replace older runtimes. Exact firmware whitelist: 7.00, 7.01, 7.02, 7.50, 7.51, 7.55, 8.00, 8.01, 8.03, 8.50, 8.52, 9.00, 9.03, 9.04, 9.50, 9.51, 9.60. The upstream README distinguishes functional 7.00–9.60 support from the larger vulnerability range. PS5 is not supported by this integration.

Open index.html on a matching PS4, then press Start. The separate web entry consumes a one-use session ticket valid for30seconds before importing the runtime. A restored execution page has no fresh ticket and stays inert. No exploit or payload starts on the entry page. No application-cache/offline-persistence claim is made.

The native listener is raw BIN/TCP9020. GoldHEN is not included or automatically loaded. Match a separately reviewed payload to the exact firmware/ABI. Do not readiness-probe a one-shot listener or retry an ambiguous transfer.

All runtime JavaScript and kernel-patch C files are AGPL-3.0-or-later. Liberation Mono is under OFL; web/fonts/FONTS.LICENSE is retained. LICENSE and readable deployment source are included; the separate corresponding-source ZIP contains every exact fetched upstream source and the complete compiler record. See source-record.json and compiler-build.json.

The7 kernel patch files were compiled from the exact pinned C sources using official installed LLVM19.1.5. They target ELF64 x86-64, with no undefined symbols/relocations, no required data sections and kpatch at the text entry. Their bytes differ from arbitrary host copies; no equivalence or hardware-success claim is made. No downloaded exploit, compiled patch or payload was executed during preparation.

[Download the exact corresponding source](source.zip).
