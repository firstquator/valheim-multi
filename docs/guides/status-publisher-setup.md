# 상태 퍼블리셔 설정 가이드

작성일: 2026-09-18

사이트는 정적 페이지라 서버에 직접 접속하지 못한다. 대신 집 PC 에서 도는 `agent/status-publisher.mjs` 가 30초마다 서버 상태를 GitHub Gist 에 올리고, 사이트는 그 Gist 를 읽어서 보여준다. 이 문서는 그 연결을 처음 설정하고, PC 를 켜둔 동안 계속 돌게 만들고, 문제가 생겼을 때 어디를 보는지 정리한다.

## 한눈에 보기

| 단계 | 누가 | 예상 시간 |
|---|---|---|
| 1. Gist 만들기 | **직접** | 3분 |
| 2. 토큰 발급 | **직접** | 3분 |
| 3. 값 채우기 | **직접** | 2분 |
| 4. 수동으로 한 번 실행해서 확인 | **직접** | 5분 |
| 5. 사이트 연결 확인 | **직접** | 5분 |
| 6. 작업 스케줄러로 상시 실행 등록 | **직접** | 10분 |
| 7. 재부팅 후 자동 시작 확인 | **직접** | 5분 |

토큰 발급과 Gist 생성은 사용자의 GitHub 계정으로만 할 수 있는 작업이라 클로드가 대신 할 수 없다. 아래 절차를 그대로 따라간다.

---

# 1단계. Gist 만들기

https://gist.github.com 으로 간다.

- 파일 이름: `valheim-status.json`
- 내용: `{}`
- **Create secret gist** 버튼을 누른다. **Create public gist** 는 누르지 않는다

## 시크릿과 퍼블릭의 차이

| | Secret gist | Public gist |
|---|---|---|
| 검색이나 목록에 노출 | 안 됨 | 됨 |
| URL 을 아는 사람 | 볼 수 있음 | 볼 수 있음 |
| 되돌리기 | 나중에 Public 으로 바꿀 수 있음(비가역) | - |

시크릿이어도 **URL 을 아는 사람은 누구나 내용을 볼 수 있다.** 완전 비공개가 아니다. 그래도 검색에 안 걸리는 것만으로 충분하므로 시크릿을 쓴다. Gist 안에는 접속 인원, 게임 버전, 백업 시각만 들어가고 서버 비밀번호는 절대 넣지 않으므로(아래 4단계에서 확인), 유출돼도 실질적인 피해는 없다.

- [ ] Gist 를 만들었다
- [ ] 브라우저 주소창의 URL 마지막 32자리를 적어뒀다. 이것이 **Gist ID** 다

예: `https://gist.github.com/사용자명/1a2b3c4d5e6f7890abcdef1234567890` 이면 `1a2b3c4d5e6f7890abcdef1234567890` 이 Gist ID.

---

# 2단계. 토큰 발급

https://github.com/settings/tokens 로 간다. **Fine-grained tokens** 탭을 선택하고 **Generate new token** 을 누른다.

| 항목 | 값 |
|---|---|
| Token name | `valheim-status-publisher` |
| Expiration | 1년 (또는 원하는 기간) |
| Resource owner | 본인 계정 |
| Repository access | **No access** (저장소는 건드릴 필요 없다) |
| Permissions | **Account permissions → Gists : Read and write** 하나만 |

> **저장소 권한은 절대 주지 않는다.** 이 토큰이 하는 일은 Gist 하나를 갱신하는 것뿐이다. 권한을 필요한 만큼만 주는 것이 유출 시 피해를 최소화하는 방법이다.

- [ ] 토큰을 발급했다
- [ ] 발급 화면에 뜬 토큰 문자열(`github_pat_...`)을 안전한 곳에 복사해뒀다. **이 화면을 벗어나면 다시 볼 수 없다**

---

# 3단계. 값 채우기

## 3-1. 퍼블리셔가 읽을 환경 변수 파일

