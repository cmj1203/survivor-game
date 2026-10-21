// =====================================================================
// 2-2. 패시브 아이템 목록 (원작 뱀파이어 서바이벌의 패시브. 무기처럼 Lv1~maxLevel, 카드와 상자에서 강화)
//   name     : 카드에 보이는 이름        icon : assets 폴더의 그림 이름
//   maxLevel : 최대 레벨                 desc : 카드 설명 (레벨당 효과)
//   noSlot   : true 면 패시브 슬롯(6칸)을 차지하지 않음
//   효과는 여기 적지 않고, 아래 passiveLevel()/recalcStats()/각 ×Mul() 함수가 레벨을 읽어서 적용함
//   → 레벨업 카드로 올리든 상자에서 올리든 계산이 어긋나지 않음
// =====================================================================
const PASSIVES = {
  might:     { name: "힘",        icon: "passive_might",     maxLevel: 5, desc: "무기 피해 +12%" },
  armor:     { name: "갑옷",      icon: "passive_armor",     maxLevel: 3, desc: "받는 피해 -1" },
  maxhp:     { name: "튼튼함",    icon: "passive_maxhp",     maxLevel: 3, desc: "최대 체력 +20%" },
  regen:     { name: "회복",      icon: "passive_regen",     maxLevel: 5, desc: "1초마다 체력 +0.2" },
  cooldown:  { name: "빠른 공격", icon: "passive_cooldown",  maxLevel: 5, desc: "모든 무기 발동 간격 -8%" },
  area:      { name: "촛대",      icon: "passive_area",      maxLevel: 5, desc: "공격 범위 +10%" },
  projspeed: { name: "팔보호대",  icon: "passive_projspeed", maxLevel: 5, desc: "발사체 속도 +10%" },
  duration:  { name: "주문서",    icon: "passive_duration",  maxLevel: 5, desc: "효과 지속 시간 +15%" },
  amount:    { name: "복제기",    icon: "passive_amount",    maxLevel: 2, desc: "도끼 +1개. 발사 무기는 3회마다 추가 발사 (Lv2: 2회마다)" },
  move:      { name: "날개",      icon: "passive_move",      maxLevel: 5, desc: "이동 속도 +10%" },
  magnet:    { name: "자석",      icon: "passive_magnet",    maxLevel: MAGNET_MAX, desc: "경험치 구슬을 끌어당기는 범위 +30" },
  luck:      { name: "클로버",    icon: "passive_luck",      maxLevel: 5, desc: "행운 +15% (물약 드랍, 상자 대박 확률)" },
  growth:    { name: "왕관",      icon: "passive_growth",    maxLevel: 5, desc: "얻는 경험치 +12%" },
  curse:     { name: "해골",      icon: "passive_curse",     maxLevel: 5, desc: "적 생성 +10%, 체력 +6%, 속도 +3%. 대신 얻는 경험치 +8%" },
  revival:   { name: "부활",      icon: "passive_revival",   maxLevel: 2, desc: "죽으면 체력을 전부 회복하고 부활 (+1회)" },
  // '선택의 폭'(레벨업 카드 +1장)은 게임 중 아이템이 아니라 상점 강화로 옮김 (아래 다회차의 SHOP 참고)
};

// --- 패시브 레벨당 수치 (여기 값만 바꿔도 밸런스 조절 가능) ---
const P_MIGHT = 0.12;       // 힘: 피해 +12%
const P_MAXHP = 0.20;       // 튼튼함: 최대 체력 +20%
const P_REGEN = 0.2;        // 회복: 초당 +0.2
const P_COOLDOWN = 0.08;    // 빠른 공격: 간격 -8%
const P_AREA = 0.10;        // 촛대: 범위 +10%
const P_PROJSPEED = 0.10;   // 팔보호대: 발사체 속도 +10%
const P_DURATION = 0.15;    // 주문서: 지속 +15%
const P_MOVE = 0.10;        // 날개: 이동 속도 +10%
const P_MAGNET = 30;        // 자석: 범위 +30px
const P_LUCK = 0.15;        // 클로버: 행운 +15%
const P_GROWTH = 0.12;      // 왕관: 경험치 +12%
const P_CURSE_SPAWN = 0.10; // 해골: 적 생성 +10%
const P_CURSE_HP = 0.06;    // 해골: 적 체력 +6%
const P_CURSE_SPEED = 0.03; // 해골: 적 속도 +3%
const P_CURSE_XP = 0.08;    // 해골: 위험을 감수한 보상으로 구슬 경험치도 +8%
const P_REVIVE_INVINCIBLE = 2; // 부활 직후 무적 시간 (초)

// 가진 패시브의 레벨 (없으면 0)
function passiveLevel(key) {
  const p = player.passives.find((it) => it.type === key);
  return p ? p.level : 0;
}
// 무기 계산 때 그때그때 읽는 배수들
function damageMul()    { return (1 + P_MIGHT * passiveLevel("might")) * upMul("might") * charDamageMul(); }   // × 상점 강화 × 캐릭터
function areaMul()      { return 1 + P_AREA * passiveLevel("area"); }
function projSpeedMul() { return 1 + P_PROJSPEED * passiveLevel("projspeed"); }
function durationMul()  { return 1 + P_DURATION * passiveLevel("duration"); }
function extraAmount()  { return passiveLevel("amount"); }
function luckMul()      { return 1 + P_LUCK * passiveLevel("luck") + SHOP_LUCK * upLevel("luck"); }   // 클로버(게임 중) + 상점 '행운'
function xpMul()        { return (1 + P_GROWTH * passiveLevel("growth")) * (1 + P_CURSE_XP * curseLevel()) * upMul("growth"); }
function curseLevel()   { return passiveLevel("curse") + upLevel("curse"); }                        // 해골(게임 중) + 상점 '저주'

// 패시브 레벨이 바뀔 때마다 플레이어의 능력치를 '기본값 × 레벨'로 다시 계산
//   (누적 곱셈 대신 매번 새로 계산하므로 어디서 올려도 값이 정확함)
function recalcStats() {
  const oldMax = player.maxHp;
  player.maxHp = Math.round(PLAYER_MAX_HP * (1 + P_MAXHP * passiveLevel("maxhp")) * upMul("maxhp") * charDef().hp);   // × 상점 강화 × 캐릭터
  if (player.maxHp > oldMax) player.hp += player.maxHp - oldMax;   // 최대 체력이 오른 만큼 현재 체력도 +
  player.hp = Math.min(player.hp, player.maxHp);
  player.speed = PLAYER_SPEED * (1 + P_MOVE * passiveLevel("move")) * upMul("move") * charDef().speed;
  player.attackSpeed = 1 - P_COOLDOWN * passiveLevel("cooldown");
  player.pickupRadius = (PICKUP_RADIUS + P_MAGNET * passiveLevel("magnet")) * upMul("magnet");
  player.choices = START_CHOICES + upLevel("choices") + (charDef().choices || 0);   // 상점 '선택의 폭' + 캐릭터 보너스
}

