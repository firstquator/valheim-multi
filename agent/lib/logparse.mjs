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
