import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const db = JSON.parse(readFileSync(resolve(root, "data/items.json"), "utf8"));
const bosses = JSON.parse(readFileSync(resolve(root, "data/bosses.json"), "utf8"));

const ids = new Set(db.items.map((i) => i.id));
const stages = new Set(db.stages.map((s) => s.n));

describe("보스 표", () => {
  it("일곱 마리가 순서대로 있다", () => {
    expect(bosses.bosses).toHaveLength(7);
    expect(bosses.bosses.map((b) => b.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("id 와 단계가 겹치지 않는다", () => {
    const list = bosses.bosses;
    expect(new Set(list.map((b) => b.id)).size).toBe(list.length);
    expect(new Set(list.map((b) => b.stage)).size).toBe(list.length);
  });

  it("바이옴이 도감의 단계표 안에 있다", () => {
    for (const b of bosses.bosses) expect(stages.has(b.stage)).toBe(true);
  });

  it("보스 순서가 단계 순서와 같다", () => {
    const byOrder = [...bosses.bosses].sort((a, b) => a.n - b.n).map((b) => b.stage);
    expect(byOrder).toEqual([...byOrder].sort((a, b) => a - b));
  });

  it("가리키는 아이템이 모두 도감에 있다", () => {
    // 손으로 적은 표라 오타가 나기 쉽다. 없는 id 를 가리키면 화면에
    // 이름도 그림도 없는 빈 칸이 뜬다.
    for (const b of bosses.bosses) {
      expect(ids.has(b.trophy), `${b.ko} 의 트로피 ${b.trophy}`).toBe(true);
      for (const s of b.summon?.items ?? []) {
        expect(ids.has(s.item), `${b.ko} 의 소환 재료 ${s.item}`).toBe(true);
      }
      for (const d of b.drops ?? []) {
        expect(ids.has(d), `${b.ko} 의 드롭 ${d}`).toBe(true);
      }
    }
  });

  it("소환 재료의 개수는 적혀 있다면 1 이상이다", () => {
    // 확실하지 않은 것은 개수를 비워 두기로 했다. 0 이나 음수는 실수다.
    for (const b of bosses.bosses) {
      for (const s of b.summon?.items ?? []) {
        if (s.amount === undefined) continue;
        expect(s.amount).toBeGreaterThan(0);
      }
    }
  });

  it("어디서 어떻게 소환하는지는 모두 적혀 있다", () => {
    for (const b of bosses.bosses) {
      expect(typeof b.summon?.where).toBe("string");
      expect(b.summon.where.length).toBeGreaterThan(0);
      expect((b.summon.items ?? []).length).toBeGreaterThan(0);
    }
  });

  it("이름과 조언이 비어 있지 않다", () => {
    for (const b of bosses.bosses) {
      expect(b.ko).toBeTruthy();
      expect(b.en).toBeTruthy();
      expect(b.tip).toBeTruthy();
      expect(b.opens).toBeTruthy();
    }
  });
});
