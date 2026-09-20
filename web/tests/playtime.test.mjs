import { describe, it, expect } from "vitest";
import { heatmap, playerTotals, span, formatMinutes, DAY_KO } from "../src/lib/playtime.mjs";

/** 칸 하나를 만든다. */
const bucket = (min, pmin, u = {}) => ({ min, pmin, u });

describe("요일 x 시각 표", () => {
  it("관측이 없는 칸과 0 명인 칸을 구분한다", () => {
    // 비어 있는 칸은 아직 모르는 것이고, 0 은 확인한 결과다.
    // 같게 칠하면 서버를 켠 적 없는 새벽과 아무도 안 온 새벽이 똑같이 보인다.
    const h = { hours: { "2026-09-20T03": bucket(60, 0) } };
    const { cells } = heatmap(h);
    const d = new Date(Date.parse("2026-09-20T03:00:00Z"));
    expect(cells[d.getDay()][d.getHours()]).toBe(0);
    // 건드리지 않은 칸
    expect(cells[(d.getDay() + 1) % 7][d.getHours()]).toBe(null);
  });

  it("여러 주의 같은 요일과 시각을 합쳐 평균을 낸다", () => {
    // 일주일 차이 나는 같은 시각 두 칸. 한 번은 2 명, 한 번은 0 명이면 평균 1 명.
    const h = {
      hours: {
        "2026-09-13T11": bucket(60, 120),
        "2026-09-20T11": bucket(60, 0),
      },
    };
    const { cells, max } = heatmap(h);
    const d = new Date(Date.parse("2026-09-20T11:00:00Z"));
    expect(cells[d.getDay()][d.getHours()]).toBe(1);
    expect(max).toBe(1);
  });

  it("가장 붐비는 칸을 집어낸다", () => {
    const h = {
      hours: {
        "2026-09-20T11": bucket(60, 60),
        "2026-09-20T21": bucket(60, 180),
      },
    };
    const { busiest } = heatmap(h);
    const d = new Date(Date.parse("2026-09-20T21:00:00Z"));
    expect(busiest.avg).toBe(3);
    expect(busiest.day).toBe(d.getDay());
    expect(busiest.hour).toBe(d.getHours());
  });

  it("기록이 없으면 빈 표를 준다", () => {
    const { cells, max, busiest } = heatmap({ hours: {} });
    expect(cells).toHaveLength(7);
    expect(cells[0]).toHaveLength(24);
    expect(max).toBe(0);
    expect(busiest).toBe(null);
  });

  it("칸 열쇠가 깨져 있어도 넘어간다", () => {
    const { totalMin } = heatmap({ hours: { 어제: bucket(60, 60), "2026-09-20T11": bucket(30, 30) } });
    expect(totalMin).toBe(30);
  });

  it("요일 이름이 getDay 순서와 맞는다", () => {
    // 일요일이 0 이다. 여기가 어긋나면 표 전체가 하루씩 밀린다.
    expect(DAY_KO).toHaveLength(7);
    expect(DAY_KO[new Date(2026, 8, 20).getDay()]).toBe("일");
  });
});

describe("사람별 플레이 시간", () => {
  const h = {
    hours: {
      "2026-09-01T11": bucket(60, 60, { 치치: 60 }),
      "2026-09-20T11": bucket(60, 120, { 치치: 60, 오크: 30 }),
    },
  };

  it("많이 한 사람부터 준다", () => {
    expect(playerTotals(h)).toEqual([
      { name: "치치", minutes: 120 },
      { name: "오크", minutes: 30 },
    ]);
  });

  it("기간을 자른다", () => {
    const since = Date.parse("2026-09-10T00:00:00Z");
    expect(playerTotals(h, since)).toEqual([
      { name: "치치", minutes: 60 },
      { name: "오크", minutes: 30 },
    ]);
  });

  it("아무 기록이 없으면 빈 목록", () => {
    expect(playerTotals({ hours: {} })).toEqual([]);
    expect(playerTotals(null)).toEqual([]);
  });
});

describe("기록 범위", () => {
  it("처음과 끝, 며칠어치인지 준다", () => {
    const s = span({ hours: { "2026-09-20T11": {}, "2026-09-13T11": {} } });
    expect(s.days).toBe(7);
    expect(s.first).toBe(Date.parse("2026-09-13T11:00:00Z"));
  });

  it("비어 있으면 null", () => {
    expect(span({ hours: {} })).toBe(null);
    expect(span(null)).toBe(null);
  });
});

describe("시간 표기", () => {
  it("한 시간이 안 되면 분만 쓴다", () => {
    expect(formatMinutes(0)).toBe("0분");
    expect(formatMinutes(59)).toBe("59분");
  });

  it("시간과 분을 함께 쓰되 0 분은 생략한다", () => {
    expect(formatMinutes(60)).toBe("1시간");
    expect(formatMinutes(200)).toBe("3시간 20분");
  });
});
