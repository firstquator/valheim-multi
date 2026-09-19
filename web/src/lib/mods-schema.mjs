// mods.json 검증. 외부 라이브러리를 쓰지 않는다.
// 필드가 몇 개뿐이라 직접 검사하는 편이 의존성을 줄인다.

const REQUIRED = ["id", "owner", "version", "tier", "name", "summary", "usage", "thunderstoreUrl"];
const TIERS = [1, 2, 3];

/**
 * 모드팩 변경 이력을 검사한다.
 *
 * 이 배열은 친구에게 "지금 받은 파일이 최신인가" 를 알리는 유일한 근거다.
 * 날짜가 뒤섞여 있으면 맨 앞이 최신이라는 전제가 깨져 화면에 옛날 변경이
 * 최신인 것처럼 뜬다. 그래서 최신순 정렬까지 검사한다.
 *
 * 이력이 아예 없는 것은 정상이다. 아직 한 번도 갱신하지 않은 상태다.
 */
function validateChanges(changes) {
  const errors = [];
  if (changes === undefined) return errors;
  if (!Array.isArray(changes)) {
    return ["modpack.changes 는 배열이어야 합니다"];
  }

  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  changes.forEach((c, i) => {
    const at = `modpack.changes[${i}]`;
    if (!DATE.test(c?.date ?? "")) {
      errors.push(`${at}.date 는 YYYY-MM-DD 형식이어야 합니다 (받은 값: ${c?.date})`);
    }
    if (!c?.summary) {
      errors.push(`${at}.summary 가 없습니다`);
    }
    if (typeof c?.mustUpdate !== "boolean") {
      errors.push(`${at}.mustUpdate 는 true 또는 false 여야 합니다 (받은 값: ${c?.mustUpdate})`);
    }
    // 날짜 문자열이 YYYY-MM-DD 라 사전순 비교가 곧 날짜순 비교다.
    if (i > 0 && DATE.test(c?.date ?? "") && DATE.test(changes[i - 1]?.date ?? "")) {
      if (c.date > changes[i - 1].date) {
        errors.push(`${at}.date 가 앞 항목보다 뒤입니다. 최신순으로 적어야 합니다`);
      }
    }
  });
  return errors;
}

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

  errors.push(...validateChanges(data.modpack?.changes));

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
