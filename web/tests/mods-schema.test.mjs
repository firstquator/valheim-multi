import { describe, it, expect } from "vitest";
import { lastRequiredDate, freshness } from "../src/lib/modpack-changes.mjs";

describe("이 브라우저가 파일을 다시 받아야 하는가", () => {
  const changes = [
    { date: "2026-09-20", summary: "서버 설정만 고침" },
    { date: "2026-09-15", summary: "모드 추가", mustUpdate: true },
    { date: "2026-09-01", summary: "처음", mustUpdate: true },
  ];

  it("최신 변경이 아니라 마지막으로 다시 받아야 했던 날을 본다", () => {
    // 어제 서버 설정만 고쳤어도, 그 전주에 모드를 추가했다면
    // 아직 안 받은 사람은 여전히 받아야 한다.
    expect(lastRequiredDate(changes)).toBe("2026-09-15");
  });

  it("다시 받을 일이 한 번도 없었으면 null", () => {
    expect(lastRequiredDate([{ date: "2026-09-20" }])).toBe(null);
    expect(lastRequiredDate([])).toBe(null);
    expect(lastRequiredDate(null)).toBe(null);
  });

  it("받은 적이 없으면 단정하지 않는다", () => {
    expect(freshness(null, "2026-09-15")).toBe("unknown");
  });

  it("받은 날이 기준일보다 뒤면 최신이다", () => {
    expect(freshness("2026-09-15", "2026-09-15")).toBe("fresh");
    expect(freshness("2026-09-16", "2026-09-15")).toBe("fresh");
  });

  it("받은 날이 기준일보다 앞이면 다시 받아야 한다", () => {
    expect(freshness("2026-09-14", "2026-09-15")).toBe("stale");
  });

  it("다시 받을 일이 없었으면 언제 받았든 최신이다", () => {
    expect(freshness("2020-01-01", null)).toBe("fresh");
  });
});
import { validateMods } from "../src/lib/mods-schema.mjs";

const valid = {
  schemaVersion: 1,
  modpack: { version: "v1", r2modmanCode: null },
  mods: [
    {
      id: "PlantEverything",
      owner: "Advize",
      version: "1.21.2",
      tier: 1,
      name: "재배 확장",
      summary: "베리와 버섯을 심을 수 있습니다",
      usage: "재배기로 심으면 됩니다",
      thunderstoreUrl: "https://thunderstore.io/c/valheim/p/Advize/PlantEverything/",
      warnings: [],
    },
  ],
};

describe("validateMods", () => {
  it("올바른 데이터를 통과시킨다", () => {
    expect(validateMods(valid)).toEqual({ ok: true });
  });

  it("tier 가 1,2,3 이 아니면 거부한다", () => {
    const bad = structuredClone(valid);
    bad.mods[0].tier = 4;
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("tier");
  });

  it("필수 필드가 없으면 거부한다", () => {
    const bad = structuredClone(valid);
    delete bad.mods[0].summary;
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("summary");
  });

  it("id 가 중복되면 거부한다", () => {
    const bad = structuredClone(valid);
    bad.mods.push(structuredClone(bad.mods[0]));
    const r = validateMods(bad);
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toContain("중복");
  });

  it("mods 가 배열이 아니면 거부한다", () => {
    const r = validateMods({ schemaVersion: 1, modpack: {}, mods: "nope" });
    expect(r.ok).toBe(false);
  });

  it("실제 data/mods.json 이 스키마를 통과한다", async () => {
    const real = (await import("../../data/mods.json", { with: { type: "json" } })).default;
    expect(validateMods(real)).toEqual({ ok: true });
  });
});
