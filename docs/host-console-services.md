# Console host services and the optional local sender

The public host pages provide external loader launches, verified ready-to-use downloads, native service links and explicit payload transfers where a real transport is available. They do not obtain arbitrary console storage access merely by opening a web page.

## Start the local sender

Run `node scripts/console-payload-bridge.cjs` on a computer on the same network as the console. Node.js 20 or newer is required. The program listens only on `127.0.0.1:8766`; `--port` can select another local port. It does not enable a console listener, run a jailbreak, configure a firewall, listen on the LAN or send a payload at startup.

Open `http://127.0.0.1:8766/hosts/ps4/` or `/hosts/ps5/` on that computer. Enter the fresh pairing token printed by the sender. Then enter the console's **LAN** IPv4 address, select its exact firmware and game update, and explicitly choose Run. In this desktop helper, `127.0.0.1` refers to the computer, so it is refused as a console destination. Stop the helper with Ctrl+C when finished. Tokens are valid only for the current process and are never included in a page URL or API response.

The sender serves the host dashboard and a narrow selection of its public assets, language scripts and curated ELF/BIN downloads. It refuses foreign origins, unrecognized Host headers and unpaired API requests. It accepts only an action ID from `docs/host-actions-ps4.json`, `docs/host-actions-ps5.json` or `docs/host-game-actions.json`. The curated endpoints cannot fetch arbitrary remote URLs, select arbitrary file paths or ports, or execute operating-system commands. The explicit PS4 loader-file endpoint below additionally accepts user-selected BIN/ELF bytes. Local SHA-256 and ELF magic are checked before sending. Hostnames must resolve exclusively to private IPv4 addresses, and the checked numeric address is used for the connection.

The helper does not create console folders, extract archives, install a PKG or claim to verify a game's runtime result. Those operations require the appropriate running native application. RAR/ZIP entries are never reclassified as raw payloads. Existing direct ELF/BIN mirrors are used as-is; their original versions remain pinned.

The explicit **Check services** request uses the paired local sender's `POST /api/inspect` with only `address` and `platform`. After validating and resolving the LAN address once, it makes fixed read-only requests: PS4 GoldHEN `GET :9090/status`, or PS5 Payload Manager `GET :8084/version` and `GET :8084/getip`; both platforms also read the downloader queue at `:6701/get_download_state`. File-manager checks use PS4 ezRemote `:8080/`, or PS5 websrv `:8080/fs/` and ezRemote `:9090/`. Core metadata is limited to 2 KiB and other checks to 64 KiB, with a four-second deadline including the response body. Requests never accept custom URLs, paths or ports, follow redirects, spoof Origin/Referer, send payloads or open a raw TCP listener. A queue result returns only its validated count and explicitly leaves companion installation/storage unverified. File-manager results prove a bounded HTML response, not application identity or successful filesystem operations. Failures distinguish blocked, unavailable and unknown evidence without declaring a console absent.

Protocol2 keeps the original top-level loader/manager result and adds the `checks` array. `/api/status` advertises `capabilities.serviceOverview` and `capabilities.uncertainOutcomes`. The dashboard requires uncertainty-aware sending before using an advertised paired action; an older helper gets an update message before any copy or transfer.

Execution requests that lose their acknowledgement return `uncertain` with `mayHaveExecuted:true` and `outcome:"unknown"`. This includes a post-dispatch timeout, unreadable acknowledgement, server5xx, or socket failure after bytes were offered. Known non-executing/preflight failures remain errors. Neither transport retries. The dashboard persists a warning for that target until explicit review/clear, which itself sends nothing. No generic TCP9020/9021 probe is used: a connection can consume a native one-shot payload handoff.

Original-only PS4 BIN actions may opt into `run.input: "user-file"`. The paired, same-origin `/api/run-file` route reads an exact-size raw BIN body in memory with a 3 MiB hard bound and deadline. Its `X-Whatsite-Run` header accepts only the existing five metadata fields. Both browser and sender verify SHA-256 before console contact; the sender validates the curated transport, firmware and file metadata independently. It accepts no arbitrary URL, file path or port and writes no copy to disk. Normal `/api/run` rejects these opt-in actions. The fresh `userSelectedBIN` capability and matching `requiresFile` advertisement are required before the UI opens a file picker. See [original-file loading](host-original-tool-loading.md).

Service checks report connectivity, readiness, the manager's application version, and an IP only if the service supplies one. The application version is **not console firmware**. These endpoints do not identify the active game or establish jailbreak compatibility. Browser user-agent firmware is separately labelled browser-reported and remains subject to manual confirmation.

