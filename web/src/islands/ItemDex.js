// 도감. 아이템이 1000 개가 넘어 정적 마크업으로는 감당이 안 되므로
// 데이터를 받아 와서 그린다. 걸러내기와 수치 해석은 lib/itemdex.mjs 가
// 맡고 여기서는 DOM 만 만진다.
//
// 상세 화면의 원칙은 하나다. 숫자만 놓지 않는다. "방어력 14" 는 처음
// 보는 사람에게 아무 뜻이 없으므로, 그것이 무엇인지 한 줄과, 게임
// 전체에서 어디쯤인지 보여 주는 막대를 함께 둔다.

import {
  filterItems, groupOf, groupKo, damagesOf, combatDamage,
  DAMAGE_KO, DAMAGE_NOTE, GROUPS, statCaps, materialAmountAt, armorAt,
  maxima, usedByIndex, sortItems, SORTS, craftCost, expandCost,
} from "../lib/itemdex.mjs";
import { loadItems, iconUrl } from "../lib/itemdb.mjs";

const state = {
  items: [], stages: [], q: "", stage: null, group: null, sort: "name", trail: [],
  // 재료 계산기. 아이템을 옮겨 다닐 때마다 처음 값으로 돌린다.
  calc: { count: 1, maxed: false },
};

const el = (id) => document.getElementById(id);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function num(v) {
  if (v === null || v === undefined) return null;
  return Math.round(v * 100) / 100;
}

/** 0 부터 100 사이로 자른 막대 길이. 최댓값이 0 이면 그리지 않는다. */
function pct(value, max) {
  if (!max || max <= 0) return 0;
  return Math.max(2, Math.min(100, Math.round((value / max) * 100)));
}

function iconHtml(it, size) {
  if (!it || !it.icon) {
    return `<span class="dex-noicon" aria-hidden="true"></span>`;
  }
  return `<img src="${iconUrl(it.icon)}" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`;
}

function stageOf(n) {
  return state.stages.find((x) => x.n === n) ?? null;
}

function stageLabel(n) {
  return stageOf(n)?.ko ?? "미상";
}

/* 목록 */

/**
 * 카드 한 장에 붙이는 한 줄 요약.
 *
 * 훑어보는 화면이라 줄이 하나뿐이다. 그 아이템에서 가장 중요한 숫자
 * 하나만 고른다. 무기면 공격력, 방어구면 방어력, 음식이면 체력이다.
 */
function cardStat(it) {
  const caps = statCaps(it);
  const dmg = combatDamage(it);
  if (dmg > 0) return `공격 ${num(dmg)}`;
  if (caps.has("armor") && it.armor > 0) return `방어 ${num(it.armor)}`;
  // 막기는 방패에서만 대표 수치로 쓴다. 무기에도 막기 값이 있지만
  // 그것은 패링용이라, 스태프처럼 피해가 0 인 것이 "막기 48" 을 달고
  // 목록에 서면 방패처럼 보인다.
  if (it.type === "Shield" && it.blockPower > 0) return `막기 ${num(it.blockPower)}`;
  if (caps.has("food")) {
    const bits = [];
    if (it.food > 0) bits.push(`체력 ${num(it.food)}`);
    if (it.foodStamina > 0) bits.push(`기력 ${num(it.foodStamina)}`);
    if (it.eitr > 0) bits.push(`에이트르 ${num(it.eitr)}`);
    if (bits.length) return bits.slice(0, 2).join(" · ");
  }
  const work = damagesOf(it).find((d) => d.key === "chop" || d.key === "pickaxe");
  if (work) return `${DAMAGE_KO[work.key]} ${num(work.value)}`;
  return "";
}

function card(it) {
  // 카드 자체를 button 으로 둔다. 눌러서 상세를 여는 것이 목적이고
  // 키보드로도 닿아야 한다.
  const st = it.stage === null ? "" : esc(stageLabel(it.stage));
  const stat = cardStat(it);
  return `<button class="dex-card" data-id="${it.id}" type="button"${
    it.stage === null ? "" : ` data-stage="${it.stage}"`}>
    <span class="dex-ico">${iconHtml(it, 44)}</span>
    <span class="dex-txt">
      <span class="dex-name">${esc(it.ko)}</span>
      <span class="dex-sub">
        ${st ? `<span class="dex-biome"><i class="dex-dot"></i>${st}</span>` : ""}
        ${stat ? `<span class="dex-stat num">${esc(stat)}</span>` : ""}
      </span>
    </span>
  </button>`;
}

