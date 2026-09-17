import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePlayers } from "../agent/lib/logparse.mjs";

const log = readFileSync(new URL("./fixtures/valheim-log-sample.txt", import.meta.url), "utf8");
const exitLog = readFileSync(
  new URL("./fixtures/valheim-log-exit-sample.txt", import.meta.url),
  "utf8",
);

describe("parsePlayers", () => {
  it("캐릭터 이름을 추출한다", () => {
    expect(parsePlayers(log).sort()).toEqual(["모카비비", "누들낑"].sort());
  });

  it("같은 사람이 여러 번 나와도 한 번만 센다", () => {
    expect(parsePlayers(log).filter((n) => n === "누들낑")).toHaveLength(1);
  });

  it("빈 로그면 빈 배열이다", () => {
    expect(parsePlayers("")).toEqual([]);
  });

  it("형식이 바뀌어도 예외를 던지지 않는다", () => {
    expect(parsePlayers("전혀 다른 내용\n무작위 텍스트")).toEqual([]);
  });

  it("실물 로그의 퇴장 패턴을 인식해 나간 사람을 뺀다", () => {
    // 실측: 접속했던 사람이 RPC_Disconnect + Destroying abandoned non
    // persistent zdo ... owner <ownerId> + Closing socket 로 끊기면
    // 그 사람은 더 이상 활성 목록에 없어야 한다. 같은 로그에서 계속
    // 접속 중인 다른 사람은 남아야 한다.
    expect(parsePlayers(exitLog)).toEqual(["모카비비"]);
  });

  it("퇴장 없이 접속만 있으면 계속 활성 상태다", () => {
    expect(parsePlayers(log)).toContain("누들낑");
    expect(parsePlayers(log)).toContain("모카비비");
  });
});