// 패시브 새로 얻기 / 한 레벨 올리기 (카드와 상자가 같이 씀)
function gainPassive(key) {
  const owned = player.passives.find((it) => it.type === key);
  if (owned) owned.level += 1;
  else player.passives.push({ type: key, level: 1 });
  recalcStats();
}

// =====================================================================
// 2-3. 적 종류 목록 (위에서부터 순서대로 등장. 언제 열리는지는 아래 '새 몬스터가 열리는 레벨' 참고)
//   shape    : 그림 파일 이름 (assets 폴더의 ghost.png, bat.png ... 확장자 빼고 적음)
//   color    : 죽을 때 튀는 파편 색 (그림과 비슷한 색으로 맞춤)
//   r        : 크기(반지름)    speed : 속도    hp : 체력    damage : 닿으면 깎는 체력
//   xp       : 죽을 때 떨어뜨리는 구슬의 경험치
//   behavior : 행동 방식 (chase 곧장 다가옴, ranged 멀리서 탄환 발사, charger 주기적으로 돌진)
//   splitInto: 죽을 때 갈라져 나오는 작은 적 수
// =====================================================================
const ENEMY_TYPES = [
  // 약해 보이는 순서대로 등장. 뒤로 갈수록 체력·피해·경험치가 커짐
  // 1레벨 박쥐   : 작고 약한 기본 적. 한 방에 죽지만 살짝 빠름
  { key: "bat",     name: "박쥐",     shape: "bat",     color: "#c8793f", r: 11, speed: 80,  hp: 1, damage: 8,  xp: 1, behavior: "chase" },
  // 2레벨 붉은 게 : 걷다가 멈춰서 번쩍인 뒤 돌진. 번쩍일 때 옆으로 피하면 빗나감
  { key: "crab",    name: "붉은 게",  shape: "crab",    color: "#e63946", r: 14, speed: 50,  hp: 2, damage: 10, xp: 2, behavior: "charger" },
  // 3레벨 거미    : 죽으면 새끼 거미 2마리로 갈라짐
  { key: "spider",  name: "거미",     shape: "spider",  color: "#b5651d", r: 14, speed: 55,  hp: 3, damage: 10, xp: 2, behavior: "chase", splitInto: 2 },
  // 4레벨 유령    : 빠르게 달라붙는 추격자
  { key: "ghost",   name: "유령",     shape: "ghost",   color: "#d8dee9", r: 14, speed: 95,  hp: 3, damage: 12, xp: 3, behavior: "chase" },
  // 5레벨 외눈 거인: 느리지만 크고 튼튼하며 한 대가 아픔
  { key: "cyclops", name: "외눈 거인", shape: "cyclops", color: "#f0a860", r: 20, speed: 40,  hp: 8, damage: 18, xp: 4, behavior: "chase" },
];

