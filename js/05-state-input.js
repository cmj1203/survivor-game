// =====================================================================
// 3. 게임이 기억해야 할 것들 (상태)
// =====================================================================
let player;        // 플레이어 정보 (위치, 체력, 레벨, 무기, 패시브 등)
let enemies;       // 적 목록
let pendingSpawns; // 이번 프레임에 새로 생긴 적 (거미의 새끼). 프레임 끝에 enemies에 합침
let enemyBullets;  // 마법사가 쏜 탄환 목록
let bossMarks;     // 보스 공격 경고 원 목록 (시간이 다 되면 그 자리에서 터짐. 예티 등)
let banner;        // 화면 위 안내 문구 { text, life }
let bullets;       // 발사체 목록 (탄환, 창, 폭탄 모두 여기)
let gems;          // 경험치 구슬 목록
let chests;        // 바닥에 떨어진 보물 상자 목록
let items;         // 바닥에 떨어진 아이템(물약) 목록
let zones;         // 바닥에 남아 피해를 주는 지역 목록 (화염병 불바다 등)
let hazards;       // 적이 남긴 위험한 자국 목록 (난이도 테마: 외눈 거인이 죽은 자리. 밟고 있으면 플레이어가 느려짐)
let enemyFires;    // 적이 바닥에 남긴 불 목록 (불 원소 웅덩이·불타는 해골 꼬리·악마 돌진 불길. 밟으면 피해)
let eliteTimer;    // 다음 엘리트가 나올 때까지 남은 시간
let eventIndex;    // 이벤트 시간표에서 다음에 확인할 칸
let eventQueue;    // 지금 진행 중인 이벤트 (연달아 나오는 중인 것)
let boss;          // 마지막 보스 (나타나기 전에는 null)
let freezeTimer;   // 남은 빙결 시간 (0보다 크면 모든 적이 멈춤)
let chestRoll;     // 상자 룰렛 진행 정보 (열려 있지 않으면 null)
let floatTexts;    // 위로 떠오르며 사라지는 글씨 목록 (상자 보상 안내)
let effects;       // 폭발·고리 같은 잠깐 보이는 연출 목록
let particles;     // 작은 파편 목록 (피격 불꽃, 처치 파편)
let stats;         // 생존 시간, 처치 수
let state;         // "title", "intro", "playing", "levelup", "chest", "candy", "help", "gameover", "clear"
let spawnTimer;    // 다음 적 생성까지 남은 시간
let lastTime;      // 이전 프레임 시각 (dt 계산용)
let loopId = 0;    // 예약해 둔 게임 루프 프레임 번호 (재개할 때 옛 예약을 지워 루프가 두 개 돌지 않게)
let nextEnemyId;   // 적마다 붙이는 고유 번호

const keys = {};   // 지금 눌려 있는 키 목록. 예: keys["w"] === true

// =====================================================================
// 4. 처음 상태로 되돌리기 (시작할 때 + 재시작할 때 호출)
// =====================================================================
function resetGame() {
  player = {
    x: WORLD_W / 2,           // 맵 한가운데에서 시작
    y: WORLD_H / 2,
    r: PLAYER_RADIUS,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    invincible: 0,            // 남은 무적 시간
    facingLeft: false,        // 왼쪽을 보고 있는지 (그림 좌우 뒤집기용)
    facingX: 1, facingY: 0,   // 바라보는 방향 (마지막 이동 방향, 길이 1). 단검·장검가 씀
    // --- 강화로 바뀌는 값들 ---
    speed: PLAYER_SPEED,
    damage: 1,
    attackSpeed: 1,           // 발동 간격에 곱함 (작을수록 빠름)
    pickupRadius: PICKUP_RADIUS,
    choices: START_CHOICES,   // 레벨업 때 나오는 카드 수
    // --- 패시브 아이템: 시작은 없음. { type: "luck", level: 1 } 형태로 쌓임 ---
    passives: [],
    revivesUsed: 0,           // 부활을 몇 번 썼는지
    // --- 레벨 ---
    level: 1,
    xp: 0,
    xpNeed: xpNeedFor(1),
    stageChangedAt: 0,        // 마지막으로 새 몬스터가 열린 시각 (새 몬스터 비율 계산용)
    enemyStage: 0,            // 지금 몬스터 단계 (시간표에서 몇 번째 칸인지)
    // --- 무기: 시작은 마법봉(자동 조준)만. 단검은 바라보는 방향으로만 나가서 시작 무기로는 어려움 ---
    weapons: [{ type: CHARACTERS[meta.char].weapon, level: 1, timer: 0 }],   // 캐릭터마다 시작 무기가 다름
  };
  enemies = [];
  pendingSpawns = [];
  enemyBullets = [];
  bossMarks = [];
  banner = null;
  bullets = [];
  gems = [];
  chests = [];
  items = [];
  zones = [];
  hazards = [];
  enemyFires = [];
  eliteTimer = ELITE_INTERVAL;
  eventIndex = 0;
  eventQueue = [];
  boss = null;
  freezeTimer = 0;
  cancelChestRoll();
  floatTexts = [];
  effects = [];
  particles = [];
  stats = { time: 0, kills: 0 };
  state = "playing";
  spawnTimer = SPAWN_START;
  lastTime = null;
  nextEnemyId = 1;
  endJoystick();                         // 손가락을 댄 채로 끝난 판의 조이스틱이 새 판에 남지 않게
  startRun();                            // 다회차: 캐릭터·난이도·상점 강화 적용, 이번 판 기록 시작

  gameoverBox.style.display = "none";
  pauseBox.style.display = "none";
  pauseBtn.style.display = "";
  hudStats.style.display = "flex";
  soundBtn.style.left = "128px";
  refreshSpeedBtn(true);                   // 1.5배속을 샀으면 소리 버튼 옆에 배속 버튼   // 팝업 창 숨기기
  levelupBox.style.display = "none";
  chestBox.style.display = "none";
  clearBox.style.display = "none";
  stageClear.classList.remove("show");
  helpBox.style.display = "none";
  candyBox.style.display = "none";
  titleOverlay.style.display = "none";     // 시작 화면 숨기기 (시작 화면 애니메이션은 state 가 바뀜서 저절로 뱈침)
  helpBtn.style.display = "";             // 시작 화면에서 숨겼던 ? 버튼 다시 보이기
  updateCamera();
  cancelAnimationFrame(loopId);
  loopId = requestAnimationFrame(gameLoop);      // 게임 루프 시작
}