/* 상세 */

const STATION_KO = {
  piece_workbench: "작업대", forge: "단조장", piece_stonecutter: "석공대",
  piece_artisanstation: "장인의 작업대", blackforge: "검은 단조장",
  piece_magetable: "마법 주입대", piece_cauldron: "가마솥",
  piece_preptable: "조리대", piece_MeadCauldron: "발효통",
  // 아래는 Recipe 가 아니라 변환표를 쓰는 설비다.
  piece_cookingstation: "화덕", piece_cookingstation_iron: "철 화덕",
  piece_oven: "돌 화덕", fermenter: "발효통", smelter: "용광로",
  blastfurnace: "고로", charcoal_kiln: "숯가마",
  eitrrefinery: "에이트르 정제소", windmill: "풍차",
  piece_spinningwheel: "물레", piece_FrostFoundry: "서리 주조소",
};

const stationKo = (id) => STATION_KO[id] ?? id;

/** 큰 숫자 타일. 그 아이템에서 가장 먼저 봐야 할 값들이다. */
function keyTiles(it) {
  const caps = statCaps(it);
  const out = [];
  const add = (label, value, unit = "") => out.push({ label, value, unit });

  const dmg = combatDamage(it);
  if (dmg > 0) add("공격력", num(dmg));
  if (caps.has("armor") && it.armor > 0) add("방어력", num(it.armor));
  if (caps.has("block") && it.blockPower > 0) add("막기", num(it.blockPower));
  if (caps.has("food")) {
    if (it.food > 0) add("체력", `+${num(it.food)}`);
    if (it.foodStamina > 0) add("스태미나", `+${num(it.foodStamina)}`);
    if (it.eitr > 0) add("에이트르", `+${num(it.eitr)}`);
    if (it.foodBurnTime > 0) add("지속", Math.round(it.foodBurnTime / 60), "분");
  }
  if (out.length < 4 && it.weight) add("무게", num(it.weight));
  if (out.length < 4 && it.stack > 1) add("한 칸에", it.stack, "개");

  if (!out.length) return "";
  return `<div class="dex-keys">${out.slice(0, 4).map((t) => `
    <div class="dex-key">
      <span class="dex-key-v num">${esc(t.value)}${t.unit ? `<em>${esc(t.unit)}</em>` : ""}</span>
      <span class="dex-key-l">${esc(t.label)}</span>
    </div>`).join("")}</div>`;
}

/** 피해 종류별 막대. 옆에 그 피해가 무엇인지 한 줄을 붙인다. */
function damageSection(it) {
  const list = damagesOf(it);
  if (!list.length) return "";
  const rows = list.map((d) => `
    <li>
      <div class="dex-bar-top">
        <span class="dex-bar-k">${esc(DAMAGE_KO[d.key] ?? d.key)}</span>
        <span class="dex-bar-v num">${num(d.value)}</span>
      </div>
      <div class="dex-bar" aria-hidden="true"><i style="width:${pct(d.value, state.max.damage[d.key])}%"></i></div>
      <p class="dex-bar-n">${esc(DAMAGE_NOTE[d.key] ?? "")}</p>
    </li>`).join("");
  return `<section class="dex-sec">
    <h4>공격력</h4>
    <ul class="dex-bars">${rows}</ul>
    <p class="dex-foot">막대 길이는 그 피해가 가장 높은 무기와 견준 것입니다. 길수록 게임 전체에서 센 편입니다.</p>
  </section>`;
}

