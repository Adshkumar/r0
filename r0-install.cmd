@echo off
setlocal
set URL=https://github.com/Adshkumar/r0/releases/latest/download/r0-latest-setup.exe
set TMPFILE=%TEMP%\r0-setup.exe
echo Downloading r0...
powershell -Command "Invoke-WebRequest -Uri '%URL%' -OutFile '%TMPFILE%'"
echo Installing...
start /wait "" "%TMPFILE%"
echo Done. r0 is in your Start Menu.
endlocal
