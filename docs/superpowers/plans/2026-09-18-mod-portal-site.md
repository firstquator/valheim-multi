# 모드 포털: 친구 페이지 + 상태 퍼블리셔 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 친구들이 적용 중인 모드와 자기가 설치할 것을 확인하고 서버 접속 정보를 얻는 정적 페이지를 만들고, 서버 PC가 상태를 주기적으로 밀어 올리게 한다.

**Architecture:** Astro로 빌드한 정적 사이트를 GitHub Pages에 올린다. 모드 정보는 저장소의 `data/mods.json` 하나가 정본이며 빌드에 포함되므로 서버 상태와 무관하게 즉시 보인다. 서버 PC의 `status-publisher`가 30초마다 상태를 GitHub Gist에 밀어 올리고, 페이지는 그 Gist를 fetch해 상태 영역만 갱신한다.

**Tech Stack:** Astro, 바닐라 CSS(디자인 토큰), `@hugeicons/static` SVG 인라인, Node 24, Vitest, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-18-mod-portal-web-design.md`

## 범위

스펙은 세 덩어리를 담고 있다. 이 계획은 앞의 둘만 다룬다.

| | 범위 |
|---|---|
| **이 계획** | 친구 페이지 + status-publisher. 합쳐야 동작하는 하나다 |
| 별도 계획 | 관리 패널. 앞의 둘이 돌아간 뒤에 만든다 |

## Global Constraints

스펙에서 가져온 전역 요구사항. 모든 태스크가 암묵적으로 포함한다.

- **이모지를 한 글자도 쓰지 않는다.** 모든 아이콘은 `@hugeicons/static`의 SVG
- **em dash(`—`)와 en dash(`–`)를 쓰지 않는다.** 코드, 주석, UI 문구, 커밋 메시지 전부
- UI 문구와 주석은 한국어로 쓴다
- **작업 브랜치를 만들지 않는다.** `main`에서 직접 작업하고 커밋한다
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`
- 다크 모드만 만든다. 라이트 모드용 토큰을 추가하지 않는다
- 반응형은 1024px 이상이 기준이다. 768px 미만은 최적화하지 않는다
- **사이드바는 콘텐츠 위에 얹히고 콘텐츠를 밀지 않는다**
- 색은 CSS 커스텀 속성으로만 쓴다. 하드코딩한 색상값을 컴포넌트에 넣지 않는다
- 비밀번호를 Gist에 넣지 않는다

### 확정된 디자인 토큰

```css
--bg: #16181C;
--surface: #1E2126;
--accent: #C8955A;
--highlight: #D9A441;
--success: #7A9A6B;
--warning: #C4634A;
```

### 확정된 아이콘 파일명

`@hugeicons/static` 0.1.5의 `icons/` 아래에 있는 실제 파일명이다. 실물로 확인했다.

| 용도 | 파일 |
|---|---|
| 서버 탭 | `home-01.svg` |
| 모드 탭 | `package-02.svg` |
| 설치 가이드 탭 | `download-04.svg` |
| 월드 탭 | `globe-02.svg` |
| 복사 버튼 | `copy-01.svg` |
| 경고 블록 | `alert-01.svg` |
| 접속자 | `user-02.svg` |

## 파일 구조

```
valheim-multi/
├── data/
│   └── mods.json                  모드 정보 정본
├── web/                           Astro 프로젝트
│   ├── package.json
│   ├── astro.config.mjs
│   ├── src/
│   │   ├── lib/
│   │   │   ├── mods-schema.mjs    mods.json 스키마 검증
│   │   │   ├── status.mjs         상태 판정 (신선도, 표시 문구)
│   │   │   └── icon.mjs           SVG 인라인 헬퍼
│   │   ├── styles/
│   │   │   └── tokens.css         디자인 토큰
│   │   ├── components/
│   │   │   ├── Sidebar.astro      접힘/hover 사이드바
│   │   │   ├── Tabs.astro         탭 셸
│   │   │   ├── CopyField.astro    복사 가능한 값
│   │   │   ├── ModCard.astro      모드 카드
│   │   │   └── WarningBlock.astro 경고 블록
│   │   ├── islands/
│   │   │   └── LiveStatus.js      Gist fetch 후 상태 영역 갱신
│   │   └── pages/
│   │       └── index.astro        단일 페이지, 탭으로 전환
│   └── tests/
│       ├── mods-schema.test.mjs
│       └── status.test.mjs
├── agent/
│   ├── status-publisher.mjs       상태 수집 및 Gist 푸시
│   └── lib/
│       ├── collect.mjs            상태 객체 조립
│       └── logparse.mjs           로그에서 접속자 추출
├── tests/
│   ├── fixtures/                  이미 존재 (status-*.json 4종)
│   ├── collect.test.mjs
│   └── logparse.test.mjs
└── .github/workflows/
    └── pages.yml                  빌드 후 배포
```

**분리 원칙**: `lib/status.mjs`는 판정만 한다(신선한가, 뭐라고 표시할까). `islands/LiveStatus.js`는 fetch와 DOM 갱신만 한다. 판정 로직이 DOM에 섞이면 테스트가 불가능해진다. `agent/lib/collect.mjs`도 같은 이유로 순수 함수다.

---

## Task 1: 프로젝트 골격과 디자인 토큰

**Files:**
- Create: `web/package.json`
- Create: `web/astro.config.mjs`
- Create: `web/src/styles/tokens.css`
- Create: `web/src/pages/index.astro`
- Create: `web/.gitignore`

**Interfaces:**
- Consumes: 없음
- Produces: `npm run dev` / `npm run build`가 동작하는 Astro 프로젝트. `tokens.css`의 CSS 커스텀 속성

- [ ] **Step 1: Astro 프로젝트 생성**

Run:

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
npm create astro@latest web -- --template minimal --no-install --no-git --skip-houston --typescript strict
```

Expected: `web/` 디렉터리 생성. 대화형 질문이 나오면 기본값을 고른다.

- [ ] **Step 2: 의존성 설치**

Run:

```bash
cd web
npm install
npm install -D vitest
npm install @hugeicons/static@0.1.5
```

Expected: `node_modules` 생성, 오류 없음

- [ ] **Step 3: 디자인 토큰 작성**

`web/src/styles/tokens.css`:

```css
/* 발헤임의 색감에서 가져오되 채도를 낮게 잡는다.
   형광색을 쓰면 게임 분위기가 깨진다. */
:root {
  --bg: #16181C;
  --surface: #1E2126;
  --surface-raised: #262A30;
  --border: #2E333A;

  --accent: #C8955A;
  --highlight: #D9A441;
  --success: #7A9A6B;
  --warning: #C4634A;

  --text: #E8E6E3;
  --text-dim: #9AA0A6;
  --text-faint: #6B7176;

  --sidebar-w-collapsed: 64px;
  --sidebar-w-expanded: 240px;

  --radius: 10px;
  --gap: 16px;

  --font-sans: "Pretendard Variable", Pretendard, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* 사이드바 전환. 라벨은 이보다 60ms 늦게 나타난다. */
  --ease-sidebar: cubic-bezier(0.32, 0.72, 0, 1);
  --dur-sidebar: 220ms;
}

* { box-sizing: border-box; }

html, body {
  margin: 0;
  padding: 0;
  background: var(--bg);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: 15px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}

/* 평평한 디지털 느낌을 덜기 위한 미세 노이즈.
   텍스처 이미지를 쓰지 않고 SVG 필터로 만든다. */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
  opacity: 0.025;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)'/%3E%3C/svg%3E");
}

code, .mono { font-family: var(--font-mono); }
```

- [ ] **Step 4: 폰트 로드와 최소 페이지**

`web/src/pages/index.astro`:

```astro
---
import "../styles/tokens.css";
---

<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>gaybar 서버</title>
    <link rel="preconnect" href="https://cdn.jsdelivr.net" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
    />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/npm/@fontsource/jetbrains-mono@5.0.20/index.min.css"
    />
  </head>
  <body>
    <main>
      <h1>gaybar</h1>
      <p class="mono">토큰 확인용 페이지</p>
    </main>
  </body>
</html>
```

- [ ] **Step 5: 빌드와 확인**

Run:

```bash
cd web && npm run build
```

Expected: `dist/` 생성, 오류 없음

Run: `npm run dev` 후 브라우저에서 `http://localhost:4321` 확인

Expected: 어두운 배경에 밝은 텍스트. `토큰 확인용 페이지`가 모노스페이스로 보인다.

- [ ] **Step 6: gitignore**

`web/.gitignore`:

```gitignore
node_modules/
dist/
.astro/
```

- [ ] **Step 7: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): Astro 프로젝트 골격과 디자인 토큰

발헤임 색감을 저채도로 잡은 CSS 커스텀 속성을 정의했다.
질감은 텍스처 이미지 대신 SVG 노이즈 필터로 준다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 모드 데이터 정본과 스키마 검증

**Files:**
- Create: `data/mods.json`
- Create: `web/src/lib/mods-schema.mjs`
- Create: `web/tests/mods-schema.test.mjs`
- Modify: `web/package.json` (test 스크립트 추가)

**Interfaces:**
- Consumes: 없음
- Produces:
  - `validateMods(data)` : `{ ok: true } | { ok: false, errors: string[] }`
  - `data/mods.json`의 구조. 이후 모든 태스크가 이 형태를 전제한다

