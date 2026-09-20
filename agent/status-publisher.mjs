#!/usr/bin/env node
// 30초마다 서버 상태를 수집해 GitHub Gist 에 올린다.
//
// 관리 패널과 분리되어 있다. 관리 패널을 켜지 않아도
// 친구들은 서버 상태를 볼 수 있어야 하기 때문이다.
//
// 필요한 환경변수:
//   GIST_TOKEN   gist 스코프를 가진 GitHub 토큰
//   GIST_ID      대상 Gist 의 id
// 선택:
//   BACKUP_DIR   기본값 C:/ValheimServer/backups
//   INTERVAL_SEC 기본값 30

import { execFile } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { promisify } from "node:util";
import { parsePlayers } from "./lib/logparse.mjs";
import { buildPayload } from "./lib/collect.mjs";
import { emptyHistory, readHistory, foldSample, pruneHistory } from "./lib/history.mjs";

const run = promisify(execFile);

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GIST_FILE = "valheim-status.json";
// 같은 Gist 안에 접속 기록을 함께 둔다. 상태는 덮어쓰는 값이고 기록은
// 쌓이는 값이라 파일을 갈라 둔다. 친구 브라우저도 필요할 때만 받아 간다.
const HISTORY_FILE = "valheim-history.json";
const BACKUP_DIR = process.env.BACKUP_DIR ?? "C:/ValheimServer/backups";
const INTERVAL = Number(process.env.INTERVAL_SEC ?? 30) * 1000;

if (!GIST_TOKEN || !GIST_ID) {
  console.error("GIST_TOKEN 과 GIST_ID 환경변수가 필요합니다.");
  process.exit(1);
}

const log = (...a) => console.log(new Date().toISOString(), ...a);

// 연속 실패 횟수. 너무 오래 실패하면 프로세스를 죽여서
// 상위 프로세스 매니저(예: 작업 스케줄러, pm2)가 재시작하도록 한다.
// 조용히 계속 실패만 반복하는 상태를 막기 위함이다.
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = Number(process.env.MAX_CONSECUTIVE_FAILURES ?? 20);

async function containerRunning() {
  try {
    const { stdout } = await run("docker", ["inspect", "-f", "{{.State.Running}}", "valheim"]);
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

async function fetchStatusRaw() {
  try {
    const { stdout } = await run("docker", [
      "exec", "valheim", "curl", "-s", "--max-time", "5", "http://127.0.0.1/status.json",
    ]);
    return stdout;
  } catch {
    return "";
  }
}

async function recentLog() {
  try {
    const { stdout } = await run("docker", ["logs", "--since", "12h", "valheim"], {
      maxBuffer: 32 * 1024 * 1024,
    });
    return stdout;
  } catch {
    return "";
  }
}

async function backupInfo() {
  try {
    const files = (await readdir(BACKUP_DIR)).filter((f) => f.endsWith(".zip"));
    if (files.length === 0) return { lastAt: null, count: 0 };
    let newest = 0;
    for (const f of files) {
      const s = await stat(`${BACKUP_DIR}/${f}`);
      if (s.mtimeMs > newest) newest = s.mtimeMs;
    }
    return { lastAt: new Date(newest).toISOString(), count: files.length };
  } catch {
    return { lastAt: null, count: 0 };
  }
}

async function publicAddress() {
  try {
    const res = await fetch("https://ipv4.icanhazip.com", { signal: AbortSignal.timeout(8000) });
    const ip = (await res.text()).trim();
    return `${ip}:2456`;
  } catch {
    return null;
  }
}

// 접속 기록. 프로세스가 죽었다 살아나도 이어 쌓아야 하므로 시작할 때
// 한 번 읽어 온다. 그 뒤로는 메모리에 들고 있다가 매번 함께 올린다.
//
// 읽지 못했으면 올리지 않는다. 빈 기록을 올리면 지금까지 쌓인 것을
// 통째로 덮어쓴다. 한 번 실패해도 다음 주기에 다시 읽어 본다.
let history = emptyHistory();
let historyLoaded = false;

async function loadHistory() {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        Accept: "application/vnd.github+json",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(`status=${res.status}`);
    const gist = await res.json();
    const file = gist.files?.[HISTORY_FILE];

    // 아직 한 번도 안 올린 Gist 면 파일이 없다. 그건 실패가 아니다.
    if (!file) {
      history = emptyHistory();
      historyLoaded = true;
      log("접속 기록이 아직 없다. 새로 시작한다.");
      return;
    }

    // 파일이 1MB 를 넘으면 Gist 가 content 를 잘라서 준다. 우리 파일은
    // 그보다 훨씬 작지만, 잘린 것을 그대로 파싱하면 빈 기록이 되어
    // 과거를 통째로 날린다. 그때는 원본을 따로 받아 온다.
    const raw = file.truncated
      ? await (await fetch(file.raw_url, { signal: AbortSignal.timeout(10000) })).text()
      : file.content;

    history = readHistory(raw);
    historyLoaded = true;
    log(`접속 기록 ${Object.keys(history.hours).length} 칸을 이어받았다.`);
  } catch (e) {
    historyLoaded = false;
    log("접속 기록을 읽지 못했다. 덮어쓰지 않고 다음 주기에 다시 시도한다:", e.message);
  }
}

// 일시적인 네트워크 오류에 대비해 짧게 재시도한다.
// 토큰은 절대 로그나 에러 메시지에 담지 않는다.
async function pushGist(files, attempt = 1) {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ files }),
    });
    if (!res.ok) {
      throw new Error(`Gist 갱신 실패 status=${res.status}`);
    }
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return pushGist(files, attempt + 1);
    }
    throw e;
  }
}

