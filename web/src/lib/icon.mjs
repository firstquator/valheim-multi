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