// --- 스테이지별 적: 난이도 테마마다 다른 적 5종. 표가 없는 테마는 위 ENEMY_TYPES 를 그대로 씀 ---
//   자리 순서 = 등장 순서. 같은 자리끼리 능력치를 비슷하게 맞춤 (ENEMY_TYPES 의 몬스터 떼 "bat"·"ghost" 도 같은 자리 적으로 나옴)
//   knockback: 부딪히면 밀려남
//   splitType: 죽으면 이 종류가 splitInto 마리 나옴   killStat: 잡으면 이 퀘스트 기록을 +1
//   behavior "gallop": 멀리선 어슬렁, 가까우면 점점 빨라지며 질주   aura: 둘레의 찬 기운 안에 들어가면 느려짐
//   behavior "leaper": 가끔 뛰어올라 덮침 (착지한 자리에 장판, hazardQuest: 밟으면 퀘스트 기록)
//   첫 자리 적은 특성 없음 (사용자 결정: 박쥐와 똑같이). 보스가 아닌 적은 쏘는 공격을 하지 않음
const STAGE_ENEMIES = {
  ice: [
    { key: "icewisp",    name: "얼음 정령", shape: "icewisp",    color: "#9be7ff", r: 11, speed: 80, hp: 1, damage: 8,  xp: 1, behavior: "chase" },
    { key: "polarbear",  name: "북극곰",    shape: "polarbear",  color: "#eef6ff", r: 15, speed: 50, hp: 3, damage: 10, xp: 2, behavior: "gallop", knockback: true },
    { key: "iceelem",    name: "얼음 원소", shape: "iceelem",    color: "#bfefff", r: 14, speed: 55, hp: 3, damage: 10, xp: 2, behavior: "slide", splitInto: 3, splitType: "icewisp", killStat: "shells" },
    { key: "frostwight", name: "서리 망령", shape: "frostwight", color: "#8fa8c8", r: 14, speed: 60, hp: 3, damage: 12, xp: 3, behavior: "chase", aura: true },
    { key: "wendigo",    name: "웬디고",    shape: "wendigo",    color: "#c9b8a0", r: 20, speed: 40, hp: 8, damage: 18, xp: 4, behavior: "leaper", hazardQuest: true },
  ],
  //   behavior "pack": 한 마리로 오다가 가까워지면 세 마리로 늘어나 양옆 개가 비껴 달려 둘러쌈
  //   firePool: 몇 초마다 발밑에 불 웅덩이 (잠깐 뒤 켜지고, 밟으면 피해)   fireTrail: 지나간 자리에 짧게 남는 불꽃 꼬리 (닿으면 작은 피해)
  //   deathBlast: 죽은 자리에 주황 경고 원이 차오른 뒤 폭발 (원 안이면 피해)
  lava: [
    { key: "imp",        name: "임프",       shape: "imp",        color: "#e8604c", r: 11, speed: 80,  hp: 1, damage: 8,  xp: 1, behavior: "chase" },
    { key: "hellhound",  name: "지옥개",     shape: "hellhound",  color: "#e2553d", r: 14, speed: 70,  hp: 2, damage: 10, xp: 2, behavior: "pack" },
    { key: "fireelem",   name: "불 원소",    shape: "fireelem",   color: "#ffb02e", r: 14, speed: 55,  hp: 3, damage: 10, xp: 2, behavior: "chase", firePool: true },
    { key: "flameskull", name: "불타는 해골", shape: "flameskull", color: "#ff8a2a", r: 14, speed: 95,  hp: 3, damage: 12, xp: 3, behavior: "chase", fireTrail: true },
    { key: "lavagolem",  name: "용암 골렘",  shape: "lavagolem",  color: "#e85c24", r: 20, speed: 40,  hp: 8, damage: 18, xp: 4, behavior: "chase", deathBlast: true },
  ],
  //   behavior "runner": 준비 동작 → 캐릭터 쪽으로 일직선 돌진 → 2초 숨 고르기를 되풀이 (RUSH_* 값)
  //   splitGens: 몇 번까지 갈라지는지 (갈라질 때마다 작아짐)   fade: 멀리 있으면 거의 안 보이고 가까이 오면 드러남 (맞는 건 그대로)
  //   regen: 몇 초 안 맞으면 체력이 천천히 차오름 (초록 반짝임)
  dark: [
    { key: "crow",       name: "까마귀",    shape: "crow",       color: "#5b6478", r: 11, speed: 80, hp: 1, damage: 8,  xp: 1, behavior: "chase" },
    { key: "nightmare",  name: "악몽마",    shape: "nightmare",  color: "#4a5068", r: 15, speed: 50, hp: 2, damage: 10, xp: 2, behavior: "runner" },
    { key: "muck",       name: "검은 진흙", shape: "muck",       color: "#4b4560", r: 17, speed: 50, hp: 4, damage: 10, xp: 2, behavior: "chase", splitInto: 2, splitGens: 2 },
    { key: "wraith",     name: "망령",      shape: "wraith",     color: "#5e6c8a", r: 14, speed: 95, hp: 3, damage: 12, xp: 3, behavior: "chase", fade: true },
    { key: "mummy",      name: "미라",      shape: "mummy",      color: "#c9d1d8", r: 20, speed: 40, hp: 8, damage: 18, xp: 4, behavior: "chase", regen: true },
  ],
};
const ALL_ENEMY_TYPES = ENEMY_TYPES.concat(...Object.values(STAGE_ENEMIES));
function enemyTypes() { return STAGE_ENEMIES[diffDef().theme] || ENEMY_TYPES; }             // 지금 스테이지의 적 5종
function findEnemyType(key) { return ALL_ENEMY_TYPES.find((t) => t.key === key); }
function stageEnemyType(baseKey) { return enemyTypes()[ENEMY_TYPES.findIndex((t) => t.key === baseKey)]; }   // ENEMY_TYPES 의 자리 → 지금 스테이지의 같은 자리 적
const SLIDE_MAX_MUL = 1.7;           // 얼음 원소(미끄러짐): 최고 속도 = 기본 속도 × 이 값
const SLIDE_GRIP = 0.45;             // 얼음 원소: 방향을 바꾸는 빠르기 (작을수록 더 미끄러져서 플레이어를 지나쳤다 돌아옴)
const PACK_SPLIT_DIST = 300;         // 지옥개: 플레이어와 이 거리 안으로 들어오면 한 마리 → 세 마리로 늘어남 (사용자 요청 10-19)
const PACK_SPLIT_GAP = 30;           // 지옥개: 늘어날 때 양옆 개가 가운데 개에서 떨어져 나오는 거리
const PACK_FLANK_ANGLE = 0.65;       // 지옥개: 양옆 개가 플레이어 쪽에서 비껴 달리는 각도 (라디안, 약 37도)
const PACK_FLANK_SPEED = 1.2;        // 지옥개: 양옆 개는 돌아가는 만큼 조금 빨라서 가운데 개와 비슷하게 도착
const PACK_CLOSE_DIST = 170;         // 지옥개: 이보다 가까워지면 양옆 개도 곧장 달려듦
const SPLIT_SHRINK = 0.7;            // 검은 진흙: 갈라질 때마다 크기 배수 (체력은 절반)
const FIRE_POOL_INTERVAL = 3.5;      // 불 원소: 불 웅덩이를 남기는 간격 (초). 첫 웅덩이만 적마다 박자가 다름
const FIRE_POOL_ARM = 0.8;           // 불 원소: 웅덩이가 생긴 뒤 켜지기까지 (그동안 테두리만 깜빡여서 피할 틈)
const FIRE_POOL_LIFE = 3.5;          // 불 원소: 켜진 웅덩이가 타는 시간
const FIRE_POOL_RADIUS = 32;         // 불 원소: 웅덩이 크기
const FIRE_POOL_MAX = 8;             // 불 원소: 동시에 깔려 있을 수 있는 웅덩이 수
const FIRE_POOL_DAMAGE_MUL = 0.6;    // 불 원소: 웅덩이 피해 = 몸 피해 × 이 값
const FIRE_TRAIL_INTERVAL = 0.1;     // 불타는 해골: 꼬리 불꽃을 남기는 간격
const FIRE_TRAIL_LIFE = 0.6;         // 불타는 해골: 꼬리 불꽃이 남는 시간
const FIRE_TRAIL_ARM = 0.2;          // 불타는 해골: 막 생긴 꼬리는 잠깐 안 아픔 (해골 몸과 겹친 자리라서)
const FIRE_TRAIL_MAX = 80;           // 불타는 해골: 화면 전체 꼬리 불꽃 수 상한 (해골 떼가 몰려와도 너무 많아지지 않게)
const FIRE_TRAIL_DAMAGE_MUL = 0.25;  // 불타는 해골: 꼬리 피해 = 몸 피해 × 이 값
const GOLEM_BLAST_TIME = 1.0;        // 용암 골렘: 죽은 뒤 터지기까지 (주황 경고 원이 차오름)
const GOLEM_BLAST_RADIUS = 70;       // 용암 골렘: 폭발 범위
// 악몽마: 준비(뒤로 젖히며 발 구름) → 캐릭터 쪽으로 일직선 돌진(맞든 안 맞든 끝까지) → 숨 고르기 → 다시 준비 (사용자 요청 10-19)
const RUSH_AIM_TIME = 0.8;           // 준비 시간 (초). 돌진 방향은 준비를 시작할 때 정해짐 → 그동안 옆으로 비키면 빗나감
const RUSH_DIST = 450;               // 한 번 돌진하는 거리
const RUSH_SPEED_MUL = 6.6;          // 돌진 속도 배수 (기본 속도 50 → 330)
const RUSH_REST_TIME = 2;            // 돌진 뒤 숨 고르는 시간 (초)
const FADE_NEAR = 130;               // 망령: 이 거리 안이면 다 드러남
const FADE_FAR = 320;                // 망령: 이 거리 밖이면 가장 흐림
const FADE_MIN_ALPHA = 0.12;         // 망령: 가장 흐릴 때 진하기
const REGEN_DELAY = 3;               // 미라: 마지막으로 맞은 뒤 이 시간(초)이 지나면 회복 시작
const REGEN_RATE = 0.12;             // 미라: 1초에 최대 체력의 이만큼 회복
const CHILL_TIME = 1.2;              // 예티 등: 맞으면 이 시간(초) 동안 느려짐
const CHILL_SLOW_MUL = 0.65;         // 느려졌을 때 이동 속도 배수
const KNOCKBACK_SPEED = 420;         // 북극곰: 부딪히면 이 속도로 밀려남
const KNOCKBACK_TIME = 0.18;         // 북극곰: 밀려나는 시간 (초) → 약 75px
const GALLOP_RANGE = 280;            // 북극곰: 이 거리 안으로 들어오면 질주 시작 (밖에서는 어슬렁)
const GALLOP_AMBLE = 1.2;            // 북극곰: 어슬렁거릴 때 속도 배수 (60)
const GALLOP_ACCEL = 1.2;            // 북극곰: 질주하면 1초마다 이만큼 빨라짐 (기본 속도의 배수)
const GALLOP_MAX = 3.4;              // 북극곰: 질주 최고 속도 배수 (170 — 플레이어 기본 속도 220 보다 느려서 피할 수 있음)
const AURA_RADIUS = 40;              // 서리 망령: 찬 기운 반지름 (이 안에 들어가면 느려짐)
function auraRadius(e) { return AURA_RADIUS * (e.elite ? ELITE_SIZE : 1); }   // 엘리트는 몸이 커지므로 찬 기운도 같은 배수로 (안 키우면 원이 몸 그림에 가려 안 보임)
const LEAP_INTERVAL = 10;            // 웬디고: 덮치기 간격 (초). 첫 덮치기만 적마다 박자가 다름
const LEAP_RANGE = 360;              // 웬디고: 이 거리 안이면 플레이어가 있던 자리로 뛰어오름
const LEAP_TIME = 0.9;               // 웬디고: 뛰어서 떨어지기까지 (그동안 떨어질 자리에 빨간 그림자 경고)
const LEAP_HEIGHT = 70;              // 웬디고: 뛰어오르는 높이 (그림만)
const LEAP_RADIUS = 55;              // 웬디고: 착지할 때 이 안에 있으면 피해, 그 자리에 얼음 장판
const LEAP_DUST_LIFE = 0.45;         // 웬디고: 착지 흙먼지 그림(Landing Dust)이 재생되는 시간

