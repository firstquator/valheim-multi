import { judgeStatus, formatAge } from "../lib/status.mjs";
import { GIST_ID, GIST_FILE } from "../config.mjs";

// fetch 와 DOM 갱신만 한다. 판정은 status.mjs 가 맡는다.

async function loadStatus() {
  if (!GIST_ID) return null;
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: { Accept: "application/vnd.github+json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const gist = await res.json();
    const raw = gist.files?.[GIST_FILE]?.content;
    return raw ? JSON.parse(raw) : null;
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
}

async function tick() {
  render(judgeStatus(await loadStatus(), Date.now()));
}

tick();
setInterval(tick, 30_000);