## Actual transports

| Console service | Supported operation | Result the website can establish |
| --- | --- | --- |
| PS4 GoldHEN HTTP BinLoader, port 9090 | Read `/status`, require JSON `status: ready`, then POST raw BIN bytes to `/` | HTTP 200 or 202 acknowledges acceptance. Injection and game compatibility still need console confirmation. |
| Pinned PS4 9.00 PSFree/Lapse BIN loader, TCP 9020 | Send one checksum-verified, explicitly curated PS4 BIN (at most 3 MiB) and close the sending side; never probe or retry | Bytes were written to the socket. There is no execution acknowledgement. Wait for the console's own listener message first. |
| PS4/PS5 network ELF loader, TCP 9021 | Send raw ELF bytes and close the sending side | Bytes were written to the socket. There is no payload-operation acknowledgement in this transport. |
| PS5 elfldr v0.27, HTTP on port 9021 | GET `/?uri=<encoded-console-reachable-ELF-URL>`; the loader fetches the payload itself | Its HTTP 200 is sent before downloading or spawning. Only URL-request acceptance is established. |
| PS5 Payload Manager v0.6.3, HTTP 8084 | Same-origin reads `/version` and `/getip`; POST `/loadpayload:<encoded-installed-path>` | `OK` means its transfer to the ELF loader completed. It does not certify that the payload's operation succeeded. |

