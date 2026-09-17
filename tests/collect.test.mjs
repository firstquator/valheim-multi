import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPayload } from "../agent/lib/collect.mjs";

const read = (f) =>
  readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

const NOW = "2026-09-18T04:00:00Z";

describe("buildPayload", () => {
  it("접속자 0명 상태를 조립한다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true,
      players: [],
      backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456",
      nowIso: NOW,
    });
    expect(p.server.running).toBe(true);
    expect(p.server.playerCount).toBe(0);
    expect(p.server.name).toBe("gaybar");
    expect(p.updatedAt).toBe(NOW);
  });

  it("접속자가 있으면 인원과 이름을 담는다", () => {
    const p = buildPayload({
      statusRaw: read("status-players.json"),
      running: true,
      players: ["누들낑"],
      backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 },
      address: "1.2.3.4:2456",
      nowIso: NOW,
    });
    expect(p.server.playerCount).toBe(1);
    expect(p.server.players).toEqual(["누들낑"]);
    expect(p.backup.count).toBe(7);
  });

  it("게임 버전을 keywords 에서 뽑는다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.gameVersion).toBe("1.0.14");
    expect(p.server.networkVersion).toBe(40);
  });

  it("status 가 손상되었으면 running 을 false 로 둔다", () => {
    const p = buildPayload({
      statusRaw: read("status-malformed.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.running).toBe(false);
  });

  it("status 가 비었어도 예외를 던지지 않는다", () => {
    const p = buildPayload({
      statusRaw: read("status-empty.json"),
      running: false, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(p.server.running).toBe(false);
    expect(p.server.playerCount).toBe(0);
  });

  it("비밀번호를 담지 않는다", () => {
    const p = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true, players: [], backup: { lastAt: null, count: 0 },
      address: "1.2.3.4:2456", nowIso: NOW,
    });
    expect(JSON.stringify(p)).not.toContain("159159");
    expect(JSON.stringify(p)).not.toMatch(/password["']?\s*:\s*["'][^"']+/);
  });
});
