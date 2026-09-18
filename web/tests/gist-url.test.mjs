import { describe, it, expect } from "vitest";
import { buildGistRawUrl } from "../src/lib/gist-url.mjs";

const OWNER = "firstquator";
const ID = "0123456789abcdef0123456789abcdef";
const FILE = "valheim-status.json";

describe("buildGistRawUrl", () => {
  it("raw 호스트를 쓴다. api.github.com 을 쓰면 비인증 60회/시간 제한에 걸린다", () => {
    const url = buildGistRawUrl(OWNER, ID, FILE, 1000);
    expect(url.startsWith("https://gist.githubusercontent.com/")).toBe(true);
    expect(url).not.toContain("api.github.com");
  });

  it("owner, id, 파일 이름을 경로에 담는다", () => {
    const url = buildGistRawUrl(OWNER, ID, FILE, 1000);
    expect(url).toContain(`/${OWNER}/${ID}/raw/${FILE}`);
  });

  it("호출마다 다른 쿼리를 붙인다. 안 붙이면 5분 캐시에 걸려 신선도 판정이 틀어진다", () => {
    const a = buildGistRawUrl(OWNER, ID, FILE, 1000);
    const b = buildGistRawUrl(OWNER, ID, FILE, 2000);
    expect(a).not.toBe(b);
    expect(a).toContain("?t=1000");
    expect(b).toContain("?t=2000");
  });

  it("owner 나 id 가 비면 null 을 준다. 사용자가 값을 채우기 전 상태다", () => {
    expect(buildGistRawUrl("", ID, FILE, 1000)).toBe(null);
    expect(buildGistRawUrl(OWNER, "", FILE, 1000)).toBe(null);
    expect(buildGistRawUrl(OWNER, ID, "", 1000)).toBe(null);
  });
});
