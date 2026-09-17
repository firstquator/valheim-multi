# valheim-multi

발헤임 1.0 데디케이티드 서버와 관리 웹앱.

- 설계: `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md`
- 서브프로젝트 A 계획: `docs/superpowers/plans/2026-09-17-subproject-a-infrastructure.md`

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
