import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

import { detectDrift, VERDICT } from "../admin/lib/drift.mjs";
import { declaredServerMods, normalizeName } from "../admin/lib/mod-identity.mjs";

const modsJson = JSON.parse(
  readFileSync(new URL("../data/mods.json", import.meta.url), "utf8"),
);

/** 판정표 검증용 최소 입력. 한 모드만 선언하고 실제 상태를 바꿔 가며 본다. */
const oneMod = (over = {}) => [
  {
    key: "Acme/DemoMod",
    owner: "Acme",
    id: "DemoMod",
    version: "1.0.0",
    tier: 1,
    name: "데모",
    source: "mods",
    pluginNames: ["DemoMod"],
    fileNames: null,
    configNames: null,
    configOptional: false,
    identityNote: null,
    ...over,
  },
];

const verdictOf = (result, id) => result.entries.find((e) => e.id === id)?.verdict;

describe("드리프트 판정표 (스펙 7절의 다섯 가지)", () => {
  it("선언 있음 + 버전 일치 + 로드됨 + config 있음 = 정상", () => {
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: ["DemoMod.dll"],
      configFiles: ["acme.DemoMod.cfg"],
      loadedPlugins: [{ name: "DemoMod", version: "1.0.0" }],
    });
    expect(verdictOf(r, "DemoMod")).toBe(VERDICT.OK);
    expect(r.problemCount).toBe(0);
  });

  it("선언 있음 + 파일 없음 = 미설치", () => {
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: [],
      configFiles: [],
      loadedPlugins: [],
    });
    expect(verdictOf(r, "DemoMod")).toBe(VERDICT.MISSING);
    expect(r.problemCount).toBe(1);
  });

  it("선언 있음 + 버전 다름 + 로드됨 = 버전 불일치", () => {
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: ["DemoMod.dll"],
      configFiles: ["acme.DemoMod.cfg"],
      loadedPlugins: [{ name: "DemoMod", version: "0.9.3" }],
    });
    const e = r.entries.find((x) => x.id === "DemoMod");
    expect(e.verdict).toBe(VERDICT.VERSION_MISMATCH);
    expect(e.declaredVersion).toBe("1.0.0");
    expect(e.actualVersion).toBe("0.9.3");
  });

  it("선언 없음 + 로드됨 = 유령 모드", () => {
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: ["DemoMod.dll", "Sneaky.dll"],
      configFiles: ["acme.DemoMod.cfg"],
      loadedPlugins: [
        { name: "DemoMod", version: "1.0.0" },
        { name: "Sneaky", version: "3.3.3" },
      ],
    });
    expect(verdictOf(r, "DemoMod")).toBe(VERDICT.OK);
    expect(verdictOf(r, "Sneaky")).toBe(VERDICT.GHOST);
    expect(r.counts.ghost).toBe(1);
  });

  it("선언 있음 + 로드됨 + config 없음 = 초기화 실패", () => {
    // 이것이 이 기능을 만든 이유다. 로그에는 Loading 으로 떠서 정상처럼
    // 보이지만 패처 DLL 누락으로 초기화에 실패해 기능이 전부 죽은 상태다.
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: ["DemoMod.dll"],
      configFiles: [],
      loadedPlugins: [{ name: "DemoMod", version: "1.0.0" }],
    });
    const e = r.entries.find((x) => x.id === "DemoMod");
    expect(e.verdict).toBe(VERDICT.INIT_FAILED);
    expect(e.loaded).toBe(true);
    expect(e.hasConfig).toBe(false);
    expect(e.notes.join(" ")).toContain("config");
  });
});

describe("config 를 만들지 않는 것이 정상인 모드", () => {
  it("MultiUserChest 는 config 가 없어도 정상이다", () => {
    const declared = declaredServerMods(modsJson);
    const muc = declared.find((m) => m.id === "MultiUserChest");
    expect(muc).toBeTruthy();
    expect(muc.configOptional).toBe(true);

    const r = detectDrift({
      declared: [muc],
      pluginFiles: ["MultiUserChest.dll"],
      configFiles: [],
      loadedPlugins: [{ name: "MultiUserChest", version: muc.version }],
    });
    const e = r.entries[0];
    expect(e.verdict).toBe(VERDICT.OK);
    expect(e.notes.join(" ")).toContain("정상인 모드");
  });

  it("예외가 없는 모드는 같은 조건에서 초기화 실패로 뜬다", () => {
    // 예외가 모든 모드를 덮어 버리면 경보가 무의미해진다. 예외는
    // configOptional 을 명시한 모드에만 적용된다는 것을 못 박는다.
    const declared = declaredServerMods(modsJson);
    const sqol = declared.find((m) => m.id === "ServersideQoL");
    expect(sqol.configOptional).toBe(false);

    const r = detectDrift({
      declared: [sqol],
      pluginFiles: ["ServersideQoL.dll"],
      configFiles: [],
      loadedPlugins: [{ name: "ServersideQoL", version: sqol.version }],
    });
    expect(r.entries[0].verdict).toBe(VERDICT.INIT_FAILED);
  });
});

