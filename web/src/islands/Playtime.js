// 접속 기록. "지금 들어가면 사람 있나" 에 답한다.
//
// 이 화면의 주 용도가 그것이다. 지금 몇 명인지는 위 상태 뱃지가
// 알려 주지만, 아무도 없을 때 "그럼 언제 오나" 는 알 수 없었다.
//
// 자료는 agent/status-publisher.mjs 가 30 초마다 시간 단위로 접어 쌓은
// 것이다. 계산은 lib/playtime.mjs 가 맡고 여기서는 DOM 만 만진다.

import { loadHistory, hasAnything } from "../lib/history-load.mjs";
import { heatmap, playerTotals, span, formatMinutes, DAY_KO } from "../lib/playtime.mjs";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** 두 시각 사이를 "오후 9시" 처럼. 24 시간제는 한눈에 안 들어온다. */
function hourLabel(h) {
  if (h === 0) return "밤 12시";
  if (h < 12) return `오전 ${h}시`;
  if (h === 12) return "낮 12시";
  return `오후 ${h - 12}시`;
}

function paintHeat(hist) {
  const { cells, max, busiest } = heatmap(hist);
  const host = el("heat-grid");

  // 세 시간씩 묶어 눈금을 단다. 24 칸에 전부 숫자를 달면 글자가 겹친다.
  const head = [`<span class="heat-corner"></span>`];
  for (let h = 0; h < 24; h++) {
    head.push(`<span class="heat-hh">${h % 3 === 0 ? h : ""}</span>`);
  }

  const rows = cells.map((row, day) => {
    const tds = row.map((v, h) => {
      if (v === null) {
        return `<span class="heat-c" data-lv="none" title="${DAY_KO[day]} ${hourLabel(h)}: 아직 기록 없음"></span>`;
      }
      // 0 명과 한 명 이상을 먼저 가른 뒤, 나머지를 네 단계로 나눈다.
      // 가장 붐빈 때를 1 로 잡아야 서버마다 눈금이 맞는다.
      const lv = v === 0 ? 0 : Math.min(4, Math.ceil((v / (max || 1)) * 4));
      return `<span class="heat-c" data-lv="${lv}" title="${DAY_KO[day]} ${hourLabel(h)}: 평균 ${v.toFixed(1)}명"></span>`;
    });
    return `<span class="heat-d">${DAY_KO[day]}</span>${tds.join("")}`;
  });

  host.innerHTML = head.join("") + rows.join("");

  const lead = el("heat-lead");
  if (busiest && busiest.avg > 0) {
    lead.innerHTML = `보통 <b>${DAY_KO[busiest.day]}요일 ${esc(hourLabel(busiest.hour))}</b>쯤에 가장 많이 모입니다.`;
  } else {
    lead.textContent = "아직 사람이 모인 기록이 없습니다.";
  }
}

function paintPlayers(hist) {
  const host = el("pt-list");
  const week = playerTotals(hist, Date.now() - WEEK_MS);
  if (!week.length) {
    host.innerHTML = `<p class="pt-empty">최근 이레 동안 접속한 사람이 없습니다.</p>`;
    return;
  }
  const top = week[0].minutes || 1;
  host.innerHTML = week
    .map((p) => `<li>
      <span class="pt-n">${esc(p.name)}</span>
      <span class="pt-bar" aria-hidden="true"><i style="width:${Math.max(3, Math.round((p.minutes / top) * 100))}%"></i></span>
      <span class="pt-v num">${esc(formatMinutes(p.minutes))}</span>
    </li>`)
    .join("");
}

async function init() {
  const host = el("heat-grid");
  if (!host) return;

  const hist = await loadHistory();
  const wrap = el("pt-wrap");

  // 기록이 아직 없으면 빈 표를 내놓는 대신 섹션째 감춘다. 서버를 막
  // 세운 사람에게 회색 격자만 보여 주는 것은 설명이 되지 않는다.
  if (!hasAnything(hist) || !Object.keys(hist.hours ?? {}).length) {
    if (wrap) wrap.hidden = true;
    return;
  }
  if (wrap) wrap.hidden = false;

  paintHeat(hist);
  paintPlayers(hist);

  const s = span(hist);
  const foot = el("heat-foot");
  if (foot && s) {
    foot.textContent = `최근 ${s.days}일치 기록입니다. 30초마다 한 번씩 세어 모읍니다.`;
  }
}

init();
