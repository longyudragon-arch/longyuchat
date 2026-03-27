@echo off
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /PID %%a /F >nul 2>nul
)
cd /d C:\codeX
set NO_PROXY=localhost,127.0.0.1,::1
set no_proxy=localhost,127.0.0.1,::1
start "" /b cmd /c "npm run start > C:\codeX\.codex\start-local-3000.log 2> C:\codeX\.codex\start-local-3000-error.log"