// --- 난이도 테마의 적 특성 (어려움 = 1단계, 매우 어려움 = 2단계, 지옥 = 3단계. 보통은 0단계라 아무 특성도 없음) ---
//   배열은 [0단계, 1단계, 2단계, 3단계] 순서. 난이도 표(DIFFS)의 tier 가 단계
const CRAB_SHELL = [0, 1, 1, 2];             // 붉은 게 '껍질': 공격을 이 횟수만큼 막아 냄
const SPIDER_SPLIT = [2, 3, 3, 4];           // 거미 '분열': 죽을 때 나오는 새끼 수
const GHOST_BLINK_INTERVAL = [0, 5, 4, 3];   // 유령 '순간이동': 몇 초마다
const GHOST_BLINK_DIST = 110;                // 유령 '순간이동': 한 번에 다가오는 거리
const GHOST_BLINK_MIN = 200;                 // 유령 '순간이동': 이보다 멀리 있을 때만 (코앞에 갑자기 나타나지 않게)
const CYCLOPS_HAZARD_LIFE = [0, 3, 4, 5];    // 외눈 거인 '자국': 죽은 자리에 남는 끈적한 자국이 유지되는 시간(초). 밟고 있으면 느려짐 (피해는 없음)
const CYCLOPS_HAZARD_RADIUS = 56;            // 외눈 거인 '자국': 크기
const CYCLOPS_HAZARD_CHANCE = [0, 0.3, 0.35, 0.4];   // 외눈 거인 '자국': 죽을 때 자국을 남길 확률 (전부 남기면 바닥이 자국투성이가 됨). 정예는 반드시 남김
const CYCLOPS_HAZARD_MAX = 6;                // 외눈 거인 '자국': 동시에 깔려 있을 수 있는 최대 개수
const HAZARD_SLOW_MUL = [1, 0.55, 0.5, 0.45]; // 외눈 거인 '자국': 밟고 있을 때 이동 속도 배수 (맞았을 때보다 훨씬 느림)
const HAZARD_ARM_TIME = 0.7;                 // 자국이 생긴 뒤 이 시간 동안은 아직 안 느려짐 (피할 틈)
const BOSS_PATTERNS = [null, "fan", "ring", "spiral"];   // 보스 공격: 보통 = 없음(쫓아오기·부하 소환만), 어려움 = 부채꼴 조준, 매우 어려움 = 사방 원형, 지옥 = 회전 나선 + 부채꼴
const THEME_COLORS = { ice: "125, 249, 255", lava: "255, 123, 46", dark: "181, 101, 245" };   // 테마 색 (자국·껍질·순간이동 효과)
function enemyTier() { return diffDef().tier || 0; }
function themeColor(alpha) { return `rgba(${THEME_COLORS[diffDef().theme] || "255, 255, 255"}, ${alpha})`; }

