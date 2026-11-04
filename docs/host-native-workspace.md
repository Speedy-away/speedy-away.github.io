# Console files, payloads and autoload

The PS4 and PS5 hosts have separate File manager and Payload manager pages:

| Console | Files | Payloads and autoload |
| --- | --- | --- |
| PS4 | `/hosts/ps4/files/` | `/hosts/ps4/payload-manager/` |
| PS5 | `/hosts/ps5/files/` | `/hosts/ps5/payload-manager/` |

Each page links its authored, self-contained HTML workspace. The helper must be installed once and opened through the running console's ezRemote Client. The website and desktop preview cannot directly access console storage.

| Console | Copy the matching helper here | Open through ezRemote Client |
| --- | --- | --- |
| PS4 | `/data/whatsite-workspace-ps4.html` | `http://CONSOLE-IP:8080/data/whatsite-workspace-ps4.html` |
| PS5 | `/data/homebrew/ezremote-client/assets/whatsite-workspace-ps5.html` | `http://CONSOLE-IP:9090/data/homebrew/ezremote-client/assets/whatsite-workspace-ps5.html` |

Use the downloaded file for that console. Copy it with ezRemote Client or FTP, keep the native client running, and enter the console's LAN address on the public setup page. The workspace buttons open the correct native address. Append `?view=files`, `?view=payloads` or `?view=autoload` to open a specific view. Opening a page or switching views makes no console API request; use its explicit read/connect control first.

The reviewed contracts are PS4 ezRemote Client 2.08 and PS5 ezRemote Client 2.18. A matching compatible homebrew environment is required. These app versions do not establish firmware support for another payload.

## File and payload operations

The workspace reads directories, downloads files, uploads ready BIN/ELF payloads, creates managed folders and renames managed payloads. It verifies the filesystem after native acknowledgements. Uploads refuse an existing destination; they do not replace a different file. Payload uploads are limited to 8 MiB.

Managed write locations are `/data/payloads`, `/data/whatwhatboy` and, on PS5, `/data/pldmgr/payloads/local`. Read browsing stays under `/data`. This workspace does not guess USB mount roots or claim that a mount number identifies a physical socket. Existing storage/extraction tools remain available through the console's native file manager.

It does not delete files, execute payloads, install packages, extract archives or automatically retry a write. Host Load controls are a separate workflow through a compatible running loader. An ELF/BIN transfer acknowledgement cannot prove execution.

## Autoload

The raw editor reads the actual native file:

- PS4: `/data/GoldHEN/payloads.ini`, including its existing `[AutoRun]` section.
- PS5: `/data/pldmgr/autoload.txt`.

It preserves unchanged lines, existing line endings and unknown entries. It does not invent an entry format or automatically turn on autoload. Follow the installed native app's format and settings. PS4 GoldHEN LaunchPad/AutoRun controls remain on the PS4. The PS5 page also opens the native Payload Manager's autoload, storage and settings screens on port 8084, where users can enable and order its startup list.

Before replacing a changed configuration, the workspace re-reads the original hash, saves its exact bytes to a unique backup, reads and verifies that backup, checks the original again, writes a unique staging file, verifies staging bytes, checks the original again, then renames and verifies the final file. Existing backups and partial staging files are retained. An unchanged editor produces no write.

The native service has no atomic compare-and-swap operation. Stop other native configuration writers while editing; repeated hash checks reduce but cannot eliminate a concurrent-write race. A successful disk edit does not prove a running manager has reloaded it. Review native settings before its next launch.

## Verification and provenance

`docs/host-native-workspace-build.json` records immutable helper URLs, versions, sizes, SHA-256 hashes, install paths, archive jobs and exact native source pins. Previous helper builds are retained. Tests use mocked services and filesystems; no downloaded payload is executed and real console hardware remains untested.
