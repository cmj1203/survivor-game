// =====================================================================
// 15-1. 다회차: 판이 끝나도 남는 것들 (브라우저 저장소 localStorage 에 저장)
//   - meta     : 금화, 상점 강화, 끝낸 퀘스트, 고른 캐릭터·난이도, 누적 기록  (키: dungeon-survivor-meta)
//   - 이어 하기 : 하던 판의 플레이어·시간 정보 (키: dungeon-survivor-run). 몬스터·탄환은 저장하지 않음
//   ※ 아이폰 사파리는 7일 동안 안 들어오면 저장을 지울 수 있어서 '기록·저장'에 내보내기·불러오기가 있음
// =====================================================================
const SAVE_KEY = "dungeon-survivor-meta";
const RUN_KEY = "dungeon-survivor-run";
const SAVE_VERSION = 1;
const RUN_SAVE_INTERVAL = 15;      // 하던 판 저장 간격 (초)

// --- 캐릭터: 규칙이 하나씩 다름. unlock = 해금해 주는 퀘스트 id (없으면 처음부터), price = 해금 뒤 캐릭터 창에서 사는 값 (금화) ---
const CHARACTERS = {
  knight:    { name: "견습 마법사", sprite: "hero_mage",      weapon: "wand",   hp: 1.15, speed: 1,    dmg: 1.1, rule: "체력 +15%, 공격력 +10%. 자동 조준 마법봉으로 안정적으로 시작" },
  hunter:    { name: "사냥꾼", sprite: "hero_hunter",    weapon: "bullet", hp: 0.85, speed: 1.2,  choices: 1, rule: "빠르고 레벨업 카드가 1장 더. 대신 체력 -15%, 단검으로 시작", unlock: "q_time10", price: 300 },
  berserker: { name: "광전사", sprite: "hero_berserker", weapon: "sword",  hp: 1.2,  speed: 0.95, berserk: true, rule: "체력이 절반 이하면 공격력 +60%. 체력 +20%, 검으로 시작", unlock: "q_evo3", price: 400 },
  saint:     { name: "성녀",   sprite: "hero_saint",     weapon: "aura",   hp: 0.95, speed: 1,    dmg: 1.25, healEvery: 8, heal: 2, rule: "8마리 처치할 때마다 체력 2 회복. 공격력 +25%, 대신 체력 -5%, 번개 오라로 시작", unlock: "q_diff1", price: 600 },
  // pick: true = 판을 시작할 때 무기 고르기 창이 떠서, 이미 연 무기 중 하나를 골라 시작함 (weapon 은 창이 뜨기 전 잠깐 쓰는 기본값)
  armorer:   { name: "무기상", sprite: "hero_armorer",   weapon: "wand",   hp: 1,    speed: 1,    pick: true, candyBonus: 0.15, rule: "시작 무기를 직접 고름", unlock: "q_armory", price: 800 },   // candyBonus: 레벨업 때 무기 상자 카드가 안 뽑혔으면 이 확률로 마지막 카드를 무기 상자로 바꿈
};

// --- 난이도: 앞 단계를 클리어하면 다음 단계가 열림. 숫자만 올리지 않고 정예 빈도·보스도 바뀜 ---
const DIFFS = [
  //   item: 바닥 아이템(회복·자석·빙결·전멸)이 떨어지는 양의 배수. 난이도가 높을수록 덜 나옴
  //   theme: 배경·적 그림 테마 (null = 기본 던전)   place: 장소 이름   tier: 적 특성 단계 (위 '난이도 테마의 적 특성' 참고)
  { name: "보통",        hp: 1,    dmg: 1,    speed: 1,    elite: 1,   boss: 1,   gold: 1,   tier: 0, theme: null,   place: "던전",          item: 1,    desc: "기본" },
  // 정예를 늘리면 상자도 늘어 오히려 쉬워졌으므로, 간격은 같게 둠.
  // 능력치 배수는 특성을 넣기 전과 같은 값 (한때 낮췄다가 '너무 쉽다'는 의견으로 되돌림)
  { name: "어려움",      hp: 1.15, dmg: 1.05, speed: 1.02, elite: 1, boss: 1.1,  gold: 1.3, tier: 1, theme: "ice",  place: "얼음 동굴",     item: 0.75, desc: "적 특성 등장 · 적 체력 +15%, 피해 +5%, 속도 +2%, 보스 체력 +10% · 아이템 -25%" },
  { name: "매우 어려움", hp: 1.35, dmg: 1.15, speed: 1.08, elite: 1, boss: 1.25, gold: 1.6, tier: 2, theme: "lava", place: "용암 굴",       item: 0.55, desc: "적 특성 강화 · 적 체력 +35%, 피해 +15%, 속도 +8%, 보스 체력 +25% · 아이템 -45%" },
  { name: "지옥",        hp: 1.6,  dmg: 1.3,  speed: 1.12, elite: 1, boss: 1.5,  gold: 2,   tier: 3, theme: "dark", place: "저주받은 어둠", item: 0.4,  desc: "적 특성 최대 · 적 체력 +60%, 피해 +30%, 속도 +12%, 보스 체력 +50% · 아이템 -60%" },
];

