# 모드 구성과 설치

최종 수정: 2026-09-18

## 한눈에 보기

모드는 **누가 설치해야 하는가**로 나뉜다. 이 분류가 운영 난이도를 결정한다.

| 계층 | 설치 위치 | 친구가 할 일 | 버전 통일 |
|---|---|---|---|
| **1층** | 서버에만 | **없음** | 불필요 |
| **2층** | 각자 원하는 사람만 | 개인 선택 | 불필요 |
| **3층** | 서버 + 전원 | 모드팩 코드 적용 | **필수** |

**설계 원칙: 1층에서 되는 것은 3층으로 올리지 않는다.**

3층 모드가 하나라도 있으면 8명 전원이 버전을 맞춰야 하고, 한 명만 어긋나도 그 사람은 접속하지 못한다. 모드 개수가 아니라 **3층의 존재 여부**가 운영 부담을 만든다.

## 난이도 기준

편의 기능은 넣되 **난이도를 낮추는 모드는 넣지 않는다.**

제외한 것:
- `Epic Loot` (랜덤 매직 드롭, 엔드게임 파워 스케일링)
- `Jewelcrafting` (젬 소켓 파워 스케일링)
- `ServersideQoL_Player` (무한 스태미나)
- `ValheimPlus` 계열의 배수 설정, 무게 제한 증가, 사망 페널티 제거

### 사망 시 아이템 보존 (2026-09-19 검토, 도입하지 않음)

"죽어도 아이템을 안 떨어뜨리게" 요청이 있어 조사했다. 결론은 **그대로 둔다** 이다.

지금 상태부터 정확히 적어 둔다. `deathpenalty_casual` 은 **착용 중인 것을 이미 지켜준다.** 갑옷, 장신구, 손에 든 무기와 도구, 화살은 죽어도 남는다. 떨어지는 것은 가방 안 물건이고 스킬은 1% 깎인다. 장비를 잃고 그 바이옴에 다시 못 가는 최악의 상황은 이미 막혀 있다.

**바닐라 설정으로는 페널티를 완전히 끌 수 없다.** 가장 낮은 단계에서도 비장착 아이템은 떨어진다. 그래서 모드가 필요하다.

후보 조사 결과다.

| 후보 | 결과 |
|---|---|
| `ArgusMagnus/ServersideQoL_Player` | **사망 관련 옵션이 없다.** 무한 스태미나, 희생 버프, 수레 인벤토리뿐이다. 서버 전용으로 해결할 길이 없다는 뜻이다 |
| `Crystal/DeathPenalty` 1.3.1 | 이름과 달리 **아이템 드롭을 막지 않는다.** 스킬 손실량과 버프 지속시간만 조정한다. 서버와 클라이언트 양쪽 설치가 필요하다 |

도입하지 않은 이유는 두 가지다.

- **1층으로 해결할 방법이 없다.** 3층으로 올려야 하고 친구 8명이 프로필을 다시 받아야 한다. 얻는 것은 가방 내용물 보존뿐이다
- **난이도 기준과 충돌한다.** 위의 "제외한 것" 에 사망 페널티 제거가 들어 있다

나중에 도입하기로 한다면 **기준 자체를 고치고 진행한다.** 기준을 남겨 둔 채 예외만 늘리면 다음 판단이 흔들린다.

> 참고: 월드 `gaybar` 자체에 이미 1.0 월드 설정이 걸려 있다.
> `combat_hard : deathpenalty_casual : resources_more : portals_casual`
> 전투는 어렵게, 사망 페널티는 가볍게, 자원 150%, 포탈 금속 운반 허용.
> 이 설정은 월드 파일에 저장되어 서버로 그대로 이전되었다.

---

# 1층: 서버 전용 모드

친구들은 아무것도 설치하지 않는다. 바닐라 클라이언트로 그대로 접속한다.

## 설치된 것

| 모드 | 버전 | 역할 |
|---|---|---|
| `denikson/BepInExPack_Valheim` | 5.4.2350 | 모드 로더. 컨테이너가 자동 설치 |
| `Advize/PlantEverything` | 1.21.2 | 베리, 버섯, 엉겅퀴, 민들레 재배 허용 |
| `ArgusMagnus/ServersideQoL` | 2.0.13 | 기능 모듈들의 **프레임워크** |
| `ArgusMagnus/ServersideQoL_AutoProcess` | 2.0.11 | **제련소, 가마, 풍차 자동 공급** |
| `ArgusMagnus/ServersideQoL_ContainerSigns` | 2.0.11 | 상자에 내용물 표시 간판 |
| `ArgusMagnus/ServersideQoL_AutoMapTables` | 2.0.11 | 지도 테이블에 포탈, 배, 광맥 아이콘 자동 표시 |
| `ArgusMagnus/ServersideQoL_AutoDoors` | 2.0.11 | 문 자동 닫힘 |
| `ArgusMagnus/ServersideQoL_TameAssist` | 2.0.11 | 길들인 동물 관련 설정 |
| `shudnal/GammaOfNightLights` | 1.0.10 | 야간 조명/낮밤 길이 조정 프레임워크 (기본값 그대로, `ValheimGammaMod` 대체) |
| `ValheimModding/YamlDotNet` | 16.3.1 | ServersideQoL 의존성 |
| `shudnal/ConditionalConfigSync` | 1.0.8 | GammaOfNightLights 의존성 (ExtraSlots 도 같이 씀, 3층 참고) |