/** 음식 회복량 막대. */
function foodSection(it) {
  if (!statCaps(it).has("food")) return "";
  const rows = [
    ["체력", it.food, state.max.food, "먹으면 최대 체력이 이만큼 늘어납니다."],
    ["스태미나", it.foodStamina, state.max.foodStamina, "최대 스태미나가 이만큼 늘어납니다. 달리기와 공격에 씁니다."],
    ["에이트르", it.eitr, state.max.eitr, "최대 에이트르가 이만큼 늘어납니다. 마법을 쓰려면 필요합니다."],
  ].filter(([, v]) => v > 0);
  if (!rows.length) return "";

  const extra = [];
  if (it.foodBurnTime > 0) {
    extra.push(`효과는 <b>${Math.round(it.foodBurnTime / 60)}분</b> 동안 유지되고, 시간이 갈수록 조금씩 줄어듭니다.`);
  }
  if (it.foodRegen > 0) {
    extra.push(`배가 부른 동안 <b>10초마다 체력이 ${num(it.foodRegen)}</b>씩 찹니다.`);
  }

  return `<section class="dex-sec">
    <h4>먹으면</h4>
    <ul class="dex-bars">${rows.map(([k, v, m, note]) => `
      <li>
        <div class="dex-bar-top">
          <span class="dex-bar-k">${esc(k)}</span>
          <span class="dex-bar-v num">+${num(v)}</span>
        </div>
        <div class="dex-bar" aria-hidden="true"><i style="width:${pct(v, m)}%"></i></div>
        <p class="dex-bar-n">${esc(note)}</p>
      </li>`).join("")}</ul>
    ${extra.length ? `<p class="dex-foot">${extra.join(" ")}</p>` : ""}
  </section>`;
}

/**
 * 그 밖의 수치. 값 옆에 설명을 함께 둔다. 숫자만 있으면 크거나 작다는
 * 것만 알 수 있을 뿐, 그래서 뭘 어떻게 하라는 것인지 알 수 없다.
 */
function infoSection(it) {
  const caps = statCaps(it);
  const rows = [];
  const push = (k, v, note) => {
    if (v !== null && v !== undefined && v !== "" && v !== 0) rows.push([k, v, note]);
  };

  push("무게", num(it.weight), "들고 다니면 가방 무게에 더해집니다. 한도를 넘으면 걷지도 못합니다.");
  push("한 칸에", it.stack > 1 ? `${it.stack}개` : null, "가방 한 칸에 이만큼까지 겹쳐 둘 수 있습니다.");
  if (caps.has("durability")) {
    push("내구도", num(it.durability), "쓸수록 닳습니다. 만든 제작대 옆에서 수리하면 재료가 들지 않습니다.");
  }
  if (caps.has("armor")) {
    push("방어력", num(it.armor), "받는 피해를 줄입니다. 입고 있는 방어구의 값을 모두 더한 것이 적용됩니다.");
  }
  if (caps.has("block")) {
    push("막기", num(it.blockPower), "막았을 때 버텨내는 양입니다. 이보다 센 공격은 막아도 밀려납니다.");
  }
  push("강화", it.maxQuality > 1 ? `${it.maxQuality}단계까지` : null, "재료를 더 넣어 성능을 올릴 수 있습니다.");

  if (!rows.length) return "";
  return `<section class="dex-sec">
    <h4>수치</h4>
    <dl class="dex-dl">${rows.map(([k, v, note]) => `
      <div>
        <dt>${esc(k)}</dt>
        <dd><b class="num">${esc(v)}</b><span>${esc(note)}</span></dd>
      </div>`).join("")}</dl>
  </section>`;
}

/**
 * 강화 단계표.
 *
 * 게임 안에서는 한 단계씩 올려 봐야 다음에 뭐가 드는지 알 수 있다.
 * 여기서는 끝까지 올리는 데 무엇이 얼마나 드는지 한눈에 보여 준다.
 */
