# WebKitty payloads for PS4 14.02

The 35 additional choices are pinned to WebKitty commit ff181af62e0c57d7b74b3ea40b7a166b21424864. Its initial.js sets the catalogue ceiling to 14.02. Only payloads whose explicit catalogue rules include that ceiling were imported. Fan thresholds are separate 60/70/80/85°C choices. PlayStation Vue base and 1.24 update remain separate steps: finish the base installation before loading the update.

Existing 13.00 and older payloads, firmware restrictions, standalone loaders and immutable archives remain available. Files merely present in WebKitty's directory without a matching catalogue rule were not relabelled as 14.02-compatible.

## Loading

1. Run your compatible 14.02 HEN and enable its HTTP BIN loader on port 9090.
2. Open the payload catalogue, or BIN / ELF loaders. Choose the installed firmware and payload.
3. For HTTPS or desktop use, download the updated PS4 sender from the loader page, extract into a new folder, run Start Sender.cmd with Node.js 20+, open its localhost page and enter its pairing token.
4. On the loader page, Select library payload prepares and verifies the file. Review requirements and press Send payload. Selecting a file alone sends nothing.

BINs use HTTP 9090. ELF HTTP on 14.02 checks 9021, starts the hash-pinned elfldr.bin through 9090 when needed, waits for the HTTP service, then sends the selected ELF exactly once. The catalogue also uses this flow for its existing PS4 FTP and kernel-log ELF actions when 14.02 is selected. Older firmware retains its separate loader workflow. An uncertain POST is never automatically resent or switched to another transport. An outdated paired sender is rejected for the new automatic route.

Use Update cache on the 14.02 page to fetch the expanded offline generation, which includes these files and the updated sender. Homebrew online installers still need Internet access for the application data they fetch themselves. Linux loaders require their upstream kernel/initramfs/storage preparation.

## Verification and archive

Source blob identities, file sizes and SHA-256 were checked without executing native console bytes. Payload copies and immutable helper ZIPs are retained on F: with source/version inventories in docs/webkitty-payload-inventory.json and docs/webkitty-delivery-inventory.json. Transport tests use mocked console responses. Transfer acceptance does not verify execution on a physical PS4.
