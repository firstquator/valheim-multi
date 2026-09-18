import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { summarizeBackups, formatSize, formatAge, resolveBackupHostDir } from "../admin/lib/backups.mjs";

const composeText = readFileSync(new URL("../server/docker-compose.yml", import.meta.url), "utf8");

const NOW = Date.parse("2026-09-18T12:00:00Z");
const at = (iso) => Date.parse(iso);

describe("summarizeBackups", () => {
  const entries = [
    { name: "worlds-20260918-030507.zip", size: 2_780_510, mtimeMs: at("2026-09-18T03:05:07Z") },
    { name: "worlds-20260918-022854.zip", size: 2_779_693, mtimeMs: at("2026-09-18T02:28:54Z") },
    { name: "worlds-20260918-110500.zip", size: 2_790_000, mtimeMs: at("2026-09-18T11:05:00Z") },
  ];

  it("최신순으로 정렬한다", () => {
    const s = summarizeBackups(entries, { now: NOW });
    expect(s.items.map((i) => i.name)).toEqual([
      "worlds-20260918-110500.zip",
      "worlds-20260918-030507.zip",
      "worlds-20260918-022854.zip",
    ]);
    expect(s.latestAt).toBe("2026-09-18T11:05:00.000Z");
  });

  it("개수와 합계 크기를 센다", () => {
    const s = summarizeBackups(entries, { now: NOW });
    expect(s.count).toBe(3);
    expect(s.totalBytes).toBe(2_780_510 + 2_779_693 + 2_790_000);
    expect(s.totalSize).toBe("8.0 MB");
  });

  it("경과 시각을 사람이 읽는 형태로 준다", () => {
    const s = summarizeBackups(entries, { now: NOW });
    expect(s.items[0].age).toBe("55분 전");
    expect(s.items[2].age).toBe("9시간 전");
  });

  it("limit 로 잘라도 count 는 전체를 센다", () => {
    const s = summarizeBackups(entries, { now: NOW, limit: 1 });
    expect(s.items).toHaveLength(1);
    expect(s.count).toBe(3);
  });

  it("빈 목록에서 예외를 던지지 않는다", () => {
    const s = summarizeBackups([], { now: NOW });
    expect(s.count).toBe(0);
    expect(s.latestAt).toBe(null);
  });
});

describe("formatSize / formatAge", () => {
  it("크기를 1024 기준으로 끊는다", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(1024 * 1024 * 3)).toBe("3.0 MB");
    expect(formatSize(-1)).toBe("-");
  });

  it("1분 미만은 방금이다", () => {
    expect(formatAge(1000)).toBe("방금");
    expect(formatAge(90 * 60 * 1000)).toBe("1시간 전");
    expect(formatAge(50 * 60 * 60 * 1000)).toBe("2일 전");
  });
});

describe("resolveBackupHostDir", () => {
  it("실제 docker-compose.yml 에서 컨테이너 경로와 호스트 매핑을 찾는다", () => {
    const r = resolveBackupHostDir({ composeText, envVars: {} });
    expect(r.containerDir).toBe("/backups-out");
    expect(r.hostSpec).toBe("${BACKUP_HOST_DIR:-./backups}");
    // .env 가 없으면 compose 의 기본값으로 떨어진다.
    expect(r.hostDir).toBe("./backups");
    expect(r.source).toBe("docker-compose.yml 의 기본값");
  });

  it(".env 의 BACKUP_HOST_DIR 이 있으면 그 값을 쓴다", () => {
    const r = resolveBackupHostDir({
      composeText,
      envVars: { BACKUP_HOST_DIR: "C:/ValheimServer/backups" },
    });
    expect(r.hostDir).toBe("C:/ValheimServer/backups");
    expect(r.source).toContain("server/.env");
  });

  it("경로를 찾지 못하면 조용히 넘어가지 않고 미확인으로 표시한다", () => {
    const r = resolveBackupHostDir({ composeText: "services:\n  x:\n    image: y\n" });
    expect(r.hostDir).toBe(null);
    expect(r.source).toBe("미확인");
  });

  it("다른 볼륨 줄을 백업 경로로 잘못 잡지 않는다", () => {
    // compose 에는 valheim-config:/config 마운트도 있다.
    const r = resolveBackupHostDir({ composeText, envVars: {} });
    expect(r.hostSpec).not.toContain("valheim-config");
  });
});