function upgradeSection(it) {
  const r = it.recipe;
  if (!r || it.maxQuality <= 1 || !(r.materials ?? []).length) return "";
  const caps = statCaps(it);
  const showArmor = caps.has("armor") && it.armorPerLevel > 0;

  const levels = [];
  for (let q = 1; q <= it.maxQuality; q++) {
    const mats = r.materials
      .map((m) => ({ m, n: materialAmountAt(m, q) }))
      .filter((x) => x.n > 0);
    if (!mats.length && q > 1) continue;
    levels.push({ q, mats, armor: armorAt(it, q) });
  }
  if (levels.length <= 1) return "";

  const total = new Map();
  for (const lv of levels) {
    for (const { m, n } of lv.mats) total.set(m.item, (total.get(m.item) ?? 0) + n);
  }

  const nameOf = (id) => esc(state.byId.get(id)?.ko ?? id);
  const cell = (id, n) => `<span class="dex-up-m">${nameOf(id)} <b class="num">${n}</b></span>`;

  return `<section class="dex-sec">
    <h4>강화</h4>
    <div class="dex-up-wrap">
      <table class="dex-up">
        <thead><tr>
          <th>단계</th>
          ${showArmor ? "<th>방어력</th>" : ""}
          <th>그 단계에 드는 재료</th>
        </tr></thead>
        <tbody>${levels.map((lv) => `
          <tr>
            <th scope="row">${lv.q === 1 ? "제작" : `${lv.q}단계`}</th>
            ${showArmor ? `<td class="num">${num(lv.armor)}</td>` : ""}
            <td>${lv.mats.map(({ m, n }) => cell(m.item, n)).join("")}</td>
          </tr>`).join("")}
          <tr class="dex-up-sum">
            <th scope="row">전부 합쳐</th>
            ${showArmor ? "<td></td>" : ""}
            <td>${[...total].map(([id, n]) => cell(id, n)).join("")}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="dex-foot">강화는 처음 만든 제작대에서 합니다. ${
      showArmor ? "" : "단계가 오르면 공격력과 내구도가 함께 오릅니다. "
    }마지막 줄은 ${it.maxQuality}단계까지 끝까지 올릴 때 드는 전부입니다.</p>
  </section>`;
}

/**
 * 재료 한 줄. 눌러서 그 재료로 넘어갈 수 있다.
 *
 * 여기 적는 수는 처음 만들 때 드는 양이다. 강화에 드는 양은 위의
 * 강화표가 단계마다 따로 보여 주므로 여기서 되풀이하지 않는다.
 */
function matRow(id, amount) {
  const src = state.byId.get(id);
  return `<li>
    <button type="button" class="dex-mat dex-link" data-go="${esc(id)}">
      <span class="dex-mat-ico">${iconHtml(src, 26)}</span>
      <span class="dex-mat-n">${esc(src ? src.ko : id)}</span>
      <span class="dex-mat-a num">${amount}</span>
    </button>
  </li>`;
}

/**
 * 얻는 방법.
 *
 * 제작과 변환을 둘 다 가진 것이 있다. 청동은 단조장에서 구리와 주석으로
 * 만들 수도 있고, 청동 부스러기를 용광로에 녹여서 얻을 수도 있다.
 * 하나만 보여 주면 나머지 길을 모르게 된다.
 */
function howSection(it) {
  const r = it.recipe;
  const cv = it.conversion;
  const ways = [];

  if (r) {
    const where = r.station
      ? `<strong>${esc(stationKo(r.station))}</strong>에서 만듭니다`
      : "제작대 없이 맨손으로 만듭니다";
    const bits = [];
    if (r.minLevel > 1) bits.push(`제작대가 ${r.minLevel}단계 이상이어야 합니다`);
    if (r.amount > 1) bits.push(`한 번 만들면 ${r.amount}개가 나옵니다`);
    ways.push(`
      <p class="dex-how">${where}.</p>
      ${bits.length ? `<p class="dex-foot">${esc(bits.join(". "))}.</p>` : ""}
      ${(r.materials ?? []).length ? `<ul class="dex-mats">${
        r.materials.map((m) => matRow(m.item, m.amount)).join("")
      }</ul>` : ""}`);
  }

  if (cv) {
    const bits = [];
    if (cv.cookTime) bits.push(`${Math.round(cv.cookTime)}초 걸립니다`);
    if (cv.produced > 1) bits.push(`한 번에 ${cv.produced}개가 나옵니다`);
    ways.push(`
      <p class="dex-how">아래 재료를 <strong>${esc(stationKo(cv.station))}</strong>에 넣으면 이것으로 바뀝니다.</p>
      ${bits.length ? `<p class="dex-foot">${esc(bits.join(". "))}.</p>` : ""}
      <ul class="dex-mats">${matRow(cv.from, 1)}</ul>`);
  }

  if (!ways.length) {
    const where = it.stage === null
      ? ""
      : ` 주로 <strong>${esc(stageLabel(it.stage))}</strong>에서 볼 수 있습니다.`;
    ways.push(`
      <p class="dex-how">만드는 물건이 아닙니다. 채집하거나 몬스터를 잡아서 얻습니다.${where}</p>
      ${it.stageGuessed ? `<p class="dex-foot">나오는 곳은 이름과 재료로 미루어 짐작한 것이라 틀릴 수 있습니다.</p>` : ""}`);
  }

  return `<section class="dex-sec">
    <h4>얻는 방법${ways.length > 1 ? ` <span class="dex-cnt">${ways.length}가지</span>` : ""}</h4>
    ${ways.map((w, i) => `<div class="dex-way">${
      ways.length > 1 ? `<span class="dex-way-n">${i + 1}</span>` : ""
    }<div>${w}</div></div>`).join("")}
  </section>`;
}