// --- 상점 (영구 강화): 단계 상한 있음, 언제든 공짜 환불. 값 = base × (지금 단계 + 1) ---
const SKIP_HEAL = 30;                    // 상점 '건너뛰기': 레벨업 카드를 넘기면 회복하는 체력
const SHOP_LUCK = 0.10;                  // 상점 '행운': 단계마다 행운 +10%
const SHOP_CURSE_GOLD = 0.05;            // 상점 '저주': 단계마다 금화 +5%
const SHOP = [
  //   한 번 클리어할 때쯤 전부 사 버려서, 단계를 잘게 쪼개 늘림. 다 샀을 때의 세기는 예전과 같음 (전체 값 1470 → 4950, 다시 뽑기·선택의 폭까지 6000)
  //   순서: 첫 단계 값이 싼 것부터 (값이 같으면 먼저 만든 것부터). 값이 없는 저주는 맨 아래
  { key: "might",  name: "공격력",    icon: "passive_might",  max: 5, base: 60,  per: 0.05 },
  { key: "maxhp",  name: "최대 체력", icon: "passive_maxhp",  max: 4, base: 60,  per: 0.05 },
  { key: "move",   name: "이동 속도", icon: "passive_move",   max: 4, base: 80,  per: 0.03 },
  { key: "magnet", name: "자석 범위", icon: "passive_magnet", max: 5, base: 80,  per: 0.10 },
  { key: "growth", name: "경험치",    icon: "passive_growth", max: 4, base: 100, per: 0.04 },
  { key: "luck",    name: "행운",      icon: "passive_luck",    max: 2, base: 120, per: SHOP_LUCK },   // 아이템이 떨어질 확률과 상자에서 여러 개가 나올 확률
  { key: "greed",  name: "금화 획득", icon: "chest",          max: 2, base: 150, per: 0.10 },
  // 퍼센트가 아닌 강화: note(단계) 가 상점에 보일 설명을 돌려줌
  { key: "reroll",  name: "다시 뽑기", icon: "shop_reroll",     max: 2, base: 150, note: (lv) => `${lv ? `레벨업 한 번에 ${lv}번까지 카드를 다시 뽑음` : "레벨업 카드를 다시 뽑을 수 있게 됨"} · 단계마다 +1번` },
  { key: "armor",   name: "방어력",      icon: "passive_armor",   max: 2, base: 150, note: (lv) => `받는 피해 -${lv} · 단계마다 -1 (최소 1은 받음)` },
  { key: "choices", name: "선택의 폭", icon: "passive_choices", max: 2, base: 200, note: (lv) => `레벨업 카드 ${3 + lv}장 · 단계마다 +1장` },
  { key: "skip",    name: "건너뛰기",  icon: "shop_skip",       max: 1, base: 250, note: (lv) => `${lv ? "레벨업 창에서 카드를 안 고르고 넘길 수 있음" : "레벨업 카드를 안 고르고 넘길 수 있게 됨"} · 넘기면 체력 +${SKIP_HEAL}` },
  { key: "revival", name: "부활",      icon: "passive_revival", max: 1, base: 500, note: (lv) => (lv ? "한 판에 한 번, 죽으면 체력을 전부 회복하고 되살아남" : "죽어도 한 판에 한 번 되살아나게 됨") },
  // 저주: 스스로 게임을 어렵게 만드는 대신 보상을 더 받음. 값이 없고(free), 올렸다 내렸다 할 수 있음. '맨몸' 퀘스트 조건에서는 빼 줌
  { key: "curse",   name: "저주",      icon: "passive_curse",   max: 3, base: 0, free: true,
    note: (lv) => (lv ? `적 생성 +${lv * 10}%, 체력 +${lv * 6}%, 속도 +${lv * 3}% · 대신 금화 +${Math.round(lv * SHOP_CURSE_GOLD * 100)}%, 경험치 +${lv * 8}%` : "꺼짐 · 올리면 적이 더 많고 세지는 대신 금화·경험치를 더 받음") },
  // 1.5배속: '매우 어려움'을 클리어하면 상점에 열리고, 사면 게임 화면 왼쪽 위(소리 단추 옆)에 켜고 끄는 단추가 생김
  //   능력치 강화가 아니라서(utility) '맨몸' 퀘스트 셈에서 뺌. key 가 예전 무료 '2배속'(speed)과 달라서 예전 저장의 그것은 이어지지 않음
  { key: "speed15", name: "1.5배속",   icon: "speed_off",       max: 1, base: 500, utility: true,
    note: (lv) => (lv ? "게임 화면 왼쪽 위 단추로 켜고 끔 · 게임 진행 속도 1.5배" : "게임 진행 속도 1.5배 · 사면 게임 화면 왼쪽 위에 단추가 생김") },
];
// 1.5배속: 게임 전체(이동·공격·적·게임 시계)가 1.5배로 빨리 감 → 클리어까지 걸리는 실제 시간이 2/3.
//   상점에서 산 뒤, 게임 화면 왼쪽 위 단추로 켜고 끔 (meta.fast 에 저장)
const GAME_SPEED_FAST = 1.5;             // 배속을 켰을 때 한 프레임에 게임을 몇 배 진행할지
const SPEED_UNLOCK_DIFF = 2;             // 이 난이도(2 = 매우 어려움) 이상을 클리어하면 상점에 1.5배속이 열림
function isSpeedUnlocked() { return meta.stats.maxClearDiff >= SPEED_UNLOCK_DIFF; }
function hasFast() { return upLevel("speed15") > 0; }   // 상점에서 1.5배속을 샀는지
function gameSpeed() { return hasFast() && meta.fast ? GAME_SPEED_FAST : 1; }

