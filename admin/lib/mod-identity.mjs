// 선언된 모드(`data/mods.json`)와 서버에 실제로 깔린 것을 맞춰 보려면
// "이 모드가 실제로 어떤 이름으로 나타나는가" 를 알아야 한다.
// 세 가지 이름이 전부 다르다.
//
//   mods.json 의 id            ServersideQoL_AutoProcess
//   plugins 의 파일명           ServersideQoL.AutoProcess.dll
//   로그의 플러그인 이름         ServersideQoL.AutoProcess
//   config 파일명               ArgusMagnus.ServersideQoL.AutoProcess.cfg
//
// 대부분은 "영숫자만 남기고 소문자로" 정규화하면 서로 포함 관계가 된다.
// 그렇지 않은 몇 개만 예외표에 적는다. 예외는 추측이 아니라 2026-09-18 에
// 실제 컨테이너에서 읽은 값이다.

/** 영숫자만 남기고 소문자로. 점, 밑줄, 공백, 아포스트로피의 차이를 지운다. */
export function normalizeName(value) {
  if (typeof value !== "string") return "";
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * `owner/id` 를 키로 하는 예외표.
 *
 * - `pluginNames`  로그의 `Loading [<이름> <버전>]` 에 뜨는 이름
 * - `fileNames`    `/config/bepinex/plugins` 안의 파일 또는 디렉터리 이름
 * - `configNames`  `/config/bepinex/*.cfg` 의 파일 이름
 * - `configOptional` config 를 만들지 않는 것이 정상인 모드
 * - `why`          왜 예외인지. 근거 없이 예외를 늘리면 감지가 무의미해진다
 */
export const IDENTITY_OVERRIDES = {
  "WackyMole/WackyEpicMMOSystem": {
    pluginNames: ["EpicMMOSystem", "EpicMMOSystemUI"],
    fileNames: ["EpicMMOSystem.dll"],
    configNames: ["WackyMole.EpicMMOSystem.cfg", "WackyMole.EpicMMOSystemUI.cfg"],
    why: "패키지 이름은 WackyEpicMMOSystem 인데 DLL 하나가 플러그인 두 개(EpicMMOSystem, EpicMMOSystemUI)로 등록된다. 정규화로는 이어지지 않는다",
  },
  "Digitalroot/Digitalroots_Slope_Combat_Assistance": {
    pluginNames: ["Digitalroot's Slope Combat Assistance"],
    fileNames: ["Digitalroot.SlopeCombatAssistance.dll"],
    configNames: ["digitalroot.mods.slopecombatassistance.cfg"],
    why: "패키지 이름에는 소유격 s 가 붙어 있지만 DLL 과 config 에는 없다. 정규화 후에도 글자 수가 달라 포함 관계가 성립하지 않는다",
  },

  // config 를 만들지 않는 것이 정상인 모드들.
  //
  // 이 예외가 없으면 아래 네 개가 매번 "초기화 실패" 로 뜬다. 정상인데
  // 경보가 울리면 사람이 경보를 무시하게 되고, 그러면 진짜 사고(패처 DLL
  // 누락으로 ServersideQoL 이 죽었던 것)를 놓친다. 그래서 예외를 둔다.
  //
  // 대신 예외는 "설정 항목이 없다는 것이 확인된 모드" 에만 준다.
  // 확인 근거는 docs/guides/mods.md 의 "현재 상태" 표에 남아 있다.
  "MSchmoecker/MultiUserChest": {
    configOptional: true,
    why: "설정 항목 자체가 없는 모드다. DLL 에 BepInEx.Configuration 참조가 없는 것으로 확인했다(docs/guides/mods.md). config 가 없는 것이 정상이다",
  },
  "ValheimModding/Jotunn": {
    configOptional: true,
    why: "모딩 라이브러리다. 자기 설정을 /config/bepinex 에 만들지 않는다",
  },
  "shudnal/ConditionalConfigSync": {
    configOptional: true,
    why: "다른 모드가 값을 등록해야 파일이 생기는 동기화 라이브러리다. 단독으로는 config 가 없는 것이 정상이다",
  },
  "denikson/BepInExPack_Valheim": {
    skipServerCheck: true,
    why: "모드 로더 자체다. 컨테이너 이미지가 설치하며 plugins 목록에도 Loading 로그에도 플러그인으로 등장하지 않는다. 드리프트 대상이 아니다",
  },
};

/** 서버에 설치되는 계층. 2층은 각자 클라이언트에만 깔므로 서버 드리프트 대상이 아니다. */
export const SERVER_SIDE_TIERS = [1, 3];

/**
 * `data/mods.json` 에서 **서버에 있어야 하는 것** 만 뽑아 판정용 목록을 만든다.
 *
 * - 1층과 3층 모드: 서버에 설치한다
 * - 2층 모드: 개인 클라이언트 전용이라 서버에 없는 것이 정상이다. 제외한다
 * - `modpack.dependencies`: 3층 모드가 요구하는 라이브러리라 서버에도 깔려 있다.
 *   빼면 Jotunn 같은 것이 전부 "유령 모드" 로 뜬다
 *
 * @param {object} modsJson data/mods.json 을 파싱한 객체
 */
export function declaredServerMods(modsJson) {
  const out = [];
  const push = (raw, source) => {
    const key = `${raw.owner}/${raw.id}`;
    const ov = IDENTITY_OVERRIDES[key] ?? {};
    if (ov.skipServerCheck) return;
    out.push({
      key,
      owner: raw.owner,
      id: raw.id,
      version: raw.version,
      tier: raw.tier ?? null,
      name: raw.name ?? raw.id,
      source,
      pluginNames: ov.pluginNames ?? [raw.id],
      fileNames: ov.fileNames ?? null,
      configNames: ov.configNames ?? null,
      configOptional: ov.configOptional === true,
      identityNote: ov.why ?? null,
    });
  };

  for (const m of modsJson?.mods ?? []) {
    if (!SERVER_SIDE_TIERS.includes(m.tier)) continue;
    push(m, "mods");
  }
  for (const d of modsJson?.modpack?.dependencies ?? []) {
    push({ ...d, name: d.id, tier: null }, "dependency");
  }
  return out;
}
