#!/usr/bin/env bats

setup() {
  export TMPROOT="$(mktemp -d)"
  export BACKUP_DIR="$TMPROOT/backups"
  export BUCKET_NAME="test-bucket"
  export GCLOUD_LOG="$TMPROOT/gcloud.log"

  mkdir -p "$BACKUP_DIR"

  # gcloud 목. 호출된 인자를 로그에 남긴다.
  cat > "$TMPROOT/fake-gcloud" <<'MOCK'
#!/usr/bin/env bash
echo "$@" >> "$GCLOUD_LOG"
MOCK
  chmod +x "$TMPROOT/fake-gcloud"
  export GCLOUD_BIN="$TMPROOT/fake-gcloud"
}

teardown() {
  rm -rf "$TMPROOT"
}

@test "백업 파일이 있으면 gcloud storage rsync를 호출한다" {
  echo "world data" > "$BACKUP_DIR/world.zip"
  run bash /code/agent/backup-sync.sh
  [ "$status" -eq 0 ]
  grep -q "storage rsync" "$GCLOUD_LOG"
  grep -q "gs://test-bucket/backups" "$GCLOUD_LOG"
}

@test "백업 디렉터리가 비어 있으면 gcloud를 호출하지 않는다" {
  run bash /code/agent/backup-sync.sh
  [ "$status" -eq 0 ]
  [ ! -s "$GCLOUD_LOG" ]
}

@test "백업 디렉터리가 없으면 실패하지 않고 종료한다" {
  rm -rf "$BACKUP_DIR"
  run bash /code/agent/backup-sync.sh
  [ "$status" -eq 0 ]
}

@test "버킷 이름이 없으면 종료코드 1을 반환한다" {
  unset BUCKET_NAME
  echo "world data" > "$BACKUP_DIR/world.zip"
  run bash /code/agent/backup-sync.sh
  [ "$status" -eq 1 ]
}

@test "원격 삭제 옵션을 쓰지 않는다" {
  echo "world data" > "$BACKUP_DIR/world.zip"
  run bash /code/agent/backup-sync.sh
  [ "$status" -eq 0 ]
  ! grep -q -- "--delete-unmatched-destination-objects" "$GCLOUD_LOG"
  ! grep -q -- "--delete" "$GCLOUD_LOG"
}
