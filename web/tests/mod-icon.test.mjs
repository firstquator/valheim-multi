import { describe, it, expect } from "vitest";
import { pickModIcon, DEFAULT_MOD_ICON } from "../src/lib/mod-icon.mjs";
import { readIcon } from "../src/lib/icon.mjs";

describe("pickModIcon", () => {
  it("인벤토리 계열 모드에는 가방 아이콘을 고른다", () => {
    expect(pickModIcon({ id: "ExtraSlots", name: "추가 슬롯", summary: "" })).toBe("backpack-03");
  });

  it("재배 계열 모드에는 식물 아이콘을 고른다", () => {
    expect(pickModIcon({ id: "PlantEverything", name: "재배 확장", summary: "" })).toBe("plant-02");
  });

  it("한국어 설명만으로도 고를 수 있다", () => {
    expect(pickModIcon({ id: "Xyz", name: "자동 제련 공급", summary: "" })).toBe("fire");
  });

  it("id 와 name 과 summary 를 모두 본다", () => {
    expect(pickModIcon({ id: "Xyz", name: "무명", summary: "지도에 핀을 찍습니다" })).toBe("map-pinpoint-01");
  });

  it("매칭되는 키워드가 없으면 기본 아이콘으로 떨어진다", () => {
    expect(pickModIcon({ id: "Qqq", name: "무명", summary: "무엇" })).toBe(DEFAULT_MOD_ICON);
  });

  it("모드 객체가 없어도 예외를 던지지 않는다", () => {
    expect(pickModIcon(null)).toBe(DEFAULT_MOD_ICON);
    expect(pickModIcon(undefined)).toBe(DEFAULT_MOD_ICON);
    expect(pickModIcon({})).toBe(DEFAULT_MOD_ICON);
  });

  it("고를 수 있는 아이콘 이름이 전부 실제로 존재한다", () => {
    // 없는 이름을 매핑에 적어 두면 그 모드가 추가되는 날 빌드가 깨진다.
    // 여기서 미리 잡는다.
    const samples = [
      { id: "ExtraSlots" }, { id: "PlantEverything" }, { id: "AutoProcess" },
      { id: "ContainerStack" }, { id: "CombatTweaks" }, { id: "BetterShip" },
      { id: "MapPins" }, { id: "BuildPlan" }, { id: "ClockHud" },
      { id: "ChatEmote" }, { id: "PlayerList" }, { id: "ServersideQoL" },
      { id: "ConfigBalance" }, { id: "Unmatched" },
    ];
    for (const s of samples) {
      expect(() => readIcon(pickModIcon(s))).not.toThrow();
    }
  });
});
