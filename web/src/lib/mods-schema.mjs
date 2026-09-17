// mods.json 검증. 외부 라이브러리를 쓰지 않는다.
// 필드가 몇 개뿐이라 직접 검사하는 편이 의존성을 줄인다.

const REQUIRED = ["id", "owner", "version", "tier", "name", "summary", "usage", "thunderstoreUrl"];
const TIERS = [1, 2, 3];

export function validateMods(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { ok: false, errors: ["데이터가 객체가 아닙니다"] };
  }
  if (data.schemaVersion !== 1) {
    errors.push(`schemaVersion 은 1 이어야 합니다 (받은 값: ${data.schemaVersion})`);
  }
  if (!Array.isArray(data.mods)) {
    return { ok: false, errors: [...errors, "mods 는 배열이어야 합니다"] };
  }

  const seen = new Set();
  data.mods.forEach((m, i) => {
    const at = `mods[${i}]`;
    for (const f of REQUIRED) {
      if (m[f] === undefined || m[f] === null || m[f] === "") {
        errors.push(`${at}.${f} 가 없습니다`);
      }
    }
    if (!TIERS.includes(m.tier)) {
      errors.push(`${at}.tier 는 1, 2, 3 중 하나여야 합니다 (받은 값: ${m.tier})`);
    }
    if (!Array.isArray(m.warnings)) {
      errors.push(`${at}.warnings 는 배열이어야 합니다`);
    }
    if (seen.has(m.id)) {
      errors.push(`${at}.id 가 중복입니다: ${m.id}`);
    }
    seen.add(m.id);
  });

  return errors.length ? { ok: false, errors } : { ok: true };
}