/**
 * 재료 계산기.
 *
 * 얻는 방법은 "철 20, 사슴 가죽 2" 까지만 알려 준다. 정작 원정을 나가기
 * 전에 궁금한 것은 "그래서 광석을 몇 개 캐 와야 하나" 다. 레시피와
 * 변환표를 끝까지 따라 내려가면 그 답이 나온다.
 *
 * 개수를 바꿀 수 있어야 한다. 방패 하나가 아니라 넷을 만들 때가 많다.
 */
function calcSection(it) {
  if (!it.recipe && !it.conversion) return "";
  const { count, maxed } = state.calc;
  const cost = it.recipe
    ? craftCost(it, { maxed })
    : new Map([[it.conversion.from, Math.ceil(1 / Math.max(1, it.conversion.produced ?? 1))]]);

  // 개수만큼 곱한 뒤 펼친다. 먼저 펼치고 곱하면 올림이 한 번만 일어나
  // 여러 개 만들 때의 낭비가 사라진다.
  const scaled = new Map([...cost].map(([id, n]) => [id, n * Math.max(1, count)]));
  const { raw, trees } = expandCost(state.byId, scaled);

  const nameOf = (id) => esc(state.byId.get(id)?.ko ?? id);
  const row = (id, n) => `<li>
    <button type="button" class="dex-mat dex-link" data-go="${esc(id)}">
      <span class="dex-mat-ico">${iconHtml(state.byId.get(id), 26)}</span>
      <span class="dex-mat-n">${nameOf(id)}</span>
      <span class="dex-mat-a num">${n}</span>
    </button>
  </li>`;

  // 중간 단계를 접어 둔다. 대개는 합계만 보면 되고, 어디서 뭐가 나오는지
  // 확인하고 싶을 때만 펼친다.
  const branch = (node, depth = 0) => {
    const made = node.made && node.children.length;
    return `<li>
      <span class="dex-tree-row" style="padding-left:${depth * 14}px">
        <span class="dex-tree-ico">${iconHtml(state.byId.get(node.id), 20)}</span>
        <span class="dex-tree-n${made ? "" : " raw"}">${nameOf(node.id)}</span>
        <span class="dex-tree-a num">${node.n}</span>
      </span>
      ${made ? `<ul>${node.children.map((c) => branch(c, depth + 1)).join("")}</ul>` : ""}
    </li>`;
  };

  const hasTree = trees.some((t) => t.made && t.children.length);
  const upgradable = it.recipe && it.maxQuality > 1;

  return `<section class="dex-sec">
    <h4>얼마나 필요한가</h4>
    <div class="dex-calc">
      <div class="dex-calc-ctl">
        <span class="dex-calc-l">개수</span>
        <div class="dex-step">
          <button type="button" class="dex-step-b" data-calc="minus" aria-label="하나 줄이기">-</button>
          <input type="number" class="dex-step-i num" id="dex-count-in" min="1" max="999" value="${count}" aria-label="만들 개수">
          <button type="button" class="dex-step-b" data-calc="plus" aria-label="하나 늘리기">+</button>
        </div>
        ${upgradable ? `<label class="dex-check">
          <input type="checkbox" id="dex-maxed"${maxed ? " checked" : ""}>
          <span>${it.maxQuality}단계까지 강화</span>
        </label>` : ""}
      </div>
      <p class="dex-calc-sum">모아 와야 할 것</p>
      <ul class="dex-mats">${[...raw].map(([id, n]) => row(id, n)).join("")}</ul>
      ${hasTree ? `<details class="dex-tree-wrap">
        <summary>중간에 무엇을 거치는지 보기</summary>
        <ul class="dex-tree">${trees.map((t) => branch(t)).join("")}</ul>
      </details>` : ""}
    </div>
  </section>`;
}

