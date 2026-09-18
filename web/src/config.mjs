// 상태를 올려둘 시크릿 Gist 의 id 다. 이미 만들어 채워 두었다.
// 파일 이름은 valheim-status.json 이고 초기 내용은 빈 객체다.
//
// 다른 Gist 로 바꾸려면 https://gist.github.com 에서 새로 만든 뒤
// 그 페이지 URL 의 마지막 32자리를 여기에 넣고 GIST_OWNER 도 맞춘다.
//
// 퍼블리셔(agent/status-publisher.mjs)가 이 Gist 를 갱신하려면
// 토큰이 따로 필요하다. 토큰 발급과 상시 실행 방법은
// docs/guides/status-publisher-setup.md 를 본다.
//
// 이 값은 공개되어도 된다. Gist 는 읽기 전용으로만 노출되고,
// 갱신에 필요한 토큰은 이 저장소가 아니라 agent/.env 안, PC 에만 있다.
//
// 빈 값이면 LiveStatus 가 조회를 건너뛰고 "상태 확인 불가" 로 조용히
// 수렴한다. 값을 채우기 전까지 사이트가 깨지면 안 되므로 이 동작을
// 그대로 둔다.
export const GIST_ID = "99ad1fdb3291cb2d354f1b8cd37e8732";
export const GIST_FILE = "valheim-status.json";

// Gist 를 소유한 GitHub 사용자명. 조회 URL 경로에 들어간다.
// 비밀이 아니고 저장소 remote 에서 이미 드러나는 값이라 미리 채워 둔다.
// 다른 계정의 Gist 를 쓰려면 이 값도 함께 바꾼다.
export const GIST_OWNER = "firstquator";

// 상태 조회 주기.
//
// 퍼블리셔가 30초마다 올리므로 60초로 읽어도 화면에 보이는 값의 나이는
// 최대 90초 안쪽이다. 신선도 임계값(status.mjs 의 STALE_LIMIT_SEC)이
// 180초라 여유가 있다. 요청 수는 절반이 된다.
//
// 이 값을 줄이기 전에 web/src/lib/gist-url.mjs 의 주석을 읽어라.
export const POLL_INTERVAL_MS = 60_000;

// 접속 정보. 비밀번호는 Gist 에 올리지 않고 여기에만 둔다.
export const SERVER = {
  address: "182.230.196.27:2456",
  password: "159159",
};
