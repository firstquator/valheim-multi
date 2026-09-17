# 서브프로젝트 A: 인프라 및 게임 서버 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GCP 무료 체험판 위에 발헤임 1.0 데디케이티드 서버를 온디맨드로 띄우고, 아무도 접속하지 않으면 스스로 종료해 크레딧을 보호하는 인프라를 구축한다.

**Architecture:** Terraform으로 GCP 리소스(VPC, 방화벽, 고정 IP, GCS 버킷, 서비스 계정, VM)를 정의한다. VM 위에서는 `community-valheim-tools/valheim-server-docker` 컨테이너가 게임 서버를 돌리고, systemd 타이머로 동작하는 `idle-guard`가 유휴를 판정해 안전하게 종료한다. `idle-guard`는 외부 서비스에 전혀 의존하지 않으므로 웹앱이나 Firestore가 죽어도 비용 유출이 발생하지 않는다.

**Tech Stack:** Terraform (Docker로 실행), Debian 12, Docker Compose, Bash + systemd 타이머, bats-core (Docker로 실행), gcloud CLI

**Spec:** `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md`

## Global Constraints

스펙에서 가져온 프로젝트 전역 요구사항. 모든 태스크가 암묵적으로 이 조건을 포함한다.

- **리전**: `asia-northeast3` (서울), 존 `asia-northeast3-a`
- **머신 타입**: `n2-standard-4` (4 vCPU / 16GB)
- **부트 디스크**: Balanced PD 50GB
- **외부 IP**: 고정 IP
- **방화벽**: UDP 2456-2458만 인터넷에 개방. SSH는 IAP 터널(TCP 22, 소스 `35.235.240.0/20`)로만
- **크로스플레이**: 반드시 끔. BepInEx와 양립 불가
- **`SERVER_PUBLIC`**: `true` (Steam 쿼리로 인원 수를 읽기 위함). 비밀번호 보호는 유지
- **`STATUS_HTTP`**: 켜되 localhost에만 바인딩. 외부 노출 금지
- **컨테이너 자동 업데이트**: 반드시 끔 (`UPDATE_CRON` 비활성)
- **유예 시간**: 기동 후 15분 동안은 자동 종료하지 않음
- **유휴 판정**: 접속 인원 0이 20분 지속되면 종료
- **백업 정본**: VM 디스크가 아니라 GCS 버킷
- **`idle-guard` 의존성**: 외부 서비스에 의존 금지. Firestore, Cloud Run, 인터넷 API 호출 불가
- **문서 및 UI 문구**: em dash(`—`) 및 en dash(`–`) 사용 금지
- **비밀값**: 서버 비밀번호, 프로젝트 ID 등은 git에 커밋 금지

## 범위 명확화

스펙 7.1절의 구성 요소 표는 `heartbeat`과 `idle-guard`를 서브프로젝트 C 항목으로 묶어 두었으나, 실제 소속은 다음과 같이 정리한다.

| 구성 요소 | 소속 | 근거 |
|---|---|---|
| `idle-guard` | **A** | 외부 무의존. 비용 안전장치의 핵심이며 A만으로 완결된다 |
| `backup-sync` | **A** | GCS 백업은 A의 요구사항 |
| `heartbeat` | **C** | Firestore가 필요하므로 C에서 구현 |
| `agent/lib/status.sh` | **A** | `idle-guard`가 사용. C의 `heartbeat`도 재사용한다 |

따라서 본 계획은 Firestore를 전혀 다루지 않는다. A는 웹앱 없이도 완결되어야 한다.

## 파일 구조

```
valheim-multi/
├── .gitignore
├── README.md
├── scripts/
│   ├── test.sh                  테스트를 Docker bats로 실행
│   ├── tf.sh                    Terraform을 Docker로 실행
│   └── deploy-agent.sh          agent/ 와 server/ 를 GCS로 업로드
├── infra/
│   ├── versions.tf              provider 버전 고정
│   ├── variables.tf             입력 변수 정의
│   ├── network.tf               VPC, 서브넷, 방화벽
│   ├── storage.tf               GCS 버킷 (backups/, deploy/)
│   ├── iam.tf                   VM 서비스 계정과 최소 권한
│   ├── compute.tf               고정 IP, VM 인스턴스
│   ├── outputs.tf               IP, 버킷 이름 등 출력
│   └── terraform.tfvars.example 변수 예시 (실제 tfvars는 gitignore)
├── server/
│   ├── docker-compose.yml       valheim-server 컨테이너 정의
│   └── env.example              컨테이너 환경변수 예시
├── agent/
│   ├── lib/
│   │   └── status.sh            status.json 파싱 공용 함수
│   ├── idle-guard.sh            유휴 판정 및 안전 종료
│   ├── backup-sync.sh           백업을 GCS로 동기화
│   └── systemd/
│       ├── valheim-idle-guard.service
│       ├── valheim-idle-guard.timer
│       ├── valheim-backup-sync.service
│       └── valheim-backup-sync.timer
├── tests/
│   ├── Dockerfile               bats + jq + bash 이미지
│   ├── fixtures/                실제 status.json 캡처본
│   ├── test_harness.bats
│   ├── test_status_lib.bats
│   ├── test_idle_decide.bats
│   ├── test_idle_guard.bats
│   └── test_backup_sync.bats
└── docs/
    ├── superpowers/specs/2026-09-17-valheim-dedicated-server-design.md
    ├── superpowers/plans/2026-09-17-subproject-a-infrastructure.md
    ├── verification/2026-09-17-preflight.md    사전 검증 기록
    └── guides/world-migration.md               친구 월드 이전 절차서
```

**파일 분리 원칙**: `agent/lib/status.sh`는 파싱만 한다. `idle-guard.sh`는 판정과 행동만 한다. 판정 로직(`idle_decide`)은 부수효과 없는 순수 함수로 분리해 테스트 가능하게 만든다. 이 분리가 없으면 "서버를 20분 기다려야 테스트되는" 코드가 된다.

---

## Task 1: 저장소 골격과 테스트 하네스

**Files:**
- Create: `.gitignore`
- Create: `README.md`
- Create: `tests/Dockerfile`
- Create: `tests/test_harness.bats`
- Create: `scripts/test.sh`

**Interfaces:**
- Consumes: 없음
- Produces: `./scripts/test.sh` 로 모든 bats 테스트 실행. 이후 모든 태스크가 이 명령을 사용한다

- [ ] **Step 1: 실패하는 하네스 테스트 작성**

`tests/test_harness.bats`:

```bash
#!/usr/bin/env bats

@test "테스트 컨테이너에 bash가 있다" {
  run bash --version
  [ "$status" -eq 0 ]
}

@test "테스트 컨테이너에 jq가 있다" {
  run jq --version
  [ "$status" -eq 0 ]
}

@test "저장소 루트가 /code로 마운트된다" {
  [ -f /code/README.md ]
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `docker run --rm -v "$PWD:/code" -w /code bats/bats:latest tests/test_harness.bats`

Expected: FAIL. `jq: command not found` 그리고 `/code/README.md` 없음

- [ ] **Step 3: 테스트 이미지와 실행 스크립트 작성**

`tests/Dockerfile`:

```dockerfile
FROM bats/bats:1.11.0
RUN apk add --no-cache bash jq coreutils
```

`scripts/test.sh`:

```bash
#!/usr/bin/env bash
# 테스트를 Docker 컨테이너에서 실행한다.
# 대상 환경이 Linux이므로 Windows에서 직접 돌리지 않고 컨테이너에서 검증한다.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="valheim-multi-tests"

docker build -q -t "$IMAGE" "$REPO_ROOT/tests" >/dev/null

docker run --rm \
  -v "$REPO_ROOT:/code" \
  -w /code \
  "$IMAGE" \
  "${@:-tests/}"
```

`README.md`:

```markdown
# valheim-multi

발헤임 1.0 데디케이티드 서버와 관리 웹앱.

- 설계: `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md`
- 서브프로젝트 A 계획: `docs/superpowers/plans/2026-09-17-subproject-a-infrastructure.md`

## 테스트

    ./scripts/test.sh

## 인프라

    ./scripts/tf.sh plan
    ./scripts/tf.sh apply
```

`.gitignore`:

```gitignore
# Terraform
infra/.terraform/
infra/.terraform.lock.hcl
*.tfstate
*.tfstate.*
*.tfvars
!*.tfvars.example

# 비밀값
server/.env
.env

# OS
Thumbs.db
.DS_Store
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `chmod +x scripts/test.sh && ./scripts/test.sh tests/test_harness.bats`

Expected: `3 tests, 0 failures`

- [ ] **Step 5: 커밋**

```bash
git add .gitignore README.md tests/Dockerfile tests/test_harness.bats scripts/test.sh
git commit -m "chore: 저장소 골격과 Docker 기반 bats 테스트 하네스 추가

Terraform과 bats를 로컬에 설치하지 않고 Docker로 실행한다.
대상 환경이 Linux이므로 컨테이너에서 검증하는 편이 정확하다."
```

---

## Task 2: 사전 검증 (스펙 미해결 항목 U1~U8 해소)

