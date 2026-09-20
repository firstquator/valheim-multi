// 공략 탭. 보스 진행 체크와 식단 추천 두 가지를 그린다.
//
// 보스 표(data/bosses.json)는 빌드할 때 마크업으로 들어간다. 여기서는
// 체크 표시만 맡는다. 어디까지 잡았는지는 사람마다 다르고 서버가 알
// 방법이 없으므로 브라우저에 남긴다.
//
// 식단은 아이템이 1000 개가 넘어 정적 마크업으로 만들 수 없다. 도감과
// 같은 데이터를 받아 그 자리에서 계산한다.

import { loadItems, iconUrl } from "../lib/itemdb.mjs";
import { recommend, SLOTS } from "../lib/food.mjs";

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const num = (v) => Math.round((v ?? 0) * 100) / 100;

/* 보스 체크 */

// 친구마다 진행도가 다르고 서버는 그것을 알 수 없다. 브라우저에 남긴다.
// 사생활이랄 것도 없고, 지워져도 체크만 다시 하면 그만이다.
const KEY = "gaybar.bosses.v1";

function readCleared() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    // 시크릿 창이나 저장소를 막아 둔 브라우저에서는 읽기부터 던진다.
    // 체크가 안 남을 뿐 나머지는 그대로 돌아가야 한다.
    return new Set();
  }
}

function writeCleared(set) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* 저장이 안 되어도 화면은 그대로 쓴다 */
  }
}

function paintBosses() {
  const host = el("boss-list");
  if (!host) return;
  const cleared = readCleared();
  const rows = [...host.querySelectorAll(".boss")];

  let nextFound = false;
  for (const row of rows) {
    const done = cleared.has(row.dataset.boss);
    row.classList.toggle("done", done);
    const box = row.querySelector(".boss-check input");
    if (box) box.checked = done;

    // 아직 안 잡은 것 중 가장 앞선 하나만 "다음 차례" 로 표시한다.
    // 전부 표시하면 어디부터 봐야 할지 알 수 없다.
    const isNext = !done && !nextFound;
    if (isNext) nextFound = true;
    row.classList.toggle("next", isNext);
  }

  const done = rows.filter((r) => cleared.has(r.dataset.boss)).length;
  const bar = el("boss-progress");
  if (bar) {
    bar.style.width = `${Math.round((done / Math.max(1, rows.length)) * 100)}%`;
  }
  const label = el("boss-count");
  if (label) label.textContent = `${done} / ${rows.length}`;
}

function initBosses() {
  const host = el("boss-list");
  if (!host) return;
  host.addEventListener("change", (e) => {
    const box = e.target.closest(".boss-check input");
    if (!box) return;
    const row = box.closest(".boss");
    const cleared = readCleared();
    if (box.checked) cleared.add(row.dataset.boss);
    else cleared.delete(row.dataset.boss);
    writeCleared(cleared);
    paintBosses();
  });

  const reset = el("boss-reset");
  if (reset) {
    reset.addEventListener("click", () => {
      writeCleared(new Set());
      paintBosses();
    });
  }
  paintBosses();
}

/* 식단 */

const food = { items: [], stages: [], stage: 2 };

function foodCard(f) {
  return `<div class="meal-f">
    <span class="meal-f-ico">${f.icon
      ? `<img src="${iconUrl(f.icon)}" alt="" width="34" height="34" loading="lazy" decoding="async">`
      : ""}</span>
    <span class="meal-f-t">
      <span class="meal-f-n">${esc(f.ko)}</span>
      <span class="meal-f-s num">${[
        f.food > 0 ? `체력 ${num(f.food)}` : "",
        f.foodStamina > 0 ? `기력 ${num(f.foodStamina)}` : "",
        f.eitr > 0 ? `에이트르 ${num(f.eitr)}` : "",
      ].filter(Boolean).join(" · ")}</span>
    </span>
  </div>`;
}

function pickCard(p) {
  const s = p.stats;
  const totals = [
    ["체력", s.food],
    ["스태미나", s.stamina],
    ["에이트르", s.eitr],
  ].filter(([, v]) => v > 0);

  return `<article class="meal">
    <header class="meal-h">
      <h3>${esc(p.goal.ko)}</h3>
      <p>${esc(p.goal.note)}</p>
    </header>
    <div class="meal-tot">
      ${totals.map(([k, v]) => `<div>
        <span class="meal-tot-v num">+${num(v)}</span>
        <span class="meal-tot-k">${esc(k)}</span>
      </div>`).join("")}
    </div>
    <div class="meal-fs">${p.combo.map(foodCard).join("")}</div>
    <p class="meal-foot">
      ${s.regen > 0 ? `10초마다 체력 ${num(s.regen)} 회복. ` : ""}${
        Number.isFinite(s.minBurn)
          ? `${Math.round(s.minBurn / 60)}분쯤 지나면 가장 먼저 떨어지는 것부터 다시 먹습니다.`
          : ""
      }
    </p>
  </article>`;
}

function paintMeals() {
  const host = el("meal-grid");
  if (!host) return;
  const { picks, foods } = recommend(food.items, food.stage);

  const note = el("meal-note");
  if (note) {
    note.textContent = foods.length
      ? `이 단계에서 먹을 수 있는 음식 ${foods.length}가지를 모두 견줘 고른 것입니다.`
      : "이 단계에서 먹을 수 있는 음식이 없습니다.";
  }

  if (!picks.length) {
    host.innerHTML = `<p class="meal-empty">고를 만한 음식이 아직 없습니다.</p>`;
    return;
  }
  host.innerHTML = picks.map(pickCard).join("");
}

function paintFoodChips() {
  const host = el("meal-stages");
  if (!host) return;
  host.innerHTML = food.stages
    .map((s) => `<button type="button" class="dex-chip${s.n === food.stage ? " on" : ""}" data-stage="${s.n}" data-v="${s.n}"><i class="dex-dot"></i>${esc(s.ko)}</button>`)
    .join("");
}

async function initFood() {
  const host = el("meal-grid");
  if (!host) return;
  try {
    const db = await loadItems();
    food.items = db.items;
    food.stages = db.stages;
  } catch {
    host.innerHTML = `<p class="meal-empty">아이템 정보를 불러오지 못했습니다. 새로고침해 보세요.</p>`;
    return;
  }

  const chips = el("meal-stages");
  chips.addEventListener("click", (e) => {
    const b = e.target.closest(".dex-chip");
    if (!b) return;
    food.stage = Number(b.dataset.v);
    paintFoodChips();
    paintMeals();
  });

  paintFoodChips();
  paintMeals();
}

initBosses();
initFood();

// 한 번에 먹는 가짓수가 바뀌면 안내 문구도 따라가야 한다.
const slots = el("meal-slots");
if (slots) slots.textContent = String(SLOTS);