// =====================================================================
// 5. 키보드 입력 기억하기
// =====================================================================
// WASD 는 "입력된 글자"가 아니라 "키보드에서의 위치"(e.code)로 알아냄
//   → 한글 입력 상태(W 를 누르면 'ㅈ' 이 들어옴)나 Caps Lock 이 켜져 있어도 똑같이 동작
const KEY_POSITIONS = { KeyW: "w", KeyA: "a", KeyS: "s", KeyD: "d", KeyH: "h", KeyM: "m", KeyP: "p" };

function keyName(e) {
  return KEY_POSITIONS[e.code] || (e.key || "").toLowerCase();
}

window.addEventListener("keydown", (e) => {
  const name = keyName(e);
  if (name === "m" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) { toggleSound(); return; }   // M: 소리 켜기/끄기 (어느 화면에서나)
  // 시작 화면: Enter 로 시작. 설명 창이 떠 있으면 Enter/Esc 로 닫기. 그 외 키는 무시 (게임이 아직 없음)
  if (state === "title") { if (name === "enter") startGame(); else if (name === "escape") newGameBox.style.display = "none"; return; }   // Esc: 새로 시작 경고 창 닫기
  if (state === "intro") { if (name === "enter" || name === "escape") { e.preventDefault(); closeIntro(); } return; }   // preventDefault: 포커스가 남은 '게임 설명' 버튼이 Enter 로 다시 눌려 창이 또 열리지 않게
  if (state === "paused") { if ((name === "escape" || name === "p" || name === "enter") && !e.repeat) resumeFromPause(); return; }
  if (state === "playing" && (name === "escape" || name === "p") && !e.repeat) { pauseGame("일시정지"); return; }
  if (name === "h" && !e.repeat) { toggleHelp(); return; }          // H: 도움말 열기/닫기
  if (name === "escape" && state === "help") { toggleHelp(); return; }
  // Cmd/Ctrl/Alt 와 함께 누른 키는 단축키이므로 무시
  //   → 맥은 Cmd 를 누른 채 누른 키의 "뗌" 신호를 안 보내서, 기억해 두면 영원히 눌린 걸로 남음
  if (e.metaKey || e.ctrlKey || e.altKey) {
    for (const k in keys) keys[k] = false;
    return;
  }
  keys[name] = true;
  // 방향키를 누르면 페이지가 스크롤되는 걸 막음
  if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(name)) {
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  const name = keyName(e);
  // Cmd/Ctrl/Alt 를 떼는 순간에도 전부 초기화 (그 사이 놓친 "뗌" 신호 대비)
  if (["meta", "control", "alt"].includes(name)) {
    for (const k in keys) keys[k] = false;
    return;
  }
  keys[name] = false;
});
// 창을 벗어났다 돌아오면 "눌린 채로 남은 키"가 없게 초기화 (혼자 계속 걸어가는 것 방지)
window.addEventListener("blur", () => {
  for (const k in keys) keys[k] = false;
  endJoystick();
});

