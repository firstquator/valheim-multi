// 사이드바와 본문 패널이 함께 읽는 탭 목록.
//
// 여기 적은 id 가 Tabs.astro 의 슬롯 이름이자 라디오 id(#tab-<id>)가 된다.
// 목록에 없는 슬롯에 내용을 넣으면 화면에 나오지 않는다.
export const TABS = [
  { id: "server", label: "서버", icon: "home-01" },
  { id: "mods", label: "모드", icon: "package-02" },
  { id: "install", label: "설치 가이드", icon: "download-04" },
  { id: "dex", label: "도감", icon: "book-open-01" },
  { id: "guide", label: "공략", icon: "target-02" },
  { id: "world", label: "월드", icon: "globe-02" },
];
