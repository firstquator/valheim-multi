// "당신은 파일을 다시 받아야 합니다" 를 사람마다 다르게 말해 준다.
//
// index.astro 에 이런 주석이 있었다.
//
//   서버는 친구 PC 에 무엇이 깔려 있는지 알 수 없으므로 화면이 개인별로
//   "당신은 업데이트가 필요합니다" 라고 말해 줄 방법이 없다.
//
// 서버가 알 필요가 없다. 받기 단추를 누른 날을 이 브라우저에 적어 두고
// 모드팩이 마지막으로 바뀐 날과 견주면 된다. 아무것도 서버로 가지 않는다.
//
// 틀릴 수 있는 경우가 둘 있고, 둘 다 안전한 쪽으로 틀린다.
//   - 다른 기기나 다른 브라우저에서 받았으면 "받은 적 없음" 으로 나온다.
//   - 파일만 받고 r2modman 에 넣지 않았어도 "받음" 으로 나온다.
// 그래서 단정하지 않고 "받으신 기록" 이라고만 쓴다.

import { freshness } from "../lib/modpack-changes.mjs";

const KEY = "gaybar.modpack.got.v1";

const el = (id) => document.getElementById(id);

function read() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return v && typeof v.date === "string" ? v : null;
  } catch {
    // 시크릿 창이나 저장소를 막아 둔 브라우저에서는 읽기부터 던진다.
    return null;
  }
}

function write(date) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ date, at: new Date().toISOString() }));
  } catch {
    /* 저장이 안 되어도 나머지는 그대로 돌아간다 */
  }
}

/** "2026-09-19" 를 "9월 19일" 로. 연도는 카드 안에 이미 있다. */
function shortDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? `${Number(m[2])}월 ${Number(m[3])}일` : "";
}

function paint() {
  const box = el("upd-you");
  if (!box) return;

  // 마지막으로 전원이 다시 받아야 했던 날. 빌드할 때 박아 둔다.
  const required = box.dataset.required || null;
  const latest = box.dataset.latest || null;
  const got = read();
  const state = freshness(got?.date ?? null, required);

  const badge = el("upg-badge");
  box.dataset.state = state;
  box.hidden = false;

  if (state === "unknown") {
    box.textContent = "이 브라우저에서 파일을 받은 기록이 없습니다. 처음이시라면 아래 설치 가이드를 보세요.";
    if (badge) badge.hidden = true;
    return;
  }

  if (state === "stale") {
    box.textContent = `${shortDate(got.date)} 기준 파일을 받으셨습니다. 그 뒤 ${shortDate(required)}에 모드팩이 바뀌었으니 다시 받으세요.`;
    if (badge) {
      badge.hidden = false;
      badge.dataset.state = "stale";
      badge.textContent = "다시 받아야 합니다";
    }
    return;
  }

  box.textContent = latest && got.date < latest
    ? `${shortDate(got.date)} 기준 파일을 갖고 계십니다. 그 뒤의 변경은 서버에서만 처리되어 다시 받지 않아도 됩니다.`
    : `${shortDate(got.date)} 기준 파일을 갖고 계십니다. 최신입니다.`;
  if (badge) {
    badge.hidden = false;
    badge.dataset.state = "fresh";
    badge.textContent = "최신입니다";
  }
}

function init() {
  const box = el("upd-you");
  if (!box) return;

  // 받기 단추는 서버 탭과 설치 가이드 두 곳에 있다. 어느 쪽을 눌러도
  // 같은 파일이므로 한 번에 잡는다.
  document.addEventListener("click", (e) => {
    const link = e.target.closest("a.dl[download]");
    if (!link) return;
    write(box.dataset.latest || new Date().toISOString().slice(0, 10));
    // 내려받기가 시작된 뒤에 다시 그린다. 같은 프레임에서 그리면
    // 브라우저가 내려받기를 취소하는 경우가 있다.
    setTimeout(paint, 0);
  });

  paint();
}

init();
