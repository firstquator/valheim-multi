import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateMods } from "../web/src/lib/mods-schema.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const real = JSON.parse(readFileSync(resolve(root, "data/mods.json"), "utf8"));

/** 검사 대상이 changes 뿐인 최소 데이터를 만든다. */
function withChanges(changes) {
  return { schemaVersion: 1, mods: [], modpack: { changes } };
}

describe("모드팩 변경 이력 검증", () => {
  it("실제 data/mods.json 이 통과한다", () => {
    const r = validateMods(real);
    expect(r.errors ?? []).toEqual([]);
    expect(r.ok).toBe(true);
  });

  it("이력이 없어도 통과한다. 아직 한 번도 갱신하지 않은 상태다", () => {
    expect(validateMods({ schemaVersion: 1, mods: [], modpack: {} }).ok).toBe(true);
  });

  it("최신순이 아니면 실패한다", () => {
    // 맨 앞이 최신이라는 전제로 화면이 만들어진다. 순서가 뒤집히면
    // 옛날 변경이 최신인 것처럼 뜨고, 친구는 이미 받은 파일을 또 받는다.
    const r = validateMods(
      withChanges([
        { date: "2026-09-01", summary: "옛날 것", mustUpdate: false },
        { date: "2026-09-19", summary: "새 것", mustUpdate: true },
      ]),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/최신순/);
  });

  it("같은 날짜가 연달아 오는 것은 허용한다. 하루에 두 번 고칠 수 있다", () => {
    const r = validateMods(
      withChanges([
        { date: "2026-09-19", summary: "두 번째", mustUpdate: false },
        { date: "2026-09-19", summary: "첫 번째", mustUpdate: true },
      ]),
    );
    expect(r.ok).toBe(true);
  });

  it("날짜 형식이 YYYY-MM-DD 가 아니면 실패한다", () => {
    const r = validateMods(withChanges([{ date: "2026-9-19", summary: "x", mustUpdate: true }]));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/YYYY-MM-DD/);
  });

  it("summary 가 없으면 실패한다", () => {
    const r = validateMods(withChanges([{ date: "2026-09-19", mustUpdate: true }]));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/summary/);
  });

  it("mustUpdate 를 빠뜨리면 실패한다", () => {
    // 적지 않으면 undefined 가 되고, 화면에서는 거짓으로 읽혀 "업데이트
    // 하지 않아도 된다" 로 나간다. 반드시 명시하게 만든다.
    const r = validateMods(withChanges([{ date: "2026-09-19", summary: "x" }]));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/mustUpdate/);
  });

  it("mustUpdate 에 문자열을 넣으면 실패한다", () => {
    const r = validateMods(
      withChanges([{ date: "2026-09-19", summary: "x", mustUpdate: "true" }]),
    );
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/mustUpdate/);
  });

  it("changes 가 배열이 아니면 실패한다", () => {
    const r = validateMods(withChanges({ date: "2026-09-19" }));
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/배열/);
  });
});
