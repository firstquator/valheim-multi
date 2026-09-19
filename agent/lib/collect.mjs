// 상태 객체를 조립한다. 부수효과가 없는 순수 함수다.
// 네트워크 호출과 파일 읽기는 status-publisher.mjs 가 맡는다.

/**
 * status.json 의 keywords 에서 게임 버전과 네트워크 버전을 뽑는다.
 * 형식 예: "g=1.0.14,n=40,m=0\\=85\\,1\\=150..."
 *
 * m= 값 안에는 이스케이프된 콤마(\,)가 섞여 있어서 실제 필드 구분자인
 * 콤마와 구분해야 한다. 역슬래시로 시작하지 않는 콤마만 필드 구분자로
 * 인정하도록 부정 후방탐색((?<!\\))을 썼다. 이걸 빼면 m= 값 안에 우연히
 * g= 나 n= 로 시작하는 키가 생겼을 때 엉뚱한 값을 게임/네트워크 버전으로
 * 뽑게 된다.
 */
function parseKeywords(keywords) {
  if (typeof keywords !== "string") {
    return { gameVersion: null, networkVersion: null, resourceRate: null };
  }
  const g = keywords.match(/(?:^|(?<!\\),)g=([^,\\]+)/);
  const n = keywords.match(/(?:^|(?<!\\),)n=(\d+)/);
  return {
    gameVersion: g ? g[1] : null,
    networkVersion: n ? Number(n[1]) : null,
    resourceRate: parseResourceRate(keywords),
  };
}

/**
 * 자원 배율을 백분율로 뽑는다. 기본이 100, 3배면 300 이다.
 *
 * 왜 여기서 뽑는가.
 * 월드 탭에 배율을 손으로 적어 두었더니 두 번 어긋났다. 2배로 올릴 때도,
 * 3배로 올릴 때도 화면은 150% 인 채였다. 서버가 자기 설정을 keywords 로
 * 알려 주고 있으므로 그 값을 그대로 쓰면 다시 틀릴 일이 없다.
 *
 * m= 안쪽은 이스케이프된 구조다. 실제 모양은 이렇다.
 *   m=0\=85\,1\=150\,...\,4\=300
 * 여기서 4 번이 자원이다. 그래서 `4\=` 뒤의 숫자를 찾는다. 앞에 `\,` 나
 * `m=` 가 와야 다른 항목의 꼬리(예: 14\=110)를 잘못 집지 않는다.
 */
function parseResourceRate(keywords) {
  const m = keywords.match(/(?:m=|\\,)4\\=(\d+)/);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) && v > 0 ? v : null;
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
  const playerCount = ok ? Number(status?.player_count) || 0 : 0;

  // players 는 로그를 파싱해 얻은 값이라 status.json 의 player_count 와
  // 어긋날 수 있다 (로그 형식이 바뀌었거나, 퇴장 패턴을 놓쳤거나 등).
  // 이름이 틀리는 것보다 개수가 서로 모순되는 게 더 나쁘므로,
  // player_count 를 넘지 않도록 항상 자른다. parsePlayers 는 오래된 순 →
  // 최근 순으로 반환하므로 뒤에서부터(가장 최근 합류자부터) 남긴다.
  const safePlayers = ok
    ? (Array.isArray(players) ? players : []).slice(
        Math.max(0, (Array.isArray(players) ? players.length : 0) - playerCount),
      )
    : [];

  return {
    updatedAt: nowIso,
    server: {
      running: ok,
      name: status?.server_name ?? null,
      playerCount,
      players: safePlayers,
      gameVersion: kw.gameVersion,
      networkVersion: kw.networkVersion,
      resourceRate: kw.resourceRate,
      address,
    },
    backup: {
      lastAt: backup?.lastAt ?? null,
      count: backup?.count ?? 0,
    },
  };
}
