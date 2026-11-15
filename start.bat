@echo off
rem Starts the 3D viewer locally (offline). Tries Python first, then a PowerShell fallback server (no installs needed).
cd /d "%~dp0"
python --version >NUL 2>&1
if %errorlevel%==0 (
  python tools\serve.py
  goto :eof
)
powershell -NoProfile -ExecutionPolicy Bypass -File tools\serve.ps1