## 주의: ServersideQoL 은 프레임워크다

이름만 보면 QoL 기능이 다 들어있을 것 같지만 아니다. README 원문:

> This mod does nothing on its own, it provides the framework for the Other ServersideQoL mods

실제 기능은 **별도 모듈**로 배포된다. 프레임워크만 깔면 아무 일도 일어나지 않는다.

### 사용 가능한 모듈 (같은 제작자)

| 모듈 | 기능 | 도입 |
|---|---|---|
| `ServersideQoL_AutoProcess` | 제련소, 가마, 풍차에 근처 상자에서 자동 공급 | **도입 완료** |
| `ServersideQoL_AutoStore` | 떨어진 아이템과 인벤 물건을 근처 상자로 자동 보관 | 제외 (`QuickStackStore` 와 중복) |
| `ServersideQoL_ContainerSigns` | 상자에 내용물 표시 간판 | **도입 완료** |
| `ServersideQoL_AutoPortalHub` | 포탈 허브 자동 생성 | 제외 (`TargetPortal` 과 중복) |
| `ServersideQoL_AutoMapTables` | 지도 테이블에 포탈, 배, 광맥 아이콘 자동 표시 | **도입 완료** |
| `ServersideQoL_ContainerSizes` | 상자 용량 설정 가능 | **제외** (난이도 저하 소지, 아래 개별 메모 참고) |
| `ServersideQoL_AutoDoors` | 문 자동 닫힘 | **도입 완료** |
| `ServersideQoL_TameAssist` | 길들인 동물 관련 설정 | **도입 완료** |
| `ServersideQoL_Player` | 무한 스태미나 등 | **제외** (난이도 저하) |

프레임워크는 2.0.13, 모듈은 2.0.11 로 버전이 다르다. 도입 시 호환성을 확인한다.

## 주의: 패처 DLL 문제 (해결됨)

`ServersideQoL` 은 `patchers/` 디렉터리에 DLL 이 있어야 초기화된다. 없으면 플러그인은 로드되지만 **config 파일조차 생성하지 못하고 기능이 전부 죽는다.** 로그에는 이렇게 뜬다.

```
[Error :ServersideQoL] ServersideQoL.Patchers.dll was not installed correctly.
                       Put it in /opt/valheim/bepinex/BepInEx/patchers
```

문제는 두 겹이었다.

1. 컨테이너 이미지는 `/config/bepinex/plugins` 만 동기화하고 **`patchers` 는 다루지 않는다**
2. 이미지가 매 기동마다 `/opt/valheim/bepinex` 트리를 통째로 새로 만들고, 헌 트리를 `bepinex.old` 로 밀어내며 교체한다

해결까지 네 번 시도했다. 실측 기록이다.

| 시도 | 결과 | 원인 |
|---|---|---|
| `/config/bepinex/patchers` 에 배치 | 실패 | 이미지가 `plugins` 만 동기화한다 |
| 그 경로에 볼륨 마운트 | 실패 | 트리 교체 시 고아가 된다 (`device busy`) |
| `POST_BEPINEX_CONFIG_HOOK` | 실패 | 훅이 트리 교체보다 **먼저** 실행되어 복사분이 지워진다 |
| **`PRE_START_HOOK`** | **성공** | 서버 시작 직전, 트리 교체 이후에 실행된다 |

`server/docker-compose.yml` 에 두 훅을 모두 걸어 두었다. 어느 경로로 기동하든 덮기 위해서다.

성공 판정은 로그의 `2 patcher plugins loaded` 와 config 파일 생성 여부로 한다.
`1 patcher plugins loaded` 이면 BepInEx 자체 패처만 로드된 것이라 실패다.

---

# 2층: 개인 선택 모드

서버와 무관하다. 원하는 사람만 자기 클라이언트에 설치하면 되고, 설치하지 않은 친구도 아무 지장 없이 접속하고 플레이할 수 있다. **서버에는 설치하지 않았다.**

| 모드 | 버전 | 역할 |
|---|---|---|
| `MainStreetGaming/MassFarming` | 1.13.0 | 단축키로 주변 범위 수확/파종 |
| `GemHunter1/FastTeleport` | 1.1.1 | 포탈/던전 로딩 대기시간 단축 |
| `ComfyMods/Gizmo` | 1.16.0 | 건축 배치 시 축 회전 보조 도구 |
| `shudnal/MyLittleUI` | 1.2.20 | 생산 타이머, 툴팁, 상자 이름, 버프 목록 등 UI 편의 모음 |
| `Goldenrevolver/Quick_Stack_Store_Sort_Trash_Restock` | 1.4.15 | 인벤토리 빠른 정리/보관/버리기 |

설치 방법: Thunderstore 에서 위 패키지를 받아 개인 `BepInEx/plugins` 에 넣으면 된다. 프로필 파일에는 포함되어 있지 않다. 프로필 파일은 3층(전원 필수) 모드만 담는다.

**2층 판정 근거는 "계층 분류" 절 참고.** README 문구나 DLL 안의 `NetworkCompatibilityAttribute` 유무로 확인했다.

---

# 3층: 모드팩 (친구들도 설치)

**서버 쪽 설치는 완료했다 (2026-09-18).** 친구들이 프로필 파일을 받아 설치해야 실제로 접속이 된다. 자세한 내용은 아래 "서버 쪽 설치 결과" 참고.

