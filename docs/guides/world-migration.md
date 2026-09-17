# 친구 월드를 데디케이티드 서버로 옮기기

친구가 방장(로컬 호스트)으로 진행하던 월드를 우리 서버로 이전하는 절차다.

## 먼저 알아둘 것

### 캐릭터는 옮기지 않아도 된다

발헤임은 **캐릭터와 월드를 따로 저장한다.**

| 대상 | 저장 위치 | 이전 필요 |
|---|---|---|
| 월드 (지형, 건축물, 상자, 보스 진행) | 방장 PC | **필요** |
| 캐릭터 (레벨, 스킬, 인벤토리, 장비) | 각자 PC | 불필요 |

친구들은 각자 쓰던 캐릭터 그대로 서버에 들어오면 된다. 아무것도 안 해도 된다.

### 이전 시점부터 서버가 정본이다

옮긴 뒤에도 친구가 로컬 월드에서 계속 플레이하면 두 월드가 갈라진다. 나중에 합칠 방법이 없다.

**이전이 끝나면 친구는 로컬 월드를 열지 않는다.** 원본은 지우지 말고 보관만 한다.

### 1.0이 저장 형식을 바꿨다

2026년 9월 9일 1.0부터 월드 저장 방식이 바뀌었다.

| 형식 | 모습 | 옮길 대상 |
|---|---|---|
| **1.0 형식** | `worlds_local/` 안에 **월드 이름의 폴더** | 폴더 통째로 |
| **구형식 (1.0 이전)** | `WorldName.db` + `WorldName.fwl` **파일 쌍** | 두 파일 모두 |

구형식을 올리면 서버가 **첫 로드 때 1.0 형식으로 변환한다.** 몇 분 걸릴 수 있고, **변환은 되돌릴 수 없다.** 그래서 원본 백업이 필수다.

---

## 1단계: 친구가 할 일 (월드 파일 꺼내기)

친구에게 이 절만 그대로 전달하면 된다.

### 1-1. 게임을 완전히 종료한다

월드 데이터는 저장할 때 디스크에 쓰인다. 게임이 켜져 있으면 **불완전한 파일을 복사하게 된다.**

1. 월드에서 나가기 (메인 메뉴로)
2. 발헤임 종료
3. Steam이 클라우드 동기화를 끝낼 때까지 잠시 기다리기

### 1-2. 저장 폴더 열기

`Win + R` 을 누르고 아래를 붙여넣은 뒤 엔터.

```
%USERPROFILE%\AppData\LocalLow\IronGate\Valheim\worlds_local
```

### 1-3. 어느 형식인지 확인한다

폴더 안을 본다.

**A. 월드 이름의 폴더가 보이면 → 1.0 형식**

```
worlds_local/
└── Midgard/          <- 이 폴더를 통째로 옮긴다
    ├── ...
    └── ...
```

그 폴더를 우클릭해서 압축(ZIP)한다.

**B. 파일 쌍만 보이면 → 구형식**

```
worlds_local/
├── Midgard.db        <- 이 둘을 옮긴다
├── Midgard.fwl       <-
├── Midgard.db.old    (자동 백업. 보험으로 같이 보내면 좋다)
└── Midgard.fwl.old
```

`.db` 와 `.fwl` **둘 다** 선택해서 압축한다. 하나만 보내면 월드가 열리지 않는다.

`.old` 파일은 게임이 만드는 자동 백업이다. 필수는 아니지만 같이 보내면 사고 시 보험이 된다.

### 1-4. 압축 파일을 방장에게 보낸다

월드 크기에 따라 수십 MB에서 수백 MB가 될 수 있다. 메신저로 안 되면 클라우드 드라이브를 쓴다.

**보낼 때 월드 이름을 정확히 알려준다.** 대소문자까지 그대로. 서버 설정이 이 이름과 일치해야 한다.

### 1-5. 원본은 지우지 않는다

이전이 잘 됐는지 확인될 때까지 `worlds_local` 폴더를 건드리지 않는다.

