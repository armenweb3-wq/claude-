<#
 .SYNOPSIS
  Starts the MT5 Trading Control Center (same as start.bat, for PowerShell users).
 .NOTES
  Run from PowerShell:  .\Start-ControlCenter.ps1
  If scripts are blocked:  powershell -ExecutionPolicy Bypass -File .\Start-ControlCenter.ps1
#>
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

$python = $null
if (Get-Command py -ErrorAction SilentlyContinue) { $python = "py"; $pyArgs = @("-3") }
elseif (Get-Command python -ErrorAction SilentlyContinue) { $python = "python"; $pyArgs = @() }
else {
    Write-Host "Python 3 was not found. Install Python 3.12 from python.org (tick 'Add python.exe to PATH')." -ForegroundColor Red
    exit 1
}

$venvPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
    Write-Host "Creating a private Python environment in .venv ..." -ForegroundColor Cyan
    & $python @pyArgs -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw "Could not create the virtual environment." }
}

Write-Host "Checking dependencies ..." -ForegroundColor Cyan
& $venvPython -m pip install --disable-pip-version-check --quiet --upgrade pip
& $venvPython -m pip install --disable-pip-version-check --quiet -r requirements.txt
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Check your internet connection and retry." }

& $venvPython -m mt5cc
exit $LASTEXITCODE
