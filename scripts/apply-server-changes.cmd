@echo off
REM 작업 스케줄러가 부르는 진입점. 콘솔 창 없이 돈다.
cd /d "%~dp0.."
node scripts\apply-server-changes.mjs >> agent\apply-server-changes.log 2>&1