- [ ] **Step 1: 실패하는 테스트 작성**

`web/tests/mods-schema.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { validateMods } from "../src/lib/mods-schema.mjs";

const valid = {
  schemaVersion: 1,
  modpack: { version: "v1", r2modmanCode: null },
  mods: [
    {
      id: "PlantEverything",
      owner: "Advize",
      version: "1.21.2",
      tier: 1,
      name: "재배 확장",
      summary: "베리와 버섯을 심을 수 있습니다",
      usage: "재배기로 심으면 됩니다",
      thunderstoreUrl: "https://thunderstore.io/c/valheim/p/Advize/PlantEverything/",
      warnings: [],
    },
  ],
};

describe("validateMods", () => {
  it("올바른 데이터를 통과시킨다", () => {
    expect(validateMods(valid)).toEqual({ ok: true });
  });

  it("tier 가 1,2,3 이 아니면 거부한다", () => {
    const bad = structuredClone(valid);
    bad.mods[0].tier = 4;
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("tier");
  });

  it("필수 필드가 없으면 거부한다", () => {
    const bad = structuredClone(valid);
    delete bad.mods[0].summary;
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("summary");
  });

  it("id 가 중복되면 거부한다", () => {
    const bad = structuredClone(valid);
    bad.mods.push(structuredClone(bad.mods[0]));
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("중복");
  });

  it("mods 가 배열이 아니면 거부한다", () => {
    const r = validateMods({ schemaVersion: 1, modpack: {}, mods: "nope" });
    expect(r.ok).toBe(false);
  });

  it("실제 data/mods.json 이 스키마를 통과한다", async () => {
    const real = (await import("../../data/mods.json", { with: { type: "json" } })).default;
    expect(validateMods(real)).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

`web/package.json`의 `scripts`에 추가:

```json
"test": "vitest run"
```

Run: `cd web && npm test`

Expected: FAIL. `mods-schema.mjs`를 찾을 수 없다

- [ ] **Step 3: 스키마 검증 구현**

`web/src/lib/mods-schema.mjs`:

```js
// mods.json 검증. 외부 라이브러리를 쓰지 않는다.
// 필드가 몇 개뿐이라 직접 검사하는 편이 의존성을 줄인다.

const REQUIRED = ["id", "owner", "version", "tier", "name", "summary", "usage", "thunderstoreUrl"];
const TIERS = [1, 2, 3];

export function validateMods(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["데이터가 객체가 아닙니다"] };
  }
  if (data.schemaVersion !== 1) {
    errors.push(`schemaVersion 은 1 이어야 합니다 (받은 값: ${data.schemaVersion})`);
  }
  if (!Array.isArray(data.mods)) {
    return { ok: false, errors: [...errors, "mods 는 배열이어야 합니다"] };
  }

  const seen = new Set();
  data.mods.forEach((m, i) => {
    const at = `mods[${i}]`;
    for (const f of REQUIRED) {
      if (m[f] === undefined || m[f] === null || m[f] === "") {
        errors.push(`${at}.${f} 가 없습니다`);
      }
    }
    if (!TIERS.includes(m.tier)) {
      errors.push(`${at}.tier 는 1, 2, 3 중 하나여야 합니다 (받은 값: ${m.tier})`);
    }
    if (!Array.isArray(m.warnings)) {
      errors.push(`${at}.warnings 는 배열이어야 합니다`);
    }
    if (seen.has(m.id)) {
      errors.push(`${at}.id 가 중복입니다: ${m.id}`);
    }
    seen.add(m.id);
  });

  return errors.length ? { ok: false, errors } : { ok: true };
}
```

- [ ] **Step 4: 실제 데이터 작성**

`data/mods.json`. 현재 서버에 실제로 깔린 것을 반영한다.

```json
{
  "schemaVersion": 1,
  "modpack": {
    "version": "v1",
    "r2modmanCode": null
  },
  "mods": [
    {
      "id": "PlantEverything",
      "owner": "Advize",
      "version": "1.21.2",
      "tier": 1,
      "name": "재배 확장",
      "summary": "베리, 버섯, 엉겅퀴, 민들레를 재배기로 심을 수 있습니다",
      "usage": "재배기를 들고 평소처럼 심으면 됩니다. 추가로 할 일은 없습니다",
      "thunderstoreUrl": "https://thunderstore.io/c/valheim/p/Advize/PlantEverything/",
      "warnings": []
    },
    {
      "id": "ServersideQoL",
      "owner": "ArgusMagnus",
      "version": "2.0.13",
      "tier": 1,
      "name": "서버 편의 프레임워크",
      "summary": "아래 자동 제련 공급 같은 기능 모듈이 동작하기 위한 토대입니다",
      "usage": "직접 쓸 일은 없습니다",
      "thunderstoreUrl": "https://thunderstore.io/c/valheim/p/ArgusMagnus/ServersideQoL/",
      "warnings": []
    },
    {
      "id": "ServersideQoL_AutoProcess",
      "owner": "ArgusMagnus",
      "version": "2.0.11",
      "tier": 1,
      "name": "자동 제련 공급",
      "summary": "제련소, 가마, 풍차에 근처 상자에서 재료와 연료를 자동으로 넣습니다",
      "usage": "제련소 옆에 광석 상자를 두기만 하면 됩니다. 일일이 넣지 않아도 됩니다",
      "thunderstoreUrl": "https://thunderstore.io/c/valheim/p/ArgusMagnus/ServersideQoL_AutoProcess/",
      "warnings": []
    }
  ]
}
```

- [ ] **Step 5: 테스트가 통과하는지 확인**

Run: `cd web && npm test`

Expected: `6 passed`

- [ ] **Step 6: 빌드 시 검증하도록 연결**

`web/astro.config.mjs`를 다음으로 교체한다. 잘못된 데이터가 배포되지 않게 빌드를 실패시킨다.

```js
import { defineConfig } from "astro/config";
import { validateMods } from "./src/lib/mods-schema.mjs";
import mods from "../data/mods.json" with { type: "json" };

// 빌드 시작 전에 검증한다. 잘못된 모드 정보가 배포되면
// 친구들이 틀린 안내를 보게 된다.
const result = validateMods(mods);
if (!result.ok) {
  console.error("data/mods.json 검증 실패:");
  for (const e of result.errors) console.error("  - " + e);
  process.exit(1);
}

export default defineConfig({
  site: "https://firstquator.github.io",
  base: "/valheim-multi",
});
```

Run: `cd web && npm run build`

Expected: 빌드 성공

> Node 버전에 따라 `with { type: "json" }` 구문이 거부될 수 있다. 그 경우
> `import { readFileSync } from "node:fs"` 로 읽어 `JSON.parse` 한다.
> 검증을 건너뛰지는 않는다.

Run: `data/mods.json`의 첫 모드 `tier`를 `9`로 잠깐 바꾸고 `npm run build`

Expected: `tier 는 1, 2, 3 중 하나여야 합니다` 출력 후 빌드 실패. 확인 뒤 `1`로 되돌린다.

- [ ] **Step 7: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add data/ web/ && git commit -m "feat(web): 모드 정보 정본과 스키마 검증

data/mods.json 하나가 모드 정보의 유일한 출처다.
빌드 시 검증해 잘못된 정보가 배포되는 것을 막는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 아이콘 인라인 헬퍼

**Files:**
- Create: `web/src/lib/icon.mjs`
- Create: `web/src/components/Icon.astro`
- Create: `web/tests/icon.test.mjs`

**Interfaces:**
- Consumes: `@hugeicons/static` 패키지
- Produces:
  - `readIcon(name)` : SVG 문자열을 반환. 없으면 예외
  - `<Icon name="home-01" size={24} />` 컴포넌트

- [ ] **Step 1: 실패하는 테스트 작성**

`web/tests/icon.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { readIcon } from "../src/lib/icon.mjs";

