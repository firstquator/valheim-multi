import { describe, it, expect } from "vitest";
import { judgeStatus, formatAge, STALE_LIMIT_SEC } from "../src/lib/status.mjs";

const NOW = Date.parse("2026-09-18T04:00:00Z");
const payload = (overrides = {}) => ({
  updatedAt: "2026-09-18T03:59:30Z",
  server: { running: true, playerCount: 2, players: ["누들낑", "모카비비"] },
  ...overrides,
});

describe("judgeStatus", () => {
  it("신선하고 실행 중이면 running 이다", () => {
    const r = judgeStatus(payload(), NOW);
    expect(r.state).toBe("running");
    expect(r.playerCount).toBe(2);
    expect(r.players).toEqual(["누들낑", "모카비비"]);
  });

  it("신선하지만 running 이 false 면 offline 이다", () => {
    const r = judgeStatus(payload({ server: { running: false, playerCount: 0, players: [] } }), NOW);
    expect(r.state).toBe("offline");
  });

  it("180초를 넘게 낡으면 offline 으로 본다", () => {
    const old = payload({ updatedAt: "2026-09-18T03:56:00Z" });
    const r = judgeStatus(old, NOW);
    expect(r.state).toBe("offline");
  });

  it("정확히 180초는 아직 신선하다 (경계값)", () => {
    const r = judgeStatus(payload({ updatedAt: "2026-09-18T03:57:00Z" }), NOW);
    expect(r.state).toBe("running");
  });

  it("payload 가 없으면 unknown 이다", () => {
    expect(judgeStatus(null, NOW).state).toBe("unknown");
  });

  it("updatedAt 이 망가졌으면 unknown 이다", () => {
    expect(judgeStatus(payload({ updatedAt: "바보" }), NOW).state).toBe("unknown");
  });

  it("경과 시간을 초로 알려준다", () => {
    expect(judgeStatus(payload(), NOW).ageSec).toBe(30);
  });

  it("신선도 한계는 180초다", () => {
    expect(STALE_LIMIT_SEC).toBe(180);
  });

  it("179초는 아직 신선하다 (경계 근접)", () => {
    const r = judgeStatus(payload({ updatedAt: "2026-09-18T03:57:01Z" }), NOW);
    expect(r.state).toBe("running");
  });

  it("181초는 이미 낡았다 (경계 근접)", () => {
    const r = judgeStatus(payload({ updatedAt: "2026-09-18T03:56:59Z" }), NOW);
    expect(r.state).toBe("offline");
  });

  it("updatedAt 이 미래여도 ageSec 는 음수가 아니라 0 이다", () => {
    const future = payload({ updatedAt: "2026-09-18T04:05:00Z" });
    const r = judgeStatus(future, NOW);
    expect(r.ageSec).toBe(0);
  });

  it("playerCount 가 음수면 0 으로 깎는다", () => {
    const r = judgeStatus(payload({ server: { running: true, playerCount: -1, players: [] } }), NOW);
    expect(r.playerCount).toBe(0);
    expect(r.label).toBe("접속 중 · 비어 있음");
  });

  it("players 가 배열이 아니면 빈 배열로 본다", () => {
    const r = judgeStatus(payload({ server: { running: true, playerCount: 2, players: "누들낑" } }), NOW);
    expect(r.state).toBe("running");
    expect(r.players).toEqual([]);
  });

  it("payload 가 빈 객체면 unknown 이고 예외를 던지지 않는다", () => {
    const r = judgeStatus({}, NOW);
    expect(r.state).toBe("unknown");
    expect(r.playerCount).toBe(0);
    expect(r.players).toEqual([]);
  });

  it("백업 시각을 그대로 전달한다", () => {
    const p = payload({ backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 } });
    expect(judgeStatus(p, NOW).backupAt).toBe("2026-09-18T03:05:00Z");
  });

  it("백업 정보가 없으면 null 이다", () => {
    expect(judgeStatus(payload(), NOW).backupAt).toBe(null);
  });

  it("게임 버전을 그대로 전달한다", () => {
    const p = payload({ server: { running: true, playerCount: 0, players: [], gameVersion: "1.0.14" } });
    expect(judgeStatus(p, NOW).gameVersion).toBe("1.0.14");
  });

  it("게임 버전이 없으면 null 이다", () => {
    expect(judgeStatus(payload(), NOW).gameVersion).toBe(null);
  });

  it("offline 판정에서도 백업 시각과 게임 버전을 전달한다", () => {
    const p = payload({
      server: { running: false, playerCount: 0, players: [], gameVersion: "1.0.14" },
      backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 },
    });
    const r = judgeStatus(p, NOW);
    expect(r.state).toBe("offline");
    expect(r.backupAt).toBe("2026-09-18T03:05:00Z");
    expect(r.gameVersion).toBe("1.0.14");
  });

  it("unknown 판정에서는 백업 시각과 게임 버전이 null 이다", () => {
    const r = judgeStatus(null, NOW);
    expect(r.backupAt).toBe(null);
    expect(r.gameVersion).toBe(null);
  });

  it("주소를 그대로 전달한다", () => {
    const p = payload({ server: { running: true, playerCount: 0, players: [], address: "1.2.3.4:2456" } });
    expect(judgeStatus(p, NOW).address).toBe("1.2.3.4:2456");
  });

  it("주소가 없으면 null 이다", () => {
    expect(judgeStatus(payload(), NOW).address).toBe(null);
  });

  it("offline 판정에서도 주소를 전달한다", () => {
    const p = payload({
      server: { running: false, playerCount: 0, players: [], address: "1.2.3.4:2456" },
    });
    expect(judgeStatus(p, NOW).address).toBe("1.2.3.4:2456");
  });

  it("unknown 판정에서는 주소가 null 이다", () => {
    expect(judgeStatus(null, NOW).address).toBe(null);
  });
});

describe("formatAge", () => {
  it("0초는 0초 전 확인 이다", () => {
    expect(formatAge(0)).toBe("0초 전 확인");
  });

  it("59초는 초 단위로 표시한다", () => {
    expect(formatAge(59)).toBe("59초 전 확인");
  });

  it("60초는 분 단위로 넘어간다", () => {
    expect(formatAge(60)).toBe("1분 전 확인");
  });

  it("59분은 아직 분 단위다", () => {
    expect(formatAge(59 * 60)).toBe("59분 전 확인");
  });

  it("60분은 시간 단위로 넘어간다", () => {
    expect(formatAge(60 * 60)).toBe("1시간 전 확인");
  });

  it("ageSec 가 null 이면 확인 시각 불명 이다", () => {
    expect(formatAge(null)).toBe("확인 시각 불명");
  });
});
