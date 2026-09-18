// 발헤임 서버 관리 패널. 서버 PC 에서만 도는 로컬 HTTP 서버다.
//
// 실행:  node admin/server.mjs
// 열기:  http://127.0.0.1:4330
//
// ## 왜 127.0.0.1 에만 붙이는가
//
// 이 서버는 도커를 조작할 수 있다. 서버를 끄고, 재시작하고, 컨테이너 안을
// 읽는다. 인증이 없다. 0.0.0.0 에 열면 같은 네트워크의 누구나, 포트를
// 포워딩하면 인터넷의 누구나 서버를 끌 수 있다.
//
// 그래서 바인딩 주소는 설정 항목이 아니다. 코드에 박아 둔다. 포트만
// ADMIN_PORT 로 바꿀 수 있다(스펙 14절 R5).
//
// 추가로 Host 헤더를 검사한다. 바인딩만으로는 DNS 리바인딩 공격을 막지
// 못한다. 공격자가 자기 도메인을 127.0.0.1 로 가리키게 해 두면 피해자의
// 브라우저가 그 도메인으로 이 서버에 요청을 보낼 수 있다. 그때 Host 헤더는
// 공격자 도메인이므로 여기서 걸러진다.
//
// ## 의존성
//
// 런타임 의존성이 없다. node:http 와 node:child_process 로 충분하다.

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as collect from "./lib/collect.mjs";
import { declaredServerMods } from "./lib/mod-identity.mjs";
import { detectDrift } from "./lib/drift.mjs";
import { parseLoadedPlugins, filterLog, redactSecrets, FILTER_NAMES } from "./lib/logfilter.mjs";
import { summarizeBackups, resolveBackupHostDir } from "./lib/backups.mjs";
import { decideControl, DESTRUCTIVE } from "./lib/control.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ADMIN_PORT) || 4330;

const PUBLIC_DIR = fileURLToPath(new URL("./public/", import.meta.url));
const MODS_JSON = path.join(collect.REPO_ROOT, "data", "mods.json");
const COMPOSE_FILE = path.join(collect.SERVER_DIR, "docker-compose.yml");
const SERVER_ENV = path.join(collect.SERVER_DIR, ".env");

