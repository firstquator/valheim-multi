import { judgeStatus, formatAge } from "../lib/status.mjs";
import { buildGistRawUrl } from "../lib/gist-url.mjs";
import { GIST_ID, GIST_FILE, GIST_OWNER, POLL_INTERVAL_MS } from "../config.mjs";

// fetch 와 DOM 갱신만 한다. 판정은 status.mjs 가 맡는다.

async function loadStatus() {
  // URL 을 못 만들면 아직 사용자가 GIST_ID 를 채우지 않은 상태다.
  const url = buildGistRawUrl(GIST_OWNER, GIST_ID, GIST_FILE, Date.now());
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    // raw 호스트는 파일 내용을 그대로 준다. API 응답처럼 감싸여 있지 않다.
    return await res.json();
  } catch {
    return null;
  }
}

function render(judged) {
  const badge = document.getElementById("status-badge");
  const age = document.getElementById("status-age");
  const list = document.getElementById("player-list");
  const wrap = document.getElementById("player-wrap");
  const ver = document.getElementById("game-version");
  if (!badge) return;

  // status-badge 는 aria-live="polite" 영역이다. 값이 안 바뀌었는데도
  // textContent 를 다시 대입하면 스크린리더가 매 30초 틱마다 같은 문장을
  // 또 읽어줄 수 있다. 실제로 바뀔 때만 쓴다.
  if (badge.textContent !== judged.label) badge.textContent = judged.label;
  if (badge.dataset.state !== judged.state) badge.dataset.state = judged.state;
  if (age) age.textContent = formatAge(judged.ageSec);

  // 게임 버전을 마크업에 박아두면 서버가 업데이트될 때 틀린 안내가 된다.
  // 버전 불일치는 접속 실패의 가장 흔한 원인이라 정확해야 한다.
  if (ver && judged.gameVersion) ver.textContent = judged.gameVersion;

  if (list) {
    list.textContent = judged.players.length ? judged.players.join(" · ") : "";
    list.hidden = judged.players.length === 0;
  }
  // 아무도 없으면 접속자 영역 자체를 숨긴다. 빈 제목만 남으면 어색하다.
  if (wrap) wrap.hidden = judged.players.length === 0;

  const backup = document.getElementById("backup-at");
  if (backup) {
    const at = judged.backupAt;
    const text = at ? new Date(at).toLocaleString("ko-KR") : "확인 불가";
    if (backup.textContent !== text) backup.textContent = text;
  }

  // 공인 IP 는 유동이라 빌드 시점에 config.mjs 에 박아둔 주소가 틀릴 수
  // 있다. Gist 에서 최신 주소가 오면 화면과 복사 버튼을 함께 갱신한다.
  // judged.address 가 없으면(Gist 미설정, 응답 실패, 필드 누락) 아무것도
  // 하지 않아 정적으로 렌더된 config.mjs 의 주소가 폴백으로 남는다.
  if (judged.address) {
    const addrValue = document.getElementById("server-address-value");
    const addrCopy = document.getElementById("server-address-copy");
    if (addrValue && addrValue.textContent !== judged.address) {
      addrValue.textContent = judged.address;
    }
    if (addrCopy && addrCopy.dataset.copy !== judged.address) {
      addrCopy.dataset.copy = judged.address;
    }
  }
}

async function tick() {
  render(judgeStatus(await loadStatus(), Date.now()));
}

tick();
setInterval(tick, POLL_INTERVAL_MS);
