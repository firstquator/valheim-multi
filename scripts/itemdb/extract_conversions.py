# -*- coding: utf-8 -*-
"""화덕, 용광로, 발효통의 변환표를 뽑는다.

Recipe 로 잡히지 않는 것들이 있다. 고기를 굽는 것, 광석을 녹이는 것,
벌꿀술을 발효시키는 것은 모두 Recipe 가 아니라 그 설비가 들고 있는
변환표(m_conversion)에 들어 있다. 그래서 요리와 금속이 "제작법 없음"
으로 나왔다.

설비마다 필드 이름이 조금씩 다르다.
  CookingStation  m_conversion[].m_from -> m_to, m_cookTime
  Smelter         m_conversion[].m_from -> m_to
  Fermenter       m_conversion[].m_from -> m_to, m_producedItems
"""
import UnityPy, json, io, sys

SP = sys.argv[1]
env = UnityPy.load(SP + "/bundles/Bundles/c4210710")

go_name = {}
for o in env.objects:
    if o.type.name == 'GameObject':
        try:
            go_name[o.path_id] = o.read().m_Name
        except Exception:
            pass
print('GameObject', len(go_name), flush=True)

# ItemDrop 의 path_id -> prefab 이름. 변환표가 가리키는 것이 ItemDrop 이다.
drop_path = {}
convs = []
mbs = [o for o in env.objects if o.type.name == 'MonoBehaviour']
for n, o in enumerate(mbs):
    if n % 5000 == 0:
        print(f'  {n}/{len(mbs)}', flush=True)
    try:
        t = o.read_typetree()
    except Exception:
        continue

    gid = (t.get('m_GameObject') or {}).get('m_PathID')
    name = go_name.get(gid)

    if 'm_itemData' in t:
        if name:
            drop_path[o.path_id] = name
        continue

    rows = t.get('m_conversion')
    if not rows or not isinstance(rows, list):
        continue
    # 설비 이름과 변환 목록을 함께 들고 나간다.
    out = []
    for r in rows:
        if not isinstance(r, dict):
            continue
        f = (r.get('m_from') or {}).get('m_PathID')
        to = (r.get('m_to') or {}).get('m_PathID')
        if not f or not to:
            continue
        out.append({
            'from': f, 'to': to,
            'cookTime': r.get('m_cookTime'),
            'produced': r.get('m_producedItems'),
        })
    if out:
        convs.append({'station': name, 'rows': out})

print(f'변환표를 가진 설비 {len(convs)} | ItemDrop {len(drop_path)}', flush=True)
for c in convs[:12]:
    print(f"  {c['station']}: {len(c['rows'])}줄", flush=True)

json.dump({'convs': convs, 'dropPath': drop_path},
          io.open(SP + '/conversions.json', 'w', encoding='utf-8'), ensure_ascii=False)
print('저장 완료', flush=True)
