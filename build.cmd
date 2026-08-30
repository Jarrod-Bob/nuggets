@echo off
rem Build the frontend, then embed it in the Go binary. Windows, cmd.exe.
rem Runs regardless of PowerShell execution policy -- this is a batch
rem script, not a PowerShell script.
setlocal

pushd web
call npm run build
if errorlevel 1 (
    popd
    echo frontend build failed
    exit /b 1
)
popd

if not exist internal\web\dist mkdir internal\web\dist
if not exist internal\web\dist\.gitkeep type nul > internal\web\dist\.gitkeep

go build -o nuggets.exe ./cmd/nuggets
if errorlevel 1 (
    echo go build failed
    exit /b 1
)

echo built nuggets.exe
