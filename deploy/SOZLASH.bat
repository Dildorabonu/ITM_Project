@echo off
title ITM Factory - qayta sozlash
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% equ 0 goto run

echo.
echo  Administrator huquqi kerak. Chiqadigan oynada "Ha" / "Yes" ni
echo  bosing yoki Administrator parolini kiriting...
echo.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skript\boshlash.ps1" -Reconfigure
