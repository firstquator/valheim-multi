// 서버에서 일어난 일. 죽음과 습격.
//
// 자료는 agent/status-publisher.mjs 가 로그에서 읽어 Gist 에 쌓은 것이다.
// 여기서는 계산만 한다. DOM 도 네트워크도 건드리지 않는다.

/**
 * 습격 이름을 한국어로.
 *
 * 로그에는 `Random event set:army_bonemass` 처럼 내부 이름만 찍힌다.
 * 게임 안에서 뜨는 공식 문구는 로컬라이제이션 파일에 따로 있는데, 지금
 * 그 파일을 갖고 있지 않아 손으로 적었다. 무엇이 몰려오는지가 요점이라
 * 게임 문구를 그대로 옮기기보다 알아보기 쉽게 적었다.
 *
 * 표에 없는 이름은 내부 이름 그대로 보여 준다. 모르는 것을 아는 척하면
 * 준비를 잘못하게 된다.
 */
export const RAID_KO = {
  army_eikthyr: { ko: "에이크쉬르의 군대", note: "사슴 떼가 몰려옵니다" },
  army_theelder: { ko: "장로의 군대", note: "그레이들링과 나무 정령이 옵니다" },
  army_bonemass: { ko: "보네마스의 군대", note: "드라우그와 오지가 몰려옵니다" },
  army_moder: { ko: "모더의 군대", note: "드레이크가 하늘에서 옵니다" },
  army_goblin: { ko: "야글루스의 군대", note: "풀링 무리가 몰려옵니다" },
  army_gjall: { ko: "얄", note: "공중에서 불덩이를 떨어뜨립니다" },
  army_seekers: { ko: "추적자 무리", note: "안개 땅의 벌레들이 옵니다" },
  army_charredarmy: { ko: "그을린 군대", note: "잿빛 황야의 것들이 옵니다" },
  foresttrolls: { ko: "숲의 트롤", note: "땅이 흔들립니다" },
  blobs: { ko: "점액질 무리", note: "늪의 오지가 몰려옵니다" },
  skeletons: { ko: "해골 무리", note: "둔기가 잘 듭니다" },
  surtlings: { ko: "서프틀링", note: "불을 뿜습니다. 물을 등지면 유리합니다" },
  wolves: { ko: "늑대 무리", note: "산에서 내려옵니다" },
  bats: { ko: "박쥐 떼", note: "동굴에서 몰려나옵니다" },
};

export function raidKo(name) {
  return RAID_KO[name] ?? { ko: name, note: "" };
}

/**
 * 누가 몇 번 죽었나. 많이 죽은 사람부터.
 *
 * @param {object} history
 * @param {number} sinceMs 이 시각부터. 0 이면 전부
 */
export function deathRanking(history, sinceMs = 0) {
  const count = new Map();
  for (const e of history?.deaths ?? []) {
    const t = Date.parse(e?.at ?? "");
    if (Number.isNaN(t) || t < sinceMs) continue;
    count.set(e.name, (count.get(e.name) ?? 0) + 1);
  }
  return [...count]
    .map(([name, deaths]) => ({ name, deaths }))
    .sort((a, b) => b.deaths - a.deaths || a.name.localeCompare(b.name, "ko"));
}

/**
 * 최근 습격. 새것부터.
 *
 * @param {object} history
 * @param {number} limit 몇 개까지
 */
export function recentRaids(history, limit = 5) {
  const list = (history?.raids ?? [])
    .filter((e) => !Number.isNaN(Date.parse(e?.at ?? "")))
    .slice()
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return list.slice(0, limit).map((e) => ({ ...e, ...raidKo(e.name) }));
}

/**
 * "3분 전" 처럼. 오래되면 날짜로 바꾼다.
 *
 * 습격은 방금 일어났는지가 중요하고, 지난주 일은 언제였는지가 중요하다.
 */
export function ago(iso, nowMs = Date.now()) {
  const t = Date.parse(iso ?? "");
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.round((nowMs - t) / 1000));
  if (sec < 60) return "방금";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 7) return `${day}일 전`;
  const d = new Date(t);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/**
 * 그 습격이 나던 무렵에 죽은 사람.
 *
 * 습격이 끝났다는 줄이 로그에 없어서 언제까지가 그 습격인지는 알 수 없다.
 * 시작한 뒤 몇 분 안에 죽었으면 그 습격 때문일 가능성이 크다는 정도로만
 * 묶는다. 단정하지 않는 것이 요점이다.
 */
export const RAID_WINDOW_MIN = 5;

export function deathsDuring(history, raidAt, windowMin = RAID_WINDOW_MIN) {
  const start = Date.parse(raidAt ?? "");
  if (Number.isNaN(start)) return [];
  const end = start + windowMin * 60 * 1000;
  const names = (history?.deaths ?? [])
    .filter((e) => {
      const t = Date.parse(e?.at ?? "");
      return !Number.isNaN(t) && t >= start && t <= end;
    })
    .map((e) => e.name);
  // 한 습격에 두 번 죽는 사람이 있다. 이름을 두 번 적지 않는다.
  return [...new Set(names)];
}
