// 도감의 걸러내기, 정렬, 수치 해석. DOM 을 건드리지 않아 그대로 시험할 수 있다.
//
// 아이템이 1086 개라 손으로 훑을 수 없다. 이름으로 찾고, 진행 단계와
// 종류로 좁히는 두 가지만 있으면 원하는 것에 닿는다.

/** 종류 코드를 한국어 묶음으로 바꾼다. 게임 내부 분류는 21 가지라 너무 잘다. */
export const GROUPS = [
  { id: "weapon", ko: "무기", types: ["OneHandedWeapon", "TwoHandedWeapon", "TwoHandedWeaponLeft", "Bow", "Ammo", "AmmoNonEquipable", "Torch"] },
  { id: "armor", ko: "방어구", types: ["Chest", "Helmet", "Legs", "Shoulder", "Shield", "Utility", "Trinket"] },
  { id: "food", ko: "음식", types: ["Consumable", "Fish"] },
  // Misc 는 열쇠, 알, 밀가루, 안장 같은 것들이다. 도구가 아니라 재료 쪽이
  // 맞다. 도구로 묶으면 "도구" 를 눌렀을 때 망치 옆에 드래곤 알이 나온다.
  { id: "material", ko: "재료", types: ["Material", "Trophy", "Misc"] },
  { id: "tool", ko: "도구", types: ["Tool"] },
  { id: "custom", ko: "겉모습", types: ["Customization"] },
];

const TYPE_TO_GROUP = new Map();
for (const g of GROUPS) for (const t of g.types) TYPE_TO_GROUP.set(t, g.id);

export function groupOf(item) {
  return TYPE_TO_GROUP.get(item.type) ?? "material";
}

