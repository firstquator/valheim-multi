// 도감의 걸러내기와 정렬. DOM 을 건드리지 않아 그대로 시험할 수 있다.
//
// 아이템이 1070 개라 손으로 훑을 수 없다. 이름으로 찾고, 진행 단계와
// 종류로 좁히는 두 가지만 있으면 원하는 것에 닿는다.

/** 종류 코드를 한국어 묶음으로 바꾼다. 게임 내부 분류는 21 가지라 너무 잘다. */
export const GROUPS = [
  { id: "weapon", ko: "무기", types: ["OneHandedWeapon", "TwoHandedWeapon", "TwoHandedWeaponLeft", "Bow", "Ammo", "AmmoNonEquipable", "Torch"] },
  { id: "armor", ko: "방어구", types: ["Chest", "Helmet", "Legs", "Shoulder", "Shield", "Utility", "Trinket"] },
  { id: "food", ko: "음식", types: ["Consumable", "Fish"] },
  { id: "material", ko: "재료", types: ["Material", "Trophy"] },
  { id: "tool", ko: "도구", types: ["Tool", "Misc"] },
  { id: "custom", ko: "겉모습", types: ["Customization"] },
];

const TYPE_TO_GROUP = new Map();
for (const g of GROUPS) for (const t of g.types) TYPE_TO_GROUP.set(t, g.id);

export function groupOf(item) {
  return TYPE_TO_GROUP.get(item.type) ?? "material";
}

/**
 * 검색에 쓰려고 문자열을 다듬는다. 소문자로 바꾸고 공백을 모두 없앤다.
 *
 * 공백을 없애는 것이 요점이다. 게임의 공식 이름은 "철 검", "나무 대형
 * 방패" 처럼 띄어 쓰는데, 찾는 사람은 "철검" 이라고 붙여 친다. 그대로
 * 비교하면 한 글자도 안 맞아 0 개가 나온다.
 */
function norm(s) {
  return String(s ?? "").toLowerCase().replace(/\s+/g, "");
}

/**
 * 검색어를 아이템 하나에 맞춰 본다.
 *
 * 한국어 이름, 영어 이름, prefab 이름을 모두 본다. 친구들은 한국어로
 * 찾지만, 모드나 콘솔에서 본 영어 이름으로 찾는 경우도 있다.
 */
export function matchesQuery(item, q) {
  const n = norm(q);
  if (!n) return true;
  return (
    norm(item.ko).includes(n) ||
    norm(item.en).includes(n) ||
    norm(item.id).includes(n)
  );
}

/**
 * @param {object[]} items
 * @param {{q?: string, stage?: number|null, group?: string|null}} filter
 */
export function filterItems(items, filter = {}) {
  const { q = "", stage = null, group = null } = filter;
  return items.filter((it) => {
    if (stage !== null && it.stage !== stage) return false;
    if (group !== null && groupOf(it) !== group) return false;
    return matchesQuery(it, q);
  });
}

/** 데미지 항목 중 0 이 아닌 것만, 큰 것부터. */
export function damageList(item) {
  const d = item.damages || {};
  return Object.entries(d)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ key: k.replace(/^m_/, ""), value: v }));
}

export const DAMAGE_KO = {
  damage: "기본", blunt: "타격", slash: "베기", pierce: "찌르기",
  chop: "벌목", pickaxe: "곡괭이", fire: "화염", frost: "냉기",
  lightning: "번개", poison: "독", spirit: "정신",
};
