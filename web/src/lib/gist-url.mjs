// Gist 상태 파일을 읽을 URL 을 만든다. 순수 함수다.
//
// 왜 api.github.com 이 아니라 raw 호스트를 쓰는가.
//
// GitHub REST API 는 비인증 요청을 IP 당 시간당 60회로 제한한다. 실측으로
// 확인했다. 친구가 이 페이지를 띄워두면 30초 주기로도 시간당 120회가 되어
// 30분쯤 뒤부터 403 이 떨어지고 상태가 "상태 확인 불가" 로 굳는다.
// 하필 이 화면의 주 용도가 "서버 켜졌나 보려고 띄워두는 것" 이라,
// 가장 필요한 순간에 죽는다.
//
// gist.githubusercontent.com 은 정적 콘텐츠로 서빙되어 그 제한을 받지
// 않는다. Access-Control-Allow-Origin 이 * 라 브라우저에서 바로 읽을 수도
// 있다. 둘 다 실측으로 확인했다.
//
// 대신 이쪽은 Cache-Control: max-age=300 이 붙는다. 5분 캐시는 우리
// 신선도 임계값(STALE_LIMIT_SEC 180초)보다 길어서, 캐시된 응답을 그대로
// 받으면 서버가 켜져 있는데도 "서버 꺼짐" 으로 표시된다. 그래서 매 요청에
// 고유한 쿼리를 붙여 캐시 키를 다르게 만든다. 붙이면 X-Cache: MISS,
// 안 붙이면 HIT 이 나오는 것까지 실측했다.
//
// 이 파일을 고치려는 다음 사람에게: api.github.com 으로 되돌리지 마라.
// 코드는 더 짧아지지만 30분 뒤에 죽는다. 테스트가 그것을 막고 있다.

const RAW_HOST = "https://gist.githubusercontent.com";

/**
 * @param {string} owner Gist 를 소유한 GitHub 사용자명
 * @param {string} id Gist id (32자리)
 * @param {string} file Gist 안의 파일 이름
 * @param {number} nowMs 캐시 무력화에 쓸 현재 시각. 호출부가 넘긴다
 * @returns {string|null} 조회할 URL. 필요한 값이 비어 있으면 null
 */
export function buildGistRawUrl(owner, id, file, nowMs) {
  if (!owner || !id || !file) return null;

  const path = [owner, id, "raw", file].map(encodeURIComponent).join("/");
  return `${RAW_HOST}/${path}?t=${nowMs}`;
}
