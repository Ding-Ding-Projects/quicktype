@echo off
rem Fetches everything needed to build, run and test quicktype Studio on Windows.
rem   download-dependencies.bat [/s ^| --silent]     (or set SILENT=1)
rem Installs in user scope only. Re-running is safe.
setlocal EnableDelayedExpansion
set "QUIET=%SILENT%"
if /i "%~1"=="/s" set "QUIET=1"
if /i "%~1"=="--silent" set "QUIET=1"
set "NODE_VER=24.6.0"
set "TOOLS=%LOCALAPPDATA%\quicktype-studio\tools"
set "NODE_DIR=%TOOLS%\node-v%NODE_VER%-win-x64"

echo [1/3] Node.js %NODE_VER%
where node >nul 2>nul && for /f %%v in ('node -p "process.versions.node.split('.')[0]"') do set "HAVE_MAJOR=%%v"
if defined HAVE_MAJOR if !HAVE_MAJOR! GEQ 20 ( echo     using the Node.js already on PATH & goto :npm )
if exist "%NODE_DIR%\node.exe" ( set "PATH=%NODE_DIR%;%PATH%" & echo     using %NODE_DIR% & goto :npm )
mkdir "%TOOLS%" 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; $v='%NODE_VER%'; $zip=\"node-v$v-win-x64.zip\"; $base=\"https://nodejs.org/dist/v$v/\";" ^
  "Invoke-WebRequest \"$base$zip\" -OutFile \"%TOOLS%\$zip\"; $sums=(Invoke-WebRequest \"${base}SHASUMS256.txt\" -UseBasicParsing).Content;" ^
  "$want=($sums -split \"`n\" | Where-Object { $_ -match [regex]::Escape($zip) }) -split '\s+' | Select-Object -First 1;" ^
  "$got=(Get-FileHash \"%TOOLS%\$zip\" -Algorithm SHA256).Hash.ToLower(); if ($got -ne $want) { throw \"digest mismatch for $zip\" };" ^
  "Expand-Archive \"%TOOLS%\$zip\" -DestinationPath \"%TOOLS%\" -Force; Remove-Item \"%TOOLS%\$zip\"" || ( echo     Node.js download or verification failed. & exit /b 1 )
set "PATH=%NODE_DIR%;%PATH%"
echo     installed and verified %NODE_DIR%

:npm
echo [2/3] Engine packages
call npm ci --no-audit --no-fund || exit /b !errorlevel!
echo [3/3] Studio and website packages
pushd studio && call npm ci --no-audit --no-fund || ( popd & exit /b 1 )
popd
pushd site && call npm ci --no-audit --no-fund || ( popd & exit /b 1 )
popd
echo All dependencies are ready.
endlocal & set "PATH=%PATH%"
exit /b 0
