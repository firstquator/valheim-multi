// data/mods.json 에서 r2modman 프로필 파일(.r2z)을 만든다.
//
// 왜 필요한가.
// 3층 모드는 친구 전원이 같은 버전을 깔아야 한다. 하나씩 손으로 받게 하면
// 반드시 누군가 버전을 틀린다. r2modman 은 프로필을 파일로 가져올 수 있어서,
// 이 파일 하나만 내려받아 불러오면 목록과 버전이 그대로 맞춰진다.
//
// 프로필 코드(공유 코드)를 쓰는 방법도 있지만 그건 r2modman GUI 에서 사람이
// 직접 발급해야 한다. 파일은 데이터에서 자동으로 만들 수 있다.
//
// 포맷은 r2modman 소스에서 확인했다 (ebkr/r2modmanPlus).
//   src/utils/ProfileUtils.ts  : .r2z 안의 export.r2x 를 읽는다
//   src/model/exports/ExportMod.ts : name, version{major,minor,patch}, enabled
//
// export.r2x 는 YAML 이고 모양은 이렇다.
//   profileName: gaybar
//   mods:
//     - name: shudnal-ExtraSlots
//       version:
//         major: 1
//         minor: 2
//         patch: 10
//       enabled: true
//
// name 은 Thunderstore 의 "작성자-패키지명" 이다. 하나라도 틀리면 가져오기가
// 실패하므로 data/mods.json 의 owner 와 id 를 그대로 쓴다.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32 } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");

export const PROFILE_NAME = "gaybar";
export const ENTRY_NAME = "export.r2x";
export const OUTPUT_PATH = resolve(root, "web/public/gaybar-modpack.r2z");

/**
 * 프로필에 들어갈 패키지 목록을 만든다.
 * 의존성 + 3층(전원 필수) + 2층(개인 선택)을 모두 담는다.
 *
 * 2층을 왜 넣는가.
 * 처음에는 "개인 선택이라 넣으면 전원 강제가 된다" 고 보고 뺐다. 그런데
 * 강제되는 것은 서버가 검사하는 3층뿐이다. 2층은 서버에 깔려 있지 않아
 * 없어도 튕기지 않는다. 그래서 프로필에 담아도 강제가 되지 않는다.
 * 원하지 않는 사람은 r2modman 에서 그 모드만 꺼 두면 된다.
 *
 * 담는 편이 낫다고 판단한 이유는, 빼면 2층을 쓰고 싶은 사람이 이름을
 * 하나씩 검색해 따로 받아야 하기 때문이다. 그 과정에서 틀린 모드를 받거나
 * 인벤토리 충돌 같은 사고가 생긴다.
 *
 * 1층은 넣지 않는다. 서버에만 깔리므로 친구가 받을 이유가 없다.
 */
export function collectPackages(data) {
  const tier3 = data.mods.filter((m) => m.tier === 3);
  const tier2 = data.mods.filter((m) => m.tier === 2);
  const deps = data.modpack?.dependencies ?? [];

  // 의존성, 필수, 선택 순으로 둔다. r2modman 의 설치 목록이 이 순서로
  // 보이므로 중요한 것이 위에 오는 편이 사람이 읽기 좋다.
  const all = [...deps, ...tier3, ...tier2];

  const seen = new Set();
  return all.map((m) => {
    const name = `${m.owner}-${m.id}`;
    if (seen.has(name)) throw new Error(`프로필에 같은 패키지가 두 번 들어갔다: ${name}`);
    seen.add(name);

    const parts = String(m.version).split(".");
    if (parts.length !== 3 || parts.some((p) => !/^\d+$/.test(p))) {
      throw new Error(`버전이 major.minor.patch 형식이 아니다: ${name} ${m.version}`);
    }
    const [major, minor, patch] = parts.map(Number);
    return { name, major, minor, patch };
  });
}

/** export.r2x 본문을 만든다. 의존성을 더하지 않으려고 YAML 을 직접 쓴다. */
export function buildExportYaml(packages, profileName = PROFILE_NAME) {
  const lines = [`profileName: ${profileName}`, "mods:"];
  for (const p of packages) {
    lines.push(`  - name: ${p.name}`);
    lines.push("    version:");
    lines.push(`      major: ${p.major}`);
    lines.push(`      minor: ${p.minor}`);
    lines.push(`      patch: ${p.patch}`);
    lines.push("    enabled: true");
  }
  return lines.join("\n") + "\n";
}

/**
 * 파일 하나짜리 zip 을 만든다.
 *
 * 압축하지 않고 그대로 담는다(method 0). 내용이 몇 킬로바이트라 압축 이득이
 * 없고, deflate 를 빼면 의존성 없이 헤더만 조립하면 된다.
 */
