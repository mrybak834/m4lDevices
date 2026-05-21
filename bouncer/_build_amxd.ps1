param(
    [string]$JsonPath = "_patcher.json",
    [string]$OutPath  = "bouncer.amxd"
)

# Resolve paths relative to the script's own location so the build works
# regardless of the caller's working directory (PowerShell's Push-Location
# doesn't move .NET's CWD).
$scriptDir = Split-Path -Parent $PSCommandPath
if (-not [System.IO.Path]::IsPathRooted($JsonPath)) { $JsonPath = Join-Path $scriptDir $JsonPath }
if (-not [System.IO.Path]::IsPathRooted($OutPath))  { $OutPath  = Join-Path $scriptDir $OutPath  }

$json = [System.IO.File]::ReadAllText($JsonPath)
$json = $json -replace "`r`n", "`n"
$json = $json -replace "`n", "`r`n"
$jsonBytes = [System.Text.Encoding]::UTF8.GetBytes($json + " ")

$len = $jsonBytes.Length
$header = [byte[]](
    0x61, 0x6d, 0x70, 0x66,
    0x04, 0x00, 0x00, 0x00,
    0x61, 0x61, 0x61, 0x61,
    0x6d, 0x65, 0x74, 0x61,
    0x04, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
    0x70, 0x74, 0x63, 0x68
)
$lenBytes = [System.BitConverter]::GetBytes([uint32]$len)

$all = New-Object byte[] ($header.Length + $lenBytes.Length + $jsonBytes.Length)
[System.Buffer]::BlockCopy($header,    0, $all, 0,                                      $header.Length)
[System.Buffer]::BlockCopy($lenBytes,  0, $all, $header.Length,                         $lenBytes.Length)
[System.Buffer]::BlockCopy($jsonBytes, 0, $all, $header.Length + $lenBytes.Length,      $jsonBytes.Length)

[System.IO.File]::WriteAllBytes($OutPath, $all)
"Wrote $OutPath  (json=$len bytes, total=$($all.Length) bytes)"