스펙 11절의 미해결 항목은 전부 "제 조사만으로 확정하면 안 되는 것"이다. 실물로 확인하고 결과를 기록한다. **이 태스크를 건너뛰고 뒤 태스크를 진행하면 틀린 값 위에 인프라를 쌓게 된다.**

**Files:**
- Create: `docs/verification/2026-09-17-preflight.md`
- Modify: `docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md` (11절 갱신)

**Interfaces:**
- Consumes: 없음
- Produces: 확정된 리전 단가, vCPU 할당량, 모드 버전, 필요 포트. Task 3 이후가 이 값을 사용한다

- [ ] **Step 1: gcloud CLI 설치와 로그인**

사용자가 직접 실행해야 한다. Google Cloud SDK를 설치한 뒤 프롬프트에 다음을 입력한다.

```
! gcloud auth login
! gcloud auth application-default login
! gcloud config set project <프로젝트ID>
```

`application-default login`이 필요한 이유: Terraform이 이 자격증명을 사용한다.

- [ ] **Step 2: vCPU 할당량 확인 (U8)**

Run:

```bash
gcloud compute regions describe asia-northeast3 \
  --format="table(quotas.metric,quotas.limit,quotas.usage)" \
  | grep -i cpu
```

Expected: `CPUS` 항목의 limit 확인. **limit이 4 미만이면 `n2-standard-4`를 만들 수 없으므로 즉시 중단하고 사용자에게 보고한다.** 체험판은 할당량 증설을 요청할 수 없다.

- [ ] **Step 3: N2 머신 타입 가용성 확인**

Run:

```bash
gcloud compute machine-types list \
  --filter="zone:asia-northeast3-a AND name=n2-standard-4" \
  --format="table(name,guestCpus,memoryMb,zone)"
```

Expected: 1행 반환. 결과가 없으면 존을 `asia-northeast3-b` 또는 `-c`로 바꿔 재시도한다.

- [ ] **Step 4: 실제 단가 확인 (U1)**

GCP 가격 계산기(https://cloud.google.com/products/calculator)에서 다음을 구성하고 월 비용을 기록한다.

- Compute Engine, 리전 `asia-northeast3`, 머신 `n2-standard-4`, 사용 시간 월 120시간
- Balanced PD 50GB
- 고정 외부 IP 1개

스펙 5.2절의 추정치(90일 약 $127)와 비교해 오차가 20%를 넘으면 사용자에게 보고하고 사양 재검토를 제안한다.

- [ ] **Step 5: 발헤임 서버 포트 확인 (U6)**

Run:

```bash
curl -s https://raw.githubusercontent.com/lloesche/valheim-server-docker/main/README.md \
  | grep -iE '2456|2457|2458|port' | head -30
```

Expected: 사용 포트와 프로토콜 확인. 기본값은 UDP 2456과 2457이며 2458은 구버전 잔재일 수 있다. **실제로 필요한 포트만 연다.**

- [ ] **Step 6: 모드 버전 전수 재확인 (U2, U3, U4)**

Thunderstore에서 아래 각 모드 페이지를 열어 최신 버전과 "Deep North Update" 태그 유무를 확인한다.

| 모드 | 스펙 기재 버전 | 확인할 것 |
|---|---|---|
| `denikson/BepInExPack_Valheim` | 5.4.2350 | 최신 버전, Deprecated 아닌지 |
| `ArgusMagnus/ServersideQoL` | 2.0.13 | Deep North 태그, config 항목 목록 (U5) |
| `Advize/PlantEverything` | 1.21.2 | Deep North 태그 |
| `shudnal/ExtraSlots` | 1.2.3 | Deep North 태그, 인벤토리 줄 추가 비활성화 옵션 존재 여부 |
| `MathiasDecrock/PlanBuild` | 0.18.5 | Deep North 태그 |
| `MSchmoecker/MultiUserChest` | 0.6.2 | 1.0 대응 |
| `ComfyMods/Gizmo` | 미확정 | 1.0 대응 여부 결론 (U4) |
| 작업대 상자 연결 계열 | 없음 | "Deep North Update" 태그에서 재검색 (U3) |

U3은 사용자의 최우선 요청이므로, 새로 대응된 구현이 있으면 즉시 보고한다.

- [ ] **Step 7: 검증 결과 기록**

`docs/verification/2026-09-17-preflight.md`에 위 6개 항목의 결과를 표로 기록한다. 각 항목은 확인 방법, 확인한 값, 스펙과의 차이를 포함한다.

스펙 11절의 표에서 해소된 항목에 확인 날짜와 값을 추가한다.

- [ ] **Step 8: 커밋**

```bash
git add docs/verification/2026-09-17-preflight.md docs/superpowers/specs/2026-09-17-valheim-dedicated-server-design.md
git commit -m "docs: 사전 검증 결과 기록 및 스펙 미해결 항목 갱신

단가, vCPU 할당량, 필요 포트, 모드 버전을 실물로 확인했다."
```

---

## Task 3: Terraform 기반 인프라 (네트워크, 스토리지, IAM)

VM을 제외한 토대를 먼저 만든다. VM은 Task 4에서 추가한다. 나누는 이유: VM 생성은 과금이 시작되는 시점이므로 그 전에 네트워크와 권한을 검토받는 편이 안전하다.

**Files:**
- Create: `scripts/tf.sh`
- Create: `infra/versions.tf`
- Create: `infra/variables.tf`
- Create: `infra/network.tf`
- Create: `infra/storage.tf`
- Create: `infra/iam.tf`
- Create: `infra/outputs.tf`
- Create: `infra/terraform.tfvars.example`

**Interfaces:**
- Consumes: Task 2에서 확인한 리전, 존, 포트
- Produces:
  - `google_service_account.vm` (VM이 사용할 서비스 계정)
  - `google_storage_bucket.data` (이름: `var.bucket_name`, `backups/` 와 `deploy/` prefix 사용)
  - `google_compute_network.main`, `google_compute_subnetwork.main`
  - 출력값 `bucket_name`

- [ ] **Step 1: Terraform 실행 래퍼 작성**

`scripts/tf.sh`:

```bash
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

docker run --rm $TTY_FLAGS \
  -v "$REPO_ROOT/infra:/infra" \
  -v "$GCLOUD_CONFIG:/root/.config/gcloud:ro" \
  -e GOOGLE_APPLICATION_CREDENTIALS=/root/.config/gcloud/application_default_credentials.json \
  -w /infra \
  hashicorp/terraform:1.9 "$@"
```

- [ ] **Step 2: provider 버전 고정**

`infra/versions.tf`:

```hcl
terraform {
  required_version = ">= 1.9.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}
```

- [ ] **Step 3: 입력 변수 정의**

`infra/variables.tf`:

```hcl
variable "project_id" {
  description = "GCP 프로젝트 ID"
  type        = string
}

variable "region" {
  description = "리전. 참여자 전원 한국 거주이므로 서울"
  type        = string
  default     = "asia-northeast3"
}

variable "zone" {
  description = "존. Task 2에서 n2-standard-4 가용성을 확인한 존"
  type        = string
  default     = "asia-northeast3-a"
}

variable "bucket_name" {
  description = "백업과 배포 파일을 담는 GCS 버킷 이름. 전역 고유해야 한다"
  type        = string
}

variable "game_port" {
  description = "발헤임 게임 포트. 서버는 이 포트와 다음 포트(쿼리)를 사용한다"
  type        = number
  default     = 2456
}
```

- [ ] **Step 4: 네트워크와 방화벽 정의**

`infra/network.tf`:

```hcl
resource "google_compute_network" "main" {
  name                    = "valheim-net"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "main" {
  name          = "valheim-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.main.id
}

# 게임 포트만 인터넷에 개방한다.
# 발헤임은 game_port(접속)와 game_port+1(Steam 쿼리)을 사용한다.
resource "google_compute_firewall" "game" {
  name    = "valheim-allow-game"
  network = google_compute_network.main.name

  allow {
    protocol = "udp"
    ports    = ["${var.game_port}-${var.game_port + 1}"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["valheim-server"]
}

# SSH는 인터넷에 열지 않는다. IAP 터널 대역에서만 허용한다.
resource "google_compute_firewall" "iap_ssh" {
  name    = "valheim-allow-iap-ssh"
  network = google_compute_network.main.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["valheim-server"]
}
```

- [ ] **Step 5: 스토리지 정의**

`infra/storage.tf`:

```hcl
# 월드 백업과 에이전트 배포 파일을 담는다.
# 월드의 정본은 VM 디스크가 아니라 이 버킷이다.
# 체험판 만료 시 VM은 사라지지만 버킷의 데이터는 회수할 수 있다.
resource "google_storage_bucket" "data" {
  name     = var.bucket_name
  location = var.region

  uniform_bucket_level_access = true

  # 실수로 삭제했을 때 되돌릴 수 있도록 7일간 보존한다.
  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age                = 7
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }
}
```

- [ ] **Step 6: 서비스 계정과 최소 권한 정의**

`infra/iam.tf`:

```hcl
# VM이 사용할 서비스 계정.
# 권한은 백업 버킷 읽기/쓰기로만 제한한다.
# VM 자신을 중지할 권한은 필요 없다. idle-guard는 게스트 내부에서
# shutdown 명령을 쓰므로 Compute API 권한이 불필요하다.
resource "google_service_account" "vm" {
  account_id   = "valheim-vm"
  display_name = "Valheim 게임 서버 VM"
}

resource "google_storage_bucket_iam_member" "vm_bucket" {
  bucket = google_storage_bucket.data.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.vm.email}"
}
```

- [ ] **Step 7: 출력값 정의**

`infra/outputs.tf`:

```hcl
output "bucket_name" {
  description = "백업과 배포 파일 버킷"
  value       = google_storage_bucket.data.name
}

output "service_account_email" {
  description = "VM 서비스 계정"
  value       = google_service_account.vm.email
}
```

- [ ] **Step 8: 변수 예시 파일 작성**

`infra/terraform.tfvars.example`:

```hcl
# 이 파일을 terraform.tfvars 로 복사한 뒤 값을 채운다.
# terraform.tfvars 는 gitignore 대상이다.

project_id  = "my-valheim-project"
bucket_name = "my-valheim-data-20260917"
zone        = "asia-northeast3-a"
```

- [ ] **Step 9: 문법 검증**

Run:

```bash
chmod +x scripts/tf.sh
./scripts/tf.sh init
./scripts/tf.sh validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 10: 실행 계획 검토**

Run:

```bash
cp infra/terraform.tfvars.example infra/terraform.tfvars
# terraform.tfvars 의 project_id 와 bucket_name 을 실제 값으로 수정한 뒤
./scripts/tf.sh plan
```

Expected: 생성될 리소스 7개 (network, subnetwork, firewall x2, bucket, service account, bucket IAM).

**`plan` 출력에 destroy가 하나라도 있으면 중단하고 원인을 확인한다.**

- [ ] **Step 11: 적용**

Run: `./scripts/tf.sh apply`

Expected: `Apply complete! Resources: 7 added, 0 changed, 0 destroyed.`

이 단계에서는 VM이 없으므로 컴퓨트 과금이 발생하지 않는다. 버킷 비용만 발생하며 무시할 수준이다.

- [ ] **Step 12: 커밋**

```bash
git add scripts/tf.sh infra/
git commit -m "feat(infra): 네트워크, 스토리지, IAM Terraform 정의

게임 포트(UDP)만 인터넷에 개방하고 SSH는 IAP 터널로 제한한다.
VM 서비스 계정은 버킷 접근 권한만 갖는다. idle-guard가 게스트
내부에서 shutdown을 쓰므로 Compute API 권한이 필요 없다.

VM은 다음 태스크에서 추가한다. 과금 시작 전에 네트워크와 권한을
먼저 검토받기 위해 분리했다."
```

---

## Task 4: Terraform VM과 부팅 스크립트

**Files:**
- Create: `infra/compute.tf`
- Modify: `infra/outputs.tf`
- Create: `infra/startup.sh`

**Interfaces:**
- Consumes: Task 3의 `google_compute_network.main`, `google_compute_subnetwork.main`, `google_service_account.vm`, `google_storage_bucket.data`
- Produces:
  - `google_compute_address.server` (고정 IP)
  - `google_compute_instance.server` (이름 `valheim-server`, 태그 `valheim-server`)
  - 출력값 `server_ip`, `instance_name`, `instance_zone`
  - VM 안의 디렉터리 규약: `/opt/valheim` (에이전트 스크립트), `/srv/valheim/config` (컨테이너 볼륨)

- [ ] **Step 1: 부팅 스크립트 작성**

`infra/startup.sh`:

```bash
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
```

- [ ] **Step 2: VM과 고정 IP 정의**

`infra/compute.tf`:

```hcl
# 고정 IP. 친구들이 Steam 즐겨찾기에 등록할 수 있도록 한다.
# VM이 정지한 동안에도 요금이 발생하지만 90일 기준 소액이다.
resource "google_compute_address" "server" {
  name   = "valheim-ip"
  region = var.region
}

resource "google_compute_instance" "server" {
  name         = "valheim-server"
  machine_type = "n2-standard-4"
  zone         = var.zone
  tags         = ["valheim-server"]

  # 머신 타입 변경 시 Terraform이 VM을 중지할 수 있도록 허용한다.
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = 50
      type  = "pd-balanced"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.main.id

    access_config {
      nat_ip = google_compute_address.server.address
    }
  }

  service_account {
    email  = google_service_account.vm.email
    scopes = ["cloud-platform"]
  }

  metadata = {
    "bucket-name"     = google_storage_bucket.data.name
    "startup-script"  = file("${path.module}/startup.sh")
    "enable-oslogin"  = "TRUE"
  }

  # idle-guard가 게스트 내부에서 shutdown을 실행하면 VM은 TERMINATED가 되고
  # 컴퓨트 과금이 멈춘다. 자동 재시작이 켜져 있어도 게스트가 스스로 내린
  # 종료는 되살아나지 않는다. 호스트 장애 시에만 재시작된다.
  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
  }

  # Terraform이 VM을 끄고 켜는 것과 idle-guard가 끄는 것을 구분하지 못하므로
  # 인스턴스 상태 변화로 인한 불필요한 재생성을 막는다.
  lifecycle {
    ignore_changes = [metadata["startup-script"]]
  }
}
```

**주의**: `ignore_changes`에 `startup-script`를 넣었으므로, 부팅 스크립트를 고쳤을 때는 `./scripts/tf.sh apply -replace=google_compute_instance.server` 로 명시적으로 교체해야 한다. 이 제약을 README에 기록한다.

- [ ] **Step 3: 출력값 추가**

`infra/outputs.tf`에 다음을 추가한다:

```hcl
output "server_ip" {
  description = "친구들이 접속할 고정 IP"
  value       = google_compute_address.server.address
}

