@echo off
rem Valheim status publisher entry point for Windows Task Scheduler.
rem
rem ASCII only on purpose. cmd.exe reads batch files using the system
rem code page (CP949 on Korean Windows). UTF-8 Korean bytes in comments
rem get mis-decoded and swallow the line break, which merges commands.
rem We hit exactly that: "'\.env' is not recognized".
rem
rem Korean documentation lives in docs/guides/status-publisher-setup.md

cd /d "%~dp0.."

if not exist "agent\.env" (
    echo [%date% %time%] agent\.env is missing. Copy agent\env.example and fill in the values. >> agent\status-publisher.log
    exit /b 1
)

node --env-file=agent\.env agent\status-publisher.mjs >> agent\status-publisher.log 2>&1
