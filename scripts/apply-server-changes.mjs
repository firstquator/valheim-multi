// 예약해 둔 서버 변경을 적용한다. 접속자가 없을 때만 재시작한다.
//
// 왜 스크립트인가.
// 변경 자체는 이미 끝나 있다. 모듈 DLL 은 볼륨에 넣었고 설정 파일도 미리
// 써 두었으며 SERVER_ARGS 도 .env 에 있다. 전부 서버가 시작할 때 읽는
// 것들이라 재시작만 하면 적용된다.
//
// 그 재시작을 사람 없이 돌리려니 안전장치가 필요하다. 접속자가 있는데
// 말없이 끊으면 안 된다. 그래서 인원을 먼저 확인하고, 0 이 아니면
// 아무것도 하지 않고 종료한다.
//
// 적용되는 것
//   자원 2배            SERVER_ARGS=-modifier resources muchmore
//   건물 파괴 불가       PrefabConfigurator / MakeIndestructible
//   비 피해 차단         PrefabConfigurator / DisableRainDamage
//   건설 무한 스태미나    Player / InfiniteBuildingStamina
//   문 자동 닫힘 해제     AutoDoors / Enabled = false

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
  sh("docker", ["compose", "up", "-d"], { cwd: resolve(root, "server") });

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