output "instance_name" {
  description = "VM 인스턴스 이름"
  value       = google_compute_instance.server.name
}

output "instance_zone" {
  description = "VM 인스턴스 존"
  value       = google_compute_instance.server.zone
}
```

- [ ] **Step 4: 문법 검증과 계획 검토**

Run:

```bash
./scripts/tf.sh validate
./scripts/tf.sh plan
```

Expected: `2 to add, 0 to change, 0 to destroy.` (고정 IP와 인스턴스)

**여기서부터 컴퓨트 과금이 시작된다. plan 출력을 반드시 눈으로 확인한다.**

- [ ] **Step 5: 적용하고 부팅 확인**

Run:

```bash
./scripts/tf.sh apply
./scripts/tf.sh output server_ip
```

부팅 로그 확인:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo tail -40 /var/log/valheim-startup.log"
```

Expected: Docker 설치 완료, `배포 파일이 아직 없습니다` 경고(정상), `startup.sh 완료`.

- [ ] **Step 6: 즉시 중지해 과금을 멈춘다**

Run:

```bash
gcloud compute instances stop valheim-server --zone=asia-northeast3-a
```

이후 태스크에서 필요할 때만 켠다. **켜둔 채로 다음 태스크를 진행하면 크레딧이 샌다.**

- [ ] **Step 7: 커밋**

```bash
git add infra/compute.tf infra/outputs.tf infra/startup.sh
git commit -m "feat(infra): VM 인스턴스와 고정 IP 추가

부팅 스크립트는 GCS의 deploy/ 접두사에서 에이전트와 서버 정의를
내려받는다. 덕분에 스크립트를 고칠 때 VM을 다시 만들 필요가 없다.

startup-script는 ignore_changes 대상이므로 수정 시
apply -replace 가 필요하다."
```

---

## Task 5: 게임 서버 컨테이너 정의와 최초 기동

**Files:**
- Create: `server/docker-compose.yml`
- Create: `server/env.example`
- Create: `scripts/deploy-agent.sh`

**Interfaces:**
- Consumes: Task 4의 `/opt/valheim`, `/srv/valheim/config`, 출력값 `bucket_name`
- Produces:
  - 컨테이너 이름 `valheim`
  - VM 내부에서 `http://127.0.0.1:9000/status.json` 이 게임 상태를 반환
  - 백업 경로 `/srv/valheim/backups`
  - `./scripts/deploy-agent.sh` 로 `agent/` 와 `server/` 를 GCS에 업로드

- [ ] **Step 1: 배포 스크립트 작성**

`scripts/deploy-agent.sh`:

```bash
#!/usr/bin/env bash
# agent/ 와 server/ 를 GCS의 deploy/ 접두사로 업로드한다.
# VM은 부팅 시 이 경로에서 파일을 가져온다.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BUCKET="$(cd "$REPO_ROOT" && ./scripts/tf.sh output -raw bucket_name | tr -d '\r')"
if [ -z "$BUCKET" ]; then
  echo "버킷 이름을 얻지 못했습니다. terraform apply 가 끝났는지 확인하세요." >&2
  exit 1
fi

echo "업로드 대상: gs://${BUCKET}/deploy/"

gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  "$REPO_ROOT/agent" "gs://${BUCKET}/deploy/agent"

gcloud storage rsync --recursive --delete-unmatched-destination-objects \
  "$REPO_ROOT/server" "gs://${BUCKET}/deploy/server"

echo "완료. VM에 반영하려면 다음 중 하나를 실행하세요."
echo "  1) VM 재부팅"
echo "  2) gcloud compute ssh valheim-server --zone=<존> --tunnel-through-iap \\"
echo "       --command='sudo google_metadata_script_runner startup'"
```