The [PS4 ELF loader](https://github.com/ps4-payload-dev/elfldr/blob/master/README.md#usage-examples) and [PS5 v0.27 ELF loader](https://github.com/ps5-payload-dev/elfldr/blob/v0.27/README.md#usage-examples) document raw TCP transfer on 9021. The current PS5 manager [launcher implementation](https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/src/ps5_launcher.c) also writes raw bytes to its separate local ELF loader. Some console autoloaders deliberately bind that listener only to console loopback. The computer sender cannot contact such a listener; use the installed manager or the autoloader's documented settings instead.

The separate PS4 `bin-tcp` action is fixed to BIN format, PS4 and port 9020. The pinned [PSFree/Lapse source](https://github.com/kmeps4/PSFree/blob/368d82aa40d3017c220757ce315761adb5f06678/lapse.mjs) maps `0x300000` bytes in `runBinLoader()` and reports the waiting port. The sender bounds the complete file to that buffer, refuses ELF magic and does not use an HTTP readiness request. Only the already archived official GoldHEN 2.3 firmware-9.00 build is enabled in this batch; a BIN extension alone is not permission to use this ABI. See [exact repository review and setup](host-repository-review.md).

The GoldHEN HTTP sequence follows the [Nazky PSFree sender](https://github.com/Nazky/PSFree/blob/main/payloads/payloads.js). Its status request is POST when the browser addresses `127.0.0.1`, otherwise GET. No fabricated packet framing or custom native API is used. Direct browser sending requires readable CORS responses and permission to access the HTTP console. BIN bytes are checked with WebCrypto when available or a tested JavaScript SHA-256 fallback for HTTP console browsers. When the browser blocks the connection, use the local sender dashboard. The helper makes the same documented requests from the computer; it does not spoof an Origin to bypass another application's guard.

PS5 elfldr v0.27 also implements a real HTTP URL-launch interface in its [socket server](https://github.com/ps5-payload-dev/elfldr/blob/v0.27/socksrv.c). It explicitly returns permissive CORS for that endpoint; this is an upstream capability, not a change to the native manager's restrictions. `sendPS5ELF` makes an explicit GET with an encoded site-mirror URL at the **actual hosting origin**, and reports only request acceptance. It does not silently substitute the canonical public domain for an unpublished local build. Files must be hosted at a console-reachable public or computer LAN URL; a desktop `localhost`/`127.0.0.1` preview is blocked before requesting the console. Use the computer's LAN URL or the paired sender instead. The native loader's later download and execution are not checksum-verified or acknowledged by this HTTP response. The site's expected checksum remains visible in the catalogue; the local sender independently verifies actual file bytes before transfer. Requests from an HTTPS page are blocked in advance with an explicit loader-navigation URL or local-sender option. A browser can also impose private-network restrictions; those failures remain failures. No automatic retry is made after a possibly delivered request.

## PS5 manager restrictions

[Payload Manager v0.6.3 development documentation](https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/DEVELOPMENT.md) and its [HTTP server](https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/src/http_server.c) restrict mutations and browser API access to the manager's own HTTP origin, including the port. A public page at `whatwhatboy.com` cannot call that API directly. A custom header does not override a foreign Origin. The manager exposes only embedded UI/static assets and fixed APIs; it has no documented arbitrary HTML install route that would place this dashboard at its origin. Consequently, public buttons open its existing native UI rather than pretend that a blocked API call succeeded.

The optional `HostConsoleClient.launchInstalled` method is available only in an actual manager-origin integration. It accepts an ELF path under `/data/pldmgr/payloads/repo/`, `/data/pldmgr/payloads/local/` or `/mnt/usb0/pldmgr/` through `/mnt/usb7/pldmgr/`; the manager remains responsible for existence, canonical-path and ELF validation. Self-launching Payload Manager is refused. This method is not used to install a companion by changing or bypassing the manager's security.

To let the native manager download this site's ready files itself, add `https://whatwhatboy.com/console/ps5/payloads.json` in its source settings. This uses the documented [custom-repository format](https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/CUSTOM_REPOSITORIES.md). A source does not bootstrap the manager itself.

## Documented service links

| Service | URL after the native service is started |
| --- | --- |
| PS5 Payload Manager | `http://CONSOLE_IP:8084/` |
| PS5 websrv file explorer | `http://CONSOLE_IP:8080/fs/` |
| PS5 websrv homebrew launcher | `http://CONSOLE_IP:8080/index.html` |
| PS5 websrv ELF launcher | `http://CONSOLE_IP:8080/elfldr` |
| PS4 ezRemote file manager | `http://CONSOLE_IP:8080/` by default; keep the native app running |
| PS5 ezRemote client web interface | `http://CONSOLE_IP:9090/` by default; keep the native app running |

The PS4 ezRemote URL is distinct from the PS5 websrv `/fs/` route. The [PS4 ezRemote README](https://github.com/cy33hc/ps4-ezremote-client#how-to-access-the-web-interface-) documents the 8080 web UI and its folder creation and RAR/ZIP/7z extraction features. The [PS5 websrv v0.34 README](https://github.com/ps5-payload-dev/websrv/blob/v0.34/README.md#available-services) documents its own routes. Service links are navigation, not an availability test. The displayed console address is entered by the user or returned by `/getip`; this site does not claim that a stock browser discovers a private console IP automatically.

## Lua game loader setup

The PS4 and PS5 catalogue's Lua game loader button opens the upstream [installation procedure](https://github.com/n0llptr/remote_lua_loader/blob/main/SETUP.md). It requires a supported Artemis title and an appropriately prepared, account-matched save. The project provides individual savedata files rather than a packaged release or universally importable encrypted save. No browser launch URL is documented, so this action has no Run button or invented ready-file download.

Its [native sender](https://github.com/n0llptr/remote_lua_loader/blob/main/payloads/send_lua.py) prefixes Lua code with its unsigned 64-bit little-endian byte length on TCP 9026. The [game loader](https://github.com/n0llptr/remote_lua_loader/blob/main/savedata/main.lua) accepts code shorter than 500 KiB and returns text or crash information. This protocol is distinct from raw ELF 9021 and GoldHEN HTTP 9090, and is not implemented by the browser or optional sender here. The upstream [payload documentation](https://github.com/n0llptr/remote_lua_loader/blob/main/payloads/README.md) lists Lapse for PS4 5.00–12.02 and PS5 through 10.01, and UMTX for PS5 through 7.61. Firmware-independent game entry does not establish later kernel support; these reviewed payloads do not establish PS4 13.52 compatibility.

## Browser client API

`assets/host-console-client.js` exposes `window.HostConsoleClient` and a CommonJS export. It makes no requests on import. All network methods return a Promise of an object with `status`, `code` and a human-readable `message`; they never return a synthetic success after a network or CORS failure.

- `normalizeAddress(value)` accepts private IPv4, loopback for native-console browser links, a single local hostname or a `.local` hostname. It rejects URLs, ports, credentials, public IPv4 and external domain syntax. Local-name syntax alone does not establish a device identity.
- `serviceURL(address, service)` builds a documented native link. Service names: `manager`, `files` (PS5 websrv), `homebrew`, `ps4-files`, `ezremote` (PS5), `saves`, `patches`.
- `capabilities(address, {origin})` returns `address`, `managerURL`, `canInspectManager`, `canRunManager`, `code`, `reason`. Both capabilities require exactly the manager's HTTP origin.
- `inspectManager(address, options)` returns `connected`, `unavailable` or `blocked`, plus `version` and `reportedAddress` only after actual readable responses. An unknown `0.0.0.0` address becomes null. Connecting does not run a payload.
- `launchInstalled(address, installedPath, options)` uses the verified manager POST endpoint only at its own origin. `accepted` means a loader transfer completed.
- `inspectGoldHEN(address, options)` checks its documented readiness response. `sendGoldHEN(address, action, options)` requires a local `/downloads/` BIN URL and SHA-256 in `action`, verifies the fetched bytes, then explicitly sends them.
- `elfLaunchURL(address, action, options)` constructs the documented PS5 HTTP loader URL for an ELF mirror at `options.payloadOrigin` or the actual page origin. Loopback origins are refused. `sendPS5ELF(address, action, options)` requests it and returns `accepted` with code `elf-loader-requested` only after HTTP 200; it does not claim a completed download or running payload. A blocked/error result includes `launchURL` for a user-chosen new-tab fallback only when a console-reachable payload origin was available. PS5 catalogue `run.type: elf-http` uses this method directly; the local sender can instead transfer that same action's verified local bytes using raw TCP.
- `inspectBridge(bridgeURL, token, options)` pairs with the localhost sender. The dashboard origin must equal `bridgeURL`; a public page receives `blocked` and a navigation URL instead.
- `inspectConsole(address, platform, options)` makes the explicit read-only paired service check. Supply `options.bridgeURL`, `options.token` and the current `options.origin`. It returns the service connection result, not a guessed firmware or active game.
- `runViaBridge(address, actionId, token, platform, options)` sends only a curated action ID, selected `options.firmware` and optional `options.gameVersion`. `options.bridgeURL` defaults to `http://127.0.0.1:8766`. The sender checks the platform and any pinned firmware/game update again.

Options support injectable `fetch`, `origin`, `crypto` and `timeoutMs` for mock testing. Browser code does not set forbidden Origin/Referer headers, use `no-cors` as a success signal, disable TLS verification or add wildcard CORS to a native service.

## Validation

Run `node --test scripts/tests/host-console-client.test.cjs scripts/tests/console-payload-bridge.test.cjs`. Tests use mock transports, inert test bytes and a temporary localhost HTTP fixture. They do not contact a console, launch exploits or execute downloaded payloads.

## PS4 BIN / ELF loader controls

`/hosts/ps4/loaders/` adds the WebKitty-compatible BIN HTTP 9090 and ELF HTTP 9021 routes, plus paired raw ELF TCP 9021 and the existing PSFree 9.00 BIN TCP 9020 route. The four original KARO BIN launchers remain separate. KARO raw BIN 9021 is not ELF 9021. Ports do not establish payload compatibility.

The compact sender in `docs/ps4-loader-support.json` contains the same paired bridge and the loader page, rather than the full payload library. `/api/loader-status` requires pairing. `/api/loader-file` requires the current pairing token, exact same origin, an uncompressed bounded binary body and fixed-profile metadata in `X-Whatsite-Loader`. Both browser and sender validate size, SHA-256, BIN/ELF shape, firmware selection and explicit payload-compatibility acknowledgement. The server resolves only private LAN destinations, serializes transfers per console, saves no uploaded files, and accepts no custom URL or port. Raw BIN is limited to 3 MiB and PS4 9.00; HTTP and ELF uploads to 32 MiB.

ELF HTTP follows the [pinned WebKitty sender](https://github.com/ArabPixel/WebKitty/blob/ff181af62e0c57d7b74b3ea40b7a166b21424864/includes/js/deliverPayload.js): POST raw bytes to `:9021/<filename>?pipe=0`, content type text/plain, accept HTTP 200/202. The [pinned catalogue](https://github.com/ArabPixel/WebKitty/blob/ff181af62e0c57d7b74b3ea40b7a166b21424864/includes/js/payloadsList.js) limits the standalone exploit BIN listener to older firmware; this is not added as a 14.02 standalone exploit. The included ELF-loader BIN and ELF remain byte-identical to that snapshot.

Selecting the ELF-loader BIN only fetches and hashes it. Sending is a separate gesture; no bootstrap fallback, automatic retry, scanning or payload execution occurs on page load. Uncertain responses remain uncertain. HTTP 202 means accepted, not proof of native execution. Only the HEN chooser keeps its native advertising banner; third-party scripts are excluded from the file-upload/control page.
