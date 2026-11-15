# Crew Doctor launcher: opens the app without typing "npm run dev".
# 1) If the app is already running, it just opens the browser.
# 2) Otherwise it installs dependencies (first time only), rebuilds the app when the code
#    changed since the last build, starts the production server in a minimized window and
#    opens the browser. Closing that window ("Crew Doctor - servidor") stops the app.
param([switch]$NoPause, [switch]$NoBrowser)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$port = 3333
$url = "http://localhost:$port"
$Host.UI.RawUI.WindowTitle = 'Crew Doctor'

function Say($msg, $color = 'Cyan') { Write-Host "  $msg" -ForegroundColor $color }
function Test-Up {
  try { (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch { $false }
}
function Finish($code) {
  if (-not $NoPause -and $code -ne 0) { Write-Host ''; Read-Host '  Pulsa Enter para cerrar' | Out-Null }
  exit $code
}

Write-Host ''
Say 'Crew Doctor' 'White'
Write-Host ''

try {
  if (Test-Up) {
    Say 'La app ya estaba abierta.' 'Green'
    if (-not $NoBrowser) { Start-Process $url }
    Finish 0
  }

  if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Say 'Falta Node.js. Instalalo desde https://nodejs.org (version LTS) y vuelve a intentarlo.' 'Yellow'
    Finish 1
  }

  if (-not (Test-Path (Join-Path $root 'node_modules\next'))) {
    Say 'Primera vez: instalando dependencias (1-3 minutos)...'
    & npm install --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'npm install fallo' }
  }

  # Rebuild only when something the app is made of is newer than the last build.
  $buildId = Join-Path $root '.next\BUILD_ID'
  $needBuild = -not (Test-Path $buildId)
  if (-not $needBuild) {
    $built = (Get-Item $buildId).LastWriteTime
    $sources = @('app', 'components', 'lib', 'content', 'public') | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ }
    $newest = Get-ChildItem $sources -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $config = @('package.json', 'next.config.ts', '.env.local') | ForEach-Object { Join-Path $root $_ } | Where-Object { Test-Path $_ } | Get-Item
    $latest = @($newest) + @($config) | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $needBuild = $latest -and $latest.LastWriteTime -gt $built
  }
  if ($needBuild) {
    Say 'Preparando la app (solo cuando hay cambios, ~1 minuto)...'
    & npm run build
    if ($LASTEXITCODE -ne 0) { throw 'la compilacion fallo' }
  }

  Say 'Iniciando el servidor...'
  $next = Join-Path $root 'node_modules\next\dist\bin\next'
  Start-Process -FilePath 'cmd.exe' -WorkingDirectory $root -WindowStyle Minimized `
    -ArgumentList "/c title Crew Doctor - servidor (cierra esta ventana para detener la app) && node `"$next`" start -p $port"

  for ($i = 0; $i -lt 60 -and -not (Test-Up); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Test-Up)) { throw "el servidor no respondio en $url" }

  Say "Lista: $url" 'Green'
  Say 'Para cerrar la app, cierra la ventana minimizada "Crew Doctor - servidor".' 'DarkGray'
  if (-not $NoBrowser) { Start-Process $url }
  Start-Sleep -Seconds 2
  Finish 0
}
catch {
  Say "No se pudo abrir la app: $($_.Exception.Message)" 'Red'
  Finish 1
}
