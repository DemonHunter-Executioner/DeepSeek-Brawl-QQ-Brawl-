@echo off
rem Whale Battle desktop pet launcher (Windows)
rem Double-click: compiles pet-window.exe once with the built-in .NET Framework csc.exe,
rem then starts the always-on-top transparent window.
setlocal
set "ROOT=%~dp0"
set "OUT=%LOCALAPPDATA%\dsh-whale-battle"
set "EXE=%OUT%\pet-window.exe"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"

if not exist "%OUT%" mkdir "%OUT%"

if not exist "%EXE%" (
  echo [whale-battle] first run: compiling desktop pet...
  if not exist "%CSC%" (
    echo [error] csc.exe not found.
    pause
    exit /b 1
  )
  "%CSC%" /nologo /target:winexe /codepage:65001 /optimize+ /out:"%EXE%" /r:System.dll /r:System.Core.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll /r:System.Web.Extensions.dll /win32icon:"%ROOT%assets\tray.ico" "%ROOT%pet-window\PetWindow.cs"
  if errorlevel 1 (
    echo [error] compile failed.
    pause
    exit /b 1
  )
)

start "" "%EXE%" --assets "%ROOT%assets" --state "%OUT%"
exit /b 0
