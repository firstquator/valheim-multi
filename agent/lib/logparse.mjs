// 발헤임 서버 로그에서 "지금 접속 중인" 캐릭터 이름을 뽑는다.
// status.json 의 players 배열은 이름을 비워서 주기 때문에 로그가 유일한 출처다.
//
// 접속: "Got character ZDOID from <이름> : <ownerId>:<카운터>"
//
// 퇴장: 실제 서버 로그를 읽기 전용으로 훑어서 확인한 실물 퇴장 패턴이다.
// 접속이 끊기면 그 사람 소유의 비영속 ZDO 들이 정리되며 아래 줄들이 남는다
// (2026-09-18 04:43:18, 집 PC의 valheim 컨테이너 로그에서 그대로 인용):
//   RPC_Disconnect
//   Destroying abandoned non persistent zdo 1661827661:1 owner 1661827661
//   Destroying abandoned non persistent zdo 1661827661:4634 owner 1661827661
//   ...
//   Closing socket 76561198084385119
// "owner" 뒤의 숫자가 접속 시 ZDOID 의 ownerId 와 같은 값이라, 이름 없이도
// 누가 나갔는지 역추적할 수 있다.
//
// 다만 이 확인은 실제 운영 로그에서 발견한 사례 1건에 근거한다. 로그 형식은
// 게임 업데이트로 바뀔 수 있고, 동시 접속/퇴장이 겹치는 경우까지 검증하지는
// 못했다. 그래서 이 함수가 퇴장을 놓치더라도(즉 이름이 남아있어도) 문제가
// 커지지 않도록, 최종 개수 보정은 반드시 collect.mjs 의 클램프가 맡는다.

// 접속과 죽음이 같은 줄 모양을 쓴다. ZDOID 가 0:0 이면 죽은 것이다.
//
//   접속  Got character ZDOID from 갓진수 : 2799088602:11937
//   죽음  Got character ZDOID from 갓진수 : 0:0
//
// 그래서 접속 쪽은 0:0 을 빼야 한다. 빼지 않으면 누가 죽을 때마다
// ownerId 0 이 그 사람 이름으로 덮이고, 나중에 owner 0 짜리 정리 줄이
// 나오면 멀쩡히 접속해 있는 사람이 목록에서 사라진다.
const JOIN_RE = /Got character ZDOID from (.+?) : (-?\d+):(\d+)/g;
const EXIT_RE = /Destroying abandoned non persistent zdo \S+ owner (-?\d+)/g;

/** 죽음. 위 설명대로 ZDOID 가 0:0 인 줄이다. */
const DEATH_RE = /Got character ZDOID from (.+?) : 0:0(?!\d)/g;

/**
 * 습격. 로그에 이렇게만 찍힌다.
 *
 *   Random event set:army_bonemass
 *
 * 끝났다는 줄은 없다. 실물 로그 일주일치를 훑어 확인했다. 그래서 "지금
 * 습격 중" 이라고는 말할 수 없고, 언제 시작했는지만 말할 수 있다.
 */
const RAID_RE = /Random event set:(\S+)/g;

/**
 * 줄 앞에 붙은 시각을 읽는다.
 *
 * `docker logs --timestamps` 가 붙여 주는 RFC3339 다. 컨테이너 안에도
 * 시각이 찍히지만 그쪽은 지역 시간이라 시간대를 알 수 없다. 이쪽은
 * 언제나 UTC 라 헷갈릴 일이 없다.
 *
 *   2026-09-20T05:04:00.091100072Z Sep 20 14:04:00 supervisord: ...
 */
function stampBefore(text, index) {
  const lineStart = text.lastIndexOf("\n", index) + 1;
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)/.exec(text.slice(lineStart, lineStart + 40));
  if (!m) return null;
  const t = Date.parse(m[1]);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

/**
 * 누가 언제 죽었는지.
 *
 * 같은 로그 창을 30초마다 다시 읽으므로 같은 죽음이 몇 번이고 다시
 * 나온다. 시각을 함께 주어야 부르는 쪽이 이미 센 것인지 가릴 수 있다.
 *
 * @param {string} logText `docker logs --timestamps` 의 출력
 * @returns {{at: string, name: string}[]} 오래된 것부터
 */
export function parseDeaths(logText) {
  if (typeof logText !== "string" || !logText) return [];
  const out = [];
  for (const m of logText.matchAll(DEATH_RE)) {
    const name = m[1].trim();
    const at = stampBefore(logText, m.index);
    // 시각을 못 읽으면 버린다. 언제인지 모르는 죽음은 셀 수도 없고
    // 같은 것을 또 세지 않게 막을 수도 없다.
    if (name && at) out.push({ at, name });
  }
  return out;
}

/**
 * 언제 무슨 습격이 시작됐는지.
 *
 * @returns {{at: string, name: string}[]} 오래된 것부터
 */
export function parseRaids(logText) {
  if (typeof logText !== "string" || !logText) return [];
  const out = [];
  for (const m of logText.matchAll(RAID_RE)) {
    const name = m[1].trim();
    const at = stampBefore(logText, m.index);
    if (name && at) out.push({ at, name });
  }
  return out;
}

/**
 * @param {string} logText
 * @returns {string[]} 현재 접속 중으로 추정되는 캐릭터 이름 (오래된 순 → 최근 순)
 */
export function parsePlayers(logText) {
  if (typeof logText !== "string" || logText.length === 0) return [];

  const events = [];
  for (const m of logText.matchAll(JOIN_RE)) {
    const name = m[1].trim();
    if (!name) continue;
    // 0:0 은 죽음이다. 접속으로 세면 안 된다.
    if (m[2] === "0" && m[3] === "0") continue;
    events.push({ index: m.index, type: "join", ownerId: m[2], name });
  }
  for (const m of logText.matchAll(EXIT_RE)) {
    events.push({ index: m.index, type: "exit", ownerId: m[1] });
  }
  // 로그에 등장한 순서(index)대로 재생해야 접속/재접속/퇴장이 뒤섞이지 않는다.
  events.sort((a, b) => a.index - b.index);

  const ownerToName = new Map(); // ownerId -> 가장 최근 이름
  const active = new Map(); // name -> true, 삽입 순서 = 접속 순서(가장 최근이 마지막)

  for (const e of events) {
    if (e.type === "join") {
      ownerToName.set(e.ownerId, e.name);
      active.delete(e.name);
      active.set(e.name, true);
    } else {
      const name = ownerToName.get(e.ownerId);
      if (name) {
        active.delete(name);
        ownerToName.delete(e.ownerId);
      }
    }
  }

  return [...active.keys()];
}
