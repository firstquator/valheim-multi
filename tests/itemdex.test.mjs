import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  filterItems, matchesQuery, groupOf, damageList, GROUPS,
  statCaps, combatDamage, damagesOf, materialAmountAt, armorAt, maxima, usedByIndex,
  craftCost, craftTree, flattenRaw, expandCost, sortItems, SORTS, upgradeTotals,
} from "../web/src/lib/itemdex.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(readFileSync(resolve(root, "data/items.json"), "utf8"));

describe("도감 데이터", () => {
  it("아이템이 실려 있고 한국어 이름이 비어 있지 않다", () => {
    expect(db.items.length).toBeGreaterThan(900);
    const noKo = db.items.filter((i) => !i.ko);
    expect(noKo).toEqual([]);
  });

  it("단계 표가 8 개이고 아이템의 stage 가 그 범위 안에 있다", () => {
    expect(db.stages).toHaveLength(8);
    const valid = new Set(db.stages.map((s) => s.n));
    for (const i of db.items) {
      if (i.stage !== null) expect(valid.has(i.stage)).toBe(true);
    }
  });

  it("아이콘 파일 이름은 id 와 같다. 다르면 이미지가 깨진다", () => {
    for (const i of db.items) {
      if (i.icon !== null) expect(i.icon).toBe(i.id);
    }
  });

  it("모든 종류가 묶음에 들어간다. 빠지면 걸러내기에서 사라진다", () => {
    const known = new Set(GROUPS.flatMap((g) => g.types));
    const types = new Set(db.items.map((i) => i.type).filter(Boolean));
    for (const t of types) expect(known.has(t)).toBe(true);
  });

  it("배포본의 items.json 이 data/items.json 과 같다", () => {
    // 사이트는 web/public/items.json 을 받아 간다. data 쪽만 고치고
    // 복사를 잊으면 도감이 옛날 내용을 보여 주는데, 화면만 봐서는
    // 알아챌 수 없다. 여기서 막는다.
    const a = readFileSync(resolve(root, "data/items.json"));
    const b = readFileSync(resolve(root, "web/public/items.json"));
    expect(b.equals(a)).toBe(true);
  });

  it("아이콘 파일이 실제로 있다", () => {
    // icon 이 채워져 있는데 파일이 없으면 깨진 이미지가 나간다.
    const dir = resolve(root, "web/public/items");
    const have = new Set(readdirSync(dir));
    const missing = db.items
      .filter((i) => i.icon)
      .map((i) => `${i.icon}.webp`)
      .filter((f) => !have.has(f));
    expect(missing).toEqual([]);
  });

  it("변환표의 재료도 도감 안의 아이템을 가리킨다", () => {
    // 굽고 녹이는 것은 Recipe 가 아니라 설비의 변환표에 들어 있다.
    // from 이 도감에 없으면 상세에 이름 없는 칸이 뜬다.
    const ids = new Set(db.items.map((i) => i.id));
    const conv = db.items.filter((i) => i.conversion);
    expect(conv.length).toBeGreaterThan(50);
    for (const i of conv) {
      expect(ids.has(i.conversion.from)).toBe(true);
      expect(i.conversion.station).toBeTruthy();
    }
  });

  it("변환으로 얻는 것은 단계가 정해져 있다", () => {
    // 재료의 단계를 알면 결과물의 단계도 알 수 있다. 비어 있으면
    // 계산이 끊긴 것이다.
    const missing = db.items
      .filter((i) => i.conversion)
      .filter((i) => i.stage === null)
      .map((i) => i.id);
    expect(missing).toEqual([]);
  });

  it("차원문 가능 여부는 참거짓이 아니라 1 과 0 이다", () => {
    // 화면에서 `teleportable === false` 로 보다가 금속에 경고가 하나도
    // 뜨지 않았다. 값이 false 가 아니라 0 이라 영영 맞지 않는다.
    const values = new Set(db.items.map((i) => i.teleportable));
    expect([...values].sort()).toEqual([0, 1]);
    const blocked = db.items.filter((i) => !i.teleportable).map((i) => i.id);
    expect(blocked).toContain("Bronze");
    expect(blocked).toContain("Iron");
  });

  it("레시피 재료는 도감 안의 아이템을 가리킨다", () => {
    const ids = new Set(db.items.map((i) => i.id));
    let checked = 0;
    for (const i of db.items) {
      for (const m of i.recipe?.materials ?? []) {
        // 재료가 도감에 없으면 화면에서 이름 없는 칸이 된다.
        expect(ids.has(m.item)).toBe(true);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });
});

describe("걸러내기", () => {
  const fake = [
    { id: "SwordIron", ko: "철검", en: "Iron sword", type: "OneHandedWeapon", stage: 2, damages: { m_slash: 55, m_pierce: 0, m_fire: 10 } },
    { id: "Wood", ko: "나무", en: "Wood", type: "Material", stage: 0, damages: {} },
    { id: "Hair1", ko: "머리 1", en: "Hair 1", type: "Customization", stage: null, damages: {} },
  ];

  it("한국어로 찾는다", () => {
    expect(filterItems(fake, { q: "철검" }).map((x) => x.id)).toEqual(["SwordIron"]);
  });

  it("영어와 내부 이름으로도 찾는다", () => {
    expect(filterItems(fake, { q: "iron" }).map((x) => x.id)).toEqual(["SwordIron"]);
    expect(filterItems(fake, { q: "swordi" }).map((x) => x.id)).toEqual(["SwordIron"]);
  });

  it("대소문자와 앞뒤 공백을 무시한다", () => {
    expect(filterItems(fake, { q: "  IRON  " }).map((x) => x.id)).toEqual(["SwordIron"]);
  });

  it("단계로 좁힌다", () => {
    expect(filterItems(fake, { stage: 0 }).map((x) => x.id)).toEqual(["Wood"]);
  });

  it("단계 0 을 걸러도 전체가 나오지 않는다. 0 이 거짓으로 읽히면 그렇게 된다", () => {
    // stage: 0 을 falsy 로 처리하면 걸러내기가 통째로 무시된다.
    expect(filterItems(fake, { stage: 0 })).toHaveLength(1);
  });

  it("묶음으로 좁힌다", () => {
    expect(filterItems(fake, { group: "weapon" }).map((x) => x.id)).toEqual(["SwordIron"]);
    expect(filterItems(fake, { group: "custom" }).map((x) => x.id)).toEqual(["Hair1"]);
  });

  it("조건을 겹쳐 쓴다", () => {
    expect(filterItems(fake, { q: "철", group: "weapon", stage: 2 })).toHaveLength(1);
    expect(filterItems(fake, { q: "철", group: "armor", stage: 2 })).toHaveLength(0);
  });

  it("공백을 무시하고 찾는다. 게임 이름은 띄어 쓰는데 사람은 붙여 친다", () => {
    // 공식 이름이 "철 검" 이라 "철검" 으로 치면 0 개가 나오던 문제다.
    const real = [{ id: "SwordIron", ko: "철 검", en: "Iron sword", type: "OneHandedWeapon", stage: 2, damages: {} }];
    expect(filterItems(real, { q: "철검" })).toHaveLength(1);
    expect(filterItems(real, { q: "철 검" })).toHaveLength(1);
    expect(filterItems(real, { q: "ironsword" })).toHaveLength(1);
  });

  it("빈 검색어는 아무것도 걸러내지 않는다", () => {
    expect(matchesQuery(fake[0], "")).toBe(true);
    expect(matchesQuery(fake[0], "   ")).toBe(true);
  });

  it("종류를 묶음으로 바꾼다", () => {
    expect(groupOf(fake[0])).toBe("weapon");
    expect(groupOf(fake[1])).toBe("material");
  });

  it("데미지는 0 을 빼고 큰 것부터 준다", () => {
    const d = damageList(fake[0]);
    expect(d.map((x) => x.key)).toEqual(["slash", "fire"]);
    expect(d[0].value).toBe(55);
  });
});

describe("수치 해석", () => {
  const byId = new Map(db.items.map((i) => [i.id, i]));
  const get = (id) => {
    const it = byId.get(id);
    if (!it) throw new Error(`데이터에 ${id} 가 없다`);
    return it;
  };

  it("쓰이지 않는 칸은 내보내지 않는다. 기본값이 그대로 새어 나가면 거짓말이 된다", () => {
    // 게임 데이터는 모든 아이템의 내구도를 100, 방어력을 10 으로 채워 둔다.
    // 드래곤 알에 "내구도 100" 이 붙던 것이 이 때문이었다.
    expect([...statCaps(get("DragonEgg"))]).toEqual([]);
    expect([...statCaps(get("Wood"))]).toEqual([]);

    // 방패의 armor 는 100, 200 처럼 쓰이지 않는 값이 들어 있다. 실제
    // 값은 blockPower 쪽이다.
    const shield = statCaps(get("ShieldWood"));
    expect(shield.has("block")).toBe(true);
    expect(shield.has("armor")).toBe(false);

    // 반대로 갑옷은 armor 가 진짜이고 막기는 의미가 없다.
    const chest = statCaps(get("ArmorIronChest"));
    expect(chest.has("armor")).toBe(true);
    expect(chest.has("block")).toBe(false);

    // 활은 막기를 할 수 없는데 blockPower 3 이 들어 있다.
    expect(statCaps(get("Bow")).has("block")).toBe(false);
  });

  it("던졌을 때의 기본 피해를 무기 공격력으로 세지 않는다", () => {
    // 게임 데이터는 모든 아이템에 던지기 피해(타격 10)를 박아 둔다.
    // 거르지 않으면 목록에서 가죽 투구와 넥의 트로피가 "공격 10" 인
    // 무기처럼 보인다. 실제로 그렇게 나왔다.
    expect(damageList(get("HelmetLeather")).length).toBeGreaterThan(0);
    expect(damagesOf(get("HelmetLeather"))).toEqual([]);
    expect(combatDamage(get("HelmetLeather"))).toBe(0);
    expect(combatDamage(get("TrophyNeck"))).toBe(0);
    expect(combatDamage(get("ShieldWoodTower"))).toBe(0);

    // 진짜 무기와 화살은 그대로 나와야 한다.
    expect(combatDamage(get("SwordIron"))).toBe(55);
    expect(combatDamage(get("ArrowWood"))).toBe(22);
  });

  it("벌목과 곡괭이는 공격력에 더하지 않는다. 적에게 들어가지 않는 값이다", () => {
    const axe = get("AxeIron");
    expect(damagesOf(axe).map((d) => d.key)).toContain("chop");
    // 베기 60 + 벌목 50 이지만 공격력은 60 이다.
    expect(combatDamage(axe)).toBe(60);
  });

  it("강화 단계에 드는 재료는 perLevel x (단계 - 1) 이다", () => {
    // 철 검은 철 20 으로 만들고 2 단계에 10, 3 단계에 20, 4 단계에 30 이 든다.
    const iron = get("SwordIron").recipe.materials.find((m) => m.item === "Iron");
    expect(materialAmountAt(iron, 1)).toBe(20);
    expect(materialAmountAt(iron, 2)).toBe(10);
    expect(materialAmountAt(iron, 3)).toBe(20);
    expect(materialAmountAt(iron, 4)).toBe(30);

    // 우상처럼 perLevel 이 0 인 것은 처음 만들 때만 든다.
    const idol = get("SwordIron").recipe.materials.find((m) => m.item.startsWith("Upgrader"));
    expect(materialAmountAt(idol, 1)).toBe(1);
    expect(materialAmountAt(idol, 2)).toBe(0);
  });

  it("방어력은 단계마다 armorPerLevel 만큼 오른다", () => {
    // 철 비늘 갑옷은 14 에서 시작해 4 단계에 20 이 된다.
    const chest = get("ArmorIronChest");
    expect(armorAt(chest, 1)).toBe(14);
    expect(armorAt(chest, 4)).toBe(20);
  });

  it("막대의 기준이 되는 최댓값은 의미 있는 칸에서만 모은다", () => {
    const m = maxima(db.items);
    expect(m.armor).toBeGreaterThan(0);
    // 방패의 armor 200 을 세어 버리면 갑옷 막대가 전부 짧아진다.
    expect(m.armor).toBeLessThan(100);
    expect(m.food).toBeGreaterThan(0);
    expect(m.damage.slash).toBeGreaterThan(0);
  });

  it("원자재까지 펼친다", () => {
    // 도감은 "흑철 80" 까지만 알려 준다. 원정 전에 궁금한 것은
    // "그래서 고철을 몇 개 캐 와야 하나" 다.
    const sword = get("SwordBlackmetal");
    const { raw } = expandCost(byId, craftCost(sword, { maxed: true }));
    const ko = Object.fromEntries([...raw].map(([k, v]) => [byId.get(k).ko, v]));
    expect(ko["흑철 고철"]).toBe(80);
    expect(ko["아마 섬유"]).toBe(35);
    // 중간 단계인 흑철과 아마포 실은 남아 있으면 안 된다. 그건 만드는 것이다.
    expect(ko["흑철"]).toBeUndefined();
    expect(ko["아마포 실"]).toBeUndefined();
  });

  it("한 번에 여러 개가 나오는 것은 횟수를 올림한다", () => {
    // 청동은 한 번에 5 개가 나온다. 7 개가 필요하면 두 번 돌려야 하므로
    // 구리 20, 주석 10 이 든다. 내림하면 재료가 모자란 표가 나간다.
    const { raw } = expandCost(byId, new Map([["Bronze", 7]]));
    const ko = Object.fromEntries([...raw].map(([k, v]) => [byId.get(k).ko, v]));
    expect(ko["구리 광석"]).toBe(20);
    expect(ko["주석 광석"]).toBe(10);
  });

  it("펼치기가 변환도 따라간다", () => {
    // 철은 레시피가 없고 용광로 변환으로만 나온다. 여기서 끊기면
    // 철이 원자재로 잡혀 "광석을 캐야 한다" 는 사실이 사라진다.
    const { raw } = expandCost(byId, new Map([["Iron", 20]]));
    expect(raw.get("IronOre")).toBe(20);
    expect(raw.has("Iron")).toBe(false);
  });

  it("강화까지 칠지 고를 수 있다", () => {
    const chest = get("ArmorIronChest");
    expect(craftCost(chest, { maxed: false }).get("Iron")).toBe(20);
    expect(craftCost(chest, { maxed: true }).get("Iron")).toBe(50);
  });

  it("조합법이 돌고 돌아도 멈춘다", () => {
    // 지금 데이터에는 없지만 모드가 하나 들어오면 생길 수 있다.
    // 그때 화면이 멈추는 대신 그 재료를 원자재로 취급하면 그만이다.
    const loop = new Map([
      ["A", { id: "A", ko: "A", recipe: { amount: 1, materials: [{ item: "B", amount: 1 }] } }],
      ["B", { id: "B", ko: "B", recipe: { amount: 1, materials: [{ item: "A", amount: 1 }] } }],
    ]);
    const tree = craftTree(loop, "A", 1);
    expect(flattenRaw(tree).get("A")).toBe(1);
  });

  it("거꾸로 된 목록이 재료에서 결과물을 찾아 준다", () => {
    const used = usedByIndex(db.items);
    const wood = used.get("Wood") ?? [];
    expect(wood.length).toBeGreaterThan(20);
    expect(wood.some((u) => u.id === "SwordIron")).toBe(true);

    // 변환도 들어가야 한다. 날고기를 구우면 구운 고기가 된다.
    const raw = used.get("RawMeat") ?? [];
    expect(raw.some((u) => u.id === "CookedMeat" && u.via === "conversion")).toBe(true);
  });
});

describe("정렬", () => {
  it("기준마다 큰 것과 작은 것 중 쓸모 있는 쪽을 앞에 둔다", () => {
    const byDamage = sortItems(db.items, "damage");
    const byArmor = sortItems(db.items, "armor");
    const byWeight = sortItems(db.items, "weight");
    // 공격력과 방어력은 센 것부터, 무게는 가벼운 것부터가 쓸모 있다.
    expect(combatDamage(byDamage[0])).toBeGreaterThan(combatDamage(byDamage[500]));
    expect(byArmor[0].armor).toBeGreaterThan(0);
    expect(byWeight[0].weight).toBeLessThanOrEqual(byWeight[500].weight);
  });

  it("값이 같으면 이름으로 가른다. 아니면 순서가 들쭉날쭉해 보인다", () => {
    // 공격력 0 인 것이 수백 개다. 2 차 기준이 없으면 같은 조건인데도
    // 다시 그릴 때마다 줄이 바뀌는 것처럼 보인다.
    const sorted = sortItems(db.items, "damage");
    const zeros = sorted.filter((i) => combatDamage(i) === 0).slice(0, 20).map((i) => i.ko);
    expect(zeros).toEqual([...zeros].sort((a, b) => a.localeCompare(b, "ko")));
  });

  it("단계가 없는 것은 맨 뒤로 보낸다", () => {
    const sorted = sortItems(db.items, "stage");
    expect(sorted[0].stage).toBe(0);
    expect(sorted[sorted.length - 1].stage).toBe(null);
  });

  it("원본 배열을 건드리지 않는다", () => {
    const before = db.items.map((i) => i.id);
    sortItems(db.items, "damage");
    expect(db.items.map((i) => i.id)).toEqual(before);
  });

  it("모르는 기준은 이름순으로 떨어진다", () => {
    expect(sortItems(db.items, "없는기준")[0].ko)
      .toBe(sortItems(db.items, "name")[0].ko);
  });

  it("정렬 목록의 id 가 모두 다르다", () => {
    expect(new Set(SORTS.map((s) => s.id)).size).toBe(SORTS.length);
  });
});
