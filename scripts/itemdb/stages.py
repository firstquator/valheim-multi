# -*- coding: utf-8 -*-
"""아이템이 게임 진행의 어느 지점부터 손에 들어오는지 정한다.

왜 필요한가.
친구가 도감을 볼 때 가장 먼저 궁금한 것은 "이걸 지금 만들 수 있나" 이다.
게임 데이터에는 레시피와 재료만 있고 "언제부터" 는 없다. 그래서 기본
재료마다 어느 바이옴 것인지 적어 두고, 제작품은 재료를 따라 올라가며
계산한다.

단계는 보스 순서다. 발헤임의 진행이 그렇게 묶여 있다.
"""

import re

# 단계 정의. 숫자가 클수록 뒤에 간다.
STAGES = [
    (0, "meadows",     "초원",       "시작 지점"),
    (1, "blackforest", "검은 숲",     "에이크쉬르 이후"),
    (2, "swamp",       "늪",         "장로 이후"),
    (3, "mountain",    "산",         "보네마스 이후"),
    (4, "plains",      "평원",       "모더 이후"),
    (5, "mistlands",   "안개 땅",     "약글루스 이후"),
    (6, "ashlands",    "잿빛 황야",   "여왕 이후"),
    (7, "deepnorth",   "딥 노스",     "파더 이후"),
]

# 제작대가 열리는 단계. 재료가 이르더라도 제작대가 없으면 못 만든다.
STATION_STAGE = {
    "piece_workbench": 0,
    "piece_cauldron": 0,
    "piece_preptable": 0,
    "piece_MeadCauldron": 0,
    "piece_stonecutter": 1,   # 망치와 돌, 검은 숲의 구리 곡괭이가 있어야 돌을 캔다
    "forge": 1,               # 구리가 나와야 세운다
    "piece_artisanstation": 3,  # 모더의 용의 눈물이 필요하다
    "blackforge": 5,
    "piece_magetable": 5,
}

# 굽고 녹이고 발효시키는 설비가 열리는 단계.
# Recipe 가 아니라 설비의 변환표를 쓰는 것들이라 STATION_STAGE 와 따로 둔다.
CONVERTER_STAGE = {
    "piece_cookingstation": 0,       # 나무 꼬치. 시작하자마자 만든다
    "charcoal_kiln": 1,              # 숯가마, 돌과 구리
    "smelter": 1,                    # 용광로
    "fermenter": 1,                  # 발효통, 청동이 필요하다
    "piece_cookingstation_iron": 2,  # 철 화덕
    "piece_oven": 4,                 # 돌 화덕, 철과 아마
    "windmill": 4,                   # 풍차, 보리를 빻는다
    "piece_spinningwheel": 4,        # 물레, 아마를 잣는다
    "blastfurnace": 5,               # 용광로 상위, 안개 땅
    "eitrrefinery": 5,               # 에이트르 정제소
    "piece_FrostFoundry": 7,         # 서리 주조소, 딥 노스
}

