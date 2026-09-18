// 모드 카드에 붙일 아이콘을 모드 이름에서 고른다.
//
// data/mods.json 은 다른 사람이 계속 고친다. 모드마다 아이콘 이름을 손으로
// 적어 두면 모드가 추가될 때마다 그 파일을 또 고쳐야 한다. 그래서 이름과
// 설명에서 키워드를 찾아 고르고, 못 찾으면 기본 아이콘으로 떨어진다.
//
// 여기 적힌 아이콘 이름은 전부 @hugeicons/static 에 실제로 있는 파일이다.
// 없는 이름을 넣으면 빌드가 실패한다. 추가할 때 파일 존재를 먼저 확인해라.

export const DEFAULT_MOD_ICON = "package-02";

// 위에 있는 규칙이 먼저 이긴다. 더 구체적인 키워드를 위에 둔다.
const RULES = [
  { icon: "backpack-03", keys: ["inventory", "slot", "equipment", "quickslot", "backpack", "인벤", "슬롯", "장비"] },
  { icon: "plant-02", keys: ["plant", "farm", "seed", "crop", "grow", "pickable", "재배", "농사", "씨앗", "수확"] },
  { icon: "fire", keys: ["smelt", "kiln", "furnace", "fuel", "autoprocess", "process", "제련", "가마", "연료"] },
  { icon: "archive-02", keys: ["container", "chest", "storage", "stack", "상자", "보관", "적재"] },
  { icon: "sword-01", keys: ["combat", "damage", "enemy", "monster", "weapon", "boss", "전투", "피해", "무기"] },
  { icon: "boat", keys: ["ship", "boat", "sail", "karve", "longship", "선박", "항해"] },
  { icon: "map-pinpoint-01", keys: ["map", "pin", "marker", "portal", "teleport", "지도", "포탈", "이동"] },
  { icon: "wrench-01", keys: ["build", "craft", "hammer", "plan", "piece", "건축", "제작", "설계"] },
  { icon: "layout-01", keys: ["hud", "ui", "display", "clock", "compass", "화면", "표시", "시계"] },
  { icon: "message-01", keys: ["chat", "emote", "message", "채팅", "대화"] },
  { icon: "user-group", keys: ["player", "friend", "party", "group", "접속자", "동료"] },
  { icon: "server-stack-01", keys: ["server", "serverside", "framework", "core", "bepinex", "서버", "토대", "프레임워크"] },
  { icon: "sliders-horizontal", keys: ["config", "tweak", "setting", "balance", "설정", "조정", "균형"] },
];

/**
 * 모드 하나에 어울리는 아이콘 이름을 돌려준다.
 * 매칭에 쓰는 문자열은 id, name, summary 를 이어 붙인 것이다.
 *
 * @param {{id?: string, name?: string, summary?: string}} mod
 * @returns {string} @hugeicons/static 의 아이콘 파일 이름 (확장자 제외)
 */
export function pickModIcon(mod) {
  if (!mod || typeof mod !== "object") return DEFAULT_MOD_ICON;

  const haystack = [mod.id, mod.name, mod.summary]
    .filter((s) => typeof s === "string")
    .join(" ")
    .toLowerCase();

  if (!haystack) return DEFAULT_MOD_ICON;

  for (const rule of RULES) {
    if (rule.keys.some((k) => haystack.includes(k))) return rule.icon;
  }
  return DEFAULT_MOD_ICON;
}