/** 거꾸로 보기. 이 아이템이 어디에 들어가는지. */
function usedSection(it) {
  const uses = state.usedBy.get(it.id) ?? [];
  if (!uses.length) return "";
  const LIMIT = 24;
  const shown = uses.slice(0, LIMIT);
  return `<section class="dex-sec">
    <h4>쓰임새 <span class="dex-cnt num">${uses.length}</span></h4>
    <p class="dex-how">이것을 재료로 쓰는 것들입니다. 눌러서 바로 넘어갈 수 있습니다.</p>
    <div class="dex-uses">${shown.map((u) => {
      const t = state.byId.get(u.id);
      return `<button type="button" class="dex-use dex-link" data-go="${esc(u.id)}">
        ${iconHtml(t, 24)}<span>${esc(t ? t.ko : u.id)}</span>
      </button>`;
    }).join("")}</div>
    ${uses.length > LIMIT ? `<p class="dex-foot">그 밖에 ${uses.length - LIMIT}개가 더 있습니다.</p>` : ""}
  </section>`;
}

function detail(it) {
  const st = stageOf(it.stage);
  const badges = [
    `<span class="dex-tag">${esc(groupKo(groupOf(it)))}</span>`,
    st
      ? `<span class="dex-tag dex-tag-stage" data-stage="${it.stage}"><i class="dex-dot"></i>${
          esc(st.ko)}${st.note ? ` · ${esc(st.note)}` : ""}</span>`
      : "",
  ].filter(Boolean).join("");

  return `
    <header class="dex-d-head">
      <span class="dex-d-ico">${iconHtml(it, 72)}</span>
      <div class="dex-d-title">
        <h3>${esc(it.ko)}</h3>
        <p class="dex-d-en">${esc(it.en)}</p>
        <div class="dex-tags">${badges}</div>
      </div>
    </header>
    ${it.koDesc ? `<p class="dex-d-desc">${esc(it.koDesc)}</p>` : ""}
    ${it.teleportable
      ? ""
      : `<p class="dex-warn"><b>차원문으로 옮길 수 없습니다.</b> 이것을 들고 있으면 차원문에 들어가지지 않습니다. 배로 실어 나르거나 근처에 두고 가야 합니다.</p>`}
    ${keyTiles(it)}
    ${damageSection(it)}
    ${foodSection(it)}
    ${infoSection(it)}
    ${upgradeSection(it)}
    ${howSection(it)}
    ${calcSection(it)}
    ${usedSection(it)}
    <p class="dex-d-id">내부 이름 <code>${esc(it.id)}</code></p>`;
}

/* 화면 */

function render() {
  const list = sortItems(filterItems(state.items, state), state.sort);
  const grid = el("dex-grid");
  el("dex-count").textContent = `${list.length}개`;
  if (!list.length) {
    grid.innerHTML = `<p class="dex-empty">조건에 맞는 아이템이 없습니다. 검색어를 줄이거나 걸러내기를 풀어 보세요.</p>`;
    return;
  }
  // 한 번에 다 그리면 1000 개가 넘어 느리다. 눈에 보이는 만큼만 그리고
  // 더 보기로 늘린다.
  const shown = list.slice(0, state.limit);
  grid.innerHTML = shown.map(card).join("") +
    (list.length > shown.length
      ? `<button class="dex-more" id="dex-more" type="button">더 보기 <span class="num">${list.length - shown.length}개 남음</span></button>`
      : "");
}

function paintDetail(id) {
  const it = state.byId.get(id);
  if (!it) return;
  state.current = id;
  el("dex-detail").innerHTML = detail(it);
  el("dex-panel").scrollTop = 0;
  el("dex-back").hidden = state.trail.length === 0;
}

/** 빈 칸이나 0 을 그대로 두면 계산이 통째로 0 이 되어 화면이 빈다. */
function clampCount(n) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(999, Math.round(n)));
}

/** 계산기는 아이템마다 따로다. 옮겨 다닐 때 값을 들고 가면 헷갈린다. */
function resetCalc() {
  state.calc = { count: 1, maxed: false };
}