// --- 퀘스트: 배우는 것(진화·상자)과 쌓이는 것(누적 처치)을 섞음. 값이 goal 이상이 되면 끝 ---
//   보상: weapon(무기 해금) / char(캐릭터 해금) / gold(금화)
const QUESTS = [
  { id: "q_time1",    name: "첫 걸음",       desc: "2분 버티기",                                stat: "time",   goal: 120,   gold: 30 },
  { id: "q_level10",  name: "성장",          desc: "한 판에 레벨 15 도달",                      stat: "level",  goal: 15,   weapon: "spear" },
  { id: "q_level25",  name: "숙련",          desc: "한 판에 레벨 25 도달",                      stat: "level",  goal: 25,   weapon: "staff" },
  { id: "q_time5",    name: "7분 버티기",    desc: "한 판에 7분 버티기",                        stat: "time",   goal: 420,  weapon: "lightning" },
  { id: "q_chest3",   name: "보물 사냥",     desc: "보물 상자 5개 열기 (누적)",                 stat: "chests", goal: 5,    weapon: "cherry" },
  { id: "q_kill500",  name: "몬스터 사냥꾼", desc: "1000마리 처치 (누적)",                       stat: "kills",  goal: 1000,  weapon: "hammer" },
  { id: "q_time10",   name: "12분 버티기",   desc: "한 판에 12분 버티기",                       stat: "time",   goal: 720,  char: "hunter" },
  { id: "q_evo1",     name: "첫 진화",       desc: "무기 2번 진화시키기 (누적, ? 버튼 조합표 참고)", stat: "evos",   goal: 2,    weapon: "shadow" },
  { id: "q_time15",   name: "17분 버티기",   desc: "한 판에 17분 버티기",                       stat: "time",   goal: 1020,  weapon: "pentagram" },
  { id: "q_kill3000", name: "학살자",        desc: "6000마리 처치 (누적)",                      stat: "kills",  goal: 6000, weapon: "larobba" },
  { id: "q_level30",  name: "강자",          desc: "한 판에 레벨 40 도달",                      stat: "level",  goal: 40,   weapon: "flames" },
  { id: "q_evo3",     name: "진화 연구가",   desc: "무기 5번 진화시키기 (누적)",                stat: "evos",   goal: 5,    char: "berserker" },
  { id: "q_clear",    name: "사신 퇴치",     desc: "마지막 보스 잡기 (클리어)",                 stat: "clears", goal: 1,    weapon: "victory" },
  { id: "q_diff1",    name: "더 어둡게",     desc: "'어려움' 난이도 클리어",                    stat: "diff",   goal: 1,    char: "saint" },
  // --- 오래 걸리는 퀘스트 (보상은 금화): 위 13개가 보통 난이도 한 번 클리어에 다 끝나 버려서 추가 ---
  //   한 번 클리어하면 2만 마리쯤 잡으므로 누적 처치는 그보다 훨씬 크게. who = 그 캐릭터로 클리어해야 함
  { id: "q_clear3",    name: "던전 단골",       desc: "5번 클리어 (누적)",              stat: "clears",    goal: 5,      shop: "curse" },
  { id: "q_kill50k",   name: "군단 파괴자",     desc: "10만 마리 처치 (누적)",           stat: "kills",     goal: 100000,  passive: "curse" },
  { id: "q_chest30",   name: "보물 수집가",     desc: "보물 상자 50개 열기 (누적)",     stat: "chests",    goal: 50,     shop: "skip" },
  { id: "q_evo10",     name: "진화 전문가",     desc: "무기 20번 진화시키기 (누적)",    stat: "evos",      goal: 20,     gold: 60 },
  { id: "q_c_hunter",  name: "명사수",          desc: "사냥꾼으로 클리어",              stat: "charclear", goal: 1,      gold: 100, who: "hunter" },
  { id: "q_c_berserk", name: "피의 맹세",       desc: "광전사로 클리어",                stat: "charclear", goal: 1,      gold: 100, who: "berserker" },
  { id: "q_c_saint",   name: "기적",            desc: "성녀로 클리어",                  stat: "charclear", goal: 1,      gold: 100, who: "saint" },
  { id: "q_diff2",     name: "칠흑 속으로",     desc: "'매우 어려움' 난이도 클리어",    stat: "diff",      goal: 2,      gold: 200 },
  { id: "q_kill150k",  name: "재앙",            desc: "30만 마리 처치 (누적)",          stat: "kills",     goal: 300000, gold: 120 },
  { id: "q_chest100",  name: "보물 왕",         desc: "보물 상자 200개 열기 (누적)",    stat: "chests",    goal: 200,    gold: 120 },
  { id: "q_evo30",     name: "진화의 대가",     desc: "무기 60번 진화시키기 (누적)",    stat: "evos",      goal: 60,     gold: 150 },
  { id: "q_diff3",     name: "지옥에서 온 자",  desc: "'지옥' 난이도 클리어",           stat: "diff",      goal: 3,      gold: 300 },
  { id: "q_clear10",   name: "던전의 주인",     desc: "20번 클리어 (누적)",             stat: "clears",    goal: 20,     gold: 250 },
  { id: "q_kill400k",  name: "전설의 사냥꾼",   desc: "80만 마리 처치 (누적)",          stat: "kills",     goal: 800000, gold: 250 },
  // --- 난이도 테마·넓어진 맵에 맞춘 퀘스트 (보상은 금화). d = 그 난이도에서 버틴 시간을 봄 (1 어려움, 2 매우 어려움, 3 지옥) ---
  { id: "q_items50",   name: "줍줍",            desc: "바닥 아이템 100개 줍기 (누적)",           stat: "items",    goal: 100,  shop: "choices" },
  { id: "q_corners",   name: "탐험가",          desc: "한 판에 맵의 네 구석 모두 가 보기",      stat: "corners",  goal: 4,   gold: 80 },
  { id: "q_ice10",     name: "얼음 위의 산책",  desc: "얼음 동굴(어려움)에서 15분 버티기",      stat: "difftime", goal: 900, gold: 80,  d: 1 },
  { id: "q_shell100",  name: "껍질 까기",       desc: "얼음 원소 200마리 깨기 (누적)",           stat: "shells",   goal: 200, gold: 80 },
  { id: "q_sticky",    name: "끈적끈적",        desc: "웬디고의 얼음 장판 60번 밟기 (누적)",    stat: "puddles",  goal: 60,  gold: 60 },
  { id: "q_lava10",    name: "불 위를 걷는 자", desc: "용암 굴(매우 어려움)에서 12분 버티기",   stat: "difftime", goal: 720, gold: 120, d: 2 },
  { id: "q_dark5",     name: "어둠 속 한 걸음", desc: "저주받은 어둠(지옥)에서 7분 버티기",     stat: "difftime", goal: 420, gold: 150, d: 3 },
  { id: "q_dark10",    name: "어둠에 익숙한 눈", desc: "저주받은 어둠(지옥)에서 12분 버티기",   stat: "difftime", goal: 720, gold: 250, d: 3 },
  // --- 어려운 퀘스트: '얼마나 많이'가 아니라 '어떻게' 하느냐를 봄 (보상은 금화). 숫자는 봇 측정에서 클리어한 판의 값보다 높게 잡음 ---
  //   (클리어한 판 기준: 레벨 57~70, 처치 2만 1천, 진화 2~5번, 맞은 횟수 3~13번, 보스는 13~34초 만에 잡힘)
  { id: "q_nohit5",    name: "유령 발걸음",     desc: "한 판에 7분 동안 한 번도 안 맞기",            stat: "nohit",    goal: 420,   gold: 120 },
  { id: "q_lowhp",     name: "아슬아슬",        desc: "체력 30% 이하인 채로 90초 내리 버티기",       stat: "lowhp",    goal: 90,    shop: "revival" },
  { id: "q_elite15",   name: "정예 사냥꾼",     desc: "한 판에 정예 몬스터 20마리 처치",             stat: "runelites", goal: 20,   gold: 150 },
  { id: "q_solo10",    name: "외길",            desc: "무기를 1개만 든 채 15분 버티기",              stat: "solo",     goal: 900,   gold: 200 },
  { id: "q_level70",   name: "한계 돌파",       desc: "한 판에 레벨 80 도달",                        stat: "level",    goal: 80,    gold: 200 },
  { id: "q_runevo5",   name: "진화 폭주",       desc: "한 판에 무기 5번 진화시키기",                 stat: "runevos",  goal: 5,     gold: 200 },
  { id: "q_evodex10",  name: "진화 도감",       desc: "서로 다른 진화 무기 15종 만들어 보기 (누적)", stat: "evodex",   goal: 15,    gold: 200 },
  { id: "q_fastboss",  name: "속전속결",        desc: "마지막 보스를 나타난 지 10초 안에 처치",      stat: "fastboss", goal: 1,     gold: 200 },
  { id: "q_lava15",    name: "용암 수영",       desc: "용암 굴(매우 어려움)에서 18분 버티기",        stat: "difftime", goal: 1080,   gold: 200, d: 2 },
  { id: "q_naked",     name: "맨몸",            desc: "상점 강화를 하나도 안 산 채로 클리어",        stat: "naked",    goal: 1,     gold: 250 },
  { id: "q_runkill25k", name: "한 판 학살",     desc: "한 판에 35,000마리 처치",                     stat: "runkills", goal: 35000, gold: 250 },
  { id: "q_nohit10",   name: "그림자",          desc: "한 판에 12분 동안 한 번도 안 맞기",           stat: "nohit",    goal: 720,   gold: 300 },
  { id: "q_fewhit",    name: "무결점",          desc: "3번 이하로 맞고 클리어",                      stat: "fewhit",   goal: 1,     gold: 300 },
  { id: "q_dark15",    name: "어둠의 주민",     desc: "저주받은 어둠(지옥)에서 18분 버티기",         stat: "difftime", goal: 1080,   gold: 350, d: 3 },
  { id: "q_runevo6",   name: "완전체",          desc: "한 판에 무기 6개를 모두 진화시키기",          stat: "runevos",  goal: 6,     gold: 400 },
  { id: "q_clear25",   name: "살아 있는 전설",  desc: "40번 클리어 (누적)",                          stat: "clears",   goal: 40,    gold: 400 },
  { id: "q_evodex20",  name: "진화 박사",       desc: "진화 무기 20종을 전부 만들어 보기 (누적)",    stat: "evodex",   goal: 20,    gold: 500 },
  { id: "q_hellall",   name: "지옥의 지배자",   desc: "서로 다른 캐릭터 4명으로 지옥 클리어",         stat: "hellall",  goal: 4,     gold: 600 },
];
// 잠긴 무기를 전부 열면 '시작 무기를 고르는' 캐릭터가 열림 (목표 수는 무기 보상 퀘스트 수와 같음)
QUESTS.push({ id: "q_armory", name: "무기고", desc: `잠긴 무기 ${QUESTS.filter((q) => q.weapon).length}종을 모두 열기`, stat: "armory", goal: QUESTS.filter((q) => q.weapon).length, char: "armorer" });
const TIME_STATS = ["time", "difftime", "nohit", "lowhp", "solo"];   // 진행 값을 '몇 분 몇 초'로 보여 줄 퀘스트 종류
const WEAPON_LOCKS = {};                 // 무기 종류 → 해금해 주는 퀘스트 id
for (const q of QUESTS) if (q.weapon) WEAPON_LOCKS[q.weapon] = q.id;
const PASSIVE_LOCKS = {};                // 아이템 종류 → 해금해 주는 퀘스트 id
for (const q of QUESTS) if (q.passive) PASSIVE_LOCKS[q.passive] = q.id;
// 상점 항목 잠금: 보상이 shop 인 퀘스트를 끝내야 그 항목이 상점에 열림 (선택의 폭·건너뛰기·부활·저주)
const SHOP_LOCKS = {};
for (const q of QUESTS) if (q.shop) SHOP_LOCKS[q.shop] = q.id;
// 이미 사 둔 사람은 그대로 쓸 수 있게, 한 단계라도 갖고 있으면 잠그지 않음
function shopLocked(key) {
  if (key === "speed15") return !isSpeedUnlocked() && upLevel(key) === 0;   // 1.5배속은 퀘스트가 아니라 '매우 어려움' 클리어로 열림
  return !!SHOP_LOCKS[key] && !isQuestDone(SHOP_LOCKS[key]) && upLevel(key) === 0;
}

