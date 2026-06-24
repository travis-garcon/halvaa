param(
  [int]$Minutes = 20
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root "backend"
$frontend = Join-Path $root "frontend"

Write-Host "Starting Docker dependencies..."
docker compose up -d db redis local-map

Write-Host "Starting backend for $Minutes minute(s)..."
$backendProcess = Start-Process -PassThru -NoNewWindow -FilePath "python" -ArgumentList @(
  "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"
) -WorkingDirectory $backend

Write-Host "Starting frontend for $Minutes minute(s)..."
$frontendProcess = Start-Process -PassThru -NoNewWindow -FilePath "pwsh" -ArgumentList @(
  "-NoProfile", "-Command", "Set-Location '$frontend'; npm run dev"
)

try {
  Write-Host "Dev stack running. Backend PID: $($backendProcess.Id), Frontend PID: $($frontendProcess.Id)"
  Write-Host "Frontend: http://localhost:3000"
  Write-Host "Backend:  http://localhost:8000"
  Write-Host "Map:      http://localhost:8081"
  Start-Sleep -Seconds ($Minutes * 60)
} finally {
  Write-Host "Stopping timed dev processes..."
  foreach ($process in @($backendProcess, $frontendProcess)) {
    if ($process -and -not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
}
