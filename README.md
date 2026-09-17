# valheim-multi

발헤임 1.0 데디케이티드 서버와 관리 웹앱.

- 설계: `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md`
- 서브프로젝트 A 계획: `docs/superpowers/plans/2026-09-17-subproject-a-infrastructure.md`

## 테스트

    ./scripts/test.sh

## 인프라

    ./scripts/tf.sh plan
    ./scripts/tf.sh apply

## 운영

### 서버 켜기 / 끄기

    gcloud compute instances start valheim-server --zone=asia-northeast3-a
    gcloud compute instances stop  valheim-server --zone=asia-northeast3-a

### 접속 IP 확인

    ./scripts/tf.sh output server_ip

### 에이전트 스크립트 수정 후 반영

    ./scripts/deploy-agent.sh
    gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
      --command="sudo google_metadata_script_runner startup"

### 부팅 스크립트(startup.sh) 수정 후 반영

startup-script는 ignore_changes 대상이므로 명시적 교체가 필요하다.

    ./scripts/tf.sh apply -replace=google_compute_instance.server

### 로그 보기

    gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
      --command="sudo journalctl -u valheim-idle-guard.service -n 50 --no-pager"
    gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
      --command="sudo docker logs valheim --tail 50"

### 전체 철거 (90일 만료 시)

버킷의 백업을 먼저 내려받은 뒤 실행한다.

    gcloud storage cp -r "gs://<버킷>/backups" ./backup-archive
    ./scripts/tf.sh destroy
