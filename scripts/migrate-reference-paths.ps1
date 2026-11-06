[CmdletBinding()]
param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path.TrimEnd('\')
function ProjectPath([string]$Relative) {
    $full = [IO.Path]::GetFullPath((Join-Path $root $Relative))
    if (-not $full.StartsWith($root + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Path escapes the project root' }
    return $full
}
$source = ProjectPath 'NewSkillReference'
$styles = ProjectPath 'references\styles\custom-motion-shorts'
$archive = ProjectPath 'references\custom-motion-source\custom-motion-shorts.skill'
$inventory = Get-Content -LiteralPath (ProjectPath 'references\reference-motion-inventory.json') -Raw | ConvertFrom-Json
$records = @($inventory | ForEach-Object {
    if ($_.file -eq 'references/custom-motion-source/custom-motion-shorts.skill') { $old = 'NewSkillReference/custom-motion-shorts.skill' }
    elseif ($_.file.StartsWith('references/styles/custom-motion-shorts/')) { $old = $_.file.Replace('references/styles/custom-motion-shorts/', 'NewSkillReference/') }
    else { throw ('Unexpected reference location: ' + $_.file) }
    [PSCustomObject]@{ From = (ProjectPath $old); To = (ProjectPath $_.file); Hash = $_.sha256 }
})
# Verify every file before making changes. Never merge or overwrite a destination.
foreach ($record in $records) {
    $fromExists = Test-Path -LiteralPath $record.From -PathType Leaf
    $toExists = Test-Path -LiteralPath $record.To -PathType Leaf
    if ($fromExists -and $toExists) { throw ('Source and destination both exist: ' + $record.To) }
    if (-not $fromExists -and -not $toExists) { throw ('Reference missing: ' + $record.From) }
    $current = if ($fromExists) { $record.From } else { $record.To }
    if ((Get-FileHash -LiteralPath $current -Algorithm SHA256).Hash -ne $record.Hash) { throw ('Reference content differs: ' + $current) }
}
if (Test-Path -LiteralPath $source) {
    $known = @($records | ForEach-Object { $_.From })
    foreach ($file in Get-ChildItem -LiteralPath $source -File -Recurse -Force) {
        if ($file.FullName -notin $known) { throw ('Unindexed file; preserve and review it first: ' + $file.FullName) }
    }
    foreach ($entry in Get-ChildItem -LiteralPath $source -Recurse -Force) {
        if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw ('Linked path requires review: ' + $entry.FullName) }
    }
}
foreach ($record in $records) {
    if (Test-Path -LiteralPath $record.From -PathType Leaf) {
        $parent = Split-Path -Parent $record.To
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        Move-Item -LiteralPath $record.From -Destination $record.To
    }
}
foreach ($record in $records) {
    if ((Get-FileHash -LiteralPath $record.To -Algorithm SHA256).Hash -ne $record.Hash) { throw ('Post-move integrity failed: ' + $record.To) }
}
# Only empty directories are removed, with no recursive deletion.
if (Test-Path -LiteralPath $source) {
    $folders = @(Get-ChildItem -LiteralPath $source -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending)
    foreach ($folder in $folders) {
        if (@(Get-ChildItem -LiteralPath $folder.FullName -Force).Count -eq 0) { [IO.Directory]::Delete($folder.FullName, $false) }
    }
    if (@(Get-ChildItem -LiteralPath $source -Force).Count -ne 0) { throw 'Source is not empty; it was preserved' }
    [IO.Directory]::Delete($source, $false)
}
[PSCustomObject]@{ VerifiedFiles = $records.Count; StyleRoot = $styles; OriginalSkillArchive = $archive; OldFolderRemoved = (-not (Test-Path -LiteralPath $source)) } | ConvertTo-Json