export function buildZip(entryName, contentBuffer) {
  const nameBuf = Buffer.from(entryName, "utf8");
  const crc = crc32(contentBuffer);
  const size = contentBuffer.length;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0); // 로컬 파일 헤더 서명
  localHeader.writeUInt16LE(20, 4); // 필요 버전
  localHeader.writeUInt16LE(0, 6); // 플래그
  localHeader.writeUInt16LE(0, 8); // 압축 방식: 저장
  localHeader.writeUInt16LE(0, 10); // 수정 시각
  localHeader.writeUInt16LE(0, 12); // 수정 날짜
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(size, 18); // 압축 후 크기
  localHeader.writeUInt32LE(size, 22); // 원본 크기
  localHeader.writeUInt16LE(nameBuf.length, 26);
  localHeader.writeUInt16LE(0, 28); // 추가 필드 길이

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0); // 중앙 디렉터리 서명
  centralHeader.writeUInt16LE(20, 4); // 만든 버전
  centralHeader.writeUInt16LE(20, 6); // 필요 버전
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(0, 10);
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(size, 20);
  centralHeader.writeUInt32LE(size, 24);
  centralHeader.writeUInt16LE(nameBuf.length, 28);
  centralHeader.writeUInt16LE(0, 30); // 추가 필드
  centralHeader.writeUInt16LE(0, 32); // 주석
  centralHeader.writeUInt16LE(0, 34); // 디스크 번호
  centralHeader.writeUInt16LE(0, 36); // 내부 속성
  centralHeader.writeUInt32LE(0, 38); // 외부 속성
  centralHeader.writeUInt32LE(0, 42); // 로컬 헤더 위치

  const centralSize = centralHeader.length + nameBuf.length;
  const centralOffset = localHeader.length + nameBuf.length + size;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); // 중앙 디렉터리 끝 서명
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(1, 8); // 이 디스크의 항목 수
  end.writeUInt16LE(1, 10); // 전체 항목 수
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20); // 주석 길이

  return Buffer.concat([
    localHeader, nameBuf, contentBuffer,
    centralHeader, nameBuf,
    end,
  ]);
}

export function buildModpack(data) {
  const packages = collectPackages(data);
  const yaml = buildExportYaml(packages);
  return { packages, yaml, zip: buildZip(ENTRY_NAME, Buffer.from(yaml, "utf8")) };
}

// 직접 실행했을 때만 파일로 쓴다.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const data = JSON.parse(readFileSync(resolve(root, "data/mods.json"), "utf8"));
  const { packages, zip } = buildModpack(data);
  mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
  writeFileSync(OUTPUT_PATH, zip);
  console.log(`${OUTPUT_PATH} 생성 (패키지 ${packages.length}개, ${zip.length} 바이트)`);
  for (const p of packages) console.log(`  ${p.name}-${p.major}.${p.minor}.${p.patch}`);

  // --verify 를 주면 Thunderstore 에 실재하는지까지 확인한다.
  if (process.argv.includes("--verify")) {
    console.log("Thunderstore 실재 확인 중...");
    const bad = await verifyPackages(packages);
    if (bad.length) {
      for (const b of bad) console.error(`  실패 ${b.name}-${b.version}: ${b.why}`);
      process.exit(1);
    }
    console.log(`  ${packages.length}개 전부 확인됨`);
  }
}

/**
 * 프로필의 모든 패키지가 Thunderstore 에 그 버전으로 실재하는지 확인한다.
 *
 * 이 파일은 친구 전원에게 나간다. 이름이나 버전이 하나라도 틀리면 가져오기가
 * 통째로 실패한다. 실제로 SlopeCombatAssistance 와 QuickStackStore 두 건이
 * 축약된 이름으로 적혀 있어 존재하지 않는 패키지를 가리키고 있었다.
 *
 * 네트워크를 타므로 일반 테스트에는 넣지 않는다. 모드를 바꾼 뒤
 * `npm run modpack:verify` 로 직접 돌린다.
 */
export async function verifyPackages(packages) {
  const bad = [];
  for (const p of packages) {
    const version = `${p.major}.${p.minor}.${p.patch}`;
    const [owner, ...rest] = p.name.split("-");
    const pkg = rest.join("-");
    const url = `https://thunderstore.io/api/experimental/package/${owner}/${pkg}/${version}/`;
    let res;
    try {
      res = await fetch(url);
    } catch {
      bad.push({ name: p.name, version, why: "네트워크 오류" });
      continue;
    }
    if (!res.ok) {
      bad.push({ name: p.name, version, why: `HTTP ${res.status}` });
      continue;
    }
    const json = await res.json();
    if (json.full_name !== `${p.name}-${version}`) {
      bad.push({ name: p.name, version, why: `이름 불일치 (${json.full_name})` });
    }
  }
  return bad;
}
