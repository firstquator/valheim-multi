// 접속 기록을 쌓는다. 순수 함수만 둔다. 네트워크도 파일도 건드리지 않는다.
//
// 왜 필요한가.
// logparse.mjs 가 "지금 누가 접속해 있나" 를 이미 정확히 뽑고 있는데,
// status-publisher 는 그걸 Gist 에 덮어쓰고 버린다. 30 초마다 찍히는
// 그 값을 조금씩 모으기만 하면 두 가지를 알 수 있다.
//
//   - 보통 몇 시에 모이나 (그래서 "지금 들어가면 사람 있나" 에 답이 된다)
//   - 이번 주 누가 얼마나 했나
//
// 어떻게 쌓는가.
// 표본을 그대로 쌓으면 한 달에 8 만 줄이 넘는다. 시간 단위로 접어서
// 담는다. 30 일이면 720 칸이라 파일이 작고, 친구 브라우저가 한 번에
// 받아도 부담이 없다.
//
// 칸의 열쇠는 UTC 기준 시각이다. 보는 사람의 시간대로 바꾸는 일은
// 화면 쪽(web/src/lib/playtime.mjs)이 맡는다. 서버 PC 의 지역 시간으로
// 저장해 두면 나중에 시간대가 다른 곳에서 볼 때 표가 통째로 어긋난다.

export const HISTORY_VERSION = 1;
export const KEEP_DAYS = 30;

/** "2026-09-20T11" 꼴. UTC 기준이다. */
export function hourKey(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 13);
}

export function emptyHistory() {
  return { v: HISTORY_VERSION, hours: {} };
}

/**
 * 표본 하나를 접어 넣는다.
 *
 * 분으로 센다. 표본 개수로 세면 INTERVAL_SEC 을 바꿨을 때 예전 기록이
 * 통째로 잘못 읽힌다. 분으로 담아 두면 주기를 바꿔도 앞뒤가 맞는다.
 *
 * 서버가 꺼져 있던 시간도 접속자 0 명으로 함께 담는다. "이 시간에 보통
 * 몇 명 있나" 를 물을 때, 꺼져 있던 시간을 빼고 평균을 내면 실제보다
 * 훨씬 붐비는 것처럼 보인다.
 *
 * @param {object} history 이전 기록
 * @param {object} sample
 * @param {string} sample.nowIso 표본을 찍은 시각
 * @param {string[]} sample.players 접속 중인 이름
 * @param {number} sample.minutes 이 표본이 대신하는 시간(분)
 * @returns {object} 새 기록. 원본은 건드리지 않는다
 */
export function foldSample(history, { nowIso, players = [], minutes = 0.5 }) {
  const key = hourKey(nowIso);
  if (!key || !(minutes > 0)) return history;

  const prev = history?.hours?.[key];
  const bucket = {
    min: round2((prev?.min ?? 0) + minutes),
    pmin: round2((prev?.pmin ?? 0) + players.length * minutes),
    u: { ...(prev?.u ?? {}) },
  };
  for (const name of players) {
    if (typeof name !== "string" || !name.trim()) continue;
    bucket.u[name] = round2((bucket.u[name] ?? 0) + minutes);
  }

  return {
    v: HISTORY_VERSION,
    hours: { ...(history?.hours ?? {}), [key]: bucket },
  };
}

/** 오래된 칸을 버린다. 파일이 끝없이 자라면 친구 브라우저가 매번 받는다. */
export function pruneHistory(history, nowMs, days = KEEP_DAYS) {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  const hours = {};
  for (const [k, v] of Object.entries(history?.hours ?? {})) {
    const t = Date.parse(`${k}:00:00Z`);
    if (Number.isNaN(t) || t >= cutoff) hours[k] = v;
  }
  return { v: HISTORY_VERSION, hours };
}

/**
 * 받아 온 기록이 우리가 아는 모양인지 확인한다.
 *
 * Gist 는 손으로도 고칠 수 있고 파일이 깨질 수도 있다. 이상하면 빈
 * 기록에서 다시 시작한다. 과거를 잃는 것이 앞으로를 못 쌓는 것보다 낫다.
 */
export function readHistory(raw) {
  try {
    const h = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!h || typeof h !== "object" || typeof h.hours !== "object" || h.hours === null) {
      return emptyHistory();
    }
    if (h.v !== HISTORY_VERSION) return emptyHistory();
    return h;
  } catch {
    return emptyHistory();
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
