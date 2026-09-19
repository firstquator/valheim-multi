# -*- coding: utf-8 -*-
"""추출해 둔 조각들을 합쳐 data/items.json 을 만든다.

들어오는 것
  game_items.json  게임 번들에서 뽑은 ItemDrop 스탯과 Recipe
  items_raw.json   Jotunn 문서의 분류(Type)
  loc.json         게임에 들어 있는 공식 번역. 한국어 이름과 설명의 정본
  stations.json    제작대 PathID -> 이름
  icons_out/       아이콘 webp 파일 이름

나가는 것
  data/items.json  포털이 읽는 하나의 파일
"""
import json, io, os, sys, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stages import STAGES, STATION_STAGE, base_stage

SP = sys.argv[1]
ROOT = sys.argv[2]
ICONS = sys.argv[3]

g = json.load(io.open(SP + '/game_items.json', encoding='utf-8'))
raw = json.load(io.open(SP + '/items_raw.json', encoding='utf-8'))
loc = json.load(io.open(SP + '/loc.json', encoding='utf-8'))
stations = json.load(io.open(SP + '/stations.json', encoding='utf-8'))
have_icon = set(f[:-5] for f in os.listdir(ICONS) if f.endswith('.webp'))

dp = {int(k): v for k, v in g['dropPath'].items()}
jot = {i['prefab']: i for i in raw}

# 레시피를 prefab 이름 기준으로 정리한다.
recipes = {}
for r in g['recipes']:
    name = dp.get(r['itemPath'])
    if not name:
        continue
    st = stations.get(str(r['stationPath'])) if r['stationPath'] else None
    recipes[name] = {
        'amount': r['amount'],
        'station': st,
        'minLevel': r['minLevel'],
        'materials': [
            {'item': dp.get(x['path']), 'amount': x['amount'], 'perLevel': x['perLevel']}
            for x in r['resources'] if dp.get(x['path'])
        ],
    }

def _one(key, lang):
    e = loc.get(key)
    if not e:
        return None
    return e.get(lang) or e.get('en') or None

def _name(spec, lang):
    """이름 토큰을 번역한다.

    토큰이 하나가 아닌 경우가 있다. 장비 강화에 쓰는 우상은
    "$item_upgrader_tier0 $item_upgrader_armor $item_upgrader_name" 처럼
    세 조각을 이어 "나무 보호 우상" 이 된다. 조각 하나라도 못 찾으면
    반쪽짜리 이름이 나가므로 전부 찾았을 때만 이어 붙인다.
    """
    if not spec:
        return None
    parts = [p.lstrip('$') for p in str(spec).split() if p.strip()]
    if not parts:
        return None
    out = [_one(p, lang) for p in parts]
    if any(v is None for v in out):
        return None
    return ' '.join(out)

def ko(key, fallback=''):
    return _name(key, 'ko') or fallback

def en(key, fallback=''):
    return _name(key, 'en') or fallback

# 1) 아이템 기본형을 만든다. 게임 ItemDrop 이 정본이고 Jotunn 은 분류만 쓴다.
items = {}
for prefab, d in g['items'].items():
    nk = d.get('nameKey') or ''
    koName = _name(nk, 'ko')
    if not koName:
        continue                      # 이름이 안 풀리면 플레이어용 아이템이 아니다
    j = jot.get(prefab)
    dk = d.get('descKey') or ''
    items[prefab] = {
        'id': prefab,
        'ko': koName, 'en': en(nk),
        'koDesc': ko(dk), 'enDesc': en(dk),
        'type': j['type'] if j else None,
        'weight': d.get('weight'), 'stack': d.get('stack'),
        'maxQuality': d.get('maxQuality'), 'durability': d.get('durability'),
        'armor': d.get('armor'), 'armorPerLevel': d.get('armorPerLevel'),
        'food': d.get('food'), 'foodStamina': d.get('foodStamina'),
        'foodRegen': d.get('foodRegen'), 'eitr': d.get('eitr'),
        'foodBurnTime': d.get('foodBurnTime'),
        'blockPower': d.get('blockPower'),
        'teleportable': d.get('teleportable'),
        'value': d.get('value'),
        'damages': {k: v for k, v in (d.get('damages') or {}).items() if v},
        'recipe': recipes.get(prefab),
        'icon': prefab if prefab in have_icon else None,
        'stage': None,
    }