## 구성

| 모드 | 버전 | 역할 |
|---|---|---|
| `denikson/BepInExPack_Valheim` | 5.4.2350 | 모드 로더 |
| `shudnal/ExtraSlots` | 1.2.10 | **장비 슬롯 창**, 음식/탄약/유틸 전용 슬롯 |
| `shudnal/ConditionalConfigSync` | 1.0.8 | `ExtraSlots` 의존성. 서버 설정값을 클라이언트에 강제 동기화 |
| `MathiasDecrock/PlanBuild` | 0.19.0 | 건축 청사진 |
| `MSchmoecker/MultiUserChest` | 0.6.2 | 여러 명이 같은 상자 동시 사용 |
| `ValheimModding/Jotunn` | 2.30.1 | `PlanBuild`, `MultiUserChest`, `SlopeCombatAssistance`, `SkilledCarryWeight` 공통 의존성 (모딩 라이브러리) |
| `Digitalroot/Digitalroots_Slope_Combat_Assistance` | 2.0.30 | 경사면 전투 버그 보정 |
| `Searica/SkilledCarryWeight` | 1.5.0 | 스킬 연동 소지 중량 증가 |
| `sighsorry/BottleShips` | 1.1.12 | 배/수레/공성 장비를 병에 담아 이동 |
| `WackyMole/WackyEpicMMOSystem` | 1.9.67 | 레벨/스탯 RPG 시스템 |

버전은 문서에 적어 둔 값을 믿지 말고 항상 Thunderstore API 로 다시 확인한다. `PlanBuild` 는 문서에 0.18.5 로 적혀 있었지만 실제 확인 시점(2026-09-18)의 최신은 0.19.0 이었다. `manifest.json` 을 열어보고서야 `ExtraSlots` 가 `ConditionalConfigSync`, `PlanBuild`/`MultiUserChest` 가 `Jotunn` 을 요구한다는 것을 알았다. Thunderstore 페이지 설명에는 이 의존성이 나오지 않는다.

## 서버 쪽 설치 결과 (2026-09-18)

### 바닐라 클라이언트는 접속할 수 없다

모드마다 성격이 다르다.

- **`ExtraSlots`**: README 에 "does not require every connecting player to have the mod at the synchronization protocol level" 이라고 명시되어 있다. 바닐라 클라이언트도 접속은 된다. 다만 확장 슬롯 UI 는 보이지 않는다
- **`PlanBuild`, `MultiUserChest`, `SlopeCombatAssistance`, `SkilledCarryWeight`**: 전부 `Jotunn` 을 쓰고, DLL 안에 `NetworkCompatibilityAttribute` 가 박혀 있다. `Jotunn` 을 쓰는 모드는 별도로 완화하지 않는 한 기본값이 "전원이 모드를 가지고 있어야 함" 이다
- **`BottleShips`**: `Jotunn` 은 안 쓰지만 README 원문에 "must be installed on the server and every connecting client because it adds synchronized network prefabs and gameplay settings" 라고 명시되어 있다
- **`WackyEpicMMOSystem`**: `NetworkCompatibilityAttribute` 나 `Jotunn` 의존을 확인하지 못했다. 기술적 차단 증거는 없지만, 레벨/스탯을 서버가 들고 있는 시스템이라 일부만 설치하면 형평성이 깨진다. 자세한 근거는 아래 "검토 목록"의 "계층 분류" 절 참고

즉 **`ExtraSlots` 를 제외한 나머지 여섯 개(PlanBuild, MultiUserChest, SlopeCombatAssistance, SkilledCarryWeight, BottleShips, WackyEpicMMOSystem)는 서버에 있으면 모드 없는 바닐라 클라이언트가 접속하지 못하거나, 접속하더라도 정상적인 플레이가 되지 않는다.**

실제 접속 테스트(모드 없는 클라이언트로 접속 시도)는 하지 않았다. 위 판단은 README 문구와 DLL 안의 속성 확인으로 내린 것이다. 결론적으로 **이 서버는 이제 3층 모드팩을 설치한 사람만 정상 접속할 수 있다.** 친구들이 프로필 파일을 설치하기 전까지는 접속에 지장이 있다는 뜻이다.

### ExtraSlots 인벤토리 옵션은 서버가 강제한다

`shudnal.ExtraSlots.cfg` 를 열어 보면 인벤토리 관련 설정 대부분이 `[Synced with Server]` 로 표시되어 있고, `[General] Lock Configuration` 기본값이 `true` 다. 이 경우 클라이언트는 서버가 정한 값을 바꿀 수 없다.

기본값이 이미 원하는 정책과 정확히 같아서 **설정을 따로 건드리지 않았다.**

- `Amount of extra inventory rows = 0` (인벤토리 줄 추가 없음, 기본값 그대로 끔)
- `Enable ammo slots / Enable food slots / Enable misc slots = true` (탄약/음식/기타 슬롯 켬)
- `Amount of extra utility slots = 2` (유틸리티 슬롯 켬)
- 장비 슬롯은 `[Progression - Discovery] Equipment slots = true` 로 기본 활성

친구들 클라이언트에서 이 값들을 바꿔도 서버 접속 시 서버 값으로 강제 동기화된다.

### `MultiUserChest` 는 Deep North 태그가 없다

