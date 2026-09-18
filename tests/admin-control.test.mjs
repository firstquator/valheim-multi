import { describe, it, expect } from "vitest";
import { decideControl } from "../admin/lib/control.mjs";

describe("서버 제어 허용 판정", () => {
  it("확인 없이는 어떤 동작도 통과시키지 않는다", () => {
    for (const action of ["start", "stop", "restart"]) {
      const d = decideControl({ action, body: {}, playerCount: 0 });
      expect(d.allow, action).toBe(false);
      expect(d.status).toBe(400);
    }
  });

  it("확인이 있으면 접속자 0명일 때 통과시킨다", () => {
    for (const action of ["start", "stop", "restart"]) {
      expect(decideControl({ action, body: { confirm: true }, playerCount: 0 }).allow, action).toBe(true);
    }
  });

  it("접속자가 있으면 중지와 재시작을 한 번 막고 다시 묻는다", () => {
    for (const action of ["stop", "restart"]) {
      const d = decideControl({ action, body: { confirm: true }, playerCount: 3 });
      expect(d.allow, action).toBe(false);
      expect(d.status).toBe(409);
      expect(d.needsPlayerConfirm).toBe(true);
    }
  });

  it("접속자를 알고도 진행하겠다고 하면 통과시킨다", () => {
    const d = decideControl({ action: "restart", body: { confirm: true, confirmPlayers: true }, playerCount: 3 });
    expect(d.allow).toBe(true);
  });

  it("시작은 아무도 끊지 않으므로 접속자 확인을 요구하지 않는다", () => {
    // 컨테이너가 죽은 줄 알았는데 status 가 남아 있는 경우까지 방어한다.
    const d = decideControl({ action: "start", body: { confirm: true }, playerCount: 2 });
    expect(d.allow).toBe(true);
  });

  it("작업이 이미 돌고 있으면 확인이 있어도 막는다", () => {
    const d = decideControl({ action: "restart", body: { confirm: true, confirmPlayers: true }, playerCount: 0, jobRunning: true });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(409);
  });

  it("모르는 동작은 404 다", () => {
    const d = decideControl({ action: "deleteWorld", body: { confirm: true }, playerCount: 0 });
    expect(d.allow).toBe(false);
    expect(d.status).toBe(404);
  });

  it("confirm 이 문자열 true 여도 통과시키지 않는다", () => {
    // 실수로 폼 값이 문자열로 넘어오는 경우를 통과시키면 확인이 무의미해진다.
    const d = decideControl({ action: "stop", body: { confirm: "true" }, playerCount: 0 });
    expect(d.allow).toBe(false);
  });
});
