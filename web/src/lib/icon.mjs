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
 * 아이콘 SVG 원문에 인라인용 변환을 적용한다.
 * label 이 없으면 장식용으로 간주해 스크린리더에서 숨긴다.
 * label 이 있으면 의미 있는 아이콘으로 간주해 role/aria-label 을 붙인다.
 */
export function applyIconTransforms(raw, { label } = {}) {
  let svg = raw.trim();

  // 크기는 CSS 로 제어한다. 루트 태그의 값만 지운다.
  // 내부 요소(rect 등)의 width/height 는 그림을 구성하는 값이므로 보존해야 한다.
  svg = svg.replace(/^<svg\b[^>]*>/, (openTag) =>
    openTag.replace(/\s(?:width|height)="[^"]*"/g, "")
  );

  // 색은 부모의 color 를 따르게 한다.
  svg = svg
    .replace(/stroke="(?!none)[^"]*"/g, 'stroke="currentColor"')
    .replace(/fill="(?!none)[^"]*"/g, 'fill="currentColor"');

  // title 과 role 은 우리가 붙이는 접근성 속성과 충돌하므로 제거한다.
  svg = svg
    .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "")
    .replace(/\srole="[^"]*"/gi, "");

  // 접근성 속성을 루트 태그에 붙인다.
  svg = label
    ? svg.replace(/^<svg\b/, `<svg role="img" aria-label="${label}"`)
    : svg.replace(/^<svg\b/, `<svg aria-hidden="true" focusable="false"`);

  return svg.trim();
}

/**
 * 아이콘 SVG 를 읽어 인라인에 적합한 형태로 돌려준다.
 * 빌드 타임에만 호출된다. 런타임 JS 로 나가지 않는다.
 */
export function readIcon(name, { label } = {}) {
  const cacheKey = `${name}::${label ?? ""}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let raw;
  try {
    raw = readFileSync(join(ICONS_DIR, `${name}.svg`), "utf8");
  } catch {
    throw new Error(`아이콘을 찾을 수 없습니다: ${name} (${ICONS_DIR})`);
  }

  const svg = applyIconTransforms(raw, { label });

  cache.set(cacheKey, svg);
  return svg;
}