Thunderstore 카테고리에 `Bog Witch Update` 만 있고 `Deep North Update` 는 없다. 최종 업데이트(2026-09-12)가 1.0 출시(2026-09-09) 이후이긴 하지만, 제작자가 1.0 대응을 명시적으로 확인한 표시는 아니다. 서버 로그 상으로는 로드 시 오류 없이 정상 동작했지만, 상자 동시 사용 자체는 실제 플레이 중에만 검증되는 기능이라 지켜볼 필요가 있다.

## 경고: 인벤토리 모드 충돌

**친구들에게 반드시 전달해야 할 내용이다.**

다음 세 모드는 같은 인벤토리 코드를 패치한다.

- `shudnal/ExtraSlots`
- `RandyKnapp/EquipmentAndQuickSlots`
- `Azumatt/AzuExtendedPlayerInventory`

**둘 이상을 함께 설치하면 슬롯이 늘어나는 것이 아니라 슬롯 참조가 손상되고 재접속 시 아이템이 소실된다.**

셋 중 정확히 하나만 설치한다. 이 서버는 `ExtraSlots` 를 쓴다.

참고로 `AzuExtendedPlayerInventory` 는 2026-09-14 자로 **공식 폐기(Deprecated)** 되었다.

## 장비 슬롯 창

`ExtraSlots` 가 장비 전용 슬롯을 제공한다. 별도 모드가 필요 없다.

> More inventory slots dedicated for **equipment**, food, ammo and misc items. Extra utility slots. Quick slots.

설정으로 각 슬롯 그룹을 켜고 끌 수 있다. 인벤토리 줄 자체를 늘리는 옵션은 난이도 저하로 보고 끈다. 장비, 음식, 탄약 슬롯만 켠다.

**이 정책은 서버 설정으로 강제되어 있다.** 위 "서버 쪽 설치 결과" 절 참고. 친구들 클라이언트 설정과 무관하게 서버 값이 적용된다.

## 배포 방법 (프로필 파일)

**프로필 파일을 만들어 사이트에 올려 두었다. 방장이 GUI 로 할 일은 없다.**

친구는 사이트의 설치 가이드에서 파일을 내려받아 r2modman 의 `From file` 로 불러오면 된다. 목록과 버전이 그대로 맞춰진다.

**프로필에는 3층(전원 필수)과 2층(개인 선택)을 모두 담는다.** 1층은 서버에만 깔리므로 넣지 않는다.

2층을 담아도 강제가 되지 않는다. 서버가 검사하는 것은 3층뿐이라 2층이 없어도 튕기지 않는다. 원하지 않는 사람은 r2modman 에서 그 모드만 꺼 두면 된다. 빼면 2층을 쓰고 싶은 사람이 이름을 하나씩 검색해 따로 받아야 하고, 그 과정에서 틀린 모드를 받거나 인벤토리 충돌 같은 사고가 생긴다.

| 항목 | 값 |
|---|---|
| 파일 | `web/public/gaybar-modpack.r2z` |
| 배포 경로 | `https://firstquator.github.io/valheim-multi/gaybar-modpack.r2z` |
| 만드는 곳 | `scripts/build-modpack.mjs` |
| 다시 만들기 | `npm run modpack` |

### 패키지 이름이 실재하는지 확인한다

```bash
npm run modpack:verify
```

프로필의 모든 패키지가 Thunderstore 에 그 버전으로 있는지 확인한다. 이름이 하나라도 틀리면 가져오기가 통째로 실패한다. 실제로 `SlopeCombatAssistance` 와 `QuickStackStore` 두 건이 축약된 이름으로 적혀 있어 **존재하지 않는 패키지를 가리키고 있었다.** 둘 다 이 검사로 찾았다.

네트워크를 타므로 일반 테스트에는 넣지 않았다. 모드를 바꾼 뒤 직접 돌린다.

### 모드를 바꾸면 반드시 다시 만든다

`data/mods.json` 의 3층 모드나 `modpack.dependencies` 를 고치면 `npm run modpack` 을 다시 돌려야 한다. 잊으면 친구들이 낡은 버전을 깔게 되고, **버전이 다른 사람은 접속하지 못한다.**

잊는 것을 막으려고 `tests/modpack.test.mjs` 가 커밋된 파일과 `data/mods.json` 을 대조한다. 어긋나면 `npm test` 가 실패한다.

### 포맷 근거

`.r2z` 는 `export.r2x`(YAML) 하나가 든 zip 이다. r2modman 소스에서 확인했다.

- `src/utils/ProfileUtils.ts` : `.r2z` 안의 `export.r2x` 를 읽는다
- `src/model/exports/ExportMod.ts` : `name`, `version{major,minor,patch}`, `enabled`

`name` 은 Thunderstore 의 `작성자-패키지명` 이다. 하나라도 틀리면 가져오기가 실패한다. 실제로 `Digitalroot/SlopeCombatAssistance` 로 잘못 적혀 있던 것을 API 로 대조해 `Digitalroot/Digitalroots_Slope_Combat_Assistance` 로 고쳤다.

### 프로필 코드를 쓰고 싶다면

코드 발급은 r2modman GUI 에서 사람이 직접 해야 한다. 발급했다면 `data/mods.json` 의 `modpack.r2modmanCode` 에 채운다. 사이트가 코드 방식도 함께 안내한다. 채우지 않아도 파일 방식으로 설치가 되므로 필수는 아니다.

