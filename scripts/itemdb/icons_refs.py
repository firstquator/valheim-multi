# 1단계: 큰 prefab 번들에서 "prefab 이름 -> 아이콘 PathID" 만 뽑는다.
# 두 번들을 한꺼번에 올렸더니 메모리가 터져 21개에서 죽었다. 큰 쪽에서는
# 참조 번호만 들고 나오고, 실제 이미지는 작은 번들에서 따로 꺼낸다.
import UnityPy, json, io, sys, gc
SP = sys.argv[1]
env = UnityPy.load(SP + "/bundles/Bundles/c4210710")
go_name = {}
for o in env.objects:
    if o.type.name == 'GameObject':
        try: go_name[o.path_id] = o.read().m_Name
        except Exception: pass
print('GameObject', len(go_name), flush=True)

ref = {}
mbs = [o for o in env.objects if o.type.name == 'MonoBehaviour']
for n, o in enumerate(mbs):
    if n % 5000 == 0: print(f'  {n}/{len(mbs)}', flush=True)
    try: t = o.read_typetree()
    except Exception: continue
    if 'm_itemData' not in t: continue
    gid = (t.get('m_GameObject') or {}).get('m_PathID')
    name = go_name.get(gid)
    if not name: continue
    ic = t['m_itemData']['m_shared'].get('m_icons') or []
    if ic:
        ref[name] = {'fileId': ic[0].get('m_FileID'), 'pathId': ic[0].get('m_PathID')}
    del t
print('아이콘 참조', len(ref), flush=True)
json.dump(ref, io.open(SP + '/icon_refs.json','w',encoding='utf-8'))
print('저장 완료', flush=True)
