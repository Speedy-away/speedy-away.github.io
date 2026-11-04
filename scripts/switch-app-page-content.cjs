// Page-specific instructions for pinned Switch builds, separate from shared apps.
module.exports=[
 {id:'jksv',slug:'jksv',purpose:'Back up and restore Switch saves',steps:[
  ['Install the Switch NRO','Copy JKSV.nro to sd:/switch/JKSV/. Open it from hbmenu, preferably through full application mode.'],
  ['Choose the correct save owner','Select the user and title you want to back up. Device/shared saves are a separate save type; do not assume another user’s save is the same data.'],
  ['Export before restoring','Create a named backup of the current save, then keep a separate copy on your computer or backup drive. Confirm that the export completed before changing save data.'],
  ['Restore deliberately','Choose the matching user, game and intended backup. Read JKSV’s restore confirmation carefully. Keep the export made before restoring so you can return to it.'],
  ['Add cloud storage only if needed','Local backups work without cloud setup. Use the project’s Google Drive/WebDAV instructions for optional remote storage and keep account credentials private.']
 ],storage:'sd:/switch/JKSV/JKSV.nro\nSave exports: the backup location configured by JKSV\nKeep an independent copy away from the console.',trouble:'If a title is missing, confirm the selected user/save type and launch mode. Record any displayed error and check the pinned release notes. Do not delete or resize save data to diagnose an unrelated launch issue.'},
 {id:'Checkpoint',slug:'checkpoint',purpose:'Manage local Switch save backups',steps:[
  ['Install the console build','Copy Checkpoint.nro to sd:/switch/Checkpoint/. This page offers the Switch NRO; the project’s 3DS packages are different files.'],
  ['Allow the first scan to finish','Launch from hbmenu on a compatible CFW setup. The initial title scan and working-folder creation can take longer than subsequent launches.'],
  ['Create a named backup','Choose the user and title, then use the backup action. Keep a second copy of the resulting save folder before restoring or transferring anything.'],
  ['Restore the intended save','Select the matching title and backup, then read the restore confirmation. Export the current save first so a previous state remains available.']
 ],storage:'sd:/switch/Checkpoint/Checkpoint.nro\nsd:/switch/Checkpoint/saves/ [generated save backups]\nsd:/switch/Checkpoint/config.json [app settings]',trouble:'For missing titles, check the selected user and let the initial scan finish. If an operation fails, retain the displayed error code and consult the project documentation rather than repeatedly replacing the save.'},
 {id:'ftpd',slug:'ftpd',purpose:'Transfer files over your local network',steps:[
  ['Choose the NRO or complete bundle','Copy ftpd.nro to sd:/switch/ftpd/, or extract the SD ZIP to the card root to retain both the normal and classic variants.'],
  ['Start the server on Switch','Connect the Switch and your FTP client device to the same trusted local network. Open ftpd from hbmenu and read the address shown on its screen.'],
  ['Connect with an FTP client','Use the displayed IP address and port; the store package documents port 5000. Follow the app’s actual settings if they differ. Keep the connection local.'],
  ['Transfer and close cleanly','Copy a small file first and check its destination. Wait for transfers to finish, disconnect the client, then exit ftpd. Do not remove the card during a write.']
 ],storage:'sd:/switch/ftpd/ftpd.nro\nOptional SD bundle also supplies:\nsd:/switch/ftpd-classic/ftpd-classic.nro',trouble:'If a connection fails, confirm both devices are on the same network and use the currently displayed address. Check client/firewall settings. FTP access is not the same as a web-browser download; no router port-forwarding is needed for local transfers.'},
 {id:'NX-shell',slug:'nx-shell',purpose:'Browse and organize microSD files',steps:[
  ['Install the pinned NRO','Copy NX-Shell.nro to sd:/switch/NX-Shell/ and launch it from hbmenu. This is the preserved 4.01 release; a universal current-firmware range is not documented.'],
  ['Browse the intended folder','Start on the microSD card and check the full path before selecting files. Supported file viewers and archive actions are available through the app’s interface.'],
  ['Copy before moving','For important files, make a copy and check the destination before moving or renaming the original. Keep save backups and boot configuration separate from temporary downloads.'],
  ['Finish writes before exiting','Allow copy/extract operations to complete. Back up the affected files before using deletion or changing system-related folders.']
 ],storage:'sd:/switch/NX-Shell/NX-Shell.nro\nYour existing microSD folders remain in place.',trouble:'Check free space, permissions and the selected path if a copy or extraction fails. A source archive may need its complete contents; extracting only an executable can leave dependencies behind.'},
 {id:'NXMP',slug:'nxmp',purpose:'Play local and network media',steps:[
  ['Extract the complete SD bundle','Copy the ZIP contents to the microSD root. Keep sd:/switch/nxmp/nxmp.nro together with its mpv font, languages, configuration and other supplied files.'],
  ['Open a local file first','Launch NXMP from hbmenu and browse to your own supported media. Test a local file before adding a network share. No films, music or other media are included.'],
  ['Configure a network source if wanted','Use the project’s version-appropriate config.ini examples for SMB, SFTP, NFS or HTTP. The linked documentation distinguishes older source syntax from newer per-source sections.'],
  ['Use the playback controls','A selects or toggles playback; B goes back or stops playback. The minus button exits NXMP. Check the project’s control table for additional actions.']
 ],storage:'sd:/switch/nxmp/\n├── nxmp.nro\n├── config.ini\n├── mpv/subfont.ttf\n├── langs/\n└── [other supplied configuration files]',trouble:'If text, menus or playback are broken, confirm the entire bundle was copied. For network failures, check the share type, path and credentials; keep private credentials out of screenshots or shared configuration files.'},
 {id:'Moonlight-Switch',slug:'moonlight',purpose:'Stream PC games to your Switch',extraSources:[['https://github.com/LizardByte/Sunshine','Sunshine · compatible PC streaming host']],steps:[
  ['Install the Switch client','Copy Moonlight-Switch.nro to sd:/switch/Moonlight-Switch/. The NRO is the console client; a compatible streaming host must be installed separately on your PC.'],
  ['Prepare your host and network','Configure a compatible host such as Sunshine on your computer. Put the host and Switch on a network where they can reach each other. Follow the host’s official setup and pairing instructions.'],
  ['Launch with full RAM','Hold R while starting an installed game until hbmenu opens, then launch Moonlight-Switch. The project requires title redirection for full-RAM access.'],
  ['Pair and select an application','Add or discover your host, complete its pairing confirmation and choose an available application. Games run on the PC and stream to the Switch.'],
  ['Tune the stream for your connection','Start with moderate resolution and bitrate. If video stutters, lower the stream settings and check the host/network before changing other console settings.']
 ],storage:'sd:/switch/Moonlight-Switch/Moonlight-Switch.nro\nPC: separately configured compatible streaming host\nBoth devices need a working network path.',trouble:'A black screen or connection failure can come from the host, network or launch mode. Verify that a host application is available and that the console client was launched through title redirection.'},
 {id:'mGBA',slug:'mgba',purpose:'Emulate Game Boy, Game Boy Color and GBA',steps:[
  ['Install the Switch frontend','Copy mgba.nro into sd:/switch/. Open it from hbmenu on a compatible Switch homebrew setup.'],
  ['Prepare your own games','Copy your own supported Game Boy, Game Boy Color or Game Boy Advance dumps to a folder you can find in the emulator’s file browser. No game files are included.'],
  ['Choose BIOS settings if needed','mGBA includes a built-in BIOS implementation. An external BIOS is optional for supported features; if you use one, configure your own matching dump in the emulator.'],
  ['Open a game and protect its saves','Browse to your game, check controls and make an in-game save. Back up save files before changing emulator versions; save states are not a substitute for portable game saves.']
 ],storage:'sd:/switch/mgba.nro\nGame folder: a location you choose on microSD\nSave/BIOS paths: check your emulator configuration.',trouble:'For a title that does not boot, check the dump format, BIOS choice and mGBA compatibility notes. This Switch build is separate from the project’s desktop and 3DS packages.'},
 {id:'melonDS',slug:'melonds',purpose:'Run Nintendo DS software on Switch',steps:[
  ['Install this Switch fork','Copy melonDS.nro to sd:/switch/melonds/. This page preserves ArcDelta’s 7.2.1 recompilation rather than substituting a desktop melonDS build.'],
  ['Supply your DS system dumps','The documented files are bios7.bin (16 KiB), bios9.bin (4 KiB) and firmware.bin (128, 256 or 512 KiB). Use your own dumps and the paths configured by the emulator. These files are not bundled.'],
  ['Choose direct game or firmware boot','Firmware boot needs an original DS/DS Lite firmware dump. Reduced DSi/3DS DS-mode firmware contains settings rather than the required boot code, so it is for direct game boot.'],
  ['Launch and select your game','Use hbmenu application mode, configure the system-file paths, and open your own compatible DS dump. Check the screen layout and input settings before playing.']
 ],storage:'sd:/switch/melonds/melonDS.nro\nRequired separately at configured paths:\n• bios7.bin\n• bios9.bin\n• firmware.bin\nYour own Nintendo DS game dumps',trouble:'A missing-system-file error needs a check of file names, sizes and configured paths. Do not rename an unrelated BIOS to make the error disappear. Performance and compatibility vary by game.'},
 {id:'pNES',slug:'pnes',purpose:'Emulate NES and Famicom games',steps:[
  ['Copy the Switch NRO','Put pnes.nro in sd:/switch/pnes/. This is the console release from pEMU 7.2.'],
  ['Add your NES/Famicom dumps','Use sd:/switch/pnes/roms/ or set your chosen ROM folders in config.cfg. Games are separate from the emulator download.'],
  ['Launch and scan the library','Open pNES in hbmenu and check its configured folders. pEMU 7.x can read optional gamelist.xml metadata inside ROM folders; historic db.xml instructions are not the current library format.'],
  ['Check controls and saves','Open a supported title and set your controls and display preferences. Keep game saves backed up before an emulator update.']
 ],storage:'sd:/switch/pnes/pnes.nro\nsd:/switch/pnes/roms/ [your games]\nconfig.cfg: custom ROM paths\ngamelist.xml: optional folder metadata',trouble:'If the list is empty, confirm your ROM directory setting and file format. The default skin is embedded in the NRO; third-party skins and metadata are optional.'},
 {id:'psnes',slug:'psnes',purpose:'Emulate Super Nintendo games',steps:[
  ['Copy the Switch NRO','Put psnes.nro in sd:/switch/psnes/ and launch it through hbmenu.'],
  ['Prepare your SNES library','Use sd:/switch/psnes/roms/ for your own game dumps, or configure a different directory in config.cfg.'],
  ['Use the current library format','Version 7.x looks for optional gamelist.xml metadata within ROM folders. Keep any custom artwork with its matching metadata; it is separate from the emulator build.'],
  ['Check each game','Configure controls and scaling, then test an in-game save. Enhancement-chip support and performance can differ by game. Keep save backups before updating.']
 ],storage:'sd:/switch/psnes/psnes.nro\nsd:/switch/psnes/roms/ [your games]\nconfig.cfg: custom ROM paths\ngamelist.xml: optional folder metadata',trouble:'Check the ROM path and supported format for an empty list. A game-specific rendering or performance problem is not proof that the NRO was copied incorrectly; consult the project’s compatibility information.'},
 {id:'ppsspp',slug:'ppsspp',purpose:'Preserved PSP emulator for compatible setups',steps:[
  ['Read the current-OS warning first','The official PPSSPP page says this Switch port does not work on the latest Switch OS. This preserved store build is offered for an already compatible setup, without an invented numeric firmware range.'],
  ['Extract the complete bundle','Copy the store ZIP contents to the microSD root, preserving sd:/switch/ppsspp/, its assets and its supplied configuration. A bare PPSSPP_GL.nro is not the complete package.'],
  ['Use title redirection','Open hbmenu by holding R while starting an installed game, then launch PPSSPP_GL.nro. The bundled port instructions require this route and do not support NSP forwarders.'],
  ['Select your own PSP dump','Use the emulator’s browser to choose a supported game dump. Keep in-game saves and configuration backed up before changing the installed build.']
 ],storage:'sd:/switch/ppsspp/\n├── PPSSPP_GL.nro\n├── assets/\n└── config/ppsspp/PSP/ [supplied configuration]\nYour PSP game dumps are separate.',trouble:'If you are on the latest Switch OS, start with the publisher’s incompatibility warning. Recopying the same build or using a forwarder does not establish compatibility. Preserve your previous working setup.'}
].concat(require('./switch-remaining-app-content.cjs'));