# 2) 단계를 정한다.
#    기본 재료는 표에서, 제작품은 재료와 제작대를 따라 올라가며 계산한다.
#    재료가 또 제작품일 수 있어 값이 더 안 변할 때까지 반복한다.
for p, it in items.items():
    if not it['recipe']:
        it['stage'] = base_stage(p)

for _ in range(12):
    changed = False
    for p, it in items.items():
        r = it['recipe']
        if not r:
            continue
        need = [STATION_STAGE.get(r['station'], 0)] if r['station'] else [0]
        # 단계를 모르는 재료는 건너뛴다. 하나라도 모르면 통째로 포기하게
        # 했더니 1070 개 중 304 개밖에 못 정했다. 업그레이드용 더미 아이템
        # 같은 것이 재료 목록에 섞여 있어서다. 아는 재료만으로도 "적어도
        # 이 단계 이후" 는 말할 수 있고, 그 편이 아무 말도 못 하는 것보다 낫다.
        got = False
        for m in r['materials']:
            s = items.get(m['item'], {}).get('stage')
            if s is None:
                s = base_stage(m['item'])
            if s is None:
                continue
            need.append(s)
            got = True
        if got or r['station']:
            v = max(need)
            if it['stage'] != v:
                it['stage'] = v
                changed = True
    if not changed:
        break

# 여기까지 와도 모르는 것은 이름으로 짐작한다. 조리한 음식이 대부분이다.
# 짐작인 것을 감추지 않으려고 guessed 로 표시해 둔다.
from stages import fallback_stage
guessed = 0
for p, it in items.items():
    if it['stage'] is None:
        v = fallback_stage(p)
        if v is not None:
            it['stage'] = v
            it['stageGuessed'] = True
            guessed += 1
print('이름으로 짐작한 것', guessed)

known = sum(1 for i in items.values() if i['stage'] is not None)
print(f'아이템 {len(items)} | 단계 확정 {known} | 미정 {len(items)-known}')
print('아이콘 있는 것', sum(1 for i in items.values() if i['icon']))
print('레시피 있는 것', sum(1 for i in items.values() if i['recipe']))
unknown = [p for p, i in items.items() if i['stage'] is None]
print('단계 미정 예:', unknown[:15])
print()
print('단계별 분포:')
c = collections.Counter(i['stage'] for i in items.values())
for n, slug, kolabel, note in STAGES:
    print(f'  {n} {kolabel:8} {c.get(n,0):4}개  ({note})')
print(f'  - 미정      {c.get(None,0):4}개')

# 도감에 없는 재료는 레시피에서 지운다. 남겨 두면 화면에 빈 칸이 생긴다.
dropped = 0
for it in items.values():
    r = it['recipe']
    if not r:
        continue
    keep = [m for m in r['materials'] if m['item'] in items]
    dropped += len(r['materials']) - len(keep)
    r['materials'] = keep
print('도감에 없어 레시피에서 뺀 재료 참조', dropped)

out = {
    'schemaVersion': 1,
    'gameVersion': '1.0.15',
    'stages': [{'n': n, 'slug': s, 'ko': k, 'note': note} for n, s, k, note in STAGES],
    'items': sorted(items.values(), key=lambda x: (x['stage'] if x['stage'] is not None else 99, x['ko'])),
}
os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
json.dump(out, io.open(os.path.join(ROOT, 'data', 'items.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, separators=(',', ':'))
print('\ndata/items.json 저장')
