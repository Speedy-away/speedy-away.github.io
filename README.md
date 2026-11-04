# WWB HOST

Independent PS4 / PS5 host site for [whatwhatboy.com](https://whatwhatboy.com/).

- Website: https://speedy-away.github.io/
- Main chooser: /hosts/
- KARO builds: /hosts/karo/

All copied older versions and original native files are preserved in this repository and the existing organized local archive. The Pages builder deploys the active site below its size limit and serves large downloads from exact repository revisions. Original native JavaScript is not rewritten. Files referenced by original offline-cache manifests stay on the Pages origin.

The repaired KARO assembly has 71 source-reviewed native entries, three verified original payload repairs, and 33 downloadable web-host ZIPs. The three historical 7.02 cache manifests were never present upstream; those native entries are explicitly online-only. The unused ambiguous OnionHEN placeholder and Defender-quarantined optional activator sources stay blocked. Physical console execution remains untested.

Build: `node scripts/host-project-pages.cjs tmp/pages-preview` then `node scripts/verify-host-project-pages.cjs tmp/pages-preview`. Use a fresh output directory. GitHub Actions builds and deploys Pages on main. Push large snapshots with `node scripts/push-in-batches.cjs --push --batch-mib=512`. This preserves commits, all old files and resumable upload state.

`docs/migration/source-preservation.json` records checksum readback of the migration. `docs/host-reviews/karo/` records original repair provenance. Original project attributions remain in their files.

Pages serves seven original `.cache` manifests through byte-identical `.manifest` aliases with the required `text/cache-manifest` MIME type. Original files and ready ZIPs remain unchanged. When self-hosting those original ZIPs, configure `.cache` files as `text/cache-manifest`.

The 24 authored host pages share `assets/host-pages.css` and image headings. Run `node scripts/style-host-pages.cjs` after changing page generators; the Pages publisher also applies this theme during deployment. Native runtimes and ready downloads keep their original bytes.

Original-source provenance tests use retained migration evidence from `WHATSITE_PROVENANCE_ROOT` (default: the sibling `whatsite` workspace). Public runtime and download file checks always use this repository. No native payload is executed by these tests.

Console performance mode is automatic on PS4/PS5: the catalogue starts with 12 text entries and the trainer with 18; Show more and search retain access to the complete library. Large artwork is deferred on consoles and hydrated on desktop. Native runtime documents and immutable downloads are excluded from this presentation adaptation. Regression results and deployment verification are in `docs/migration/console-performance.json`; physical-console timing is unmeasured.

Run the complete host, firmware, translation, native-service and sender regression collection with `node scripts/test-root-host.cjs`. It uses no test-name exclusions. Preserve the sibling original-source evidence workspace or set `WHATSITE_PROVENANCE_ROOT` when running historical provenance tests. No physical console is contacted.
