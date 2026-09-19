# 게임 번들에서 아이템 원본 데이터를 뽑는다.
#   ItemDrop  아이템 스탯과 로컬라이제이션 키
#   Recipe    무엇으로 어디서 만드는가 (획득 경로의 절반)
import UnityPy, json, io, os, sys

SP = sys.argv[1]
env = UnityPy.load(SP + "/bundles/Bundles/c4210710")

# MonoBehaviour 는 자기 GameObject 를 PPtr 로 가리킨다. prefab 이름을
# 알아야 아이템 목록과 이어붙일 수 있으므로 path_id 로 이름을 찾는다.
go_name = {}
for o in env.objects:
    if o.type.name == 'GameObject':
        try: go_name[o.path_id] = o.read().m_Name
        except Exception: pass
print('GameObject', len(go_name), flush=True)

items, recipes = {}, []
mbs = [o for o in env.objects if o.type.name == 'MonoBehaviour']
for n, o in enumerate(mbs):
    if n % 3000 == 0: print(f'  {n}/{len(mbs)}', flush=True)
    try: t = o.read_typetree()
    except Exception: continue

    if 'm_itemData' in t:
        gid = (t.get('m_GameObject') or {}).get('m_PathID')
        name = go_name.get(gid)
        if not name: continue
        sh = t['m_itemData']['m_shared']
        items[name] = {
            'nameKey': sh.get('m_name',''),
            'descKey': sh.get('m_description',''),
            'itemType': sh.get('m_itemType'),
            'weight': sh.get('m_weight'),
            'stack': sh.get('m_maxStackSize'),
            'maxQuality': sh.get('m_maxQuality'),
            'durability': sh.get('m_maxDurability'),
            'armor': sh.get('m_armor'),
            'armorPerLevel': sh.get('m_armorPerLevel'),
            'food': sh.get('m_food'),
            'foodStamina': sh.get('m_foodStamina'),
            'foodBurnTime': sh.get('m_foodBurnTime'),
            'foodRegen': sh.get('m_foodRegen'),
            'eitr': sh.get('m_foodEitr'),
            'damages': sh.get('m_damages'),
            'damagesPerLevel': sh.get('m_damagesPerLevel'),
            'blockPower': sh.get('m_blockPower'),
            'teleportable': sh.get('m_teleportable'),
            'value': sh.get('m_value'),
            'icons': len(sh.get('m_icons') or []),
        }
    elif 'm_resources' in t and 'm_item' in t:
        recipes.append({
            'itemPath': (t.get('m_item') or {}).get('m_PathID'),
            'amount': t.get('m_amount'),
            'stationPath': (t.get('m_craftingStation') or {}).get('m_PathID'),
            'minLevel': t.get('m_minStationLevel'),
            'resources': [
                {'path': (r.get('m_resItem') or {}).get('m_PathID'),
                 'amount': r.get('m_amount'), 'perLevel': r.get('m_amountPerLevel')}
                for r in (t.get('m_resources') or [])
            ],
        })

print('ItemDrop', len(items), '| Recipe', len(recipes), flush=True)
withicon = sum(1 for v in items.values() if v['icons'])
print('아이콘 참조가 남아 있는 아이템', withicon, flush=True)

# 레시피의 PPtr 을 prefab 이름으로 바꾼다. ItemDrop 의 path_id 가 필요하다.
drop_path = {}
for o in env.objects:
    if o.type.name != 'MonoBehaviour': continue
    try: t = o.read_typetree()
    except Exception: continue
    if 'm_itemData' not in t: continue
    gid = (t.get('m_GameObject') or {}).get('m_PathID')
    if go_name.get(gid): drop_path[o.path_id] = go_name[gid]

json.dump({'items': items, 'recipes': recipes, 'dropPath': drop_path},
          io.open(SP + '/game_items.json','w',encoding='utf-8'), ensure_ascii=False)
print('저장 완료', flush=True)
