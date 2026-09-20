// 무슨 일이 있었나. 습격과 죽음.
//
// 서버 로그에 그대로 찍히는데 그동안 읽고 버렸다. 습격은 접속하기 전에
// 알면 준비하고 들어갈 수 있고, 죽음은 친구들이 제일 잘 볼 기록이다.
//
// 계산은 lib/events.mjs 가 맡고 여기서는 DOM 만 만진다.

import { loadHistory, hasAnything } from "../lib/history-load.mjs";
import { deathRanking, recentRaids, deathsDuring, ago, RAID_WINDOW_MIN } from "../lib/events.mjs";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function paintRaids(hist) {
  const host = el("raid-list");
  const raids = recentRaids(hist, 5);
  if (!raids.length) {
    host.innerHTML = `<p class="ev-empty">아직 습격이 없었습니다.</p>`;
    return;
  }

  host.innerHTML = raids
    .map((r) => {
      // 습격이 끝났다는 줄이 로그에 없다. 그래서 "지금 습격 중" 이라고는
      // 말하지 않는다. 시작한 지 얼마 안 됐으면 그렇다고만 알린다.
      const fresh = Date.now() - Date.parse(r.at) < RAID_WINDOW_MIN * 60 * 1000;
      const victims = deathsDuring(hist, r.at);
      return `<li class="raid${fresh ? " fresh" : ""}">
        <div class="raid-top">
          <span class="raid-n">${esc(r.ko)}</span>
          <span class="raid-t">${esc(ago(r.at))}</span>
        </div>
        ${r.note ? `<p class="raid-note">${esc(r.note)}</p>` : ""}
        ${victims.length
          ? `<p class="raid-v">그 무렵 <b>${esc(victims.join(", "))}</b>이(가) 죽었습니다</p>`
          : ""}
      </li>`;
    })
    .join("");
}

function paintDeaths(hist) {
  const host = el("death-list");
  const week = deathRanking(hist, Date.now() - WEEK_MS);
  if (!week.length) {
    host.innerHTML = `<p class="ev-empty">최근 이레 동안 아무도 죽지 않았습니다.</p>`;
    return;
  }
  const top = week[0].deaths || 1;
  host.innerHTML = week
    .map((p) => `<li>
      <span class="pt-n">${esc(p.name)}</span>
      <span class="pt-bar" aria-hidden="true"><i style="width:${Math.max(6, Math.round((p.deaths / top) * 100))}%"></i></span>
      <span class="pt-v num">${p.deaths}번</span>
    </li>`)
    .join("");
}

async function init() {
  const wrap = el("ev-wrap");
  if (!wrap) return;

  const hist = await loadHistory();
  // 죽음도 습격도 없으면 구역째 감춘다. 빈 목록 두 개는 설명이 되지 않는다.
  if (!hasAnything(hist) || (!(hist.deaths ?? []).length && !(hist.raids ?? []).length)) {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;

  paintRaids(hist);
  paintDeaths(hist);
}

init();