const ALLOWED_HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`]);

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
};

// ---------------------------------------------------------------- 비밀값

// .env 의 값은 프로세스 안에만 둔다. 어떤 응답에도 싣지 않는다.
// 로그를 가리는 용도로만 쓴다.
let secrets = [];
let envVars = {};

async function loadSecrets() {
  envVars = await collect.readEnvFile(SERVER_ENV);
  const agentEnv = await collect.readEnvFile(path.join(collect.REPO_ROOT, "agent", ".env"));
  secrets = [...collect.secretsFromEnv(envVars), ...collect.secretsFromEnv(agentEnv)];
}

/** 모든 응답 문자열은 여기를 거친다. 한 군데라도 빠뜨리면 값이 샌다. */
const safe = (text) => redactSecrets(String(text ?? ""), secrets);

// ---------------------------------------------------------------- 작업 상태

// 시작, 중지, 재시작은 시간이 걸린다(중지 유예만 2분이다). HTTP 응답을
// 붙잡고 기다리면 브라우저가 먼저 끊는다. 그래서 작업을 배경에서 돌리고
// 진행 상황을 따로 조회하게 한다.
let job = null;

const nowIso = () => new Date().toISOString();

function beginJob(kind) {
  job = { id: `${kind}-${Date.now()}`, kind, state: "running", startedAt: nowIso(), finishedAt: null, steps: [], error: null };
  return job;
}

function step(text) {
  if (job) job.steps.push({ at: nowIso(), text });
}

/**
 * 서버가 다시 살아났는지 판정한다.
 *
 * "컨테이너가 running" 만으로는 부족하다. 컨테이너는 몇 초 만에 뜨지만
 * 발헤임이 월드를 올리고 접속을 받기까지는 1분 넘게 걸린다. 그 사이에
 * "완료" 라고 말하면 거짓말이 된다.
 *
 * 판정 기준은 **컨테이너 안의 status.json 이 error 없이 응답하는 것**이다.
 * 이것이 곧 Steam 쿼리에 답할 수 있는 상태이고, 친구가 접속할 수 있는 상태다.
 */
async function waitUntilServing({ timeoutMs = 300_000, intervalMs = 5_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let tries = 0;
  while (Date.now() < deadline) {
    tries += 1;
    const s = await collect.serverStatus();
    if (s.ok) {
      step(`서버가 응답하기 시작했다 (${tries}번째 확인)`);
      return true;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  step("제한 시간 안에 서버가 응답하지 않았다. 로그 탭을 확인한다");
  return false;
}

async function runJob(kind) {
  try {
    if (kind === "start") {
      step("컨테이너를 시작한다");
      await collect.startContainer();
      step("컨테이너가 올라왔다. 서버가 접속을 받을 때까지 기다린다");
      await waitUntilServing();
    } else if (kind === "stop") {
      step("컨테이너를 중지한다. 월드 저장 유예로 최대 2분 걸린다");
      await collect.stopContainer();
      step("중지했다");
    } else if (kind === "restart") {
      step("컨테이너를 재시작한다. 월드 저장 유예로 최대 2분 걸린다");
      await collect.restartContainer();
      step("컨테이너가 올라왔다. 서버가 접속을 받을 때까지 기다린다");
      await waitUntilServing();
    }
    job.state = "done";
  } catch (err) {
    job.state = "failed";
    // 스펙 12절: docker 실패는 stderr 원문을 그대로 보여준다.
    // 다만 비밀값 가리기는 통과시킨다.
    job.error = safe(err.stderr || err.message);
  } finally {
    job.finishedAt = nowIso();
  }
}

// ---------------------------------------------------------------- 수집

async function gatherDrift() {
  const modsJson = JSON.parse(await readFile(MODS_JSON, "utf8"));
  const declared = declaredServerMods(modsJson);

  const state = await collect.containerState();
  if (!state.running) {
    return {
      containerRunning: false,
      message: "컨테이너가 돌고 있지 않아 실제 상태를 읽을 수 없다. 서버 탭에서 시작한다",
      declaredCount: declared.length,
      result: null,
    };
  }

  const [files, configs, log] = await Promise.all([
    collect.pluginFiles(),
    collect.configFiles(),
    collect.containerLog({ since: state.startedAt }),
  ]);

  const boot = parseLoadedPlugins(log);
  const result = detectDrift({
    declared,
    pluginFiles: files,
    configFiles: configs,
    loadedPlugins: boot.plugins,
    bootLogFound: boot.bootLogFound,
  });

  return {
    containerRunning: true,
    declaredCount: declared.length,
    pluginFileCount: files.length,
    configFileCount: configs.length,
    patcherCount: boot.patcherCount,
    expectedPlugins: boot.expected,
    result,
  };
}

async function gatherBackups() {
  const composeText = await readFile(COMPOSE_FILE, "utf8").catch(() => "");
  const resolved = resolveBackupHostDir({ composeText, envVars });
  if (!resolved.hostDir) {
    return { ...resolved, available: false, reason: "compose 에서 백업 경로를 찾지 못했다", summary: null };
  }
  const abs = path.resolve(collect.SERVER_DIR, resolved.hostDir);
  try {
    const entries = await collect.readBackupDir(abs);
    return { ...resolved, absDir: abs, available: true, summary: summarizeBackups(entries, { now: Date.now() }) };
  } catch (err) {
    return { ...resolved, absDir: abs, available: false, reason: safe(err.message), summary: null };
  }
}

// ---------------------------------------------------------------- 라우팅

function sendJson(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 64 * 1024) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function handleControl(req, res, action) {
  const body = await readBody(req);
  const jobRunning = Boolean(job && job.state === "running");

  // 접속자 수는 판정 직전에 새로 읽는다. 화면에 뜬 값은 낡았을 수 있다.
  const playerCount =
    DESTRUCTIVE.includes(action) && !jobRunning ? (await collect.serverStatus()).playerCount : 0;

  const decision = decideControl({ action, body, playerCount, jobRunning });
  if (!decision.allow) {
    sendJson(res, decision.status, {
      error: decision.reason,
      needsPlayerConfirm: decision.needsPlayerConfirm ?? false,
      playerCount,
      job: jobRunning ? job : undefined,
    });
    return;
  }

  beginJob(action);
  runJob(action);
  sendJson(res, 202, { job });
}

async function handleApi(req, res, url) {
  const p = url.pathname;

  if (req.method === "GET" && p === "/api/overview") {
    const [state, status, backups] = await Promise.all([
      collect.containerState(),
      collect.serverStatus(),
      gatherBackups(),
    ]);
    sendJson(res, 200, {
      at: nowIso(),
      container: {
        exists: state.exists,
        running: state.running,
        status: state.status,
        startedAt: state.startedAt,
        stopTimeout: state.stopTimeout,
        error: state.error ? safe(state.error) : null,
      },
      server: {
        serving: status.ok,
        name: status.name,
        playerCount: status.playerCount,
        gameVersion: status.gameVersion,
        lastUpdate: status.lastUpdate,
      },
      backups: backups.summary ? { count: backups.summary.count, latestAt: backups.summary.latestAt } : null,
      job,
    });
    return;
  }

  if (req.method === "GET" && p === "/api/drift") {
    sendJson(res, 200, await gatherDrift());
    return;
  }

  if (req.method === "GET" && p === "/api/backups") {
    sendJson(res, 200, await gatherBackups());
    return;
  }

  if (req.method === "GET" && p === "/api/logs") {
    const filter = url.searchParams.get("filter") ?? "error";
    const limit = Number(url.searchParams.get("limit")) || 200;
    const search = url.searchParams.get("search") ?? "";
    if (!FILTER_NAMES.includes(filter)) {
      sendJson(res, 400, { error: "알 수 없는 필터다", allowed: FILTER_NAMES });
      return;
    }
    // 전체를 다 쏟지 않는다. 최근 것만 가져와 필터를 건다.
    const raw = await collect.containerLog({ tail: 4000 });
    sendJson(res, 200, { filter, ...filterLog(raw, { filter, limit, secrets, search }) });
    return;
  }

  if (req.method === "GET" && p === "/api/job") {
    sendJson(res, 200, { job });
    return;
  }

  if (req.method === "POST" && p.startsWith("/api/server/")) {
    await handleControl(req, res, p.slice("/api/server/".length));
    return;
  }

  sendJson(res, 404, { error: "없는 경로다" });
}

const server = http.createServer(async (req, res) => {
  // DNS 리바인딩 방어. 바인딩만으로는 부족하다.
  const host = String(req.headers.host ?? "").toLowerCase();
  if (!ALLOWED_HOSTS.has(host)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("이 패널은 서버 PC 에서 127.0.0.1 로만 열 수 있다.");
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    const entry = STATIC[url.pathname];
    if (!entry || req.method !== "GET") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("없는 경로다.");
      return;
    }
    const body = await readFile(path.join(PUBLIC_DIR, entry[0]));
    res.writeHead(200, { "content-type": entry[1], "cache-control": "no-store" });
    res.end(body);
  } catch (err) {
    sendJson(res, 500, { error: safe(err.stderr || err.message) });
  }
});

await loadSecrets();

server.listen(PORT, HOST, () => {
  process.stdout.write(
    [
      "발헤임 관리 패널",
      `주소      http://${HOST}:${PORT}`,
      `컨테이너  ${collect.CONTAINER}`,
      `비밀값    ${secrets.length}개를 로그 가리기용으로 읽었다 (값은 화면에 나가지 않는다)`,
      "",
      "이 서버는 127.0.0.1 에만 붙어 있다. 외부에 열지 않는다.",
      "종료하려면 Ctrl+C",
      "",
    ].join("\n"),
  );
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
