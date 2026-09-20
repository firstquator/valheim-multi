import { describe, it, expect } from "vitest";
import {
  hourKey, emptyHistory, foldSample, pruneHistory, readHistory, mergeEvents,
  HISTORY_VERSION, MAX_EVENTS,
} from "../agent/lib/history.mjs";

describe("사건 합치기", () => {
  const a = { at: "2026-09-20T05:04:46.961Z", name: "갓진수" };
  const b = { at: "2026-09-20T05:05:12.447Z", name: "모카비비" };

  it("같은 사건을 두 번 세지 않는다", () => {
    // 퍼블리셔는 30초마다 12시간치 로그를 통째로 다시 읽는다. 거르지
    // 않으면 한 번 죽은 것이 1440 번 쌓인다.
    expect(mergeEvents([a], [a, b])).toEqual([a, b]);
    expect(mergeEvents([a, b], [a, b])).toEqual([a, b]);
  });

  it("같은 사람이 다른 시각에 죽은 것은 따로 센다", () => {
    const again = { at: "2026-09-20T06:00:00.000Z", name: "갓진수" };
    expect(mergeEvents([a], [again])).toHaveLength(2);
  });

  it("시각 순으로 준다", () => {
    expect(mergeEvents([b], [a]).map((e) => e.name)).toEqual(["갓진수", "모카비비"]);
  });

  it("모양이 틀린 것은 버린다", () => {
    expect(mergeEvents([{ at: 1, name: "x" }, { name: "y" }, null], [a])).toEqual([a]);
  });

  it("한도를 넘으면 오래된 것부터 버린다", () => {
    const many = Array.from({ length: MAX_EVENTS + 10 }, (_, i) => ({
      at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      name: `p${i}`,
    }));
    const out = mergeEvents([], many);
    expect(out).toHaveLength(MAX_EVENTS);
    expect(out[out.length - 1].name).toBe(`p${MAX_EVENTS + 9}`);
  });
});

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

  it("오래된 사건도 함께 버린다", () => {
    const now = Date.parse("2026-09-20T00:00:00Z");
    const h = foldSample(emptyHistory(), {
      nowIso: "2026-09-19T11:00:00Z",
      players: [],
      deaths: [
        { at: "2026-09-19T10:00:00.000Z", name: "갓진수" },
        { at: "2026-07-01T10:00:00.000Z", name: "옛날사람" },
      ],
      raids: [{ at: "2026-07-01T10:00:00.000Z", name: "foresttrolls" }],
    });
    const pruned = pruneHistory(h, now, 30);
    expect(pruned.deaths.map((e) => e.name)).toEqual(["갓진수"]);
    expect(pruned.raids).toEqual([]);
  });

  it("같은 로그를 다시 읽어도 사건이 늘지 않는다", () => {
    // 실제 동작 그대로다. 같은 로그 창을 30초마다 다시 읽는다.
    const deaths = [{ at: "2026-09-20T05:04:46.961Z", name: "갓진수" }];
    const raids = [{ at: "2026-09-20T05:04:00.091Z", name: "foresttrolls" }];
    let h = emptyHistory();
    for (let i = 0; i < 20; i++) {
      h = foldSample(h, { nowIso: "2026-09-20T05:10:00Z", players: [], deaths, raids });
    }
    expect(h.deaths).toHaveLength(1);
    expect(h.raids).toHaveLength(1);
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

  it("판 1 기록은 버리지 않고 이어받는다", () => {
    // 사건 칸이 없던 시절의 파일이다. 판이 올랐다고 버리면 애써 모은
    // 접속 기록이 통째로 날아간다.
    const old = { v: 1, hours: { "2026-09-20T11": { min: 30, pmin: 30, u: { 갓진수: 30 } } } };
    const got = readHistory(JSON.stringify(old));
    expect(got.v).toBe(HISTORY_VERSION);
    expect(got.hours).toEqual(old.hours);
    expect(got.deaths).toEqual([]);
    expect(got.raids).toEqual([]);
  });

  it("멀쩡하면 그대로 쓴다", () => {
    const good = {
      v: HISTORY_VERSION,
      hours: { "2026-09-20T11": { min: 1, pmin: 1, u: {} } },
      deaths: [{ at: "2026-09-20T05:04:46.961Z", name: "갓진수" }],
      raids: [{ at: "2026-09-20T05:04:00.091Z", name: "foresttrolls" }],
    };
    expect(readHistory(JSON.stringify(good))).toEqual(good);
  });

  it("사건 칸이 목록이 아니면 빈 목록으로 채운다", () => {
    const odd = { v: HISTORY_VERSION, hours: {}, deaths: "이상함", raids: null };
    const got = readHistory(JSON.stringify(odd));
    expect(got.deaths).toEqual([]);
    expect(got.raids).toEqual([]);
  });
});