// --- 마지막 보스: 사신 마법사 (원작의 '사신'처럼 정해진 시간에 나타남. 잡으면 클리어) ---
//   일반 몬스터 목록에는 없고, BOSS_TIME 에 한 마리만 나옴. 시간·레벨 보정을 받지 않는 고정 능력치
const BOSS_TIME = 20 * 60;           // 보스가 나타나는 시간 (초) = 20분  ← 이 숫자 하나로 게임 전체 길이가 바뀜
// 아래의 몬스터 시간표·이벤트 시간표·강화 속도·생성 속도는 전부 "원작 30분 기준"으로 적혀 있고,
// 실제 게임에서는 BOSS_TIME 에 맞춰 자동으로 줄어듦 (20분이면 모든 일이 1.5배 빨리 일어남)
const TIMELINE_SCALE = BOSS_TIME / (30 * 60);
// 지금 시각을 "30분 기준"으로 환산한 값 (초). 시간표와 강화 계산은 전부 이 값을 씀
function refTime() { return stats.time / TIMELINE_SCALE; }
const BOSS_TYPE = { key: "boss", name: "사신 마법사", shape: "wizard", color: "#9b5de5", r: 40, speed: 125, hp: 2500, damage: 30, xp: 0, behavior: "boss" };
// --- 스테이지별 보스: 표가 없는 테마는 위 BOSS_TYPE (사신 마법사). 체력·피해 계산은 BOSS_TYPE 과 같음 ---
//   pattern: 공격 방식 (updateBossEnemy 참고)   summon: 부르는 부하 종류   ring: 발밑 고리 색 (r, g, b)
const STAGE_BOSSES = {
  ice: { key: "yeti", name: "예티", shape: "yeti", color: "#cfefff", r: 40, speed: 95, hp: 2500, damage: 30, xp: 0, behavior: "boss", pattern: "yeti", summon: "icewisp", ring: "125, 249, 255" },
  lava: { key: "demon", name: "악마", shape: "demon", color: "#e2442f", r: 40, speed: 95, hp: 2500, damage: 30, xp: 0, behavior: "boss", pattern: "demon", summon: "imp", ring: "255, 123, 46" },
  dark: { key: "deathknight", name: "죽음의 기사", shape: "deathknight", color: "#7a6aa8", r: 40, speed: 95, hp: 2500, damage: 30, xp: 0, behavior: "boss", pattern: "deathknight", summon: "crow", ring: "181, 101, 245" },
};
function bossType() { return STAGE_BOSSES[diffDef().theme] || BOSS_TYPE; }
// --- 예티 (얼음 동굴 보스) 공격: 모두 바닥에 얼음색 경고 원을 먼저 띄우고, 안쪽 원이 다 차면 그 자리에서 터짐 ---
const YETI_SLAM_INTERVAL = 6;        // 땅 내리치기 간격 (초)
const YETI_SLAM_WINDUP = 1.0;        // 멈춰서 번쩍이며 경고 원이 차는 시간
const YETI_SLAM_RADIUS = 170;        // 충격파 범위 (맞으면 느려짐)
const YETI_SLAM_DAMAGE = 20;
const YETI_ROCK_INTERVAL = 3.5;      // 얼음덩이 던지기 간격 (플레이어가 있던 자리에 떨어짐)
const YETI_ROCK_FALL = 1.1;          // 그림자가 생기고 떨어지기까지
const YETI_ROCK_RADIUS = 60;
const YETI_ROCK_DAMAGE = 18;
const YETI_SHARD_COUNT = 8;          // 얼음덩이가 떨어진 자리에서 사방으로 튀는 파편 수
const YETI_SHARD_SPEED = 200;
const YETI_SHARD_DAMAGE = 10;
const YETI_ICICLE_INTERVAL = 4;      // 체력 절반 이하: 고드름 비 간격
const YETI_ICICLE_COUNT = 6;         // 한 번에 떨어지는 고드름 수 (플레이어 자리 1개 + 주변 무작위)
const YETI_ICICLE_FALL = 1.2;
const YETI_ICICLE_RADIUS = 45;
const YETI_ICICLE_SPREAD = 320;      // 플레이어 주변 이 거리 안에 떨어짐
const YETI_ICICLE_DAMAGE = 14;
const YETI_FX_LIFE = 0.45;           // 예티 공격이 터지는 그림(Frost Nova / Ice Shatter / Ice Hit)이 재생되는 시간
// --- 악마 (용암 굴 보스) 공격: 주황 경고가 먼저 차오른 뒤 터짐 ---
const DEMON_RGB = "255, 130, 40";    // 경고 색 (주황)
const DEMON_PILLAR_INTERVAL = 4;     // 불기둥 간격 (초)
const DEMON_PILLAR_COUNT = 3;        // 한 번에 솟는 불기둥 수 (플레이어 자리 1개 + 근처)
const DEMON_PILLAR_SPREAD = 150;     // 플레이어 근처 이 거리 안에 솟음
const DEMON_PILLAR_TIME = 1.0;       // 경고 원이 차는 시간
const DEMON_PILLAR_RADIUS = 50;
const DEMON_PILLAR_DAMAGE = 16;
const DEMON_CHARGE_INTERVAL = 7;     // 화염 돌진 간격
const DEMON_CHARGE_WINDUP = 1.0;     // 멈춰서 번쩍이며 돌진 방향 띠가 차는 시간
const DEMON_CHARGE_SPEED = 700;      // 돌진 속도
const DEMON_CHARGE_TIME = 0.6;       // 돌진 시간 → 약 420px
const DEMON_TRAIL_GAP = 30;          // 돌진하며 이 거리마다 불길을 남김
const DEMON_TRAIL_RADIUS = 28;
const DEMON_TRAIL_LIFE = 3;          // 불길이 남는 시간 (초)
const DEMON_TRAIL_ARM = 0.3;
const DEMON_TRAIL_DAMAGE = 8;
const DEMON_METEOR_INTERVAL = 5;     // 체력 절반 이하: 운석 간격
const DEMON_METEOR_COUNT = 8;        // 한 번에 떨어지는 운석 수 (화면 여기저기)
const DEMON_METEOR_TIME = 1.0;       // 첫 운석이 떨어지기까지
const DEMON_METEOR_STAGGER = 0.2;    // 운석이 차례로 떨어지는 간격
const DEMON_METEOR_RADIUS = 55;
const DEMON_METEOR_DAMAGE = 16;
// --- 죽음의 기사 (저주받은 어둠 보스) 공격: 보라 경고가 먼저 차오른 뒤 터짐 ---
const KNIGHT_RGB = "180, 90, 255";   // 경고 색 (보라)
const KNIGHT_SLASH_INTERVAL = 3.5;   // 베기 간격
const KNIGHT_SLASH_WINDUP = 0.9;     // 멈춰서 부채꼴 경고가 차는 시간
const KNIGHT_SLASH_RANGE = 190;      // 부채꼴 길이
const KNIGHT_SLASH_SPREAD = 1.9;     // 부채꼴 벌어진 각도 (라디안, 약 110도)
const KNIGHT_SLASH_DAMAGE = 20;
const KNIGHT_TELE_INTERVAL = 8;      // 순간이동 내리찍기 간격
const KNIGHT_TELE_TIME = 1.0;        // 사라진 뒤 나타나기까지 (그동안 나타날 자리에 경고 원)
const KNIGHT_TELE_BEHIND = 90;       // 플레이어가 바라보는 쪽의 반대편 이 거리에 나타남
const KNIGHT_TELE_RADIUS = 80;
const KNIGHT_TELE_DAMAGE = 20;
const KNIGHT_CROSS_INTERVAL = 5;     // 체력 절반 이하: 십자 어둠 파동 간격 (4분의 1 이하면 대각선도)
const KNIGHT_CROSS_TIME = 1.1;
const KNIGHT_CROSS_LEN = 700;        // 기사 중심에서 띠가 뻗는 길이 (양쪽)
const KNIGHT_CROSS_HALF = 28;        // 띠 두께의 절반
const KNIGHT_CROSS_DAMAGE = 18;
const BOSS_FALL_TIME = 0.6;          // 떨어지는 공격(얼음덩이·고드름·운석): 터지기 전 이 시간 동안 물체가 떨어지는 그림
const BOSS_BURST_LIFE = 0.55;        // 악마·죽음의 기사 터짐 그림(reodesuxz burst_fire / burst_dark)이 재생되는 시간
const BOSS_BURST_SCALE = 1.22;       // reodesuxz 터짐 그림은 그림 속 원이 작아서 둥근 효과 크기의 이 배수로 그림
const DEMON_PILLAR_FX_LIFE = 0.6;    // 악마 불기둥 그림(reodesuxz pillar_fire)이 솟았다 꺼지는 시간
const KNIGHT_SLASH_FX_LIFE = 0.55;   // 죽음의 기사 베기 그림(IceMaan Dark Slash)이 재생되는 시간
const KNIGHT_CLOUD_LIFE = 0.6;       // 죽음의 기사가 사라진 자리에 저주 연기(cloud_curse)가 남는 시간
const KNIGHT_CLOUD_SIZE = 150;       // 저주 연기 크기
const KNIGHT_WAVE_GAP = 60;          // 십자 파동: 띠를 따라 이 거리마다 어둠 폭발
const KNIGHT_WAVE_SPEED = 1100;      // 십자 파동: 가운데에서 바깥으로 퍼지는 빠르기
const KNIGHT_WAVE_PUFF = 0.5;        // 십자 파동: 폭발 하나가 재생되는 시간
const KNIGHT_WAVE_SIZE = 110;        // 십자 파동: 폭발 하나의 크기
const BOSS_HP_PER_LEVEL = 120;       // 보스 체력 = 기본 + 플레이어 레벨 × 이 값 (강한 빌드일수록 보스도 튼튼하게)
const BOSS_FOCUS_RANGE = 450;        // 보스가 이 거리 안이면 자동 조준 무기가 부하 대신 보스를 노림
//   플레이어를 계속 쫓아오므로(플레이어보다 느림) 도망치며 싸우고, 가까이 오면 근접 무기로도 때릴 수 있음
const BOSS_SHOT_INTERVAL = 1.6;      // 부채꼴 발사 간격
const BOSS_SHOT_COUNT = 6;           // 부채꼴 한 번에 쏘는 탄환 수
const BOSS_RING_INTERVAL = 2.2;      // 사방 원형 발사 간격
const BOSS_RING_COUNT = 16;          // 사방 원형 한 번에 쏘는 탄환 수 (사이 틈으로 피할 수 있게)
const BOSS_SPIRAL_INTERVAL = 0.15;   // 회전 나선: 한 발씩 내보내는 간격
const BOSS_SPIRAL_TURN = 0.35;       // 회전 나선: 한 발마다 돌아가는 각도 (라디안)
const BOSS_SPIRAL_ARMS = 2;          // 회전 나선: 줄기 수 (서로 반대쪽)
const BOSS_SPIRAL_FAN_INTERVAL = 2.4; // 회전 나선 중에 섞어 쏘는 부채꼴 간격
const BOSS_BULLET_SPEED = 230;
const BOSS_BULLET_DAMAGE = 15;
const BOSS_SUMMON_INTERVAL = 12;     // 부하 소환 간격 (초)
const BOSS_SUMMON_COUNT = 4;         // 한 번에 소환하는 부하 수 (지금 단계의 몬스터)

