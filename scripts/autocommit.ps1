# OneMan hands-off auto-commit + push watcher (Windows PowerShell).
#
# Run this ONCE. It watches the repo folder and, whenever ANY file changes,
# automatically stages, commits, and pushes to GitHub. No manual git needed.
#
# Usage (PowerShell):
#   cd <repo>
#   powershell -ExecutionPolicy Bypass -File scripts\autocommit.ps1
#
# Optional parameters: -Branch main -Interval 10 -Remote origin -RepoDir <path>

param(
  [string]$RepoDir = (Split-Path -Parent $PSScriptRoot),
  [string]$Branch  = "main",
  [int]$Interval   = 10,
  [string]$Remote  = "origin"
)

Set-Location $RepoDir

git rev-parse --is-inside-work-tree *> $null
if ($LASTEXITCODE -ne 0) {
  Write-Host "[oneman] $RepoDir is not a git repo. Run: git init; git remote add origin <url>"
  exit 1
}

Write-Host "[oneman] watching $RepoDir  (branch: $Branch, every $Interval s)"
Write-Host "[oneman] auto-commit + push is ON. Press Ctrl+C to stop."

while ($true) {
  $status = git status --porcelain
  if ($status) {
    git add -A
    $files = ((git diff --cached --name-only) -join ' ').Trim()
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    git commit -q -m "Auto update $ts" -m "Files: $files" 2>$null
    git pull --rebase --autostash $Remote $Branch *> $null
    git push $Remote $Branch *> $null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[oneman] pushed $ts  ->  $files"
    } else {
      Write-Host "[oneman] committed locally at $ts, but PUSH failed (auth/network?). Will retry next change."
    }
  }
  Start-Sleep -Seconds $Interval
}
