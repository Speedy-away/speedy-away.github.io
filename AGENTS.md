# Site downloads and local archive

When adding a downloadable mod menu, script, payload or console tool to the site,
also save its relevant ready-to-use file locally in
`F:\whatsite-backup-downloads-etc`. Keep its source URL, version, size and SHA-256
in the download inventory. Do not execute downloaded payloads.

Keep every existing download and older version. Organizing files may move or
rename them within the backup, but must not delete files, replace a different
file at a destination, or discard duplicate versions. Keep source code separate
from ready-to-use builds and desktop/mobile helpers. Use
`scripts/download-archive-layout.cjs` for the platform/game folder layout.

For new GitHub entries, download relevant release assets, rather than cloning
the entire repository or every OS variant. Download a source-code archive only
when that is the requested item. Bstlar downloads remain skipped unless the
user explicitly asks to include them. Record inaccessible links truthfully.

An on-demand request such as **"check and download the latest local console
updates"** should use `scripts/update-local-downloads.cjs --download`, then
refresh the organized archive index. A check-only request uses `--check`.
Do not create a scheduled monitor unless the user asks for one. Preserve pinned
game/firmware compatibility on website links; a new upstream version is not
permission to silently change an existing compatibility-specific entry.

Follow normal sandbox/permission tooling for F: writes. The user has explicitly
requested this local-saving workflow; do not repeatedly ask whether to keep
routine new downloads in the archive.

# Multi-game Call of Duty resources and PS3 variants

MultiCOD means a resource supports more than one Call of Duty game. This applies
across PS3, PS4, PS5, Xbox 360 and other platforms. Give every source-confirmed
supported game its own page and cross-list the resource there; a MultiCOD index
may group those entries but is not a game. Do not infer game, region, update or
platform compatibility from the MultiCOD label alone.

DEX and HEN download variants apply to PS3 only. When the source supplies both,
keep both downloads visible and separately labelled, including Jimbo's DEX and
HEN builds. Preserve each original file, version and compatibility requirement.

# Resume ongoing console expansion

Read `docs/migration/status.json` before resuming the current console
expansion. It records completed work, exact final helper versions, archive
verification, remaining checks and the latest user clarifications. Update it
after finishing work so a later session can continue without replacing shared
changes or losing older downloads.

# Independent host repository

Public URL https://speedy-away.github.io/wwb-host/. Main site https://whatwhatboy.com/. Keep original native runtime and immutable downloadable bytes unchanged. All Pages prefix and repository-download adaptation belongs to scripts/host-project-pages.cjs and assets/host-project-routing.js. Do not execute native console files during testing. Never restore or refetch the recorded Defender-quarantined sources. Preserve all prior snapshots. The source history remains in whatsite; this repository owns future host changes. Use bounded/resumable pushes. Read docs/migration before broad generators; some retained historical maintenance tools require private original-source staging from the local archive.

# Oversized sender delivery

Sender ZIPs at or above 95 MiB stay in the working folder and F: archive, never in Git. Package/archive first, then run `node scripts/release-console-payload-sender.cjs` to publish and verify the immutable release asset before pushing its download metadata. Preserve older ZIPs/releases. The manifest keeps its local `url` identity and uses `publicDownloadURL` for delivery; the Pages publisher must retain that release alias even when the ignored ZIP is absent from checkout. Never replace a published different asset.