// --- 몬스터 시간표 (원작처럼 레벨이 아니라 "시간"으로 바뀜): 각 단계가 시작되는 시각 (초, 30분 기준 → 실제로는 BOSS_TIME 에 맞춰 줄어듦) ---
//   0:00 박쥐 → 1:30 붉은 게 → 4:00 거미 → 7:00 유령 → 11:00 외눈 거인
//   → 15:00 박쥐(두 바퀴째: 더 강하고 경험치 2배) → 18:00 붉은 게 → 21:00 거미 → 24:00 유령 → 27:00 외눈 거인 → 30:00 보스
//   숫자를 고치면 등장 시각이 바뀌고, 칸을 더 적으면 세 바퀴째도 나옴 (ENEMY_TYPES 순서대로 돌아감)
const WAVE_START_TIMES = [0, 90, 240, 420, 660, 900, 1080, 1260, 1440, 1620];

// --- 새 몬스터가 서서히 등장하게 하는 값들 ---
//   새 단계가 시작된 직후엔 새 몬스터가 조금만 나오고, 시간이 지나면서 비율이 서서히 올라감
const NEW_ENEMY_SHARE_START = 0.15;  // 새 단계 직후 새 몬스터 비율 (15%)
const NEW_ENEMY_SHARE_MAX = 0.7;     // 다 올라왔을 때 새 몬스터 비율 (70%)
const NEW_ENEMY_RAMP_TIME = 15;      // START → MAX 까지 걸리는 시간 (초)
const PREV_MAIN_CHANCE = 0.7;        // 새 몬스터가 아닐 때, 바로 전 레벨의 주력 몬스터가 나올 확률 (나머지는 더 옛날 몬스터)

