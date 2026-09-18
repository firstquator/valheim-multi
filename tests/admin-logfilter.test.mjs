import { describe, it, expect } from "vitest";
import { parseLoadedPlugins, filterLog, redactSecrets } from "../admin/lib/logfilter.mjs";

const BOOT_A = [
  "Sep 18 12:15:47 supervisord: valheim-server [Info   :   BepInEx] 2 plugins to load",
  "Sep 18 12:15:47 supervisord: valheim-server [Info   :   BepInEx] Loading [Conditional Config Sync 1.0.8]",
  "Sep 18 12:15:48 supervisord: valheim-server [Info   :   BepInEx] Loading [GhostMod 9.9.9]",
].join("\n");

const BOOT_B = [
  "Sep 18 12:17:00 supervisord: valheim-server [Info   :   BepInEx] 2 patcher plugins loaded",
  "Sep 18 12:17:01 supervisord: valheim-server [Info   :   BepInEx] 2 plugins to load",
  "Sep 18 12:17:01 supervisord: valheim-server [Info   :   BepInEx] Loading [Conditional Config Sync 1.0.8]",
  "Sep 18 12:17:02 supervisord: valheim-server [Info   :   BepInEx] Loading [Extra Slots 1.2.10]",
].join("\n");

describe("parseLoadedPlugins", () => {
  it("기동 블록이 여러 개면 마지막 것만 읽는다", () => {
    // 재시작하면 같은 로그에 기동 블록이 쌓인다. 앞의 것을 읽으면
    // 이미 지운 모드가 살아 있는 것처럼 보인다.
    const r = parseLoadedPlugins(`${BOOT_A}\n${BOOT_B}`);
    const names = r.plugins.map((p) => p.name);
    expect(names).toContain("Extra Slots");
    expect(names).not.toContain("GhostMod");
    expect(r.bootLogFound).toBe(true);
    expect(r.expected).toBe(2);
  });

  it("패처 로드 수를 뽑는다. 1 이면 BepInEx 자체 패처뿐이라 실패다", () => {
    expect(parseLoadedPlugins(BOOT_B).patcherCount).toBe(2);
    expect(parseLoadedPlugins("1 patcher plugins loaded").patcherCount).toBe(1);
  });

  it("이름과 버전을 나눠 뽑는다", () => {
    const r = parseLoadedPlugins("Loading [Digitalroot's Slope Combat Assistance 2.0.30]");
    expect(r.plugins).toEqual([{ name: "Digitalroot's Slope Combat Assistance", version: "2.0.30" }]);
  });

  it("기동 기록이 없으면 bootLogFound 가 false 다", () => {
    expect(parseLoadedPlugins("아무 내용 없음").bootLogFound).toBe(false);
    expect(parseLoadedPlugins("").plugins).toEqual([]);
  });
});

describe("redactSecrets", () => {
  it("알려진 비밀값을 그대로 지운다", () => {
    const out = redactSecrets("서버 시작: -password hunter2001 끝", ["hunter2001"]);
    expect(out).not.toContain("hunter2001");
    expect(out).toContain("[가려짐]");
  });

  it("모르는 값도 패턴으로 지운다", () => {
    const out = redactSecrets("cmd --password=s0mething-else", []);
    expect(out).not.toContain("s0mething-else");
  });

  it("SERVER_PASS 같은 키=값 형태를 지운다", () => {
    const out = redactSecrets("env SERVER_PASS=abcd1234 TZ=Asia/Seoul", []);
    expect(out).not.toContain("abcd1234");
    expect(out).toContain("TZ=Asia/Seoul");
  });

  it("GitHub 토큰을 지운다", () => {
    const out = redactSecrets("token ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345 사용", []);
    expect(out).not.toContain("ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345");
  });

  it("너무 짧은 값은 무시한다. 로그 전체가 가려지면 못 읽는다", () => {
    const out = redactSecrets("abc 가 여기저기 있다 abc", ["abc"]);
    expect(out).toBe("abc 가 여기저기 있다 abc");
  });
});

describe("filterLog", () => {
  const raw = [
    "Sep 18 12:00:00 [Info   :   BepInEx] 정상적인 줄",
    "Sep 18 12:00:01 [Error :ServersideQoL] ServersideQoL.Patchers.dll was not installed correctly.",
    "Sep 18 12:00:02 [Warning:   BepInEx] 뭔가 수상하다",
    "Sep 18 12:00:03 Got character ZDOID from 누들낑 : 123:1",
    "Sep 18 12:00:04 서버 인자 -password hunter2001",
    "",
  ].join("\n");

  it("기본은 전체를 쏟지 않고 최근 것만 남긴다", () => {
    const r = filterLog(raw, { filter: "all", limit: 2 });
    expect(r.lines).toHaveLength(2);
    expect(r.truncated).toBe(true);
    expect(r.totalMatched).toBe(5);
  });

  it("오류 필터는 Error 와 Warning 만 남긴다", () => {
    const r = filterLog(raw, { filter: "error", limit: 100 });
    const text = r.lines.map((l) => l.text).join("\n");
    expect(text).toContain("was not installed correctly");
    expect(text).toContain("수상하다");
    expect(text).not.toContain("정상적인 줄");
  });

  it("접속 필터는 ZDOID 줄을 남긴다", () => {
    const r = filterLog(raw, { filter: "players", limit: 100 });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].text).toContain("누들낑");
  });

  it("비밀값은 어떤 필터로도 화면에 나가지 않는다", () => {
    for (const filter of ["all", "error", "mods", "players"]) {
      const r = filterLog(raw, { filter, limit: 100, secrets: ["hunter2001"] });
      const text = JSON.stringify(r);
      expect(text, filter).not.toContain("hunter2001");
    }
  });

  it("레벨을 뽑아 화면에서 색을 줄 수 있게 한다", () => {
    const r = filterLog(raw, { filter: "all", limit: 100 });
    const levels = r.lines.map((l) => l.level);
    expect(levels).toContain("Error");
    expect(levels).toContain("Warning");
  });

  it("검색어로 더 좁힐 수 있다", () => {
    const r = filterLog(raw, { filter: "all", limit: 100, search: "patchers" });
    expect(r.lines).toHaveLength(1);
  });
});
