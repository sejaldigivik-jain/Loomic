param(
  [int]$Port = 3000,
  [string]$OutputFile = ".socialflow-public-url.txt",
  [string]$PidFile = ".socialflow-cloudflared.pid"
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root

function Find-Cloudflared {
  $cmd = Get-Command cloudflared -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }

  $wingetRoot = Join-Path $env:LOCALAPPDATA "Microsoft\WinGet\Packages"
  if (Test-Path $wingetRoot) {
    $found = Get-ChildItem $wingetRoot -Recurse -Filter "cloudflared.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($found) { return $found.FullName }
  }

  $tools = Join-Path $root "tools"
  New-Item -ItemType Directory -Force -Path $tools | Out-Null
  $exe = Join-Path $tools "cloudflared.exe"
  if (!(Test-Path $exe)) {
    Write-Host "[SocialFlow] Downloading Cloudflare Tunnel once..." -ForegroundColor Cyan
    $url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
    Invoke-WebRequest -Uri $url -OutFile $exe -UseBasicParsing
  }
  return $exe
}

$cloudflared = Find-Cloudflared
$stdout = Join-Path $env:TEMP ("socialflow-cloudflared-" + [guid]::NewGuid().ToString("N") + ".out.log")
$stderr = Join-Path $env:TEMP ("socialflow-cloudflared-" + [guid]::NewGuid().ToString("N") + ".err.log")

Write-Host "[SocialFlow] Starting temporary public HTTPS tunnel..." -ForegroundColor Cyan
$proc = Start-Process -FilePath $cloudflared -ArgumentList @("tunnel", "--url", "http://localhost:$Port", "--no-autoupdate") -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Set-Content -Path (Join-Path $root $PidFile) -Value $proc.Id -Encoding ascii

$deadline = (Get-Date).AddSeconds(45)
$publicUrl = $null
while ((Get-Date) -lt $deadline -and -not $proc.HasExited) {
  Start-Sleep -Milliseconds 500
  $text = ""
  if (Test-Path $stdout) { $text += (Get-Content $stdout -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $stderr) { $text += "`n" + (Get-Content $stderr -Raw -ErrorAction SilentlyContinue) }
  $match = [regex]::Match($text, 'https://[a-zA-Z0-9-]+\.trycloudflare\.com')
  if ($match.Success) {
    $publicUrl = $match.Value.TrimEnd('/')
    break
  }
}

if (-not $publicUrl) {
  if (!$proc.HasExited) { Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue }
  Write-Host "[SocialFlow] Could not create the public tunnel." -ForegroundColor Red
  if (Test-Path $stderr) { Get-Content $stderr -Tail 30 }
  exit 1
}

Set-Content -Path (Join-Path $root $OutputFile) -Value $publicUrl -Encoding ascii
$callback = "$publicUrl/api/oauth/instagram/callback"
try { Set-Clipboard -Value $callback } catch {}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " SOCIALFLOW PUBLIC URL READY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host "Public URL:" -ForegroundColor Yellow
Write-Host $publicUrl -ForegroundColor White
Write-Host ""
Write-Host "Instagram callback (copied to clipboard):" -ForegroundColor Yellow
Write-Host $callback -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Green

Write-Output $publicUrl