# 기본 재료(제작할 수 없고 주워야 하는 것)의 단계.
# 이름을 하나씩 적는다. 규칙으로 뭉뚱그리면 예외가 조용히 틀린다.
BASE_STAGE = {
    # 초원
    "Wood": 0, "Stone": 0, "StoneRock": 0, "Flint": 0, "Resin": 0,
    "LeatherScraps": 0, "Leatherstraps": 0, "DeerHide": 0, "DeerMeat": 0,
    "RawMeat": 0, "Feathers": 0, "BoneFragments": 0, "NeckTail": 0,
    "Dandelion": 0, "Acorn": 0, "BeechSeeds": 0, "BirchSeeds": 0,
    "FirCone": 0, "PineCone": 0, "HardAntler": 0, "QueenBee": 0,
    "Coins": 0, "Amber": 0, "AmberPearl": 0, "Ruby": 0, "SilverNecklace": 0,
    "RoundLog": 0, "Chitin": 0, "Hook": 0, "CandleWick": 0,
    "ChickenMeat": 0, "HareMeat": 0, "Egg": 0,
    "AxeHead1": 0, "AxeHead2": 0,

    # 검은 숲
    "Copper": 1, "CopperOre": 1, "CopperScrap": 1, "Tin": 1, "TinOre": 1,
    "Coal": 1, "GreydwarfEye": 1, "AncientSeed": 1, "SurtlingCore": 1,
    "TrollHide": 1, "FineWood": 1, "CarrotSeeds": 1, "Thistle": 1,
    "BronzeScrap": 1, "Crystal": 1, "CharcoalResin": 1, "Sap": 1,

    # 늪
    "Iron": 2, "IronOre": 2, "IronScrap": 2, "Ironpit": 2, "ElderBark": 2,
    "WitheredBone": 2, "Guck": 2, "Entrails": 2, "Ooze": 2, "OozeMork": 2,
    "Bloodbag": 2, "Chain": 2, "Root": 2, "BlobVial": 2, "TurnipSeeds": 2,
    "Ectoplasm": 2,

    # 산
    "Silver": 3, "SilverOre": 3, "Obsidian": 3, "WolfPelt": 3, "WolfFang": 3,
    "FreezeGland": 3, "DragonEgg": 3, "DragonTear": 3, "Ice": 3,
    "OnionSeeds": 3, "JotunPuffs": 3, "MoleClaws": 3, "PowderedDragonEgg": 3,
    "CrownJewel": 3,

    # 평원
    "BlackMetal": 4, "BlackMetalScrap": 4, "Flax": 4, "Barley": 4,
    "LoxPelt": 4, "LoxMeat": 4, "Needle": 4, "Tar": 4, "LinenThread": 4,
    "GiantBloodSack": 4,

    # 안개 땅
    "BlackMarble": 5, "Carapace": 5, "Eitr": 5, "YggdrasilWood": 5,
    "Softtissue": 5, "Wisp": 5, "BlackCore": 5, "Mandible": 5, "Bilebag": 5,
    "RoyalJelly": 5, "MagecapSeeds": 5, "DvergrNeedle": 5,
    "DvergrKeyFragment": 5, "JuteRed": 5, "Gold": 5, "GoldOre": 5,
    "GemstoneBlue": 5, "GemstoneGreen": 5, "GemstoneRed": 5,
    "AncientCoin": 5, "SerpentScale": 5, "SerpentMeat": 5,
    "AncientGemstoneBlack": 5, "AncientGemstoneGreen": 5,
    "AncientGemstoneOrange": 5, "AncientGemstonePurple": 5,

    # 잿빛 황야
    "Flametal": 6, "FlametalNew": 6, "FlametalOre": 6, "FlametalOreNew": 6,
    "AskHide": 6, "AskBladder": 6, "CharredBone": 6, "Charredskull": 6,
    "CharredCogwheel": 6, "Blackwood": 6, "MoltenCore": 6, "Grausten": 6,
    "ProustitePowder": 6, "SulfurStone": 6, "PungentPebbles": 6,
    "AsksvinMeat": 6, "AsksvinCarrionNeck": 6, "AsksvinCarrionPelvic": 6,
    "AsksvinCarrionRibcage": 6, "AsksvinCarrionSkull": 6,
    "MorgenHeart": 6, "MorgenSinew": 6, "CelestialFeather": 6,
    "FaderDrop": 6, "FaderEmber": 6, "BellFragment": 6, "MemorialCoal": 6,
    "VolturePelt": 6, "VoltureEgg": 6, "BonemawSerpentScale": 6,
    "BonemawSerpentTooth": 6, "BoneMawSerpentMeat": 6,
    "DyrnwynBladeFragment": 6, "DyrnwynHiltFragment": 6, "DyrnwynTipFragment": 6,
    "Pot_Shard_Green": 6, "OrbFrostFire": 6, "OrbThunderBlood": 6,

    # 딥 노스
    "BjornHide": 7, "BjornMeat": 7, "BjornPaw": 7,
    "MooseHide": 7, "MooseMeat": 7, "MooseSinew": 7,
    "SealHide": 7, "SealBlubber": 7, "Frostwood": 7, "FirConeFrost": 7,
    "FrostCore": 7, "FrozenFuel": 7, "FrozenKingDrop": 7,
    "ElakingHairBundle": 7, "BarkaBranch": 7, "NornThread": 7,
    "JuteBlue": 7, "CuredSquirrelHamstring": 7, "QueenDrop": 7,
    "FragrantBundle": 7, "OatSeeds": 7, "PoteitrSeeds": 7, "KaleSeeds": 7,
}

