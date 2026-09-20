// 도감 데이터를 한 번만 받아 여러 섬이 나눠 쓴다.
//
// 도감 탭과 공략 탭이 둘 다 items.json 이 필요하다. 각자 받으면 같은
// 680KB 를 두 번 요청하게 된다. 약속(Promise)을 기억해 두면 나중에
// 부르는 쪽은 이미 받아 둔 것을 그대로 받는다.

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, "");

let pending = null;

/**
 * @returns {Promise<{items: object[], stages: object[], byId: Map}>}
 * @throws 받지 못하면 던진다. 부르는 쪽이 화면에 사정을 적어야 한다.
 */
export function loadItems() {
  if (pending) return pending;
  pending = (async () => {
    // force-cache 를 쓰면 안 된다. 만료를 무시하고 캐시를 먼저 쓰기 때문에,
    // 도감을 새로 배포해도 친구 브라우저는 옛 목록을 계속 보여 준다.
    // 실제로 요리 변환을 추가한 뒤에도 화면이 그대로였다.
    // no-cache 는 캐시를 버리는 것이 아니라 서버에 "바뀌었나" 를 묻는 것이라,
    // 안 바뀌었으면 304 로 끝나 전송량도 거의 들지 않는다.
    const res = await fetch(`${BASE}/items.json`, { cache: "no-cache" });
    if (!res.ok) throw new Error(`items.json ${res.status}`);
    const db = await res.json();
    return {
      items: db.items,
      stages: db.stages,
      byId: new Map(db.items.map((i) => [i.id, i])),
    };
  })().catch((e) => {
    // 실패한 약속을 남겨 두면 두 번째 부르는 쪽도 영영 실패한다.
    // 지워서 다음에 다시 시도할 수 있게 한다.
    pending = null;
    throw e;
  });
  return pending;
}

/** 아이콘 주소. 아이콘 파일 이름은 아이템 id 와 같다. */
export function iconUrl(icon) {
  return `${BASE}/items/${icon}.webp`;
}