describe("readIcon", () => {
  it("존재하는 아이콘의 svg 를 반환한다", () => {
    const svg = readIcon("home-01");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("currentColor 를 쓰도록 stroke 를 바꾼다", () => {
    const svg = readIcon("home-01");
    expect(svg).toContain("currentColor");
  });

  it("width 와 height 속성을 제거한다", () => {
    const svg = readIcon("home-01");
    expect(svg).not.toMatch(/<svg[^>]*\swidth=/);
    expect(svg).not.toMatch(/<svg[^>]*\sheight=/);
  });

  it("없는 아이콘이면 이름을 담은 예외를 던진다", () => {
    expect(() => readIcon("this-icon-does-not-exist")).toThrow(/this-icon-does-not-exist/);
  });

  it("계획에서 쓰기로 한 아이콘이 전부 존재한다", () => {
    for (const n of [
      "home-01", "package-02", "download-04", "globe-02",
      "copy-01", "alert-01", "user-02",
    ]) {
      expect(() => readIcon(n)).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd web && npm test`

Expected: FAIL. `icon.mjs`를 찾을 수 없다

- [ ] **Step 3: 구현**

`web/src/lib/icon.mjs`:

```js
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

// @hugeicons/static 의 icons 디렉터리를 찾는다.
// package.json 위치를 기준으로 삼아야 설치 경로에 의존하지 않는다.
const pkgJson = require.resolve("@hugeicons/static/package.json");
const ICONS_DIR = join(dirname(pkgJson), "icons");

const cache = new Map();

/**
 * 아이콘 SVG 를 읽어 인라인에 적합한 형태로 돌려준다.
 * 빌드 타임에만 호출된다. 런타임 JS 로 나가지 않는다.
 */
export function readIcon(name) {
  if (cache.has(name)) return cache.get(name);

  let raw;
  try {
    raw = readFileSync(join(ICONS_DIR, `${name}.svg`), "utf8");
  } catch {
    throw new Error(`아이콘을 찾을 수 없습니다: ${name} (${ICONS_DIR})`);
  }

  const svg = raw
    // 크기는 CSS 로 제어한다. 속성이 남아 있으면 덮어쓰기가 번거롭다.
    .replace(/\s(width|height)="[^"]*"/g, "")
    // 색은 부모의 color 를 따르게 한다.
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"')
    .trim();

  cache.set(name, svg);
  return svg;
}
```

`web/src/components/Icon.astro`:

```astro
---
import { readIcon } from "../lib/icon.mjs";

interface Props {
  name: string;
  size?: number;
  class?: string;
}

const { name, size = 20, class: klass = "" } = Astro.props;
const svg = readIcon(name);
---

<span class={`icon ${klass}`} style={`--icon-size:${size}px`} set:html={svg} />

<style>
  .icon {
    display: inline-flex;
    width: var(--icon-size);
    height: var(--icon-size);
    flex: none;
  }
  .icon :global(svg) {
    width: 100%;
    height: 100%;
    stroke-width: 1.5;
  }
</style>
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd web && npm test`

Expected: `11 passed` (Task 2의 6개 + 이번 5개)

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): 아이콘 인라인 헬퍼

@hugeicons/static 의 SVG 를 빌드 타임에 인라인한다.
런타임 JS 없이 아이콘이 나온다. 이모지는 쓰지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 사이드바와 탭 셸

**Files:**
- Create: `web/src/components/Sidebar.astro`
- Create: `web/src/components/Tabs.astro`
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: `<Icon />` from Task 3
- Produces:
  - `<Sidebar tabs={[{id, label, icon}]} />`
  - `<Tabs tabs={[{id, label}]}><div slot="서버">...</div></Tabs>` 형태의 패널 전환
  - 탭 전환은 CSS `:checked` 로 처리한다. JS 없이 동작해야 한다

- [ ] **Step 1: 사이드바 작성**

`web/src/components/Sidebar.astro`:

```astro
---
import Icon from "./Icon.astro";

interface Props {
  tabs: { id: string; label: string; icon: string }[];
  active: string;
}
const { tabs, active } = Astro.props;
---

<nav class="sidebar" aria-label="주 메뉴">
  <ul>
    {tabs.map((t) => (
      <li>
        <a href={`#${t.id}`} class={t.id === active ? "on" : ""}>
          <Icon name={t.icon} size={24} />
          <span class="label">{t.label}</span>
        </a>
      </li>
    ))}
  </ul>
</nav>

<style>
  /* 사이드바는 콘텐츠 위에 얹힌다. 콘텐츠를 밀면 레이아웃이 출렁인다. */
  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: var(--sidebar-w-collapsed);
    background: var(--surface);
    border-right: 1px solid var(--border);
    overflow: hidden;
    z-index: 100;
    transition: width var(--dur-sidebar) var(--ease-sidebar);
  }
  .sidebar:hover,
  .sidebar:focus-within {
    width: var(--sidebar-w-expanded);
    box-shadow: 8px 0 32px rgb(0 0 0 / 0.35);
  }

  ul { list-style: none; margin: 0; padding: 12px 0; }

  a {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 48px;
    padding: 0 20px;
    color: var(--text-dim);
    text-decoration: none;
    white-space: nowrap;
    transition: color 160ms ease, background 160ms ease;
  }
  a:hover { color: var(--text); background: var(--surface-raised); }
  a.on { color: var(--accent); }
  a.on::before {
    content: "";
    position: absolute;
    left: 0;
    width: 3px;
    height: 24px;
    background: var(--accent);
    border-radius: 0 2px 2px 0;
  }

  /* 라벨은 폭 전환보다 60ms 늦게 나타난다.
     동시에 움직이면 글자가 찌그러져 보인다. */
  .label {
    opacity: 0;
    transform: translateX(-4px);
    transition:
      opacity 160ms ease 60ms,
      transform 160ms var(--ease-sidebar) 60ms;
  }
  .sidebar:hover .label,
  .sidebar:focus-within .label {
    opacity: 1;
    transform: none;
  }

  /* 태블릿 가로에서는 펼치지 않는다. 화면이 좁아 콘텐츠를 가린다. */
  @media (max-width: 1024px) {
    .sidebar:hover, .sidebar:focus-within { width: var(--sidebar-w-collapsed); }
    .sidebar:hover .label, .sidebar:focus-within .label { opacity: 0; }
  }
</style>
```

- [ ] **Step 2: 탭 셸 작성**

`web/src/components/Tabs.astro`. JS 없이 라디오 버튼으로 전환한다.

```astro
---
interface Props {
  tabs: { id: string; label: string }[];
}
const { tabs } = Astro.props;
---

<div class="tabs">
  {tabs.map((t, i) => (
    <input
      type="radio"
      name="tab"
      id={`tab-${t.id}`}
      checked={i === 0}
      hidden
    />
  ))}

  <div class="panels">
    {tabs.map((t) => (
      <section class="panel" data-tab={t.id}>
        <slot name={t.id} />
      </section>
    ))}
  </div>
</div>

<style>
  .panel { display: none; }
  /* 라디오가 체크된 탭의 패널만 보인다. JS 가 필요 없다. */
  :global(#tab-server:checked) ~ .panels .panel[data-tab="server"],
  :global(#tab-mods:checked) ~ .panels .panel[data-tab="mods"],
  :global(#tab-install:checked) ~ .panels .panel[data-tab="install"],
  :global(#tab-world:checked) ~ .panels .panel[data-tab="world"] {
    display: block;
    animation: fade 180ms ease;
  }
  @keyframes fade {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: none; }
  }
</style>
```

> 사이드바의 링크를 라디오와 연결하려면 `<a href="#id">` 대신 `<label for="tab-id">` 를 써야 한다. Step 3에서 사이드바를 그렇게 고친다.

- [ ] **Step 3: 사이드바를 label 기반으로 수정**

`Sidebar.astro`에서 `<a href={...}>` 를 다음으로 바꾼다.

```astro
        <label for={`tab-${t.id}`} class="item">
          <Icon name={t.icon} size={24} />
          <span class="label">{t.label}</span>
        </label>
```

그리고 `<style>` 의 `a` 선택자를 `.item` 으로, `a:hover` 를 `.item:hover` 로, `a.on` 관련 규칙은 다음으로 교체한다.

```css
  .item { cursor: pointer; position: relative; }

  /* 현재 선택된 탭 표시. 라디오 상태를 형제 선택자로 읽는다. */
  :global(#tab-server:checked) ~ * .item[for="tab-server"],
  :global(#tab-mods:checked) ~ * .item[for="tab-mods"],
  :global(#tab-install:checked) ~ * .item[for="tab-install"],
  :global(#tab-world:checked) ~ * .item[for="tab-world"] {
    color: var(--accent);
  }
```

- [ ] **Step 4: 페이지에 조립**

`web/src/pages/index.astro`의 `<body>` 안을 다음으로 교체한다. `<head>` 는 Task 1 그대로 둔다.

```astro
    <div class="shell">
      <Tabs tabs={TABS}>
        <div slot="server"><h1>서버</h1></div>
        <div slot="mods"><h1>모드</h1></div>
        <div slot="install"><h1>설치 가이드</h1></div>
        <div slot="world"><h1>월드</h1></div>
      </Tabs>
      <Sidebar tabs={TABS} />
    </div>
```

프런트매터에 추가:

```astro
import Sidebar from "../components/Sidebar.astro";
import Tabs from "../components/Tabs.astro";

const TABS = [
  { id: "server", label: "서버", icon: "home-01" },
  { id: "mods", label: "모드", icon: "package-02" },
  { id: "install", label: "설치 가이드", icon: "download-04" },
  { id: "world", label: "월드", icon: "globe-02" },
];
```

`<style is:global>` 추가:

```css
  .shell {
    padding-left: var(--sidebar-w-collapsed);
  }
  .panels {
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 32px;
  }
  @media (max-width: 1280px) {
    .panels { max-width: none; }
  }
```

> `Tabs` 가 `Sidebar` 보다 앞에 와야 한다. 라디오 입력이 사이드바보다 DOM 앞에 있어야 `~` 형제 선택자가 동작한다.

- [ ] **Step 5: 실물 확인**

Run: `cd web && npm run dev`

브라우저에서 확인할 것:

- [ ] 사이드바가 64px 폭으로 접혀 있고 아이콘만 보인다
- [ ] 마우스를 올리면 240px로 부드럽게 펼쳐지고 라벨이 약간 늦게 나타난다
- [ ] 펼쳐질 때 **본문이 밀리지 않는다**
- [ ] 아이콘 클릭 시 탭이 바뀐다
- [ ] 현재 탭의 아이콘이 청동색으로 표시된다
- [ ] 브라우저 폭을 1024px 아래로 줄이면 사이드바가 펼쳐지지 않는다

- [ ] **Step 6: 테스트 통과 확인 후 커밋**

Run: `cd web && npm test`

Expected: `11 passed` (회귀 없음)

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): hover 로 펼쳐지는 사이드바와 탭 셸

사이드바는 콘텐츠 위에 얹혀 레이아웃을 밀지 않는다.
라벨은 폭 전환보다 60ms 늦게 나타난다. 동시에 움직이면
글자가 찌그러져 보인다.

탭 전환은 라디오 입력과 CSS 만으로 처리해 JS 가 필요 없다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 상태 판정 로직

**Files:**
- Create: `web/src/lib/status.mjs`
- Create: `web/tests/status.test.mjs`

**Interfaces:**
- Consumes: 없음 (순수 함수)
- Produces:
  - `judgeStatus(payload, nowMs)` : `{ state, label, playerCount, players, ageSec }`
  - `state` 는 `"running" | "offline" | "unknown"` 중 하나
  - 신선도 한계는 180초. 이후 태스크와 퍼블리셔가 이 값을 공유한다

- [ ] **Step 1: 실패하는 테스트 작성**

`web/tests/status.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { judgeStatus, STALE_LIMIT_SEC } from "../src/lib/status.mjs";

const NOW = Date.parse("2026-09-18T04:00:00Z");
const payload = (overrides = {}) => ({
  updatedAt: "2026-09-18T03:59:30Z",
  server: { running: true, playerCount: 2, players: ["누들낑", "모카비비"] },
  ...overrides,
});

describe("judgeStatus", () => {
  it("신선하고 실행 중이면 running 이다", () => {
    const r = judgeStatus(payload(), NOW);
    expect(r.state).toBe("running");
    expect(r.playerCount).toBe(2);
    expect(r.players).toEqual(["누들낑", "모카비비"]);
  });

  it("신선하지만 running 이 false 면 offline 이다", () => {
    const r = judgeStatus(payload({ server: { running: false, playerCount: 0, players: [] } }), NOW);
    expect(r.state).toBe("offline");
  });

  it("180초를 넘게 낡으면 offline 으로 본다", () => {
    const old = payload({ updatedAt: "2026-09-18T03:56:00Z" });
    const r = judgeStatus(old, NOW);
    expect(r.state).toBe("offline");
  });

  it("정확히 180초는 아직 신선하다 (경계값)", () => {
    const r = judgeStatus(payload({ updatedAt: "2026-09-18T03:57:00Z" }), NOW);
    expect(r.state).toBe("running");
  });

  it("payload 가 없으면 unknown 이다", () => {
    expect(judgeStatus(null, NOW).state).toBe("unknown");
  });

  it("updatedAt 이 망가졌으면 unknown 이다", () => {
    expect(judgeStatus(payload({ updatedAt: "바보" }), NOW).state).toBe("unknown");
  });

  it("경과 시간을 초로 알려준다", () => {
    expect(judgeStatus(payload(), NOW).ageSec).toBe(30);
  });

  it("신선도 한계는 180초다", () => {
    expect(STALE_LIMIT_SEC).toBe(180);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd web && npm test`

Expected: FAIL. `status.mjs` 를 찾을 수 없다

- [ ] **Step 3: 구현**

`web/src/lib/status.mjs`:

```js
// 상태 판정만 한다. fetch 도 DOM 조작도 하지 않는다.
// 섞으면 테스트가 불가능해진다.

export const STALE_LIMIT_SEC = 180;

/**
 * @param {object|null} payload Gist 에서 받은 상태 객체
 * @param {number} nowMs 현재 시각 (밀리초)
 */
export function judgeStatus(payload, nowMs) {
  if (!payload || typeof payload !== "object" || !payload.server) {
    return { state: "unknown", label: "상태 확인 불가", playerCount: 0, players: [], ageSec: null };
  }

  const t = Date.parse(payload.updatedAt);
  if (Number.isNaN(t)) {
    return { state: "unknown", label: "상태 확인 불가", playerCount: 0, players: [], ageSec: null };
  }

  const ageSec = Math.max(0, Math.round((nowMs - t) / 1000));
  const players = Array.isArray(payload.server.players) ? payload.server.players : [];
  const playerCount = Number(payload.server.playerCount) || 0;

  // 낡은 데이터를 현재인 척하지 않는다.
  // 서버 PC 가 꺼지면 갱신이 멈추므로 자연히 여기로 수렴한다.
  if (ageSec > STALE_LIMIT_SEC || payload.server.running !== true) {
    return { state: "offline", label: "서버 꺼짐", playerCount: 0, players: [], ageSec };
  }

  return {
    state: "running",
    label: playerCount > 0 ? `접속 중 · ${playerCount}명` : "접속 중 · 비어 있음",
    playerCount,
    players,
    ageSec,
  };
}

/** "30초 전 확인" 같은 문구를 만든다. */
export function formatAge(ageSec) {
  if (ageSec === null) return "확인 시각 불명";
  if (ageSec < 60) return `${ageSec}초 전 확인`;
  const m = Math.floor(ageSec / 60);
  if (m < 60) return `${m}분 전 확인`;
  return `${Math.floor(m / 60)}시간 전 확인`;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run: `cd web && npm test`

Expected: `19 passed`

- [ ] **Step 5: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): 상태 판정 로직

fetch 와 DOM 조작에서 분리해 순수 함수로 만들었다.
180초를 넘게 낡은 데이터는 서버 꺼짐으로 본다.
낡은 값을 현재인 척 보여주지 않기 위해서다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 서버 탭과 복사 필드

**Files:**
- Create: `web/src/components/CopyField.astro`
- Create: `web/src/islands/LiveStatus.js`
- Modify: `web/src/pages/index.astro`
- Create: `web/src/config.mjs`

**Interfaces:**
- Consumes: `judgeStatus`, `formatAge` (Task 5), `<Icon />` (Task 3)
- Produces:
  - `<CopyField label="주소" value="..." mono />`
  - `LiveStatus.js` 가 `#status-badge`, `#status-age`, `#player-list` 를 갱신한다
  - `web/src/config.mjs` 의 `GIST_ID`

- [ ] **Step 1: 설정 파일**

`web/src/config.mjs`:

```js
// Gist ID 는 Task 9 에서 실제 값으로 채운다.
// 빈 값이면 LiveStatus 가 조회를 건너뛰고 "상태 확인 불가" 를 보여준다.
export const GIST_ID = "";
export const GIST_FILE = "valheim-status.json";

// 접속 정보. 비밀번호는 Gist 에 올리지 않고 여기에만 둔다.
export const SERVER = {
  address: "182.230.196.27:2456",
  password: "159159",
};
```

- [ ] **Step 2: 복사 필드 컴포넌트**

`web/src/components/CopyField.astro`:

```astro
---
import Icon from "./Icon.astro";

interface Props {
  label: string;
  value: string;
  mono?: boolean;
  masked?: boolean;
}
const { label, value, mono = false, masked = false } = Astro.props;
---

<div class="field">
  <span class="k">{label}</span>
  <span class={`v ${mono ? "mono" : ""}`} data-masked={masked ? "true" : "false"}>
    {masked ? "\u2022".repeat(Math.min(value.length, 10)) : value}
  </span>
  <button class="copy" type="button" data-copy={value} aria-label={`${label} 복사`}>
    <Icon name="copy-01" size={16} />
    <span>복사</span>
  </button>
</div>

<script>
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest(".copy");
    if (!btn) return;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      const span = btn.querySelector("span");
      const prev = span.textContent;
      span.textContent = "복사됨";
      btn.classList.add("done");
      setTimeout(() => {
        span.textContent = prev;
        btn.classList.remove("done");
      }, 1400);
    } catch {
      // 클립보드 권한이 없으면 값을 선택 상태로 만들어 수동 복사를 돕는다.
      const v = btn.parentElement.querySelector(".v");
      const r = document.createRange();
      r.selectNodeContents(v);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    }
  });
</script>

<style>
  .field {
    display: grid;
    grid-template-columns: 72px 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }
  .field:last-child { border-bottom: none; }
  .k { color: var(--text-faint); font-size: 13px; }
  .v { color: var(--text); font-size: 15px; word-break: break-all; }
  .copy {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font: inherit;
    font-size: 13px;
    color: var(--text-dim);
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 8px;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease, background 140ms ease;
  }
  .copy:hover { color: var(--text); border-color: var(--accent); }
  .copy.done { color: var(--success); border-color: var(--success); }
</style>
```

- [ ] **Step 3: 상태 갱신 스크립트**

`web/src/islands/LiveStatus.js`:

```js
import { judgeStatus, formatAge } from "../lib/status.mjs";
import { GIST_ID, GIST_FILE } from "../config.mjs";

// fetch 와 DOM 갱신만 한다. 판정은 status.mjs 가 맡는다.

async function loadStatus() {
  if (!GIST_ID) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const gist = await res.json();
    const raw = gist.files?.[GIST_FILE]?.content;
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function render(judged) {
  const badge = document.getElementById("status-badge");
  const age = document.getElementById("status-age");
  const list = document.getElementById("player-list");
  const wrap = document.getElementById("player-wrap");
  const ver = document.getElementById("game-version");
  if (!badge) return;

  badge.textContent = judged.label;
  badge.dataset.state = judged.state;
  if (age) age.textContent = formatAge(judged.ageSec);

  // 게임 버전을 마크업에 박아두면 서버가 업데이트될 때 틀린 안내가 된다.
  // 버전 불일치는 접속 실패의 가장 흔한 원인이라 정확해야 한다.
  if (ver && judged.gameVersion) ver.textContent = judged.gameVersion;

  if (list) {
    list.textContent = judged.players.length ? judged.players.join(" · ") : "";
    list.hidden = judged.players.length === 0;
  }
  // 아무도 없으면 접속자 영역 자체를 숨긴다. 빈 제목만 남으면 어색하다.
  if (wrap) wrap.hidden = judged.players.length === 0;
}

async function tick() {
  render(judgeStatus(await loadStatus(), Date.now()));
}

tick();
setInterval(tick, 30_000);
```

- [ ] **Step 4: 서버 탭 마크업**

`index.astro` 의 `<div slot="server">` 를 다음으로 교체한다.

```astro
        <div slot="server">
          <header class="hero">
            <h1>gaybar</h1>
            <p class="badge" id="status-badge" data-state="unknown">상태 확인 중</p>
            <p class="age" id="status-age"></p>
          </header>

          <div class="card">
            <CopyField label="주소" value={SERVER.address} mono />
            <CopyField label="비밀번호" value={SERVER.password} masked />
            <div class="field">
              <span class="k">게임 버전</span>
              <span class="v mono" id="game-version">확인 중</span>
              <span class="hint">클라이언트도 같은 버전이어야 접속됩니다</span>
            </div>
          </div>

          <section class="players" id="player-wrap">
            <h2><Icon name="user-02" size={18} /> 접속 중</h2>
            <p id="player-list" hidden></p>
          </section>
        </div>
```

프런트매터에 추가:

```astro
import CopyField from "../components/CopyField.astro";
import Icon from "../components/Icon.astro";
import { SERVER } from "../config.mjs";
```

`</body>` 직전에 추가:

```astro
    <script>
      import "../islands/LiveStatus.js";
    </script>
```

전역 스타일에 추가:

```css
  .hero { margin-bottom: 32px; }
  .hero h1 {
    margin: 0 0 12px;
    font-size: 40px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 17px;
    color: var(--text-dim);
  }
  .badge::before {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--text-faint);
  }
  .badge[data-state="running"] { color: var(--success); }
  .badge[data-state="running"]::before {
    background: var(--success);
    box-shadow: 0 0 0 0 rgb(122 154 107 / 0.6);
    animation: pulse 2.4s ease-out infinite;
  }
  .badge[data-state="offline"] { color: var(--text-faint); }
  @keyframes pulse {
    to { box-shadow: 0 0 0 10px rgb(122 154 107 / 0); }
  }
  .age { margin: 6px 0 0; font-size: 13px; color: var(--text-faint); }

  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .hint { font-size: 12px; color: var(--text-faint); }

  .players { margin-top: 32px; }
  .players h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-faint);
  }
```

- [ ] **Step 5: 실물 확인**

Run: `cd web && npm run dev`

- [ ] 서버 탭에 이름, 상태 뱃지, 주소, 비밀번호가 보인다
- [ ] 비밀번호가 점으로 가려져 있다
- [ ] 복사 버튼을 누르면 "복사됨" 으로 바뀌고 초록색이 된다
- [ ] 클립보드에 실제로 값이 들어갔다
- [ ] `GIST_ID` 가 비어 있으므로 상태는 "상태 확인 불가" 로 표시된다

- [ ] **Step 6: 테스트와 빌드 확인 후 커밋**

Run: `cd web && npm test && npm run build`

Expected: `19 passed`, 빌드 성공

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): 서버 탭과 복사 필드

주소와 비밀번호를 한 번에 복사할 수 있게 했다.
공인 IP 가 유동이라 이 화면이 사실상 DDNS 를 대체한다.

클립보드 권한이 없으면 값을 선택 상태로 만들어 수동 복사를 돕는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 모드 탭

**Files:**
- Create: `web/src/components/ModCard.astro`
- Create: `web/src/components/WarningBlock.astro`
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: `data/mods.json`, `<Icon />`
- Produces: `<ModCard mod={...} />`, `<WarningBlock title="..."><slot /></WarningBlock>`

- [ ] **Step 1: 경고 블록**

`web/src/components/WarningBlock.astro`:

```astro
---
import Icon from "./Icon.astro";
interface Props { title: string; }
const { title } = Astro.props;
---

<aside class="warn">
  <Icon name="alert-01" size={22} />
  <div>
    <strong>{title}</strong>
    <p><slot /></p>
  </div>
</aside>

<style>
  /* 아이템이 사라지는 문제를 다루므로 각주가 아니라 블록으로 놓는다.
     작은 글씨로 적으면 아무도 읽지 않는다. */
  .warn {
    display: flex;
    gap: 14px;
    padding: 16px 18px;
    margin-bottom: 24px;
    background: color-mix(in srgb, var(--warning) 12%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--warning) 40%, transparent);
    border-radius: var(--radius);
    color: var(--text);
  }
  .warn :global(.icon) { color: var(--warning); margin-top: 2px; }
  strong { display: block; margin-bottom: 4px; color: var(--warning); }
  p { margin: 0; font-size: 14px; color: var(--text-dim); }
</style>
```

- [ ] **Step 2: 모드 카드**

`web/src/components/ModCard.astro`:

```astro
---
interface Props {
  mod: {
    id: string; owner: string; version: string; tier: number;
    name: string; summary: string; usage: string;
    thunderstoreUrl: string; warnings: string[];
  };
}
const { mod } = Astro.props;
const needsInstall = mod.tier === 3;
---

<article class={`mod ${needsInstall ? "need" : "free"}`}>
  <header>
    <h3>{mod.name}</h3>
    <span class="pkg mono">{mod.id} {mod.version}</span>
  </header>
  <p class="summary">{mod.summary}</p>
  <p class="usage">{mod.usage}</p>
  {mod.warnings.length > 0 && (
    <ul class="warns">
      {mod.warnings.map((w) => <li>{w}</li>)}
    </ul>
  )}
</article>

<style>
  .mod {
    padding: 18px 20px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    transition: border-color 160ms ease, transform 160ms ease;
  }
  .mod:hover { transform: translateY(-1px); }

  /* 설치 불필요 그룹은 낮은 채도로 둔다. 넘어가도 된다는 인상을 준다. */
  .free { opacity: 0.88; }
  .free:hover { border-color: var(--border); }

  /* 설치 필요 그룹은 악센트로 눈에 띄게 한다.
     같은 스타일로 나열하면 친구들이 전부 설치하려 든다. */
  .need { border-left: 3px solid var(--accent); }
  .need:hover { border-color: var(--accent); }

  header { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  h3 { margin: 0; font-size: 17px; font-weight: 600; }
  .pkg { font-size: 12px; color: var(--text-faint); }
  .summary { margin: 10px 0 0; font-size: 14px; color: var(--text-dim); }
  .usage {
    margin: 10px 0 0;
    padding-left: 12px;
    border-left: 2px solid var(--border);
    font-size: 13px;
    color: var(--text-faint);
  }
  .warns { margin: 12px 0 0; padding-left: 18px; font-size: 13px; color: var(--warning); }
</style>
```

- [ ] **Step 3: 모드 탭 조립**

`index.astro` 의 `<div slot="mods">` 를 교체한다.

```astro
        <div slot="mods">
          <h1>모드</h1>

          <section class="group">
            <h2>설치할 것 없음</h2>
            <p class="lead">서버에만 깔려 있습니다. 그냥 접속하시면 됩니다.</p>
            <div class="grid">
              {tier1.map((m) => <ModCard mod={m} />)}
            </div>
          </section>

          {tier3.length > 0 && (
            <section class="group">
              <h2>설치 필요</h2>
              <WarningBlock title="인벤토리 모드는 하나만 설치하세요">
                ExtraSlots, EquipmentAndQuickSlots, AzuExtendedPlayerInventory 는
                같은 코드를 건드립니다. 둘 이상 설치하면 슬롯이 늘어나는 것이 아니라
                재접속할 때 아이템이 사라집니다.
              </WarningBlock>
              <div class="grid">
                {tier3.map((m) => <ModCard mod={m} />)}
              </div>
            </section>
          )}
        </div>
```

프런트매터에 추가:

```astro
import ModCard from "../components/ModCard.astro";
import WarningBlock from "../components/WarningBlock.astro";
import modsData from "../../../data/mods.json";

const tier1 = modsData.mods.filter((m) => m.tier === 1);
const tier3 = modsData.mods.filter((m) => m.tier === 3);
```

전역 스타일에 추가:

```css
  .group { margin-bottom: 48px; }
  .group h2 {
    margin: 0 0 4px;
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .lead { margin: 0 0 18px; font-size: 14px; color: var(--text-faint); }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--gap);
  }
  @media (max-width: 1024px) {
    .grid { grid-template-columns: 1fr; }
  }
```

- [ ] **Step 4: 실물 확인**

Run: `cd web && npm run dev`

- [ ] 모드 탭에 1층 모드 3개가 카드로 보인다
- [ ] "설치 필요" 섹션은 현재 3층 모드가 없으므로 나타나지 않는다
- [ ] 카드가 2열로 배치되고 1024px 아래에서 1열로 바뀐다
- [ ] 각 카드에 이름, 패키지명과 버전, 설명, 사용법이 보인다

- [ ] **Step 5: 3층 경로 확인**

`data/mods.json` 에 임시로 3층 모드를 하나 추가해 확인한다.

```json
    {
      "id": "ExtraSlots",
      "owner": "shudnal",
      "version": "1.2.9",
      "tier": 3,
      "name": "장비 슬롯 창",
      "summary": "장비, 음식, 탄약 전용 슬롯이 생깁니다",
      "usage": "인벤토리를 열면 추가 슬롯이 보입니다",
      "thunderstoreUrl": "https://thunderstore.io/c/valheim/p/shudnal/ExtraSlots/",
      "warnings": ["다른 인벤토리 모드와 함께 쓰면 아이템이 사라집니다"]
    }
```

- [ ] "설치 필요" 섹션과 경고 블록이 나타난다
- [ ] 해당 카드에 왼쪽 청동색 테두리가 보인다
- [ ] 두 그룹이 시각적으로 확실히 구분된다

확인 후 이 항목을 **제거하고** `npm test` 로 스키마 검증이 여전히 통과하는지 본다. 3층 모드는 실제 도입 시 정식으로 추가한다.

- [ ] **Step 6: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): 모드 탭

설치 불필요 그룹과 설치 필요 그룹을 시각적으로 구분했다.
같은 스타일로 나열하면 친구들이 전부 설치하려 든다.

인벤토리 모드 충돌 경고는 각주가 아니라 블록으로 놓았다.
아이템이 사라지는 문제라 작은 글씨로는 아무도 읽지 않는다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: 설치 가이드 탭과 월드 탭

**Files:**
- Modify: `web/src/pages/index.astro`

**Interfaces:**
- Consumes: `data/mods.json` 의 `modpack`
- Produces: 없음 (표시 전용)

- [ ] **Step 1: 설치 가이드 탭**

`index.astro` 의 `<div slot="install">` 을 교체한다.

```astro
        <div slot="install">
          <h1>설치 가이드</h1>
          <p class="lead">
            설치가 필요한 모드가 있을 때만 따라 하시면 됩니다.
            지금은 서버에만 깔려 있어 아무것도 안 하셔도 접속됩니다.
          </p>

          <ol class="steps">
            <li>
              <h3>r2modman 설치</h3>
              <p>
                모드를 관리해 주는 프로그램입니다.
                <a href="https://thunderstore.io/package/ebkr/r2modman/" target="_blank" rel="noreferrer">
                  Thunderstore 에서 받기
                </a>
              </p>
            </li>
            <li>
              <h3>게임 선택</h3>
              <p>목록에서 Valheim 을 고르고 Steam 을 선택합니다.</p>
            </li>
            <li>
              <h3>프로필 가져오기</h3>
              <p>
                Profiles 화면에서 Import / Update 를 누르고 아래 코드를 붙여넣습니다.
                {modpackCode
                  ? <span class="mono code">{modpackCode}</span>
                  : <span class="pending">코드는 설치 필요 모드가 정해지면 여기에 올라옵니다</span>}
              </p>
            </li>
            <li>
              <h3>Start modded 로 실행</h3>
              <p>
                r2modman 의 Start modded 버튼으로 게임을 켭니다.
                Steam 에서 직접 켜면 모드가 적용되지 않습니다.
              </p>
            </li>
            <li>
              <h3>서버 접속</h3>
              <p>서버 탭의 주소와 비밀번호로 들어오시면 됩니다.</p>
            </li>
          </ol>
        </div>
```

프런트매터에 추가:

```astro
const modpackCode = modsData.modpack.r2modmanCode;
```

- [ ] **Step 2: 월드 탭**

`<div slot="world">` 를 교체한다.

```astro
        <div slot="world">
          <h1>월드</h1>
          <p class="lead">이 서버의 월드 설정입니다. 기본값과 다른 부분이 있습니다.</p>

          <div class="card">
            <div class="field"><span class="k">이름</span><span class="v mono">gaybar</span></div>
            <div class="field"><span class="k">전투</span><span class="v">어렵게. 적 피해 150%, 적 속도와 크기 110%</span></div>
            <div class="field"><span class="k">사망</span><span class="v">가볍게. 장비 유지, 스킬 손실 15%</span></div>
            <div class="field"><span class="k">자원</span><span class="v">150%</span></div>
            <div class="field"><span class="k">포탈</span><span class="v">모든 아이템 이동 가능. 금속도 옮길 수 있습니다</span></div>
          </div>

          <section class="group" style="margin-top:32px">
            <h2>백업</h2>
            <p class="lead">
              월드는 시간마다 자동으로 백업됩니다.
              혹시 사고가 나도 되돌릴 수 있습니다.
            </p>
            <div class="card">
              <div class="field">
                <span class="k">최근 백업</span>
                <span class="v mono" id="backup-at">확인 중</span>
              </div>
            </div>
          </section>
        </div>
```

- [ ] **Step 3: 백업 시각과 게임 버전도 전달하도록 확장**

`web/src/islands/LiveStatus.js` 의 `render` 함수 끝에 추가한다.

```js
  const backup = document.getElementById("backup-at");
  if (backup) {
    const at = judged.backupAt;
    backup.textContent = at ? new Date(at).toLocaleString("ko-KR") : "확인 불가";
  }
```

그리고 `status.mjs` 의 `judgeStatus` 반환에 `backupAt` 을 추가한다. 세 군데 반환 지점 모두에 넣는다.

```js
// unknown 반환에 추가
backupAt: null,
gameVersion: null,

// offline 반환에 추가
backupAt: payload.backup?.lastAt ?? null,
gameVersion: payload.server?.gameVersion ?? null,

// running 반환에 추가
backupAt: payload.backup?.lastAt ?? null,
gameVersion: payload.server?.gameVersion ?? null,
```

`web/tests/status.test.mjs` 에 테스트를 추가한다.

```js
  it("백업 시각을 그대로 전달한다", () => {
    const p = payload({ backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 } });
    expect(judgeStatus(p, NOW).backupAt).toBe("2026-09-18T03:05:00Z");
  });

  it("백업 정보가 없으면 null 이다", () => {
    expect(judgeStatus(payload(), NOW).backupAt).toBe(null);
  });

  it("게임 버전을 그대로 전달한다", () => {
    const p = payload({ server: { running: true, playerCount: 0, players: [], gameVersion: "1.0.14" } });
    expect(judgeStatus(p, NOW).gameVersion).toBe("1.0.14");
  });
```

- [ ] **Step 4: 테스트와 실물 확인**

Run: `cd web && npm test`

Expected: `22 passed`

Run: `npm run dev`

- [ ] 설치 가이드 탭에 5단계가 번호와 함께 보인다
- [ ] 모드팩 코드가 없으므로 "코드는 ... 올라옵니다" 안내가 나온다
- [ ] 월드 탭에 설정값이 보인다
- [ ] 백업 시각은 "확인 불가" 로 표시된다 (Gist 미연결 상태)

- [ ] **Step 5: 전역 스타일 추가 후 커밋**

전역 스타일에 추가:

```css
  .steps { margin: 0; padding-left: 0; list-style: none; counter-reset: s; }
  .steps li {
    position: relative;
    padding: 0 0 28px 44px;
    counter-increment: s;
  }
  .steps li::before {
    content: counter(s);
    position: absolute;
    left: 0;
    top: 0;
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 50%;
  }
  .steps li:not(:last-child)::after {
    content: "";
    position: absolute;
    left: 13px;
    top: 32px;
    bottom: 4px;
    width: 1px;
    background: var(--border);
  }
  .steps h3 { margin: 4px 0 6px; font-size: 16px; font-weight: 600; }
  .steps p { margin: 0; font-size: 14px; color: var(--text-dim); }
  .steps a { color: var(--accent); }
  .code {
    display: inline-block;
    margin-left: 6px;
    padding: 2px 8px;
    background: var(--surface-raised);
    border-radius: 6px;
    font-size: 13px;
  }
  .pending { color: var(--text-faint); font-size: 13px; }
```

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/ && git commit -m "feat(web): 설치 가이드 탭과 월드 탭

설치 가이드는 r2modman 기준 5단계로 정리했다.
Steam 에서 직접 켜면 모드가 적용되지 않는다는 점을 명시했다.
가장 흔한 실수다.

월드 탭에 기본값과 다른 설정을 적어 두었다.
적이 왜 센지 친구들이 묻지 않아도 되게 하려는 것이다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: 상태 퍼블리셔

**Files:**
- Create: `agent/lib/logparse.mjs`
- Create: `agent/lib/collect.mjs`
- Create: `agent/status-publisher.mjs`
- Create: `tests/logparse.test.mjs`
- Create: `tests/collect.test.mjs`
- Create: `package.json` (저장소 루트, 테스트 실행용)
- Create: `tests/fixtures/valheim-log-sample.txt`

**Interfaces:**
- Consumes: 기존 `tests/fixtures/status-*.json`
- Produces:
  - `parsePlayers(logText)` : `string[]`
  - `buildPayload({ statusJson, running, backupDir, address, nowIso })` : 상태 객체
  - `agent/status-publisher.mjs` 실행 파일

- [ ] **Step 1: 로그 픽스처 작성**

`tests/fixtures/valheim-log-sample.txt`. 실제 서버 로그에서 가져온 형식이다.

```text
Sep 18 02:43:55 supervisord: valheim-server 09/18/2026 02:43:55: Server: New peer connected,sending global keys
Sep 18 02:44:09 supervisord: valheim-server 09/18/2026 02:44:09: Got connection SteamID 76561198116018222
Sep 18 02:44:14 supervisord: valheim-server 09/18/2026 02:44:14: Got character ZDOID from 누들낑 : 671632419:1
Sep 18 02:44:32 supervisord: valheim-server 09/18/2026 02:44:32: Got character ZDOID from 모카비비 : -4663678:1
Sep 18 02:51:02 supervisord: valheim-server 09/18/2026 02:51:02: Got character ZDOID from 누들낑 : 0:0
Sep 18 02:52:10 supervisord: valheim-server 09/18/2026 02:52:10: Got character ZDOID from 누들낑 : 671632419:2
```

- [ ] **Step 2: 로그 파서 실패 테스트**

`tests/logparse.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePlayers } from "../agent/lib/logparse.mjs";

const log = readFileSync(new URL("./fixtures/valheim-log-sample.txt", import.meta.url), "utf8");

describe("parsePlayers", () => {
  it("캐릭터 이름을 추출한다", () => {
    expect(parsePlayers(log).sort()).toEqual(["모카비비", "누들낑"].sort());
  });

  it("같은 사람이 여러 번 나와도 한 번만 센다", () => {
    expect(parsePlayers(log).filter((n) => n === "누들낑")).toHaveLength(1);
  });

  it("빈 로그면 빈 배열이다", () => {
    expect(parsePlayers("")).toEqual([]);
  });

  it("형식이 바뀌어도 예외를 던지지 않는다", () => {
    expect(parsePlayers("전혀 다른 내용\n무작위 텍스트")).toEqual([]);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

저장소 루트에 `package.json` 을 만든다.

```json
{
  "name": "valheim-multi",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

Run:

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
npm install
npm test
```

Expected: FAIL. `logparse.mjs` 없음

- [ ] **Step 4: 로그 파서 구현**

`agent/lib/logparse.mjs`:

```js
// 발헤임 서버 로그에서 접속한 캐릭터 이름을 뽑는다.
// status.json 의 players 배열은 이름을 비워서 주기 때문에 로그가 유일한 출처다.

const RE = /Got character ZDOID from (.+?) : /g;

/**
 * @param {string} logText
 * @returns {string[]} 중복 제거된 캐릭터 이름
 */
export function parsePlayers(logText) {
  if (typeof logText !== "string" || logText.length === 0) return [];
  const names = new Set();
  for (const m of logText.matchAll(RE)) {
    const n = m[1].trim();
    if (n) names.add(n);
  }
  return [...names];
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm test`

Expected: `4 passed`

- [ ] **Step 6: 상태 조립 실패 테스트**

`tests/collect.test.mjs`:

```js
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPayload } from "../agent/lib/collect.mjs";

const read = (f) =>
  readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

const NOW = "2026-09-18T04:00:00Z";

describe("buildPayload", () => {
  it("접속자 0명 상태를 조립한다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true,
      players: [],
      backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456",
      nowIso: NOW,
    });
    expect(p.server.running).toBe(true);
    expect(p.server.playerCount).toBe(0);
    expect(p.server.name).toBe("gaybar");
    expect(p.updatedAt).toBe(NOW);
  });

  it("접속자가 있으면 인원과 이름을 담는다", () => {
    const p = buildPayload({
      statusRaw: read("status-players.json"),
      running: true,
      players: ["누들낑"],
      backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 },
      address: "1.2.3.4:2456",
      nowIso: NOW,
    });
    expect(p.server.playerCount).toBe(1);
    expect(p.server.players).toEqual(["누들낑"]);
    expect(p.backup.count).toBe(7);
  });

  it("게임 버전을 keywords 에서 뽑는다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.gameVersion).toBe("1.0.14");
    expect(p.server.networkVersion).toBe(40);
  });

  it("status 가 손상되었으면 running 을 false 로 둔다", () => {
    const p = buildPayload({
      statusRaw: read("status-malformed.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.running).toBe(false);
  });

  it("status 가 비었어도 예외를 던지지 않는다", () => {
    const p = buildPayload({
      statusRaw: read("status-empty.json"),
      running: false, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.running).toBe(false);
    expect(p.server.playerCount).toBe(0);
  });

  it("비밀번호를 담지 않는다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(JSON.stringify(p)).not.toContain("159159");
    expect(JSON.stringify(p)).not.toMatch(/password["']?\s*:\s*["'][^"']+/);
  });
});
```

- [ ] **Step 7: 테스트가 실패하는지 확인**

Run: `npm test`

Expected: FAIL. `collect.mjs` 없음

- [ ] **Step 8: 상태 조립 구현**

`agent/lib/collect.mjs`:

```js
// 상태 객체를 조립한다. 부수효과가 없는 순수 함수다.
// 네트워크 호출과 파일 읽기는 status-publisher.mjs 가 맡는다.

/**
 * status.json 의 keywords 에서 게임 버전과 네트워크 버전을 뽑는다.
 * 형식 예: "g=1.0.14,n=40,m=0\\=85\\,1\\=150..."
 */
function parseKeywords(keywords) {
  if (typeof keywords !== "string") return { gameVersion: null, networkVersion: null };
  const g = keywords.match(/(?:^|,)g=([^,\\]+)/);
  const n = keywords.match(/(?:^|,)n=(\d+)/);
  return {
    gameVersion: g ? g[1] : null,
    networkVersion: n ? Number(n[1]) : null,
  };
}

/**
 * @param {object} args
 * @param {string} args.statusRaw localhost status.json 의 원문
 * @param {boolean} args.running 컨테이너가 돌고 있는가
 * @param {string[]} args.players 로그에서 뽑은 캐릭터 이름
 * @param {{lastAt: string|null, count: number}} args.backup
 * @param {string} args.address 공인 주소
 * @param {string} args.nowIso 현재 시각
 */
export function buildPayload({ statusRaw, running, players, backup, address, nowIso }) {
  let status = null;
  try {
    status = JSON.parse(statusRaw);
  } catch {
    // 파싱 실패는 서버가 정상이 아니라는 뜻이다.
    status = null;
  }

  const ok = running === true && status !== null && status.error == null;
  const kw = parseKeywords(status?.keywords);

  return {
    updatedAt: nowIso,
    server: {
      running: ok,
      name: status?.server_name ?? null,
      playerCount: ok ? Number(status?.player_count) || 0 : 0,
      players: ok ? players : [],
      gameVersion: kw.gameVersion,
      networkVersion: kw.networkVersion,
      address,
    },
    backup: {
      lastAt: backup?.lastAt ?? null,
      count: backup?.count ?? 0,
    },
  };
}
```

- [ ] **Step 9: 테스트 통과 확인**

Run: `npm test`

Expected: `10 passed`

- [ ] **Step 10: 퍼블리셔 실행 스크립트**

`agent/status-publisher.mjs`:

```js
#!/usr/bin/env node
// 30초마다 서버 상태를 수집해 GitHub Gist 에 올린다.
//
// 관리 패널과 분리되어 있다. 관리 패널을 켜지 않아도
// 친구들은 서버 상태를 볼 수 있어야 하기 때문이다.
//
// 필요한 환경변수:
//   GIST_TOKEN   gist 스코프를 가진 GitHub 토큰
//   GIST_ID      대상 Gist 의 id
// 선택:
//   BACKUP_DIR   기본값 C:/ValheimServer/backups
//   INTERVAL_SEC 기본값 30

import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { parsePlayers } from "./lib/logparse.mjs";
import { buildPayload } from "./lib/collect.mjs";

const run = promisify(execFile);

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GIST_FILE = "valheim-status.json";
const BACKUP_DIR = process.env.BACKUP_DIR ?? "C:/ValheimServer/backups";
const INTERVAL = Number(process.env.INTERVAL_SEC ?? 30) * 1000;

if (!GIST_TOKEN || !GIST_ID) {
  console.error("GIST_TOKEN 과 GIST_ID 환경변수가 필요합니다.");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

async function containerRunning() {
  try {
    const { stdout } = await run("docker", ["inspect", "-f", "{{.State.Running}}", "valheim"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function fetchStatusRaw() {
  try {
    const { stdout } = await run("docker", [
      "exec", "valheim", "curl", "-s", "--max-time", "5", "http://127.0.0.1/status.json",
    ]);
    return stdout;
  } catch {
    return "";
  }
}

async function recentLog() {
  try {
    const { stdout } = await run("docker", ["logs", "--since", "12h", "valheim"], {
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return "";
  }
}

async function backupInfo() {
  try {
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".zip"));
    if (files.length === 0) return { lastAt: null, count: 0 };
    let newest = 0;
    for (const f of files) {
      const s = await stat(`${BACKUP_DIR}/${f}`);
      if (s.mtimeMs > newest) newest = s.mtimeMs;
    }
    return { lastAt: new Date(newest).toISOString(), count: files.length };
  } catch {
    return { lastAt: null, count: 0 };
  }
}

async function publicAddress() {
  try {
    const res = await fetch("https://ipv4.icanhazip.com", { signal: AbortSignal.timeout(8000) });
    const ip = (await res.text()).trim();
    return `${ip}:2456`;
  } catch {
    return null;
  }
}

async function pushGist(payload) {
  const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${GIST_TOKEN}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      files: { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } },
    }),
  });
  if (!res.ok) throw new Error(`Gist 갱신 실패 ${res.status}: ${await res.text()}`);
}

async function tick() {
  try {
    const running = await containerRunning();
    const [statusRaw, logText, backup, address] = await Promise.all([
      running ? fetchStatusRaw() : Promise.resolve(""),
      running ? recentLog() : Promise.resolve(""),
      backupInfo(),
      publicAddress(),
    ]);

    const payload = buildPayload({
      statusRaw,
      running,
      players: parsePlayers(logText),
      backup,
      address,
      nowIso: new Date().toISOString(),
    });

    await pushGist(payload);
    log(`푸시 완료 running=${payload.server.running} players=${payload.server.playerCount}`);
  } catch (e) {
    // 실패해도 죽지 않는다. 다음 주기에 다시 시도한다.
    // 페이지는 3분 뒤 자동으로 꺼짐 표시가 된다.
    log("푸시 실패:", e.message);
  }
}

log(`status-publisher 시작. 주기 ${INTERVAL / 1000}초`);
tick();
setInterval(tick, INTERVAL);
```

- [ ] **Step 11: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add agent/ tests/ package.json package-lock.json
git commit -m "feat(agent): 상태 퍼블리셔

30초마다 서버 상태를 수집해 Gist 에 올린다.
관리 패널과 분리해 관리 패널을 켜지 않아도 친구들이 상태를 본다.

접속자 이름은 status.json 이 비워서 주므로 로그에서 뽑는다.
조립 로직은 순수 함수로 분리해 기존 status 픽스처로 테스트한다.

푸시가 실패해도 죽지 않는다. 페이지는 3분 뒤 꺼짐으로 수렴한다.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Gist 연결과 실물 검증

**Files:**
- Modify: `web/src/config.mjs`
- Create: `docs/guides/status-publisher-setup.md`

**Interfaces:**
- Consumes: Task 9 의 퍼블리셔, Task 6 의 `LiveStatus.js`
- Produces: 실제로 동작하는 상태 연동

- [ ] **Step 1: Gist 생성**

사용자가 직접 해야 한다. 브라우저에서 https://gist.github.com 으로 간다.

- 파일 이름: `valheim-status.json`
- 내용: `{}`
- **Create secret gist** 를 누른다 (공개 목록에 안 뜨지만 URL 을 아는 사람은 볼 수 있다)

생성 후 URL 의 마지막 32자리가 Gist ID 다.

- [ ] **Step 2: 토큰 발급**

https://github.com/settings/tokens 에서 **Fine-grained token** 을 만든다.

- 이름: `valheim-status-publisher`
- 만료: 1년
- 권한: **Gists: Read and write** 하나만

> 저장소 권한은 주지 않는다. 이 토큰은 Gist 만 갱신하면 된다.

- [ ] **Step 3: 퍼블리셔 실행**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
GIST_TOKEN="<토큰>" GIST_ID="<gist id>" node agent/status-publisher.mjs
```

Expected 출력:

```
status-publisher 시작. 주기 30초
푸시 완료 running=true players=0
```

- [ ] **Step 4: Gist 내용 확인**

브라우저에서 Gist 를 새로고침한다.

- [ ] `valheim-status.json` 에 `updatedAt`, `server`, `backup` 이 들어 있다
- [ ] `server.gameVersion` 이 `1.0.14` 다
- [ ] `server.address` 가 현재 공인 IP 다
- [ ] **비밀번호가 어디에도 없다**

- [ ] **Step 5: 페이지에 연결**

`web/src/config.mjs` 의 `GIST_ID` 를 실제 값으로 채운다.

```js
export const GIST_ID = "여기에 실제 gist id";
```

> 이 값은 공개되어도 된다. Gist 는 읽기 전용으로 노출되고 토큰은 PC 에만 있다.

Run: `cd web && npm run dev`

- [ ] 서버 탭의 상태 뱃지가 "접속 중" 으로 바뀐다
- [ ] "N초 전 확인" 이 표시된다
- [ ] 월드 탭의 최근 백업 시각이 채워진다

- [ ] **Step 6: 꺼짐 경로 검증**

퍼블리셔를 `Ctrl+C` 로 멈추고 3분 이상 기다린다.

- [ ] 페이지를 새로고침하면 "서버 꺼짐" 으로 표시된다
- [ ] 낡은 접속자 목록이 남아 있지 않다

이 검증이 중요한 이유는, **낡은 데이터를 현재인 척 보여주는 것이 아무것도 안 보여주는 것보다 나쁘기** 때문이다.

- [ ] **Step 7: 운영 문서 작성**

`docs/guides/status-publisher-setup.md` 에 다음을 기록한다.

- Gist ID 와 토큰 발급 절차
- 실행 명령
- Windows 작업 스케줄러로 자동 실행하는 방법
- 토큰 만료 시 갱신 절차
- 장애 시 확인 순서 (퍼블리셔 로그, Gist 갱신 시각, 페이지 콘솔)

- [ ] **Step 8: 커밋**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add web/src/config.mjs docs/guides/status-publisher-setup.md
git commit -m "feat: Gist 연동 완료

실물로 확인한 것:
- 퍼블리셔가 30초마다 Gist 를 갱신한다
- 페이지가 상태를 읽어 표시한다
- 퍼블리셔를 멈추면 3분 뒤 꺼짐으로 표시된다
- Gist 에 비밀번호가 들어가지 않는다

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: GitHub Pages 배포

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `web/` 빌드
- Produces: `https://firstquator.github.io/valheim-multi/` 에서 접근 가능한 사이트

- [ ] **Step 1: 워크플로 작성**

`.github/workflows/pages.yml`:

```yaml
name: Deploy site

on:
  push:
    branches: [main]
    paths:
      - "web/**"
      - "data/**"
      - ".github/workflows/pages.yml"
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: web/package-lock.json

      - name: 의존성 설치
        working-directory: web
        run: npm ci

      # mods.json 스키마는 astro.config.mjs 가 빌드 시작 전에 검증한다.
      # 잘못된 모드 정보가 배포되면 친구들이 틀린 안내를 보게 된다.
      - name: 테스트
        working-directory: web
        run: npm test

      - name: 빌드
        working-directory: web
        run: npm run build

      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with:
          path: web/dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 저장소 설정**

사용자가 직접 해야 한다.

GitHub 저장소 → Settings → Pages → **Source 를 "GitHub Actions" 로** 설정한다.

- [ ] **Step 3: 푸시하고 배포 확인**

```bash
cd /c/Users/SangHyeonLee/orca/valheim-multi
git add .github/ && git commit -m "ci: GitHub Pages 배포 워크플로

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

GitHub 저장소의 Actions 탭에서 워크플로가 도는지 본다.

Expected: `build` 와 `deploy` 가 모두 성공

- [ ] **Step 4: 실물 확인**

https://firstquator.github.io/valheim-multi/ 에 접속한다.

- [ ] 페이지가 뜬다
- [ ] 사이드바 hover 가 동작한다
- [ ] 탭 전환이 동작한다
- [ ] 서버 상태가 실시간으로 보인다
- [ ] 복사 버튼이 동작한다 (HTTPS 라 클립보드 API 가 작동한다)
- [ ] 아이콘이 전부 보이고 **이모지가 한 글자도 없다**

- [ ] **Step 5: 브라우저 콘솔 확인**

개발자 도구 콘솔을 연다.

- [ ] CORS 오류가 없다
- [ ] 404 가 없다 (base 경로 설정이 맞는지)

- [ ] **Step 6: 친구에게 전달**

링크를 친구들에게 보낸다. 실제로 열리는지 한 명에게 확인받는다.

- [ ] **Step 7: README 갱신 후 커밋**

`README.md` 에 사이트 주소와 구조 설명을 추가한다.

```bash
git add README.md && git commit -m "docs: README 에 사이트 주소 추가

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
git push
```

---

## 완료 기준

- [ ] `cd web && npm test` 가 전부 통과한다
- [ ] `npm test` (루트) 가 전부 통과한다
- [ ] 사이트가 GitHub Pages 에서 열린다
- [ ] 사이드바가 hover 로 부드럽게 펼쳐지고 콘텐츠를 밀지 않는다
- [ ] 탭 4개가 전환된다
- [ ] 서버 상태가 30초 주기로 갱신된다
- [ ] 퍼블리셔를 멈추면 3분 뒤 꺼짐으로 표시된다
- [ ] 주소와 비밀번호 복사가 동작한다
- [ ] 모드가 설치 불필요와 설치 필요로 시각적으로 구분된다
- [ ] Gist 에 비밀번호가 들어 있지 않다
- [ ] **이모지가 한 글자도 없다**
- [ ] 소스와 UI 문구에 em dash 와 en dash 가 없다
- [ ] 친구 한 명이 실제로 접속해 확인했다

## 다음 단계

관리 패널은 별도 계획으로 진행한다. 스펙의 9절이 범위다.
