# MediaForge Python Distribution Setup Script
# Downloads and configures a standalone Python environment for the packaged app

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir

# Configuration
$pythonVersion = "3.12.1"
$pythonUrl = "https://www.python.org/ftp/python/$pythonVersion/python-$pythonVersion-embed-amd64.zip"
$distDir = Join-Path $projectRoot "src-tauri\python_dist"
$pythonDir = Join-Path $distDir "python"
$backendDir = Join-Path $distDir "backend"
$backendSource = Join-Path $projectRoot "python_backend"

Write-Host "Setting up Python distribution..." -ForegroundColor Cyan

# 1. Clean and Create Directories
if (Test-Path $distDir) {
    Remove-Item -Path $distDir -Recurse -Force
}
New-Item -Path $pythonDir -ItemType Directory -Force | Out-Null
New-Item -Path $backendDir -ItemType Directory -Force | Out-Null

# 2. Download and Extract Python
$zipFile = Join-Path $distDir "python.zip"
Write-Host "Downloading Python $pythonVersion..."
Invoke-WebRequest -Uri $pythonUrl -OutFile $zipFile
Write-Host "Extracting Python..."
Expand-Archive -Path $zipFile -DestinationPath $pythonDir
Remove-Item $zipFile

# 3. Configure python._pth to allow site-packages
Write-Host "Configuring Python path..."
$pthFile = Get-ChildItem $pythonDir -Filter "python*._pth" | Select-Object -First 1
$content = Get-Content $pthFile.FullName
$content = $content -replace "#import site", "import site"
$content | Set-Content $pthFile.FullName

# 4. Install pip
Write-Host "Downloading get-pip.py..."
$getPipUrl = "https://bootstrap.pypa.io/get-pip.py"
$getPipFile = Join-Path $pythonDir "get-pip.py"
Invoke-WebRequest -Uri $getPipUrl -OutFile $getPipFile

Write-Host "Installing pip..."
& "$pythonDir/python.exe" $getPipFile

# 5. Install Requirements
Write-Host "Installing dependencies..."
& "$pythonDir/python.exe" -m pip install -r "$backendSource/requirements.txt" --no-warn-script-location

# 6. Copy Backend Code
Write-Host "Copying backend code..."
Copy-Item -Path "$backendSource/*" -Destination $backendDir -Recurse -Force -Exclude "venv", "__pycache__", ".git", ".gitignore"

Write-Host "Python distribution setup complete!" -ForegroundColor Green
Write-Host "Distribution is located at: $distDir"
