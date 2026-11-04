// App-specific instructions for the preserved Switch builds; never execute them.
module.exports=[
 {id:'hbmenu',slug:'homebrew-menu',purpose:'Launch homebrew from your microSD',steps:[
 ['Install at the SD root','Copy hbmenu.nro directly to sd:/hbmenu.nro. Keep the previous launcher before replacing it.'],
 ['Add your applications','Put ready Switch NROs in /switch/ or their documented subfolders, together with their companion data.'],
 ['Open through your existing CFW','Use the entry point documented by your installed homebrew setup. For applications needing full memory, hold R while starting an installed game until hbmenu opens.'],
 ['Choose an application','Browse the list and launch an app. Copying hbmenu alone does not enable homebrew on a stock console. Follow each app’s launch-mode requirements.']
 ],storage:'sd:/hbmenu.nro\nsd:/switch/ [applications and their data]',trouble:'For an empty list, check /switch/ and the actual .nro filenames. An app may need full application mode even when hbmenu itself works in Album/applet mode.'},
 {id:'ftpsrv',slug:'ftpsrv',purpose:'Configure a local FTP server',steps:[
 ['Extract the complete bundle','Extract the ZIP to the card root, keeping switch/ftpsrv.nro and config/ftpsrv/config.ini. This download is the foreground application, separate from the upstream sysmodule.'],
 ['Configure login','Edit the supplied config.ini using the project examples. Set a username/password or deliberately enable anon=1. Login will fail without the required configuration.'],
 ['Connect locally','Open ftpsrv in hbmenu. Use an FTP client on the same trusted network with the address/port displayed by the app and your configured credentials.'],
 ['Finish before exiting','Test a small transfer, wait for all writes to finish, then disconnect the client before exiting or removing the card.']
 ],storage:'sd:/switch/ftpsrv.nro\nsd:/config/ftpsrv/config.ini [required login settings]',trouble:'For rejected logins, check config.ini first. For connection failures, check the current address/port, local network and firewall. Installing the foreground application does not install a background sysmodule.'},
 {id:'switchident-GUI',slug:'switchident',purpose:'Inspect console and hardware information',steps:[
 ['Copy the graphical build','Put SwitchIdent.nro in /switch/switchident-GUI/. This is GUI version 0.5, separate from the retired console-interface variant.'],
 ['Inspect the relevant screen','Open it from hbmenu and browse the available system, battery and controller readings. Availability can depend on your environment.'],
 ['Record useful diagnostic details','Note the relevant reading and firmware. Redact serial numbers, device identifiers and network addresses before sharing screenshots.']
 ],storage:'sd:/switch/switchident-GUI/SwitchIdent.nro',trouble:'This preserved 2023 release has no documented current firmware range. An unavailable field alone does not establish hardware failure; retain the exact app/system versions when consulting the project.'},
 {id:'Switch_90DNS_Tester',slug:'90dns-tester',purpose:'Check DNS blocking on your active network',steps:[
 ['Install the pinned tester','Put Switch_90DNS_tester.nro in /switch/Switch_90DNS_Tester/. This download preserves store version 1.0.4; upstream 1.1.0 remains a separate release.'],
 ['Choose the network to inspect','Connect through the intended network profile. Set DNS or Atmosphère DNS MITM separately using its own instructions.'],
 ['Read the resolution results','Open the tester through hbmenu and review the tested Nintendo service domains. This diagnostic does not install DNS settings.'],
 ['Retest after network changes','Changing profiles or DNS configuration can change the result. Passing a domain test does not guarantee protection against bans.']
 ],storage:'sd:/switch/Switch_90DNS_Tester/Switch_90DNS_tester.nro',trouble:'Check the active network profile, connectivity and DNS MITM setup for unexpected results. The result concerns the domains tested at that moment, rather than every possible console service.'},
 {id:'OpenSupaplex',slug:'opensupaplex',purpose:'Play Supaplex puzzles on Switch',steps:[
 ['Extract the whole game','Extract the SD ZIP to the microSD root. Keep every supplied file in /switch/OpenSupaplex/; the NRO needs its game resources.'],
 ['Launch through hbmenu','Open OpenSupaplex on your compatible homebrew setup. No compilation or separate commercial ROM is needed.'],
 ['Choose a level','Collect the required infotrons and plan a route to the exit while avoiding falling objects and hazards. Follow the in-game menus and controls.'],
 ['Keep your progress','Back up the game folder and generated progress/settings before changing versions. Retain the matching resource set.']
 ],storage:'sd:/switch/OpenSupaplex/\n├── OpenSupaplex.nro\n└── [all supplied levels, graphics, sound and data]',trouble:'Missing levels or graphics need a check of the full package layout. Avoid an extra nested SD-root folder and preserve your progress before recopying resources.'},
 {id:'2048',slug:'2048',purpose:'Play the number-merging puzzle',steps:[
 ['Install the ready game','Place 2048.nro in /switch/. No build tools or separate commercial game data are needed.'],
 ['Open from hbmenu','Launch 2048 on your existing compatible homebrew setup.'],
 ['Combine matching tiles','Slide the board in a direction to merge equal values. Plan moves to keep space available and build toward 2048. Use the game’s input prompts.']
 ],storage:'sd:/switch/2048.nro',trouble:'Check that the file ends in .nro and is inside /switch/ if the game is missing from hbmenu. Consult the pinned release for launch issues before changing unrelated files.'},
 {id:'SuDokuL',slug:'sudokul',purpose:'Solve Sudoku puzzles on Switch',steps:[
 ['Extract the Switch package','Extract the ZIP to the card root. Keep the supplied /switch/SuDokuL/ folder and resources together.'],
 ['Choose a difficulty','Open SuDokuL in hbmenu, select a difficulty and follow the input prompts to choose cells and enter numbers.'],
 ['Use controller or touch input','The project supports controller and touchscreen input. Follow the Switch build’s controls for entering or clearing values.'],
 ['Preserve progress','Exit through the game’s normal interface. Back up generated saves/settings before replacing the installation.']
 ],storage:'sd:/switch/SuDokuL/\n├── SuDokuL.nro\n└── [all supplied game resources]',trouble:'For missing fonts or resources, check the complete extracted folder. Use the Switch package rather than the project’s PC, Wii, Vita or other platform builds.'},
 {id:'BrogueCE',slug:'brogue-ce',purpose:'Explore a turn-based roguelike dungeon',steps:[
 ['Install the preserved port','Copy brogue.nro to /switch/brogue/. This is Switch port 1.9.2-r2, with no documented current firmware range.'],
 ['Start the game','Launch through hbmenu. The game is complete and needs no separate commercial ROM.'],
 ['Learn the controls','Navigate with directional controls, use A for Enter and B for Escape. Consult in-game help for turn-based actions.'],
 ['Customize if needed','Optional custom key mappings use /switch/brogue/switch_keys. Back up existing mappings and game data before changing the installation.']
 ],storage:'sd:/switch/brogue/brogue.nro\nsd:/switch/brogue/switch_keys [optional key mappings]',trouble:'Consult the port’s controls and in-game help for unfamiliar actions. This historical Switch port is separate from current desktop BrogueCE; their files and versions are not interchangeable.'},
 {id:'Minesweeper',slug:'minesweeper',purpose:'Play touchscreen Minesweeper',steps:[
 ['Copy the game NRO','Place Minesweeper-Switch.nro in /switch/Minesweeper/.'],
 ['Launch in handheld mode','Open it in hbmenu with the touchscreen accessible. This port uses touch input for the board and menu actions.'],
 ['Reveal and mark cells','Use touch to reveal/flag cells and select difficulty. Pinch to resize the board and drag to move it.'],
 ['Exit with Plus','Press Plus when finished. This preserved older port has no documented current firmware range.']
 ],storage:'sd:/switch/Minesweeper/Minesweeper-Switch.nro',trouble:'Use handheld touchscreen input if the board seems unresponsive in docked mode. A missing timer or scoreboard may reflect the port’s features rather than an incomplete download.'},
 {id:'spacenx',slug:'space-game-nx',purpose:'Play a compact space shooter',steps:[
 ['Install the Switch game','Copy spacenx.nro to /switch/. This is preserved version 1.1.'],
 ['Launch through hbmenu','Open Space Game NX on a compatible setup. Its historical 5.x release notes do not establish support for every newer firmware.'],
 ['Play with the supplied controls','Use the gamepad or optional touch controls. This Switch version differs from the Wii U game and has no music.']
 ],storage:'sd:/switch/spacenx.nro',trouble:'No music is a documented property of this version. For launch issues check the pinned Switch port; a Wii U executable is a different build.'},
 {id:'pinballnx',slug:'pinballnx',purpose:'Play a portrait pinball table',steps:[
 ['Keep all runtime files','Extract the SD ZIP to the card root so /switch/pinballnx/ contains pinball.nro and data_romfs/. Keep all table textures/data.'],
 ['Prepare the portrait display','Detach the Joy-Cons and rotate the handheld display to portrait as documented by the project. Open pinballnx from hbmenu.'],
 ['Use the flippers and plunger','L/R operate the flippers. Pull either stick down to draw the plunger, then release to launch the ball.'],
 ['Exit with Plus','Press Plus to close the game. This older 1.0 port has no documented universal current-firmware support.']
 ],storage:'sd:/switch/pinballnx/\n├── pinball.nro\n└── data_romfs/ [table data and textures]',trouble:'A missing table needs a check that data_romfs is next to the executable. Check portrait orientation and controller arrangement before diagnosing input.'},
 {id:'Cpp-Snake-NX',slug:'cpp-snake-nx',purpose:'Play the classic Snake game',steps:[
 ['Install the executable','Copy Cpp-Snake-NX.nro to /switch/Cpp-Snake-NX/. No commercial game data is needed.'],
 ['Open through hbmenu','Launch the preserved 1.1.0 game. This older port has no documented current firmware range.'],
 ['Steer the snake','Use directional controls to reach food and grow while avoiding collisions. Follow the game’s menu prompts to start another round.']
 ],storage:'sd:/switch/Cpp-Snake-NX/Cpp-Snake-NX.nro',trouble:'Check the filename and folder for a missing entry. Retain the exact versions/error for launch failures; this historical port is not documented as universally compatible with current firmware.'},
 {id:'jumpnbump',slug:'jump-n-bump',purpose:'Play a local multiplayer bunny arena',steps:[
 ['Install the Switch build','Copy jumpnbump.nro to /switch/jumpnbump/. This executable is separate from the publisher’s Vita VPK.'],
 ['Prepare local controllers','Gather two to four players with suitable controllers. This game is multiplayer-only.'],
 ['Choose split Joy-Cons if wanted','Press L on controller 1 to toggle split Joy-Con mode. Move using a stick or D-pad and jump with a face button.'],
 ['Start a match','Use the game menu and jump on opponents in the local arena. Consult the project’s control notes for additional options.']
 ],storage:'sd:/switch/jumpnbump/jumpnbump.nro\nTwo to four local players and suitable controllers',trouble:'For a missing player, check pairing and split Joy-Con mode. This port provides local multiplayer rather than a solo campaign.'},
 {id:'SpaceVue',slug:'spacevue',purpose:'Check internal and microSD free space',steps:[
 ['Install the dashboard','Put SpaceVue.nro in /switch/ and open it from hbmenu.'],
 ['Read the storage panels','Compare free, used and total capacity for the internal NAND user partition and microSD. The app reads storage information without formatting or modifying files.'],
 ['Refresh or change the accent','A refreshes values, Minus changes the accent and Plus exits. Readings also refresh automatically.']
 ],storage:'sd:/switch/SpaceVue.nro\nRead-only overview: NAND user partition and microSD',trouble:'Check storage accessibility for an unavailable panel. GiB readings differ from decimal GB printed on a card. The status labels are not a full hardware diagnostic.'},
 {id:'NXthemes_Installer',slug:'nxthemes-installer',purpose:'Install compatible HOME Menu themes',steps:[
 ['Copy the console NRO','Put NXThemesInstaller.nro in /switch/Switch_themes_Installer/. The desktop NxThemeTool is a separate download.'],
 ['Match your system versions','Read the exact release notes. Version 3.0.2 documents firmware 23.0/23.0.1 with Atmosphère 1.12.1 or newer; check other firmware separately.'],
 ['Prepare a matching theme','Put compatible theme files in /themes/, open the installer from hbmenu and follow its prompts to extract HOME Menu resources on your own console.'],
 ['Install with a recovery route','Read this site’s Switch Themes installation/recovery guide before changing HOME Menu. Follow the installer’s prompts and remove incompatible themes before a system update.']
 ],storage:'sd:/switch/Switch_themes_Installer/NXThemesInstaller.nro\nsd:/themes/ [compatible theme files]\nSwitch Themes page: previews, installation and recovery',trouble:'Updating the installer does not update an incompatible theme layout. Use the Switch Themes recovery guide for boot problems and retain your previous working setup. Nintendo HOME Menu resources are not supplied.'},
 {id:'SimpleModManager',slug:'simplemodmanager',purpose:'Apply and organize per-game LayeredFS mods',steps:[
 ['Install the manager','Put SimpleModManager.nro in /switch/SimpleModManager/. The selected store package does not contain a Tesla overlay.'],
 ['Prepare the mod tree','For a romfs mod, use /mods/<Game>/<Mod>/contents/<title-id>/romfs/. Follow the mod’s exact title ID, update and any additional documented paths.'],
 ['Back up existing mod files','Keep your current Atmosphère mod configuration before applying a replacement. Check conflicts between mods targeting the same files.'],
 ['Apply or disable the mod','Open the manager in hbmenu, select the intended game/mod and use its apply/disable actions. Restart the affected game to check the result.']
 ],storage:'sd:/switch/SimpleModManager/SimpleModManager.nro\nsd:/mods/<Game>/<Mod>/contents/<title-id>/romfs/\nApplied files: Atmosphère contents/<title-id>/\nPreserve each mod’s exact documented paths.',trouble:'Check the /mods/ tree for an empty list. For a crash, verify title ID, update and conflicting files, then disable the changed mod. Historic titles/ examples predate contents/; the manager cannot repair incompatible mods.'}
];