# 이름 규칙으로 처리해도 안전한 것들. 위 표에 없을 때만 본다.
PATTERN_STAGE = [
    ("Mold", 6),        # 잿빛 황야의 주물 틀
    ("Asksvin", 6),
    ("Charred", 6),
    ("Fader", 6),
    ("Spice", 5),       # 향신료는 바이옴별이지만 요리 자체가 후반이다
    ("Trophy", None),   # 전리품은 잡은 몬스터를 따라가므로 여기서 정하지 않는다
]



# 전리품은 잡은 몬스터가 사는 곳을 따른다. Trophy 접두사를 떼고 여기서 찾는다.
MONSTER_STAGE = {
    # 초원
    "Neck": 0, "Boar": 0, "Deer": 0, "Eikthyr": 0, "Greyling": 0,
    "Hare": 0, "Chicken": 0, "Seagal": 0,
    # 검은 숲
    "Greydwarf": 1, "GreydwarfBrute": 1, "GreydwarfShaman": 1,
    "Skeleton": 1, "SkeletonPoison": 1, "TheElder": 1, "Troll": 1,
    "ForestTroll": 1, "Ghost": 1,
    # 늪
    "Blob": 2, "Draugr": 2, "DraugrElite": 2, "DraugrFem": 2, "Leech": 2,
    "Surtling": 2, "Wraith": 2, "Bonemass": 2, "Growth": 2, "Abomination": 2,
    # 산
    "Wolf": 3, "Hatchling": 3, "StoneGolem": 3, "DragonQueen": 3,
    "Ulv": 3, "Fenring": 3, "Cultist": 3, "Mole": 3, "Bat": 3,
    "Fenring_Cultist": 3, "Cultist_Hildir": 3, "Fenring_Cultist_Hildir": 3,
    # 평원
    "Deathsquito": 4, "Goblin": 4, "GoblinBrute": 4, "GoblinShaman": 4,
    "GoblinKing": 4, "Lox": 4, "BlobTar": 4, "Serpent": 4,
    "GoblinBruteBros": 4, "GoblinBruteBrosShaman": 4,
    # 안개 땅
    "Seeker": 5, "SeekerBrute": 5, "SeekerQueen": 5, "Gjall": 5,
    "Dvergr": 5, "Tick": 5, "DvergerAshlands": 5,
    # 잿빛 황야
    "Volture": 6, "Asksvin": 6, "Morgen": 6, "Charredmelee": 6,
    "Charredarcher": 6, "Charredmage": 6, "CharredTwitcher": 6,
    "Fader": 6, "BonemawSerpent": 6, "Blob_Lava": 6, "FallenValkyrie": 6,
    "Bonemaw": 6, "Lavablob": 6,
    # 딥 노스
    "Bjorn": 7, "UndeadBjorn": 7, "Seal": 7, "Moose": 7, "Elaking": 7,
    "JotunWitch": 7, "FrozenKing": 7, "Norn": 7, "Squirrel": 7,
    "Barka": 7, "IceGolem": 7,
}

