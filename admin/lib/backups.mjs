// 백업 목록 정리. 순수 함수다. 파일 읽기는 collect.mjs 가 한다.
//
// 읽기 전용이다. 이 패널은 백업을 지우거나 복원하지 않는다.
// 월드 데이터를 건드리는 기능은 만들지 않는다는 것이 이 프로젝트의 규칙이다.

/** 사람이 읽는 크기. 1024 기준으로 끊는다. */
export function formatSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "-";
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

/** "3시간 전" 같은 상대 시각. 미래 시각은 "방금" 으로 접는다. */
export function formatAge(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 60_000) return "방금";
  const min = Math.floor(n / 60_000);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  return `${day}일 전`;
}

/**
 * 백업 파일 목록을 최신순으로 정리하고 요약을 붙인다.
 *
 * @param {Array<{name: string, size: number, mtimeMs: number}>} entries
 * @param {object} opts
 * @param {number} opts.now 현재 시각 (ms)
 * @param {number} [opts.limit] 돌려줄 최대 개수
 */
export function summarizeBackups(entries, { now, limit = 30 } = {}) {
  const list = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && typeof e.name === "string")
    .map((e) => ({
      name: e.name,
      size: Number(e.size) || 0,
      mtimeMs: Number(e.mtimeMs) || 0,
    }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  const totalBytes = list.reduce((n, e) => n + e.size, 0);

  return {
    count: list.length,
    totalBytes,
    totalSize: formatSize(totalBytes),
    latestAt: list.length > 0 ? new Date(list[0].mtimeMs).toISOString() : null,
    items: list.slice(0, Math.max(0, limit)).map((e) => ({
      name: e.name,
      size: e.size,
      sizeText: formatSize(e.size),
      at: new Date(e.mtimeMs).toISOString(),
      age: formatAge(now - e.mtimeMs),
    })),
  };
}

/**
 * `server/docker-compose.yml` 과 `.env` 를 보고 백업 디렉터리를 알아낸다.
 *
 * 경로를 코드에 박지 않는 이유는, compose 를 고쳤는데 패널이 옛 경로를 보고
 * "백업 없음" 이라고 말하면 그것이 가장 나쁜 거짓말이기 때문이다.
 *
 * compose 에는 두 값이 있다.
 *   BACKUPS_DIRECTORY: "/backups-out"                 컨테이너 안 경로
 *   - ${BACKUP_HOST_DIR:-./backups}:/backups-out      호스트 경로 매핑
 *
 * @param {object} args
 * @param {string} args.composeText docker-compose.yml 원문
 * @param {Record<string,string>} [args.envVars] .env 에서 읽은 값
 * @returns {{containerDir: string|null, hostSpec: string|null, hostDir: string|null, source: string}}
 */
export function resolveBackupHostDir({ composeText, envVars = {} }) {
  const text = typeof composeText === "string" ? composeText : "";

  const dirMatch = text.match(/^\s*BACKUPS_DIRECTORY:\s*["']?([^"'\s#]+)/m);
  const containerDir = dirMatch ? dirMatch[1] : null;

  // `- <호스트>:<컨테이너>` 에서 컨테이너 쪽이 BACKUPS_DIRECTORY 인 줄을 찾는다.
  // 정규식을 조립하지 않고 줄 단위로 훑는다. 경로에 정규식 메타문자가
  // 섞였을 때 조립식이 조용히 엉뚱한 줄을 잡는 것을 피하려는 것이다.
  let hostSpec = null;
  if (containerDir) {
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line.startsWith("- ")) continue;
      const body = line.slice(2).trim();
      const cut = body.lastIndexOf(":" + containerDir);
      if (cut <= 0) continue;
      const tail = body.slice(cut + 1 + containerDir.length);
      // 뒤에는 아무것도 없거나 `:ro` 같은 접근 모드만 붙을 수 있다.
      if (tail !== "" && !/^:[a-z,]+$/.test(tail)) continue;
      hostSpec = body.slice(0, cut);
      break;
    }
  }

  if (!hostSpec) {
    return { containerDir, hostSpec: null, hostDir: null, source: "미확인" };
  }

  // ${VAR:-기본값} 과 ${VAR} 를 푼다.
  let usedEnv = false;
  const hostDir = hostSpec.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, fallback) => {
    const v = envVars[name];
    if (typeof v === "string" && v !== "") {
      usedEnv = true;
      return v;
    }
    return fallback ?? "";
  });

  return {
    containerDir,
    hostSpec,
    hostDir,
    source: usedEnv ? "server/.env 의 BACKUP_HOST_DIR" : "docker-compose.yml 의 기본값",
  };
}
