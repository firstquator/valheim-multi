// 도감. 아이템이 1000 개가 넘어 정적 마크업으로는 감당이 안 되므로
// 데이터를 받아 와서 그린다. 걸러내기 자체는 lib/itemdex.mjs 가 맡고
// 여기서는 DOM 만 만진다.

import { filterItems, groupOf, damageList, DAMAGE_KO, GROUPS } from "../lib/itemdex.mjs";

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");
const state = { items: [], stages: [], q: "", stage: null, group: null };

const el = (id) => document.getElementById(id);

function iconHtml(it, size) {
  if (!it.icon) {
    return `<span class="dex-noicon" aria-hidden="true"></span>`;
  }
  return `<img src="${BASE}/items/${it.icon}.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

function stageLabel(n) {
  const s = state.stages.find((x) => x.n === n);
  return s ? s.ko : "미상";
}

function card(it) {
  // 카드 자체를 button 으로 둔다. 눌러서 상세를 여는 것이 목적이고
  // 키보드로도 닿아야 한다.
  return `<button class="dex-card" data-id="${it.id}" type="button">
    <span class="dex-ico">${iconHtml(it, 40)}</span>
    <span class="dex-txt">
      <span class="dex-name">${esc(it.ko)}</span>
      <span class="dex-meta">${it.stage === null ? "" : esc(stageLabel(it.stage))}</span>
    </span>
  </button>`;
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function num(v) {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100) / 100;
}

function detail(it) {
  const rows = [];
  const push = (k, v) => { if (v !== null && v !== undefined && v !== "" && v !== 0) rows.push([k, v]); };

  // 게임 데이터에는 모든 아이템에 모든 칸이 들어 있다. 쓰이지 않는
  // 칸에도 기본값이 남아 있어서, 그대로 내보내면 나무에 "내구도 100",
  // 철 검에 "방어력 20" 이 붙는다. 그 값으로 무언가를 판단하면 틀린다.
  // 그래서 종류별로 의미가 있는 칸만 고른다.
  const g = groupOf(it);
  const gear = g === "weapon" || g === "armor" || g === "tool";

  push("무게", num(it.weight));
  push("최대 소지", it.stack > 1 ? `${it.stack}개` : null);
  push("품질", it.maxQuality > 1 ? `${it.maxQuality}단계까지 강화` : null);
  if (gear) push("내구도", num(it.durability));
  if (g === "armor") push("방어력", num(it.armor));
  if (gear) push("방어 성능", num(it.blockPower));
  push("체력 회복", num(it.food));
  push("스태미나", num(it.foodStamina));
  push("에이트르", num(it.eitr));
  push("지속 시간", it.foodBurnTime ? `${Math.round(it.foodBurnTime / 60)}분` : null);
  if (it.teleportable === false) rows.push(["차원문", "통과할 수 없음"]);

  const dmg = damageList(it)
    .map((d) => `<span class="dex-dmg"><b>${esc(DAMAGE_KO[d.key] ?? d.key)}</b> ${num(d.value)}</span>`)
    .join("");

  const r = it.recipe;
  const mats = (r?.materials ?? []).map((m) => {
    const src = state.byId.get(m.item);
    return `<li>
      <span class="dex-mat-ico">${src ? iconHtml(src, 24) : ""}</span>
      <span class="dex-mat-n">${esc(src ? src.ko : m.item)}</span>
      <span class="dex-mat-a">${m.amount}${m.perLevel ? ` <em>(+${m.perLevel}/단계)</em>` : ""}</span>
    </li>`;
  }).join("");

  const stationKo = {
    piece_workbench: "작업대", forge: "단조장", piece_stonecutter: "석공대",
    piece_artisanstation: "장인의 작업대", blackforge: "검은 단조장",
    piece_magetable: "마법 주입대", piece_cauldron: "가마솥",
    piece_preptable: "조리대", piece_MeadCauldron: "발효통",
  };

  return `
    <div class="dex-d-head">
      <span class="dex-d-ico">${iconHtml(it, 64)}</span>
      <div>
        <h3>${esc(it.ko)}</h3>
        <p class="dex-d-en">${esc(it.en)}</p>
        ${it.stage === null ? "" : `<p class="dex-d-stage">${esc(stageLabel(it.stage))}부터</p>`}
      </div>
    </div>
    ${it.koDesc ? `<p class="dex-d-desc">${esc(it.koDesc)}</p>` : ""}
    ${dmg ? `<div class="dex-d-sec"><h4>공격력</h4><div class="dex-dmgs">${dmg}</div></div>` : ""}
    ${rows.length ? `<div class="dex-d-sec"><h4>정보</h4><dl class="dex-dl">${
      rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")
    }</dl></div>` : ""}
    <div class="dex-d-sec">
      <h4>얻는 방법</h4>
      ${r ? `
        <p class="dex-how">${r.station ? `${esc(stationKo[r.station] ?? r.station)}에서 제작` : "직접 제작"}${
          r.minLevel > 1 ? ` <em>(작업대 ${r.minLevel}단계 이상)</em>` : ""
        }${r.amount > 1 ? ` <em>· 한 번에 ${r.amount}개</em>` : ""}</p>
        ${mats ? `<ul class="dex-mats">${mats}</ul>` : ""}
      ` : `<p class="dex-how">제작법이 없습니다. 채집하거나 몬스터를 잡아 얻습니다.${
        it.stage === null ? "" : ` ${esc(stageLabel(it.stage))} 지역에서 나옵니다.`
      }</p>`}
    </div>
    <p class="dex-d-id">내부 이름 <code>${esc(it.id)}</code></p>`;
}

function render() {
  const list = filterItems(state.items, state);
  const grid = el("dex-grid");
  const count = el("dex-count");
  count.textContent = `${list.length}개`;
  if (!list.length) {
    grid.innerHTML = `<p class="dex-empty">조건에 맞는 아이템이 없습니다.</p>`;
    return;
  }
  // 한 번에 다 그리면 1000 개가 넘어 느리다. 눈에 보이는 만큼만 그리고
  // 더 보기로 늘린다.
  const shown = list.slice(0, state.limit);
  grid.innerHTML = shown.map(card).join("") +
    (list.length > shown.length
      ? `<button class="dex-more" id="dex-more" type="button">더 보기 (${list.length - shown.length}개 남음)</button>`
      : "");
}

function openDetail(id) {
  const it = state.byId.get(id);
  if (!it) return;
  const box = el("dex-detail");
  box.innerHTML = detail(it);
  el("dex-modal").hidden = false;
  el("dex-close").focus();
}

function closeDetail() {
  el("dex-modal").hidden = true;
}

function chips(host, values, current, onPick) {
  host.innerHTML = values
    .map((v) => `<button type="button" class="dex-chip${v.value === current ? " on" : ""}" data-v="${v.value ?? ""}">${esc(v.label)}</button>`)
    .join("");
  host.onclick = (e) => {
    const b = e.target.closest(".dex-chip");
    if (!b) return;
    const raw = b.dataset.v;
    onPick(raw === "" ? null : raw);
  };
}

function paintChips() {
  chips(el("dex-stages"),
    [{ value: null, label: "전체" }, ...state.stages.map((s) => ({ value: String(s.n), label: s.ko }))],
    state.stage === null ? null : String(state.stage),
    (v) => { state.stage = v === null ? null : Number(v); state.limit = 60; paintChips(); render(); });

  chips(el("dex-groups"),
    [{ value: null, label: "전체" }, ...GROUPS.map((g) => ({ value: g.id, label: g.ko }))],
    state.group,
    (v) => { state.group = v; state.limit = 60; paintChips(); render(); });
}

async function init() {
  const host = el("dex-grid");
  if (!host) return;
  try {
    const res = await fetch(`${BASE}/items.json`, { cache: "force-cache" });
    const db = await res.json();
    state.items = db.items;
    state.stages = db.stages;
    state.byId = new Map(db.items.map((i) => [i.id, i]));
    state.limit = 60;
  } catch {
    host.innerHTML = `<p class="dex-empty">아이템 정보를 불러오지 못했습니다. 새로고침해 보세요.</p>`;
    return;
  }

  paintChips();
  render();

  el("dex-q").addEventListener("input", (e) => {
    state.q = e.target.value;
    state.limit = 60;
    render();
  });

  host.addEventListener("click", (e) => {
    if (e.target.closest("#dex-more")) {
      state.limit += 120;
      render();
      return;
    }
    const c = e.target.closest(".dex-card");
    if (c) openDetail(c.dataset.id);
  });

  el("dex-close").addEventListener("click", closeDetail);
  el("dex-modal").addEventListener("click", (e) => {
    if (e.target.id === "dex-modal") closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !el("dex-modal").hidden) closeDetail();
  });
}

init();
