import { defineConfig } from "astro/config";
import { validateMods } from "./src/lib/mods-schema.mjs";
import mods from "../data/mods.json" with { type: "json" };

// 빌드 시작 전에 검증한다. 잘못된 모드 정보가 배포되면
// 친구들이 틀린 안내를 보게 된다.
const result = validateMods(mods);
if (!result.ok) {
  console.error("data/mods.json 검증 실패:");
  for (const e of result.errors) console.error("  - " + e);
  process.exit(1);
}

export default defineConfig({
  site: "https://firstquator.github.io",
  base: "/valheim-multi",
});
