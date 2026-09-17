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

const JOIN_RE = /Got character ZDOID from (.+?) : (-?\d+):\d+/g;
const EXIT_RE = /Destroying abandoned non persistent zdo \S+ owner (-?\d+)/g;

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