`agent/env.example` 을 복사해 `agent/.env` 를 만든다.

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
cp agent/env.example agent/.env
```

`agent/.env` 를 열어 두 줄을 채운다.

```
GIST_TOKEN=2단계에서_발급받은_토큰
GIST_ID=1단계에서_확인한_gist_id
```

`agent/.env` 는 `.gitignore` 에 등록되어 있어 커밋되지 않는다. **절대 `git add` 로 강제로 올리지 않는다.**

## 3-2. 사이트가 읽을 Gist ID

`web/src/config.mjs` 를 연다.

```js
export const GIST_ID = "";
```

이 값을 실제 Gist ID 로 바꾼다.

```js
export const GIST_ID = "1a2b3c4d5e6f7890abcdef1234567890";
```

이 값은 **토큰과 달리 공개되어도 된다.** 사이트가 빌드되면 이 문자열이 브라우저에 그대로 노출되지만, Gist 자체가 읽기 전용으로만 쓰이고(사이트는 조회만 한다) 토큰은 PC 안 `agent/.env` 에만 있으므로 문제가 없다.

같은 파일의 `GIST_OWNER` 는 Gist 를 만든 GitHub 사용자명이다. `firstquator` 로 미리 채워져 있으므로, **본인 계정으로 Gist 를 만들었다면 그대로 두면 된다.** 다른 계정으로 만들었을 때만 바꾼다.

```js
export const GIST_OWNER = "firstquator";
```

사이트는 이 두 값으로 `https://gist.githubusercontent.com/<GIST_OWNER>/<GIST_ID>/raw/valheim-status.json` 을 조회한다. 둘 중 하나라도 틀리면 404 가 되고 화면은 "상태 확인 불가" 로 남는다.

- [ ] `agent/.env` 를 만들고 두 값을 채웠다
- [ ] `web/src/config.mjs` 의 `GIST_ID` 를 채웠다
- [ ] `web/src/config.mjs` 의 `GIST_OWNER` 가 Gist 를 만든 계정과 같다

---

# 4단계. 수동으로 한 번 실행해서 확인

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
node --env-file=agent/.env agent/status-publisher.mjs
```

PowerShell 에서는 `--env-file` 옵션 표기가 동일하다.

```powershell
node --env-file=agent\.env agent\status-publisher.mjs
```

Expected 출력:

```
status-publisher 시작. 주기 30초
푸시 완료 running=true players=0
```

`Ctrl+C` 로 멈추기 전까지 계속 실행 상태로 둔다.

## 확인할 것

브라우저에서 만들어둔 Gist 를 새로고침한다.

- [ ] `valheim-status.json` 에 `updatedAt`, `server`, `backup` 이 들어 있다
- [ ] `server.gameVersion` 이 실제 게임 버전이다
- [ ] `server.address` 가 현재 공인 IP 다
- [ ] **비밀번호가 어디에도 없다** (`server/.env` 의 `SERVER_PASS` 값이 절대 보이면 안 된다)

이 확인이 끝나면 그대로 `Ctrl+C` 로 멈추지 말고, 다음 단계로 넘어가서 사이트 쪽도 확인한다.

---

# 5단계. 사이트 연결 확인

퍼블리셔를 켜둔 상태에서 새 터미널을 연다.

```bash
npm --prefix web run dev
```

로컬 주소(보통 `http://localhost:4321`)로 접속한다.

- [ ] 서버 탭의 상태 뱃지가 "접속 중" 으로 바뀐다
- [ ] "N초 전 확인" 이 표시되고 시간이 흐르며 갱신된다
- [ ] 월드 탭의 최근 백업 시각이 채워진다

확인이 끝나면 개발 서버를 종료한다(`Ctrl+C`).

## 꺼짐 경로도 확인한다

퍼블리셔를 `Ctrl+C` 로 멈추고 3분 이상 기다린 뒤 사이트를 새로고침한다.

- [ ] "서버 꺼짐" 으로 표시된다
- [ ] 낡은 접속자 목록이 남아 있지 않다

이 확인이 중요한 이유는, **낡은 데이터를 현재인 척 보여주는 것이 아무것도 안 보여주는 것보다 나쁘기** 때문이다. 퍼블리셔가 멈추면 사이트도 "모른다" 고 정직하게 말해야 한다.

---

# 6단계. 작업 스케줄러로 상시 실행 등록

수동 실행은 터미널을 닫으면 같이 끊긴다. PC 를 켜두는 동안 계속 돌게 하려면 Windows 작업 스케줄러에 등록한다.

