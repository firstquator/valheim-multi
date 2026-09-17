# 발헤임 모드 포털

발헤임 서버의 모드 안내 정적 사이트다. Astro로 빌드한다.

## 명령

| 명령 | 동작 |
| :--- | :--- |
| `npm install` | 의존성 설치 |
| `npm run dev` | 로컬 개발 서버 실행 (`localhost:4321`) |
| `npm run build` | 정적 사이트를 `./dist/`에 빌드 |
| `npm test` | 스키마 검증 등 테스트 실행 |

## 데이터

모드 정보의 정본은 저장소 루트의 `data/mods.json`이다. 빌드 시 `src/lib/mods-schema.mjs`의 스키마 검증을 통과해야 하며, 검증에 실패하면 빌드가 실패한다.
