param(
  [ValidateSet('Docs', 'Preparation')]
  [string]$Mode = 'Docs',
  [switch]$Typecheck
)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$baseline = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'baseline.json') | ConvertFrom-Json
$tasks = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot 'tasks.json') | ConvertFrom-Json
function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}
function Read-Git([string[]]$GitArgs) {
  $result = & git -C $repoRoot @GitArgs
  if ($LASTEXITCODE -ne 0) { throw "git failed: $($GitArgs -join ' '), exit $LASTEXITCODE" }
  return $result
}
try {
  $actualRoot = [IO.Path]::GetFullPath((Read-Git @('rev-parse','--show-toplevel')))
  Assert-True ($actualRoot -eq $repoRoot) 'Unexpected repository root.'
  $branch = Read-Git @('branch','--show-current')
  Assert-True ($branch -eq $baseline.branch) "Wrong branch: $branch"
  Assert-True ($tasks.branch -eq $baseline.branch) 'Task branch differs from baseline.'
  Assert-True ($tasks.baseCommit -eq $baseline.baseCommit) 'Task base differs from baseline.'
  & git -C $repoRoot merge-base --is-ancestor $baseline.baseCommit HEAD
  Assert-True ($LASTEXITCODE -eq 0) 'HEAD is not based on the recorded commit.'
  $required = @(
    'AGENTS.md', 'plans/README.md', 'plans/001-lite-local.md',
    'plans/002-lite-restructure.md', 'plans/harness/README.md',
    'plans/harness/RULES.md', 'plans/harness/DECISIONS.md',
    'plans/harness/VERIFICATION.md', 'plans/harness/ERRORS.md',
    'plans/harness/RUN_LOG.md', 'plans/harness/tasks.json',
    'plans/harness/baseline.json', 'plans/harness/verify.ps1'
  )
  foreach ($relative in $required) {
    $file = Join-Path $repoRoot $relative
    Assert-True (Test-Path -LiteralPath $file -PathType Leaf) "Missing file: $relative"
    Assert-True ((Get-Item -LiteralPath $file).Length -gt 0) "Empty file: $relative"
    if ($relative.EndsWith('.md')) {
      $body = Get-Content -Raw -LiteralPath $file
      foreach ($match in [regex]::Matches($body, '\]\(([^)]+)\)')) {
        $target = $match.Groups[1].Value.Split('#')[0]
        if (-not $target -or $target -match '^[a-zA-Z]+:' -or $target.StartsWith('/')) { continue }
        $link = [IO.Path]::GetFullPath((Join-Path (Split-Path $file) $target))
        Assert-True (Test-Path -LiteralPath $link) "Broken local link in $relative : $target"
      }
    }
  }
  $ids = @{}
  foreach ($task in $tasks.tasks) {
    Assert-True (-not $ids.ContainsKey($task.id)) "Duplicate task: $($task.id)"
    Assert-True ($tasks.allowedStatuses -contains $task.status) "Invalid status: $($task.id)"
    $ids[$task.id] = $task
    if ($task.status -eq 'DONE') {
      Assert-True (@($task.evidence).Count -gt 0) "DONE without evidence: $($task.id)"
    }
    if ($task.status -eq 'BLOCKED') {
      Assert-True (-not [string]::IsNullOrWhiteSpace($task.blocker)) "BLOCKED without reason: $($task.id)"
    }
    foreach ($evidence in $task.evidence) {
      $evidenceFile = Join-Path $PSScriptRoot ($evidence.Split('#')[0])
      Assert-True (Test-Path -LiteralPath $evidenceFile -PathType Leaf) "Missing evidence file: $evidence"
    }
  }
  $visited = @{}
  while ($visited.Count -lt $ids.Count) {
    $progress = $false
    foreach ($task in $tasks.tasks) {
      if ($visited.ContainsKey($task.id)) { continue }
      foreach ($dep in $task.dependsOn) {
        Assert-True ($ids.ContainsKey($dep)) "Unknown dependency: $dep"
        if ($task.status -in @('IN_PROGRESS','DONE')) {
          Assert-True ($ids[$dep].status -eq 'DONE') "Unfinished dependency $dep for $($task.id)"
        }
      }
      $waiting = @($task.dependsOn | Where-Object { -not $visited.ContainsKey($_) })
      if ($waiting.Count -eq 0) { $visited[$task.id] = $true; $progress = $true }
    }
    Assert-True $progress 'Cycle in task dependencies.'
  }
  Assert-True (@($tasks.tasks | Where-Object status -eq 'IN_PROGRESS').Count -le 1) 'Multiple active phases.'
  foreach ($protected in $baseline.protectedFiles) {
    $file = Join-Path $repoRoot $protected.path
    Assert-True (Test-Path -LiteralPath $file -PathType Leaf) "Missing protected file: $($protected.path)"
    $hash = (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash
    Assert-True ($hash -eq $protected.sha256) "Protected file changed: $($protected.path)"
  }
  if ($Mode -eq 'Preparation') {
    $changed = @(Read-Git @('diff','--name-only',$baseline.baseCommit,'--'))
    $outsideDocs = @($changed | Where-Object { $_ -ne 'AGENTS.md' -and -not $_.StartsWith('plans/') })
    Assert-True ($outsideDocs.Count -eq 0) "Product changes found: $($outsideDocs -join ', ')"
    $known = @('AGENTS.md') + @($baseline.protectedFiles | ForEach-Object path)
    $untracked = @(Read-Git @('-c','core.quotePath=false','ls-files','--others','--exclude-standard'))
    $unexpected = @($untracked | Where-Object { -not $_.StartsWith('plans/') -and $known -notcontains $_ })
    Assert-True ($unexpected.Count -eq 0) "Unexpected untracked files: $($unexpected -join ', ')"
  }
  if ($Typecheck) {
    Push-Location (Join-Path $repoRoot $baseline.frontend)
    try {
      & npm.cmd run typecheck
      Assert-True ($LASTEXITCODE -eq 0) 'Typecheck failed.'
    } finally { Pop-Location }
  }
  Write-Output "HARNESS PASS: mode=$Mode; tasks=$($ids.Count); branch=$branch; typecheck=$([bool]$Typecheck)"
  Write-Output 'This does not verify lite implementation, build, browser behavior or absence of API requests.'
} catch {
  Write-Error $_ -ErrorAction Continue
  exit 1
}
