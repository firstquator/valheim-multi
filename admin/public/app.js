// 관리 패널 화면. 빌드 단계가 없으므로 브라우저가 그대로 읽는 모듈이다.
// 값 판정은 전부 서버가 하고, 여기서는 그리기만 한다.

const $ = (sel) => document.querySelector(sel);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

async function api(pathname, options) {
  const res = await fetch(pathname, options);
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = { error: "응답을 읽지 못했다" };
  }
  return { ok: res.ok, status: res.status, body };
}

// ------------------------------------------------------------------ 탭

const TABS = ["server", "drift", "logs", "backups"];
let activeTab = "server";

function selectTab(name) {
  activeTab = name;
  for (const t of TABS) {
    $(`#tab-${t}`).hidden = t !== name;
    document.querySelector(`nav.tabs button[data-tab="${t}"]`).setAttribute("aria-selected", String(t === name));
  }
  if (name === "drift") loadDrift();
  if (name === "logs") loadLogs();
  if (name === "backups") loadBackups();
}

for (const btn of document.querySelectorAll("nav.tabs button")) {
  btn.addEventListener("click", () => selectTab(btn.dataset.tab));
}

// ------------------------------------------------------------------ 확인 창

function confirmAction({ title, body, okLabel }) {
  const dlg = $("#confirmDialog");
  $("#confirmTitle").textContent = title;
  $("#confirmBody").textContent = body;
  $("#confirmOk").textContent = okLabel ?? "실행";
  return new Promise((resolve) => {
    const done = (v) => {
      dlg.close();
      $("#confirmOk").removeEventListener("click", onOk);
      $("#confirmCancel").removeEventListener("click", onCancel);
      resolve(v);
    };
    const onOk = () => done(true);
    const onCancel = () => done(false);
    $("#confirmOk").addEventListener("click", onOk);
    $("#confirmCancel").addEventListener("click", onCancel);
    dlg.showModal();
  });
}

// ------------------------------------------------------------------ 서버 탭

let lastOverview = null;

function renderOverview(o) {
  lastOverview = o;
  const kv = $("#statusKv");
  kv.replaceChildren();

  const add = (k, node) => {
    kv.append(el("dt", null, k));
    const dd = el("dd");
    if (typeof node === "string") dd.textContent = node;
    else dd.append(node);
    kv.append(dd);
  };

  const running = o.container.running;
  const serving = o.server.serving;
  const state = el("span");
  const dot = el("span", `dot ${running ? (serving ? "on" : "wait") : "off"}`);
  state.append(dot);
  state.append(
    document.createTextNode(
      !o.container.exists
        ? "컨테이너가 없다"
        : running
          ? serving
            ? "가동 중"
            : "컨테이너는 떴지만 아직 접속을 받지 못한다"
          : `중지됨 (${o.container.status})`,
    ),
  );
  add("상태", state);
  add("접속자", `${o.server.playerCount}명`);
  add("서버 이름", o.server.name ?? "-");
  add("게임 버전", o.server.gameVersion ?? "-");
  add("시작 시각", o.container.startedAt ? new Date(o.container.startedAt).toLocaleString("ko-KR") : "-");
  add("중지 유예", o.container.stopTimeout ? `${o.container.stopTimeout}초` : "-");
  if (o.backups) add("백업", `${o.backups.count}개, 최근 ${o.backups.latestAt ? new Date(o.backups.latestAt).toLocaleString("ko-KR") : "-"}`);
  if (o.container.error) add("오류", o.container.error);

  $("#brandSub").textContent = `${o.server.name ?? "발헤임"} · 접속자 ${o.server.playerCount}명`;

  const busy = o.job && o.job.state === "running";
  $("#btnStart").disabled = busy || running;
  $("#btnStop").disabled = busy || !running;
  $("#btnRestart").disabled = busy || !running;

  renderJob(o.job);
}

function renderJob(job) {
  const box = $("#jobBox");
  box.replaceChildren();
  if (!job) return;

  const wrap = el("div", "job");
  const label = { start: "시작", stop: "중지", restart: "재시작" }[job.kind] ?? job.kind;
  const stateText = { running: "진행 중", done: "완료", failed: "실패" }[job.state] ?? job.state;
  const head = el("div");
  head.append(el("span", `dot ${job.state === "running" ? "wait" : job.state === "done" ? "on" : "off"}`));
  head.append(document.createTextNode(`${label} ${stateText}`));
  wrap.append(head);

  const ol = el("ol");
  for (const s of job.steps) ol.append(el("li", null, `${new Date(s.at).toLocaleTimeString("ko-KR")}  ${s.text}`));
  wrap.append(ol);

  if (job.error) {
    const p = el("p", "note warn", job.error);
    wrap.append(p);
  }
  box.append(wrap);
}