- [ ] **Step 2: 컨테이너 환경변수 예시 작성**

`server/env.example`:

```bash
# 이 파일을 server/.env 로 복사한 뒤 값을 채운다. .env 는 gitignore 대상이다.

SERVER_NAME=친구들의 발할라
WORLD_NAME=Midgard
SERVER_PASS=최소5자이상의비밀번호
ADMINLIST_IDS=
```

- [ ] **Step 3: docker-compose 정의 작성**

`server/docker-compose.yml`:

```yaml
services:
  valheim:
    image: ghcr.io/lloesche/valheim-server:latest
    container_name: valheim
    restart: unless-stopped
    stop_grace_period: 2m
    cap_add:
      - sys_nice
    ports:
      - "2456-2457:2456-2457/udp"
      # 상태 페이지는 localhost 에만 바인딩한다. 인터넷에 노출하지 않는다.
      - "127.0.0.1:9000:80"
    volumes:
      - /srv/valheim/config:/config
      - /srv/valheim/backups:/config/backups
    env_file:
      - .env
    environment:
      SERVER_PORT: "2456"
      SERVER_PUBLIC: "true"

      # 크로스플레이는 반드시 꺼야 한다. BepInEx는 Steam 네트워킹에
      # 후킹하므로 PlayFab 네트워킹과 양립하지 않는다.
      SERVER_ARGS: "-crossplay false"

      # 자동 업데이트 금지. 게임이나 BepInEx가 무인 상태에서 올라가면
      # 모드 스택이 깨져 아무도 접속하지 못하게 된다.
      UPDATE_CRON: ""
      BEPINEX_UPDATE_CRON: ""

      # 백업은 시간별. 이후 backup-sync 가 GCS로 옮긴다.
      BACKUPS: "true"
      BACKUPS_CRON: "5 * * * *"
      BACKUPS_MAX_AGE: "3"
      BACKUPS_ZIP: "true"

      # 상태 HTTP. idle-guard 가 인원 수를 읽는 출처다.
      STATUS_HTTP: "true"

      # BepInEx는 서브프로젝트 B에서 켠다. A 단계에서는 바닐라로 검증한다.
      BEPINEX: "false"

      TZ: "Asia/Seoul"
```

**주의**: `UPDATE_CRON`과 `BEPINEX_UPDATE_CRON`의 정확한 비활성화 값은 이미지 버전에 따라 빈 문자열이 아닐 수 있다. Step 6에서 실제 로그로 확인한다.

- [ ] **Step 4: 배포하고 서버를 켠다**

Run:

```bash
chmod +x scripts/deploy-agent.sh
cp server/env.example server/.env
# server/.env 의 SERVER_NAME, WORLD_NAME, SERVER_PASS 를 실제 값으로 수정한 뒤
./scripts/deploy-agent.sh
gcloud compute instances start valheim-server --zone=asia-northeast3-a
```

**`server/.env`는 gitignore 대상이지만 `deploy-agent.sh`가 GCS로 올린다.** 버킷은 uniform access이고 VM 서비스 계정만 접근하므로 문제없다.

- [ ] **Step 5: 서버가 뜨는지 확인**

부팅 후 5분쯤 기다린 뒤:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo docker logs valheim --tail 60"
```

Expected: SteamCMD 다운로드 진행, `Game server connected`, 월드 생성 로그.

발헤임 서버는 첫 기동 시 게임 파일을 내려받으므로 10분 이상 걸릴 수 있다.

- [ ] **Step 6: 자동 업데이트가 실제로 꺼졌는지 확인**

Run:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo docker logs valheim 2>&1 | grep -iE 'update.*cron|cron.*update|scheduled'"
```

Expected: 업데이트 크론이 등록되지 않았다는 취지의 로그, 또는 관련 로그 없음.

**업데이트 크론이 등록되어 있으면 즉시 중단하고 올바른 비활성화 값을 찾아 `docker-compose.yml`을 고친다.** 이건 스펙 리스크 R1의 방어선이다.

- [ ] **Step 7: status.json 실제 스키마를 픽스처로 캡처**

`status.json`의 필드 이름은 문서로 확인되지 않았다. **추측해서 파서를 만들면 안 된다.** 실제 응답을 받아 고정한다.

접속자 0명 상태에서:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="curl -s http://127.0.0.1:9000/status.json" | tee tests/fixtures/status-0players.json
```

그다음 발헤임 클라이언트로 직접 접속한 뒤:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="curl -s http://127.0.0.1:9000/status.json" | tee tests/fixtures/status-1player.json
```

손상된 응답 픽스처도 만든다:

```bash
printf '{"broken": ' > tests/fixtures/status-malformed.json
```

서버가 막 켜져 아직 응답하지 않는 경우를 위한 빈 픽스처:

```bash
printf '' > tests/fixtures/status-empty.json
```

- [ ] **Step 8: 두 픽스처의 차이를 확인해 인원 수 필드를 특정**

Run:

```bash
diff <(jq -S . tests/fixtures/status-0players.json) \
     <(jq -S . tests/fixtures/status-1player.json)
```

Expected: 인원 수를 담은 필드가 0에서 1로 바뀐 것이 보인다. **그 필드의 정확한 JSON 경로를 Task 6에서 사용한다.** 캡처한 경로를 `tests/fixtures/README.md`에 기록한다.

- [ ] **Step 9: 서버를 끈다**

```bash
gcloud compute instances stop valheim-server --zone=asia-northeast3-a
```

- [ ] **Step 10: 커밋**

```bash
git add server/docker-compose.yml server/env.example scripts/deploy-agent.sh tests/fixtures/
git commit -m "feat(server): 발헤임 컨테이너 정의와 status.json 픽스처 캡처

크로스플레이와 자동 업데이트를 껐다. 상태 HTTP는 localhost에만
바인딩한다.

status.json 스키마가 문서로 확인되지 않아 실제 응답을 픽스처로
캡처했다. 파서는 이 픽스처를 기준으로 작성한다."
```

---

## Task 6: status.json 파싱 라이브러리

**Files:**
- Create: `agent/lib/status.sh`
- Create: `tests/test_status_lib.bats`
- Create: `tests/fixtures/README.md`

**Interfaces:**
- Consumes: Task 5의 픽스처 `tests/fixtures/status-0players.json`, `status-1player.json`, `status-malformed.json`, `status-empty.json`
- Produces:
  - `status_player_count <json문자열>` : 정수를 stdout에 출력. 파싱 실패 시 종료코드 1
  - `status_is_valid <json문자열>` : 유효하면 종료코드 0, 아니면 1
  - `status_fetch <url>` : 응답 본문을 stdout에 출력. 실패 시 종료코드 1

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_status_lib.bats`:

```bash
#!/usr/bin/env bats

setup() {
  load '/code/agent/lib/status.sh'
  FIXTURES=/code/tests/fixtures
}

@test "접속자 0명 픽스처에서 0을 반환한다" {
  run status_player_count "$(cat "$FIXTURES/status-0players.json")"
  [ "$status" -eq 0 ]
  [ "$output" = "0" ]
}

@test "접속자 1명 픽스처에서 1을 반환한다" {
  run status_player_count "$(cat "$FIXTURES/status-1player.json")"
  [ "$status" -eq 0 ]
  [ "$output" = "1" ]
}

@test "손상된 JSON은 종료코드 1을 반환한다" {
  run status_player_count "$(cat "$FIXTURES/status-malformed.json")"
  [ "$status" -eq 1 ]
}

@test "빈 응답은 종료코드 1을 반환한다" {
  run status_player_count "$(cat "$FIXTURES/status-empty.json")"
  [ "$status" -eq 1 ]
}

@test "정상 픽스처는 유효 판정된다" {
  run status_is_valid "$(cat "$FIXTURES/status-0players.json")"
  [ "$status" -eq 0 ]
}

@test "손상된 JSON은 무효 판정된다" {
  run status_is_valid "$(cat "$FIXTURES/status-malformed.json")"
  [ "$status" -eq 1 ]
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./scripts/test.sh tests/test_status_lib.bats`

Expected: FAIL. `/code/agent/lib/status.sh` 없음

- [ ] **Step 3: 최소 구현 작성**

`agent/lib/status.sh`:

```bash
#!/usr/bin/env bash
# status.json 파싱 전용 라이브러리. 부수효과가 없어야 한다.
# idle-guard 와 (서브프로젝트 C의) heartbeat 가 함께 사용한다.

# 인원 수가 담긴 JSON 경로.
# Task 5 Step 8에서 실제 응답을 비교해 확정한 값으로 교체할 것.
: "${STATUS_PLAYER_COUNT_PATH:=.players}"

# JSON이 파싱 가능한지 검사한다.
status_is_valid() {
  local json="$1"
  [ -n "$json" ] || return 1
  printf '%s' "$json" | jq -e . >/dev/null 2>&1
}

# 접속 인원 수를 stdout에 출력한다.
# 파싱에 실패하면 아무것도 출력하지 않고 종료코드 1을 반환한다.
status_player_count() {
  local json="$1"
  status_is_valid "$json" || return 1

  local count
  count="$(printf '%s' "$json" | jq -r "${STATUS_PLAYER_COUNT_PATH} // empty" 2>/dev/null)"

  # 정수가 아니면 실패로 간주한다.
  case "$count" in
    ''|*[!0-9]*) return 1 ;;
  esac

  printf '%s' "$count"
}

