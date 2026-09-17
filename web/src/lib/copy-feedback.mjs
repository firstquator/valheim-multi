// 복사 버튼의 "복사됨" 표시를 관리하는 순수 로직만 담는다.
// DOM 을 직접 만지지 않고 주입받은 함수를 통해서만 바깥과 통신한다.
// 그래야 브라우저 없이도 연타(더블클릭) 시나리오를 테스트할 수 있다.
//
// 핵심 버그 두 가지를 막기 위한 설계다.
// 1) 되돌릴 라벨을 클릭 시점의 DOM 에서 읽으면, 첫 번째 타이머가 끝나기 전에
//    다시 클릭했을 때 이미 "복사됨"으로 바뀐 텍스트를 "원래 라벨"로 착각해서
//    영구히 "복사됨"에 고정된다. 그래서 defaultLabel 은 생성 시점에 한 번만
//    고정해서 재사용한다.
// 2) 이전 타이머를 취소하지 않으면 연타 시 여러 타이머가 동시에 살아서
//    서로 다른 시점에 되돌리기를 실행한다. 그래서 새 타이머를 걸기 전에
//    항상 이전 타이머를 취소한다.

/**
 * @param {object} deps
 * @param {string} deps.defaultLabel 되돌아갈 고정 라벨. 클릭 시점 DOM 이 아니라
 *   컨트롤러를 만들 때 한 번만 캡처한 값이어야 한다.
 * @param {(text: string) => void} deps.applyLabel 라벨 텍스트를 반영한다.
 * @param {(on: boolean) => void} deps.applyDoneClass 성공 강조 스타일을 켜고 끈다.
 * @param {(fn: () => void, ms: number) => unknown} deps.setTimer
 * @param {(id: unknown) => void} deps.clearTimer
 */
export function createCopyFeedback({ defaultLabel, applyLabel, applyDoneClass, setTimer, clearTimer }) {
  let timerId = null;

  /**
   * 피드백 라벨을 보여주고 durationMs 뒤 고정된 defaultLabel 로 되돌린다.
   * 이미 대기 중인 되돌리기 타이머가 있으면 반드시 먼저 취소한다.
   * @param {string} label
   * @param {number} durationMs
   * @param {{ done?: boolean }} [options]
   */
  function show(label, durationMs, { done = false } = {}) {
    clearTimer(timerId);
    applyLabel(label);
    applyDoneClass(done);
    timerId = setTimer(() => {
      applyLabel(defaultLabel);
      applyDoneClass(false);
      timerId = null;
    }, durationMs);
  }

  return { show };
}
