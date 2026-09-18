// 드리프트 감지: 선언한 것(`data/mods.json`)과 실제로 깔린 것을 비교한다.
//
// 이 파일에는 부수효과가 없다. 도커를 실행하지 않고 입력만 받아 판정한다.
// 실제 상태 수집은 admin/lib/collect.mjs 가 맡는다. 그래야 판정을
// 서버 없이 테스트할 수 있다.
//
// 이 기능이 있는 이유는 실제로 겪은 사고다. `ServersideQoL` 이 로그에
// `Loading [ServersideQoL 2.0.13]` 으로 뜨는데 패처 DLL 이 없어 config 조차
// 만들지 못한 채 기능이 전부 죽어 있었다. 로그만 보면 정상으로 보였다.
// 그래서 "로드됐지만 config 가 없음" 을 별도 판정으로 둔다.

import { normalizeName } from "./mod-identity.mjs";

/** 판정 코드. 화면 문구는 LABELS 에서 가져온다. */
export const VERDICT = {
  OK: "ok",
  MISSING: "missing",
  NOT_LOADED: "notLoaded",
  VERSION_MISMATCH: "versionMismatch",
  GHOST: "ghost",
  INIT_FAILED: "initFailed",
};

export const VERDICT_LABEL = {
  [VERDICT.OK]: "정상",
  [VERDICT.MISSING]: "미설치",
  [VERDICT.NOT_LOADED]: "로드 안 됨",
  [VERDICT.VERSION_MISMATCH]: "버전 불일치",
  [VERDICT.GHOST]: "유령 모드",
  [VERDICT.INIT_FAILED]: "초기화 실패",
};

/** 정상이 아닌 판정. 요약과 화면 정렬에 쓴다. */
export const PROBLEM_VERDICTS = [
  VERDICT.INIT_FAILED,
  VERDICT.MISSING,
  VERDICT.NOT_LOADED,
  VERDICT.VERSION_MISMATCH,
  VERDICT.GHOST,
];

const EXT_RE = /\.(dll|json|mdb|yml|yaml|xlsx|cfg|txt|pdb|md|zip)$/i;

/** 파일명에서 확장자를 떼고 정규화한다. 경로가 섞여 있으면 첫 구간만 본다. */
function fileToken(fileName) {
  const head = String(fileName).split(/[\\/]/)[0];
  return normalizeName(head.replace(EXT_RE, ""));
}

/**
 * 예외표에 이름이 적혀 있으면 그 이름과 정확히 같은지 본다.
 * 없으면 정규화한 파일명이 모드 id 로 **끝나는지** 본다.
 *
 * 끝나는지를 보는 이유: 단순 포함으로 하면 `ServersideQoL` 이
 * `ServersideQoL.AutoDoors.dll` 에도 걸려서, 프레임워크 본체가 사라져도
 * 모듈 파일 때문에 "설치됨" 으로 보인다. 접두사는 배포자 이름
 * (`advize.`, `ArgusMagnus.`) 이라 붙어도 되지만 접미사는 다른 모드다.
 */
function nameMatches(candidates, defaultToken, token) {
  if (Array.isArray(candidates) && candidates.length > 0) {
    return candidates.some((c) => fileToken(c) === token);
  }
  return token.endsWith(defaultToken);
}

/**
 * @param {object} args
 * @param {Array} args.declared declaredServerMods() 결과
 * @param {string[]} args.pluginFiles /config/bepinex/plugins 의 항목 이름
 * @param {string[]} args.configFiles /config/bepinex 의 .cfg 파일 이름
 * @param {Array<{name: string, version: string}>} args.loadedPlugins 로그에서 뽑은 로드 목록
 * @param {boolean} [args.bootLogFound] 로그에서 기동 블록을 찾았는가
 */
