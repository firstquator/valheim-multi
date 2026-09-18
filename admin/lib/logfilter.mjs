// 컨테이너 로그를 다루는 순수 함수들.
//
// 두 가지 일을 한다.
//   1. 최근 기동 블록에서 로드된 플러그인 목록을 뽑는다 (드리프트 감지의 입력)
//   2. 화면에 보여줄 줄을 고르고, 비밀값을 가린다
//
// 비밀값 가리기는 이 파일에서만 한다. 응답을 만드는 모든 경로가 여기를
// 거치게 해야 한 군데를 빠뜨려 토큰이 새는 일이 없다.

/** `Loading [Extra Slots 1.2.10]` 에서 이름과 버전을 뽑는다. */
const LOADING_RE = /Loading \[(.+?) ([0-9][0-9A-Za-z.\-+]*)\]/g;

/** BepInEx 가 기동 때 남기는 머리말. 여기서부터가 이번 기동이다. */
const BOOT_RE = /(\d+) plugins to load/g;

/** `[Info   :   BepInEx]` 또는 `[Error :ServersideQoL]` */
const LEVEL_RE = /\[\s*(Trace|Debug|Info|Message|Warning|Error|Fatal)\s*:\s*([^\]]*?)\s*\]/;

/**
 * 로그에서 **가장 최근 기동**의 플러그인 목록을 뽑는다.
 *
 * 컨테이너를 재시작하면 같은 로그에 기동 블록이 여러 번 쌓인다. 앞의 것을
 * 읽으면 이미 지워진 모드가 살아 있는 것처럼 보인다. 그래서 마지막
 * `N plugins to load` 뒤만 읽는다.
 *
 * @param {string} raw
 * @returns {{plugins: Array<{name: string, version: string}>, bootLogFound: boolean, expected: number|null, patcherCount: number|null}}
 */
export function parseLoadedPlugins(raw) {
  if (typeof raw !== "string" || raw.length === 0) {
    return { plugins: [], bootLogFound: false, expected: null, patcherCount: null };
  }

  let bootIndex = -1;
  let expected = null;
  BOOT_RE.lastIndex = 0;
  for (const m of raw.matchAll(BOOT_RE)) {
    bootIndex = m.index;
    expected = Number(m[1]);
  }

  const scope = bootIndex >= 0 ? raw.slice(bootIndex) : raw;

  const byName = new Map();
  for (const m of scope.matchAll(LOADING_RE)) {
    byName.set(m[1], { name: m[1], version: m[2] });
  }

  // patcher 는 기동 블록보다 앞에서 로드된다. 전체 로그의 마지막 값을 본다.
  let patcherCount = null;
  for (const m of raw.matchAll(/(\d+) patcher plugins loaded/g)) {
    patcherCount = Number(m[1]);
  }

  return {
    plugins: [...byName.values()],
    bootLogFound: bootIndex >= 0,
    expected,
    patcherCount,
  };
}

const REDACTIONS = [
  // `-password 어쩌고` 형태의 실행 인자
  /(-{1,2}password[= ]+)(\S+)/gi,
  // `SERVER_PASS=어쩌고`, `token: 어쩌고` 형태
  /((?:password|passwd|server_pass|token|secret|api[_-]?key)\s*[:=]\s*)("?)([^\s"']+)\2/gi,
  // GitHub 개인 토큰
  /\bgh[pousr]_[A-Za-z0-9]{16,}\b/g,
];

const MASK = "[가려짐]";

/**
 * 비밀값을 가린다.
 *
 * 두 겹으로 막는다. 알려진 값(`server/.env` 에서 읽은 비밀번호 등)은 문자열
 * 그대로 지우고, 모르는 값은 패턴으로 지운다. 둘 다 필요하다. 패턴만 쓰면
 * 비밀번호가 맥락 없이 한 단어로 찍힌 줄을 놓치고, 값 목록만 쓰면 새로
 * 생긴 토큰을 놓친다.
 *
 * @param {string} text
 * @param {string[]} secrets 알려진 비밀값 목록. 값 자체는 응답에 절대 싣지 않는다
 */
export function redactSecrets(text, secrets = []) {
  if (typeof text !== "string" || text.length === 0) return "";
  let out = text;

  for (const s of secrets) {
    // 너무 짧은 값은 로그 전체를 갉아먹으므로 거른다.
    if (typeof s !== "string" || s.length < 4) continue;
    out = out.split(s).join(MASK);
  }

  for (const re of REDACTIONS) {
    out = out.replace(re, (full, ...rest) => {
      if (rest.length >= 3 && typeof rest[0] === "string") {
        // 그룹이 있는 패턴: 앞머리는 남기고 값만 가린다
        return `${rest[0]}${MASK}`;
      }
      return MASK;
    });
  }
  return out;
}

const FILTERS = {
  all: () => true,
  error: (line, level) =>
    level === "Error" ||
    level === "Fatal" ||
    level === "Warning" ||
    /\b(Exception|Traceback|failed|Failed|FAILED|not installed correctly)\b/.test(line),
  mods: (line) => /BepInEx|Loading \[|plugins to load|patcher plugins/.test(line),
  players: (line) => /ZDOID|Closing socket|RPC_Disconnect|Got connection/.test(line),
};

export const FILTER_NAMES = Object.keys(FILTERS);

/**
 * 로그 원문을 화면용 줄 목록으로 바꾼다.
 *
 * 전체를 다 쏟지 않는다. 필터를 먼저 걸고, **최근 것부터** limit 개만 남긴다.
 *
 * @param {string} raw
 * @param {object} opts
 * @param {string} [opts.filter] all | error | mods | players
 * @param {number} [opts.limit] 최대 줄 수
 * @param {string[]} [opts.secrets] 가릴 비밀값
 * @param {string} [opts.search] 부분 문자열 검색 (대소문자 무시)
 */
export function filterLog(raw, { filter = "all", limit = 200, secrets = [], search = "" } = {}) {
  const pick = FILTERS[filter] ?? FILTERS.all;
  const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 200));
  const needle = String(search ?? "").toLowerCase();

  const all = typeof raw === "string" ? raw.split(/\r?\n/) : [];
  const out = [];

  for (const line of all) {
    if (line.trim() === "") continue;
    const lm = line.match(LEVEL_RE);
    const level = lm ? lm[1] : null;
    const source = lm ? lm[2] : null;
    if (!pick(line, level)) continue;
    if (needle && !line.toLowerCase().includes(needle)) continue;
    out.push({ level, source, text: redactSecrets(line, secrets) });
  }

  return {
    lines: out.slice(-safeLimit),
    totalMatched: out.length,
    truncated: out.length > safeLimit,
  };
}