export function groupKo(id) {
  return GROUPS.find((g) => g.id === id)?.ko ?? "재료";
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

/**
 * 실제로 무기 노릇을 하는 것의 피해만.
 *
 * 게임 데이터는 모든 아이템에 던졌을 때의 기본 피해를 박아 둔다.
 * 그래서 가죽 투구와 넥의 트로피에도 타격 10 이 들어 있다. 그대로
 * 쓰면 목록에서 투구가 "공격 10" 인 무기처럼 보인다.
 */
export function damagesOf(item) {
  return statCaps(item).has("damage") ? damageList(item) : [];
}

/** 벌목과 곡괭이는 적에게 들어가지 않는다. 공격력 합에서 뺀다. */
const NOT_COMBAT = new Set(["chop", "pickaxe"]);

export function combatDamage(item) {
  return damagesOf(item)
    .filter((d) => !NOT_COMBAT.has(d.key))
    .reduce((a, d) => a + d.value, 0);
}

export const DAMAGE_KO = {
  damage: "기본", blunt: "타격", slash: "베기", pierce: "찌르기",
  chop: "벌목", pickaxe: "곡괭이", fire: "화염", frost: "냉기",
  lightning: "번개", poison: "독", spirit: "정신",
};

/** 피해 종류가 무엇인지 한 줄로. 숫자만 보여 주면 뜻을 알 수 없다. */
export const DAMAGE_NOTE = {
  damage: "종류를 가리지 않는 피해입니다.",
  slash: "검과 도끼가 내는 피해입니다.",
  pierce: "창과 화살이 내는 피해입니다.",
  blunt: "둔기가 내는 피해입니다. 해골과 점액질에게 잘 통합니다.",
  chop: "나무를 벨 때만 쓰입니다. 적에게는 들어가지 않습니다.",
  pickaxe: "광석과 바위를 캘 때만 쓰입니다. 적에게는 들어가지 않습니다.",
  fire: "불 피해입니다. 맞은 뒤에도 잠시 더 탑니다.",
  frost: "냉기 피해입니다. 맞은 적이 잠시 느려집니다.",
  lightning: "번개 피해입니다.",
  poison: "독 피해입니다. 한 번에 들어가지 않고 시간을 두고 깎습니다.",
  spirit: "언데드에게만 들어가는 피해입니다.",
};

/**
 * 어떤 칸이 이 아이템에서 의미가 있는지 고른다.
 *
 * 게임 데이터에는 모든 아이템에 모든 칸이 들어 있고, 쓰이지 않는 칸에는
 * 기본값이 남아 있다. 내구도 100, 방어력 10, 막기 10 이 그것이다. 그대로
 * 내보내면 드래곤 알에 "내구도 100", 나무 방패에 "방어력 100" 이 붙는다.
 * 그 숫자를 보고 무언가를 판단하면 틀린다.
 *
 * 그래서 화이트리스트로 간다. 종류마다 실제로 쓰이는 칸만 적어 둔다.
 */
const CAPS = {
  OneHandedWeapon: ["durability", "block", "damage"],
  TwoHandedWeapon: ["durability", "block", "damage"],
  TwoHandedWeaponLeft: ["durability", "block", "damage"],
  Bow: ["durability", "damage"],
  Ammo: ["damage"],
  AmmoNonEquipable: ["damage"],
  Torch: ["durability", "damage"],
  Shield: ["durability", "block"],
  Chest: ["durability", "armor"],
  Helmet: ["durability", "armor"],
  Legs: ["durability", "armor"],
  Shoulder: ["durability", "armor"],
  Tool: ["durability"],
  Consumable: ["food"],
  Fish: ["food"],
};

export function statCaps(item) {
  const caps = new Set(CAPS[item.type] ?? []);
  // 드베르그 석궁만 Utility 로 분류돼 있으면서 실제 무기다. 종류표로는
  // 잡히지 않으므로 피해가 있는 것만 무기로 쳐 준다.
  if (item.type === "Utility" && damageList(item).length) {
    caps.add("durability");
    caps.add("damage");
  }
  return caps;
}

/**
 * 강화 단계에서 재료가 얼마나 드는지.
 *
 * 게임 공식이다. 1 단계(처음 만들 때)는 amount 그대로, 그 위로는
 * perLevel × (단계 - 1) 이다. 철 검이면 철 20 으로 만들고 2 단계에 10,
 * 3 단계에 20, 4 단계에 30 이 더 든다.
 */
export function materialAmountAt(mat, quality) {
  if (quality <= 1) return mat.amount ?? 0;
  return (mat.perLevel ?? 0) * (quality - 1);
}

/** 단계별 방어력. armor + armorPerLevel × (단계 - 1). */
export function armorAt(item, quality) {
  return (item.armor ?? 0) + (item.armorPerLevel ?? 0) * (Math.max(1, quality) - 1);
}

/**
 * 막대 그래프의 기준이 되는 최댓값. 숫자 하나만 보여 주면 55 가 센지
 * 약한지 알 수 없다. 게임 전체에서 가장 높은 값과 견주게 한다.
 */
export function maxima(items) {
  const out = { damage: {}, armor: 0, food: 0, foodStamina: 0, eitr: 0 };
  for (const it of items) {
    const caps = statCaps(it);
    for (const d of damagesOf(it)) {
      out.damage[d.key] = Math.max(out.damage[d.key] ?? 0, d.value);
    }
    if (caps.has("armor")) out.armor = Math.max(out.armor, it.armor ?? 0);
    if (caps.has("food")) {
      out.food = Math.max(out.food, it.food ?? 0);
      out.foodStamina = Math.max(out.foodStamina, it.foodStamina ?? 0);
      out.eitr = Math.max(out.eitr, it.eitr ?? 0);
    }
  }
  return out;
}

/**
 * 거꾸로 된 목록. "이 재료가 어디에 들어가는가" 다.
 *
 * 나무나 철을 눌렀을 때 정작 궁금한 것이 이것인데, 레시피는 결과물 쪽에만
 * 달려 있어서 그대로는 알 수 없다. 한 번 훑어 표를 만들어 둔다.
 *
 * @returns {Map<string, {id: string, via: "recipe"|"conversion"}[]>}
 */
export function usedByIndex(items) {
  const m = new Map();
  const add = (matId, id, via) => {
    if (!m.has(matId)) m.set(matId, []);
    m.get(matId).push({ id, via });
  };
  for (const it of items) {
    for (const mat of it.recipe?.materials ?? []) add(mat.item, it.id, "recipe");
    if (it.conversion?.from) add(it.conversion.from, it.id, "conversion");
  }
  return m;
}
