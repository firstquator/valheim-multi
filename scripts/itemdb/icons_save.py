# 2단계(재개형). 이미 저장한 것은 건너뛰고, 한 번에 정해진 개수만 처리한다.
# 스프라이트 디코딩이 메모리를 붙들고 있어 한 프로세스로 994개를 끝내지
# 못하고 549개에서 죽었다. 죽어도 파일은 남으므로 다시 부르면 이어진다.
import UnityPy, json, io, os, sys, gc
SP = sys.argv[1]; OUT = sys.argv[2]; LIMIT = int(sys.argv[3])
os.makedirs(OUT, exist_ok=True)
ref = json.load(io.open(SP + '/icon_refs.json', encoding='utf-8'))
todo = [(k,v) for k,v in ref.items() if not os.path.exists(os.path.join(OUT, k + '.webp'))]
print(f'남은 것 {len(todo)} / 전체 {len(ref)}', flush=True)
if not todo:
    print('ALLDONE', flush=True); raise SystemExit
env = UnityPy.load(SP + "/bundles/Bundles/6a33a62")
sprites = {o.path_id: o for o in env.objects if o.type.name == 'Sprite'}
done = 0; miss = []
for name, r in todo[:LIMIT]:
    o = sprites.get(r['pathId'])
    if o is None: miss.append(name); continue
    try:
        img = o.read().image
        img.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)
        img.close()
        done += 1
    except Exception as e:
        miss.append(f'{name}:{str(e)[:40]}')
    if done % 50 == 0: gc.collect()
print(f'이번에 {done}개 저장, 실패 {len(miss)}', flush=True)
if miss: print('실패 예:', miss[:5], flush=True)
