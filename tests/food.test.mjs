import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SLOTS, GOALS, edibleFoods, comboStats, limits, bestCombos, recommend,
} from "../web/src/lib/food.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(readFileSync(resolve(root, "data/items.json"), "utf8"));

describe("먹을 수 있는 것 고르기", () => {
  it("벌꿀주를 음식으로 세지 않는다", () => {
    // 벌꿀주는 Consumable 이지만 음식 칸을 차지하지 않는 물약이다.
    // 거르지 않으면 "회복의 벌꿀주 세 잔" 이 최고 식단으로 올라온다.
    const ids = new Set(edibleFoods(db.items, null).map((f) => f.id));
    expect(ids.has("MeadHealthMedium")).toBe(false);
    expect(ids.has("CookedMeat")).toBe(true);
  });

  it("아직 못 가는 곳의 음식은 빼고, 단계를 모르는 것도 뺀다", () => {
    const early = edibleFoods(db.items, 0);
    expect(early.length).toBeGreaterThan(0);
    for (const f of early) {
      expect(f.stage).not.toBe(null);
      expect(f.stage).toBeLessThanOrEqual(0);
    }
    // 뒤로 갈수록 선택지가 늘어난다.
    expect(edibleFoods(db.items, 5).length).toBeGreaterThan(early.length);
  });
});

describe("세 가지를 먹었을 때", () => {
  const a = { food: 10, foodStamina: 20, eitr: 0, foodRegen: 1, foodBurnTime: 600, weight: 1 };
  const b = { food: 30, foodStamina: 5, eitr: 0, foodRegen: 2, foodBurnTime: 1800, weight: 1 };
  const c = { food: 20, foodStamina: 10, eitr: 40, foodRegen: 3, foodBurnTime: 1200, weight: 1 };

  it("회복량은 더한다", () => {
    const s = comboStats([a, b, c]);
    expect(s.food).toBe(60);
    expect(s.stamina).toBe(35);
    expect(s.eitr).toBe(40);
    expect(s.regen).toBe(6);
  });

  it("지속 시간은 더하지 않고 가장 짧은 것을 쓴다", () => {
    // 각자 따로 닳는다. 가장 먼저 떨어지는 것이 다시 먹어야 할 때를 정한다.
    expect(comboStats([a, b, c]).minBurn).toBe(600);
  });
});

describe("식단 추천", () => {
  it("목표마다 서로 다른 답을 낸다", () => {
    const { picks } = recommend(db.items, 5);
    const byId = Object.fromEntries(picks.map((p) => [p.goal.id, p]));
    // 버티기는 체력이, 돌아다니기는 스태미나가 더 높아야 한다.
    expect(byId.health.stats.food).toBeGreaterThan(byId.stamina.stats.food);
    expect(byId.stamina.stats.stamina).toBeGreaterThan(byId.health.stats.stamina);
  });

  it("골고루는 한쪽만 높은 식단을 고르지 않는다", () => {
    // 스태미나 수치가 원래 더 커서, 단순히 더하면 늘 스태미나 쪽이 이긴다.
    // 약한 쪽을 기준으로 재야 실제로 균형 잡힌 것이 뽑힌다.
    const { picks } = recommend(db.items, 5);
    const byId = Object.fromEntries(picks.map((p) => [p.goal.id, p]));
    const bal = byId.balanced.stats;
    expect(bal.food).toBeGreaterThan(byId.stamina.stats.food);
    expect(bal.stamina).toBeGreaterThan(byId.health.stats.stamina);
  });

  it("에이트르 음식이 없는 단계에서는 마법 식단이 빠진다", () => {
    // 안개 땅 전에는 그런 음식이 없다. 넣어 두면 빈 칸만 남는다.
    const early = recommend(db.items, 2).picks.map((p) => p.goal.id);
    expect(early).not.toContain("eitr");
    const late = recommend(db.items, 5).picks.map((p) => p.goal.id);
    expect(late).toContain("eitr");
  });

  it("고른 세 가지가 서로 다르다", () => {
    for (const stage of [0, 2, 5, 7]) {
      for (const p of recommend(db.items, stage).picks) {
        const ids = p.combo.map((f) => f.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids.length).toBeLessThanOrEqual(SLOTS);
      }
    }
  });

  it("고른 것이 그 단계에서 실제로 먹을 수 있는 것이다", () => {
    for (const p of recommend(db.items, 2).picks) {
      for (const f of p.combo) expect(f.stage).toBeLessThanOrEqual(2);
    }
  });

  it("음식이 세 가지가 안 되면 있는 대로 준다", () => {
    const two = db.items.filter((i) => i.id === "Honey" || i.id === "Mushroom");
    const [best] = bestCombos(two, GOALS[0], 1);
    expect(best.combo.length).toBeLessThanOrEqual(2);
  });

  it("음식이 하나도 없으면 빈 결과", () => {
    expect(bestCombos([], GOALS[0], 1)).toEqual([]);
    expect(recommend([], 0).picks).toEqual([]);
  });

  it("균형의 기준이 되는 한계는 각 수치의 상위 세 개 합이다", () => {
    const foods = edibleFoods(db.items, 7);
    const l = limits(foods);
    const top3 = (k) => [...foods].sort((a, b) => b[k] - a[k]).slice(0, 3).reduce((a, f) => a + f[k], 0);
    expect(l.maxFood).toBe(top3("food"));
    expect(l.maxStamina).toBe(top3("foodStamina"));
  });

  it("목표 id 가 모두 다르다", () => {
    expect(new Set(GOALS.map((g) => g.id)).size).toBe(GOALS.length);
  });
});