async function control(kind, labels) {
  const o = lastOverview;
  const playerCount = o?.server.playerCount ?? 0;

  let confirmPlayers = false;
  if (kind !== "start" && playerCount > 0) {
    const ok = await confirmAction({
      title: `지금 접속자가 ${playerCount}명 있다`,
      body: `${labels.verb}하면 플레이 중인 ${playerCount}명이 즉시 끊긴다. 그래도 진행하겠는가.`,
      okLabel: `${labels.verb}한다`,
    });
    if (!ok) return;
    confirmPlayers = true;
  } else {
    const ok = await confirmAction({
      title: `${labels.verb}하겠는가`,
      body: labels.detail,
      okLabel: `${labels.verb}한다`,
    });
    if (!ok) return;
  }

  const r = await api(`/api/server/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ confirm: true, confirmPlayers }),
  });

  if (!r.ok) {
    // 서버 쪽에서 그 사이에 접속자가 생긴 것을 발견한 경우다.
    if (r.body?.needsPlayerConfirm) {
      const ok = await confirmAction({
        title: `방금 접속자가 ${r.body.playerCount}명 확인되었다`,
        body: `${labels.verb}하면 그대로 끊긴다. 진행하겠는가.`,
        okLabel: `${labels.verb}한다`,
      });
      if (!ok) return;
      await api(`/api/server/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, confirmPlayers: true }),
      });
    } else {
      alert(r.body?.error ?? "요청이 거부되었다");
      return;
    }
  }
  refreshOverview();
}

$("#btnStart").addEventListener("click", () =>
  control("start", { verb: "시작", detail: "컨테이너를 시작한다. 접속을 받기까지 1분 넘게 걸릴 수 있다." }),
);
$("#btnStop").addEventListener("click", () =>
  control("stop", { verb: "중지", detail: "월드 저장 유예 때문에 최대 2분 걸린다. 그동안 기다린다." }),
);
$("#btnRestart").addEventListener("click", () =>
  control("restart", { verb: "재시작", detail: "중지 유예 2분 뒤 다시 올라온다. 서버가 접속을 받을 때까지 진행 상황을 표시한다." }),
);

async function refreshOverview() {
  const r = await api("/api/overview");
  if (r.ok) renderOverview(r.body);
}

// ------------------------------------------------------------------ 모드 대조 탭

const VERDICT_CLASS = { ok: "ok", versionMismatch: "warnish", ghost: "warnish", missing: "bad", notLoaded: "bad", initFailed: "bad" };

async function loadDrift() {
  $("#driftTable").replaceChildren(el("p", "empty", "검사하는 중"));
  const r = await api("/api/drift");
  const d = r.body;

  const strip = $("#driftSummary");
  strip.replaceChildren();

  if (!d.containerRunning) {
    $("#driftTable").replaceChildren(el("p", "empty", d.message));
    $("#driftMeta").textContent = "";
    return;
  }

  const c = d.result.counts;
  const pill = (label, n, cls) => {
    const p = el("span", `pill ${cls ?? ""}`);
    p.append(el("b", null, String(n)));
    p.append(document.createTextNode(label));
    return p;
  };
  strip.append(pill("정상", c.ok, c.ok > 0 ? "ok" : ""));
  if (c.initFailed) strip.append(pill("초기화 실패", c.initFailed, "bad"));
  if (c.missing) strip.append(pill("미설치", c.missing, "bad"));
  if (c.notLoaded) strip.append(pill("로드 안 됨", c.notLoaded, "bad"));
  if (c.versionMismatch) strip.append(pill("버전 불일치", c.versionMismatch, "bad"));
  if (c.ghost) strip.append(pill("유령 모드", c.ghost, "bad"));

  $("#driftMeta").textContent =
    `선언 ${d.declaredCount}개 · plugins 항목 ${d.pluginFileCount}개 · cfg ${d.configFileCount}개 · patcher ${d.patcherCount ?? "?"}개 로드`;

  const table = el("table");
  const thead = el("thead");
  const hr = el("tr");
  for (const h of ["판정", "모드", "계층", "선언 버전", "실제 버전", "파일", "로드", "config"]) {
    hr.append(el("th", h === "모드" ? null : "nw", h));
  }
  thead.append(hr);
  table.append(thead);

  const order = ["initFailed", "missing", "notLoaded", "versionMismatch", "ghost", "ok"];
  const rows = [...d.result.entries].sort((a, b) => order.indexOf(a.verdict) - order.indexOf(b.verdict));

  const tbody = el("tbody");
  for (const e of rows) {
    const tr = el("tr", e.verdict === "ok" ? "" : "bad");
    const tdV = el("td");
    tdV.append(el("span", `tag ${VERDICT_CLASS[e.verdict] ?? ""}`, e.verdictLabel));
    tr.append(tdV);

    const tdName = el("td");
    tdName.append(el("div", null, e.name));
    tdName.append(el("div", "mono mod-note", e.owner ? `${e.owner}/${e.id}` : e.id));
    for (const n of e.notes) tdName.append(el("div", "mod-note", n));
    tr.append(tdName);

    tr.append(el("td", "nw", e.tier ? `${e.tier}층` : e.source === "dependency" ? "의존성" : "-"));
    tr.append(el("td", "mono nw", e.declaredVersion ?? "-"));
    tr.append(el("td", "mono nw", e.actualVersion ?? "-"));
    tr.append(el("td", "nw", e.installed ? "있음" : "없음"));
    tr.append(el("td", "nw", e.loaded ? "됨" : "안 됨"));
    tr.append(el("td", "nw", e.hasConfig ? "있음" : e.configOptional ? "없음(정상)" : "없음"));
    tbody.append(tr);
  }
  table.append(tbody);
  $("#driftTable").replaceChildren(table);
}

