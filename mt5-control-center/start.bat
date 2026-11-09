@echo off
REM ------------------------------------------------------------------
REM  MT5 Trading Control Center - Windows launcher
REM  Double-click this file. It creates a private Python environment
REM  inside this folder on first run, installs the dependencies, and
REM  starts the local dashboard. Close this window (or press Ctrl+C)
REM  to stop the control center.
REM ------------------------------------------------------------------
setlocal
cd /d "%~dp0"
title MT5 Trading Control Center

set "PY="
where py >nul 2>nul && set "PY=py -3"
if not defined PY ( where python >nul 2>nul && set "PY=python" )
if not defined PY (
  echo.
  echo  Python 3 was not found. Install Python 3.12 from python.org and tick
  echo  "Add python.exe to PATH" during installation, then run this file again.
  echo.
  pause
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo  Creating a private Python environment in .venv ...
  %PY% -m venv .venv
  if errorlevel 1 goto :fail
)

echo  Checking dependencies ...
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --quiet --upgrade pip
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --quiet -r requirements.txt
if errorlevel 1 goto :fail

echo.
".venv\Scripts\python.exe" -m mt5cc
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo  The control center stopped with exit code %RC%. See the messages above
  echo  and logs\control-center.log for details.
  pause
)
exit /b %RC%

:fail
echo.
echo  Setup failed. Check your internet connection (needed once to download
echo  the Python packages) and run this file again.
pause
exit /b 1