프로필에 넣을 모드 목록 (버전은 이 문서에 적힌 값과 항상 같아야 한다). 3층(전원 필수) 모드만 넣는다. 2층(개인 선택) 모드는 원하는 사람이 각자 알아서 추가하는 것이라 이 프로필에는 넣지 않는다.

- `shudnal-ExtraSlots-1.2.10`
- `shudnal-ConditionalConfigSync-1.0.8`
- `MathiasDecrock-PlanBuild-0.19.0`
- `ValheimModding-Jotunn-2.30.1`
- `MSchmoecker-MultiUserChest-0.6.2`
- `Digitalroot-Digitalroots_Slope_Combat_Assistance-2.0.30`
- `Searica-SkilledCarryWeight-1.5.0`
- `sighsorry-BottleShips-1.1.12`
- `WackyMole-WackyEpicMMOSystem-1.9.67`

친구가 할 일은 코드 하나를 붙여넣는 것뿐이다. 코드는 한곳에서만 관리한다. 메신저로 뿌리면 옛 코드를 쓰는 사람이 반드시 생긴다. `data/mods.json` 의 `r2modmanCode` 가 코드를 담아 사이트에 표시하는 자리이므로, 코드가 나오면 그 자리를 채우고 다시 배포한다.

---

# 서버에 모드를 설치하는 절차

## 1. 접속자가 없는지 확인

```bash
cd server
docker compose exec -T valheim curl -s http://127.0.0.1/status.json | grep -o '"player_count": [0-9]*'
```

`0` 이어야 한다. 모드를 켜면 서버가 재시작되고 클라이언트 모드가 맞지 않는 사람은 튕긴다.

## 2. Thunderstore 에서 버전 확인

버전을 기억에 의존하지 않는다. API 로 확인한다.

```bash
curl -s "https://thunderstore.io/api/experimental/package/<작성자>/<모드명>/" \
  | python -c "import sys,json; d=json.load(sys.stdin); l=d['latest']; \
    print(l['version_number'], l['date_created'][:10], '폐기' if d.get('is_deprecated') else '')"
```

## 3. 패키지를 받고 의존성을 읽는다

Thunderstore 페이지 설명보다 `manifest.json` 이 정확하다.

```bash
curl -sL -o mod.zip "https://thunderstore.io/package/download/<작성자>/<모드명>/<버전>/"
unzip -p mod.zip manifest.json
```

`dependencies` 배열에 적힌 것을 모두 받아야 한다. `ServersideQoL` 은 이 방법으로 `YamlDotNet` 의존성을 찾았다. 페이지 설명만 봤으면 놓쳤을 것이다.

## 4. 파일 배치

DLL 의 위치는 패키지마다 다르다. 압축 내용을 먼저 확인한다.

| 패키지 안 위치 | 넣을 곳 |
|---|---|
| `plugins/*.dll` | `/config/bepinex/plugins/` |
| 루트의 `*.dll` | `/config/bepinex/plugins/` |
| `patchers/*.dll` | `/config/bepinex/patchers/` (훅이 옮겨준다) |

```bash
docker cp "C:/경로/plugins/." valheim:/config/bepinex/plugins/
docker run --rm -v valheim-config:/config alpine \
  sh -c 'chown -R 1000:1000 /config/bepinex && chmod -R u+rwX,go+rX /config/bepinex'
```

> Git Bash 에서 `docker cp` 를 쓸 때는 `MSYS_NO_PATHCONV=1` 을 설정하고 소스는
> `C:/...` 형식의 Windows 경로로 준다. `/c/...` 형식은 `C:\c\...` 로 잘못 변환된다.

## 5. 재시작하고 로그로 검증

**파일을 넣었다고 로드된 것이 아니다. 로그를 봐야 한다.**

```bash
docker compose restart
docker compose logs --since 3m 2>&1 | grep -E "plugins to load|Loading \[|Error"
```

기대하는 출력:

```
[Info :BepInEx] 3 plugins to load
[Info :BepInEx] Loading [PlantEverything 1.21.2]
[Info :BepInEx] Loading [ServersideQoL 2.0.13]
```

`0 plugins to load` 가 나오면 경로가 틀렸거나 동기화 전에 스캔된 것이다.

## 6. config 생성 확인

모드가 정상 초기화되면 설정 파일을 만든다. **이것이 진짜 동작 증거다.**

```bash
docker run --rm -v valheim-config:/config alpine ls -la /config/bepinex/*.cfg
```

`Loading [...]` 이 떴는데 config 가 없으면 초기화 중에 실패한 것이다.

---

# 운영 원칙

## 자동 업데이트를 켜지 않는다

`docker-compose.yml` 에서 `UPDATE_CRON` 과 `BEPINEX_UPDATE_CRON` 을 비워 두었다.

게임이나 BepInEx 가 무인 상태에서 올라가면 모드 스택이 깨져 아무도 접속하지 못하게 된다. 1.0 출시 후 이틀 만에 1.0.7 에서 1.0.12 로 갔고 지금은 1.0.14 다. 초기에는 핫픽스가 잦다.

업데이트는 사람이 판단해서, 백업을 확인한 뒤에 수행한다.

## 모드는 한 번에 하나씩 넣는다

여러 개를 동시에 넣고 서버가 안 뜨면 원인을 알 수 없다. 넣고 재시작하고 로그를 확인하는 사이클을 지킨다.

