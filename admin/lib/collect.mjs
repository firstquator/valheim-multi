// 실제 상태 수집. **부수효과가 여기에 모여 있다.**
//
// 도커 실행, 파일 읽기, 디렉터리 훑기가 전부 이 파일에만 있다.
// 판정과 가공은 drift.mjs, logfilter.mjs, backups.mjs 의 순수 함수가 한다.
// 경계를 얇게 유지해야 테스트가 도커 없이 돌아간다.

import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const CONTAINER = process.env.VALHEIM_CONTAINER || "valheim";

/** 저장소 루트. admin/lib 에서 두 단계 위다. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
export const SERVER_DIR = path.join(REPO_ROOT, "server");

/** 컨테이너 안의 BepInEx 경로. compose 가 /config 볼륨을 여기에 붙인다. */
const PLUGINS_DIR = "/config/bepinex/plugins";
const CONFIG_DIR = "/config/bepinex";

class CommandError extends Error {
  constructor(message, { code, stderr }) {
    super(message);
    this.name = "CommandError";
    this.code = code;
    this.stderr = stderr;
  }
}

/**
 * 외부 명령을 실행한다. 셸을 거치지 않으므로 인자에 따옴표를 붙이지 않는다.
 *
 * 실패하면 stderr 원문을 그대로 실어 던진다. 스펙 12절이 정한 것이다.
 * "알 수 없는 오류" 는 디버깅을 막는다. 화면에 내보내기 전에
 * redactSecrets 를 반드시 통과시킨다.
 */
export function run(cmd, args, { timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout, maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new CommandError(`${cmd} ${args.join(" ")} 실패: ${err.message}`, {
          code: err.code ?? null,
          stderr: String(stderr ?? ""),
        }));
        return;
      }
      resolve({ stdout: String(stdout ?? ""), stderr: String(stderr ?? "") });
    });
  });
}

const docker = (args, opts) => run("docker", args, opts);

/** 컨테이너가 있는가, 돌고 있는가. 없으면 running:false 로 돌려준다. */
export async function containerState() {
  try {
    const { stdout } = await docker([
      "inspect",
      CONTAINER,
      "--format",
      "{{.State.Status}}|{{.State.StartedAt}}|{{.State.Running}}|{{.Config.StopTimeout}}",
    ]);
    const [status, startedAt, running, stopTimeout] = stdout.trim().split("|");
    return {
      exists: true,
      status,
      startedAt,
      running: running === "true",
      stopTimeout: Number(stopTimeout) || null,
    };
  } catch (err) {
    return { exists: false, status: "없음", startedAt: null, running: false, stopTimeout: null, error: err.stderr || err.message };
  }
}

/**
 * 컨테이너 안의 status.json 을 읽는다.
 *
 * 상태 HTTP 는 호스트에 노출되어 있지 않다(compose 의 STATUS_HTTP 주석 참고).
 * 컨테이너 안에서 curl 로만 읽을 수 있다.
 */
export async function serverStatus() {
  try {
    const { stdout } = await docker(["exec", CONTAINER, "sh", "-c", "curl -s http://localhost/status.json"], {
      timeout: 10_000,
    });
    const parsed = JSON.parse(stdout);
    return {
      ok: parsed?.error == null,
      name: parsed?.server_name ?? null,
      playerCount: Number(parsed?.player_count) || 0,
      lastUpdate: parsed?.last_status_update ?? null,
      // keywords 에는 월드 설정 문자열이 들어 있다. 비밀값은 없지만
      // 화면에 쓰지 않으므로 게임 버전만 뽑아 둔다.
      gameVersion: (String(parsed?.keywords ?? "").match(/(?:^|(?<!\\),)g=([^,\\]+)/) ?? [])[1] ?? null,
    };
  } catch (err) {
    return { ok: false, name: null, playerCount: 0, lastUpdate: null, gameVersion: null, error: err.stderr || err.message };
  }
}

/** plugins 디렉터리의 항목 이름. 파일이 없으면 빈 배열이다. */
export async function pluginFiles() {
  const { stdout } = await docker(["exec", CONTAINER, "sh", "-c", `ls -1 ${PLUGINS_DIR} 2>/dev/null || true`]);
  return stdout.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
}

/** /config/bepinex 의 .cfg 파일 이름. */
export async function configFiles() {
  const { stdout } = await docker([
    "exec",
    CONTAINER,
    "sh",
    "-c",
    `ls -1 ${CONFIG_DIR}/*.cfg 2>/dev/null || true`,
  ]);
  return stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => p.split("/").pop());
}

/**
 * 컨테이너 로그.
 *
 * @param {object} [opts]
 * @param {string} [opts.since] ISO 시각. 생략하면 tail 로 자른다
 * @param {number} [opts.tail] 최근 줄 수
 */
export async function containerLog({ since = null, tail = 4000 } = {}) {
  const args = ["logs"];
  if (since) args.push("--since", since);
  else args.push("--tail", String(tail));
  args.push(CONTAINER);
  // docker logs 는 stdout 과 stderr 를 나눠 준다. 발헤임 로그는 양쪽에 섞인다.
  const { stdout, stderr } = await docker(args, { timeout: 60_000 });
  return `${stdout}\n${stderr}`;
}

/** 서버 제어. 파괴적인 동작이라 호출 전에 확인을 받는 것은 server.mjs 의 책임이다. */
export function startContainer() {
  return docker(["start", CONTAINER], { timeout: 60_000 });
}

/**
 * 중지와 재시작에는 반드시 넉넉한 타임아웃을 준다.
 *
 * compose 의 stop_grace_period 가 2분이다. 월드 저장이 끝날 시간을 주려는
 * 것이다. docker stop 의 기본값은 10초라 그대로 쓰면 저장 중에 끊길 수 있고,
 * 그러면 월드가 손상된다.
 */
export function stopContainer() {
  return docker(["stop", "-t", "120", CONTAINER], { timeout: 180_000 });
}

export function restartContainer() {
  return docker(["restart", "-t", "120", CONTAINER], { timeout: 240_000 });
}

/** `.env` 를 키와 값의 맵으로 읽는다. 값은 절대 응답에 싣지 않는다. */
export async function readEnvFile(file) {
  try {
    const text = await readFile(file, "utf8");
    const out = {};
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * 로그에서 가릴 비밀값을 모은다.
 *
 * 값 자체는 어디에도 기록하지 않고 redactSecrets 에만 넘긴다.
 * 키 이름으로 고르며, 목록에 없는 키는 아예 읽지 않은 것처럼 다룬다.
 */
const SECRET_KEYS = [/PASS/i, /PASSWORD/i, /TOKEN/i, /SECRET/i, /KEY$/i];

export function secretsFromEnv(envVars) {
  const out = [];
  for (const [k, v] of Object.entries(envVars ?? {})) {
    if (typeof v !== "string" || v.length < 4) continue;
    if (SECRET_KEYS.some((re) => re.test(k))) out.push(v);
  }
  return out;
}

/** 백업 디렉터리를 훑는다. 읽기만 한다. */
export async function readBackupDir(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    const s = await stat(path.join(dir, e.name));
    out.push({ name: e.name, size: s.size, mtimeMs: s.mtimeMs });
  }
  return out;
}

export { CommandError };
