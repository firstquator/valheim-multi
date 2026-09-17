import { defineConfig } from "vitest/config";

// 루트 vitest 는 tests/** 만 수집한다.
//
// web/ 은 자기 자신의 package.json 과 vitest(메이저 버전이 루트와 다르다)
// 를 가진 별도 프로젝트다. 스코프 제한이 없으면 루트 vitest 가 기본
// include 패턴으로 web/tests/ 까지 함께 쓸어담는데, 그러면 web 테스트가
// 개발자가 로컬에서 실제로 쓰는 것과 다른 메이저 버전으로 검증된다.
// 지금은 web/tests/ 가 순수 함수만 다뤄서 우연히 두 버전 모두 통과하지만,
// 이는 문서화된 계약이 아니라 우연이다. 각 프로젝트가 자기 테스트를
// 자기 vitest 로 돌리게 경계를 명시적으로 그어 둔다.
//
// CI 워크플로(.github/workflows/pages.yml)에서 루트 `npm test` 와
// `npm --prefix web test` 를 별도 단계로 실행하는 이유도 같다.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.mjs"],
  },
});
