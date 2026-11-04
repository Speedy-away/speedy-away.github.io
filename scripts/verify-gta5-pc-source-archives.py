"""Statically verify the requested GTA 5 PC source snapshots; never extract or run them.

Exit 0: every requested archive passed. Exit 1: verification failure.
Exit 2: one or more requested downloads have not completed yet.
Writes the current report and preserves the initial 18-project report once.
"""

from __future__ import annotations

import hashlib
import json
import ntpath
import posixpath
import re
import stat
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "docs/gta5-pc-source-catalog.json"
MANIFEST = ROOT / "downloads/source-codes/gta5-pc/manifest.json"
REPORT = ROOT / "docs/qa/gta5-pc-source-archives.json"
INITIAL_REPORT = ROOT / "docs/qa/gta5-pc-source-archives-initial18.json"
BACKUP_ROOT = Path("F:/whatsite-backup-downloads-etc")
MAX_ENTRIES = 100_000
MAX_UNCOMPRESSED = 2 * 1024**3
MAX_UNCOMPRESSED_OVERRIDE = 16 * 1024**3
MAX_MEMBER_BYTES = 512 * 1024**2
SOURCE_SUFFIXES = {".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx", ".inl"}
BINARY_SUFFIXES = {".exe", ".dll", ".asi", ".lib", ".obj", ".pdb", ".so", ".a", ".o", ".bin", ".sys"}


def digest_file(path: Path) -> tuple[int, str]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(block)
            digest.update(block)
    return size, digest.hexdigest()


