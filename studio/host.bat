@echo off
rem quicktype Studio self-hosted web edition on this Windows machine.
rem   host.bat [start|stop|restart|status|logs|update]   (default: start)
setlocal EnableDelayedExpansion
set "MODE=%~1"
if "%MODE%"=="" set "MODE=start"
set "COMPOSE=docker compose -f "%~dp0compose.yaml""
where docker >nul 2>nul || (echo Docker Desktop is required for the self-hosted edition. & exit /b 1)
if /i "%MODE%"=="start" (
  %COMPOSE% up -d || exit /b !errorlevel!
  goto :urls
)
if /i "%MODE%"=="stop" ( %COMPOSE% down & exit /b !errorlevel! )
if /i "%MODE%"=="restart" ( %COMPOSE% restart || exit /b !errorlevel! & goto :urls )
if /i "%MODE%"=="status" ( %COMPOSE% ps & goto :urls )
if /i "%MODE%"=="logs" ( %COMPOSE% logs --tail 200 & exit /b !errorlevel! )
if /i "%MODE%"=="update" ( %COMPOSE% pull && %COMPOSE% up -d || exit /b !errorlevel! & goto :urls )
echo Unknown mode "%MODE%". Use start, stop, restart, status, logs or update.
exit /b 2
:urls
set "OK="
for /l %%i in (1,1,30) do (
  if not defined OK (
    powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://localhost:8080/healthz -TimeoutSec 2) | Out-Null; exit 0 } catch { exit 1 }" && set "OK=1"
    if not defined OK timeout /t 1 >nul
  )
)
if not defined OK ( echo quicktype Studio did not answer its health check. Run: host.bat logs & exit /b 1 )
echo quicktype Studio is up. Open one of these addresses on your network:
for /f "usebackq delims=" %%a in (`powershell -NoProfile -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } | ForEach-Object { 'http://' + $_.IPAddress + ':8080/' }"`) do echo   %%a
for /f "usebackq delims=" %%t in (`powershell -NoProfile -Command "[DateTime]::UtcNow.ToString('yyyy-MM-dd HH:mm:ss') + ' UTC'"`) do echo Verified at %%t
exit /b 0