# URL에서 상태를 가져온다. 네트워크 실패와 파싱 실패를 구분하기 위해 분리했다.
status_fetch() {
  local url="$1"
  curl -sf --max-time 5 "$url" 2>/dev/null || return 1
}
```

**중요**: `STATUS_PLAYER_COUNT_PATH`의 기본값 `.players`는 **가정이다.** Task 5 Step 8에서 확인한 실제 경로로 반드시 바꾼다. 픽스처 테스트가 이 값이 틀렸는지 알려준다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `./scripts/test.sh tests/test_status_lib.bats`

Expected: `6 tests, 0 failures`

실패하면 `STATUS_PLAYER_COUNT_PATH`를 픽스처의 실제 경로로 수정한다. 예를 들어 인원 수가 `{"server":{"playerCount":1}}` 형태라면 `.server.playerCount`로 바꾼다.

- [ ] **Step 5: 픽스처 문서 작성**

`tests/fixtures/README.md`:

```markdown
# status.json 픽스처

Task 5 Step 7에서 실제 서버에서 캡처했다. 손으로 만들지 않았다.

| 파일 | 상황 |
|---|---|
| `status-0players.json` | 서버 실행 중, 접속자 없음 |
| `status-1player.json` | 서버 실행 중, 접속자 1명 |
| `status-malformed.json` | 잘린 JSON |
| `status-empty.json` | 빈 응답 (서버 기동 직후) |

인원 수 JSON 경로: `<Task 5 Step 8에서 확인한 값을 적는다>`

이미지를 업그레이드해 스키마가 바뀌면 픽스처를 다시 캡처하고
`agent/lib/status.sh` 의 `STATUS_PLAYER_COUNT_PATH` 를 갱신한다.
```

- [ ] **Step 6: 커밋**

```bash
git add agent/lib/status.sh tests/test_status_lib.bats tests/fixtures/README.md
git commit -m "feat(agent): status.json 파싱 라이브러리

실제 캡처한 픽스처를 기준으로 TDD했다. 파싱 실패와 빈 응답을
구분해 종료코드로 알린다. 부수효과가 없으므로 테스트가 쉽다."
```

---

## Task 7: 유휴 판정 로직

행동과 분리된 순수 함수로 만든다. 이 분리가 없으면 "20분을 실제로 기다려야 검증되는" 코드가 된다.

**Files:**
- Create: `agent/lib/decide.sh`
- Create: `tests/test_idle_decide.bats`

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:
  - `idle_decide <uptime_sec> <player_count> <idle_elapsed_sec>` : `grace` | `reset` | `wait` | `shutdown` 중 하나를 stdout에 출력
  - 상수 `GRACE_PERIOD_SEC` (기본 900), `IDLE_LIMIT_SEC` (기본 1200)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_idle_decide.bats`:

```bash
#!/usr/bin/env bats

setup() {
  load '/code/agent/lib/decide.sh'
}

@test "기동 후 15분 이내면 grace를 반환한다" {
  run idle_decide 60 0 0
  [ "$output" = "grace" ]
}

@test "기동 후 정확히 900초는 아직 grace다 (경계값)" {
  run idle_decide 900 0 0
  [ "$output" = "grace" ]
}

@test "기동 후 901초부터 판정이 시작된다" {
  run idle_decide 901 0 0
  [ "$output" != "grace" ]
}

@test "접속자가 있으면 reset을 반환한다" {
  run idle_decide 3600 3 0
  [ "$output" = "reset" ]
}

@test "유예를 넘겨도 접속자가 있으면 reset이다" {
  run idle_decide 99999 1 999999
  [ "$output" = "reset" ]
}

@test "접속자 0명이고 유휴 시간이 짧으면 wait이다" {
  run idle_decide 3600 0 60
  [ "$output" = "wait" ]
}

@test "접속자 0명이고 유휴가 정확히 1200초면 아직 wait이다 (경계값)" {
  run idle_decide 3600 0 1200
  [ "$output" = "wait" ]
}

@test "접속자 0명이고 유휴가 1201초면 shutdown이다" {
  run idle_decide 3600 0 1201
  [ "$output" = "shutdown" ]
}

@test "유예 판정이 유휴 판정보다 우선한다" {
  run idle_decide 100 0 99999
  [ "$output" = "grace" ]
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./scripts/test.sh tests/test_idle_decide.bats`

Expected: FAIL. `/code/agent/lib/decide.sh` 없음

- [ ] **Step 3: 최소 구현 작성**

`agent/lib/decide.sh`:

```bash
#!/usr/bin/env bash
# 유휴 판정 로직. 부수효과가 없는 순수 함수다.
# 실제 종료 행동은 idle-guard.sh 가 담당한다.

# 기동 직후 유예 시간. 없으면 켜자마자 꺼진다.
: "${GRACE_PERIOD_SEC:=900}"

# 접속자 0명이 이 시간을 넘게 지속되면 종료한다.
: "${IDLE_LIMIT_SEC:=1200}"

# idle_decide <uptime_sec> <player_count> <idle_elapsed_sec>
#   grace    : 기동 유예 중. 아무것도 하지 않는다
#   reset    : 접속자가 있다. 유휴 카운터를 초기화한다
#   wait     : 접속자는 없지만 아직 한계에 도달하지 않았다
#   shutdown : 종료 조건 충족
idle_decide() {
  local uptime="$1"
  local players="$2"
  local idle_elapsed="$3"

  # 유예 판정이 가장 우선한다. 켜자마자 꺼지는 것을 막는 것이 최우선이다.
  if [ "$uptime" -le "$GRACE_PERIOD_SEC" ]; then
    printf 'grace'
    return 0
  fi

  if [ "$players" -gt 0 ]; then
    printf 'reset'
    return 0
  fi

  if [ "$idle_elapsed" -gt "$IDLE_LIMIT_SEC" ]; then
    printf 'shutdown'
    return 0
  fi

  printf 'wait'
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `./scripts/test.sh tests/test_idle_decide.bats`

Expected: `9 tests, 0 failures`

- [ ] **Step 5: 커밋**

```bash
git add agent/lib/decide.sh tests/test_idle_decide.bats
git commit -m "feat(agent): 유휴 판정 로직을 순수 함수로 분리

행동과 분리해 20분을 실제로 기다리지 않고도 경계값을 검증할 수 있다.
유예 판정이 유휴 판정보다 우선하므로 켜자마자 꺼지지 않는다."
```

---

## Task 8: idle-guard 실행 스크립트

**Files:**
- Create: `agent/idle-guard.sh`
- Create: `tests/test_idle_guard.bats`

**Interfaces:**
- Consumes: `agent/lib/status.sh`의 `status_fetch`, `status_player_count`. `agent/lib/decide.sh`의 `idle_decide`
- Produces:
  - `agent/idle-guard.sh` 실행 파일. `--dry-run` 플래그 지원
  - 상태 파일 `/run/valheim-idle-since` (유휴 시작 시각, epoch 초)
  - dry-run 시 stdout에 `DRYRUN: <행동>` 출력

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_idle_guard.bats`:

```bash
#!/usr/bin/env bats

setup() {
  export TMPROOT="$(mktemp -d)"
  export BOOT_TIME_FILE="$TMPROOT/boot-time"
  export IDLE_SINCE_FILE="$TMPROOT/idle-since"
  export STATUS_URL="file://$TMPROOT/status.json"
  export GRACE_PERIOD_SEC=900
  export IDLE_LIMIT_SEC=1200
  export DRY_RUN=1
}

teardown() {
  rm -rf "$TMPROOT"
}

# 헬퍼: 기동 후 경과 시간을 설정한다
set_uptime() {
  echo $(( $(date +%s) - $1 )) > "$BOOT_TIME_FILE"
}

@test "유예 시간 중에는 아무 행동도 하지 않는다" {
  set_uptime 60
  cp /code/tests/fixtures/status-0players.json "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRYRUN: grace"* ]]
}

@test "접속자가 있으면 유휴 파일을 지운다" {
  set_uptime 3600
  echo "1000000" > "$IDLE_SINCE_FILE"
  cp /code/tests/fixtures/status-1player.json "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRYRUN: reset"* ]]
  [ ! -f "$IDLE_SINCE_FILE" ]
}

@test "접속자 0명 첫 감지 시 유휴 시작 시각을 기록한다" {
  set_uptime 3600
  rm -f "$IDLE_SINCE_FILE"
  cp /code/tests/fixtures/status-0players.json "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRYRUN: wait"* ]]
  [ -f "$IDLE_SINCE_FILE" ]
}

@test "유휴가 한계를 넘으면 shutdown을 결정한다" {
  set_uptime 3600
  echo $(( $(date +%s) - 1300 )) > "$IDLE_SINCE_FILE"
  cp /code/tests/fixtures/status-0players.json "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" == *"DRYRUN: shutdown"* ]]
}

@test "상태 조회에 실패하면 종료하지 않고 경고만 남긴다" {
  set_uptime 3600
  rm -f "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" != *"DRYRUN: shutdown"* ]]
  [[ "$output" == *"상태 조회 실패"* ]]
}

@test "손상된 응답에도 종료하지 않는다" {
  set_uptime 3600
  cp /code/tests/fixtures/status-malformed.json "$TMPROOT/status.json"
  run bash /code/agent/idle-guard.sh --dry-run
  [ "$status" -eq 0 ]
  [[ "$output" != *"DRYRUN: shutdown"* ]]
}
```

