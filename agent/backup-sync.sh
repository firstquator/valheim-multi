#!/usr/bin/env bash
# 컨테이너가 만든 백업을 GCS 버킷으로 동기화한다.
# 월드의 정본은 VM 디스크가 아니라 버킷이다.
# 체험판 만료로 VM이 사라져도 버킷의 데이터는 회수할 수 있다.
set -uo pipefail

: "${BACKUP_DIR:=/srv/valheim/backups}"
: "${GCLOUD_BIN:=gcloud}"

# 버킷 이름은 인스턴스 메타데이터에서 읽는다. 테스트에서는 주입한다.
if [ -z "${BUCKET_NAME:-}" ]; then
  BUCKET_NAME="$(curl -sf -H 'Metadata-Flavor: Google' \
    http://metadata.google.internal/computeMetadata/v1/instance/attributes/bucket-name 2>/dev/null)" || true
fi

log() {
  printf '[backup-sync] %s %s\n' "$(date -Is)" "$*"
}

if [ ! -d "$BACKUP_DIR" ]; then
  log "백업 디렉터리가 없습니다: $BACKUP_DIR"
  exit 0
fi

# 비어 있으면 아무것도 하지 않는다. 빈 rsync로 원격을 지우는 사고를 막는다.
if [ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]; then
  log "백업이 없습니다. 건너뜁니다."
  exit 0
fi

if [ -z "${BUCKET_NAME:-}" ]; then
  log "버킷 이름을 얻지 못했습니다."
  exit 1
fi

log "동기화: $BACKUP_DIR -> gs://${BUCKET_NAME}/backups"

# --delete-unmatched-destination-objects 를 쓰지 않는다.
# 로컬 보존 기간(3일)이 지나 사라진 백업을 원격에서도 지우면
# 장기 보관본이 사라진다. 원격은 버킷 수명주기로 관리한다.
"$GCLOUD_BIN" storage rsync --recursive \
  "$BACKUP_DIR" "gs://${BUCKET_NAME}/backups"