## 6-1. 실행용 스크립트

`agent/run-status-publisher.cmd` 가 이미 준비되어 있다. 콘솔 창 없이도 동작하도록 로그를 `agent/status-publisher.log` 파일에 남긴다.

내용을 확인만 하면 되고 수정할 필요는 없다.

## 6-2. 작업 만들기

`Win + R` → `taskschd.msc` → 엔터로 작업 스케줄러를 연다.

**동작 → 기본 작업 만들기**

| 화면 | 입력 |
|---|---|
| 이름 | `valheim-status-publisher` |
| 트리거 | **컴퓨터가 시작될 때** |
| 동작 | 프로그램 시작 |
| 프로그램/스크립트 | `C:\Users\SangHyeonLee\orca\valheim-multi\agent\run-status-publisher.cmd` |
| 시작 위치 | `C:\Users\SangHyeonLee\orca\valheim-multi` |

기본 마법사를 끝낸 뒤, 만들어진 작업을 더블클릭해서 속성을 연다.

**일반 탭**

- [ ] "사용자가 로그온했는지 여부에 관계없이 실행" 을 선택한다 (로그인 화면에서도 서버 상태를 알 수 있어야 하므로)
- [ ] "가장 높은 수준의 권한으로 실행" 체크

> "사용자가 로그온했는지 여부에 관계없이 실행" 을 선택하면 Windows 계정 비밀번호를 한 번 입력해야 한다. 계정 비밀번호가 바뀌면 이 작업도 다시 등록해야 동작한다.

**조건 탭**

- [ ] "컴퓨터가 AC 전원에 연결된 경우에만 작업 시작" 체크를 **해제**한다 (데스크톱은 상시 전원이지만, 노트북이면 배터리로도 돌아야 한다)

**설정 탭**

- [ ] "작업이 실패하면 다시 시작 간격" : 1분, 횟수 3회
- [ ] "이미 실행 중인 경우 다음 규칙 적용" : **새 인스턴스를 시작하지 않음**

마지막 항목이 중요하다. 재부팅 없이 작업을 다시 실행하면 두 개의 퍼블리셔가 동시에 같은 Gist 를 갱신하려고 시도할 수 있다.

퍼블리셔 코드 자체도 연속 20회(기본값) 실패하면 스스로 종료 코드 1로 꺼지도록 되어 있다. 작업 스케줄러의 재시작 설정과 맞물려서, 일시적인 네트워크 문제로 완전히 멈춰버리는 상황을 막아준다.

- [ ] 작업을 만들었다
- [ ] 속성에서 위 항목들을 확인했다

## 6-3. 바로 확인

작업 목록에서 방금 만든 작업을 우클릭 → **실행**. 몇 초 뒤 `agent/status-publisher.log` 를 열어 "푸시 완료" 로그가 쌓이는지 확인한다.

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
tail -f agent/status-publisher.log
```

---

# 7단계. 재부팅 후 자동 시작 확인

PC 를 껐다 켜지 않으면 "정말 재부팅해도 도는지" 확인할 방법이 없다.

- [ ] PC 를 재시작한다
- [ ] 로그인 없이(또는 로그인 후) 몇 분 기다린다
- [ ] `agent/status-publisher.log` 에 새 타임스탬프의 "푸시 완료" 로그가 있는지 확인한다
- [ ] 사이트를 새로고침해서 "접속 중" 표시가 뜨는지 확인한다 (Docker Desktop 과 발헤임 컨테이너도 같이 자동 시작되도록 설정되어 있어야 한다. 컨테이너가 안 떴다면 `server.running` 이 `false` 로 정직하게 뜨는 것이 정상이다)

**PC 가 꺼지면 서버도 퍼블리셔도 함께 멈춘다.** 이 프로젝트는 상시 가동 서버가 아니라 집 PC 자가 호스팅이므로, 친구들에게 "PC 를 켜둔 시간에만 접속 가능" 이라는 점을 미리 알려둔다.

---

# 토큰 만료 시 갱신 절차

Fine-grained token 은 만료일이 지나면 자동으로 무효화된다. 그러면 퍼블리셔가 계속 403/401 오류로 실패한다.

1. https://github.com/settings/tokens 에서 기존 토큰을 확인한다 (만료된 토큰은 목록에 "Expired" 로 표시된다)
2. **2단계** 그대로 새 토큰을 발급한다 (이름은 구분되게 `valheim-status-publisher-2` 처럼 바꿔도 된다)
3. `agent/.env` 의 `GIST_TOKEN` 값만 새 토큰으로 바꾼다. `GIST_ID` 는 그대로 둔다
4. 작업 스케줄러에서 `valheim-status-publisher` 작업을 우클릭 → **끝내기** 후 → **실행** 으로 재시작한다 (또는 PC 재부팅)
5. `agent/status-publisher.log` 에 "푸시 완료" 로그가 다시 쌓이는지 확인한다

이전 토큰은 https://github.com/settings/tokens 에서 **Delete** 로 지워도 된다. 이미 만료되어 있어도 목록에 남아 있으면 혼동을 줄 수 있다.

---

# 장애 시 확인 순서

사이트에 "서버 꺼짐" 또는 "상태 확인 불가" 가 계속 떠 있을 때, 이 순서로 확인한다.

## 1. 퍼블리셔 로그

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
tail -50 agent/status-publisher.log
```