// --- 시간 보정 (원작처럼 플레이어 레벨과 무관): 게임 시간이 1분 지날 때마다 새로 나오는 적이 이만큼 강해짐 ---
//   레벨업을 빨리 해도 적이 덩달아 세지지 않음 → 빨리 크면 그만큼 유리함. 반대로 느리게 크면 시간에 쫓김
//   (보스 체력만 예외로 플레이어 레벨을 따라감. 원작도 보스는 그렇게 함)
const ENEMY_HP_PER_MINUTE_BASE = 0.14; // 체력: 1분마다 +14% (마지막엔 5.2배). 여기서 '1분'은 30분 기준의 1분
const ENEMY_HP_TIME_START = 300;     // 이 시간(초) 이후부터는 아래 값이 추가로 곱해짐 (무기가 쌓여 후반이 너무 쉬워지는 것 방지)
const ENEMY_HP_PER_MINUTE = 0.12;    // 그 뒤로 1분마다 체력 +12% 더 (마지막엔 4배 → 합쳐서 약 21배). 중반부터 쉬워지지 않게 0.07 → 0.12
const ENEMY_SPEED_PER_MINUTE = 0.03; // 속도: 1분마다 +3%
const ENEMY_SPEED_CAP = 1.3;         // 속도는 최대 1.3배까지만 (10분에 도달)
const ENEMY_DAMAGE_PER_MINUTE = 0.06; // 피해: 1분마다 +6%
const ENEMY_DAMAGE_CAP = 2.0;        // 피해는 최대 2배까지만 (중반 이후에도 계속 아파지게 1.6 → 2.0)

// --- 적 탄환 (사신 마법사가 씀) ---
const ENEMY_BULLET_RADIUS = 6;       // 적 탄환 크기

// --- 붉은 게 (돌진): 걷기 → 멈춰서 번쩍 → 돌진 을 반복 ---
const CHARGER_WALK_TIME = 3.0;       // 걷는 시간 (초)
const CHARGER_WINDUP_TIME = 0.5;     // 돌진 전 멈춰서 번쩍이는 시간
const CHARGER_DASH_TIME = 0.4;       // 돌진 시간
const CHARGER_DASH_SPEED = 300;      // 돌진 속도

const SHOW_BANNER = true;            // 화면 위 "새로운 적" 안내 문구를 띄울지 (false로 바꾸면 꺼짐)
const BANNER_TIME = 2.5;             // 안내 문구가 보이는 시간 (초)

// --- 엘리트 몬스터: 일정 시간마다 나오는 크고 강한 몬스터. 잡으면 보물 상자를 반드시 떨어뜨림 ---
//   그 시점의 주력 몬스터가 커진 모습으로 나오고, 금색 고리로 표시됨
const ELITE_INTERVAL = 60;           // 몇 초마다 엘리트가 나오는지
const ELITE_SIZE = 1.8;              // 크기 배수
const ELITE_HP = 12;                 // 체력 배수
const ELITE_DAMAGE = 1.5;            // 피해 배수
const ELITE_SPEED = 0.9;             // 속도 배수 (조금 느림)
const ELITE_XP = 5;                  // 구슬 경험치 배수

// --- 꽃 울타리: 정해진 시각(아래 '이벤트 시간표')에 식인꽃이 플레이어를 둥글게 에워싸고 천천히 조여 옴 (원작의 꽃 벽) ---
//   꽃은 "벽"이라서 몸으로 뚫고 지나갈 수 없음 → 몇 송이를 부숴서 틈을 내고 빠져나가야 함
//   일반 몬스터 목록에는 없고 이 이벤트로만 나옴. 시간으로는 시들지 않고, 끝까지 조여 오면(FLOWER_MIN_RADIUS) 그때 시들어 사라짐
const FLOWER_TYPE = { key: "flower", name: "식인꽃", shape: "flower", color: "#b565d8", r: 13, speed: 12, hp: 4, damage: 6, xp: 1, behavior: "ring" };
const FLOWER_RING_RADIUS = 600;      // 처음 에워싸는 원의 반지름 (화면 세로 절반 360 보다 커서, 위아래 꽃은 움직여야 보임)
const FLOWER_MIN_RADIUS = 140;       // 이만큼까지 조여 오면 시들어 사라짐 (600 → 140 까지 약 38초)
const FLOWER_GAP = 10;               // 꽃과 꽃 사이 틈 (플레이어 지름 28 보다 작아야 못 빠져나감)
const FLOWER_WAKE_TIME = 0.7;        // 막 피어날 때 번쩍이며 피해를 주지 않는 시간 (초)

// --- 몬스터 떼(박쥐·유령): 정해진 시각(아래 '이벤트 시간표')에 무리가 화면 한쪽에서 나타나 플레이어 쪽으로 곧장 가로질러 지나감 ---
//   플레이어를 쫓아오지 않고 처음 정한 방향으로만 날아감 → 옆으로 비키면 피할 수 있고, 길목에서 쓸어 담으면 경험치 잔치
//   일반 박쥐와 능력치는 같지만 훨씬 빠름. 화면을 지나가고 나면 저절로 사라짐
const SWARM_COUNT = 22;              // 처음 한 떼의 마릿수
const SWARM_COUNT_PER_MINUTE = 1.5;  // 1분 지날 때마다 늘어나는 마릿수
const SWARM_COUNT_MAX = 60;          // 한 떼의 최대 마릿수
const SWARM_SPEED = 175;             // 날아가는 속도 (플레이어 기본 속도 220 보다 느려서 옆으로 피할 수 있음)
const SWARM_START_DISTANCE = 820;    // 플레이어에게서 이만큼 떨어진 곳(화면 밖)에서 출발
const SWARM_LENGTH = 320;            // 무리의 길이 (진행 방향)
const SWARM_WIDTH = 170;             // 무리의 폭
const SWARM_LIFETIME = 14;           // 이 시간이 지나면 사라짐 (초). 화면을 다 지나가고도 남는 시간