function openDetail(id) {
  state.trail = [];
  resetCalc();
  paintDetail(id);
  el("dex-modal").hidden = false;
  el("dex-close").focus();
}

/** 재료를 눌러 다른 아이템으로 건너뛴다. 되돌아올 수 있어야 한다. */
function goTo(id) {
  if (!state.byId.has(id)) return;
  if (state.current) state.trail.push(state.current);
  resetCalc();
  paintDetail(id);
}

function goBack() {
  const prev = state.trail.pop();
  if (prev) {
    resetCalc();
    paintDetail(prev);
  }
}

function closeDetail() {
  el("dex-modal").hidden = true;
  state.trail = [];
}

function chips(host, values, current, onPick) {
  host.innerHTML = values
    .map((v) => `<button type="button" class="dex-chip${v.value === current ? " on" : ""}"${
      v.stage === undefined ? "" : ` data-stage="${v.stage}"`
    } data-v="${v.value ?? ""}"${v.title ? ` title="${esc(v.title)}"` : ""}>${
      v.stage === undefined ? "" : `<i class="dex-dot"></i>`}${esc(v.label)}</button>`)
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
    [
      { value: null, label: "전체" },
      ...state.stages.map((s) => ({ value: String(s.n), label: s.ko, stage: s.n, title: s.note })),
    ],
    state.stage === null ? null : String(state.stage),
    (v) => { state.stage = v === null ? null : Number(v); state.limit = 60; paintChips(); render(); });

  chips(el("dex-groups"),
    [{ value: null, label: "전체" }, ...GROUPS.map((g) => ({ value: g.id, label: g.ko }))],
    state.group,
    (v) => { state.group = v; state.limit = 60; paintChips(); render(); });

  // 정렬은 "전체" 가 없다. 언제나 하나가 켜져 있다.
  chips(el("dex-sorts"),
    SORTS.map((s) => ({ value: s.id, label: s.ko })),
    state.sort,
    (v) => { state.sort = v ?? "name"; state.limit = 60; paintChips(); render(); });

  // 단계를 고르면 그게 언제부터인지 알려 준다. "늪" 만으로는 순서를 모른다.
  const note = el("dex-note");
  const s = state.stage === null ? null : stageOf(state.stage);
  note.textContent = s ? `${s.ko}: ${s.note}에 갈 만한 곳입니다.` : "";
  note.hidden = !s;
}

async function init() {
  const host = el("dex-grid");
  if (!host) return;
  try {
    const db = await loadItems();
    state.items = db.items;
    state.stages = db.stages;
    state.byId = db.byId;
    state.max = maxima(db.items);
    state.usedBy = usedByIndex(db.items);
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

  const detailBox = el("dex-detail");

  detailBox.addEventListener("click", (e) => {
    const step = e.target.closest("[data-calc]");
    if (step) {
      state.calc.count = clampCount(state.calc.count + (step.dataset.calc === "plus" ? 1 : -1));
      paintDetail(state.current);
      return;
    }
    const link = e.target.closest(".dex-link");
    if (link) goTo(link.dataset.go);
  });

  // 개수 칸과 강화 여부. 다시 그리면 포커스가 날아가므로, 숫자 칸은
  // 다시 그린 뒤 커서를 돌려놓는다.
  detailBox.addEventListener("input", (e) => {
    if (e.target.id !== "dex-count-in") return;
    state.calc.count = clampCount(Number(e.target.value));
    paintDetail(state.current);
    const again = el("dex-count-in");
    if (again) {
      again.focus();
      again.select();
    }
  });

  detailBox.addEventListener("change", (e) => {
    if (e.target.id !== "dex-maxed") return;
    state.calc.maxed = e.target.checked;
    paintDetail(state.current);
  });

  el("dex-back").addEventListener("click", goBack);
  el("dex-close").addEventListener("click", closeDetail);
  el("dex-modal").addEventListener("click", (e) => {
    if (e.target.id === "dex-modal") closeDetail();
  });
  document.addEventListener("keydown", (e) => {
    if (el("dex-modal").hidden) return;
    if (e.key === "Escape") closeDetail();
    if (e.key === "Backspace" && state.trail.length) { e.preventDefault(); goBack(); }
  });
}

init();