**"상태 조회 실패 시 종료하지 않는다"가 이 테스트의 핵심이다.** 상태를 못 읽었다고 서버를 끄면, 플레이 중에 상태 포트만 잠깐 죽어도 전원이 튕긴다. 실패 시에는 보수적으로 켜둔 채 둔다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./scripts/test.sh tests/test_idle_guard.bats`

Expected: FAIL. `/code/agent/idle-guard.sh` 없음

- [ ] **Step 3: 최소 구현 작성**

`agent/idle-guard.sh`:

```bash
#!/usr/bin/env bash
# 유휴 판정 후 게임 서버를 안전하게 종료한다.
#
# 이 스크립트는 외부 서비스에 의존하지 않는다.
# Firestore, Cloud Run, 인터넷 API를 호출하지 않는다.
# 웹앱이 죽어도 비용 유출이 발생하지 않도록 하는 것이 목적이다.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/status.sh
source "$SCRIPT_DIR/lib/status.sh"
# shellcheck source=lib/decide.sh
source "$SCRIPT_DIR/lib/decide.sh"

: "${STATUS_URL:=http://127.0.0.1:9000/status.json}"
: "${BOOT_TIME_FILE:=/run/valheim-boot-time}"
: "${IDLE_SINCE_FILE:=/run/valheim-idle-since}"
: "${COMPOSE_DIR:=/opt/valheim/server}"
: "${BACKUP_SYNC:=/opt/valheim/agent/backup-sync.sh}"
: "${DRY_RUN:=0}"

if [ "${1:-}" = "--dry-run" ]; then
  DRY_RUN=1
fi

log() {
  printf '[idle-guard] %s %s\n' "$(date -Is)" "$*"
}

# 기동 후 경과 초. 기동 시각 파일이 없으면 0으로 보고 유예를 적용한다.
uptime_seconds() {
  if [ -f "$BOOT_TIME_FILE" ]; then
    echo $(( $(date +%s) - $(cat "$BOOT_TIME_FILE") ))
  else
    echo 0
  fi
}

# 유휴 지속 초. 유휴 시작 파일이 없으면 0.
idle_elapsed_seconds() {
  if [ -f "$IDLE_SINCE_FILE" ]; then
    echo $(( $(date +%s) - $(cat "$IDLE_SINCE_FILE") ))
  else
    echo 0
  fi
}

do_shutdown() {
  log "종료 절차 시작"

  if [ "$DRY_RUN" = "1" ]; then
    log "DRYRUN: 실제 종료를 건너뜁니다"
    return 0
  fi

  # 1. 컨테이너를 먼저 멈춘다. 월드 저장을 보장하기 위함이다.
  log "컨테이너 중지"
  ( cd "$COMPOSE_DIR" && docker compose stop -t 120 ) || log "컨테이너 중지 실패"

  # 2. 백업을 GCS로 올린다. 월드 정본은 버킷이다.
  if [ -x "$BACKUP_SYNC" ]; then
    log "백업 동기화"
    "$BACKUP_SYNC" || log "백업 동기화 실패"
  fi

  # 3. VM을 내린다. GCP에서 TERMINATED 상태가 되어 컴퓨트 과금이 멈춘다.
  log "VM 종료"
  shutdown -h now
}

main() {
  local uptime players idle_elapsed decision raw

  uptime="$(uptime_seconds)"

  raw="$(status_fetch "$STATUS_URL")"
  if [ $? -ne 0 ] || [ -z "$raw" ]; then
    # 상태를 못 읽었다고 서버를 끄면 안 된다.
    # 상태 포트만 잠깐 죽어도 플레이 중인 사람들이 전부 튕긴다.
    log "상태 조회 실패. 보수적으로 아무 행동도 하지 않습니다."
    return 0
  fi

  players="$(status_player_count "$raw")"
  if [ $? -ne 0 ]; then
    log "상태 조회 실패 (파싱 불가). 보수적으로 아무 행동도 하지 않습니다."
    return 0
  fi

  idle_elapsed="$(idle_elapsed_seconds)"
  decision="$(idle_decide "$uptime" "$players" "$idle_elapsed")"

  log "uptime=${uptime}s players=${players} idle=${idle_elapsed}s decision=${decision}"
  [ "$DRY_RUN" = "1" ] && printf 'DRYRUN: %s\n' "$decision"

  case "$decision" in
    grace)
      ;;
    reset)
      rm -f "$IDLE_SINCE_FILE"
      ;;
    wait)
      [ -f "$IDLE_SINCE_FILE" ] || date +%s > "$IDLE_SINCE_FILE"
      ;;
    shutdown)
      do_shutdown
      ;;
  esac
}

main "$@"
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `./scripts/test.sh tests/test_idle_guard.bats`

Expected: `6 tests, 0 failures`

`file://` URL을 `curl`이 처리하지 못하면 `status_fetch`가 실패로 반환하므로, 테스트에서 `STATUS_URL` 대신 로컬 파일을 직접 읽도록 `status_fetch`를 오버라이드해야 할 수 있다. 그 경우 `setup()`에 다음을 추가한다.

```bash
export STATUS_FILE="$TMPROOT/status.json"
export STATUS_URL="$STATUS_FILE"
```

그리고 `status.sh`의 `status_fetch`를 다음과 같이 고친다.

```bash
status_fetch() {
  local url="$1"
  # 로컬 경로면 파일에서 읽는다. 테스트에서 네트워크 없이 검증하기 위함이다.
  if [ -f "$url" ]; then
    cat "$url"
    return 0
  fi
  curl -sf --max-time 5 "$url" 2>/dev/null || return 1
}
```

이 변경 후 `./scripts/test.sh tests/test_status_lib.bats` 도 다시 통과하는지 확인한다.

- [ ] **Step 5: 커밋**

```bash
git add agent/idle-guard.sh agent/lib/status.sh tests/test_idle_guard.bats
git commit -m "feat(agent): idle-guard 실행 스크립트와 dry-run

상태 조회에 실패하면 종료하지 않고 보수적으로 켜둔 채 둔다.
상태 포트가 잠깐 죽었다고 플레이 중인 사람들을 튕기면 안 된다.

외부 서비스에 의존하지 않으므로 웹앱 장애가 비용 유출로
이어지지 않는다."
```

---

## Task 9: 백업 동기화 스크립트

**Files:**
- Create: `agent/backup-sync.sh`
- Create: `tests/test_backup_sync.bats`

**Interfaces:**
- Consumes: 없음
- Produces: `agent/backup-sync.sh`. `GCLOUD_BIN` 환경변수로 실행 파일을 주입할 수 있어 테스트에서 목킹 가능

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/test_backup_sync.bats`:

```bash
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `./scripts/test.sh tests/test_backup_sync.bats`

Expected: FAIL. `/code/agent/backup-sync.sh` 없음

- [ ] **Step 3: 최소 구현 작성**

`agent/backup-sync.sh`:

```bash
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
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `./scripts/test.sh tests/test_backup_sync.bats`

Expected: `4 tests, 0 failures`

- [ ] **Step 5: 커밋**

```bash
git add agent/backup-sync.sh tests/test_backup_sync.bats
git commit -m "feat(agent): 백업을 GCS로 동기화

빈 디렉터리일 때 rsync를 실행하지 않는다. 빈 동기화로 원격
백업을 지우는 사고를 막기 위함이다.

원격 삭제 옵션도 쓰지 않는다. 로컬 보존 기간이 지나 사라진
백업까지 원격에서 지우면 장기 보관본이 없어진다."
```

---

## Task 10: systemd 유닛과 타이머

**Files:**
- Create: `agent/systemd/valheim-idle-guard.service`
- Create: `agent/systemd/valheim-idle-guard.timer`
- Create: `agent/systemd/valheim-backup-sync.service`
- Create: `agent/systemd/valheim-backup-sync.timer`
- Modify: `README.md` (운영 명령 추가)

**Interfaces:**
- Consumes: `agent/idle-guard.sh`, `agent/backup-sync.sh`
- Produces: VM에서 `valheim-idle-guard.timer` 가 1분 주기로, `valheim-backup-sync.timer` 가 15분 주기로 동작

- [ ] **Step 1: idle-guard 유닛 작성**

`agent/systemd/valheim-idle-guard.service`:

```ini
[Unit]
Description=발헤임 유휴 감시 및 자동 종료
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/opt/valheim/agent/idle-guard.sh
StandardOutput=journal
StandardError=journal
```

`agent/systemd/valheim-idle-guard.timer`:

```ini
[Unit]
Description=발헤임 유휴 감시를 1분마다 실행