// --- 이벤트 시간표: 원작 첫 스테이지(Mad Forest)의 시간표를 본뜸 (30분 기준 → 실제로는 BOSS_TIME 에 맞춰 줄어듦) ---
//   단, 게임이 짧아져도 처음 1분은 아무 이벤트도 없음 (eventTime 참고)
//   time   : 시작 시각 (초)          kind  : "swarm" 몬스터 떼 / "flower" 꽃 울타리
//   chance : 일어날 확률 (없으면 100%)   repeat: 몇 번 연달아 나오는지   delay : 그 사이 간격 (초)
//   type   : 떼의 몬스터 종류          count : 한 떼의 마릿수 (없으면 SWARM_COUNT 규칙)
//   delay 가 3초보다 짧으면 같은 방향으로 줄지어 나와 "강물"처럼 흐르고, 길면 매번 다른 방향에서 나옴
const EVENT_SCHEDULE = [
  { time:  1 * 60, kind: "swarm", type: "bat", repeat: 3, delay: 5 },                          //  1분: 첫 박쥐 떼 (3번)
  { time:  3 * 60, kind: "swarm", type: "bat", chance: 0.1, repeat: 2, delay: 5 },             //  3·4·6분: 가끔(10%)
  { time:  4 * 60, kind: "swarm", type: "bat", chance: 0.1, repeat: 2, delay: 5 },
  { time:  5 * 60, kind: "flower" },                                                            //  5분: 첫 꽃 울타리
  { time:  6 * 60, kind: "swarm", type: "bat", chance: 0.1, repeat: 2, delay: 5 },
  { time:  7 * 60, kind: "swarm", type: "bat", chance: 0.8, repeat: 6, delay: 5 },             //  7~9분: 박쥐 떼가 몰려 나오는 구간
  { time:  8 * 60, kind: "swarm", type: "bat", chance: 0.8, repeat: 3, delay: 15 },
  { time:  9 * 60, kind: "swarm", type: "bat", chance: 0.7, repeat: 3, delay: 15 },
  { time: 10 * 60, kind: "flower" },                                                            // 10분: 꽃 울타리
  { time: 11 * 60, kind: "swarm", type: "bat", chance: 0.1, repeat: 2, delay: 5 },
  { time: 12 * 60, kind: "swarm", type: "bat", chance: 0.1, repeat: 2, delay: 5 },
  { time: 13 * 60, kind: "swarm", type: "ghost", chance: 0.7, repeat: 12, delay: 1.5, count: 10 },   // 13분: 유령 떼가 줄지어
  { time: 15 * 60, kind: "flower", chance: 0.8 },                                               // 15분: 꽃 울타리 (80%)
  { time: 20 * 60, kind: "swarm", type: "bat", chance: 0.7, repeat: 14, delay: 1.5, count: 12 },     // 20분: 대규모 박쥐 떼
  { time: 25 * 60, kind: "flower", repeat: 2, delay: 10 },                                      // 25분: 꽃 울타리 두 겹 (10초 간격. 한 겹이 약 38초 버티므로 원작의 6번 대신 2번)
  { time: 27 * 60, kind: "swarm", type: "ghost", repeat: 12, delay: 3, count: 12 },             // 27분: 유령 떼
];

// --- 보물 상자: 열면 게임이 멈추고, 룰렛이 돈 뒤 가진 무기·능력이 자동으로 강화됨 ---
//   (일반 몬스터는 상자를 떨어뜨리지 않음. 엘리트와 미믹만 떨어뜨림)
const CHEST_LIFETIME = 30;           // 상자가 남아 있는 시간 (초). 지나면 사라짐
const CHEST_BLINK_TIME = 5;          // 사라지기 몇 초 전부터 깜빡일지
const CHEST_RADIUS = 14;             // 상자 크기 (몸이 닿으면 열림. 구슬처럼 끌려오지는 않음)
const CHEST_ROLL_TIME = 1.5;         // 룰렛이 도는 시간 (초)
// 상자 하나에서 나오는 강화 개수. weight = 나올 비중 (더하면 100 → % 로 읽으면 됨)
const CHEST_COUNTS = [
  { count: 1, weight: 75 },
  { count: 3, weight: 20 },
  { count: 5, weight: 5 },
];

// --- 바닥 아이템: 몬스터가 낮은 확률로 떨어뜨림. 닿으면 바로 발동 (구슬처럼 끌려오지는 않음) ---
const ITEM_DROP_CHANCE = 0.008;      // 몬스터를 잡을 때 아이템이 떨어질 확률 (0.8%). 클로버(패시브)가 있으면 더 자주
const ITEM_LIFETIME = 30;            // 아이템이 남아 있는 시간 (초)
const ITEM_RADIUS = 11;              // 아이템 크기
const ITEM_HEAL = 30;                // 회복 물약(초록) 회복량
const FREEZE_TIME = 10;              // 눈꽃: 적이 멈춰 있는 시간 (초)
const CROSS_ELITE_DAMAGE = 0.3;      // 해골: 엘리트는 죽지 않고 최대 체력의 30% 피해
const ITEM_TYPES = [
  // 그림만 봐도 뭔지 알 수 있게: 회복 = 초록 물약, 자석 = 말굽자석, 전멸 = 해골, 빙결 = 눈꽃
  { key: "heal",   weight: 45, sprite: "potion_green", text: "체력 +30",   color: "#7dffb0" },   // 체력 회복
  { key: "magnet", weight: 30, sprite: "item_magnet",  text: "자석!",       color: "#ff8a70" },   // 화면의 모든 구슬 흡수
  { key: "wipe",   weight: 4,  sprite: "item_wipe",    text: "전멸!",       color: "#ffffff" },   // 화면의 적 전멸 (가장 강력해서 가장 드묾)
  { key: "freeze", weight: 10, sprite: "item_freeze",  text: "빙결! (10초)", color: "#7df9ff" },   // 10초간 적 정지
];

// --- 미믹: 보물 상자인 척하는 몬스터 ---
//   20레벨부터, 떨어지는 상자 중 일부가 미믹. 닿으면 보상 대신 몬스터로 변해 덤벼듦
//   화면 위 안내 문구는 띄우지 않음 (몰래 섞여 나오는 게 재미)
//   구별법: 미믹 상자는 몇 초에 한 번씩 살짝 떨림
//   보상: 미믹을 잡으면 진짜 상자를 반드시 떨어뜨림
const MIMIC_MIN_LEVEL = 20;          // 이 레벨부터 미믹이 섞여 나옴
const MIMIC_CHANCE = 0.25;           // 상자가 미믹일 확률 (25%)
const MIMIC_WAKE_TIME = 0.6;         // 정체를 드러낸 뒤 움직이기까지 걸리는 시간 (초). 이동안은 닿아도 피해 없음
const MIMIC_TYPE = { key: "mimic", name: "미믹", shape: "mimic", color: "#c8793f", r: 15, speed: 95, hp: 12, damage: 15, xp: 8, behavior: "chase" };

// --- 이펙트 (보기 좋으라고 넣는 연출, 게임 규칙에는 영향 없음) ---
const HIT_FLASH_TIME = 0.08;         // 맞은 적이 흰색으로 번쩍이는 시간 (초)
const HIT_SPARKS = 3;                // 맞을 때 튀는 불꽃 수
const DEATH_PARTICLES = 10;          // 죽을 때 퍼지는 파편 수
const PARTICLE_MAX = 300;            // 화면에 동시에 있을 수 있는 파편 최대 수 (너무 많으면 느려짐)
const BULLET_TRAIL = 0.04;           // 탄환 꼬리 길이 (초 단위: 이 시간 동안 날아온 거리만큼). 꼬리는 trail: true 인 탄만 그림
