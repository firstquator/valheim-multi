import { describe, it, expect } from "vitest";
import { readIcon, applyIconTransforms } from "../src/lib/icon.mjs";

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

  it("label 없이 렌더하면 장식용으로 간주해 aria-hidden 과 focusable 을 붙인다", () => {
    const svg = readIcon("home-01");
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('focusable="false"');
    expect(svg).not.toContain("aria-label");
  });

  it("label 을 주면 의미 있는 아이콘으로 간주해 role 과 aria-label 을 붙인다", () => {
    const svg = readIcon("home-01", { label: "홈으로 이동" });
    expect(svg).toContain('role="img"');
    expect(svg).toContain('aria-label="홈으로 이동"');
    expect(svg).not.toContain("aria-hidden");
  });

  it("원본에 title 이나 role 이 있어도 결과물에는 남지 않는다", () => {
    const raw = `<svg role="presentation" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><title>홈 아이콘</title><path d="M0 0" stroke="#141B34" /></svg>`;
    const svg = applyIconTransforms(raw);
    expect(svg).not.toContain("<title");
    expect(svg).not.toMatch(/\srole="presentation"/);
  });

  it("루트 태그의 width/height 만 지우고 내부 요소의 값은 보존한다", () => {
    const raw = `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" x="1" y="1" stroke="#141B34" /></svg>`;
    const svg = applyIconTransforms(raw);
    expect(svg).not.toMatch(/^<svg[^>]*\swidth="24"/);
    expect(svg).not.toMatch(/^<svg[^>]*\sheight="24"/);
    expect(svg).toContain('width="10"');
    expect(svg).toContain('height="10"');
  });
});
