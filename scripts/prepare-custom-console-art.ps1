$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$artRoot = [IO.Path]::GetFullPath((Join-Path $repoRoot 'assets/images/custom-console-art'))
$promptFiles = @(
    'docs/image-prompts/custom-console-hardware.json',
    'docs/image-prompts/custom-console-softmod.json',
    'docs/image-prompts/custom-console-vita-legacy.json'
)
$jpegEncoder = [Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object MimeType -eq 'image/jpeg'
$entries = @()
foreach ($promptFile in $promptFiles) {
    $group = Get-Content -LiteralPath (Join-Path $repoRoot $promptFile) -Raw | ConvertFrom-Json
    foreach ($entry in $group.images) {
        $source = [IO.Path]::GetFullPath((Join-Path $repoRoot $entry.path.TrimStart('/')))
        if (-not $source.StartsWith($artRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Artwork source is outside the intended folder.' }
        $original = [Drawing.Image]::FromFile($source)
        $bitmap = $null; $graphics = $null; $stream = $null; $parameters = $null
        try {
            $scale = [Math]::Min(1.0, 1280.0 / $original.Width)
            $width = [int][Math]::Round($original.Width * $scale)
            $height = [int][Math]::Round($original.Height * $scale)
            $bitmap = [Drawing.Bitmap]::new($width, $height, [Drawing.Imaging.PixelFormat]::Format24bppRgb)
            $graphics = [Drawing.Graphics]::FromImage($bitmap)
            $graphics.Clear([Drawing.Color]::Black)
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality
            $graphics.PixelOffsetMode = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.DrawImage($original, 0, 0, $width, $height)
            $parameters = [Drawing.Imaging.EncoderParameters]::new(1)
            $parameters.Param[0] = [Drawing.Imaging.EncoderParameter]::new([Drawing.Imaging.Encoder]::Quality, [long]88)
            $stream = [IO.MemoryStream]::new()
            $bitmap.Save($stream, $jpegEncoder, $parameters)
            $bytes = $stream.ToArray()
            $sha = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)).ToLowerInvariant()
            $destination = [IO.Path]::ChangeExtension($source, '.jpg')
            if ((Test-Path -LiteralPath $destination) -and (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) {
                $destination = Join-Path $artRoot ([IO.Path]::GetFileNameWithoutExtension($source) + '-' + $sha.Substring(0, 12) + '.jpg')
            }
            if (-not (Test-Path -LiteralPath $destination)) {
                $output = [IO.FileStream]::new($destination, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
                try { $output.Write($bytes, 0, $bytes.Length) } finally { $output.Dispose() }
            } elseif ((Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToLowerInvariant() -ne $sha) { throw 'Refusing to replace different artwork.' }
            $entries += [ordered]@{
                id = $entry.id
                image = '/' + [IO.Path]::GetRelativePath($repoRoot, $destination).Replace('\', '/')
                original = $entry.path
                originalSha256 = $entry.sha256
                promptFile = $promptFile
                prompt = $entry.prompt
                refinementPrompt = $entry.refinementPrompt
                width = $width; height = $height; bytes = $bytes.Length; sha256 = $sha
            }
            Write-Output ($entry.id + ': ' + $width + 'x' + $height + ', ' + $bytes.Length + ' bytes')
        } finally {
            if ($parameters) { $parameters.Dispose() }
            if ($stream) { $stream.Dispose() }
            if ($graphics) { $graphics.Dispose() }
            if ($bitmap) { $bitmap.Dispose() }
            $original.Dispose()
        }
    }
}
if ($entries.Count -ne 9 -or @($entries.id | Select-Object -Unique).Count -ne 9) { throw 'Expected nine distinct artwork assets.' }
$catalog = [ordered]@{ mode = 'built-in imagegen'; note = 'Original illustrative artwork, not software screenshots or wiring diagrams. PNG originals retained; JPEG renditions resized and encoded for web delivery.'; promptFiles = $promptFiles; images = $entries }
[IO.File]::WriteAllText((Join-Path $repoRoot 'docs/custom-console-art.json'), ($catalog | ConvertTo-Json -Depth 7) + [Environment]::NewLine)
