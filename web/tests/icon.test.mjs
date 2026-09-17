import { describe, it, expect } from "vitest";
import { readIcon } from "../src/lib/icon.mjs";

describe("readIcon", () => {
  it("존재하는 아이콘의 svg 를 반환한다", () => {
    const svg = readIcon("home-01");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
  });

  it("currentColor 를 쓰도록 stroke 를 바꾼다", () => {
    const svg = readIcon("home-01");
    expect(svg).toContain("currentColor");
  });

  it("width 와 height 속성을 제거한다", () => {
    const svg = readIcon("home-01");
    expect(svg).not.toMatch(/<svg[^>]*\swidth=/);
    expect(svg).not.toMatch(/<svg[^>]*\sheight=/);
  });

  it("없는 아이콘이면 이름을 담은 예외를 던진다", () => {
    expect(() => readIcon("this-icon-does-not-exist")).toThrow(/this-icon-does-not-exist/);
  });

  it("계획에서 쓰기로 한 아이콘이 전부 존재한다", () => {
    for (const n of [
      "home-01", "package-02", "download-04", "globe-02",
      "copy-01", "alert-01", "user-02",
    ]) {
      expect(() => readIcon(n)).not.toThrow();
    }
  });
});
