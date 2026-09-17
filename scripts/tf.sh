#!/usr/bin/env bash
# Terraform을 Docker로 실행한다. 로컬 설치가 필요 없다.
# gcloud application-default 자격증명을 컨테이너에 마운트한다.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Windows(Git Bash)는 %APPDATA%\gcloud, Linux/macOS는 ~/.config/gcloud 에 있다.
# 자동 감지가 실패하면 GCLOUD_CONFIG 환경변수로 직접 지정한다.
: "${GCLOUD_CONFIG:=${APPDATA:-$HOME/.config}/gcloud}"

if [ ! -d "$GCLOUD_CONFIG" ]; then
  echo "gcloud 설정 디렉터리를 찾을 수 없습니다: $GCLOUD_CONFIG" >&2
  echo "먼저 'gcloud auth application-default login' 을 실행하세요." >&2
  echo "경로가 다르면 GCLOUD_CONFIG 환경변수로 지정하세요." >&2
  exit 1
fi

# TTY가 있을 때만 -it 를 붙인다.
# deploy-agent.sh 가 $(./scripts/tf.sh output -raw bucket_name) 형태로 호출하는데,
# 명령 치환에는 TTY가 없어 -it 를 그대로 쓰면 "the input device is not a TTY"로 실패한다.
TTY_FLAGS=""
if [ -t 0 ] && [ -t 1 ]; then
  TTY_FLAGS="-it"
fi

# Git Bash(MSYS)의 자동 경로 변환이 컨테이너 내부 경로(/infra, /root/.config/gcloud)를
# 엉뚱한 Windows 경로로 바꿔버리는 문제를 막기 위해 MSYS_NO_PATHCONV를 설정한다.
# 네이티브 Linux 셸에서는 이 변수가 존재하지 않는 동작이므로 영향이 없다.
MSYS_NO_PATHCONV=1 docker run --rm $TTY_FLAGS \
  -v "$REPO_ROOT/infra:/infra" \
  -v "$GCLOUD_CONFIG:/root/.config/gcloud:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
  -w /infra \
  hashicorp/terraform:1.9 "$@"