## 모드를 제거하는 것은 추가보다 위험하다

그 모드가 월드에 만든 오브젝트가 남아 있으면 로드 시 사라지거나 오류가 난다. 특히 `PlantEverything` 으로 심은 식물은 모드를 빼면 문제가 된다.

**제거 전에는 반드시 백업을 확인한다.**

```bash
ls -la C:/ValheimServer/backups/
```

---

# 검토 목록 (2026-09-18 조사, 2026-09-18 설치 완료)

Thunderstore 전체 카탈로그(11,376개)와 대조한 결과다. 판정 기준은 이렇다.

| 표시 | 의미 |
|---|---|
| 안전 | **Deep North Update** 태그 보유. 제작자가 1.0 대응을 명시했다 |
| 미확인 | 1.0 출시(2026-09-09) 이후 업데이트했으나 Deep North 태그는 없다 |
| 위험 | 1.0 출시 전이 마지막 업데이트다 |

## 판정표 (설치 결과 반영)

| 모드 | 패키지 | 최종 설치 버전 | 판정 | 처리 |
|---|---|---|---|---|
| MassFarming | `MainStreetGaming/MassFarming` | 1.13.0 | 안전 | **설치 완료 (2층)** |
| Slope Combat Assistance | `Digitalroot/Digitalroots_Slope_Combat_Assistance` | 2.0.30 | 안전 | **설치 완료 (3층)** |
| FastTeleport | `GemHunter1/FastTeleport` | 1.1.1 | 안전 | **설치 완료 (2층)** |
| SkilledCarryWeight | `Searica/SkilledCarryWeight` | 1.5.0 | 안전, 도입 결정 | **설치 완료 (3층)** |
| MyLittleUI | `shudnal/MyLittleUI` | 1.2.20 (조사 시점 1.2.19 에서 갱신) | 안전 | **설치 완료 (2층)** |
| Gizmo | `ComfyMods/Gizmo` | 1.16.0 | 안전 | **설치 완료 (2층)** |
| BottleShips | `sighsorry/BottleShips` | 1.1.12 | 안전 | **설치 완료 (3층)** |
| WackyEpicMMOSystem | `WackyMole/WackyEpicMMOSystem` | 1.9.67 | 안전, 도입 결정 | **설치 완료 (3층)** |
| QuickStackStore | `Goldenrevolver/Quick_Stack_Store_Sort_Trash_Restock` | 1.4.15 | 미확인(태그 없음)이지만 체인지로그로 1.0 대응 확인 | **설치 완료 (2층)** |
| AzuClock | `Azumatt/AzuClock` | - | 미확인 | **제외** (아래 개별 메모) |
| TrueInstantLootDrop | `Azumatt/TrueInstantLootDrop` | - | 미확인 | **제외** (아래 개별 메모) |
| AzuRepair | `Azumatt/AzuAreaRepair` 또는 `Azumatt/RepairStation` | - | 미확인, 이름 불일치 | **제외** (아래 개별 메모) |
| TargetPortal | `Smoothbrain/TargetPortal` | 1.2.3 | 위험 | 제외 |
| Farming | `Smoothbrain/Farming` | 2.2.2 | 위험 | 제외 |
| InteractWhileBuilding | `tonsit/InteractWhileBuilding` | 1.0.0 | 위험, 5년 방치 | 제외 |
| ValheimGammaMod | `ColdSpirit/ValheimGammaMod` | 1.0.0 | 위험, 4년 방치 | **제외, `GammaOfNightLights` 로 대체 설치 (1층)** |
| CraftFromContainers | 여러 포크 | - | 위험, 1.0 대응판 없음 | 제외 |

## 개별 메모

**`CraftFromContainers`: 1.0 대응판이 존재하지 않는다**

포크 세 개를 전부 확인했다. `aedenthorn_mods` 와 `DrZed` 는 폐기, `rendl0449` 는 2024-11 이후 방치다. "작업대에서 근처 상자 자원 쓰기"는 현재 대안이 없다.

가장 가까운 대체재가 `ServersideQoL_AutoProcess` 인데, 이쪽은 **제련소·가마·풍차 자동 공급**이라 제작대 크래프팅은 커버하지 않는다. 계속 주시할 항목이다.

**`ValheimGammaMod` 대신 `GammaOfNightLights` 를 설치했다**

`ColdSpirit/ValheimGammaMod` 는 2022년 이후 방치다. 원래 기능은 "밤과 동굴을 밝게 만든다"로, 이 자체가 어둠이라는 발헤임의 긴장 요소를 없애는 난이도 저하 모드다. 대신 `shudnal/GammaOfNightLights` 1.0.10 (Deep North 태그 보유, `ConditionalConfigSync` 에 의존)을 설치했는데, 이쪽은 밤 밝기 외에도 낮/밤 길이까지 제어하는 범용 도구다.

**설치는 했지만 기본값을 바꾸지 않았다.** config 확인 결과 `[Day night cycle] Enabled = false`, `Day length in seconds = 1800`(바닐라 기본값), 모든 밝기 배율이 `1`(변화 없음)으로 되어 있다. 즉 지금은 바닐라와 완전히 동일하게 동작한다. `ValheimGammaMod` 가 원래 하던 "밤을 밝게" 는 적용하지 않았다. 나중에 관리자가 명시적으로 밝기나 낮/밤 길이를 조정하고 싶으면 그때 config 를 바꾸면 된다. 자동으로 난이도를 낮추는 방향으로 켜 두지 않았다는 뜻이다.