// --- 저장 / 불러오기 ---
function defaultMeta() {
  return { version: SAVE_VERSION, gold: 0, upgrades: {}, quests: [], chars: [], char: "knight", diff: 0, fast: false,   // chars = 금화로 산 캐릭터, fast = 1.5배속 켬
           stats: { runs: 0, clears: 0, kills: 0, chests: 0, evos: 0, bestTime: 0, bestLevel: 0, maxClearDiff: -1,
                    clear_knight: 0, clear_hunter: 0, clear_berserker: 0, clear_saint: 0, clear_armorer: 0,       // clear_○○ = 그 캐릭터로 클리어한 횟수
                    time_d1: 0, time_d2: 0, time_d3: 0,                                         // time_d○ = 그 난이도에서 가장 오래 버틴 시간(초)
                    items: 0, shells: 0, puddles: 0, corners: 0,                                // 주운 아이템, 깬 껍질, 밟은 자국(누적), 한 판에 가 본 구석 수(최고)
                    // 어려운 퀘스트용. best_○○ = 한 판 최고 기록, n_○○ = 해낸 횟수, mask_○○ = 해 본 것들(하나당 비트 하나)
                    best_nohit: 0, best_lowhp: 0, best_solo: 0, best_runkills: 0, best_runevos: 0, best_runelites: 0,
                    n_naked: 0, n_fewhit: 0, n_fastboss: 0, mask_evo: 0, mask_hell: 0 } };
}
// 저장된 값이 이상해도(손으로 고친 파일 등) 게임이 깨지지 않게 하나씩 확인해서 채움
function normalizeMeta(m) {
  const d = defaultMeta();
  if (!m || typeof m !== "object") return d;
  const num = (v, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Math.floor(Number(v))) : min);
  d.gold = num(m.gold);
  for (const s of SHOP) d.upgrades[s.key] = Math.min(s.max, num(m.upgrades?.[s.key]));
  d.quests = Array.isArray(m.quests) ? [...new Set(m.quests.filter((id) => QUESTS.some((q) => q.id === id)))] : [];
  // 산 캐릭터. 구매가 생기기 전 저장(chars 없음)은 이미 해금한 캐릭터를 산 것으로 쳐서, 쓰던 캐릭터가 갑자기 잠기지 않게
  d.chars = Array.isArray(m.chars)
    ? [...new Set(m.chars.filter((k) => CHARACTERS[k]?.price))]
    : Object.keys(CHARACTERS).filter((k) => CHARACTERS[k].price && d.quests.includes(CHARACTERS[k].unlock));
  const st = m.stats || {};
  for (const k in d.stats) d.stats[k] = k === "maxClearDiff" ? Math.min(DIFFS.length - 1, num(st[k], -1)) : num(st[k]);
  if (CHARACTERS[m.char]) d.char = m.char;
  d.diff = Math.min(num(m.diff), DIFFS.length - 1);
  d.fast = m.fast === true;
  return d;
}
let storageOk = true;
function loadMeta() {
  let text = null;
  try { text = localStorage.getItem(SAVE_KEY); } catch { storageOk = false; }
  if (!text) return defaultMeta();
  try { return normalizeMeta(JSON.parse(text)); }
  catch {
    try { localStorage.setItem(`${SAVE_KEY}-broken`, text); } catch {}   // 망가진 저장은 지우지 않고 따로 보관
    return defaultMeta();
  }
}
function saveMeta() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(meta)); storageOk = true; }
  catch { storageOk = false; }     // 사생활 보호 모드 등: 저장이 안 돼도 게임은 계속
}
let meta = loadMeta();
let run = null;                        // 지금 판의 다회차 정보 (캐릭터, 난이도, 상자·진화 수, 새로 끝낸 퀘스트)

// --- 배수들 ---
function upLevel(key) { return meta.upgrades[key] || 0; }
function upMul(key) { const s = SHOP.find((it) => it.key === key); return 1 + (s?.per ? s.per * upLevel(key) : 0); }
function charDef() { return CHARACTERS[run ? run.char : meta.char] || CHARACTERS.knight; }
function diffDef() { return DIFFS[run ? run.diff : meta.diff] || DIFFS[0]; }
function charDamageMul() {
  const c = charDef();
  return (c.dmg || 1) * (c.berserk && player && player.hp <= player.maxHp / 2 ? 1.6 : 1);
}
function isQuestDone(id) { return meta.quests.includes(id); }
function isWeaponLocked(type) { return !!WEAPON_LOCKS[type] && !isQuestDone(WEAPON_LOCKS[type]); }
function isPassiveLocked(key) { return !!PASSIVE_LOCKS[key] && !isQuestDone(PASSIVE_LOCKS[key]); }
function isCharUnlocked(key) { const c = CHARACTERS[key]; return !!c && (!c.unlock || isQuestDone(c.unlock)); }
function isCharOwned(key) { const c = CHARACTERS[key]; return !!c && (!c.price || meta.chars.includes(key)); }   // 해금 + 금화로 사야 고를 수 있음
function isDiffUnlocked(i) { return i <= meta.stats.maxClearDiff + 1; }

// --- 판 시작 (resetGame 이 부름) ---
function startRun() {
  if (!isCharOwned(meta.char)) meta.char = "knight";
  if (!isDiffUnlocked(meta.diff)) meta.diff = 0;
  run = { char: meta.char, diff: meta.diff, chests: 0, evos: 0, items: 0, shells: 0, puddles: 0, corners: 0, newQuests: [], tick: 0, saveTimer: 0, done: false,
          // 어려운 퀘스트용: 맞은 횟수, 안 맞고 버틴 시간(지금/최고), 체력 낮은 채 버틴 시간(지금/최고), 무기 1개로 버틴 시간, 잡은 정예 수, 진화한 종류, 보스가 나온 시각
          hits: 0, noHit: 0, bestNoHit: 0, lowHp: 0, bestLowHp: 0, solo: 0, soloBroken: false, elites: 0, evoMask: 0, bossAt: null,
          naked: SHOP.every((it) => it.free || it.utility || upLevel(it.key) === 0) };   // 상점 강화 없이 시작했는지 (저주처럼 스스로 불리해지는 것은 셈에서 뺌)
  setBackgroundTheme(diffDef().theme);                                           // 난이도 테마: 배경 바꾸기
  if (diffDef().theme) banner = { text: diffDef().place, life: BANNER_TIME };    // 시작할 때 장소 이름을 잠깐 보여 줌
  player.weapons = [{ type: charDef().weapon, level: 1, timer: 0 }];
  recalcStats();
  player.hp = player.maxHp;
  eliteTimer = ELITE_INTERVAL * diffDef().elite;
  clearRun();                          // 새 판을 시작하면 예전 '이어 하기'는 없앰
}

