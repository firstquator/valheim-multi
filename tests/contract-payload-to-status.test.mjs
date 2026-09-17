import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { buildPayload } from "../agent/lib/collect.mjs";
import { judgeStatus } from "../web/src/lib/status.mjs";

// buildPayload(생산자, agent/lib/collect.mjs)의 출력을 judgeStatus(소비자,
// web/src/lib/status.mjs)에 그대로 먹여서, 두 모듈이 서로 이해하는 필드
// 이름과 모양이 실제로 맞는지 검증한다.
//
// 각 모듈의 단위 테스트는 자기만의 픽스처를 손으로 만들어 쓰기 때문에,
// buildPayload 가 채우는 필드를 judgeStatus 가 읽지 않는 것 같은 불일치는
// 양쪽 단위 테스트를 전부 통과시키고도 조용히 살아남는다. 실제로
// server.address 가 그런 사례였다: buildPayload 는 공인 IP 를 채워 올렸지만
// judgeStatus 와 그 위의 화면은 이를 읽지 않고 빌드 시점 고정값만 보여줬다.
// 이 테스트는 고치기 전 코드에서 address 검증 부분이 실패해야 의미가 있다.

const read = (f) => readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8");

const NOW_ISO = "2026-09-18T04:00:00Z";
const NOW_MS = Date.parse(NOW_ISO);
const ADDRESS = "182.230.196.27:2456";

describe("buildPayload -> judgeStatus 계약", () => {
  it("접속자가 있는 상태를 소비자가 그대로 읽는다", () => {
    const payload = buildPayload({
      statusRaw: read("status-players.json"),
      running: true,
      players: ["누들낑"],
      backup: { lastAt: "2026-09-18T03:05:00Z", count: 7 },
      address: ADDRESS,
      nowIso: NOW_ISO,
    });

    const judged = judgeStatus(payload, NOW_MS);

    expect(judged.state).toBe("running");
    expect(judged.playerCount).toBe(payload.server.playerCount);
    expect(judged.players).toEqual(payload.server.players);
    expect(judged.gameVersion).toBe(payload.server.gameVersion);
    expect(judged.backupAt).toBe(payload.backup.lastAt);

    // 사이트가 실제로 표시하고 복사 버튼이 복사하는 주소가, 생산자가
    // 조회한 공인 IP 와 일치해야 한다. 이게 깨지면 IP 가 바뀌어도 사이트는
    // 빌드 시점의 옛 주소를 계속 보여준다.
    expect(judged.address).toBe(payload.server.address);
    expect(judged.address).toBe(ADDRESS);
  });

  it("서버가 꺼진 것으로 판정돼도 주소는 그대로 전달된다", () => {
    const payload = buildPayload({
      statusRaw: read("status-malformed.json"),
      running: true,
      players: [],
      backup: { lastAt: null, count: 0 },
      address: ADDRESS,
      nowIso: NOW_ISO,
    });

    const judged = judgeStatus(payload, NOW_MS);

    expect(judged.state).toBe("offline");
    expect(judged.address).toBe(payload.server.address);
    expect(judged.address).toBe(ADDRESS);
  });

  it("낡은 데이터(180초 초과)로 offline 판정될 때도 주소는 유지된다", () => {
    const payload = buildPayload({
      statusRaw: read("status-0players.json"),
      running: true,
      players: [],
      backup: { lastAt: null, count: 0 },
      address: ADDRESS,
      nowIso: "2026-09-18T03:56:00Z", // NOW_MS 기준 240초 전 -> STALE_LIMIT_SEC(180) 초과
    });

    const judged = judgeStatus(payload, NOW_MS);

    expect(judged.state).toBe("offline");
    expect(judged.address).toBe(ADDRESS);
  });
});
