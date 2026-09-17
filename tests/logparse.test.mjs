import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { parsePlayers } from "../agent/lib/logparse.mjs";

const log = readFileSync(new URL("./fixtures/valheim-log-sample.txt", import.meta.url), "utf8");

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
});
