import { describe, it, expect } from "vitest";
import { judgeStatus, STALE_LIMIT_SEC } from "../src/lib/status.mjs";

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
});
