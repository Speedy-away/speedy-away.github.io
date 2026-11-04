# GamerHack and RAW GAME: setup and compatibility

The next original-source batch adds [Orbis Toolbox and official GoldHEN 2.4b18 selected-file loading](host-original-tool-loading.md), with receiver snapshot 14 and sender 1.8.0. The review and preserved builds below describe the preceding batch.

Reviewed on 2 November 2026 against the exact requested repositories:

| Original repository | Reviewed commit | Integration |
| --- | --- | --- |
| [GamerHack/GamerHack.github.io](https://github.com/GamerHack/GamerHack.github.io/tree/23c946a7f85f1338ea2b78163e72e0ce9bc82b68) | `23c946a7f85f1338ea2b78163e72e0ce9bc82b68` | Existing external firmware router retained; four distinct GTA V builds added to existing families; the official, already archived GoldHEN 2.3 BIN can now use our paired sender. |
| [raw13g/raw13g.github.io](https://github.com/raw13g/raw13g.github.io/tree/9ba2f0719591d6900d91aba6cc5291f8fff97e6d) | `9ba2f0719591d6900d91aba6cc5291f8fff97e6d` | Explicit external RAW GAME entry for PS4 13.02, 13.04, 13.50 and 13.52. |

Both repositories currently have one maintained `main` branch and no published releases. Neither establishes PS5 support. The existing PS5 runtime, payloads and native workspaces retain their separate prerequisites.

## Load the existing GoldHEN 2.3 build on PS4 9.00

1. On the PS4, open `/hosts/ps4/`, select firmware **9.00**, then open the built-in PSFree / Lapse loader under **Loaders**. Choose Start explicitly. Wait for its own **TCP 9020** BIN-listener message. The dashboard itself does not start the exploit.
2. On a computer on the same LAN, extract the complete current [Console Payload Sender ZIP](/downloads/helpers/console-payload-sender/). Start it using its included instructions, open its localhost dashboard and pair with the fresh terminal token.
3. Enter the PS4 LAN address, select firmware **9.00**, open **Payloads** and choose **GoldHEN 2.3 · 9.00 → Load** once. The sender verifies the curated file hash before connecting.
4. Check the console for successful GoldHEN execution. TCP delivery is not an execution acknowledgement. If a transfer result is uncertain, check the console before clearing its warning or trying again.

This route sends the original official `goldhen_2.3_900.bin`, 282,648 bytes, SHA-256 `c9b8f33d28258af9e80465da591868dada25a1454f30f63882668d5e0dcff9c2`. GamerHack's pinned `900v3/goldhen_2.3.bin` has exactly the same bytes. The previously archived official file and catalogue ID are reused. It is an older release; it does not gain newer GoldHEN features or firmware support.

TCP 9020 is a raw PS4 BIN protocol. It uses one connection, exact bytes and EOF, with a 3 MiB bound matching the pinned runtime's mapped buffer. It has no readiness probe and no automatic retry. It is separate from GoldHEN HTTP 9090 and ELF TCP/HTTP 9021. The browser requires the paired desktop sender for raw TCP. A successful connection alone cannot verify the console or loader ABI.

## Four additional GTA V files

The **GTA 5** child page keeps one popup per existing menu family. Enable **Show older game updates** to see the **GamerHack 900v3 build** choices:

| Family | Exact PS4 game update | Console firmware | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| WildeModz | 1.38 | 9.00 | 593,216 | `e82fe24709f9155bc1c77ffa1b2318bee03b5ec7bb4d120b7aadf21b48f6adf8` |
| ArabicGuy | 1.00 | 9.00 | 1,055,408 | `80849dc10d770b5e4596b0c32774b03b156245c18f1527157d6a967854b990a8` |
| ArabicGuy | 1.27 | 9.00 | 1,055,408 | `a603fa84029a0c9bd29e3e5d6ea2f97aa668f0600403c4102f4c35b186b982f4` |
| ArabicGuy | 1.32 | 9.00 | 1,055,408 | `3dddf0161fb409e7e9711c6b53e4eaef4c34f9768e263a9821b217b1bde00daa` |

These hashes differ from the previous Nazky/Kameleon variants. All earlier files remain. The source supplies no independent menu release or regional title-ID whitelist for these exact files. Their version numbers describe the game update.

**Download** uses the pinned original upstream BIN, or the configured exact console-receiver ID. Receiver snapshot `2026.11.02.13` contains all four IDs and preserves the preceding 491 PS4 files. The files are privately archived on F: with source URL, named revision, bytes and SHA-256. They are not publicly mirrored here. **Load** stays disabled: GamerHack's source shows in-page native loading, but does not establish standalone GoldHEN HTTP or ELF compatibility for these four exact builds. Use the compatible original host or a separately confirmed native loader.

## Runtime and licence boundaries

GamerHack's repository has no declared licence. RAW GAME's MIT notice covers raw13g-authored code but explicitly excludes `core.js`, `mem.js`, `int64.js`, kernel patch blobs and bundled payload binaries. The linked primitive-source candidates were unavailable during review. Neither complete runtime is represented as built in or copied into our runtime directory.

RAW GAME's whitelist is **13.02 / 13.04 / 13.50 / 13.52** only. Its 13.04 path uses the 13.02 patch file; this source mapping is recorded rather than inferred from additional offset entries or the upstream run-anyway control. Its `goldhen.bin` and `payload2.bin` are identical, 293,120-byte files at the reviewed revision. A numeric release and independent loader ABI were not established; these files are not exposed as generic Load payloads.

GamerHack G2All keeps its existing exact firmware whitelist, including separate 5.05/5.07 handling and distinct chains across later firmware ranges. A selector entry for 14.00 does not add support. External hosts can change after this review and may start an exploit after opening/cache handling.

Detailed provenance, branch/release checks, file hashes, original-source links and exclusions are in [GamerHack source review](/docs/qa/gamerhack-source-review.json), [RAW GAME source review](/docs/qa/raw13g-source-review.json) and [original release review](/docs/qa/host-ready-original-source-review.json). Static files and authored mocks were checked; downloaded code and physical consoles were never executed or contacted.
