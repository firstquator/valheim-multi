// 배포 경로를 앞에 붙인다.
//
// 사이트가 /valheim-multi/ 아래에 놓이므로 "/gaybar-modpack.r2z" 로 쓰면
// 배포본에서 404 가 난다. BASE_URL 끝의 슬래시 유무에 관계없이 정확히
// 하나만 남긴다.
export const base = (file) =>
  `${import.meta.env.BASE_URL.replace(/\/+$/, "")}/${file}`;
