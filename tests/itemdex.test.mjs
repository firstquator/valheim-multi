import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { filterItems, matchesQuery, groupOf, damageList, GROUPS } from "../web/src/lib/itemdex.mjs";

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