// --- 퀘스트 진행 값. live = 지금 판 포함, cleared = 이번 판을 클리어했는지 ---
function bitCount(bits) { let n = 0; for (let b = bits; b > 0; b = Math.floor(b / 2)) n += b % 2; return n; }   // 켜진 비트 수 (= 해 본 가짓수)
function charBit() { return 1 << Math.max(0, Object.keys(CHARACTERS).indexOf(run.char)); }                        // 지금 캐릭터의 비트
const FASTBOSS_SEC = 10;   // 퀘스트 '속전속결': 보스가 나타난 뒤 이 초 안에 잡아야 함
const FEWHIT_MAX = 3;      // 퀘스트 '무결점': 이 횟수 이하로 맞고 클리어해야 함
function isFastBoss() { return run.bossAt !== null && stats.time - run.bossAt <= FASTBOSS_SEC; }                   // 보스를 FASTBOSS_SEC 초 안에 잡았는지
function cornerCount(bits) { return (bits & 1) + ((bits >> 1) & 1) + ((bits >> 2) & 1) + ((bits >> 3) & 1); }   // 가 본 구석 수 (구석마다 비트 하나)
function questValue(q, live, cleared) {
  const s = meta.stats;
  switch (q.stat) {
    case "time":   return live ? Math.max(s.bestTime, stats.time) : s.bestTime;
    case "level":  return live ? Math.max(s.bestLevel, player.level) : s.bestLevel;
    case "kills":  return s.kills + (live ? stats.kills : 0);
    case "chests": return s.chests + (live ? run.chests : 0);
    case "evos":   return s.evos + (live ? run.evos : 0);
    case "clears": return s.clears + (live && cleared ? 1 : 0);
    case "charclear": return (s[`clear_${q.who}`] || 0) + (live && cleared && run.char === q.who ? 1 : 0);
    case "diff":   return Math.max(s.maxClearDiff, live && cleared ? run.diff : -1);
    case "difftime": return Math.max(s[`time_d${q.d}`] || 0, live && run.diff === q.d ? stats.time : 0);
    case "items":   return s.items + (live ? run.items : 0);
    case "shells":  return s.shells + (live ? run.shells : 0);
    case "puddles": return s.puddles + (live ? run.puddles : 0);
    case "corners": return Math.max(s.corners, live ? cornerCount(run.corners) : 0);
    // --- 어려운 퀘스트 ---
    case "nohit":     return Math.floor(Math.max(s.best_nohit, live ? run.bestNoHit : 0));
    case "lowhp":     return Math.floor(Math.max(s.best_lowhp, live ? run.bestLowHp : 0));
    case "solo":      return Math.floor(Math.max(s.best_solo, live ? run.solo : 0));
    case "runkills":  return Math.max(s.best_runkills, live ? stats.kills : 0);
    case "runevos":   return Math.max(s.best_runevos, live ? run.evos : 0);
    case "runelites": return Math.max(s.best_runelites, live ? run.elites : 0);
    case "evodex":    return bitCount(s.mask_evo | (live ? run.evoMask : 0));
    case "naked":     return s.n_naked + (live && cleared && run.naked ? 1 : 0);
    case "fewhit":    return s.n_fewhit + (live && cleared && run.hits <= FEWHIT_MAX ? 1 : 0);
    case "fastboss":  return s.n_fastboss + (live && cleared && isFastBoss() ? 1 : 0);
    case "armory":    return QUESTS.filter((it) => it.weapon && isQuestDone(it.id)).length;   // 지금까지 연 무기 수
    case "hellall":   return bitCount(s.mask_hell | (live && cleared && run.diff === 3 ? charBit() : 0));
  }
  return 0;
}
const QUEST_GOLD_MUL = 0.5;              // 퀘스트 금화 보상 배수 (금화가 너무 빨리 모여서 전부 절반으로. 표의 gold 는 줄이기 전 값)
function questGold(q) { return Math.round(q.gold * QUEST_GOLD_MUL); }
function rewardText(q) {
  if (q.weapon) return `무기 '${WEAPONS[q.weapon].name}' 해금`;
  if (q.char) return `캐릭터 '${CHARACTERS[q.char].name}' 해금`;
  if (q.shop) return `상점 '${SHOP.find((it) => it.key === q.shop).name}' 열림`;
  if (q.passive) return `아이템 '${PASSIVES[q.passive].name}' 해금`;
  return `금화 ${questGold(q)}`;
}
function checkQuests(cleared) {
  let changed = false;
  for (const q of QUESTS) {
    if (isQuestDone(q.id) || questValue(q, true, cleared) < q.goal) continue;
    meta.quests.push(q.id);
    run.newQuests.push(q.id);
    if (q.gold) meta.gold += questGold(q);
    changed = true;
    floatTexts.push({ x: player.x, y: player.y - 44, text: `퀘스트 완료! ${rewardText(q)}`, color: "#2ecc71", life: 3, maxLife: 3 });
  }
  if (changed) { saveMeta(); playSfx("quest"); }             // 판 중간에 풀린 무기는 다음 레벨업 카드부터 바로 나옴
}

// 매 프레임 (update 가 부름): 1초마다 퀘스트 확인, 15초마다 이어 하기 저장
function metaTick(dt) {
  if (!run) return;
  // 어려운 퀘스트용 시간 재기
  run.noHit += dt; run.bestNoHit = Math.max(run.bestNoHit, run.noHit);                       // 안 맞고 버틴 시간
  run.lowHp = player.hp <= player.maxHp * 0.3 ? run.lowHp + dt : 0;                          // 체력 30% 이하로 버틴 시간 (회복하면 다시 0)
  run.bestLowHp = Math.max(run.bestLowHp, run.lowHp);
  if (!run.soloBroken) { if (player.weapons.length <= 1) run.solo = stats.time; else run.soloBroken = true; }   // 무기 1개로 버틴 시간 (둘째 무기를 들면 끝)
  run.tick += dt;
  if (run.tick >= 1) { run.tick = 0; checkQuests(false); }
  updateRunMusic();
  run.saveTimer += dt;
  if (run.saveTimer >= RUN_SAVE_INTERVAL) { run.saveTimer = 0; saveRun(); }
}

