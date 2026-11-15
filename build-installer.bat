@echo off
rem Produces the same Windows files a release carries: the Squirrel installer
rem (Setup.exe, RELEASES, full .nupkg) and the portable .exe. Never publishes.
rem   build-installer.bat [/s ^| --silent]
setlocal EnableDelayedExpansion
cd /d "%~dp0"
call build.bat %* || exit /b !errorlevel!
set "CSC_IDENTITY_AUTO_DISCOVERY=false"
pushd studio
call npx electron-builder --win portable squirrel --x64 --publish never || ( popd & echo Packaging failed. & exit /b 1 )
echo == Packaged files and their SHA-256 digests
for %%f in (release\*.exe release\squirrel-windows\*) do (
  for /f "usebackq delims=" %%h in (`powershell -NoProfile -Command "(Get-FileHash '%%~ff' -Algorithm SHA256).Hash.ToLower()"`) do echo %%h  %%~ff
)
popd
exit /b 0
