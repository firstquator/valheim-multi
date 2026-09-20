// 공략 탭의 보스 표에 쓸 값들.
//
// 보스 이름과 소환 재료는 data/bosses.json 에, 아이템의 한국어 이름과
// 바이옴 이름은 data/items.json 에 있다. 이름을 bosses.json 에 다시 적지
// 않고 id 로만 가리켜서, 게임이 판올림되어 번역이 바뀌어도 한 곳만
// 고치면 되게 한다.
//
// 가리키는 id 가 실재하는지는 tests/bosses.test.mjs 가 지킨다. 없는 id 를
// 쓰면 화면에 이름도 그림도 없는 빈 칸이 뜬다.

import bossData from "../../../data/bosses.json";
import itemData from "../../../data/items.json";

export const bosses = bossData.bosses;
export const bossNote = bossData.note;

const itemKoById = new Map(itemData.items.map((i) => [i.id, i.ko]));
const stageKoByN = new Map(itemData.stages.map((s) => [s.n, s.ko]));

export const itemKo = (id) => itemKoById.get(id) ?? id;
export const stageKo = (n) => stageKoByN.get(n) ?? "미상";