// --- 판 끝 정산 (게임오버·클리어): 금화 + 누적 기록 + 해금 안내 문구를 돌려줌 ---
function finishRun(cleared) {
  if (!run || run.done) return "";
  run.done = true;
  checkQuests(cleared);
  const s = meta.stats;
  const firstRun = s.runs === 0;
  // 금화: 버틴 시간 20초당 1 + 처치 수의 제곱근 × 0.6 + 클리어 40 + 첫 판 40 (너무 빨리 모여서 예전의 절반으로 줄임. 첫 판 보너스만 그대로)
  //   처치 수를 그대로 나누면 후반(2만 마리)에 금화가 폭발해서 상점을 한두 판에 다 사게 됨 → 제곱근으로 완만하게
  //   예: 5분·700마리 ≈ 31, 10분·4000마리 ≈ 68, 20분 클리어·21000마리 ≈ 187 (상점 전체 6000)
  const gold = Math.round((stats.time / 20 + Math.sqrt(stats.kills) * 0.6 + (cleared ? 40 : 0) + (firstRun ? 40 : 0))
                          * diffDef().gold * upMul("greed") * (1 + SHOP_CURSE_GOLD * upLevel("curse")))   // 상점 '저주'를 켠 만큼 금화도 더 받음
               + (run.bonusGold || 0);   // 더 강화할 게 없을 때 고른 '금화 +N' (배율 없이 그대로 더함)
  const prevMaxDiff = s.maxClearDiff;
  s.runs += 1; s.kills += stats.kills; s.chests += run.chests; s.evos += run.evos;
  s.items += run.items; s.shells += run.shells; s.puddles += run.puddles;
  s.corners = Math.max(s.corners, cornerCount(run.corners));
  s.best_nohit = Math.max(s.best_nohit, Math.floor(run.bestNoHit)); s.best_lowhp = Math.max(s.best_lowhp, Math.floor(run.bestLowHp));
  s.best_solo = Math.max(s.best_solo, Math.floor(run.solo)); s.best_runkills = Math.max(s.best_runkills, stats.kills);
  s.best_runevos = Math.max(s.best_runevos, run.evos); s.best_runelites = Math.max(s.best_runelites, run.elites);
  s.mask_evo |= run.evoMask;
  if (cleared) {
    if (run.naked) s.n_naked += 1;
    if (run.hits <= FEWHIT_MAX) s.n_fewhit += 1;
    if (isFastBoss()) s.n_fastboss += 1;
    if (run.diff === 3) s.mask_hell |= charBit();
  }
  if (run.diff > 0) s[`time_d${run.diff}`] = Math.max(s[`time_d${run.diff}`] || 0, Math.floor(stats.time));
  s.bestTime = Math.max(s.bestTime, Math.floor(stats.time));
  s.bestLevel = Math.max(s.bestLevel, player.level);
  if (cleared) { s.clears += 1; s[`clear_${run.char}`] = (s[`clear_${run.char}`] || 0) + 1; s.maxClearDiff = Math.max(s.maxClearDiff, run.diff); }
  meta.gold += gold;
  saveMeta();
  clearRun();
  let html = `+${gold} 금화 (보유 ${meta.gold})`;
  for (const id of run.newQuests) { const q = QUESTS.find((it) => it.id === id); html += `<br><span>퀘스트 '${q.name}' 완료 → ${rewardText(q)}</span>`; }
  if (s.maxClearDiff > prevMaxDiff && s.maxClearDiff + 1 < DIFFS.length) html += `<br><span>새 난이도 '${DIFFS[s.maxClearDiff + 1].name}' 열림</span>`;
  if (prevMaxDiff < SPEED_UNLOCK_DIFF && isSpeedUnlocked()) html += `<br><span>상점에 '1.5배속' 열림</span>`;
  if (!storageOk) html += `<br>※ 이 브라우저에서는 저장이 안 됩니다 (사생활 보호 모드 등)`;
  return html;
}

// =====================================================================
// 15-2. 하던 판 이어 하기: 멈춘 순간(카드 고른 직후·일시정지)·15초마다·앱을 내릴 때 저장
//   돌아오면 일시정지 상태로 띄움 (바로 싸우지 않게). 적·보스·적 탄환·구슬·상자·아이템·자국·진행 중인 이벤트도 그대로 되살림
//   (내 무기 탄·불바다·연출은 저장 안 함: 무기가 곧 다시 쏘고, 몇 초면 사라지는 것들이라서)
// =====================================================================
function saveRun() {
  if (!run || run.done || (state !== "playing" && state !== "paused")) return;   // 카드·상자 창이 떠 있는 동안은 저장 안 함
  const p = player;
  const snap = {
    v: SAVE_VERSION, char: run.char, diff: run.diff,
    player: { x: p.x, y: p.y, hp: p.hp, level: p.level, xp: p.xp, xpNeed: p.xpNeed, revivesUsed: p.revivesUsed,
              stageChangedAt: p.stageChangedAt, enemyStage: p.enemyStage, passives: p.passives,
              weapons: p.weapons.map((w) => ({ type: w.type, level: w.level })) },
    stats: { time: stats.time, kills: stats.kills },
    eventIndex, spawnTimer, eliteTimer,
    world: {
      enemies: enemies.concat(pendingSpawns), enemyBullets, chests, hazards,
      gems: gems.map((g) => ({ ...g, x: Math.round(g.x), y: Math.round(g.y) })),   // 구슬은 수천 개라 좌표를 정수로 줄여 저장
      items: items.map((it) => ({ ...it, type: it.type.key })),                     // 아이템 종류는 이름(key)으로
      events: eventQueue.map((q) => ({ ...q, ev: EVENT_SCHEDULE.indexOf(q.ev) })),   // 시간표 칸은 번호로
      freezeTimer, nextEnemyId,
    },
    run: { ...run, tick: 0, saveTimer: 0, done: false },   // 퀘스트용 판 기록을 통째로 (이어 하기 때 그대로 되살림)
  };
  try { localStorage.setItem(RUN_KEY, JSON.stringify(snap)); } catch {}
}
function loadRun() {
  try { const s = JSON.parse(localStorage.getItem(RUN_KEY)); return s && s.v === SAVE_VERSION && s.player && s.stats ? s : null; }   // 시간 정보가 없는 망가진 저장은 없는 것으로 (시작 버튼이 멈추지 않게)
  catch { return null; }
}
function clearRun() { try { localStorage.removeItem(RUN_KEY); } catch {} }

function continueRun() {
  const snap = loadRun();
  if (!snap) { refreshTitleMenu(); return; }
  enterFullscreen();
  if (CHARACTERS[snap.char]) meta.char = snap.char;
  meta.diff = Math.min(DIFFS.length - 1, snap.diff | 0);
  resetGame();                          // 캐릭터·난이도 적용한 새 판을 만든 뒤, 저장해 둔 값으로 덮어씀
  const sp = snap.player;
  Object.assign(player, { x: sp.x, y: sp.y, level: sp.level, xp: sp.xp, xpNeed: sp.xpNeed, revivesUsed: sp.revivesUsed,
                          stageChangedAt: sp.stageChangedAt, enemyStage: sp.enemyStage,
                          passives: Array.isArray(sp.passives) ? sp.passives.filter((it) => PASSIVES[it.type]) : [] });
  const ws = (sp.weapons || []).filter((w) => WEAPONS[w.type]).map((w) => ({ type: w.type, level: w.level, timer: 0 }));
  if (ws.length) player.weapons = ws;
  stats = { time: snap.stats.time, kills: snap.stats.kills };
  eventIndex = snap.eventIndex | 0; spawnTimer = snap.spawnTimer || SPAWN_START; eliteTimer = snap.eliteTimer || ELITE_INTERVAL;
  Object.assign(run, snap.run || {});
  const wd = snap.world;                // 예전 저장(world 없음)은 적 없이 시작
  if (wd) {
    const list = (a) => (Array.isArray(a) ? a : []);
    enemies = list(wd.enemies);
    boss = enemies.find((e) => e.boss) || null;
    enemyBullets = list(wd.enemyBullets); chests = list(wd.chests); hazards = list(wd.hazards); gems = list(wd.gems);
    items = list(wd.items).map((it) => ({ ...it, type: ITEM_TYPES.find((t) => t.key === it.type) })).filter((it) => it.type);
    eventQueue = list(wd.events).map((q) => ({ ...q, ev: EVENT_SCHEDULE[q.ev] })).filter((q) => q.ev);
    freezeTimer = wd.freezeTimer || 0;
    nextEnemyId = Math.max(nextEnemyId, wd.nextEnemyId | 0);
  }
  recalcStats();
  player.hp = Math.min(player.maxHp, Math.max(1, sp.hp));
  updateCamera();
  draw();                               // 일시정지 창 뒤에 시작 화면이 아니라 불러온 게임 화면이 보이게 한 번 그림
  pauseGame("저장해 둔 판을 불러왔어요. 준비되면 계속하기를 누르세요");
}