describe("declaredServerMods 가 서버 대상만 고른다", () => {
  const declared = declaredServerMods(modsJson);
  const ids = declared.map((m) => m.id);

  it("2층 모드는 서버에 없는 것이 정상이라 대조 대상에서 뺀다", () => {
    const tier2 = modsJson.mods.filter((m) => m.tier === 2).map((m) => m.id);
    expect(tier2.length).toBeGreaterThan(0);
    for (const id of tier2) expect(ids).not.toContain(id);
  });

  it("1층과 3층 모드는 모두 포함한다", () => {
    for (const m of modsJson.mods) {
      if (m.tier === 1 || m.tier === 3) expect(ids).toContain(m.id);
    }
  });

  it("모드팩 의존성도 포함한다. 빼면 Jotunn 이 유령으로 뜬다", () => {
    expect(ids).toContain("Jotunn");
    expect(ids).toContain("ConditionalConfigSync");
  });

  it("BepInEx 로더 자체는 뺀다. 플러그인으로 등장하지 않는다", () => {
    expect(ids).not.toContain("BepInExPack_Valheim");
  });
});

describe("이름이 서로 다른 모드의 짝짓기", () => {
  it("로그 이름과 패키지 id 가 달라도 붙인다", () => {
    const declared = declaredServerMods(modsJson);
    // 실제 서버에서 확인한 조합이다.
    const cases = [
      ["ExtraSlots", "Extra Slots"],
      ["GammaOfNightLights", "Gamma of Night Lights"],
      ["ConditionalConfigSync", "Conditional Config Sync"],
      ["Digitalroots_Slope_Combat_Assistance", "Digitalroot's Slope Combat Assistance"],
      ["ServersideQoL_AutoProcess", "ServersideQoL.AutoProcess"],
    ];
    for (const [id, loggedAs] of cases) {
      const mod = declared.find((m) => m.id === id);
      expect(mod, id).toBeTruthy();
      const r = detectDrift({
        declared: [mod],
        pluginFiles: mod.fileNames ?? [`${id}.dll`],
        configFiles: mod.configNames ?? [`owner.${id}.cfg`],
        loadedPlugins: [{ name: loggedAs, version: mod.version }],
      });
      expect(r.entries[0].verdict, id).toBe(VERDICT.OK);
    }
  });

  it("WackyEpicMMOSystem 은 플러그인 두 개로 등록되는데 하나로 묶인다", () => {
    const declared = declaredServerMods(modsJson);
    const mod = declared.find((m) => m.id === "WackyEpicMMOSystem");
    const r = detectDrift({
      declared: [mod],
      pluginFiles: ["EpicMMOSystem.dll"],
      configFiles: ["WackyMole.EpicMMOSystem.cfg", "WackyMole.EpicMMOSystemUI.cfg"],
      loadedPlugins: [
        { name: "EpicMMOSystem", version: mod.version },
        { name: "EpicMMOSystemUI", version: mod.version },
      ],
    });
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0].verdict).toBe(VERDICT.OK);
    expect(r.counts.ghost).toBe(0);
  });

  it("프레임워크가 사라지면 모듈 파일이 남아 있어도 미설치로 잡는다", () => {
    // 단순 포함으로 짝지으면 ServersideQoL.AutoProcess.dll 때문에
    // 프레임워크 본체가 사라져도 설치된 것처럼 보인다.
    const declared = declaredServerMods(modsJson);
    const sqol = declared.find((m) => m.id === "ServersideQoL");
    const r = detectDrift({
      declared: [sqol],
      pluginFiles: ["ServersideQoL.AutoProcess.dll", "ServersideQoL.AutoDoors.dll"],
      configFiles: ["ArgusMagnus.ServersideQoL.AutoProcess.cfg"],
      loadedPlugins: [{ name: "ServersideQoL.AutoProcess", version: "2.0.11" }],
    });
    expect(r.entries[0].verdict).toBe(VERDICT.MISSING);
  });
});

describe("보조", () => {
  it("normalizeName 은 점, 밑줄, 공백, 아포스트로피를 지운다", () => {
    expect(normalizeName("ServersideQoL.AutoProcess")).toBe("serversideqolautoprocess");
    expect(normalizeName("ServersideQoL_AutoProcess")).toBe("serversideqolautoprocess");
    expect(normalizeName("Digitalroot's Slope Combat Assistance")).toBe("digitalrootsslopecombatassistance");
  });

  it("파일은 있는데 로드 기록이 없으면 로드 안 됨으로 구분한다", () => {
    const r = detectDrift({
      declared: oneMod(),
      pluginFiles: ["DemoMod.dll"],
      configFiles: [],
      loadedPlugins: [],
    });
    expect(r.entries[0].verdict).toBe(VERDICT.NOT_LOADED);
  });
});
