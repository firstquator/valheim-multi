# GitHub Pages 배포 가이드

작성일: 2026-09-18

`web/` 은 Astro 정적 사이트다. `main` 브랜치에 `web/` 이나 `data/` 변경이 푸시되면 `.github/workflows/pages.yml` 워크플로가 빌드하고 GitHub Pages 로 배포한다. 이 문서는 배포를 처음 켜기 전에 결정해야 할 것과, 저장소 설정, 배포 확인 순서를 정리한다.

## 한눈에 보기

| 단계 | 누가 | 예상 시간 |
|---|---|---|
| 1. 비밀번호 노출 여부 결정 | **직접** | 5분 |
| 2. 저장소 설정에서 Pages 소스 지정 | **직접** | 2분 |
| 3. main 에 푸시 | **직접** | 1분 |
| 4. Actions 탭에서 진행 확인 | **직접** | 5분 |
| 5. 실제 사이트 확인 | **직접** | 5분 |

저장소 설정 변경(2단계)은 저장소 소유자의 GitHub 계정으로만 할 수 있는 작업이라 클로드가 대신 할 수 없다. 1단계의 결정도 마찬가지로 사용자의 몫이다. 아래 절차를 그대로 따라간다.

---

# 1단계. 비밀번호 노출 여부 결정

`web/src/config.mjs` 의 `SERVER.address` 와 `SERVER.password` 는 빌드된 정적 HTML 안에 그대로 박힌다. 저장소는 비공개로 둘 수 있지만, **GitHub Pages 로 배포된 사이트 자체는 비공개로 만들 수 없다.** 공개 조직/개인 계정의 GitHub Pages 는 저장소 가시성과 무관하게 인터넷에 공개된다.

이 워크플로는 코디네이터 요구에 따라 색인 차단 조치를 넣었다. 실제로 효과가 있는
것은 아래 중 **1번뿐**이다.

1. 모든 페이지 `<head>` 에 `<meta name="robots" content="noindex, nofollow">` (유효함)
2. `web/public/robots.txt` (`Disallow: /`) - **이 프로젝트에서는 효과가 없다.** 아래
   "robots.txt 가 효과 없는 이유" 참고

## robots.txt 가 효과 없는 이유

이 저장소는 **Project Pages** 로 배포된다(`https://firstquator.github.io/valheim-multi/`).
`web/public/robots.txt` 는 빌드되면 `/valheim-multi/robots.txt` 로 나가지만,
크롤러는 **오리진 루트**(`https://firstquator.github.io/robots.txt`)의
`robots.txt` 만 읽는다. 하위 경로에 놓인 `robots.txt` 는 규칙을 지키는 크롤러도
찾지 않으므로 사실상 아무 효과가 없다.

오리진 루트에 `robots.txt` 를 두려면 계정/조직 이름과 똑같은 별도 저장소
(`firstquator.github.io`, User/Organization Pages)가 있어야 하고, 그 저장소의
Pages 가 오리진 루트를 차지한다. 이 저장소만으로는 만들 수 없다.

`web/public/robots.txt` 파일 자체는 지우지 않고 남겨둔다. 해롭지는 않고, 나중에
User Pages 저장소로 옮기게 되면 그대로 쓸 수 있다. 다만 지금 상태에서는 실제
검색엔진 색인을 막는 것은 `noindex` 메타 태그뿐이라는 점을 알고 있어야 한다.

## 색인 차단과 접근 차단의 차이

| | 색인 차단 (noindex 메타 태그) | 접근 차단 |
|---|---|---|
| 검색 결과 노출 | 막는다 | 원래도 안 됨 |
| URL 을 아는 사람의 열람 | **못 막는다** | 막을 수 있음 |
| 이 사이트의 적용 여부 | 적용됨(`robots.txt` 는 위에서 설명한 이유로 미적용) | 적용 안 됨(정적 사이트라 로그인 벽이 없음) |

`noindex` 는(위에서 설명했듯 이 저장소에서 `robots.txt` 는 애초에 크롤러에게 닿지도 않는다) 규칙을 지키는 크롤러에게 보내는 요청일 뿐 접근 제어가 아니다. URL 을 이미 알고 있는 사람은 누구나 그대로 열람할 수 있고, 서버 접속 주소와 비밀번호를 그대로 읽을 수 있다. 저장소 이름에서 Pages 주소가 그대로 유도되므로(`https://<계정>.github.io/<저장소이름>/`), 저장소 이름을 아는 사람은 URL 을 추측할 수도 있다.

즉 이 조치는 **우발적 발견 경로를 줄이는 것**이지 **비밀번호를 비밀로 만드는 것**이 아니다.

## 결정할 것

배포하기 전에 다음 중 하나를 직접 선택해야 한다.

- 비밀번호가 사이트에 노출되는 것을 감수한다 (친구들만 아는 소규모 서버라면 실무적으로 흔한 선택이다)
- `config.mjs` 에서 비밀번호를 빼고 다른 채널(디스코드 DM 등)로만 공유한다
- Pages 배포 자체를 하지 않고 사이트를 로컬에서만 돌린다

- [ ] 위 세 가지 중 하나를 선택했다
- [ ] 비밀번호를 그대로 두기로 했다면, 그 사실을 알고 동의한 상태로 다음 단계로 진행한다

---

# 2단계. 저장소 설정에서 Pages 소스 지정

GitHub 저장소 페이지에서 **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꾼다.

- [ ] Source 를 GitHub Actions 로 바꿨다

---

# 3단계. main 에 푸시

```bash
git push
```

`web/**` 이나 `data/**` 를 건드리는 커밋이 `main` 에 올라가면 워크플로가 자동으로 돈다. `workflow_dispatch` 로 수동 실행도 가능하다 (Actions 탭 → Deploy site → Run workflow).

- [ ] main 에 푸시했다, 또는 workflow_dispatch 로 수동 실행했다

---

# 4단계. Actions 탭에서 진행 확인

`build` 와 `deploy` 두 잡이 모두 초록색이어야 한다. `build` 잡에서 다음을 확인한다.

- [ ] 루트 테스트 단계가 통과했다
- [ ] web 테스트 단계가 통과했다
- [ ] `data/mods.json` 스키마 검증을 통과했다 (빌드 실패 시 로그에 어떤 필드가 잘못됐는지 나온다)
- [ ] `deploy` 잡까지 성공했다

---

# 5단계. 실제 사이트 확인

`https://<계정>.github.io/<저장소이름>/` 로 접속해서 다음을 확인한다.

- [ ] 페이지가 뜬다
- [ ] 사이드바, 탭 전환, 서버 상태, 복사 버튼이 정상 동작한다
- [ ] 브라우저 개발자 도구에서 콘솔 오류(CORS, 404)가 없다
- [ ] 페이지 소스(브라우저 "페이지 소스 보기")의 `<head>` 안에
      `<meta name="robots" content="noindex, nofollow">` 가 들어 있다.
      **실제로 색인을 막는 것은 이 태그뿐이다** (`/robots.txt` 는 이 저장소
      구조에서 크롤러에게 닿지 않으므로 확인 대상이 아니다. 위
      "robots.txt 가 효과 없는 이유" 참고)

---

# 참고

- 서버 상태를 갱신하는 퍼블리셔 설정은 `docs/guides/status-publisher-setup.md` 를 본다.
- `GIST_ID` 가 비어 있으면 사이트는 조용히 "상태 확인 불가" 로 표시된다. 배포 자체는 `GIST_ID` 설정 여부와 무관하게 가능하다.
