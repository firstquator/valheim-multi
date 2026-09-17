#!/usr/bin/env bash
# VM 부팅 시마다 실행된다. 멱등해야 한다.
set -euo pipefail

exec > >(tee -a /var/log/valheim-startup.log) 2>&1
echo "=== startup.sh 시작 $(date -Is) ==="

# 0. 기동 시각을 가장 먼저 기록한다.
#    아래 단계 중 하나라도 실패하면 set -e 로 스크립트가 그 지점에서
#    멈출 수 있다. 이 파일이 없으면 idle-guard 의 uptime_seconds() 가
#    파일 부재 시 0 을 반환하고, agent/lib/decide.sh 의 유예 판정이
#    영구적으로 "grace" 상태에 고정되어 VM 이 절대 종료되지 않는다.
#    시간당 과금되는 VM 이 무기한 켜진 채 크레딧을 소진하는 사고로
#    이어지므로, 실패 가능성이 있는 다른 어떤 명령보다도 앞에 둔다.
#    이 명령 자체는 다른 단계에 의존하지 않는다.
date +%s > /run/valheim-boot-time

# 비대화형 설치로 강제한다. GCE Debian 이미지는 부팅 직후
# unattended-upgrades 가 dpkg 락을 점유하고 있는 경우가 흔해서,
# 락 대기 타임아웃을 주지 않으면 apt-get 이 실패해 set -e 로
# 스크립트 전체가 죽는다.
export DEBIAN_FRONTEND=noninteractive
APT_OPTS=(-o DPkg::Lock::Timeout=300)

# 메타데이터 서버 조회에 재시도를 둔다. 부팅 초기에는 응답 지연이
# 드물게 발생한다. 빈 값이 돌아오면 뒤에서 "gs:///deploy" 같은
# 무의미한 경로를 조회하게 되므로 별도로 검증한다.
BUCKET="$(curl -sf --retry 5 --retry-connrefused --max-time 10 \
  -H 'Metadata-Flavor: Google' \
  http://metadata.google.internal/computeMetadata/v1/instance/attributes/bucket-name)"

if [ -z "$BUCKET" ]; then
  echo "ERROR: 메타데이터에서 bucket-name을 가져오지 못했습니다. GCS 동기화를 건너뜁니다."
fi

# 1. 필요한 패키지 설치 (이미 있으면 건너뛴다)
if ! command -v docker >/dev/null 2>&1; then
  echo "--- Docker 설치"
  apt-get "${APT_OPTS[@]}" update -qq
  apt-get "${APT_OPTS[@]}" install -y -qq ca-certificates curl gnupg jq
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get "${APT_OPTS[@]}" update -qq
  apt-get "${APT_OPTS[@]}" install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

command -v jq >/dev/null 2>&1 || apt-get "${APT_OPTS[@]}" install -y -qq jq

# 2. 디렉터리 준비
mkdir -p /opt/valheim /srv/valheim/config /srv/valheim/backups

# 3. 에이전트와 서버 정의를 GCS에서 내려받는다
#    이 방식 덕분에 스크립트를 고칠 때 VM을 다시 만들 필요가 없다.
#    실패 원인을 구분해 로그에 남긴다. 첫 부팅에 객체가 아직 없는
#    정상 상황과, 권한 거부(403) 같은 실제 장애를 같은 메시지로
#    뭉개면 배포가 깨진 채로 "완료"만 찍히는 사고를 알아채기 어렵다.
#    어느 경우든 스크립트는 죽이지 않고 부팅을 계속 진행한다.
if [ -n "$BUCKET" ]; then
  echo "--- 배포 파일 동기화: gs://${BUCKET}/deploy/"
  SYNC_OUTPUT="$(gcloud storage rsync --recursive "gs://${BUCKET}/deploy" /opt/valheim 2>&1)" && SYNC_STATUS=0 || SYNC_STATUS=$?
  echo "$SYNC_OUTPUT"
  if [ "$SYNC_STATUS" -ne 0 ]; then
    if echo "$SYNC_OUTPUT" | grep -qiE '403|AccessDenied|Forbidden|PERMISSION_DENIED'; then
      echo "ERROR: GCS 동기화가 권한 문제로 실패했습니다. 서비스 계정 권한을 확인하세요."
    else
      echo "배포 파일이 아직 없습니다. deploy-agent.sh 실행이 필요합니다."
    fi
  fi
else
  echo "배포 파일이 아직 없습니다. deploy-agent.sh 실행이 필요합니다."
fi

chmod +x /opt/valheim/agent/*.sh 2>/dev/null || true

# 4. systemd 유닛 설치 (있을 때만)
#    .service 와 .timer 가 둘 다 있어야 cp 가 성공한다. 일부만 배포된
#    중간 상태에서는 글로브가 리터럴 문자열로 남아 cp 가 실패하고,
#    set -e 로 스크립트 전체가 죽어 뒤의 컨테이너 기동까지 날아간다.
#    nullglob 으로 미확장 글로브를 빈 목록으로 처리하고, 유닛 파일이
#    실제로 있을 때만 복사와 타이머 활성화를 시도한다.
shopt -s nullglob
SERVICE_FILES=(/opt/valheim/agent/systemd/*.service)
TIMER_FILES=(/opt/valheim/agent/systemd/*.timer)
if [ -d /opt/valheim/agent/systemd ] && [ ${#SERVICE_FILES[@]} -gt 0 ] && [ ${#TIMER_FILES[@]} -gt 0 ]; then
  cp "${SERVICE_FILES[@]}" "${TIMER_FILES[@]}" /etc/systemd/system/
  systemctl daemon-reload
  if [ -f /etc/systemd/system/valheim-idle-guard.timer ]; then
    systemctl enable --now valheim-idle-guard.timer
  else
    echo "경고: valheim-idle-guard.timer 유닛이 없어 활성화를 건너뜁니다."
  fi
  if [ -f /etc/systemd/system/valheim-backup-sync.timer ]; then
    systemctl enable --now valheim-backup-sync.timer
  else
    echo "경고: valheim-backup-sync.timer 유닛이 없어 활성화를 건너뜁니다."
  fi
else
  echo "경고: systemd 유닛 파일이 아직 배포되지 않았습니다. 타이머 설치를 건너뜁니다."
fi
shopt -u nullglob

# 5. 게임 서버 컨테이너 기동 (있을 때만)
if [ -f /opt/valheim/server/docker-compose.yml ]; then
  cd /opt/valheim/server
  docker compose up -d
fi

echo "=== startup.sh 완료 $(date -Is) ==="
