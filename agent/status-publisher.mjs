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

const run = promisify(execFile);

const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_ID = process.env.GIST_ID;
const GIST_FILE = "valheim-status.json";
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

// 일시적인 네트워크 오류에 대비해 짧게 재시도한다.
// 토큰은 절대 로그나 에러 메시지에 담지 않는다.
async function pushGist(payload, attempt = 1) {
  try {
    const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${GIST_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: { [GIST_FILE]: { content: JSON.stringify(payload, null, 2) } },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gist 갱신 실패 status=${res.status}`);
    }
  } catch (e) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1000 * attempt));
      return pushGist(payload, attempt + 1);
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

    const payload = buildPayload({
      statusRaw,
      running,
      players: parsePlayers(logText),
      backup,
      address,
      nowIso: new Date().toISOString(),
    });

    await pushGist(payload);
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
tick();
setInterval(tick, INTERVAL);
