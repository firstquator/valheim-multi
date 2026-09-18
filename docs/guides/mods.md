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
| `ValheimModding/YamlDotNet` | 16.3.1 | ServersideQoL 의존성 |

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

# 3층: 모드팩 (친구들도 설치)

**서버 쪽 설치는 완료했다 (2026-09-18).** 친구들이 r2modman 프로필 코드를 받아 설치해야 실제로 접속이 된다. 자세한 내용은 아래 "서버 쪽 설치 결과" 참고.

## 구성

| 모드 | 버전 | 역할 |
|---|---|---|
| `denikson/BepInExPack_Valheim` | 5.4.2350 | 모드 로더 |
| `shudnal/ExtraSlots` | 1.2.10 | **장비 슬롯 창**, 음식/탄약/유틸 전용 슬롯 |
| `shudnal/ConditionalConfigSync` | 1.0.8 | `ExtraSlots` 의존성. 서버 설정값을 클라이언트에 강제 동기화 |
| `MathiasDecrock/PlanBuild` | 0.19.0 | 건축 청사진 |
| `MSchmoecker/MultiUserChest` | 0.6.2 | 여러 명이 같은 상자 동시 사용 |
| `ValheimModding/Jotunn` | 2.30.1 | `PlanBuild`, `MultiUserChest` 공통 의존성 (모딩 라이브러리) |

버전은 문서에 적어 둔 값을 믿지 말고 항상 Thunderstore API 로 다시 확인한다. `PlanBuild` 는 문서에 0.18.5 로 적혀 있었지만 실제 확인 시점(2026-09-18)의 최신은 0.19.0 이었다. `manifest.json` 을 열어보고서야 `ExtraSlots` 가 `ConditionalConfigSync`, `PlanBuild`/`MultiUserChest` 가 `Jotunn` 을 요구한다는 것을 알았다. Thunderstore 페이지 설명에는 이 의존성이 나오지 않는다.

## 서버 쪽 설치 결과 (2026-09-18)

### 바닐라 클라이언트는 접속할 수 없다

세 모드의 성격이 다르다.

- **`ExtraSlots`**: README 에 "does not require every connecting player to have the mod at the synchronization protocol level" 이라고 명시되어 있다. 바닐라 클라이언트도 접속은 된다. 다만 확장 슬롯 UI 는 보이지 않는다
- **`PlanBuild`, `MultiUserChest`**: 둘 다 `Jotunn` 을 쓰고, DLL 안에 `NetworkCompatibilityAttribute` 가 박혀 있다. `Jotunn` 을 쓰는 모드는 별도로 완화하지 않는 한 기본값이 "전원이 모드를 가지고 있어야 함" 이다. 즉 **이 두 모드가 서버에 있으면 모드 없는 바닐라 클라이언트는 접속하지 못하거나 버전 불일치로 튕긴다.**

실제 접속 테스트(모드 없는 클라이언트로 접속 시도)는 하지 않았다. 위 판단은 README 문구와 DLL 안의 속성 확인으로 내린 것이다. 결론적으로 **이 서버는 이제 3층 모드팩을 설치한 사람만 정상 접속할 수 있다.** 친구들에게 r2modman 프로필 코드 배포가 끝나기 전까지는 접속에 지장이 있을 수 있다는 뜻이다.

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

## 배포 방법 (r2modman 프로필 코드)

**프로필 코드 발급은 r2modman GUI 에서 방장이 직접 해야 하는 작업이다.** 자동화할 수 없다.

```
방장:
1. r2modman (또는 Thunderstore Mod Manager) 설치
2. Valheim 프로필 새로 생성
3. 아래 목록의 모드를 정확히 같은 버전으로 설치
4. "프로필 공유" -> 코드 발급
5. 발급된 코드를 data/mods.json 의 modpack.r2modmanCode 에 채워 넣는다

친구: r2modman 설치 -> 코드 붙여넣기 -> 동일 모드셋 자동 구성
```

프로필에 넣을 모드 목록 (버전은 이 문서의 "구성" 표와 항상 같아야 한다):

- `shudnal-ExtraSlots-1.2.10`
- `shudnal-ConditionalConfigSync-1.0.8`
- `MathiasDecrock-PlanBuild-0.19.0`
- `ValheimModding-Jotunn-2.30.1`
- `MSchmoecker-MultiUserChest-0.6.2`

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

# 검토 목록 (2026-09-18 조사)