$("#btnDriftReload").addEventListener("click", loadDrift);

// ------------------------------------------------------------------ 로그 탭

async function loadLogs() {
  const filter = $("#logFilter").value;
  const limit = $("#logLimit").value;
  const search = $("#logSearch").value.trim();
  $("#logBox").textContent = "불러오는 중";

  const r = await api(`/api/logs?filter=${encodeURIComponent(filter)}&limit=${limit}&search=${encodeURIComponent(search)}`);
  if (!r.ok) {
    $("#logBox").textContent = r.body?.error ?? "로그를 읽지 못했다";
    return;
  }
  const box = $("#logBox");
  box.replaceChildren();
  if (r.body.lines.length === 0) {
    box.textContent = "해당하는 줄이 없다";
  } else {
    for (const line of r.body.lines) {
      box.append(el("span", `line l-${line.level ?? "none"}`, line.text + "\n"));
    }
  }
  $("#logMeta").textContent = `일치 ${r.body.totalMatched}줄 중 최근 ${r.body.lines.length}줄`;
  box.scrollTop = box.scrollHeight;
}

for (const id of ["#logFilter", "#logLimit"]) $(id).addEventListener("change", loadLogs);
$("#btnLogReload").addEventListener("click", loadLogs);
$("#logSearch").addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadLogs();
});

// ------------------------------------------------------------------ 백업 탭

async function loadBackups() {
  const r = await api("/api/backups");
  const d = r.body;
  const meta = $("#backupMeta");
  meta.replaceChildren();

  const kv = el("dl", "kv");
  const add = (k, v) => {
    kv.append(el("dt", null, k));
    kv.append(el("dd", "mono", v));
  };
  add("컨테이너 안 경로", d.containerDir ?? "-");
  add("compose 설정", d.hostSpec ?? "-");
  add("호스트 경로", d.absDir ?? "-");
  add("경로 출처", d.source ?? "-");
  meta.append(kv);
  meta.append(el("p", "note", "이 패널은 백업을 읽기만 한다. 지우거나 되돌리는 기능은 만들지 않았다. 월드 데이터를 건드리는 실수는 되돌릴 수 없다."));

  const list = $("#backupList");
  list.replaceChildren();
  if (!d.available || !d.summary) {
    list.append(el("p", "empty", d.reason ?? "백업 디렉터리를 읽지 못했다"));
    return;
  }

  const head = el("p", "empty", `${d.summary.count}개 · 합계 ${d.summary.totalSize}`);
  list.append(head);

  const table = el("table");
  const thead = el("thead");
  const hr = el("tr");
  for (const h of ["파일", "시각", "경과", "크기"]) hr.append(el("th", null, h));
  thead.append(hr);
  table.append(thead);
  const tbody = el("tbody");
  for (const b of d.summary.items) {
    const tr = el("tr");
    tr.append(el("td", "mono", b.name));
    tr.append(el("td", null, new Date(b.at).toLocaleString("ko-KR")));
    tr.append(el("td", null, b.age));
    tr.append(el("td", "mono", b.sizeText));
    tbody.append(tr);
  }
  table.append(tbody);
  list.append(table);
}

// ------------------------------------------------------------------ 주기 갱신

refreshOverview();
setInterval(() => {
  // 서버 탭을 보고 있거나 작업이 도는 중에만 갱신한다.
  if (activeTab === "server" || (lastOverview?.job && lastOverview.job.state === "running")) refreshOverview();
}, 4000);
