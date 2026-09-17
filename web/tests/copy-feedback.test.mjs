import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createCopyFeedback } from "../src/lib/copy-feedback.mjs";

// DOM 을 흉내 낸 최소한의 스텁. applyLabel 은 라벨 이력을,
// applyDoneClass 는 done 상태 이력을 그대로 기록한다.
function makeHarness(defaultLabel) {
  const labels = [defaultLabel];
  const doneStates = [];
  const feedback = createCopyFeedback({
    defaultLabel,
    applyLabel: (text) => labels.push(text),
    applyDoneClass: (on) => doneStates.push(on),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (id) => clearTimeout(id),
  });
  return { feedback, labels, doneStates };
}

describe("createCopyFeedback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("한 번 누르면 라벨이 바뀌었다가 정해진 시간 뒤 원래 라벨로 돌아온다", () => {
    const { feedback, labels } = makeHarness("복사");
    feedback.show("복사됨", 1400, { done: true });
    expect(labels.at(-1)).toBe("복사됨");

    vi.advanceTimersByTime(1400);
    expect(labels.at(-1)).toBe("복사");
  });

  it("연타해도(1.4초 안에 두 번) 최종 라벨은 항상 고정된 기본 라벨로 돌아온다", () => {
    // 회귀 테스트: 이전 구현은 클릭 시점의 DOM 텍스트를 "원래 라벨"로 캡처했다.
    // 첫 타이머가 끝나기 전에 두 번째 클릭이 들어오면, 그 시점엔 이미
    // 라벨이 "복사됨"으로 바뀐 상태라 두 번째 클릭이 "복사됨"을 원래
    // 라벨로 착각해서 영구히 "복사됨"에 고정되는 버그가 있었다.
    const { feedback, labels } = makeHarness("복사");

    feedback.show("복사됨", 1400, { done: true }); // 1번째 클릭 (t=0, 1400ms 뒤 되돌리기 예약)
    vi.advanceTimersByTime(700); // t=700, 첫 타이머가 끝나기 전에
    feedback.show("복사됨", 1400, { done: true }); // 2번째 클릭 (연타, t=700, 되돌리기가 t=2100 으로 밀린다)

    // 1번째 타이머가 원래 발화했을 시각(t=1400)이 지나도 취소됐으므로
    // 아무 일도 일어나지 않아야 한다. 2번째 타이머(t=2100)도 아직이다.
    vi.advanceTimersByTime(699); // t=1399
    expect(labels.at(-1)).toBe("복사됨");

    // 2번째 타이머가 끝나는 시점(t=2100)에는 반드시 기본 라벨로 돌아와야 한다.
    vi.advanceTimersByTime(701); // t=2100
    expect(labels.at(-1)).toBe("복사");

    // 그 뒤로 추가 타이머가 남아있지 않아야 한다 (라벨이 다시 바뀌지 않는다).
    vi.advanceTimersByTime(10_000);
    expect(labels.at(-1)).toBe("복사");
  });

  it("이전 타이머를 취소하지 않으면 실패하는 회귀 테스트: 살아있는 타이머는 하나뿐이다", () => {
    const { feedback, labels } = makeHarness("복사");

    feedback.show("복사됨", 1400, { done: true });
    vi.advanceTimersByTime(1000);
    feedback.show("복사됨", 1400, { done: true }); // 연타

    // 첫 번째 타이머가 취소되지 않았다면 1000 + 400 = 1400ms 시점에
    // 한 번 더 "복사"로 되돌리기가 실행되어 labels 배열에 항목이 추가된다.
    const lengthBeforeFirstDeadline = labels.length;
    vi.advanceTimersByTime(400);
    expect(labels.length).toBe(lengthBeforeFirstDeadline);
  });

  it("클릭 시점이 아니라 컨트롤러 생성 시점의 라벨로만 되돌아간다", () => {
    // defaultLabel 은 생성자 인자로 한 번만 고정된다. show() 를 아무리 호출해도
    // "지금 화면에 보이는 텍스트"를 다시 읽어서 되돌릴 값으로 삼지 않는다.
    const { feedback, labels } = makeHarness("복사");

    feedback.show("복사됨", 1400, { done: true });
    vi.advanceTimersByTime(1400);
    expect(labels.at(-1)).toBe("복사");

    feedback.show("선택됨, 직접 복사하세요", 2000);
    vi.advanceTimersByTime(2000);
    expect(labels.at(-1)).toBe("복사");
  });

  it("done 상태는 되돌릴 때 항상 꺼진다", () => {
    const { feedback, doneStates } = makeHarness("복사");
    feedback.show("복사됨", 1400, { done: true });
    expect(doneStates.at(-1)).toBe(true);

    vi.advanceTimersByTime(1400);
    expect(doneStates.at(-1)).toBe(false);

    // done 옵션을 주지 않은 실패 경로도 되돌릴 때 false 로 정리된다.
    feedback.show("선택됨, 직접 복사하세요", 2000);
    expect(doneStates.at(-1)).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(doneStates.at(-1)).toBe(false);
  });
});
