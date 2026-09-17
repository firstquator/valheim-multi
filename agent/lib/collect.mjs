// 상태 객체를 조립한다. 부수효과가 없는 순수 함수다.
// 네트워크 호출과 파일 읽기는 status-publisher.mjs 가 맡는다.

/**
 * status.json 의 keywords 에서 게임 버전과 네트워크 버전을 뽑는다.
 * 형식 예: "g=1.0.14,n=40,m=0\\=85\\,1\\=150..."
 */
function parseKeywords(keywords) {
  if (typeof keywords !== "string") return { gameVersion: null, networkVersion: null };
  const g = keywords.match(/(?:^|,)g=([^,\\]+)/);
  const n = keywords.match(/(?:^|,)n=(\d+)/);
  return {
    gameVersion: g ? g[1] : null,
    networkVersion: n ? Number(n[1]) : null,
  };
}

/**
 * @param {object} args
 * @param {string} args.statusRaw localhost status.json 의 원문
 * @param {boolean} args.running 컨테이너가 돌고 있는가
 * @param {string[]} args.players 로그에서 뽑은 캐릭터 이름
 * @param {{lastAt: string|null, count: number}} args.backup
 * @param {string} args.address 공인 주소
 * @param {string} args.nowIso 현재 시각
 */
export function buildPayload({ statusRaw, running, players, backup, address, nowIso }) {
  let status = null;
  try {
    status = JSON.parse(statusRaw);
  } catch {
    // 파싱 실패는 서버가 정상이 아니라는 뜻이다.
    status = null;
  }

  const ok = running === true && status !== null && status.error == null;
  const kw = parseKeywords(status?.keywords);

  return {
    updatedAt: nowIso,
    server: {
      running: ok,
      name: status?.server_name ?? null,
      playerCount: ok ? Number(status?.player_count) || 0 : 0,
      players: ok ? players : [],
      gameVersion: kw.gameVersion,
      networkVersion: kw.networkVersion,
      address,
    },
    backup: {
      lastAt: backup?.lastAt ?? null,
      count: backup?.count ?? 0,
    },
  };
}
