import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectPackages,
  buildExportYaml,
  buildModpack,
  OUTPUT_PATH,
  ENTRY_NAME,
} from "../scripts/build-modpack.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(resolve(root, "data/mods.json"), "utf8"));

describe("모드팩 프로필", () => {
  it("3층 모드가 하나도 빠지지 않는다", () => {
    const names = collectPackages(data).map((p) => p.name);
    const tier3 = data.mods.filter((m) => m.tier === 3);
    expect(tier3.length).toBeGreaterThan(0);
    for (const m of tier3) {
      expect(names).toContain(`${m.owner}-${m.id}`);
    }
  });

  it("2층 모드도 전부 들어간다. 서버가 검사하지 않으므로 담아도 강제가 아니다", () => {
    const names = collectPackages(data).map((p) => p.name);
    const tier2 = data.mods.filter((x) => x.tier === 2);
    expect(tier2.length).toBeGreaterThan(0);
    for (const m of tier2) {
      expect(names).toContain(`${m.owner}-${m.id}`);
    }
  });

  it("필수 모드가 선택 모드보다 앞에 온다. 설치 목록에서 중요한 것이 위에 보여야 한다", () => {
    const names = collectPackages(data).map((p) => p.name);
    const lastTier3 = Math.max(
      ...data.mods.filter((m) => m.tier === 3).map((m) => names.indexOf(`${m.owner}-${m.id}`)),
    );
    const firstTier2 = Math.min(
      ...data.mods.filter((m) => m.tier === 2).map((m) => names.indexOf(`${m.owner}-${m.id}`)),
    );
    expect(lastTier3).toBeLessThan(firstTier2);
  });

  it("1층 모드도 들어가지 않는다. 서버에만 깔리므로 친구가 받을 필요가 없다", () => {
    const names = collectPackages(data).map((p) => p.name);
    for (const m of data.mods.filter((x) => x.tier === 1)) {
      expect(names).not.toContain(`${m.owner}-${m.id}`);
    }
  });

  it("모드 로더가 들어 있다. 없으면 나머지가 전부 동작하지 않는다", () => {
    const names = collectPackages(data).map((p) => p.name);
    expect(names).toContain("denikson-BepInExPack_Valheim");
  });

  it("같은 패키지가 두 번 들어가면 실패한다", () => {
    const dup = {
      mods: [
        { owner: "a", id: "b", version: "1.0.0", tier: 3 },
        { owner: "a", id: "b", version: "1.0.0", tier: 3 },
      ],
      modpack: { dependencies: [] },
    };
    expect(() => collectPackages(dup)).toThrow(/두 번/);
  });

  it("버전이 major.minor.patch 가 아니면 실패한다", () => {
    const bad = {
      mods: [{ owner: "a", id: "b", version: "1.2", tier: 3 }],
      modpack: { dependencies: [] },
    };
    expect(() => collectPackages(bad)).toThrow(/형식/);
  });

  it("r2modman 이 읽는 필드 이름을 그대로 쓴다", () => {
    const yaml = buildExportYaml([{ name: "x-y", major: 1, minor: 2, patch: 3 }], "p");
    // ebkr/r2modmanPlus 의 parseYamlToExportFormat 이 읽는 이름들이다.
    expect(yaml).toContain("profileName: p");
    expect(yaml).toContain("mods:");
    expect(yaml).toContain("  - name: x-y");
    expect(yaml).toContain("      major: 1");
    expect(yaml).toContain("      minor: 2");
    expect(yaml).toContain("      patch: 3");
    expect(yaml).toContain("    enabled: true");
  });

  it("커밋된 .r2z 가 지금 data/mods.json 과 일치한다", () => {
    // 모드를 바꾸고 재생성을 잊으면 친구들이 틀린 버전을 깔게 된다.
    // 그 상태를 여기서 잡는다. 실패하면 `npm run modpack` 을 다시 돌린다.
    const onDisk = readFileSync(OUTPUT_PATH);
    const fresh = buildModpack(data).zip;
    expect(onDisk.equals(fresh)).toBe(true);
  });

  it("zip 안에 export.r2x 하나만 들어 있다", () => {
    const zip = buildModpack(data).zip;
    const text = zip.toString("latin1");
    const count = text.split(ENTRY_NAME).length - 1;
    // 로컬 헤더와 중앙 디렉터리에 한 번씩, 모두 두 번 나온다.
    expect(count).toBe(2);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
  });
});

describe("서버 전용 라이브러리", () => {
  it("프로필에 들어가지 않는다. 친구가 서버 전용 모드의 라이브러리를 받을 이유가 없다", () => {
    const names = collectPackages(data).map((p) => p.name);
    const libs = data.serverLibraries ?? [];
    expect(libs.length).toBeGreaterThan(0);
    for (const l of libs) {
      expect(names).not.toContain(`${l.owner}-${l.id}`);
    }
  });

  it("왜 서버에만 필요한지 근거가 적혀 있다", () => {
    for (const l of data.serverLibraries ?? []) {
      expect(typeof l.why).toBe("string");
      expect(l.why.length).toBeGreaterThan(10);
    }
  });
});