[Timer]
# 부팅 후 2분 뒤부터 시작한다. 컨테이너가 뜰 시간을 준다.
OnBootSec=2min
OnUnitActiveSec=1min
AccuracySec=10s

[Install]
WantedBy=timers.target
```

- [ ] **Step 2: backup-sync 유닛 작성**

`agent/systemd/valheim-backup-sync.service`:

```ini
[Unit]
Description=발헤임 백업을 GCS로 동기화
After=docker.service

[Service]
Type=oneshot
ExecStart=/opt/valheim/agent/backup-sync.sh
StandardOutput=journal
StandardError=journal
```

`agent/systemd/valheim-backup-sync.timer`:

```ini
[Unit]
Description=발헤임 백업 동기화를 15분마다 실행

[Timer]
OnBootSec=10min
OnUnitActiveSec=15min
AccuracySec=1min

[Install]
WantedBy=timers.target
```

- [ ] **Step 3: 유닛 문법 검증**

Run:

```bash
docker run --rm -v "$PWD/agent/systemd:/units:ro" debian:12 \
  bash -c "apt-get update -qq && apt-get install -y -qq systemd >/dev/null 2>&1 && \
           systemd-analyze verify /units/valheim-idle-guard.service \
                                  /units/valheim-backup-sync.service 2>&1 | head -20"
```

Expected: 오류 출력 없음. `ExecStart` 경로가 컨테이너에 없다는 경고는 무시한다 (VM에는 존재한다).

- [ ] **Step 4: 배포하고 VM에서 확인**

Run:

```bash
./scripts/deploy-agent.sh
gcloud compute instances start valheim-server --zone=asia-northeast3-a
```

부팅 후 3분쯤 기다린 뒤:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="systemctl list-timers 'valheim-*' --no-pager"
```

Expected: 두 타이머가 `ACTIVE` 상태로 다음 실행 시각과 함께 표시된다.

- [ ] **Step 5: idle-guard를 dry-run으로 수동 실행해 확인**

Run:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo /opt/valheim/agent/idle-guard.sh --dry-run"
```

Expected: `DRYRUN: grace` (기동 직후이므로). 15분이 지난 뒤 다시 실행하면 `DRYRUN: wait`.

- [ ] **Step 6: 실제 로그 확인**

Run:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo journalctl -u valheim-idle-guard.service --no-pager -n 20"
```

Expected: 1분 간격으로 `uptime=... players=0 idle=...s decision=grace` 형태의 로그.

- [ ] **Step 7: README에 운영 명령 추가**

`README.md`에 다음 절을 추가한다:

```markdown
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
```

- [ ] **Step 8: 커밋**

```bash
git add agent/systemd/ README.md
git commit -m "feat(agent): systemd 유닛과 타이머

idle-guard는 1분 주기, backup-sync는 15분 주기로 동작한다.
idle-guard 타이머는 부팅 후 2분 뒤 시작해 컨테이너가 뜰 시간을 준다.

README에 운영 명령과 90일 철거 절차를 기록했다."
```

---

## Task 11: 기존 월드 이전

친구가 방장(로컬 호스트)으로 진행하던 월드를 서버로 옮긴다. 새 월드를 만드는 것이 아니다.

**이 태스크를 Task 10 뒤에 두는 이유**: 에이전트와 백업이 검증된 뒤에 진짜 월드를 들여와야 한다. 시스템이 불안정한 상태에서 실제 데이터를 넣으면 사고 시 잃는 것이 커진다.

**Files:**
- Create: `docs/guides/world-migration.md` (친구에게 그대로 전달할 수 있는 절차서)
- Create: `docs/verification/2026-09-17-world-migration.md`
- Modify: `server/.env` (`WORLD_NAME`)

**Interfaces:**
- Consumes: Task 3의 `google_storage_bucket.data`, Task 5의 `valheim` 컨테이너와 `/srv/valheim/config`, Task 9의 `backup-sync.sh`
- Produces: `gs://<버킷>/original-world/` 에 보관된 원본, 서버에서 동작하는 실제 월드

- [ ] **Step 1: 친구에게 추출 절차 전달**

`docs/guides/world-migration.md` 의 "1단계: 친구가 할 일" 절을 그대로 전달한다.

친구에게 반드시 함께 전달할 것:

1. 게임을 완전히 종료한 뒤 복사할 것 (켜진 채로 복사하면 불완전한 파일이 나온다)
2. **월드 이름을 대소문자까지 정확히** 알려줄 것
3. 원본을 지우지 말 것

- [ ] **Step 2: 받은 파일의 형식 확인**

1.0은 월드 저장을 폴더 형식으로 바꿨다. 받은 것이 어느 쪽인지 먼저 본다.

```bash
unzip -l 받은파일.zip | head -20
```

Expected 둘 중 하나:
- **1.0 형식**: 월드 이름의 디렉터리와 그 하위 파일들
- **구형식**: `WorldName.db` 와 `WorldName.fwl` 파일 쌍

`.fwl` 없이 `.db` 만 있으면 월드가 열리지 않는다. **둘 다 있는지 확인하고, 없으면 여기서 멈추고 친구에게 다시 요청한다.**

- [ ] **Step 3: 원본을 버킷에 먼저 보관**

구형식은 서버가 첫 로드에서 1.0 형식으로 변환하며, **변환은 되돌릴 수 없다.** 손대기 전에 원본부터 올린다.

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name | tr -d '')"
gcloud storage cp 받은파일.zip "gs://${BUCKET}/original-world/"
gcloud storage ls -l "gs://${BUCKET}/original-world/"
```

Expected: 파일이 보이고 크기가 0이 아니다.

**크기가 0이거나 업로드에 실패하면 다음 단계로 넘어가지 않는다.** 이 백업이 유일한 되돌리기 수단이다.

- [ ] **Step 4: 서버를 켜되 컨테이너는 멈춘 상태로 만든다**

```bash
gcloud compute instances start valheim-server --zone=asia-northeast3-a
sleep 60
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="cd /opt/valheim/server && sudo docker compose stop"
```

컨테이너가 돌아가는 상태로 월드 파일을 덮어쓰면, 서버가 메모리에 들고 있던 낡은 월드를 다시 저장하면서 방금 올린 파일을 날린다.

- [ ] **Step 5: 월드 파일 업로드와 배치**

```bash
gcloud compute scp 받은파일.zip valheim-server:~/world.zip   --zone=asia-northeast3-a --tunnel-through-iap

gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="mkdir -p ~/world-import && cd ~/world-import && unzip -o ~/world.zip && ls -la"
```

내용을 눈으로 확인한 뒤 배치한다. `Midgard` 는 실제 월드 이름으로 바꾼다.

1.0 형식(폴더)이면:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo cp -r ~/world-import/Midgard /srv/valheim/config/worlds_local/"
```

구형식(파일 쌍)이면:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo cp ~/world-import/Midgard.db ~/world-import/Midgard.fwl /srv/valheim/config/worlds_local/"
```

- [ ] **Step 6: 권한 수정**

컨테이너는 UID 1000으로 동작한다. 그리고 1.0 폴더 형식에서는 **디렉터리에 실행 비트가 없으면 월드 내부를 읽지 못한다.**

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo chown -R 1000:1000 /srv/valheim/config/worlds_local/ &&              sudo chmod -R u+rwX,go+rX /srv/valheim/config/worlds_local/ &&              sudo ls -la /srv/valheim/config/worlds_local/"
```

Expected: 디렉터리가 `drwxr-xr-x`, 소유자가 `1000 1000`.

`chmod` 의 대문자 `X` 는 디렉터리에만 실행 비트를 준다. 소문자 `x` 를 쓰면 월드 데이터 파일까지 실행 가능해지므로 쓰지 않는다.

- [ ] **Step 7: WORLD_NAME 일치**

`server/.env` 의 `WORLD_NAME` 을 실제 월드 이름과 정확히 일치시킨다. 대소문자까지.

```bash
# server/.env 수정 후
./scripts/deploy-agent.sh
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo google_metadata_script_runner startup"
```

**이름이 틀리면 서버는 에러를 내지 않는다. 그 이름으로 빈 월드를 새로 만든다.** 접속했는데 아무것도 없다면 대개 이 문제다.

- [ ] **Step 8: 기동하고 변환을 기다린다**

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo docker logs valheim --tail 80"
```

Expected: 월드 로드 로그. 구형식이었다면 변환 과정이 나타나고 몇 분 걸린다.

**변환 중에 컨테이너를 중지하거나 VM을 끄지 않는다.** 월드가 손상될 수 있다.

- [ ] **Step 9: 실제로 들어가서 확인**

발헤임 클라이언트로 접속해 다음을 확인한다.

- [ ] 건축물이 그대로 있다
- [ ] 상자 안의 물건이 그대로다
- [ ] 잡았던 보스의 제단 상태가 유지된다
- [ ] 포탈이 연결된다

지도가 비어 보이는 것은 정상일 수 있다. **지도 탐험 기록은 월드가 아니라 캐릭터에 저장된다.**

하나라도 어긋나면 가이드의 "되돌리기" 절을 따라 원본으로 복구한 뒤 재시도한다.

- [ ] **Step 10: 백업이 새 월드로 돌기 시작하는지 확인**

한 시간쯤 뒤 (또는 `backup-sync` 를 수동 실행한 뒤):

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap   --command="sudo /opt/valheim/agent/backup-sync.sh"

BUCKET="$(./scripts/tf.sh output -raw bucket_name | tr -d '')"
gcloud storage ls -l "gs://${BUCKET}/backups/"
```

