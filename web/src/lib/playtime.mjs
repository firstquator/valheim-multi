// 접속 기록을 읽어 화면에 쓸 모양으로 바꾼다. DOM 을 건드리지 않는다.
//
// 쌓는 쪽은 agent/lib/history.mjs 다. 거기서는 UTC 시각을 열쇠로 쓴다.
// 여기서 보는 사람의 시간대로 옮긴다. 친구들이 다 한국에 있어도 이렇게
// 두는 편이 낫다. 서버 PC 의 시간대가 바뀌거나 밖에서 접속할 때 표가
// 통째로 어긋나지 않는다.

/** 요일 이름. getDay() 가 주는 0(일요일)부터 차례대로다. */
export const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 요일 x 시각 표를 만든다.
 *
 * 칸마다 "그 시간대에 평균 몇 명이 있었나" 다. 여러 주에 걸친 같은
 * 요일·시각을 모두 더해 평균을 낸다.
 *
 * @param {object} history
 * @returns {{cells: number[][], max: number, totalMin: number, busiest: object|null}}
 *   cells[요일][시각]
 */
export function heatmap(history) {
  // 합과 관측 시간을 따로 모은다. 관측이 없는 칸과 관측했는데 0 명인
  // 칸은 다르다. 전자는 비워 두고 후자는 0 으로 칠해야 한다.
  const pmin = Array.from({ length: 7 }, () => new Array(24).fill(0));
  const min = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let totalMin = 0;

  for (const [key, b] of Object.entries(history?.hours ?? {})) {
    const t = Date.parse(`${key}:00:00Z`);
    if (Number.isNaN(t)) continue;
    const d = new Date(t);
    const day = d.getDay();
    const hour = d.getHours();
    pmin[day][hour] += b?.pmin ?? 0;
    min[day][hour] += b?.min ?? 0;
    totalMin += b?.min ?? 0;
  }

  let max = 0;
  let busiest = null;
  const cells = pmin.map((row, day) =>
    row.map((sum, hour) => {
      const observed = min[day][hour];
      if (!(observed > 0)) return null;
      const avg = sum / observed;
      if (avg > max) {
        max = avg;
        busiest = { day, hour, avg };
      }
      return avg;
    }),
  );

  return { cells, max, totalMin, busiest };
}

/**
 * 사람별로 얼마나 했는지.
 *
 * @param {object} history
 * @param {number} sinceMs 이 시각부터. 0 이면 전부
 * @returns {{name: string, minutes: number}[]} 많이 한 사람부터
 */
export function playerTotals(history, sinceMs = 0) {
  const total = new Map();
  for (const [key, b] of Object.entries(history?.hours ?? {})) {
    const t = Date.parse(`${key}:00:00Z`);
    if (Number.isNaN(t) || t < sinceMs) continue;
    for (const [name, m] of Object.entries(b?.u ?? {})) {
      if (!(m > 0)) continue;
      total.set(name, (total.get(name) ?? 0) + m);
    }
  }
  return [...total]
    .map(([name, minutes]) => ({ name, minutes: Math.round(minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
}

/** 기록이 언제부터 언제까지 있는가. 없으면 null. */
export function span(history) {
  const keys = Object.keys(history?.hours ?? {}).sort();
  if (!keys.length) return null;
  const first = Date.parse(`${keys[0]}:00:00Z`);
  const last = Date.parse(`${keys[keys.length - 1]}:00:00Z`);
  if (Number.isNaN(first) || Number.isNaN(last)) return null;
  return { first, last, days: Math.max(1, Math.round((last - first) / 86400000)) };
}

/** 분을 "3시간 20분" 으로. 한 시간이 안 되면 분만 쓴다. */
export function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h}시간 ${rest}분` : `${h}시간`;
}
