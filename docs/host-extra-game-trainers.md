# Other-game host trainer entries

The host catalogue in `host-extra-game-actions.json` adds 40 existing ready JSON
files: 34 PS4 definitions and six native PS5 definitions. Every entry retains its
exact game update, CUSA/PPSA title ID, unchanged size and SHA-256, original creator
credits and pinned source revision. All 40 website files were compared with their
existing F: archive copies; no new console binary was downloaded or executed.

PS4 additions cover Dying Light, Dying Light 2, Dead Island, Riptide, Dead Island 2,
Fallout 4, The Witcher 3, God of War and Ragnarök, Horizon Zero Dawn and Forbidden
West, Resident Evil HD/0/2/3/4, Elden Ring, Sekiro, DOOM and Eternal, Far Cry 5/6/
Primal, Control, Uncharted 4 and The Lost Legacy, Bloodborne and Cyberpunk 2077.
Source-provided updates and regional files remain separate selectable builds.

Native PS5 additions cover The Last of Us Part II Remastered, Dragon's Dogma 2,
Silent Hill 2, Astro Bot, Black Myth: Wukong and Ghostrunner 2. Their new cover
images were captured from each game's official PlayStation page and visually
checked. These are labelled **game artwork**, not cheat-menu screenshots. Image
sources, sizes and hashes are in `host-extra-game-art.json`.

## Loading and version labels

These definitions use the format and setup documented by the original
[GoldHEN repository](https://github.com/GoldHEN/GoldHEN_Cheat_Repository#usage)
and [etaHEN repository](https://github.com/etaHEN/PS5_Cheats#usage). JSON files are
downloaded or saved, then copied into the native cheat manager's documented
folder. Select and toggle cheats in that manager after opening the exact game.
They never become standalone BIN/ELF Run actions.

**Game update** comes from the unchanged file and filename. **Menu version** is
left null because these files do not declare an independent trainer-release
number. The source commit appears separately as **definition revision**. A
GoldHEN application version is not invented as the cheat's release version.

The PS4 files do not establish native PS5 or PS4-on-PS5 compatibility. The PS5
files explicitly target PPSA/native editions. Five upstream native JSON files
contain a whitespace-only `id`; their pinned filenames and previously reviewed
metadata identify the build, and the original bytes stay unchanged. This is
disclosed in each affected action's requirements.

## Regeneration

```powershell
node scripts/prepare-host-extra-game-actions.cjs --build
```

This reads existing catalogue, ready files and archive records, verifies all
selected hashes and metadata, and writes only the new host action and verification
documents. Optional `--art` captures missing official game artwork into immutable,
hash-named workspace image files; it does not download game executables. The
parent host builder must include `host-extra-game-actions.json` alongside its
existing action catalogues.

Evidence: `host-extra-game-actions-verification.json`. No physical-console
execution or successful cheat effect is claimed by these checks.
