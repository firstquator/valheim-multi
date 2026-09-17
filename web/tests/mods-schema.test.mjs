import { describe, it, expect } from "vitest";
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
