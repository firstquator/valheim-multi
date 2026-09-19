// 사람이 없을 때 서버를 다시 띄운다. 매일 06시에 예약되어 있다.
//
// 처음에는 예약해 둔 설정(자원 2배 등)을 적용하려고 만들었다. 그 일은
// 2026-09-19 에 끝났고, 지금 이 스크립트가 남아 있는 이유는 다른 데 있다.
// 유니티 GC 가 도는 데 1.4 초까지 걸리고 그동안 서버가 통째로 멈추는데,
// 오래 켜 둘수록 그 시간이 길어진다. 하루에 한 번 다시 띄우면 짧아진다.
//
// 접속자가 있는데 말없이 끊으면 안 되므로 인원을 먼저 확인하고,
// 0 이 아니면 아무것도 하지 않고 종료한다.
//
// restart 를 쓴다. up -d 가 아니다.
//
// 이 차이가 중요하다. 게임 파일은 볼륨이 아니라 컨테이너 안에 있어서,
// up -d 가 컨테이너를 다시 만들면 2.2GB 를 새로 받는다. 그것만이면
// 시간 문제지만 그때 게임 판올림도 같이 딸려 온다. 실제로 그렇게
// 1.0.14 에서 1.0.15 로 올라가 친구들이 전원 못 들어온 적이 있다.
// 모드 버전을 다시 맞추느라 하루가 갔다.
//
// compose 파일을 고쳐 그 내용을 반영해야 할 때는 사람이 직접
// `docker compose up -d` 를 하되, 판올림을 감당할 수 있는 때에 한다.

import { execFileSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = process.env.VALHEIM_CONTAINER || "valheim";
const LOG = resolve(root, "agent", "apply-server-changes.log");

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  try {
    appendFileSync(LOG, stamped + "\n");
  } catch {
    // 로그를 못 써도 작업 자체는 계속한다.
  }
}

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { encoding: "utf8", ...opts });
}

/** 컨테이너 안에서 status.json 을 읽는다. 호스트에 포트가 열려 있지 않다. */
function playerCount() {
  const out = sh("docker", ["exec", CONTAINER, "sh", "-c", "curl -s http://localhost/status.json"]);
  return JSON.parse(out).player_count;
}

function main() {
  log("예약 작업 시작");

  let before;
  try {
    before = playerCount();
  } catch (e) {
    log(`접속 인원을 읽지 못했다. 아무것도 하지 않는다: ${e.message}`);
    process.exit(1);
  }

  if (before !== 0) {
    // 사람이 있으면 건드리지 않는다. 다음 기회에 다시 시도한다.
    log(`접속자 ${before} 명. 재시작하지 않고 종료한다`);
    process.exit(0);
  }

  log("접속자 0 명 확인. 재시작한다");
  // up -d 를 쓰지 않는다. 위의 주석을 본다.
  sh("docker", ["compose", "restart"], { cwd: resolve(root, "server") });

  // 서버가 다시 뜰 때까지 기다린다. 컨테이너가 떴는지가 아니라
  // status.json 이 응답하는지로 판정한다. 컨테이너는 먼저 뜨고
  // 게임 서버는 한참 뒤에 준비된다.
  const deadline = Date.now() + 5 * 60 * 1000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      playerCount();
      ready = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000);
    }
  }

  if (!ready) {
    log("5 분 안에 서버가 응답하지 않았다. 사람이 확인해야 한다");
    process.exit(1);
  }

  log("서버 응답 확인");

  // 적용 결과를 로그에 남긴다. 아침에 이것만 봐도 됐는지 알 수 있다.
  const bootLog = sh("docker", ["logs", CONTAINER, "--since", "10m"]);
  for (const name of ["PrefabConfigurator", "ServersideQoL.Player"]) {
    log(`${name} 로드: ${bootLog.includes(name) ? "확인" : "안 보임"}`);
  }
  const args = sh("docker", ["exec", CONTAINER, "sh", "-c", "ps aux | grep -o 'valheim_server.x86_64.*' | head -1"]);
  log(`실행 인자: ${args.trim()}`);
  log(`modifier 인자 포함: ${args.includes("-modifier resources muchmore") ? "확인" : "없음"}`);

  log("예약 작업 완료");
}

main();
