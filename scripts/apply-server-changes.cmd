@echo off
rem Applies scheduled Valheim server changes. Restarts only when empty.
rem
rem ASCII only on purpose. See agentun-status-publisher.cmd for why.
rem Korean documentation lives in docs/guides/mods.md

cd /d "%~dp0.."

node scriptspply-server-changes.mjs >> agentpply-server-changes.log 2>&1
