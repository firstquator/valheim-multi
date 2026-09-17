#!/usr/bin/env bash
# 테스트를 Docker 컨테이너에서 실행한다.
# 대상 환경이 Linux이므로 Windows에서 직접 돌리지 않고 컨테이너에서 검증한다.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="valheim-multi-tests"

docker build -q -t "$IMAGE" "$REPO_ROOT/tests" >/dev/null

# Git Bash(MSYS)의 자동 경로 변환이 컨테이너 내부 경로(/code)를 엉뚱한 Windows
# 경로로 바꿔버리는 문제를 막기 위해 MSYS_NO_PATHCONV를 설정한다. 네이티브
# Linux 셸에서는 이 변수가 존재하지 않는 동작이므로 영향이 없다.
MSYS_NO_PATHCONV=1 docker run --rm \
  -v "$REPO_ROOT:/code" \
  -w /code \
  "$IMAGE" \
  "${@:-tests/}"