export function detectDrift({ declared, pluginFiles, configFiles, loadedPlugins, bootLogFound = true }) {
  const files = (pluginFiles ?? []).map(fileToken).filter(Boolean);
  const configs = (configFiles ?? []).map(fileToken).filter(Boolean);
  const loaded = (loadedPlugins ?? []).map((p) => ({
    name: p.name,
    version: p.version ?? null,
    norm: normalizeName(p.name),
  }));

  const claimedLoaded = new Set();
  const entries = [];

  for (const mod of declared ?? []) {
    const idToken = normalizeName(mod.id);

    const installed = files.some((f) => nameMatches(mod.fileNames, idToken, f));
    const hasConfig = configs.some((c) => nameMatches(mod.configNames, idToken, c));

    const wanted = (mod.pluginNames ?? [mod.id]).map(normalizeName);
    const hits = loaded.filter((p) => wanted.includes(p.norm));
    for (const h of hits) claimedLoaded.add(h.norm);

    const actualVersion = hits.length > 0 ? hits[0].version : null;
    const versionMismatch =
      hits.length > 0 &&
      actualVersion != null &&
      mod.version != null &&
      !mod.ignoreVersion &&
      actualVersion !== mod.version;

    const notes = [];
    let verdict;
    if (!installed) {
      verdict = VERDICT.MISSING;
      notes.push("plugins 디렉터리에 파일이 없다");
      if (hits.length > 0) notes.push("그런데 로그에는 로드된 것으로 나온다. 다른 경로에 사본이 있을 수 있다");
    } else if (hits.length === 0) {
      verdict = VERDICT.NOT_LOADED;
      notes.push(
        bootLogFound
          ? "파일은 있는데 최근 기동 로그에 Loading 기록이 없다"
          : "로그에서 기동 블록을 찾지 못해 로드 여부를 확인할 수 없다",
      );
    } else if (!hasConfig && !mod.configOptional) {
      // 핵심 판정. 로그에는 Loading 으로 떠서 정상처럼 보이지만
      // 초기화 도중 죽어 설정 파일조차 만들지 못한 상태다.
      verdict = VERDICT.INIT_FAILED;
      notes.push("로그에는 로드됐다고 나오지만 config 파일이 없다. 초기화 중에 실패했을 수 있다");
      notes.push("patchers 디렉터리의 DLL 누락이 과거의 원인이었다. 로그에서 patcher plugins loaded 수를 확인한다");
    } else if (versionMismatch) {
      verdict = VERDICT.VERSION_MISMATCH;
      notes.push(`선언은 ${mod.version} 인데 로드된 것은 ${actualVersion} 이다`);
    } else {
      verdict = VERDICT.OK;
      if (!hasConfig && mod.configOptional) {
        notes.push(`config 가 없는 것이 정상인 모드다: ${mod.identityNote ?? "설정 항목이 없다"}`);
      }
    }

    if (versionMismatch && verdict !== VERDICT.VERSION_MISMATCH) {
      notes.push(`버전도 어긋난다. 선언 ${mod.version}, 실제 ${actualVersion}`);
    }

    entries.push({
      key: mod.key,
      id: mod.id,
      owner: mod.owner,
      name: mod.name,
      tier: mod.tier,
      source: mod.source,
      declaredVersion: mod.version ?? null,
      actualVersion,
      installed,
      loaded: hits.length > 0,
      loadedAs: hits.map((h) => h.name),
      hasConfig,
      configOptional: mod.configOptional === true,
      verdict,
      verdictLabel: VERDICT_LABEL[verdict],
      notes,
    });
  }

  // 선언에 없는데 로드된 것. 같은 이름이 두 번 뜨면 한 번만 센다.
  const seenGhost = new Set();
  for (const p of loaded) {
    if (claimedLoaded.has(p.norm) || seenGhost.has(p.norm)) continue;
    seenGhost.add(p.norm);
    entries.push({
      key: p.name,
      id: p.name,
      owner: null,
      name: p.name,
      tier: null,
      source: "log",
      declaredVersion: null,
      actualVersion: p.version,
      installed: true,
      loaded: true,
      loadedAs: [p.name],
      hasConfig: configs.some((c) => c.endsWith(p.norm)),
      configOptional: false,
      verdict: VERDICT.GHOST,
      verdictLabel: VERDICT_LABEL[VERDICT.GHOST],
      notes: ["data/mods.json 에 선언이 없는데 서버에 로드되어 있다"],
    });
  }

  const counts = {};
  for (const v of Object.values(VERDICT)) counts[v] = 0;
  for (const e of entries) counts[e.verdict] += 1;

  return {
    entries,
    counts,
    problemCount: PROBLEM_VERDICTS.reduce((n, v) => n + counts[v], 0),
    bootLogFound,
  };
}
