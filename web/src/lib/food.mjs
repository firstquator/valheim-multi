// 식단 계산. 무엇을 먹으면 가장 세지는가.
//
// 발헤임은 음식을 한 번에 세 가지까지 먹고, 효과가 그대로 더해진다.
// 어떤 셋을 고르느냐로 최대 체력과 스태미나가 두 배 넘게 갈린다.
// 그런데 게임 안에는 비교표가 없어서, 친구들은 대개 손에 잡히는 것을
// 먹고 만다.
//
// 이 파일은 DOM 도 데이터 파일도 건드리지 않는다. 목록을 받아 계산만 한다.

/** 한 번에 먹을 수 있는 가짓수. */
export const SLOTS = 3;

/**
 * 먹을 수 있는 것만 고른다.
 *
 * 벌꿀주는 Consumable 이지만 체력이 0 이다. 마시는 물약이라 음식 칸을
 * 차지하지 않으므로 여기서 뺀다. 그러지 않으면 "회복의 벌꿀주 세 잔"
 * 같은 엉뚱한 식단이 1 등으로 나온다.
 *
 * @param {object[]} items 도감 전체
 * @param {number|null} stage 여기까지 진행했다고 볼 단계. null 이면 전부
 */
export function edibleFoods(items, stage = null) {
  return items.filter((it) => {
    if (it.type !== "Consumable" && it.type !== "Fish") return false;
    if (!(it.food > 0) && !(it.eitr > 0)) return false;
    if (stage === null) return true;
    // 단계를 모르는 것은 넣지 않는다. 아직 못 가는 곳의 음식을
    // 추천해 버리면 표가 통째로 쓸모없어진다.
    return it.stage !== null && it.stage <= stage;
  });
}

/** 세 가지를 먹었을 때의 합. */
export function comboStats(combo) {
  const sum = (k) => combo.reduce((a, f) => a + (f[k] ?? 0), 0);
  return {
    food: sum("food"),
    stamina: sum("foodStamina"),
    eitr: sum("eitr"),
    regen: sum("foodRegen"),
    // 지속 시간은 더하지 않는다. 각자 따로 닳으므로, 가장 먼저 떨어지는
    // 것이 "언제 다시 먹어야 하나" 를 정한다.
    minBurn: combo.reduce((a, f) => Math.min(a, f.foodBurnTime || Infinity), Infinity),
    weight: sum("weight"),
  };
}

/**
 * 이 단계에서 각 수치를 최대로 끌어올리면 얼마까지 가는가.
 *
 * "골고루" 를 재는 자다. 체력과 스태미나는 눈금이 다르다. 안개 땅이면
 * 체력은 245 까지, 스태미나는 305 까지 올라가서, 둘을 그냥 더하면 늘
 * 스태미나 쪽이 이긴다. 각자의 한계로 나눠 놓아야 "양쪽 다 괜찮은 것"
 * 을 고를 수 있다.
 */
export function limits(foods) {
  const topSum = (key) =>
    [...foods]
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .slice(0, SLOTS)
      .reduce((a, f) => a + (f[key] ?? 0), 0);
  return {
    maxFood: topSum("food") || 1,
    maxStamina: topSum("foodStamina") || 1,
    maxEitr: topSum("eitr") || 1,
  };
}

/** 무엇을 잘하는 식단인가. 목표마다 점수를 다르게 매긴다. */
export const GOALS = [
  {
    id: "health",
    ko: "버티기",
    note: "최대 체력을 가장 높게. 보스를 치거나 처음 가 보는 곳에 들어갈 때입니다.",
    score: (s) => s.food + s.regen * 5,
  },
  {
    id: "stamina",
    ko: "돌아다니기",
    note: "스태미나를 가장 높게. 탐험하고 캐고 나무를 벨 때입니다.",
    score: (s) => s.stamina + s.food * 0.1,
  },
  {
    id: "balanced",
    ko: "골고루",
    note: "체력과 스태미나 중 모자란 쪽을 가장 높게. 할 일을 정하지 않았을 때입니다.",
    // 약한 쪽을 본다. 한쪽만 극단적으로 높은 식단은 여기서 이기지 못한다.
    score: (s, ctx) =>
      Math.min(s.food / ctx.maxFood, s.stamina / ctx.maxStamina) * 1000 +
      (s.food + s.stamina) * 0.01,
  },
  {
    id: "eitr",
    ko: "마법",
    note: "에이트르를 가장 높게. 지팡이를 쓰려면 이쪽입니다.",
    score: (s) => (s.eitr > 0 ? s.eitr + s.food * 0.1 : -1),
  },
];

