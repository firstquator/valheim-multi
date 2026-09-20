import { describe, it, expect } from "vitest";
import {
  hourKey, emptyHistory, foldSample, pruneHistory, readHistory, HISTORY_VERSION,
} from "../agent/lib/history.mjs";

describe("접속 기록 쌓기", () => {
  it("같은 시간대의 표본은 한 칸에 모인다", () => {
    let h = emptyHistory();
    h = foldSample(h, { nowIso: "2026-09-20T11:00:10Z", players: ["치치"], minutes: 0.5 });
    h = foldSample(h, { nowIso: "2026-09-20T11:30:40Z", players: ["치치", "오크"], minutes: 0.5 });

    expect(Object.keys(h.hours)).toEqual(["2026-09-20T11"]);
    const b = h.hours["2026-09-20T11"];
    expect(b.min).toBe(1);
    // 1 명 30 초 + 2 명 30 초 = 1.5 사람분
    expect(b.pmin).toBe(1.5);
    expect(b.u).toEqual({ 치치: 1, 오크: 0.5 });
  });

  it("시간이 넘어가면 칸이 갈린다", () => {
    let h = emptyHistory();
    h = foldSample(h, { nowIso: "2026-09-20T11:59:50Z", players: ["치치"] });
    h = foldSample(h, { nowIso: "2026-09-20T12:00:20Z", players: ["치치"] });
    expect(Object.keys(h.hours).sort()).toEqual(["2026-09-20T11", "2026-09-20T12"]);
  });

  it("아무도 없어도 관측 시간은 쌓인다", () => {
    // 이걸 빼면 "이 시간에 보통 몇 명" 이 실제보다 붐비게 나온다.
    // 사람이 있던 순간만 분모에 들어가기 때문이다.
    const h = foldSample(emptyHistory(), { nowIso: "2026-09-20T03:00:00Z", players: [] });
    const b = h.hours["2026-09-20T03"];
    expect(b.min).toBe(0.5);
    expect(b.pmin).toBe(0);
    expect(b.u).toEqual({});
  });

  it("표본 개수가 아니라 분으로 센다. 주기를 바꿔도 앞뒤가 맞아야 한다", () => {
    let h = emptyHistory();
    h = foldSample(h, { nowIso: "2026-09-20T11:00:00Z", players: ["치치"], minutes: 0.5 });
    h = foldSample(h, { nowIso: "2026-09-20T11:10:00Z", players: ["치치"], minutes: 2 });
    expect(h.hours["2026-09-20T11"].u["치치"]).toBe(2.5);
  });

  it("원본을 건드리지 않는다", () => {
    const before = foldSample(emptyHistory(), { nowIso: "2026-09-20T11:00:00Z", players: ["치치"] });
    const snapshot = JSON.stringify(before);
    foldSample(before, { nowIso: "2026-09-20T11:30:00Z", players: ["오크"] });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it("시각이 이상하면 그냥 무시한다", () => {
    const h = emptyHistory();
    expect(foldSample(h, { nowIso: "어제", players: ["치치"] })).toBe(h);
    expect(hourKey("어제")).toBe(null);
  });

  it("오래된 칸을 버린다", () => {
    const now = Date.parse("2026-09-20T00:00:00Z");
    let h = emptyHistory();
    h = foldSample(h, { nowIso: "2026-09-19T11:00:00Z", players: [] });
    h = foldSample(h, { nowIso: "2026-07-01T11:00:00Z", players: [] });
    const pruned = pruneHistory(h, now, 30);
    expect(Object.keys(pruned.hours)).toEqual(["2026-09-19T11"]);
  });
});

describe("기록 읽기", () => {
  it("깨진 것은 빈 기록으로 돌린다. 과거를 잃어도 앞으로는 쌓여야 한다", () => {
    expect(readHistory("{{{")).toEqual(emptyHistory());
    expect(readHistory(null)).toEqual(emptyHistory());
    expect(readHistory('{"hours":null}')).toEqual(emptyHistory());
    expect(readHistory("[]")).toEqual(emptyHistory());
  });

  it("판이 다르면 버린다", () => {
    expect(readHistory(JSON.stringify({ v: 99, hours: { a: {} } }))).toEqual(emptyHistory());
  });

  it("멀쩡하면 그대로 쓴다", () => {
    const good = { v: HISTORY_VERSION, hours: { "2026-09-20T11": { min: 1, pmin: 1, u: {} } } };
    expect(readHistory(JSON.stringify(good))).toEqual(good);
  });
});