---

## 2단계: 방장이 할 일 (서버에 올리기)

### 2-1. 서버가 꺼져 있는지 확인한다

```bash
gcloud compute instances describe valheim-server --zone=asia-northeast3-a \
  --format="value(status)"
```

`TERMINATED` 여야 한다. 실행 중이면 끈다.

```bash
gcloud compute instances stop valheim-server --zone=asia-northeast3-a
```

**켜진 상태로 월드 파일을 덮어쓰면 서버가 메모리의 낡은 월드를 다시 저장해 방금 올린 파일을 날린다.**

### 2-2. 원본을 버킷에 먼저 보관한다

변환은 되돌릴 수 없다. 손대기 전에 원본부터 올린다.

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
gcloud storage cp 받은파일.zip "gs://${BUCKET}/original-world/"
gcloud storage ls -l "gs://${BUCKET}/original-world/"
```

크기가 0이 아닌지 확인한다.

### 2-3. VM을 켜고 월드를 올린다

```bash
gcloud compute instances start valheim-server --zone=asia-northeast3-a
```

컨테이너가 월드를 잡기 전에 작업해야 하므로, 켜자마자 바로 컨테이너를 멈춘다.

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="cd /opt/valheim/server && sudo docker compose stop"
```

월드 파일을 업로드한다.

```bash
gcloud compute scp 받은파일.zip valheim-server:~/world.zip \
  --zone=asia-northeast3-a --tunnel-through-iap
```

### 2-4. 압축을 풀고 배치한다

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap
```

VM 안에서:

```bash
# 기존 월드 디렉터리 확인
sudo ls -la /srv/valheim/config/worlds_local/

# 임시 폴더에 풀어서 내용부터 확인한다. 바로 덮어쓰지 않는다.
mkdir -p ~/world-import && cd ~/world-import
unzip ~/world.zip
ls -la
```

내용을 확인한 뒤 배치한다.

**1.0 형식(폴더)이면:**

```bash
sudo cp -r ~/world-import/Midgard /srv/valheim/config/worlds_local/
```

**구형식(파일 쌍)이면:**

```bash
sudo cp ~/world-import/Midgard.db  /srv/valheim/config/worlds_local/
sudo cp ~/world-import/Midgard.fwl /srv/valheim/config/worlds_local/
```

`Midgard` 는 실제 월드 이름으로 바꾼다.

### 2-5. 권한을 고친다 (빠뜨리기 쉬운 단계)

컨테이너는 UID 1000으로 돌아간다. 소유권이 맞지 않으면 서버가 월드를 못 읽는다.

그리고 1.0 폴더 형식에서는 **디렉터리에 실행 비트가 있어야 안을 들여다볼 수 있다.** 실행 비트가 빠지면 월드가 통째로 안 보인다.

```bash
sudo chown -R 1000:1000 /srv/valheim/config/worlds_local/
# 대문자 X는 디렉터리에만 실행 비트를 준다. 파일에는 주지 않는다.
sudo chmod -R u+rwX,go+rX /srv/valheim/config/worlds_local/
sudo ls -la /srv/valheim/config/worlds_local/
```

디렉터리가 `drwxr-xr-x` 인지 확인한다.

### 2-6. 월드 이름을 서버 설정에 맞춘다

`server/.env` 의 `WORLD_NAME` 이 실제 월드 이름과 **정확히** 일치해야 한다. 대소문자까지.

로컬에서 수정한 뒤 반영한다.

```bash
# server/.env 의 WORLD_NAME 을 수정한 뒤
./scripts/deploy-agent.sh
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo google_metadata_script_runner startup"
```

이름이 틀리면 서버는 **에러를 내지 않고 그 이름으로 빈 월드를 새로 만든다.** 접속해서 아무것도 없으면 대개 이 문제다.

### 2-7. 서버를 켜고 변환을 기다린다

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="cd /opt/valheim/server && sudo docker compose up -d"
```

