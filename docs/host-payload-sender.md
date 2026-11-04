# Desktop console payload sender

The downloadable sender includes the PS4/PS5 host dashboards, their language dictionaries, pinned ready-to-use payload/plugin/cheat files, and a small Node.js server. Extract the entire ZIP before starting it. Keep its `scripts`, `assets`, `hosts`, `docs` and `downloads` folders together.

[Download the current sender ZIP and view its checksum](https://whatwhatboy.com/downloads/helpers/console-payload-sender/). The stable download page links the latest immutable snapshot; it is separate from the ZIP contents.

## Start and connect

1. Install [Node.js 20 or newer](https://nodejs.org/) on a computer that can reach the console on the same local network. Node.js is not bundled.
2. On Windows, double-click **Start Sender.cmd** in the extracted folder. On macOS/Linux, open a terminal in that folder and run `node scripts/console-payload-bridge.cjs`.
3. Open `http://127.0.0.1:8766/hosts/` on that computer. Copy the fresh pairing token from the terminal into the dashboard, then connect the sender.
4. Choose PS4 or PS5. Enter the console's LAN IPv4 address from its network settings, select the exact firmware and, for a menu, the exact game update.
5. Start the compatible console loader separately. Choose **Load** for one compatible payload, then confirm its result on the console. Keep the sender window open while using it; Ctrl+C stops it.

The server listens only on this computer's loopback address. Open its dashboard on the computer, not in the console browser. `127.0.0.1` in the desktop helper points to the computer and cannot be used as the console destination. The sender can use another local port with `node scripts/console-payload-bridge.cjs --port 8767`.

## What Load does

For a compatible PS4 BIN, the sender checks the already-running GoldHEN HTTP BinLoader on port 9090 and sends the raw bytes only when it reports ready. For a PS4/PS5 ELF, it sends raw ELF bytes to the already-running compatible TCP loader on port 9021. A BIN is not automatically an ELF, and a RAR/ZIP archive is not a raw payload.

Sender 1.7.0 also handles an explicitly curated PS4 `bin-tcp` action on TCP 9020. On firmware 9.00, start the built-in PSFree/Lapse loader on the PS4 and wait for its own BIN-listener message. Then use **GoldHEN 2.3 · 9.00 → Load** through the paired desktop sender. It verifies the existing official bytes, sends one connection with EOF and never probes or retries that one-shot listener. Its 3 MiB bound matches the pinned native buffer. This is not GoldHEN HTTP 9090. Transfer completion does not prove GoldHEN executed. See [repository setup and compatibility](host-repository-review.md).

The four additional GamerHack menu variants retain pinned original downloads and exact receiver IDs in snapshot `2026.11.02.13`. Their source uses in-page native loading; standalone ABI and redistribution permission were not established, so these builds are not bundled in this sender and their Load buttons remain disabled. All previous bundled files and sender ZIPs remain available.

Sender 1.8.0 adds [selected-file loading for original-release BINs](host-original-tool-loading.md). Download the author's exact BIN, pair the current localhost dashboard, then choose Load and select that file. The browser and sender verify size/SHA-256 in memory before a fixed curated transport is used. The selected binary is not bundled, publicly mirrored or retained by the sender. Orbis Toolbox 5.05/6.72/9.00 requires GoldHEN HTTP 9090 after HEN; official GoldHEN 2.4b18 on exact 9.00 uses the already waiting TCP 9020 bootstrap. Orbis 7.02/7.55 stays download-only. Receiver snapshot `2026.11.02.14` includes the six new exact file IDs. Use Download separately for a console copy and turn off copy-on-Load before opening this file picker.

The helper rechecks the catalogue ID, platform, pinned firmware/game update, file SHA-256 and ELF header before transferring. It accepts only its bundled curated action IDs. A fresh pairing token is generated for each run; the ZIP contains no pairing token. Starting the helper, connecting to it or viewing a host page sends no payload.

Every mod card opens a version-button popup, including single-build entries. **Download** routes to the configured console receiver, or this device when no console address is set. The destination appears beside the two actions. The native receiver checks its queue and chosen storage before saving; no download is submitted on opening. PRX/SPRX plugins, cheat data and unverified source-host-only BINs keep a disabled **Load** action with their real setup requirements. They cannot be executed through the raw ELF/BIN sender by renaming them. **Check services** makes read-only metadata requests after pairing; it does not run a payload or detect installed game versions.

**Sent** means bytes were written to the loader connection. **Accepted** means the HTTP loader acknowledged them. Neither result confirms that the payload injected successfully or that a menu supports your game. Follow each action's requirements and check the console itself.

**Uncertain** means an executing request may have reached the console but its acknowledgement was lost, timed out or disconnected. The dashboard retains a warning for that address across reloads and blocks another Load until you check the console and clear the warning. It never retries automatically. Clearing a warning does not send anything. A preflight, file-integrity or known non-executing rejection stays an ordinary error.

Sender protocol2 adds separate bounded GET checks for the loader/manager, downloader queue and standard file-manager pages. Queue checks return only a record count and do not confirm installation of the companion HTML or the save directory. File-manager responses do not verify application identity or file operations. These checks never open the one-shot bootstrap TCP9020 listener or the ELF TCP9021 listener. A generic TCP probe could consume a native payload handoff, so it is not a readiness test.

The helper does not enable a jailbreak, create console folders, install PKGs or extract console archives. Those operations require the appropriate running native app. The [console service documentation](host-console-services.md) explains the supported protocols and file-manager services.

The local dashboards and bundled files are available while the sender runs. External exploit hosts, public-site navigation and externally hosted fonts/icons still need an Internet connection. Links outside the bundled dashboard open their public-site destination. Keep a downloaded snapshot's firmware/game requirements; installing a newer helper does not change an older payload's compatibility.

## Verify and update a bundle

Each ZIP has an immutable content-based filename and a SHA-256 record in `downloads/helpers/console-payload-sender/manifest.json`. The extracted `bundle-manifest.json` lists included file hashes and payload sources. `THIRD-PARTY.txt` retains the included payloads' source/license attribution. Download and extract a newer ZIP to a new folder to keep the previous snapshot intact.

Maintainers prepare and package the current curated files with:

```powershell
node scripts/package-console-payload-sender.cjs --check
node scripts/package-console-payload-sender.cjs --build
node scripts/package-console-payload-sender.cjs --archive
node scripts/refresh-local-download-index.cjs --write
```

`--check` reads files and verifies payload checksums. `--build` writes a new content-versioned ZIP and appends its public manifest record. `--archive` also saves that exact ZIP under the private archive's PC desktop-helper layout and merges its source URL, version, size and SHA-256 into the download inventory. Existing ZIPs, inventory entries and older versions are retained. The archive step uses the normal filesystem permission boundary for the F: drive.
