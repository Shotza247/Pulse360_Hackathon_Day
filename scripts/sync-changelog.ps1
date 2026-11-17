<#
.SYNOPSIS
  Updates docs/operations/CROSS_REPO_CHANGELOG.md from the git history of both repositories.

.DESCRIPTION
  - Appends commits made since the last sync (per repo) to the ENTRIES section, newest first.
  - Regenerates the PENDING section: commits and uncommitted files not on origin/main.
  - Moves the pin markers forward to each repo's current HEAD.
  The first run has no pins, so pass -SincePulse360 and -SinceRag.

.EXAMPLE
  ./scripts/sync-changelog.ps1 -SincePulse360 f868b6f -SinceRag 84389eb
  ./scripts/sync-changelog.ps1 -DryRun
#>
param(
    [string]$RagPath = $(if ($env:RAG_REPO_PATH) { $env:RAG_REPO_PATH } else { Join-Path $PSScriptRoot '..\.bob\tmp\Supabas_pulse360_RAG' }),
    [string]$SincePulse360,
    [string]$SinceRag,
    [switch]$NoFetch,
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Ledger = Join-Path $RepoRoot 'docs\operations\CROSS_REPO_CHANGELOG.md'
if (-not (Test-Path $RagPath)) { throw "RAG repo not found at '$RagPath'. Pass -RagPath or set RAG_REPO_PATH." }
$RagPath = (Resolve-Path $RagPath).Path

$Repos = @(
    @{ Tag = 'pulse360'; Path = $RepoRoot; Since = $SincePulse360 },
    @{ Tag = 'rag'; Path = $RagPath; Since = $SinceRag }
)

function Invoke-Git([string]$Path, [string[]]$GitArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & git -C $Path @GitArgs 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return $out
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-Section([string]$Text, [string]$Name) {
    $s = "<!-- ${Name}:START -->"; $e = "<!-- ${Name}:END -->"
    $i = $Text.IndexOf($s); $j = $Text.IndexOf($e)
    if ($i -lt 0 -or $j -lt 0) { throw "Missing $Name markers in $Ledger" }
    return $Text.Substring($i + $s.Length, $j - $i - $s.Length)
}

function Set-Section([string]$Text, [string]$Name, [string]$Body) {
    $s = "<!-- ${Name}:START -->"; $e = "<!-- ${Name}:END -->"
    $i = $Text.IndexOf($s); $j = $Text.IndexOf($e)
    if ($i -lt 0 -or $j -lt 0) { throw "Missing $Name markers in $Ledger" }
    return $Text.Substring(0, $i + $s.Length) + $Body + $Text.Substring($j)
}

function Get-Commits([string]$Path, [string]$Range) {
    $lines = Invoke-Git $Path @('log', '--no-merges', '--date=short', '--format=%h%x09%ad%x09%s', $Range)
    foreach ($line in @($lines)) {
        if (-not $line) { continue }
        $p = $line.Split("`t", 3)
        [pscustomobject]@{ Hash = $p[0]; Date = $p[1]; Subject = $p[2] }
    }
}

$text = [IO.File]::ReadAllText($Ledger)
$newCommits = @()
$pending = New-Object System.Text.StringBuilder
[void]$pending.Append("`n")

foreach ($r in $Repos) {
    $tag = $r.Tag; $path = $r.Path
    if (-not $NoFetch) { [void](Invoke-Git $path @('fetch', 'origin', '--quiet')) }

    $head = (Invoke-Git $path @('rev-parse', '--short', 'HEAD')) | Select-Object -First 1
    if (-not $head) { throw "'$path' is not a git repository." }

    $pin = $r.Since
    if (-not $pin) {
        $m = [regex]::Match($text, "<!-- pin:${tag}=(\w+) -->")
        if ($m.Success -and $m.Groups[1].Value -ne 'none') { $pin = $m.Groups[1].Value }
    }
    if (-not $pin) { throw "No pin for '$tag'. Pass -SincePulse360 / -SinceRag on the first run." }

    foreach ($c in (Get-Commits $path "$pin..HEAD")) {
        $newCommits += [pscustomobject]@{ Tag = $tag; Hash = $c.Hash; Date = $c.Date; Subject = $c.Subject }
    }
    $text = [regex]::Replace($text, "<!-- pin:${tag}=\w+ -->", "<!-- pin:${tag}=$head -->")

    # Pending: commits not on origin/main, plus uncommitted files.
    $branch = (Invoke-Git $path @('rev-parse', '--abbrev-ref', 'HEAD')) | Select-Object -First 1
    $ahead = @(Get-Commits $path 'origin/main..HEAD')
    $dirty = @(Invoke-Git $path @('status', '--porcelain') | Where-Object { $_ })
    [void]$pending.Append("**$tag** on ``$branch``: ")
    if ($ahead.Count -eq 0 -and $dirty.Count -eq 0) {
        [void]$pending.Append("nothing pending.`n`n")
        continue
    }
    [void]$pending.Append("$($ahead.Count) commit(s) not in main, $($dirty.Count) uncommitted file(s).`n`n")
    foreach ($c in $ahead) { [void]$pending.Append("- ``$($c.Hash)`` $($c.Subject)`n") }
    foreach ($d in $dirty) { [void]$pending.Append("- uncommitted: ``$($d.Trim())```n") }
    [void]$pending.Append("`n")
}

# Entries: group by date, newest first.
$blocks = New-Object System.Text.StringBuilder
foreach ($g in ($newCommits | Group-Object Date | Sort-Object Name -Descending)) {
    [void]$blocks.Append("### $($g.Name)`n")
    foreach ($c in $g.Group) { [void]$blocks.Append("- **[$($c.Tag)]** ``$($c.Hash)`` $($c.Subject)`n") }
    [void]$blocks.Append("`n")
}

$existing = (Get-Section $text 'ENTRIES').Trim("`r", "`n")
$entries = "`n" + $blocks.ToString().TrimEnd("`n") + $(if ($existing) { "`n`n$existing" } else { '' }) + "`n"
if (-not $blocks.Length) { $entries = "`n$existing`n" }

$text = Set-Section $text 'PENDING' ($pending.ToString().TrimEnd("`n") + "`n")
$text = Set-Section $text 'ENTRIES' $entries

if ($DryRun) {
    Write-Host "Dry run: $($newCommits.Count) new commit(s). Ledger not written."
    Write-Host ($pending.ToString())
} else {
    [IO.File]::WriteAllText($Ledger, $text, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Updated $Ledger with $($newCommits.Count) new commit(s)."
}
