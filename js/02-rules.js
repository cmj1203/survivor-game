// =====================================================================
// 2. 게임 규칙 숫자들 (여기 값만 바꿔도 난이도 조절 가능)
//    ※ 강화로 바뀌는 값은 "기본값"이고, 실제로는 player 안의 값을 씀
// =====================================================================
const PLAYER_SPEED = 220;        // 플레이어 기본 속도 (1초에 몇 픽셀)
const PLAYER_RADIUS = 14;        // 플레이어 원의 반지름
const PLAYER_MAX_HP = 120;       // 기본 최대 체력
const INVINCIBLE_TIME = 0.8;     // 맞은 뒤 무적 시간 (초). 길수록 몰렸을 때 덜 아픔

// --- 전체 난이도: 이 숫자 하나로 게임 전체가 쉬워지거나 어려워짐 (1 = 기본, 1.5 = 1.5배 어려움) ---
//   모든 몬스터(꽃·미믹·엘리트·보스 포함)의 체력·피해, 보스 탄환 피해, 몬스터가 나오는 빈도에 곱해짐
const DIFFICULTY = 1.5;

// ※ 적의 속도·체력·피해는 아래 2-3번 구역 ENEMY_TYPES 표에 있음
// --- 몬스터 생성 속도: 시간이 지날수록 빨라짐 ---
//   생성 간격이 SPAWN_START 에서 시작해 SPAWN_RAMP_TIME 초에 걸쳐 SPAWN_MIN 까지 서서히 줄어듦
//   그 뒤로는 한 번에 두 마리씩 나올 확률이 천천히 올라가서 후반에도 계속 압박이 커짐
const SPAWN_START = 0.8;         // 처음 적 생성 간격 (초)
const SPAWN_MIN = 0.25;          // 최소 생성 간격 (초)
const SPAWN_RAMP_TIME = 600;     // 최소 간격에 도달하기까지 걸리는 시간 (초, 30분 기준 → 실제로는 BOSS_TIME 에 맞춰 줄어듦)
const SPAWN_DOUBLE_TIME = 300;   // 최소 간격 도달 후, 한 번에 나오는 수가 +1 되기까지 걸리는 시간 (초, 30분 기준). 중반부터 5분마다 +1마리 → 마지막엔 한 번에 5마리
const MAX_ENEMIES = 3000;        // 몬스터 수 제한은 사실상 없음. 이 값은 컴퓨터가 멈추는 것만 막는 안전장치 (측정: 2,500마리에서도 프레임당 3.5ms 로 여유)
const WEAPON_LEVEL_DAMAGE = 0.2; // 무기를 1레벨 강화할 때마다 그 무기의 피해 +20%
const MAX_WEAPONS = 6;           // 가질 수 있는 무기 수 (원작과 같음). 다 차면 '새 무기' 카드가 안 나옴

const BULLET_SPEED = 450;        // 단검 속도
const BULLET_RADIUS = 6;         // 단검이 맞는 범위 (그림 크기에 맞춰 4 → 6)

// --- 경험치 / 레벨 ---
const GEM_RADIUS = 6;            // 경험치 구슬 크기
const PICKUP_RADIUS = 40;        // 구슬을 빨아들이는 거리 (기본값)
// 필요 경험치 = XP_BASE + XP_GROWTH × (레벨-1) + XP_CURVE × (레벨-1)²
//   → 10, 16, 24, 34, 46, 60 ... 갈수록 가파르게 늘어남
const XP_BASE = 10;              // 1레벨 → 2레벨 필요 경험치
const XP_GROWTH = 5;             // 레벨마다 늘어나는 양
const XP_CURVE = 1;              // 레벨이 높을수록 더 가파르게 만드는 값
const WEAPON_MAX_LEVEL = 8;      // 무기 최대 레벨 (원작과 같음)
const GEM_PULL_SPEED = 150;      // 구슬이 끌려오기 시작할 때 속도 (px/초)
const GEM_PULL_ACCEL = 900;      // 끌려오는 구슬이 1초마다 빨라지는 양
const MAGNET_MAX = 5;            // 자석(패시브)의 최대 레벨 (원작과 같음)
const START_CHOICES = 3;         // 레벨업 카드 수 (처음)
const PASSIVE_MAX_SLOTS = 6;     // 가질 수 있는 패시브 아이템 수 (원작과 같음)
