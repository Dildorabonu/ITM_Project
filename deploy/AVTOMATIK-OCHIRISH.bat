@echo off
title ITM Factory - avtomatik ishga tushirishni ochirish
cd /d "%~dp0"

net session >nul 2>&1
if %errorlevel% equ 0 goto run

powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:run
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0skript\avtomatik.ps1" -Remove
