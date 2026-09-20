// 모드팩 변경 이력을 화면에 쓸 모양으로 바꾼다.
//
// 값은 data/mods.json 의 modpack.changes 에서 온다. 맨 앞이 최신이라는
// 전제로 쓰는데, 그 정렬은 mods-schema.mjs 가 빌드 때 검사한다.

/**
 * "2026-09-19" 를 "2026년 9월 19일" 로 바꾼다.
 *
 * 앞의 0 을 떼는 것이 요점이다. 문자열을 그대로 이어 붙이면 "09월 19일" 이
 * 되는데, 한국어로 날짜를 읽을 때 쓰지 않는 표기다.
 *
 * Date 로 파싱하지 않는다. "2026-09-19" 는 UTC 자정으로 읽히므로 한국
 * 시간대에서 하루 앞선 날짜가 나온다.
 */
export function formatChangeDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${y}년 ${Number(mo)}월 ${Number(d)}일`;
}

/**
 * 화면이 필요로 하는 것만 추려 낸다.
 *
 * - `latest`      맨 위에 크게 보여줄 최신 변경
 * - `mustUpdate`  최신 변경이 전원 재설치를 요구하는가
 * - `older`       접어 둘 지난 이력
 *
 * 이력이 없으면 `latest` 가 null 이고 화면은 이 블록을 통째로 감춘다.
 * 아직 한 번도 갱신하지 않은 상태라 알릴 것이 없다.
 */
export function summarizeChanges(changes) {
  const list = Array.isArray(changes) ? changes : [];
  const latest = list[0] ?? null;
  return {
    latest,
    // 명시적으로 true 일 때만 강조한다. 값이 빠졌을 때 "업데이트해야 한다"
    // 로 읽히면 친구가 매번 헛걸음한다.
    mustUpdate: latest?.mustUpdate === true,
    older: list.slice(1),
  };
}

/**
 * 마지막으로 전원이 파일을 다시 받아야 했던 날.
 *
 * 최신 변경만 보면 안 된다. 어제 서버 설정만 고쳤다면 최신 변경은
 * mustUpdate 가 아니지만, 그 전주에 모드를 추가했다면 아직 안 받은
 * 사람은 여전히 받아야 한다.
 *
 * 목록은 맨 앞이 최신이라는 전제로 쓴다. 그 정렬은 mods-schema.mjs 가
 * 빌드할 때 검사한다.
 */
export function lastRequiredDate(changes) {
  const list = Array.isArray(changes) ? changes : [];
  return list.find((c) => c?.mustUpdate === true)?.date ?? null;
}

/**
 * 이 브라우저가 받아 둔 파일이 아직 쓸 만한가.
 *
 * 서버는 친구 PC 에 무엇이 깔려 있는지 알 수 없다. 그래서 "받기" 를
 * 누른 날을 브라우저에 적어 두고 그것과 견준다. 서버가 알 필요가 없다.
 *
 * 날짜는 "2026-09-19" 꼴이라 문자열끼리 견줘도 순서가 맞는다.
 *
 * @param {string|null} gotDate 이 브라우저가 받은 파일의 기준 날짜
 * @param {string|null} requiredDate 마지막으로 다시 받아야 했던 날
 * @returns {"unknown"|"fresh"|"stale"} 받은 적 없음 / 최신 / 다시 받아야 함
 */
export function freshness(gotDate, requiredDate) {
  if (!gotDate) return "unknown";
  if (!requiredDate) return "fresh";
  return gotDate >= requiredDate ? "fresh" : "stale";
}