**`Gizmo` 는 이전 조사의 상충이 해소되었다**

한 자료는 1.0 호환이라 하고 다른 자료는 2025년 3월 이후 미업데이트라 해서 보류했었다. 실제로는 `ComfyMods/Gizmo` **1.16.0, 2026-09-14, Deep North 태그 보유**다. 안전하다.

**`SkilledCarryWeight` 는 난이도 기준에 걸리지만 도입한다**

스킬이 오르면 소지 중량이 늘어난다. "무게 관리"라는 발헤임의 긴장 요소를 약화시킨다.
다만 무조건 늘어나는 것이 아니라 스킬을 올려야 늘어나므로, 무게 상한을 그냥 올려버리는
모드와는 성격이 다르다. 사용자 판단으로 도입하기로 했다 (2026-09-18).

**`WackyEpicMMOSystem` 은 성격이 다르지만 도입한다**

RPG 레벨업과 스탯 분배를 얹는 시스템이다. 편의 모드가 아니라 **게임 구조를 바꾸는
콘텐츠 모드**다. "편의 기능만" 이라는 기존 방침과는 결이 다르지만, 난이도를 낮추는
방향이 아니라 진행 축을 하나 더하는 쪽이라 사용자 판단으로 도입하기로 했다 (2026-09-18).

도입 시 주의: 기존 캐릭터의 레벨이 0부터 시작하므로 전원이 같은 시점에 적용해야
형평성 문제가 없다. 그리고 한 번 도입한 뒤 제거하면 레벨과 스탯이 전부 사라진다.

**`AzuClock`, `TrueInstantLootDrop` 은 폐기(Deprecated) 상태라 제외했다**

Thunderstore API 로 확인한 결과 `Azumatt/AzuClock` 1.1.0 과 `Azumatt/TrueInstantLootDrop` 1.0.4 모두 `is_deprecated: true` 다. Deep North 태그도 없다. 폐기된 모드를 새로 설치할 이유가 없어 제외했다.

**`AzuRepair` 는 결국 설치하지 않았다**

`Azumatt` 계정에서 수리 관련 후보 두 개를 확인했다. `AzuAreaRepair` (1.1.7, 2026-09-14 최종 업데이트)와 `RepairStation` (1.2.6, 2026-02 최종 업데이트) 모두 `is_deprecated: true` 로 확인됐다. `RepairStation` 은 마지막 업데이트가 1.0 출시(09-09) 이전이라 "위험" 판정에도 해당한다. 정확히 어느 쪽을 의도했는지 특정할 수 없었고, 확인된 두 후보 모두 폐기 상태라 추측으로 설치하지 않았다.

**`QuickStackStore` 는 태그는 없지만 체인지로그로 1.0 대응을 확인해 설치했다**

Thunderstore API 상으로는 Deep North 태그가 없어 "미확인" 판정이었다. 하지만 CHANGELOG.md 를 열어 보면 `1.4.14 - Updated for 1.0 release` 항목이 있고, 최신 `1.4.15` 는 "Equipment and Quickslots" 호환 핫픽스로 계속 관리되고 있다. 태그만으로 판단하지 않고 체인지로그 원문으로 1.0 대응을 확인한 뒤 설치했다.

## 계층 분류 (README/DLL 근거로 개별 판정)

이전 조사에서는 위 17개를 Thunderstore 의 `Client-side` 분류만 보고 "전부 3층"으로 뭉뚱그렸는데, 이는 부정확했다. 실제로는 모드마다 성격이 다르다. 아래는 README 문구와 DLL 안의 `NetworkCompatibilityAttribute` 유무를 직접 확인해 다시 판정한 결과다.

| 모드 | 계층 | 근거 |
|---|---|---|
| `GammaOfNightLights` | **1층** | `ConditionalConfigSync` 기반이라 `NetworkCompatibilityAttribute` 없음(DLL 확인). 낮/밤 길이는 서버가 시뮬레이션하는 값이라 클라이언트 모드 유무와 무관하게 전원에게 적용된다. 조명 시각 효과만 클라이언트 모드가 있어야 보인다 |
| `MassFarming` | **2층** | Thunderstore 분류가 `Client-side` 뿐이고 `Server-side` 태그가 아예 없다. 서버에 설치하지 않았다 |
| `FastTeleport` | **2층** | README 원문: "Client-side mod works with any server." 서버에 설치하지 않았다 |
| `Gizmo` | **2층** | Thunderstore 분류가 `Client-side` 뿐이다. 건축 배치 중에만 동작하는 순수 클라이언트 도구라 서버에 설치하지 않았다 |
| `MyLittleUI` | **2층** | `ConditionalConfigSync` 기반, `NetworkCompatibilityAttribute` 없음(DLL 확인). 툴팁/정렬 등 클라이언트 렌더링 UI라 안 깔아도 접속과 플레이에 지장이 없다. 서버에는 설치하지 않았다 |
| `QuickStackStore` | **2층** | DLL 에 `NetworkCompatibilityAttribute` 없음. 개인 인벤토리 정리 도구라 서버에 설치하지 않았다 |
| `SlopeCombatAssistance` | **3층** | `Jotunn` 의존, DLL 에 `NetworkCompatibilityAttribute` 확인됨(문자열 존재 확인, 정확한 enforcement 값까지는 역어셈블하지 않음) |
| `SkilledCarryWeight` | **3층** | `Jotunn` 의존, DLL 에 `NetworkCompatibilityAttribute` 확인됨 |
| `BottleShips` | **3층** | README 원문: "BottleShips must be installed on the server and every connecting client because it adds synchronized network prefabs and gameplay settings." DLL 에서 속성 문자열 자체는 못 찾았지만 README 가 명시적이라 3층으로 판정 |
| `WackyEpicMMOSystem` | **3층** | `NetworkCompatibilityAttribute` 나 `Jotunn` 의존은 확인되지 않았다. **하드웨어적 접속 차단 증거는 없다.** 다만 캐릭터 레벨/스탯을 서버가 들고 있는 시스템이고, 이 문서에 이미 적힌 형평성 우려("전원이 같은 시점에 적용해야") 때문에 실질적으로는 전원이 함께 써야 의미가 있는 모드라 3층으로 분류했다. 순수 기술적 차단 근거가 아니라 설계 의도에 근거한 판정임을 밝혀둔다 |

