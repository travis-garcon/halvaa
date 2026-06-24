param(
  [string]$Bbox = "44.0,25.0,63.5,40.0",
  [int]$MaxZoom = 12,
  [string]$Source = "https://data.source.coop/protomaps/openstreetmap/v4.pmtiles",
  [switch]$IncludeTerrain,
  [string]$TerrainSource = "https://download.mapterhorn.com/planet.pmtiles",
  [int]$TerrainMaxZoom = 10
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$mapData = Join-Path $root "map-data"
$output = Join-Path $mapData "halvaa.pmtiles"
$terrainOutput = Join-Path $mapData "terrain-dem.pmtiles"
$assets = Join-Path $mapData "assets"
$assetsZip = Join-Path $mapData "basemaps-assets.zip"

New-Item -ItemType Directory -Force -Path $mapData | Out-Null
New-Item -ItemType Directory -Force -Path $assets | Out-Null

Write-Host "Downloading local Protomaps extract..."
Write-Host "Source: $Source"
Write-Host "BBox:   $Bbox"
Write-Host "Zoom:   0-$MaxZoom"

docker run --rm `
  -v "${mapData}:/data" `
  protomaps/go-pmtiles:latest `
  extract $Source /data/halvaa.pmtiles --bbox=$Bbox --maxzoom=$MaxZoom --download-threads=8

if (!(Test-Path -LiteralPath $output)) {
  throw "Expected $output to exist after pmtiles extract."
}

if ($IncludeTerrain) {
  Write-Host "Downloading local terrain DEM extract..."
  Write-Host "Source: $TerrainSource"
  Write-Host "BBox:   $Bbox"
  Write-Host "Zoom:   0-$TerrainMaxZoom"

  docker run --rm `
    -v "${mapData}:/data" `
    protomaps/go-pmtiles:latest `
    extract $TerrainSource /data/terrain-dem.pmtiles --bbox=$Bbox --maxzoom=$TerrainMaxZoom --download-threads=8

  if (!(Test-Path -LiteralPath $terrainOutput)) {
    throw "Expected $terrainOutput to exist after terrain extract."
  }
}

Write-Host "Downloading local Protomaps basemap assets..."
Invoke-WebRequest `
  -Uri "https://github.com/protomaps/basemaps-assets/archive/refs/heads/main.zip" `
  -OutFile $assetsZip

Expand-Archive -LiteralPath $assetsZip -DestinationPath $assets -Force

Write-Host "Local map data ready:"
Write-Host "- $output"
if ($IncludeTerrain) {
  Write-Host "- $terrainOutput"
}
Write-Host "- $assets"
