# valheim-multi

발헤임 1.0 데디케이티드 서버와 관리 웹앱.

- 설계: `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md`
- 서브프로젝트 A 계획: `docs/superpowers/plans/2026-09-17-subproject-a-infrastructure.md`

## 지금 현행: 집 PC 자가 호스팅

서버는 **GCP VM 이 아니라 집 PC 의 Docker 컨테이너**로 돈다(`server/docker-compose.yml`).
아래 `## 인프라`, `## 운영` 두 절은 이전에 검토했던 GCP 경로를 남겨둔 과거 기록이며
지금은 쓰지 않는다. 처음 설정하거나 운영 중 문제를 해결하려면 아래 가이드를 순서대로
본다.

1. `docs/guides/router-setup.md` : 공유기 포트포워딩, PC 고정 IP
2. `server/docker-compose.yml` : 서버 컨테이너 실행 (`cd server && docker compose up -d`)
3. `docs/guides/world-migration.md` : 친구 월드를 서버로 옮기기
4. `docs/guides/status-publisher-setup.md` : 상태 표시용 Gist 연동, PC 상시 실행 등록
5. `docs/guides/github-pages-deploy.md` : 사이트 배포와 색인 차단 관련 주의사항

## 사이트

`web/` 아래 Astro 정적 사이트가 있다. `main` 에 `web/` 이나 `data/` 변경이 푸시되면
`.github/workflows/pages.yml` 워크플로가 자동으로 빌드하고 GitHub Pages 로 배포한다.

    https://firstquator.github.io/valheim-multi/

배포를 처음 켜는 절차와, 사이트가 공개적으로 접근 가능하다는 점에서 오는 주의사항은
`docs/guides/github-pages-deploy.md` 를 본다.

### 구조

    web/
      src/pages/index.astro   단일 페이지. 서버/모드/설치 가이드/월드 탭
      src/components/         Sidebar, Tabs, CopyField, ModCard 등
      src/islands/            서버 상태를 30초마다 갱신하는 클라이언트 스크립트
      src/lib/                모드 스키마 검증, 상태 판정 등 순수 함수
      src/config.mjs          접속 주소/비밀번호, Gist 연동 설정
      public/                 파비콘, robots.txt 등 빌드 시 그대로 복사되는 파일

## 테스트

이 저장소는 서로 다른 두 가지 테스트를 각자 돌려야 한다. 하나만 돌리면 다른 쪽이
조용히 빠진다.

    npm test               # 루트: agent/lib/ 의 순수 함수 (vitest 2.x)
    npm --prefix web test  # web: 모드 스키마 검증, 상태 판정, 복사 피드백 등 (vitest 5.x)

`./scripts/test.sh` 는 위 두 vitest 스위트와 별개로, `tests/*.bats` 에 있는 도커
컨테이너용 쉘 스크립트(백업 동기화, idle guard 판정 등)를 도커 안에서 검증한다.
CI(`.github/workflows/pages.yml`)는 `npm test` 와 `npm --prefix web test` 만 돌린다.

## 인프라 (과거 기록: GCP 경로, 사용 안 함)

지금은 집 PC 자가 호스팅으로 운영한다. 아래는 검토 단계에서 다뤘던 GCP VM +
Terraform 경로를 기록으로만 남긴 것이다.

    ./scripts/tf.sh plan
    ./scripts/tf.sh apply

## 운영 (과거 기록: GCP 경로, 사용 안 함)

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
