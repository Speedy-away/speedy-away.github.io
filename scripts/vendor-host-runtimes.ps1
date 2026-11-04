param([string]$SiteRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
# Downloads deployable web dependencies only; never imports or executes them.
$runtimeSpecs = @(
  @{ Id='ps4-900'; Repo='kmeps4/PSFree'; Commit='368d82aa40d3017c220757ce315761adb5f06678'; Tree='docs/qa/host-runtime-upstream-trees.json' },
  @{ Id='ps5-umtx'; Repo='PS5Dev/PS5-UMTX-Jailbreak'; Commit='2cf6778ebe89ff35255e1c228826d0d2155e9d2a'; Tree='docs/qa/host-runtime-ps5-upstream-tree.json' }
)
$runtimeJobs = foreach ($runtimeSpec in $runtimeSpecs) {
  $runtimeTree = Get-Content -Raw -LiteralPath (Join-Path $SiteRoot $runtimeSpec.Tree) | ConvertFrom-Json
  if ($runtimeSpec.Id -eq 'ps4-900') { $runtimeTree = $runtimeTree | Where-Object repo -eq $runtimeSpec.Repo }
  if ($runtimeTree.commit -ne $runtimeSpec.Commit) { throw 'Unexpected pinned source commit' }
  foreach ($runtimeFile in $runtimeTree.files) {
    if ($runtimeSpec.Id -eq 'ps4-900') {
      # Native GoldHEN is deliberately not republished by this AGPL web build.
      # This host starts the upstream native BIN listener instead.
      if ($runtimeFile.path -in @('goldhen.bin','kpatch/900.o','kpatch/900.d')) { continue }
    } elseif ($runtimeFile.path -notmatch '^document/en/ps5/' -and $runtimeFile.path -notin @('LICENSE','README.md')) { continue }
    if ($runtimeFile.path -match '/hello_world\.elf$') { continue }
    $runtimeRelative = $runtimeFile.path -replace '^document/en/ps5/',''
    [pscustomobject]@{
      Id=$runtimeSpec.Id; Path=$runtimeRelative; SourcePath=$runtimeFile.path; Bytes=[long]$runtimeFile.size
      Url="https://raw.githubusercontent.com/$($runtimeSpec.Repo)/$($runtimeSpec.Commit)/$($runtimeFile.path)"
      Destination=Join-Path $SiteRoot "hosts/runtime/$($runtimeSpec.Id)/upstream/$runtimeRelative"
    }
  }
}
$runtimeResults = $runtimeJobs | ForEach-Object -Parallel {
  $runtimeJob = $_
  $runtimeParent = Split-Path -Parent $runtimeJob.Destination
  New-Item -ItemType Directory -Path $runtimeParent -Force | Out-Null
  if (!(Test-Path -LiteralPath $runtimeJob.Destination)) {
    for ($runtimeAttempt=0; $runtimeAttempt -lt 3; $runtimeAttempt++) {
      try {
        Invoke-WebRequest -Uri $runtimeJob.Url -OutFile ($runtimeJob.Destination + '.partial') -Headers @{'User-Agent'='whatsite-pinned-web-build/1.0'} -TimeoutSec 40
        if ((Get-Item -LiteralPath ($runtimeJob.Destination + '.partial')).Length -ne $runtimeJob.Bytes) { throw 'Upstream byte count mismatch' }
        Move-Item -LiteralPath ($runtimeJob.Destination + '.partial') -Destination $runtimeJob.Destination
        break
      } catch { if ($runtimeAttempt -eq 2) { throw } }
    }
  }
  if ((Get-Item -LiteralPath $runtimeJob.Destination).Length -ne $runtimeJob.Bytes) { throw 'Pinned file size changed' }
  [pscustomobject]@{id=$runtimeJob.Id;path=$runtimeJob.Path;sourcePath=$runtimeJob.SourcePath;url=$runtimeJob.Url;bytes=$runtimeJob.Bytes;sha256=(Get-FileHash -LiteralPath $runtimeJob.Destination -Algorithm SHA256).Hash.ToLowerInvariant()}
} -ThrottleLimit 8
$runtimeResults | Sort-Object id,path | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $SiteRoot 'docs/qa/host-runtime-upstream-files.json') -Encoding utf8NoBOM
# GPL corresponding source for the v0.17 native loader named in upstream history.
# Keep this source separate from the ready native ELF and web build.
$runtimeNativeTree = Get-Content -Raw -LiteralPath (Join-Path $SiteRoot 'docs/qa/host-runtime-elfldr-source-tree.json') | ConvertFrom-Json
if ($runtimeNativeTree.commit -ne '9198efdb02535e6647b00db6d9dac223874b1a87') { throw 'Unexpected native loader source commit' }
$runtimeNativeResults = foreach ($runtimeNativeFile in $runtimeNativeTree.files) {
  if ($runtimeNativeFile.path -match '^\.|^stress-test/') { continue }
  $runtimeNativeDest = Join-Path $SiteRoot ('hosts/runtime/ps5-umtx/corresponding-source/elfldr-v0.17/'+$runtimeNativeFile.path)
  $runtimeNativeUrl = 'https://raw.githubusercontent.com/ps5-payload-dev/elfldr/'+$runtimeNativeTree.commit+'/'+$runtimeNativeFile.path
  if (!(Test-Path -LiteralPath $runtimeNativeDest)) {
    New-Item -ItemType Directory -Path (Split-Path -Parent $runtimeNativeDest) -Force | Out-Null
    Invoke-WebRequest -Uri $runtimeNativeUrl -OutFile $runtimeNativeDest -Headers @{'User-Agent'='whatsite-pinned-web-build/1.0'} -TimeoutSec 40
  }
  if ((Get-Item -LiteralPath $runtimeNativeDest).Length -ne $runtimeNativeFile.size) { throw 'Native source size mismatch' }
  [pscustomobject]@{path=$runtimeNativeFile.path;url=$runtimeNativeUrl;bytes=$runtimeNativeFile.size;sha256=(Get-FileHash -LiteralPath $runtimeNativeDest -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$runtimeNativeResults | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $SiteRoot 'docs/qa/host-runtime-native-source-files.json') -Encoding utf8NoBOM
$runtimeLicenseSource=Join-Path $SiteRoot 'hosts/runtime/ps5-umtx/corresponding-source/elfldr-v0.17/LICENSE'
$runtimeLicenseDest=Join-Path $SiteRoot 'hosts/runtime/ps5-umtx/LICENSE-elfldr'
if (!(Test-Path -LiteralPath $runtimeLicenseDest)) { Copy-Item -LiteralPath $runtimeLicenseSource -Destination $runtimeLicenseDest }
if ((Get-FileHash -LiteralPath $runtimeLicenseSource -Algorithm SHA256).Hash -ne (Get-FileHash -LiteralPath $runtimeLicenseDest -Algorithm SHA256).Hash) { throw 'Native license changed' }
Write-Output "Downloaded and hashed $($runtimeResults.Count) pinned web-build dependencies; no runtime code was executed."