// --- 일시정지 ---
function pauseGame(msg) {
  if (state !== "playing") return;
  state = "paused";
  playSfx("pause_in");
  endJoystick();
  pauseText.textContent = `${msg} · ${formatTime(stats.time)} 버팀`;
  pauseBox.style.display = "flex";
  saveRun();
}
// 1.5배속 단추 (게임 화면 왼쪽 위, 소리 단추 옆): 상점에서 산 사람에게만 보이고, 누를 때마다 켜고 끔. 켜져 있으면 주황 그림
function refreshSpeedBtn(inGame) {
  speedBtn.style.display = inGame && hasFast() ? "block" : "none";
  speedBtn.querySelector("img").src = meta.fast ? "assets/speed_on.png" : "assets/speed_off.png";
  speedBtn.title = meta.fast ? "1.5배속 끄기" : "1.5배속 켜기";
}
function toggleFast() {
  if (!hasFast()) return;
  meta.fast = !meta.fast;
  saveMeta();
  refreshSpeedBtn(true);
}
function resumeFromPause() {
  if (state !== "paused") return;
  enterFullscreen();
  pauseBox.style.display = "none";
  playSfx("pause_out");
  resumeGame();
}
function toTitle() {
  saveRun();                            // 일시정지에서 나가면 나중에 '이어 하기'
  for (const box of [pauseBox, gameoverBox, clearBox, helpBox, levelupBox, chestBox, candyBox]) box.style.display = "none";
  run = null;
  showTitle();
}
// 앱을 내리거나 다른 탭으로 가면: 멈추고 저장 (휴대폰 브라우저는 내려간 페이지를 예고 없이 닫을 수 있음)
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "hidden") return;
  if (state === "playing") pauseGame("앱을 내렸다 돌아왔어요");
  else saveRun();
});

// =====================================================================
// 15-3. 시작 화면: 금화·캐릭터·이어 하기 표시, 상점·퀘스트·캐릭터와 난이도·기록과 저장 판
// =====================================================================
const pauseBox = document.getElementById("pauseBox");
const pauseBtn = document.getElementById("pauseBtn");
const hudStats = document.getElementById("hudStats");
const hudTime = document.getElementById("hudTime");
const hudKills = document.getElementById("hudKills");
const pauseText = document.getElementById("pauseText");
const speedBtn = document.getElementById("speedBtn");
const runReward = document.getElementById("runReward");
const clearReward = document.getElementById("clearReward");
const continueBtn = document.getElementById("continueBtn");
const metaTitle = document.getElementById("metaTitle");
const metaNote = document.getElementById("metaNote");
const metaBody = document.getElementById("metaBody");
const importFile = document.getElementById("importFile");
let panelKind = "shop";

function refreshTitleMenu() {
  document.getElementById("titleGold").innerHTML = `<img src="assets/coin.png" alt="금화">${meta.gold}`;
  document.getElementById("titleSub").innerHTML = `${CHARACTERS[meta.char].name} · ${DIFFS[meta.diff].name}` +
    (storageOk ? "" : ` · <span class="title-warn">저장 안 됨</span>`);
  document.getElementById("questBtn").textContent = `퀘스트 ${meta.quests.length}/${QUESTS.length}`;
  continueBtn.style.display = loadRun() ? "block" : "none";
}

function openPanel(kind) {
  state = "intro";                      // Esc·Enter 로 닫힘 (게임 설명과 같은 처리)
  panelKind = kind;
  titleOverlay.classList.add("panel");
  renderPanel();
  metaBody.scrollTop = 0;               // 다른 창에서 내려 둔 위치가 남지 않게 맨 위부터 (창 안에서 다시 그릴 때는 위치 유지)
}

function row(cls, icon, title, sub, right) {
  const keep = (s) => String(s).replaceAll(" · ", "&nbsp;· ");   // 구분 기호 '·' 가 줄 첫머리로 넘어가지 않게 앞 글에 붙임
  return `<div class="meta-row ${cls}">${icon ? `<img src="${icon}" alt="">` : ""}<div class="grow"><b>${keep(title)}</b><small>${keep(sub)}</small></div>${right || ""}</div>`;
}
function bar(v, goal) { return `<div class="bar"><i style="width:${Math.min(100, (v / goal) * 100)}%"></i></div>`; }