| 로그에 보이는 것 | 의미 | 조치 |
|---|---|---|
| "푸시 완료" 가 최근 시각으로 계속 찍힌다 | 퍼블리셔는 정상이다 | 2번으로 이동 |
| "푸시 실패" 가 반복된다, 메시지에 `status=401` 또는 `status=403` | 토큰이 잘못됐거나 만료됨 | 위 "토큰 만료 시 갱신 절차" 진행 |
| "푸시 실패" 가 반복된다, 메시지에 `status=404` | Gist ID 가 틀림 | `agent/.env` 의 `GIST_ID` 재확인 |
| 로그 자체가 갱신되지 않는다(파일 수정 시각이 오래됨) | 퍼블리셔 프로세스가 죽었거나 작업이 등록 안 됨 | 작업 스케줄러에서 작업 상태 확인, 수동으로 "실행" |
| "연속 실패 한도 초과" | 20회 연속 실패로 프로세스가 스스로 종료함 | 작업 스케줄러 재시작 설정이 살아있는지 확인, 근본 원인(토큰/네트워크)부터 해결 |

## 2. Gist 갱신 시각

Gist 페이지를 열어 새로고침한다. 우측 상단에 "edited X ago" 가 표시된다.

- 30초~1분 이내로 계속 갱신되고 있으면 퍼블리셔와 GitHub 연결은 정상이다. 문제는 사이트 쪽(3번)이다
- 사이트는 60초마다 조회한다. 퍼블리셔가 30초마다 올리므로 화면에 보이는 값의 나이는 최대 90초 안쪽이다
- 몇 분~몇 시간째 멈춰 있으면 1번으로 돌아가 로그를 다시 본다

## 3. 페이지 콘솔

사이트를 열고 브라우저 개발자 도구(F12) → Console 탭을 본다.

| 콘솔에 보이는 것 | 의미 | 조치 |
|---|---|---|
| 에러 없이 조용하다, 그런데 계속 "확인 불가" | `GIST_ID` 가 빈 값이거나 잘못됨 | `web/src/config.mjs` 재확인, 빌드/배포 다시 |
| 네트워크 탭에 `gist.githubusercontent.com/...` 요청이 404 | 사이트에 박힌 `GIST_ID` 또는 `GIST_OWNER` 가 실제 Gist 와 다름 | `web/src/config.mjs` 수정 후 재배포 |
| 네트워크 탭에 요청 자체가 안 보인다 | `LiveStatus.js` 가 로드되지 않았거나 스크립트 오류 | 콘솔 상단의 다른 에러 메시지 확인 |
| CORS 에러 | GitHub Gist API 자체는 공개 API 라 CORS 를 막지 않는다. 이 에러가 보이면 URL 오타 등 다른 문제일 가능성이 높다 | 요청 URL 을 그대로 브라우저 주소창에 붙여 직접 열어본다 |

---

# 막히면

퍼블리셔 로그, Gist 페이지 화면, 브라우저 콘솔을 각각 캡처해서 보여주면 어느 단계에서 끊겼는지 짚어준다.