def within(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def public_path(local: str) -> Path:
    if not isinstance(local, str) or not local.startswith("/downloads/source-codes/gta5-pc/"):
        raise ValueError("public path is outside the GTA 5 PC source directory")
    if "\\" in local or "\x00" in local or ".." in PurePosixPath(local).parts:
        raise ValueError("unsafe public archive path")
    path = ROOT.joinpath(*PurePosixPath(local.lstrip("/")).parts)
    if not within(path, ROOT / "downloads/source-codes/gta5-pc"):
        raise ValueError("public archive path resolves outside its source directory")
    return path


def safe_member(name: str, expected_root: str) -> None:
    normalized = name.replace("\\", "/")
    if not normalized or "\x00" in normalized or normalized.startswith("/") or ntpath.splitdrive(normalized)[0]:
        raise ValueError("absolute or invalid ZIP member path: " + repr(name))
    parts = normalized.rstrip("/").split("/")
    if any(part in {"", ".", ".."} for part in parts) or any(":" in part for part in parts):
        raise ValueError("unsafe ZIP member path: " + repr(name))
    if parts[0] != expected_root:
        raise ValueError("ZIP member is outside expected root " + expected_root + ": " + repr(name))


def inspect_zip(path: Path, expected_root: str, *, require_sources: bool = True, max_uncompressed: int = MAX_UNCOMPRESSED) -> dict:
    with zipfile.ZipFile(path) as archive:
        members = archive.infolist()
        if not members or len(members) > MAX_ENTRIES:
            raise ValueError("empty archive or member-count limit exceeded")
        total = sum(member.file_size for member in members)
        if total > max_uncompressed or any(member.file_size > MAX_MEMBER_BYTES for member in members):
            raise ValueError("ZIP uncompressed-size verification limit exceeded")
        seen = set()
        symlinks = []
        for member in members:
            safe_member(member.filename, expected_root)
            if member.filename in seen:
                raise ValueError("duplicate ZIP member: " + repr(member.filename))
            seen.add(member.filename)
            if member.flag_bits & 1:
                raise ValueError("encrypted member cannot be verified: " + repr(member.filename))
            if stat.S_ISLNK(member.external_attr >> 16):
                if member.file_size > 4096:
                    raise ValueError("oversized symlink target")
                target = archive.read(member).decode("utf-8")
                if ntpath.splitdrive(target)[0] or target.startswith(("/", "\\")) or "\x00" in target:
                    raise ValueError("absolute or invalid symlink target: " + repr(member.filename))
                resolved = posixpath.normpath(posixpath.join(posixpath.dirname(member.filename), target.replace("\\", "/")))
                if resolved != expected_root and not resolved.startswith(expected_root + "/"):
                    raise ValueError("symlink target escapes archive root: " + repr(member.filename))
                symlinks.append(member.filename)
        bad = archive.testzip()
        if bad is not None:
            raise ValueError("ZIP CRC failure: " + bad)
        files = [member for member in members if not member.is_dir()]
        sources = [member.filename for member in files if member.file_size > 0 and PurePosixPath(member.filename).suffix.lower() in SOURCE_SUFFIXES]
        if require_sources and not sources:
            raise ValueError("archive contains no nonempty C/C++ source or header files")
        binaries = [member.filename for member in files if PurePosixPath(member.filename).suffix.lower() in BINARY_SUFFIXES]
        readmes = [member.filename for member in files if PurePosixPath(member.filename).name.lower().startswith("readme")]
        licenses = [member.filename for member in files if re.match(r"^(?:license|licence|copying|copyright)(?:[._-]|$)", PurePosixPath(member.filename).name, re.I)]
        return {
            "rootFolder": expected_root,
            "memberCount": len(members),
            "fileCount": len(files),
            "uncompressedBytes": total,
            "maxUncompressedBytes": max_uncompressed,
            "crcPassed": True,
            "pathsWithinRoot": True,
            "nonemptySourceFileCount": len(sources),
            "sourcePresence": "present" if sources else "none",
            "sourcePresenceRequired": require_sources,
            "sourcePathExamples": sources[:12],
            "binaryFileCount": len(binaries),
            "binaryPathExamples": binaries[:12],
            "readmeFiles": readmes,
            "licenseFiles": licenses,
            "symlinkFiles": symlinks,
        }


def verify_project(project: dict, manifest_files: list) -> dict:
    content_kind = project.get("contentKind", "source")
    row = {"id": project.get("id"), "repo": project.get("repo"), "commit": project.get("commit"), "edition": project.get("edition"), "contentKind": content_kind, "status": "failed", "errors": []}
    try:
        commit = project["commit"]
        repo = project["repo"]
        if not isinstance(repo, str) or not re.fullmatch(r"[^/\\]+/[^/\\]+", repo):
            raise ValueError("invalid catalog repository")
        if project.get("status") in {"empty", "unavailable"}:
            unavailable = project.get("status") == "unavailable"
            recorded_status = "unavailable" if unavailable else "empty"
            if commit is not None:
                raise ValueError(recorded_status + " repository must not claim an exact commit snapshot")
            if any(file.get("id") == project["id"] and file.get("commit") is None and file.get("status") == "downloaded" for file in manifest_files):
                raise ValueError(recorded_status + " repository has a fake downloaded snapshot record")
            if unavailable and not project.get("availabilityNote"):
                raise ValueError("unavailable repository must record its access failure")
            row.update({"status": "recordedUnavailable" if unavailable else "empty", "sourcePresence": "none", "sourcePresenceRequired": False,
                        "availabilityNote": project.get("availabilityNote"),
                        "verification": "Catalog records an " + recorded_status + " repository; no ZIP is represented as downloadable."})
            return row
        if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("invalid catalog repository or exact commit")
        if content_kind not in {"source", "decompiled-scripts", "metadata", "archive", "data"}:
            raise ValueError("unknown catalog content kind: " + str(content_kind))
        max_uncompressed = project.get("maxUncompressedBytes", MAX_UNCOMPRESSED)
        if isinstance(max_uncompressed, bool) or not isinstance(max_uncompressed, int) or not 0 < max_uncompressed <= MAX_UNCOMPRESSED_OVERRIDE:
            raise ValueError("configured uncompressed limit must be a positive integer no greater than 16 GiB")
        matches = [file for file in manifest_files if file.get("id") == project["id"] and file.get("commit") == commit and file.get("status") == "downloaded"]
        if not matches:
            row["status"] = "incomplete"
            row["errors"].append("exact id/commit has no downloaded manifest record yet")
            return row
        if len(matches) != 1:
            raise ValueError("multiple downloaded manifest records for the same id/commit")
        entry = matches[0]
        for field in ("repo", "branch", "edition"):
            if entry.get(field) != project.get(field):
                raise ValueError("catalog/manifest mismatch: " + field)
        if "Source Code" not in entry.get("archiveRole", []):
            raise ValueError("manifest archive role must include Source Code")
        expected_hash = entry.get("sha256", "")
        expected_bytes = entry.get("bytes")
        if not re.fullmatch(r"[0-9a-f]{64}", expected_hash) or not isinstance(expected_bytes, int) or expected_bytes <= 0:
            raise ValueError("invalid manifest bytes or SHA-256")
        public = public_path(entry["local"])
        backup = Path(entry.get("backupPath", ""))
        if not ntpath.isabs(str(backup)) or not within(backup, BACKUP_ROOT):
            raise ValueError("backup path must remain inside F:/whatsite-backup-downloads-etc")
        if not public.is_file() or not backup.is_file():
            raise ValueError("downloaded record is missing its public or F: backup file")
        row.update({"local": entry["local"], "backupPath": str(backup), "version": entry.get("version"), "bytes": expected_bytes, "sha256": expected_hash})
        for label, file in (("public", public), ("backup", backup)):
            size, digest = digest_file(file)
            if size != expected_bytes or digest != expected_hash:
                raise ValueError(label + " bytes/SHA-256 differ from manifest")
        row.update(inspect_zip(public, repo.rsplit("/", 1)[1] + "-" + commit,
                               require_sources=content_kind in {"source", "decompiled-scripts"},
                               max_uncompressed=max_uncompressed))
        row.update({"status": "passed", "publicHashMatches": True, "backupHashMatches": True})
    except (KeyError, ValueError, OSError, RuntimeError, UnicodeError, zipfile.BadZipFile, NotImplementedError) as error:
        row["errors"].append(str(error))
    return row


def preserve_initial_report() -> None:
    if INITIAL_REPORT.exists() or not REPORT.exists():
        return
    previous = REPORT.read_bytes()
    report = json.loads(previous)
    if report.get("summary", {}).get("requestedProjects") == 18:
        # Preserve exact bytes, never replace a prior historical report.
        with INITIAL_REPORT.open("xb") as stream:
            stream.write(previous)


def main() -> int:
    try:
        preserve_initial_report()
    except (OSError, ValueError) as error:
        print(json.dumps({"status": "failed", "error": "Could not preserve the initial report: " + str(error)}))
        return 1
    report = {
        "checkedAt": datetime.now(timezone.utc).isoformat(),
        "status": "failed",
        "passed": False,
        "policy": "Read-only archive checks; no extraction, source build, executable launch, deletion or original-file modification. Empty or inaccessible repositories remain labelled without ZIPs. README/license records contain names only. The original 18-project report is preserved once.",
        "limits": {"maxMembersPerZip": MAX_ENTRIES, "defaultMaxUncompressedBytesPerZip": MAX_UNCOMPRESSED, "maxConfiguredUncompressedBytesPerZip": MAX_UNCOMPRESSED_OVERRIDE, "maxMemberBytes": MAX_MEMBER_BYTES},
        "securityLimit": "CRC, paths, source-file presence and hashes are verified. This is not a malware audit or a claim that any source builds or works with current GTA Online.",
        "projects": [],
        "errors": [],
    }
    exit_code = 1
    try:
        catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
        if not MANIFEST.exists():
            report["status"] = "incomplete"
            report["errors"].append("download manifest is not present yet")
            exit_code = 2
        else:
            manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
            projects = catalog["projects"]
            files = manifest["files"]
            ids = [project["id"] for project in projects]
            if len(ids) != len(set(ids)):
                raise ValueError("duplicate catalog project IDs")
            report["projects"] = [verify_project(project, files) for project in projects]
            counts = {status: sum(row["status"] == status for row in report["projects"]) for status in ("passed", "empty", "recordedUnavailable", "failed", "incomplete")}
            report["summary"] = {"requestedProjects": len(projects), **counts, "manifestFiles": len(files), "totalSourceFiles": sum(row.get("nonemptySourceFileCount", 0) for row in report["projects"]), "totalBinaryFiles": sum(row.get("binaryFileCount", 0) for row in report["projects"])}
            if counts["failed"]:
                report["status"] = "failed"
            elif counts["incomplete"]:
                report["status"] = "incomplete"
                exit_code = 2
            else:
                report.update({"status": "passed", "passed": True})
                exit_code = 0
    except (KeyError, TypeError, ValueError, OSError) as error:
        report["errors"].append(str(error))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "passed": report["passed"], "summary": report.get("summary"), "report": str(REPORT)}))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