로그를 지켜본다.

```bash
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo docker logs -f valheim"
```

구형식이었다면 변환 과정이 보이고 **몇 분 걸린다.** 끝날 때까지 기다린다. 중간에 끊으면 월드가 손상될 수 있다.

---

## 3단계: 확인

### 3-1. 직접 들어가서 본다

발헤임에서 `<고정IP>:2456` 으로 접속한다.

확인할 것:

- [ ] 우리가 짓던 건축물이 그대로 있다
- [ ] 상자 안의 물건이 그대로다
- [ ] 발견했던 지역이 지도에 남아 있다
- [ ] 잡았던 보스의 제물 제단 상태가 유지된다
- [ ] 포탈이 연결된다

지도가 비어 있는 것은 정상일 수 있다. **지도 탐험 기록은 캐릭터에 저장되므로** 다른 캐릭터로 들어가면 안 보인다.

### 3-2. 백업이 도는지 확인한다

이전이 끝나고 한 시간쯤 뒤:

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
gcloud storage ls -l "gs://${BUCKET}/backups/"
```

새 백업이 쌓이기 시작하면 정상이다.

### 3-3. 친구에게 알린다

확인이 끝나면 친구에게 알린다.

- 이제부터 로컬 월드를 열지 말 것
- 원본은 지우지 말고 보관할 것
- 접속은 서버 주소로

---

## 문제 해결

| 증상 | 원인 | 조치 |
|---|---|---|
| 접속했는데 아무것도 없는 새 월드다 | `WORLD_NAME` 이 실제 월드 이름과 불일치 | 2-6 재확인. 대소문자까지 일치시킨다 |
| 서버가 뜨지 않는다 | `.fwl` 또는 `.db` 중 하나가 빠졌다 | 친구에게 두 파일 모두 다시 요청 |
| 월드가 목록에 안 잡힌다 | 디렉터리 실행 비트 누락 | 2-5의 `chmod -R u+rwX,go+rX` 재실행 |
| 권한 오류 로그가 뜬다 | 소유권이 UID 1000이 아니다 | 2-5의 `chown -R 1000:1000` 재실행 |
| 건축물 일부가 사라졌다 | 복사 시점에 게임이 켜져 있었다 | 1-1부터 다시. 게임을 완전히 종료하고 재추출 |
| 변환 중 서버가 죽었다 | 변환이 끝나기 전에 중단됨 | 2-2의 원본 백업으로 되돌린 뒤 재시도 |

### 되돌리기

무언가 잘못되면 원본으로 돌아간다.

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="cd /opt/valheim/server && sudo docker compose stop"

# 손상된 월드를 치운다
gcloud compute ssh valheim-server --zone=asia-northeast3-a --tunnel-through-iap \
  --command="sudo mv /srv/valheim/config/worlds_local /srv/valheim/config/worlds_local.broken"

# 원본을 다시 내려받아 2-3부터 반복한다
gcloud storage cp "gs://${BUCKET}/original-world/받은파일.zip" .
```

원본을 GCS에 올려둔 것이 여기서 값을 한다.

---

## 모드를 나중에 켤 때

이 월드는 바닐라에서 시작했다. 서브프로젝트 B에서 모드를 켤 때 알아둘 것.

- **모드를 추가**하는 것은 비교적 안전하다. 기존 월드에 새 요소가 얹히는 방향이다
- **모드를 제거**하는 것은 위험하다. 그 모드가 만든 아이템이나 건축물이 월드에 남아 있으면 로드 시 사라지거나 오류가 난다
- 따라서 **모드를 켜기 직전에 반드시 백업을 확인한다**
- 특히 `PlantEverything` 처럼 새 오브젝트를 심는 모드는 한 번 심으면 제거하기 어려워진다

모드를 켜기 전 백업 확인:

```bash
BUCKET="$(./scripts/tf.sh output -raw bucket_name)"
gcloud storage ls -l "gs://${BUCKET}/backups/" | tail -5
```
