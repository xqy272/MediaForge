# MediaForge Development Startup Script
# Encoding: UTF-8 with BOM for PowerShell compatibility

# Set console encoding to UTF-8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

# Save current directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MediaForge Development Environment" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Python virtual environment
$venvPath = Join-Path $projectRoot "python_backend\venv\Scripts\Activate.ps1"
if (Test-Path $venvPath) {
    Write-Host "[OK] Activating Python virtual environment..." -ForegroundColor Green
    & $venvPath
    
    # Verify Python version
    $pythonVersion = python --version 2>&1
    Write-Host "[OK] $pythonVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Python virtual environment not found!" -ForegroundColor Red
    Write-Host "Please run: cd python_backend && py -3.12 -m venv venv && .\venv\Scripts\Activate.ps1 && pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

# Check Node.js
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Node.js $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Node.js not found!" -ForegroundColor Red
    exit 1
}

# Check Rust/Cargo
$cargoVersion = cargo --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] $cargoVersion" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Rust/Cargo not found!" -ForegroundColor Red
    Write-Host "Please install Rust from https://www.rust-lang.org/tools/install" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[START] Starting Tauri development server..." -ForegroundColor Cyan
Write-Host ""

# Run Tauri dev
Set-Location $projectRoot
npm run tauri dev
