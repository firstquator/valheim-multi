import { describe, it, expect } from "vitest";
import { parseDeaths, parseRaids } from "../agent/lib/logparse.mjs";

// 아래는 집 PC 의 valheim 컨테이너에서 `docker logs --timestamps` 로
// 그대로 뜬 줄이다. 형식을 짐작해서 쓰지 않았다.
const REAL = [
  "2026-09-20T05:04:00.091100072Z Sep 20 14:04:00 supervisord: valheim-server 09/20/2026 14:04:00: Random event set:foresttrolls",
  "2026-09-20T05:04:46.961575346Z Sep 20 14:04:46 supervisord: valheim-server 09/20/2026 14:04:46: Got character ZDOID from 갓진수 : 0:0",
  "2026-09-20T05:04:55.029956599Z Sep 20 14:04:55 supervisord: valheim-server 09/20/2026 14:04:55: Got character ZDOID from 갓진수 : 2799088602:11937",
  "2026-09-20T05:05:12.447221764Z Sep 20 14:05:12 supervisord: valheim-server 09/20/2026 14:05:12: Got character ZDOID from 모카비비 : 0:0",
  "2026-09-19T17:11:49.350524304Z Sep 20 02:11:49 supervisord: valheim-server 09/20/2026 02:11:49: Random event set:army_bonemass",
].join("\n");

describe("죽음 읽기", () => {
  it("ZDOID 가 0:0 인 줄이 죽음이다", () => {
    expect(parseDeaths(REAL)).toEqual([
      { at: "2026-09-20T05:04:46.961Z", name: "갓진수" },
      { at: "2026-09-20T05:05:12.447Z", name: "모카비비" },
    ]);
  });

  it("접속 줄을 죽음으로 세지 않는다", () => {
    const join = "2026-09-20T05:04:55.029956599Z ... Got character ZDOID from 갓진수 : 2799088602:11937";
    expect(parseDeaths(join)).toEqual([]);
  });

  it("시각은 컨테이너 안쪽이 아니라 docker 가 붙인 UTC 를 쓴다", () => {
    // 줄 안에도 09/20/2026 14:04:46 이 있지만 그쪽은 지역 시간이라
    // 시간대를 알 수 없다. 앞의 05:04:46Z 를 써야 어디서 보든 맞는다.
    const [d] = parseDeaths(REAL);
    expect(d.at.endsWith("Z")).toBe(true);
    expect(Date.parse(d.at)).toBe(Date.parse("2026-09-20T05:04:46.961Z"));
  });

  it("시각이 없는 줄은 버린다. 언제인지 모르면 셀 수도 막을 수도 없다", () => {
    expect(parseDeaths("Got character ZDOID from 갓진수 : 0:0")).toEqual([]);
  });

  it("빈 입력에도 죽지 않는다", () => {
    expect(parseDeaths("")).toEqual([]);
    expect(parseDeaths(null)).toEqual([]);
  });
});

describe("습격 읽기", () => {
  it("Random event set 에서 이름과 시각을 뽑는다", () => {
    expect(parseRaids(REAL)).toEqual([
      { at: "2026-09-20T05:04:00.091Z", name: "foresttrolls" },
      { at: "2026-09-19T17:11:49.350Z", name: "army_bonemass" },
    ]);
  });

  it("습격이 없으면 빈 목록", () => {
    expect(parseRaids("아무 일도 없었다")).toEqual([]);
  });
});
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