async function tick() {
  try {
    const running = await containerRunning();
    const [statusRaw, logText, backup, address] = await Promise.all([
      running ? fetchStatusRaw() : Promise.resolve(""),
      running ? recentLog() : Promise.resolve(""),
      backupInfo(),
      publicAddress(),
    ]);

    const nowIso = new Date().toISOString();
    const payload = buildPayload({
      statusRaw,
      running,
      players: parsePlayers(logText),
      backup,
      address,
      nowIso,
    });

    // 기록을 아직 못 읽었으면 여기서 한 번 더 시도한다. 성공할 때까지는
    // 상태만 올린다.
    if (!historyLoaded) await loadHistory();

    const files = { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } };
    if (historyLoaded) {
      // 표본 하나가 대신하는 시간이 곧 주기다. 개수가 아니라 분으로 세야
      // 나중에 주기를 바꿔도 예전 기록과 앞뒤가 맞는다.
      //
      // 접속자 이름은 payload 쪽을 쓴다. collect.mjs 가 status.json 의
      // 인원수로 한 번 걸러 주므로, 로그 파싱이 퇴장을 놓쳤을 때
      // 있지도 않은 사람의 플레이 시간이 쌓이는 것을 막는다.
      history = pruneHistory(
        foldSample(history, {
          nowIso,
          players: payload.server.players,
          minutes: INTERVAL / 60000,
        }),
        Date.parse(nowIso),
      );
      files[HISTORY_FILE] = { content: JSON.stringify(history) };
    }

    await pushGist(files);
    consecutiveFailures = 0;
    log(`푸시 완료 running=${payload.server.running} players=${payload.server.playerCount}`);
  } catch (e) {
    // 실패해도 죽지 않는다. 다음 주기에 다시 시도한다.
    // 페이지는 3분 뒤 자동으로 꺼짐 표시가 된다.
    consecutiveFailures += 1;
    log(`푸시 실패(${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}):`, e.message);
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log("연속 실패 한도 초과. 프로세스를 종료한다.");
      process.exit(1);
    }
  }
}

log(`status-publisher 시작. 주기 ${INTERVAL / 1000}초`);
// 기록을 먼저 읽고 첫 표본을 찍는다. 읽기가 실패해도 tick 안에서 다시
// 시도하므로 여기서 막히지 않는다.
await loadHistory();
tick();
setInterval(tick, INTERVAL);
