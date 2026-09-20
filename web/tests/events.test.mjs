import { describe, it, expect } from "vitest";
import {
  deathRanking, recentRaids, deathsDuring, ago, raidKo, RAID_KO, RAID_WINDOW_MIN,
} from "../src/lib/events.mjs";

const NOW = Date.parse("2026-09-20T06:00:00.000Z");
const at = (min) => new Date(NOW - min * 60000).toISOString();

const hist = {
  deaths: [
    { at: at(5), name: "갓진수" },
    { at: at(4), name: "모카비비" },
    { at: at(3), name: "갓진수" },
    { at: at(60 * 24 * 10), name: "옛날사람" },
  ],
  raids: [
    { at: at(6), name: "foresttrolls" },
    { at: at(200), name: "army_bonemass" },
    { at: at(60 * 24 * 3), name: "알수없는것" },
  ],
};

describe("사망 순위", () => {
  it("많이 죽은 사람부터 준다", () => {
    expect(deathRanking(hist, 0)).toEqual([
      { name: "갓진수", deaths: 2 },
      { name: "모카비비", deaths: 1 },
      { name: "옛날사람", deaths: 1 },
    ]);
  });

  it("기간을 자른다", () => {
    const week = deathRanking(hist, NOW - 7 * 24 * 60 * 60 * 1000);
    expect(week.map((p) => p.name)).toEqual(["갓진수", "모카비비"]);
  });

  it("기록이 없으면 빈 목록", () => {
    expect(deathRanking({}, 0)).toEqual([]);
    expect(deathRanking(null, 0)).toEqual([]);
  });
});

describe("최근 습격", () => {
  it("새것부터 준다", () => {
    expect(recentRaids(hist, 2).map((r) => r.name)).toEqual(["foresttrolls", "army_bonemass"]);
  });

  it("아는 이름은 한국어로 바꾼다", () => {
    expect(recentRaids(hist, 1)[0].ko).toBe("숲의 트롤");
  });

  it("모르는 이름은 그대로 둔다. 아는 척하면 준비를 잘못하게 된다", () => {
    expect(raidKo("알수없는것")).toEqual({ ko: "알수없는것", note: "" });
    expect(recentRaids(hist, 3)[2].ko).toBe("알수없는것");
  });

  it("습격 이름표에 빈 칸이 없다", () => {
    for (const [key, v] of Object.entries(RAID_KO)) {
      expect(v.ko, key).toBeTruthy();
      expect(v.note, key).toBeTruthy();
    }
  });
});

describe("습격 무렵의 죽음", () => {
  it("시작한 뒤 몇 분 안에 죽은 사람을 묶는다", () => {
    // 실제로 14:04 에 숲의 트롤이 오고 14:04:46, 14:05:12 에 두 명이 죽었다.
    expect(deathsDuring(hist, at(6), RAID_WINDOW_MIN)).toEqual(["갓진수", "모카비비"]);
  });

  it("한 습격에 두 번 죽어도 이름은 한 번만 적는다", () => {
    // 위 fixture 에서 갓진수는 5분 전과 3분 전에 두 번 죽는다.
    const twice = deathsDuring(hist, at(6), RAID_WINDOW_MIN);
    expect(twice.filter((n) => n === "갓진수")).toHaveLength(1);
  });

  it("창 밖의 죽음은 넣지 않는다", () => {
    expect(deathsDuring(hist, at(200), RAID_WINDOW_MIN)).toEqual([]);
  });

  it("시각이 이상하면 빈 목록", () => {
    expect(deathsDuring(hist, "어제")).toEqual([]);
  });
});

describe("얼마나 지났나", () => {
  it("단위를 넘기며 바꾼다", () => {
    expect(ago(at(0.5), NOW)).toBe("방금");
    expect(ago(at(3), NOW)).toBe("3분 전");
    expect(ago(at(90), NOW)).toBe("1시간 전");
    expect(ago(at(60 * 24 * 2), NOW)).toBe("2일 전");
  });

  it("일주일이 넘으면 날짜로 바꾼다", () => {
    expect(ago(at(60 * 24 * 10), NOW)).toMatch(/월 \d+일$/);
  });

  it("시각이 이상하면 빈 문자열", () => {
    expect(ago("어제", NOW)).toBe("");
    expect(ago(null, NOW)).toBe("");
  });
});