function renderPanel() {
  let html = "";
  if (panelKind === "shop") {
    metaTitle.textContent = "상점";
    metaNote.textContent = `보유 금화 ${meta.gold}`;
    html += `<div class="meta-actions"><button class="meta-btn" data-act="refund">전부 환불</button></div>`;
    for (const s of SHOP) {
      const lv = upLevel(s.key), cost = s.base * (lv + 1);
      if (shopLocked(s.key)) {   // 아직 안 열린 항목: 어떤 퀘스트를 끝내야 하는지만 보여 줌
        const q = QUESTS.find((it) => it.id === SHOP_LOCKS[s.key]);
        const why = q ? `퀘스트 '${q.name}' 달성 시 열림 · ${q.desc}` : `'${DIFFS[SPEED_UNLOCK_DIFF].name}' 클리어 시 열림`;   // 퀘스트가 없는 잠금 = 1.5배속
        html += row("locked", `assets/${s.icon}.png`, `${s.name} (잠김)`, why, `<button class="meta-btn" disabled>잠김</button>`);
        continue;
      }
      const pips = "●".repeat(lv) + "○".repeat(s.max - lv);
      const btn = s.free
        ? `<button class="meta-btn" data-act="lower" data-key="${s.key}" ${lv <= 0 ? "disabled" : ""}>− 내리기</button> <button class="meta-btn buy" data-act="buy" data-key="${s.key}" ${lv >= s.max ? "disabled" : ""}>+ 올리기</button>`
        : lv >= s.max ? `<button class="meta-btn" disabled>최대</button>`
        : `<button class="meta-btn buy" data-act="buy" data-key="${s.key}" ${meta.gold < cost ? "disabled" : ""}>${cost} 금화</button>`;
      html += row("", `assets/${s.icon}.png`, `${s.name} <span class="pips">${pips}</span>`, s.note ? s.note(lv) : `지금 +${Math.round(s.per * lv * 100)}% · 단계마다 +${Math.round(s.per * 100)}%`, btn);
    }
  } else if (panelKind === "quests") {
    metaTitle.textContent = "퀘스트";
    metaNote.textContent = "";
    // 아직 못 끝낸 퀘스트를 위에 보여 줌 (끝낸 것은 아래로)
    for (const q of [...QUESTS].sort((a, b) => isQuestDone(a.id) - isQuestDone(b.id))) {
      const done = isQuestDone(q.id), v = Math.min(q.goal, Math.max(0, questValue(q, false)));
      const icon = q.weapon ? weaponIconUrl(q.weapon) : q.char ? `assets/${CHARACTERS[q.char].sprite}.png` : q.shop ? `assets/${SHOP.find((it) => it.key === q.shop).icon}.png` : q.passive ? passiveIconUrl(q.passive) : "assets/coin.png";
      const prog = TIME_STATS.includes(q.stat) ? `${formatTime(v)} / ${formatTime(q.goal)}` : q.stat === "diff" || q.goal === 1 ? "" : `${v} / ${q.goal}`;
      html += row(done ? "done" : "", icon, `${done ? "✔ " : ""}${q.name}`, `${q.desc} → ${rewardText(q)}${done ? "" : (prog ? ` · ${prog}` : "") + bar(v, q.goal)}`);
    }
  } else if (panelKind === "select") {
    metaTitle.textContent = "캐릭터·난이도";
    metaNote.textContent = "";
    html += `<p class="meta-head">캐릭터</p>`;
    for (const k in CHARACTERS) {
      const c = CHARACTERS[k], open = isCharUnlocked(k), owned = isCharOwned(k), sel = meta.char === k;
      const right = !open ? `<button class="meta-btn" disabled>잠김</button>`
        : !owned ? `<button class="meta-btn buy" data-act="charbuy" data-key="${k}" ${meta.gold < c.price ? "disabled" : ""}>${c.price} 금화</button>`
        : `<button class="meta-btn ${sel ? "" : "buy"}" data-act="char" data-key="${k}" ${sel ? "disabled" : ""}>${sel ? "선택됨" : "고르기"}</button>`;
      const sub = open ? c.rule : `잠김: 퀘스트 '${QUESTS.find((q) => q.id === c.unlock).name}' (${QUESTS.find((q) => q.id === c.unlock).desc})`;
      html += row(sel ? "sel" : open ? "" : "locked", `assets/${c.sprite}.png`, c.name, sub, right);
    }
    html += `<p class="meta-head">난이도</p>`;
    DIFFS.forEach((d, i) => {
      const open = isDiffUnlocked(i), sel = meta.diff === i;
      const right = !open ? `<button class="meta-btn" disabled>잠김</button>`
        : `<button class="meta-btn ${sel ? "" : "buy"}" data-act="diff" data-key="${i}" ${sel ? "disabled" : ""}>${sel ? "선택됨" : "고르기"}</button>`;
      const sub = open ? `${d.desc} · 금화 ×${d.gold}` : `잠김: '${DIFFS[i - 1].name}' 클리어하면 열림`;
      html += row(sel ? "sel" : open ? "" : "locked", "", `${d.name} · ${d.place}`, sub, right);
    });
  } else {
    const s = meta.stats;
    metaTitle.textContent = "기록·저장";
    metaNote.textContent = "기록은 이 브라우저에 저장돼요. 아이폰은 7일 동안 안 들어오면 지워질 수 있으니 가끔 내보내기로 백업하세요 (홈 화면에 추가하면 안전)";
    html += row("", "", "판 수 / 클리어", `${s.runs}판 / ${s.clears}번 클리어`);
    html += row("", "", "누적", `처치 ${s.kills}마리 · 상자 ${s.chests}개 · 진화 ${s.evos}번`);
    html += row("", "", "최고 기록", `${formatTime(s.bestTime)} 버팀 · 레벨 ${s.bestLevel}`);
    if (!storageOk) html += row("locked", "", "저장 안 됨", "이 브라우저에서는 저장이 막혀 있어요 (사생활 보호 모드 등)");
    html += `<div class="meta-actions"><button class="meta-btn buy" data-act="export">내보내기</button><button class="meta-btn buy" data-act="import">불러오기</button><button class="meta-btn" data-act="wipe">기록 지우기</button></div>`;
  }
  metaBody.innerHTML = html;
}

metaBody.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.disabled) return;
  const act = b.dataset.act, key = b.dataset.key;
  if (act === "buy") {
    const s = SHOP.find((it) => it.key === key), lv = upLevel(key), cost = s.base * (lv + 1);
    if (!shopLocked(key) && lv < s.max && meta.gold >= cost) { meta.gold -= cost; meta.upgrades[key] = lv + 1; }
  } else if (act === "lower") {
    if (upLevel(key) > 0) meta.upgrades[key] = upLevel(key) - 1;          // 저주처럼 값이 없는 항목은 한 단계씩 내릴 수 있음
  } else if (act === "refund") {
    for (const s of SHOP) { const lv = upLevel(s.key); meta.gold += (s.base * lv * (lv + 1)) / 2; meta.upgrades[s.key] = 0; }
  } else if (act === "charbuy") {
    const c = CHARACTERS[key];
    if (isCharUnlocked(key) && !isCharOwned(key) && meta.gold >= c.price) { meta.gold -= c.price; meta.chars.push(key); }
  } else if (act === "char") { if (isCharOwned(key)) meta.char = key; }
  else if (act === "diff") { if (isDiffUnlocked(+key)) { meta.diff = +key; setBackgroundTheme(DIFFS[meta.diff].theme); } }   // 고른 난이도의 장소가 시작 화면 배경에 바로 보임
  else if (act === "export") { exportSave(); return; }
  else if (act === "import") { importFile.click(); return; }
  else if (act === "wipe") {
    if (!confirm("금화·강화·퀘스트·기록을 모두 지울까요? 되돌릴 수 없어요")) return;
    meta = defaultMeta(); clearRun();
  }
  saveMeta();
  renderPanel();
});

function exportSave() {
  const blob = new Blob([JSON.stringify(meta, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `dungeon-survivor-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
importFile.addEventListener("change", async () => {
  const file = importFile.files[0];
  importFile.value = "";
  if (!file) return;
  try {
    if (file.size > 64 * 1024) throw new Error("파일이 너무 커요");
    const data = JSON.parse(await file.text());
    if (!data || typeof data !== "object" || (data.version | 0) > SAVE_VERSION) throw new Error("이 게임의 저장 파일이 아니에요");
    if (!confirm("지금 기록을 불러온 파일로 바꿀까요?")) return;
    meta = normalizeMeta(data);
    saveMeta();
    renderPanel();
    alert("불러왔어요");
  } catch (e) { alert(`불러오기 실패: ${e.message}`); }
});

for (const b of document.querySelectorAll("[data-panel]")) b.addEventListener("click", () => openPanel(b.dataset.panel));
document.getElementById("metaClose").addEventListener("click", closeIntro);
continueBtn.addEventListener("click", continueRun);
pauseBtn.addEventListener("click", () => pauseGame("일시정지"));
document.getElementById("pauseResume").addEventListener("click", resumeFromPause);
speedBtn.addEventListener("click", toggleFast);
for (const b of document.querySelectorAll(".to-title")) b.addEventListener("click", toTitle);
