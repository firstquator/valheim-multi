@echo off
rem 발헤임 상태 퍼블리셔를 실행하는 진입점이다.
rem Windows 작업 스케줄러가 이 파일을 직접 호출하도록 등록한다.
rem 자세한 등록 절차는 docs/guides/status-publisher-setup.md 를 본다.
rem
rem 로그온 없이(콘솔 창 없이) 도는 것을 전제로, 표준출력/에러를
rem agent/status-publisher.log 로 남긴다.

cd /d "%~dp0\.."

if not exist "agent\.env" (
    echo [%date% %time%] agent\.env 가 없습니다. agent\env.example 을 복사해 값을 채우세요. >> agent\status-publisher.log
    exit /b 1
)

node --env-file=agent\.env agent\status-publisher.mjs >> agent\status-publisher.log 2>&1
