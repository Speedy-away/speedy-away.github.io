WWB Console Files — 1.0.0

1. Install Node.js 22 or newer from https://nodejs.org/ .
2. For ZIP, RAR, 7z, TAR, GZ, TGZ, BZ2 and XZ install 7-Zip from https://www.7-zip.org/ .
3. Extract this entire ZIP. No npm install is needed: basic-ftp 6.2.6 is included with its MIT license.
4. Windows: open Start on this computer.cmd, or Start for phones.cmd for phone/tablet access.
   macOS/Linux: node scripts/console-files-helper.cjs (add --lan for other devices).
5. Open the printed http:// address. For a phone use the computer's LAN address, on the same trusted Wi-Fi.
   Allow the helper through your computer firewall on your private network if prompted. Do not forward its port on your router.
6. Enter the pairing code printed in the terminal. Enable FTP in GoldHEN, enter the console IP and FTP port (normally 2121), then Connect.

The browser talks to this local helper; it cannot open raw FTP directly. The computer must stay on.
FTP usernames/passwords stay in page memory; only the console IP/port are remembered. FTP and the local web connection use plaintext on your trusted LAN.
Use WWB_FILES_PORT to change web port 8787. Use WWB_7ZIP for an absolute alternate 7z executable path before starting.

Files: browse, create folders, move/rename files and save files to this device. Upload files from desktop, Android or iOS Files.
Writes are limited to /data and /mnt/usb0 through /mnt/usb7. Existing filenames are not overwritten. Large files over 256 MiB need a desktop FTP client.
Archives: inspect then extract a selected regular file into temporary helper storage. Each member <=64 MiB, total expanded <=2 GiB, <=5000 entries.
Encrypted, incomplete multipart and duplicate-path archives are not supported. Reported links are rejected; extracted output is always a regular file. For .tar.gz extract the TAR then inspect it again.
Temporary uploads/extracted bytes are cleared on normal helper shutdown. Forced termination may leave a wwb-console-files-* directory in the OS temp folder.

GoldHEN: upload your .prx/.sprx to /data/GoldHEN/plugins. Read /data/GoldHEN/plugins.ini before saving.
Presets use your actual installed CUSA ID and exact plugin filename. Nothing guarantees a plugin matches your firmware or game update.
Entries are commented out unless you choose Enable. Keep other sections/comments. Export your draft before importing or reading another file.
Saving checks the original SHA-256 and refuses intervening edits. Existing config is retained at plugins.ini.bak-TIMESTAMP-RANDOM.
If your config editor or another FTP client is writing simultaneously, stop that operation before saving here.
Enable the plugin loader in GoldHEN settings. No payloads, plugins or downloaded executables are run by this helper.

Sources:
https://github.com/GoldHEN/GoldHEN_Plugins_Repository
https://github.com/patrickjuchli/basic-ftp (6.2.6, MIT)
https://registry.npmjs.org/basic-ftp/-/basic-ftp-6.2.6.tgz
Upstream npm integrity: sha512-0EjZCaodOz6yiokv2JA1VyKGNdGxULZ+GGlPgG9tm4d+T/bHtX1hUch8CumDneBfpIbiSdn7TaCGwpM+gwsOlw==
