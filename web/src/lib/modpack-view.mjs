// data/mods.json 에서 화면이 쓰는 값들을 뽑는다.
//
// 서버 탭, 모드 탭, 설치 가이드 세 곳이 같은 값을 쓴다. 각자 세면
// 한 곳을 고칠 때 다른 곳이 어긋나므로 여기서 한 번만 센다.
//
// 숫자를 손으로 적지 않는 것이 요점이다. 모드가 늘고 줄 때 이 파일을
// 다시 고칠 일이 없어야 한다.

import modsData from "../../../data/mods.json";
import { summarizeChanges, lastRequiredDate } from "./modpack-changes.mjs";

export { modsData };

// 계층은 친구가 할 일로 나뉜다.
//   3층 전원 필수 / 2층 원하면 설치 / 1층 서버 전용
export const tier1 = modsData.mods.filter((m) => m.tier === 1);
export const tier2 = modsData.mods.filter((m) => m.tier === 2);
export const tier3 = modsData.mods.filter((m) => m.tier === 3);

export const modpackCode = modsData.modpack.r2modmanCode;

// r2modman 이 그대로 읽는 프로필 파일이다. scripts/build-modpack.mjs 가
// data/mods.json 에서 만들어 web/public/ 에 놓는다. 여기 적는 이름은 그
// 스크립트의 출력 파일 이름과 같아야 한다.
export const MODPACK_FILE = "gaybar-modpack.r2z";

export const modpackDepCount = modsData.modpack.dependencies.length;

// 프로필을 가져온 뒤 r2modman 왼쪽에 뜨는 "Installed" 숫자다. 이 숫자가
// 맞으면 빠진 것이 없다는 뜻이라, 친구가 스스로 확인할 수 있는 유일한
// 신호다. scripts/build-modpack.mjs 가 의존성 + 3층 + 2층을 담으므로
// 여기서도 같은 식으로 센다.
export const modpackPackageCount = modpackDepCount + tier3.length + tier2.length;

// 화면 문구는 data/mods.json 의 내용에 따라 저절로 달라진다.
// 3층(직접 설치) 모드가 하나라도 있으면 "설치할 것이 있다" 로,
// 없으면 "지금은 없다" 로 읽힌다.
export const needsAnyInstall = tier3.length > 0;

// 모드팩이 언제 무엇 때문에 바뀌었는지다.
const changes = summarizeChanges(modsData.modpack.changes);
export const latestChange = changes.latest;
export const mustUpdate = changes.mustUpdate;
export const olderChanges = changes.older;

// 마지막으로 전원이 파일을 다시 받아야 했던 날. 브라우저에 적어 둔
// "받은 날" 과 견줘 사람마다 다른 안내를 내놓는 데 쓴다.
// islands/ModpackFresh.js 가 data 속성으로 읽어 간다.
export const requiredDate = lastRequiredDate(modsData.modpack.changes);
