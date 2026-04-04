#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Build MediaForge for production release.

.DESCRIPTION
    This script builds the MediaForge desktop application using Tauri.
    It installs frontend dependencies, sets up the Python backend distribution,
    and produces Windows installers (MSI / NSIS).

.PARAMETER SigningKey
    Path to the Tauri signing private key file for update signatures.
    Alternatively, set the TAURI_SIGNING_PRIVATE_KEY environment variable.

.PARAMETER Debug
    Build in debug mode instead of release.

.EXAMPLE
    .\build.ps1
    .\build.ps1 -SigningKey "$HOME\.tauri\mediaforge.key"
#>

param(
    [string]$SigningKey,
    [switch]$Debug
)

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  MediaForge Build Script" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# ---------- Pre-flight checks ----------
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org"
    exit 1
}
$nodeVersion = (node --version)
Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green

# Rust
if (-not (Get-Command rustc -ErrorAction SilentlyContinue)) {
    Write-Error "Rust is not installed. Please install Rust from https://rustup.rs"
    exit 1
}
$rustVersion = (rustc --version)
Write-Host "  Rust: $rustVersion" -ForegroundColor Green

# npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed."
    exit 1
}

# ---------- Signing key ----------
if ($SigningKey -and (Test-Path $SigningKey)) {
    $env:TAURI_SIGNING_PRIVATE_KEY = Get-Content $SigningKey -Raw
    Write-Host "  Signing key loaded from: $SigningKey" -ForegroundColor Green
} elseif ($env:TAURI_SIGNING_PRIVATE_KEY) {
    Write-Host "  Signing key: from environment" -ForegroundColor Green
} else {
    Write-Host "  Signing key: NOT SET (update signatures will be unavailable)" -ForegroundColor DarkYellow
    Write-Host "  Generate one with: npx tauri signer generate -w `$HOME\.tauri\mediaforge.key" -ForegroundColor DarkYellow
}

# ---------- Install frontend dependencies ----------
Write-Host ""
Write-Host "[2/5] Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location $ProjectRoot
npm ci --prefer-offline 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    npm install
}
Pop-Location
Write-Host "  Done." -ForegroundColor Green

# ---------- Set up Python distribution ----------
Write-Host ""
Write-Host "[3/5] Setting up Python distribution..." -ForegroundColor Yellow

$setupScript = Join-Path $ProjectRoot "setup_python_dist.ps1"
if (Test-Path $setupScript) {
    & $setupScript
} else {
    Write-Host "  setup_python_dist.ps1 not found, skipping Python dist setup." -ForegroundColor DarkYellow
    Write-Host "  Make sure src-tauri/python_dist/ is populated before building." -ForegroundColor DarkYellow
}

# ---------- TypeScript type check ----------
Write-Host ""
Write-Host "[4/5] Running TypeScript type check..." -ForegroundColor Yellow
Push-Location $ProjectRoot
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript type check failed. Fix errors before building."
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  Type check passed." -ForegroundColor Green

# ---------- Build ----------
Write-Host ""
Write-Host "[5/5] Building Tauri application..." -ForegroundColor Yellow

Push-Location $ProjectRoot
if ($Debug) {
    npx tauri build --debug
} else {
    npx tauri build
}
$buildExitCode = $LASTEXITCODE
Pop-Location

if ($buildExitCode -ne 0) {
    Write-Error "Tauri build failed with exit code $buildExitCode"
    exit $buildExitCode
}

# ---------- Summary ----------
Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan

$bundleDir = Join-Path $ProjectRoot "src-tauri\target\release\bundle"
if (Test-Path $bundleDir) {
    Write-Host ""
    Write-Host "Build artifacts:" -ForegroundColor Yellow

    $nsis = Join-Path $bundleDir "nsis"
    if (Test-Path $nsis) {
        Get-ChildItem $nsis -Filter "*.exe" | ForEach-Object {
            Write-Host "  NSIS: $($_.FullName)" -ForegroundColor White
        }
    }

    $msi = Join-Path $bundleDir "msi"
    if (Test-Path $msi) {
        Get-ChildItem $msi -Filter "*.msi" | ForEach-Object {
            Write-Host "  MSI:  $($_.FullName)" -ForegroundColor White
        }
    }
}
