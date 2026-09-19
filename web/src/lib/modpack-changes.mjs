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
