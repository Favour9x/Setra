param(
  [switch]$SkipLoginCheck,
  [switch]$Help
)

if ($Help) {
  Write-Host @"
Usage: .\scripts\deploy-vercel.ps1 [options]

Sets all env vars from .env.local on Vercel and deploys.

Options:
  -SkipLoginCheck   Skip the Vercel login check

Steps:
  1. Ensures you're logged into Vercel CLI
  2. Links/creates a Vercel project
  3. Adds all env vars from .env.local
  4. Deploys with 'vercel --prod'
"@
  exit 0
}

$ErrorActionPreference = "Stop"

# Step 1: Check login
if (-not $SkipLoginCheck) {
  Write-Host "`n=== Checking Vercel login ===" -ForegroundColor Cyan
  $whoami = & vercel whoami 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Not logged in. Opening browser for login..." -ForegroundColor Yellow
    Write-Host "After logging in, run this script again." -ForegroundColor Yellow
    & vercel login
    exit 1
  }
  Write-Host "Logged in as: $whoami" -ForegroundColor Green
}

# Step 2: Ensure project is linked
Write-Host "`n=== Linking Vercel project ===" -ForegroundColor Cyan
$linkCheck = & vercel link --yes 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Host "Failed to link project. Creating new project..." -ForegroundColor Yellow
  # 'vercel' without any command will prompt to create a new project
  # We need a non-interactive way - try with --yes
  $linkResult = & vercel --yes 2>&1
  if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not create Vercel project. Try running 'vercel' manually first." -ForegroundColor Red
    Write-Host $linkResult
    exit 1
  }
}

# Step 3: Read .env.local and add all vars
Write-Host "`n=== Adding environment variables ===" -ForegroundColor Cyan
$envFile = Join-Path (Get-Item $PSScriptRoot).Parent.FullName ".env.local"
if (-not (Test-Path $envFile)) {
  Write-Host "ERROR: .env.local not found at $envFile" -ForegroundColor Red
  exit 1
}

$lines = Get-Content $envFile
$skipped = 0
$added = 0

foreach ($line in $lines) {
  $trimmed = $line.Trim()
  if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
    $skipped++
    continue
  }

  # Parse key=value (handles values with = in them by splitting on first =)
  $eqIndex = $trimmed.IndexOf("=")
  if ($eqIndex -lt 0) {
    $skipped++
    continue
  }
  $key = $trimmed.Substring(0, $eqIndex).Trim()
  $value = $trimmed.Substring($eqIndex + 1).Trim()

  # Determine environments
  if ($key -like "NEXT_PUBLIC_*") {
    $envs = "preview,development,production"
  } else {
    $envs = "preview,development,production"
  }

  Write-Host "  Setting $key..." -NoNewline
  $result = $value | vercel env add $key $envs --yes 2>&1
  if ($LASTEXITCODE -eq 0) {
    Write-Host " OK" -ForegroundColor Green
    $added++
  } else {
    Write-Host " FAILED" -ForegroundColor Red
    Write-Host "    $result" -ForegroundColor DarkRed
  }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "  Lines read:     $($lines.Length)" -ForegroundColor White
Write-Host "  Comments/blanks: $skipped" -ForegroundColor Gray
Write-Host "  Env vars added: $added" -ForegroundColor Green

# Step 4: Deploy
Write-Host "`n=== Deploying to Vercel ===" -ForegroundColor Cyan
$deploy = & vercel --prod --yes 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Host "`n✅ Deployed successfully!" -ForegroundColor Green
  Write-Host "   Check the output above for your URL." -ForegroundColor Green
} else {
  Write-Host "`n❌ Deployment failed:" -ForegroundColor Red
  Write-Host $deploy
}