# 위 표에 없고 레시피도 없는데 자주 보이는 채집물.
BASE_STAGE.update({
    "Honey": 0, "Turnip": 2, "Oat": 7, "Vineberry": 5, "VineberrySeeds": 5,
    "VineGreenSeeds": 5, "Fiddleheadfern": 5, "WrithanRoots": 6,
    "Thunderstone": 6, "Voidplasm": 6, "YmirRemains": 6, "ScaleHide": 6,
    "WolfMeat": 3, "WolfClaw": 3, "WolfHairBundle": 3, "BugMeat": 5,
    "VoltureMeat": 6, "FreshSeaweed": 0, "FishAnglerRaw": 5,
    "UndeadBjornRibcage": 7, "MushroomBzerker": 5, "MushroomJotunPuffs": 3,
    "MushroomMagecap": 5, "MushroomYellow": 2, "MushroomBlue": 3,
    "Mushroom": 0, "Raspberry": 0, "Blueberries": 1, "Cloudberry": 4,
    "Carrot": 1, "Onion": 3, "Barley": 4, "Flax": 4, "Thistle": 1,
    "Dandelion": 0, "Egg": 0, "BoarJerky": 0,
})

# 물고기는 잡히는 물이 바이옴을 가른다. 번호만으로는 알 수 없어 표로 둔다.
BASE_STAGE.update({
    "Fish1": 0, "Fish2": 0, "Fish3": 1, "Fish4": 3, "Fish4_cave": 3,
    "Fish5": 2, "Fish6": 4, "Fish7": 4, "Fish8": 5, "Fish9": 5,
    "Fish10": 6, "Fish11": 6, "Fish12": 7,
})

# 장비 강화에 쓰는 우상은 이름에 티어 번호가 박혀 있다.
# Upgrader0Armor 가 "나무 보호 우상", Upgrader7Weapon 이 "혈금 전투 우상"
# 이라 번호가 그대로 진행 단계와 맞는다.
_UPGRADER = re.compile(r"^Upgrader(\d)(Armor|Weapon)$")



def guess_from_name(prefab):
    """이름 안에 든 재료 이름으로 단계를 짐작한다.

    조리한 음식은 레시피가 Recipe 가 아니라 화덕의 변환표에 들어 있어
    여기까지 오지 않는다. 그런데 이름이 대개 재료를 그대로 담고 있다.
    CookedLoxMeat 는 LoxMeat 를, SerpentMeatCooked 는 SerpentMeat 를
    품고 있다. 그것을 단서로 쓴다.

    짐작이므로 정확한 경로(레시피, 표)가 모두 실패했을 때만 쓴다.
    가장 긴 재료 이름부터 맞춰 봐야 Meat 가 LoxMeat 를 가로채지 않는다.
    """
    low = prefab.lower()
    best = None
    for name, st in _BY_LENGTH:
        if len(name) < 4:
            continue
        if name.lower() in low:
            best = st
            break
    return best


# 긴 이름부터 본다. "Meat" 가 "LoxMeat" 보다 먼저 맞으면 엉뚱한 답이 나온다.
_BY_LENGTH = sorted(BASE_STAGE.items(), key=lambda kv: -len(kv[0]))

def base_stage(prefab):
    """기본 재료의 단계. 모르면 None."""
    if prefab in BASE_STAGE:
        return BASE_STAGE[prefab]
    if prefab.startswith("Trophy"):
        return MONSTER_STAGE.get(prefab[6:])
    m = _UPGRADER.match(prefab)
    if m:
        n = int(m.group(1))
        return n if n <= 7 else None
    # 이름 조각 규칙. Trophy 와 Upgrader 를 끼워 넣다가 이 줄을 지운 적이
    # 있는데, 그때 Mold 계열 수십 개가 조용히 미정으로 돌아갔다.
    for frag, st in PATTERN_STAGE:
        if st is not None and frag.lower() in prefab.lower():
            return st
    return None


def fallback_stage(prefab):
    """정확한 경로가 다 실패했을 때 쓰는 짐작."""
    return guess_from_name(prefab)
    for frag, st in PATTERN_STAGE:
        if st is not None and frag.lower() in prefab.lower():
            return st
    return None
