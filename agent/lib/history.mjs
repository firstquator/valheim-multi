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

export const HISTORY_VERSION = 2;
export const KEEP_DAYS = 30;

// 사건(죽음, 습격)은 시간 칸에 접지 않고 하나씩 남긴다. 몇 시에 몇 번이
// 아니라 "언제 무엇이" 가 궁금한 것이기 때문이다. 30일이면 죽음이 수백
// 건, 습격이 백여 건이라 파일이 커지지 않는다. 그래도 한도를 둔다.
export const MAX_EVENTS = 500;

/** "2026-09-20T11" 꼴. UTC 기준이다. */
export function hourKey(iso) {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 13);
}

export function emptyHistory() {
  return { v: HISTORY_VERSION, hours: {}, deaths: [], raids: [] };
}

/**
 * 같은 사건을 두 번 세지 않게 합친다.
 *
 * 퍼블리셔는 30초마다 12시간치 로그를 통째로 다시 읽는다. 그래서 한 번
 * 죽은 것이 1440 번 다시 나온다. 시각과 이름을 합친 것을 열쇠로 삼아
 * 이미 가진 것은 버린다.
 *
 * 시각은 docker 가 붙인 UTC 라 같은 사건이면 언제 읽어도 같은 문자열이다.
 *
 * @param {{at: string, name: string}[]} prev 이미 가진 것
 * @param {{at: string, name: string}[]} found 이번에 읽은 것
 * @returns {{at: string, name: string}[]} 오래된 것부터
 */
export function mergeEvents(prev, found, { max = MAX_EVENTS } = {}) {
  const seen = new Set();
  const out = [];
  for (const e of [...(prev ?? []), ...(found ?? [])]) {
    if (!e || typeof e.at !== "string" || typeof e.name !== "string") continue;
    const key = `${e.at}|${e.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ at: e.at, name: e.name });
  }
  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  // 넘치면 오래된 것부터 버린다.
  return out.length > max ? out.slice(out.length - max) : out;
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
export function foldSample(history, { nowIso, players = [], minutes = 0.5, deaths, raids }) {
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
    deaths: mergeEvents(history?.deaths, deaths),
    raids: mergeEvents(history?.raids, raids),
  };
}

/** 오래된 것을 버린다. 파일이 끝없이 자라면 친구 브라우저가 매번 받는다. */
export function pruneHistory(history, nowMs, days = KEEP_DAYS) {
  const cutoff = nowMs - days * 24 * 60 * 60 * 1000;
  const hours = {};
  for (const [k, v] of Object.entries(history?.hours ?? {})) {
    const t = Date.parse(`${k}:00:00Z`);
    if (Number.isNaN(t) || t >= cutoff) hours[k] = v;
  }
  const keep = (list) =>
    (list ?? []).filter((e) => {
      const t = Date.parse(e?.at ?? "");
      return Number.isNaN(t) ? false : t >= cutoff;
    });
  return {
    v: HISTORY_VERSION,
    hours,
    deaths: keep(history?.deaths),
    raids: keep(history?.raids),
  };
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
    // 판 1 은 접속 시간만 쌓았다. 사건 칸만 비워서 그대로 이어받는다.
    // 판이 올랐다고 버리면 애써 모은 접속 기록이 통째로 날아간다.
    if (h.v === 1) {
      return { v: HISTORY_VERSION, hours: h.hours, deaths: [], raids: [] };
    }
    if (h.v !== HISTORY_VERSION) return emptyHistory();
    return {
      v: HISTORY_VERSION,
      hours: h.hours,
      deaths: Array.isArray(h.deaths) ? h.deaths : [],
      raids: Array.isArray(h.raids) ? h.raids : [],
    };
  } catch {
    return emptyHistory();
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