Thunderstore 전체 카탈로그(11,376개)와 대조한 결과다. 판정 기준은 이렇다.

| 표시 | 의미 |
|---|---|
| 안전 | **Deep North Update** 태그 보유. 제작자가 1.0 대응을 명시했다 |
| 미확인 | 1.0 출시(2026-09-09) 이후 업데이트했으나 Deep North 태그는 없다 |
| 위험 | 1.0 출시 전이 마지막 업데이트다 |

## 판정표

| 모드 | 패키지 | 버전 | 최종 | 판정 |
|---|---|---|---|---|
| MassFarming | `MainStreetGaming/MassFarming` | 1.13.0 | 09-10 | 안전 |
| Slope Combat Assistance | `Digitalroot/Digitalroots_Slope_Combat_Assistance` | 2.0.30 | 09-10 | 안전 |
| FastTeleport | `GemHunter1/FastTeleport` | 1.1.1 | 09-09 | 안전 |
| SkilledCarryWeight | `Searica/SkilledCarryWeight` | 1.5.0 | 09-15 | 안전, **도입 결정** |
| MyLittleUI | `shudnal/MyLittleUI` | 1.2.19 | 09-15 | 안전 |
| Gizmo | `ComfyMods/Gizmo` | 1.16.0 | 09-14 | 안전 |
| BottleShips | `sighsorry/BottleShips` | 1.1.12 | 09-09 | 안전 |
| WackyEpicMMOSystem | `WackyMole/WackyEpicMMOSystem` | 1.9.67 | 09-13 | 안전, **도입 결정** |
| AzuClock | `Azumatt/AzuClock` | 1.1.0 | 09-14 | 미확인 |
| TrueInstantLootDrop | `Azumatt/TrueInstantLootDrop` | 1.0.4 | 09-14 | 미확인 |
| QuickStackStore | `Goldenrevolver/Quick_Stack_Store_Sort_Trash_Restock` | 1.4.15 | 09-12 | 미확인 |
| AzuRepair | `Azumatt/AzuAreaRepair` (추정) | 1.1.7 | 09-14 | 미확인, 이름 불일치 |
| TargetPortal | `Smoothbrain/TargetPortal` | 1.2.3 | **2026-02-22** | 위험 |
| Farming | `Smoothbrain/Farming` | 2.2.2 | **2026-02-05** | 위험 |
| InteractWhileBuilding | `tonsit/InteractWhileBuilding` | 1.0.0 | **2021-03-01** | 위험, 5년 방치 |
| ValheimGammaMod | `ColdSpirit/ValheimGammaMod` | 1.0.0 | **2022-01-18** | 위험, 4년 방치 |
| CraftFromContainers | 여러 포크 | - | - | 위험, **1.0 대응판 없음** |

## 개별 메모

**`CraftFromContainers`: 1.0 대응판이 존재하지 않는다**

포크 세 개를 전부 확인했다. `aedenthorn_mods` 와 `DrZed` 는 폐기, `rendl0449` 는 2024-11 이후 방치다. "작업대에서 근처 상자 자원 쓰기"는 현재 대안이 없다.

가장 가까운 대체재가 `ServersideQoL_AutoProcess` 인데, 이쪽은 **제련소·가마·풍차 자동 공급**이라 제작대 크래프팅은 커버하지 않는다. 계속 주시할 항목이다.

**`ValheimGammaMod` 는 대안이 있다**

`ColdSpirit/ValheimGammaMod` 는 2022년 이후 방치다. 대신 `shudnal/GammaOfNightLights` 1.0.10 (2026-09-10, Deep North 태그 보유) 이 같은 목적의 현행 모드다.

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

**`AzuRepair` 는 정확한 패키지를 특정하지 못했다**

`Azumatt` 계정에서 수리 관련으로 `AzuAreaRepair` (1.1.7, 09-14), `RepairStation` (1.2.6, 2026-02) 를 찾았다. 어느 쪽을 의도한 것인지 확인이 필요하다.

## 계층 분류

위 17개는 **전부 3층**이다. Thunderstore 분류에서 모두 `Client-side` 를 달고 있어 친구들도 설치해야 한다.

1층(서버 전용)으로 쓸 수 있는 것은 `ServersideQoL` 모듈 계열뿐이다.

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
| 3층 모드팩 | 서버 쪽 설치 완료 (2026-09-18). r2modman 프로필 코드 미발급 - 친구 배포 전 단계 |
