# Headless Frontend Lab run (see .claude/skills/frontend-lab/SKILL.md), billed to an Anthropic API key.
# Scheduled by Windows Task Scheduler; can also be run by hand:
#   pwsh -File scripts/frontend-lab.ps1           # real run
#   pwsh -File scripts/frontend-lab.ps1 -DryRun   # print the claude command, run nothing
#
# The key is read from the user env var FRONTEND_LAB_ANTHROPIC_API_KEY and passed to this process only,
# so other Claude Code sessions keep using the subscription login. --bare guarantees API-key auth.

param(
	[string]$Model = 'claude-sonnet-5-5',
	[string]$ModelName = 'Claude Sonnet 5.5',
	[decimal]$MaxBudgetUsd = 5,
	[switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$logDir = Join-Path $env:LOCALAPPDATA 'frontend-lab\logs'
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir ((Get-Date -Format 'yyyy-MM-dd_HHmm') + '.json')

$claude = (Get-Command claude -ErrorAction Stop).Source

$tools = 'Bash,Read,Edit,Write,Glob,Grep,WebSearch,WebFetch'
$allowed = @(
	'Read', 'Edit', 'Write', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
	'Bash(git *)', 'Bash(pnpm build*)', 'Bash(pnpm astro check*)', 'Bash(ls *)', 'Bash(date*)'
)
$denied = @(
	'Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git push * --force*)', 'Bash(git reset --hard*)',
	'Bash(git config *)', 'Bash(git remote *)'
)

# First-party (Anthropic) design skills only; --bare doesn't load skills, so expose them as readable dirs.
$designDirs = @()
$plugins = Join-Path $HOME '.claude\plugins\installed_plugins.json'
if (Test-Path $plugins) {
	$fd = (Get-Content $plugins -Raw | ConvertFrom-Json).plugins.'frontend-design@claude-plugins-official' | Select-Object -First 1
	if ($fd) { $designDirs += Join-Path $fd.installPath 'skills\frontend-design' }
}
$designDirs += Get-ChildItem (Join-Path $HOME '.claude\skills\synced\*\algorithmic-art') -Directory -ErrorAction SilentlyContinue |
	Select-Object -First 1 -ExpandProperty FullName
$designDirs = @($designDirs | Where-Object { $_ -and (Test-Path (Join-Path $_ 'SKILL.md')) })

$extraPrompt = "You are $ModelName ($Model), running unattended with no human watching. " +
	"Use `"$ModelName`" for the post's author field and in the commit trailer."
if ($designDirs) {
	$extraPrompt += "`n`nDesign guides for step 2 (read the SKILL.md in each; these are the only design skills to use):`n" +
		(($designDirs | ForEach-Object { "- $(Join-Path $_ 'SKILL.md')" }) -join "`n")
}

# --bare skips project skill discovery, so point at the skill file directly.
$prompt = 'Do one Frontend Lab run: read .claude/skills/frontend-lab/SKILL.md and follow it exactly, end to end.'

$claudeArgs = @('-p', $prompt, '--bare', '--tools', $tools)
foreach ($d in $designDirs) { $claudeArgs += '--add-dir', $d }
$claudeArgs += @(
	'--model', $Model,
	'--effort', 'medium',
	'--max-budget-usd', "$MaxBudgetUsd",
	'--permission-mode', 'dontAsk',
	'--allowedTools') + $allowed + @('--disallowedTools') + $denied + @(
	'--append-system-prompt', $extraPrompt,
	'--output-format', 'json'
)

if ($DryRun) {
	"cwd: $repo"
	"log: $log"
	$claudeArgs | ForEach-Object { "  [$_]" }
	exit 0
}

$key = [Environment]::GetEnvironmentVariable('FRONTEND_LAB_ANTHROPIC_API_KEY', 'User')
if (-not $key) { $key = $env:FRONTEND_LAB_ANTHROPIC_API_KEY }
if (-not $key) {
	"FRONTEND_LAB_ANTHROPIC_API_KEY is not set; skipping run." | Set-Content $log
	exit 1
}
$env:ANTHROPIC_API_KEY = $key

Set-Location $repo
& $claude @claudeArgs *> $log
exit $LASTEXITCODE
