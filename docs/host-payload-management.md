# PS4 and PS5 payload management

The host pages use the console address you enter. A phone or PC needs the console's LAN address; `127.0.0.1` means the device running the browser and is appropriate only inside the console browser. Keep the firmware selection matched to the installed firmware and follow the chosen loader's own requirements.

**Download** keeps a copy on the browsing device. **Save on console** uses a compatible console download service to write a file. **Run** sends a payload to a compatible running loader. These are separate actions: a transferred file does not prove successful execution, and sending a payload does not necessarily save it on the console.

## PS5: Payload Manager

[PS5 Payload Manager by itsPLK](https://github.com/itsPLK/ps5-payload-manager) is a PS5 application. Its dashboard runs at `http://CONSOLE-IP:8084/` after the payload has been loaded. The reviewed release is [v0.6.3](https://github.com/itsPLK/ps5-payload-manager/releases/tag/v0.6.3). Its native interface manages installed payloads, uploads, USB imports, repository downloads and an ordered autoload list.

1. Start the firmware-compatible exploit or autoloader you already use. The manager does not replace that initial setup.
2. If the chosen autoloader already starts Payload Manager, open its dashboard. Otherwise load the saved `pldmgr_v0.6.3.elf` through the compatible ELF loader, using the host's explicit Run action or your existing sender.
3. Open the manager using the configured console address. From another device, it must be reachable on the same local network.
4. Open **Get Payloads** to choose a repository download or upload a file. Use the native USB import controls to copy a discovered USB payload into managed storage. Choose copying when you want to retain the USB original.
5. Return to the dashboard to view installed payloads. Use its **Manage** control for deletion. Review the exact selected file and compatibility before using its Run control.

The [v0.6.3 hash router](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/frontend/src/hooks/useHistoryNavigation.js) supports these native destinations. Replace `CONSOLE-IP` with your console address:

| Destination | Address |
| --- | --- |
| Installed payloads | `http://CONSOLE-IP:8084/#/` |
| Autoload order and delays | `http://CONSOLE-IP:8084/#/autoload` |
| Get Payloads | `http://CONSOLE-IP:8084/#/storage` |
| Settings | `http://CONSOLE-IP:8084/#/settings` |
| Repository sources | `http://CONSOLE-IP:8084/#/sources` |
| Active processes | `http://CONSOLE-IP:8084/#/processes` |

The public host opens these native pages because the manager [requires its own origin for browser operations](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/src/http_server.c). Public-page JavaScript cannot directly change its queue or upload a payload to it. The dashboard's Manage mode also requires its native control; adding a guessed URL query does not reliably open it.

### Configure PS5 autoload

Open **Autoload**, add installed payloads, move them up or down, and insert delay steps where needed. Enable the sequence and wait until the native editor has saved successfully. **Settings → Autoload Delay** controls the startup countdown; a sequence delay is a separate wait between entries. **Return After Autoload** optionally returns to the dashboard after a fully successful sequence. The sequence runs when Payload Manager starts. Use the native abort control to cancel the current sequence. [Autoload editor source](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/frontend/src/components/views/AutoloadView.jsx), [settings source](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/frontend/src/components/views/SettingsView.jsx).

The manager stores its queue at `/data/pldmgr/autoload.txt` and settings at `/data/pldmgr/pldmgr_config.txt`. Its queue uses installed slot keys and `!N` delay entries, where `N` is milliseconds. Let its UI write those keys; copying display filenames into this file can select the wrong item or fail after an update. [Pinned configuration paths](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/include/pldmgr.h), [sequence parser](https://github.com/itsPLK/ps5-payload-manager/blob/3f881e8e569eba3054d1784a1962439b2eee92c2/src/autoload.c).

Your exploit/autoloader can also have its **own** `autoload.txt`. Current itsPLK autoloaders document a `ps5_autoloader` folder on USB or at `/data/ps5_autoloader`, containing case-sensitive payload filenames and optional `!1000` waits. Their manual configuration takes precedence over automatically starting the manager. To let the manager own your regular payload order, place its ELF there as `pldmgr.elf` and use `pldmgr.elf` as the only entry in that autoloader sequence; keep the other entries in the manager's native Autoload page. Back up an existing sequence before changing it, and follow the exact documentation for the autoloader version you installed. [Manager installation](https://github.com/itsPLK/ps5-payload-manager/blob/v0.6.3/README.md), [Y2JB instructions](https://github.com/itsPLK/ps5-y2jb-autoloader/blob/main/README.md), [BD-JB instructions](https://github.com/itsPLK/ps5-bdjb-autoloader/blob/main/README.md), [Lua instructions](https://github.com/itsPLK/ps5-lua-autoloader/blob/main/README.md).

### PS5 loader ports: 9020 and 9021

Some exploit entry points initially provide a basic ELF loader on **9020**. The upstream ELF loader's documented bootstrap sends `elfldr-ps5.elf` to that initial loader. Once active, the persistent ELF loader receives normal payloads on **9021**. Those ports describe different stages; do not send every payload to 9020 or assume 9021 exists before the loader starts. Use the host action that matches the installed exploit and firmware. [Official ELF loader quick start and usage](https://github.com/ps5-payload-dev/elfldr#quick-start).

Current itsPLK autoloaders include a custom ELF loader that accepts connections from the console itself by default. A desktop sender can therefore be unable to reach 9021 while the native manager still works. Their README explains an optional replacement for users who deliberately need network sending; the host does not silently replace it. [Y2JB loader note](https://github.com/itsPLK/ps5-y2jb-autoloader#additional-info).

## PS4: GoldHEN LaunchPad and AutoRun

PS4 uses GoldHEN's own **PayLoader LaunchPad** and **AutoRun Queue**. SiSTRo introduced these features in [GoldHEN v2.4b18.10](https://ko-fi.com/s/d64a916507). An older GoldHEN release may lack them. Preserve the firmware-compatible GoldHEN build already selected by your host; a newer release number alone does not establish compatibility.

1. Load the compatible GoldHEN build and check that its Utilities menu includes PayLoader LaunchPad and AutoRun Queue.
2. Use the PS4 file manager/downloader, or GoldHEN FTP on port **2121**, to place the compatible BIN or ELF in `/data/payloads/`.
3. On the console, open **GoldHEN → Utilities → PayLoader LaunchPad**. Select the payload to start it once.
4. To make it start whenever GoldHEN loads, highlight the payload and press **Square** to add it to AutoRun Queue.
5. Open **AutoRun Queue** and review the enabled entry. When changing versions, disable the old entry before adding the replacement so both versions are not started.

These steps and the storage directory are documented by the [Control4Free author](https://github.com/MoHadiShibli/Control4Free/blob/main/docs/installation.md). The [HEN Rest keeper guide](https://github.com/j117mw3/ps4-hen-rest/blob/main/keeper/README.md) also documents LaunchPad and the enabled AutoRun Queue entry on GoldHEN 2.4b18.12.

The queue is stored at `/data/GoldHEN/payloads.ini`. Control4Free documents this example for its own service:

```ini
[AutoRun]
/user/data/payloads/control4free.elf = 1
```

That source recommends copying the service into `/data/payloads/` and shows the registration above with `/user/data/`. This guide preserves those exact documented forms; it does not assert that the two paths are interchangeable for every tool. Prefer the native Queue UI and the actual entry it creates. The complete generic order/delay format is not documented in the reviewed primary sources, so the host does not overwrite the INI with a guessed queue format.

GoldHEN's **9090** port is its PayLoader/BinLoader receiver when enabled. It is a payload transport service, not a web-based file manager or queue editor. Use the real file-manager service for files and GoldHEN's native controls for the PS4 queue. [Official GoldHEN ports](https://github.com/GoldHEN/GoldHEN/blob/master/README.md).

The PS5 Payload Manager ELF and its port 8084 interface are not confirmed for PS4 and must not be offered as a PS4 manager. Console file management and payload management are separate services on both platforms.

The linked behavior was checked against primary documentation and source on 2 November 2026. No physical-console transfer, installation or execution was tested during this review.
