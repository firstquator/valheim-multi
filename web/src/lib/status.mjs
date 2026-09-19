// 상태 판정만 한다. fetch 도 DOM 조작도 하지 않는다.
// 섞으면 테스트가 불가능해진다.

export const STALE_LIMIT_SEC = 180;

/**
 * @param {object|null} payload Gist 에서 받은 상태 객체
 * @param {number} nowMs 현재 시각 (밀리초)
 */
export function judgeStatus(payload, nowMs) {
  if (!payload || typeof payload !== "object" || !payload.server) {
    return {
      state: "unknown",
      label: "상태 확인 불가",
      playerCount: 0,
      players: [],
      ageSec: null,
      backupAt: null,
      gameVersion: null,
      resourceRate: null,
      address: null,
    };
  }

  const t = Date.parse(payload.updatedAt);
  if (Number.isNaN(t)) {
    return {
      state: "unknown",
      label: "상태 확인 불가",
      playerCount: 0,
      players: [],
      ageSec: null,
      backupAt: null,
      gameVersion: null,
      resourceRate: null,
      address: null,
    };
  }

  const ageSec = Math.max(0, Math.round((nowMs - t) / 1000));
  const players = Array.isArray(payload.server.players) ? payload.server.players : [];
  const playerCount = Math.max(0, Number(payload.server.playerCount) || 0);

  // 낡은 데이터를 현재인 척하지 않는다.
  // 서버 PC 가 꺼지면 갱신이 멈추므로 자연히 여기로 수렴한다.
  if (ageSec > STALE_LIMIT_SEC || payload.server.running !== true) {
    return {
      state: "offline",
      label: "서버 꺼짐",
      playerCount: 0,
      players: [],
      ageSec,
      backupAt: payload.backup?.lastAt ?? null,
      gameVersion: payload.server?.gameVersion ?? null,
      resourceRate: payload.server?.resourceRate ?? null,
      address: payload.server?.address ?? null,
    };
  }

  return {
    state: "running",
    label: playerCount > 0 ? `접속 중 · ${playerCount}명` : "접속 중 · 비어 있음",
    playerCount,
    players,
    ageSec,
    backupAt: payload.backup?.lastAt ?? null,
    gameVersion: payload.server?.gameVersion ?? null,
    resourceRate: payload.server?.resourceRate ?? null,
    address: payload.server?.address ?? null,
  };
}

/** "30초 전 확인" 같은 문구를 만든다. */
export function formatAge(ageSec) {
  if (ageSec === null) return "확인 시각 불명";
  if (ageSec < 60) return `${ageSec}초 전 확인`;
  const m = Math.floor(ageSec / 60);
  if (m < 60) return `${m}분 전 확인`;
  return `${Math.floor(m / 60)}시간 전 확인`;
}