**실제 접속 테스트는 하지 않았다.** 위 판정은 README 문구, DLL 안의 속성 문자열 존재 여부, Thunderstore 분류 태그를 근거로 한 것이다.

1층(서버 전용)으로 쓸 수 있는 것은 `ServersideQoL` 모듈 계열과 `GammaOfNightLights` 다.

## `ServersideQoL_ContainerSizes` 를 제외한 근거 (2026-09-18)

상자 용량을 설정 가능하게 하고, 한 종류의 아이템만 든 상자는 용량이 무한히 늘어나게 하는 옵션도 있다.

보관 편의로 볼 여지가 있지만, 이 서버는 월드 설정으로 이미 `resources_more`(자원 150%) 를 켜 두어 들어오는 자원량이 늘어난 상태다. 여기에 상자 용량 제한까지 없애면 "채집한 것을 어디에 둘지" 라는 관리 부담이 사실상 사라진다. 이 프로젝트가 무게 제한 증가를 난이도 저하로 보고 제외한 것과 같은 결의 문제로 판단해 제외한다.

## 중복 회피

요청 목록과 겹치는 `ServersideQoL` 모듈은 도입하지 않는다.

| ServersideQoL 모듈 | 겹치는 것 | 처리 |
|---|---|---|
| `AutoStore` | `QuickStackStore` | **제외** |
| `AutoPortalHub` | `TargetPortal` | **제외** |
| `AutoProcess` | 없음 (`CraftFromContainers` 는 1.0 미대응) | **도입** |
| `ContainerSigns` | 없음 | 보류 |
| `AutoMapTables` | 없음 | 보류 (탐색 부담 감소 소지) |
| `ContainerSizes` | 없음 | 보류 (난이도 저하 소지) |

---

# 현재 상태

| 항목 | 상태 |
|---|---|
| BepInEx | 5.4.2350 설치됨 |
| PlantEverything | 1.21.2 로드 확인, config 생성됨 |
| YamlDotNet | 16.3.1 로드 확인 |
| ServersideQoL | 2.0.13 동작 확인 (config 생성됨) |
| ServersideQoL_AutoProcess | 2.0.11 동작 확인 (config 생성됨) |
| ServersideQoL_ContainerSigns | 2.0.11 동작 확인 (config 생성됨) |
| ServersideQoL_AutoMapTables | 2.0.11 동작 확인 (config 생성됨) |
| ServersideQoL_AutoDoors | 2.0.11 동작 확인 (config 생성됨) |
| ServersideQoL_TameAssist | 2.0.11 동작 확인 (config 생성됨) |
| Jotunn | 2.30.1 로드 확인 |
| ConditionalConfigSync | 1.0.8 로드 확인 (config 없음, 다른 모드가 값을 등록해야 생김) |
| ExtraSlots | 1.2.10 동작 확인 (config 생성됨, 서버 강제 정책 기본값 그대로) |
| PlanBuild | 0.19.0 동작 확인 (config 생성됨) |
| MultiUserChest | 0.6.2 로드 확인 (config 없음 - 이 모드는 설정 항목 자체가 없음, DLL 에 BepInEx.Configuration 참조 없음으로 확인) |
| GammaOfNightLights | 1.0.10 동작 확인 (config 생성됨, 기본값 그대로라 바닐라와 동일) |
| Digitalroot's Slope Combat Assistance | 2.0.30 동작 확인 (config 생성됨) |
| SkilledCarryWeight | 1.5.0 동작 확인 (config 생성됨) |
| BottleShips | 1.1.12 동작 확인 (config 생성됨) |
| EpicMMOSystem / EpicMMOSystemUI | 1.9.67 동작 확인 (DLL 하나가 플러그인 두 개로 등록됨, 둘 다 config 생성됨) |
| 3층 모드팩 | 서버 쪽 설치 완료 (2026-09-18). 프로필 파일 생성 완료, 사이트에서 내려받을 수 있다. BepInEx 로더와 의존성 2종을 포함해 총 10개 패키지가 들어간다 |
| 2층 모드 | MassFarming, FastTeleport, Gizmo, MyLittleUI, QuickStackStore - 서버에는 설치하지 않음, 원하는 사람만 개인 클라이언트에 설치 |
