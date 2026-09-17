#!/usr/bin/env bash
# VM 부팅 시마다 실행된다. 멱등해야 한다.
set -euo pipefail

exec > >(tee -a /var/log/valheim-startup.log) 2>&1
echo "=== startup.sh 시작 $(date -Is) ==="

BUCKET="$(curl -sf -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/bucket-name)"

# 1. 필요한 패키지 설치 (이미 있으면 건너뛴다)
if ! command -v docker >/dev/null 2>&1; then
  echo "--- Docker 설치"
  apt-get update -qq
  apt-get install -y -qq ca-certificates curl gnupg jq
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

command -v jq >/dev/null 2>&1 || apt-get install -y -qq jq

# 2. 디렉터리 준비
mkdir -p /opt/valheim /srv/valheim/config /srv/valheim/backups

# 3. 에이전트와 서버 정의를 GCS에서 내려받는다
#    이 방식 덕분에 스크립트를 고칠 때 VM을 다시 만들 필요가 없다.
echo "--- 배포 파일 동기화: gs://${BUCKET}/deploy/"
gcloud storage rsync --recursive "gs://${BUCKET}/deploy" /opt/valheim || {
  echo "배포 파일이 아직 없습니다. deploy-agent.sh 실행이 필요합니다."
}

chmod +x /opt/valheim/agent/*.sh 2>/dev/null || true

# 4. systemd 유닛 설치 (있을 때만)
if [ -d /opt/valheim/agent/systemd ]; then
  cp /opt/valheim/agent/systemd/*.service /opt/valheim/agent/systemd/*.timer /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable --now valheim-idle-guard.timer
  systemctl enable --now valheim-backup-sync.timer
fi

# 5. 게임 서버 컨테이너 기동 (있을 때만)
if [ -f /opt/valheim/server/docker-compose.yml ]; then
  cd /opt/valheim/server
  docker compose up -d
fi

# 6. 기동 시각 기록. idle-guard의 유예 시간 계산에 사용한다.
date +%s > /run/valheim-boot-time

echo "=== startup.sh 완료 $(date -Is) ==="