Expected: 새 백업이 존재하고 크기가 0이 아니다.

- [ ] **Step 11: 친구에게 완료를 알린다**

전달할 내용:

- 이제부터 로컬 월드를 열지 말 것 (열면 월드가 갈라져 합칠 수 없다)
- 원본은 지우지 말고 보관할 것
- 접속은 서버 주소로

- [ ] **Step 12: 기록과 커밋**

`docs/verification/2026-09-17-world-migration.md` 에 다음을 기록한다: 받은 월드의 형식, 월드 이름, 원본 백업 위치, 변환 소요 시간, Step 9 체크리스트 결과.

```bash
git add docs/guides/world-migration.md docs/verification/2026-09-17-world-migration.md server/env.example
git commit -m "feat: 기존 월드 이전 절차와 검증 기록

친구가 로컬 호스트로 진행하던 월드를 서버로 옮겼다.

1.0이 월드 저장을 폴더 형식으로 바꿨고 구형식은 첫 로드에서
변환된다. 변환은 되돌릴 수 없으므로 원본을 GCS에 먼저 보관한다.

캐릭터는 클라이언트에 저장되므로 이전 대상이 아니다."
```

---

## Task 12: 통합 검증

계획의 모든 단위 테스트가 통과해도 **실물에서 동작하는지는 별개다.** 스펙 12절이 실물 검증을 필수로 못박은 이유다.

**Files:**
- Create: `docs/verification/2026-09-17-integration-test.md`

**Interfaces:**
- Consumes: Task 1~11의 전부
- Produces: 서브프로젝트 A 완료 판정 근거

- [ ] **Step 1: 전체 단위 테스트 통과 확인**

Run: `./scripts/test.sh`

Expected: 모든 bats 파일 통과. 실패가 하나라도 있으면 통합 검증을 시작하지 않는다.

- [ ] **Step 2: 서버를 켜고 친구가 접속할 수 있는지 확인**

```bash
gcloud compute instances start valheim-server --zone=asia-northeast3-a
./scripts/tf.sh output server_ip
```

발헤임 클라이언트에서 "서버 추가"로 `<IP>:2456` 을 입력하고 비밀번호로 접속한다.

Expected: 접속 성공, 월드 진입.

**접속되지 않으면 확인 순서**: 방화벽 규칙 → 컨테이너 로그 → `SERVER_PUBLIC` 설정 → 포트 번호.

- [ ] **Step 3: 접속 중에는 종료되지 않는지 확인**

접속한 상태로 20분 이상 머문 뒤:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo journalctl -u valheim-idle-guard.service -n 25 --no-pager"
```

Expected: `players=1 ... decision=reset` 이 반복되고 `shutdown`이 나타나지 않는다.

**이 검증이 스펙 리스크 R7(플레이 중 종료)의 방어선이다.**

- [ ] **Step 4: 유휴 자동 종료 확인 (시간 단축 설정으로)**

20분을 매번 기다리는 것은 비효율이므로, 한 번은 짧은 값으로 전 경로를 확인한다.

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo systemctl edit --force --full valheim-idle-guard.service"
```

`[Service]` 절에 다음을 추가한다:

```ini
Environment=GRACE_PERIOD_SEC=60
Environment=IDLE_LIMIT_SEC=120
```

저장 후:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo systemctl daemon-reload && sudo rm -f /run/valheim-idle-since"
```

게임에서 나간 뒤 약 4분 기다린다.

```bash
gcloud compute instances describe valheim-server --zone=asia-northeast3-a \
  --format="value(status)"
```

Expected: `TERMINATED`

- [ ] **Step 5: 종료 과정이 올바랐는지 확인**

VM을 다시 켜고 직전 종료 로그를 확인한다.

```bash
gcloud compute instances start valheim-server --zone=asia-northeast3-a
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo journalctl -u valheim-idle-guard.service --no-pager -b -1 | tail -20"
```

Expected 순서: `decision=shutdown` → `종료 절차 시작` → `컨테이너 중지` → `백업 동기화` → `VM 종료`.

- [ ] **Step 6: 백업이 버킷에 있는지 확인**

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
gcloud storage ls -l "gs://${BUCKET}/backups/"
```

Expected: 백업 파일이 최소 1개 존재하고 크기가 0이 아니다.

- [ ] **Step 7: 백업에서 월드를 복원할 수 있는지 확인**

백업이 실제로 쓸모 있는지 확인하지 않은 백업은 백업이 아니다.

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
mkdir -p /tmp/valheim-restore-test
gcloud storage cp "gs://${BUCKET}/backups/$(gcloud storage ls "gs://${BUCKET}/backups/" | head -1 | xargs basename)" \
  /tmp/valheim-restore-test/
cd /tmp/valheim-restore-test && unzip -l *.zip | head -20
```

Expected: 압축 파일 안에 `.db` 와 `.fwl` 월드 파일이 보인다.

- [ ] **Step 8: 시간 단축 설정을 되돌린다**

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo systemctl revert valheim-idle-guard.service && sudo systemctl daemon-reload"
```

되돌린 뒤 값이 원복되었는지 확인한다:

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo systemctl show valheim-idle-guard.service -p Environment"
```

Expected: `GRACE_PERIOD_SEC` 와 `IDLE_LIMIT_SEC` 가 보이지 않는다 (스크립트 기본값 900/1200 사용).

**이 단계를 빠뜨리면 실사용 중에 2분 만에 서버가 꺼진다.**

- [ ] **Step 9: 메모리 여유 확인 (스펙 리스크 R4)**

16GB가 실제로 충분한지 확인한다. 8명이 맵 곳곳에 흩어졌을 때가 최악이므로, 가능하면 여러 명이 접속해 서로 떨어진 위치에 있을 때 측정한다.

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="free -h && sudo docker stats --no-stream valheim"
```

Expected: 컨테이너 메모리 사용량 12GB 미만, 사용 가능 메모리 2GB 이상.

**사용량이 14GB를 넘으면** 서브프로젝트 B에서 콘텐츠 모드를 얹을 여유가 없다는 뜻이다. 사용자에게 보고하고 머신 타입 상향을 제안한다. 단 Task 2 Step 2에서 확인한 vCPU 할당량 한도 안에서만 가능하다.

- [ ] **Step 10: 서버를 끄고 비용을 확인한다**

```bash
gcloud compute instances stop valheim-server --zone=asia-northeast3-a
```

GCP 콘솔의 결제 화면에서 지금까지 소비한 크레딧을 확인하고, 스펙 5.2절의 추정과 비교한다.

- [ ] **Step 11: 검증 결과 기록**

`docs/verification/2026-09-17-integration-test.md`에 Step 2~10의 결과를 기록한다. 각 항목에 실행 명령, 기대값, 실제값, 판정을 남긴다.

- [ ] **Step 12: 커밋**

```bash
git add docs/verification/2026-09-17-integration-test.md
git commit -m "docs: 서브프로젝트 A 통합 검증 결과

실물로 확인한 항목:
- 친구 접속 가능
- 접속 중에는 자동 종료되지 않음 (리스크 R7 방어선)
- 유휴 시 컨테이너 중지, 백업 동기화, VM 종료 순서로 진행
- 백업에서 월드 파일 복원 가능

시간 단축 설정은 검증 후 원복했다."
```

---

## 완료 기준

서브프로젝트 A는 다음이 전부 참일 때 완료다.

- [ ] `./scripts/test.sh` 가 전부 통과한다
- [ ] 친구가 고정 IP로 서버에 접속할 수 있다
- [ ] 친구가 방장으로 진행하던 월드가 서버에서 그대로 열린다
- [ ] 원본 월드가 `gs://<버킷>/original-world/` 에 보관되어 있다
- [ ] 접속 중에는 서버가 꺼지지 않는다
- [ ] 아무도 없으면 20분 뒤 스스로 꺼진다
- [ ] 종료 시 컨테이너 중지, 백업 동기화, VM 종료가 순서대로 일어난다
- [ ] GCS 버킷의 백업에서 월드 파일을 꺼낼 수 있다
- [ ] 게임 포트 외에 인터넷에 열린 포트가 없다
- [ ] 자동 업데이트가 꺼져 있다
- [ ] 메모리 사용량에 모드를 얹을 여유가 있다 (12GB 미만)
- [ ] `./scripts/tf.sh destroy` 로 전부 철거할 수 있다

## 다음 단계

A가 완료되면 별도 계획으로 진행한다.

- **서브프로젝트 B**: `BEPINEX=true` 로 전환, 모드팩 v1 설치, r2modman 프로필 배포
- **서브프로젝트 C**: Cloud Run 웹앱, Firestore, `heartbeat`, 예약, 업데이트 알림
