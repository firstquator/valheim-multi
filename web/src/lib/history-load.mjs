// 접속 기록 파일을 한 번만 받아 여러 섬이 나눠 쓴다.
//
// "언제 모이나"(Playtime)와 "무슨 일이 있었나"(Events)가 같은 파일을
// 본다. 각자 받으면 같은 것을 두 번 요청하게 된다. lib/itemdb.mjs 와
// 같은 방식이다.

import { buildGistRawUrl } from "./gist-url.mjs";
import { GIST_ID, GIST_OWNER } from "../config.mjs";

export const HISTORY_FILE = "valheim-history.json";

let pending = null;

/**
 * @returns {Promise<object|null>} 기록. 아직 없거나 못 받으면 null
 *
 * 던지지 않는다. 기록이 없는 것은 흔한 일이다. 서버를 막 세웠거나
 * 수집기를 아직 안 켰으면 파일 자체가 없다. 그때는 부르는 쪽이 그
 * 구역을 감춘다.
 */
export function loadHistory() {
  if (pending) return pending;
  pending = (async () => {
    const url = buildGistRawUrl(GIST_OWNER, GIST_ID, HISTORY_FILE, Date.now());
    if (!url) return null;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  })();
  return pending;
}

/** 쌓인 것이 하나라도 있는가. */
export function hasAnything(history) {
  if (!history) return false;
  return (
    Object.keys(history.hours ?? {}).length > 0 ||
    (history.deaths ?? []).length > 0 ||
    (history.raids ?? []).length > 0
  );
}
