@echo off
REM Runs the automated self-tests (trade reconstruction, statistics, API security).
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" ( echo Run start.bat once first. & pause & exit /b 1 )
".venv\Scripts\python.exe" -m pip install --disable-pip-version-check --quiet -r requirements-dev.txt
".venv\Scripts\python.exe" -m pytest -q tests
pause