/**
 * 목표에 가장 맞는 세 가지를 찾는다.
 *
 * 전수 검사다. 한 단계에서 먹을 수 있는 음식이 많아야 60 가지쯤이라
 * 세 개를 고르는 경우의 수가 3 만 남짓이고, 브라우저에서 한 번에 끝난다.
 * 점수 함수를 바꿔 가며 여러 목표를 돌려도 눈에 띄는 지연이 없다.
 *
 * @param {object[]} foods
 * @param {object} goal GOALS 의 항목
 * @param {number} top 몇 개까지 돌려줄 것인가
 */
export function bestCombos(foods, goal, top = 1, ctx = null) {
  const c = ctx ?? limits(foods);
  if (foods.length < SLOTS) {
    // 세 가지가 안 되면 있는 대로 한 벌만 준다. 초원 초반이 그렇다.
    if (!foods.length) return [];
    const stats = comboStats(foods);
    const score = goal.score(stats, c);
    return score < 0 ? [] : [{ combo: [...foods], stats, score }];
  }

  const best = [];
  for (let i = 0; i < foods.length - 2; i++) {
    for (let j = i + 1; j < foods.length - 1; j++) {
      for (let k = j + 1; k < foods.length; k++) {
        const combo = [foods[i], foods[j], foods[k]];
        const stats = comboStats(combo);
        const score = goal.score(stats, c);
        if (score < 0) continue;
        best.push({ combo, stats, score });
      }
    }
  }
  best.sort((a, b) => b.score - a.score || b.stats.food - a.stats.food);
  return best.slice(0, top);
}

/**
 * 목표마다 최고 식단을 하나씩.
 *
 * 세 개를 고르는 경우의 수를 한 번만 훑고 그 자리에서 모든 목표의 점수를
 * 매긴다. 목표마다 따로 훑으면 딥 노스에서 10 만 가지를 네 번 세게 되어,
 * 단계 단추를 누를 때마다 화면이 반 박자 늦는다.
 *
 * 마법 식단은 에이트르 음식이 하나도 없으면 빠진다. 안개 땅에 가기
 * 전까지는 그런 음식이 없어서, 넣어 두면 빈 칸만 남는다.
 */
export function recommend(items, stage) {
  const foods = edibleFoods(items, stage);
  const ctx = limits(foods);

  if (foods.length < SLOTS) {
    const picks = [];
    for (const goal of GOALS) {
      const [best] = bestCombos(foods, goal, 1, ctx);
      if (best) picks.push({ goal, ...best });
    }
    return { foods, picks, limits: ctx };
  }

  const best = new Map(); // goal.id -> {combo, stats, score}
  for (let i = 0; i < foods.length - 2; i++) {
    for (let j = i + 1; j < foods.length - 1; j++) {
      for (let k = j + 1; k < foods.length; k++) {
        const combo = [foods[i], foods[j], foods[k]];
        const stats = comboStats(combo);
        for (const goal of GOALS) {
          const score = goal.score(stats, ctx);
          if (score < 0) continue;
          const cur = best.get(goal.id);
          if (!cur || score > cur.score) best.set(goal.id, { combo, stats, score });
        }
      }
    }
  }

  const picks = GOALS.filter((g) => best.has(g.id)).map((g) => ({ goal: g, ...best.get(g.id) }));
  return { foods, picks, limits: ctx };
}
