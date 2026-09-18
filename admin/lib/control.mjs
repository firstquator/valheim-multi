// 서버 제어 요청을 받아들일지 판정한다. 순수 함수다.
//
// 이 판정이 이 패널에서 가장 위험한 부분이다. 잘못 통과시키면 플레이 중인
// 사람이 말없이 끊기거나, 월드를 저장하는 중에 컨테이너가 죽는다.
// 그래서 도커 호출과 분리해 테스트할 수 있게 뽑아 두었다.

export const ACTIONS = ["start", "stop", "restart"];

/** 접속자를 끊을 수 있는 동작. 시작은 아무도 끊지 않는다. */
export const DESTRUCTIVE = ["stop", "restart"];

/**
 * @param {object} args
 * @param {string} args.action start | stop | restart
 * @param {object} args.body 요청 본문
 * @param {number} args.playerCount 현재 접속자 수
 * @param {boolean} args.jobRunning 이미 도는 작업이 있는가
 * @returns {{allow: boolean, status: number, reason?: string, needsPlayerConfirm?: boolean}}
 */
export function decideControl({ action, body = {}, playerCount = 0, jobRunning = false }) {
  if (!ACTIONS.includes(action)) {
    return { allow: false, status: 404, reason: "알 수 없는 동작이다" };
  }

  // 동시에 두 개를 돌리면 도커가 서로를 덮는다.
  if (jobRunning) {
    return { allow: false, status: 409, reason: "이미 진행 중인 작업이 있다" };
  }

  // 확인 없이는 어떤 제어도 실행하지 않는다. 읽기 요청과 달리 되돌릴 수 없다.
  if (body.confirm !== true) {
    return { allow: false, status: 400, reason: "확인이 필요하다" };
  }

  if (DESTRUCTIVE.includes(action) && playerCount > 0 && body.confirmPlayers !== true) {
    // 사람이 플레이 중이다. 한 번 더 묻는다.
    return {
      allow: false,
      status: 409,
      reason: "접속자가 있다",
      needsPlayerConfirm: true,
    };
  }

  return { allow: true, status: 202 };
}
