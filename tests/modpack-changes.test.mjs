import { describe, it, expect } from "vitest";
import { formatChangeDate, summarizeChanges } from "../web/src/lib/modpack-changes.mjs";

describe("formatChangeDate", () => {
  it("앞의 0 을 뗀다", () => {
    // "09월 19일" 은 한국어로 날짜를 읽는 표기가 아니다.
    expect(formatChangeDate("2026-09-19")).toBe("2026년 9월 19일");
  });

  it("두 자리 월과 일은 그대로 둔다", () => {
    expect(formatChangeDate("2026-12-25")).toBe("2026년 12월 25일");
  });

  it("시간대 때문에 하루 밀리지 않는다", () => {
    // Date 로 파싱하면 "2026-01-01" 이 UTC 자정으로 읽혀 한국 시간대에서는
    // 2026년 1월 1일 오전 9시가 된다. 다른 시간대에서는 전날로 밀린다.
    expect(formatChangeDate("2026-01-01")).toBe("2026년 1월 1일");
  });

  it("형식이 어긋나면 빈 문자열을 준다", () => {
    expect(formatChangeDate("2026-9-19")).toBe("");
    expect(formatChangeDate("")).toBe("");
    expect(formatChangeDate(undefined)).toBe("");
    expect(formatChangeDate(null)).toBe("");
  });
});

describe("summarizeChanges", () => {
  const a = { date: "2026-09-19", summary: "새 것", mustUpdate: true };
  const b = { date: "2026-09-01", summary: "옛날 것", mustUpdate: false };

  it("맨 앞을 최신으로 삼고 나머지를 지난 이력으로 나눈다", () => {
    const r = summarizeChanges([a, b]);
    expect(r.latest).toBe(a);
    expect(r.older).toEqual([b]);
    expect(r.mustUpdate).toBe(true);
  });

  it("이력이 없으면 latest 가 null 이다", () => {
    const r = summarizeChanges([]);
    expect(r.latest).toBe(null);
    expect(r.mustUpdate).toBe(false);
    expect(r.older).toEqual([]);
  });

  it("changes 가 아예 없어도 터지지 않는다", () => {
    expect(summarizeChanges(undefined).latest).toBe(null);
    expect(summarizeChanges(null).mustUpdate).toBe(false);
  });

  it("mustUpdate 가 빠지면 강조하지 않는다", () => {
    // 값이 없을 때 "업데이트해야 한다" 로 읽히면 친구가 매번 헛걸음한다.
    expect(summarizeChanges([{ date: "2026-09-19", summary: "x" }]).mustUpdate).toBe(false);
  });

  it("mustUpdate 가 문자열이어도 참으로 읽지 않는다", () => {
    const r = summarizeChanges([{ date: "2026-09-19", summary: "x", mustUpdate: "false" }]);
    expect(r.mustUpdate).toBe(false);
  });
});