// =====================================================================
// 5-1. 휴대폰(터치) 조작: 화면 아무 곳에 손가락을 대면 그 자리에 조이스틱이 생기고, 끄는 방향으로 이동
// =====================================================================
const IS_TOUCH = matchMedia("(pointer: coarse)").matches;   // 휴대폰·태블릿 (터치 화면 노트북은 마우스가 주 입력이라 제외)
if (IS_TOUCH) document.documentElement.classList.add("touch");
const stage = document.getElementById("stage");
const joyBase = document.getElementById("joyBase");
const joyKnob = document.getElementById("joyKnob");
const JOY_RADIUS = 36;      // 손잡이가 움직일 수 있는 최대 거리 (화면 px). 작을수록 조금만 끌어도 방향이 바뀜
const JOY_DEADZONE = 4;     // 이보다 조금 움직이면 무시 (손가락 떨림)
let joystick = null;        // { id, ox, oy, dx, dy }  누르고 있지 않으면 null

function placeJoy(el, x, y) { el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.display = "block"; }

function endJoystick() {
  joystick = null;
  joyBase.style.display = joyKnob.style.display = "none";
}

// 지금 조이스틱이 가리키는 방향 (안 누르고 있거나 너무 조금 끌었으면 null)
function joystickDir() {
  if (!joystick) return null;
  const len = Math.hypot(joystick.dx, joystick.dy);
  return len < JOY_DEADZONE ? null : { x: joystick.dx / len, y: joystick.dy / len };
}

// 손가락 위치(휴대폰 화면 기준)를 게임 화면(#stage) 안쪽 좌표로 바꿈
//   세로로 들어서 게임이 시계 방향 90도 돌아가 있으면: 게임의 오른쪽 = 화면 아래쪽, 게임의 아래쪽 = 화면 왼쪽
function touchToStage(t) {
  const r = stage.getBoundingClientRect();     // 돌아간 상태에서는 화면에 보이는 (세로로 긴) 네모
  if (isPortraitTouch()) return { x: t.clientY - r.top, y: r.right - t.clientX };
  return { x: t.clientX - r.left, y: t.clientY - r.top };
}

stage.addEventListener("touchstart", (e) => {
  if (e.target.closest("button, .meta-panel, input, label")) return;      // 판 안은 손가락으로 스크롤되게 + ? 버튼·시작 버튼은 그대로 눌리게
  e.preventDefault();
  if (state !== "playing" || joystick) return;
  const t = e.changedTouches[0];
  const p = touchToStage(t);
  joystick = { id: t.identifier, ox: p.x, oy: p.y, dx: 0, dy: 0 };
  placeJoy(joyBase, joystick.ox, joystick.oy);
  placeJoy(joyKnob, joystick.ox, joystick.oy);
}, { passive: false });

stage.addEventListener("touchmove", (e) => {
  if (e.target.closest(".meta-panel")) return;       // 시작 화면의 판(상점·퀘스트·캐릭터) 안은 손가락으로 스크롤되게
  e.preventDefault();
  if (!joystick) return;
  for (const t of e.changedTouches) {
    if (t.identifier !== joystick.id) continue;
    const p = touchToStage(t);
    let dx = p.x - joystick.ox, dy = p.y - joystick.oy;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      // 손가락이 원 밖으로 나가면 조이스틱 중심이 손가락을 따라옴 → 멀리 끌고 간 뒤에도 조금만 되돌리면 바로 방향이 바뀜
      const over = (len - JOY_RADIUS) / len;
      joystick.ox += dx * over; joystick.oy += dy * over;
      dx *= JOY_RADIUS / len; dy *= JOY_RADIUS / len;
      placeJoy(joyBase, joystick.ox, joystick.oy);
    }
    joystick.dx = dx; joystick.dy = dy;
    placeJoy(joyKnob, joystick.ox + dx, joystick.oy + dy);
  }
}, { passive: false });

function onTouchEnd(e) {
  if (!joystick) return;
  for (const t of e.changedTouches) if (t.identifier === joystick.id) endJoystick();
}
stage.addEventListener("touchend", onTouchEnd);
stage.addEventListener("touchcancel", onTouchEnd);

// 휴대폰을 세로로 들고 있는지 (그러면 CSS 가 게임 화면 전체를 90도 돌려서 보여줌)
const portraitQuery = matchMedia("(orientation: portrait)");
function isPortraitTouch() { return IS_TOUCH && portraitQuery.matches; }

// 팝업 창 배율: 기본 창 크기(약 800×560)가 안 들어가는 작은 화면이면 그만큼 줄임 (돌아가 있으면 가로·세로를 바꿔서 잼)
function fitUi() {
  const w = isPortraitTouch() ? innerHeight : innerWidth;
  const h = isPortraitTouch() ? innerWidth : innerHeight;
  const z = Math.min(1, w / 800, h / 560);
  document.documentElement.style.setProperty("--ui-zoom", z.toFixed(3));
}
fitUi();
window.addEventListener("resize", () => {
  fitUi();
  endJoystick();      // 폰을 돌리는 중에 누르고 있던 조이스틱은 위치가 어긋나므로 놓은 것으로 침
});
