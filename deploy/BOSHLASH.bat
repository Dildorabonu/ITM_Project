@echo off
title ITM Factory
cd /d "%~dp0"

if exist "sozlama.ok" goto run

net session >nul 2>&1
if %errorlevel% equ 0 goto run

echo.
echo  Birinchi sozlash uchun Administrator huquqi kerak.
echo  Chiqadigan oynada "Ha" / "Yes" ni bosing yoki
echo  Administrator parolini kiriting...
echo.
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skript\boshlash.ps1"
