// =====================================================================
// 1. 준비물: 도화지, 붓, 화면 요소 가져오기
// =====================================================================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");          // ctx = 도형을 그리는 붓
const gameoverBox = document.getElementById("gameover");
const resultText = document.getElementById("result");
const restartBtn = document.getElementById("restart");
const levelupBox = document.getElementById("levelup");
const levelTitle = document.getElementById("levelTitle");
const levelText = document.getElementById("levelText");
const choicesBox = document.getElementById("choices");
const rerollBtn = document.getElementById("reroll");
const skipBtn = document.getElementById("skipBtn");
const chestBox = document.getElementById("chestBox");
const chestStage = document.getElementById("chestStage");   // 상자 연출 무대 (빛기둥·금화·보상 구슬·큰 상자)
const chestOrbs = document.getElementById("chestOrbs");
const chestCoins = document.getElementById("chestCoins");
const chestImg = document.getElementById("chestImg");
const chestGold = document.getElementById("chestGold");     // 위쪽 금화 숫자 (금화가 섞였을 때만)
const chestGoldNum = document.getElementById("chestGoldNum");
const chestInfo = document.getElementById("chestInfo");     // 아래 칸: 고른 보상의 이름·설명
const chestOk = document.getElementById("chestOk");
const clearBox = document.getElementById("clearBox");
const stageClear = document.getElementById("stageClear");   // 보스를 잡으면 잠깐 뜨는 STAGE CLEAR 글자
const clearText = document.getElementById("clearText");
const helpBtn = document.getElementById("helpBtn");
const helpBox = document.getElementById("helpBox");
const helpList = document.getElementById("helpList");
const helpClose = document.getElementById("helpClose");
const candyBox = document.getElementById("candyBox");
const candyList = document.getElementById("candyList");
const candyTitle = document.getElementById("candyTitle");
const titleOverlay = document.getElementById("titleOverlay");
const titleText = document.getElementById("titleText");
const startBtn = document.getElementById("startBtn");
const introBtn = document.getElementById("introBtn");
const introClose = document.getElementById("introClose");

const W = canvas.width;    // 화면(도화지) 가로 (1280) ← 크기를 바꾸려면 위쪽 <canvas> 태그의 숫자를 고치면 됨
const H = canvas.height;   // 화면(도화지) 세로 (720)

// 휴대폰은 화면이 작아서 캐릭터·적이 너무 작게 보임 → 휴대폰에서만 카메라를 당겨서(확대) 크게 보여 줌
//   ZOOM 배만큼 크게 보이는 대신, 한 화면에 들어오는 맵은 그만큼 좁아짐 (VW × VH = 화면에 보이는 맵 크기)
//   태블릿은 화면이 커서 제외 (화면의 짧은 쪽이 600 미만인 터치 기기만 휴대폰으로 봄)
const PHONE_ZOOM = 1.4;    // 휴대폰 확대 배수 (올리면 더 크게 보이지만 시야가 좁아져 어려워짐)
const ZOOM = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 600 ? PHONE_ZOOM : 1;
const VW = W / ZOOM;       // 화면에 보이는 맵 가로 (PC 1280, 휴대폰 약 914)
const VH = H / ZOOM;       // 화면에 보이는 맵 세로 (PC 720, 휴대폰 약 514)

// =====================================================================
// 1-0. 큰 맵과 카메라
//   맵(월드)은 화면보다 훨씬 크고, 카메라가 플레이어를 화면 가운데에 두고 따라다님
//   → 게임 안의 모든 위치(플레이어, 적, 발사체 ...)는 "월드 좌표"이고,
//     그릴 때만 카메라 위치만큼 옮겨서(ctx.translate) 화면에 보이는 부분을 그림
// =====================================================================
const WORLD_W = 5760;      // 맵 가로 (화면의 4.5배. 예전 3840 의 1.5배)
const WORLD_H = 3264;      // 맵 세로 (예전 2160 의 1.5배 = 3240 을 타일 48 의 배수로 맞춤)
const BG_SCALE = 3;        // 배경 그림은 맵의 1/3 크기로 만들어 두고 3배로 늘려 그림 (타일 원본이 16픽셀이라 모양은 똑같고, 메모리는 1/9)
                           //   맵 전체 크기 그대로 만들면 휴대폰(특히 아이폰)의 그림 크기 한도를 넘어서 바닥이 안 나옴
const WALL_SIZE = 48;      // 맵 경계 돌담 두께 (장식용. 실제로 못 나가게 막는 건 좌표 제한)

const cam = { x: 0, y: 0 };   // 카메라 왼쪽 위 모서리의 월드 좌표

// 카메라를 플레이어 가운데로. 맵 가장자리에서는 멈춰서 맵 밖(검은 곳)이 안 보이게
function updateCamera() {
  cam.x = Math.max(0, Math.min(WORLD_W - VW, player.x - VW / 2));
  cam.y = Math.max(0, Math.min(WORLD_H - VH, player.y - VH / 2));
}

// (x, y) 가 지금 화면(카메라 사각형) 안에 있는지. margin 만큼 여유를 둠
function inView(x, y, margin = 0) {
  return x > cam.x - margin && x < cam.x + VW + margin && y > cam.y - margin && y < cam.y + VH + margin;
}

// 화면(카메라 사각형) 바깥 가장자리의 무작위 위치 (적·엘리트 생성용)
//   맵 경계 밖은 안 되므로, 맵 안에 들어오는 변만 골라서 씀
function randomEdgePosition(margin) {
  const candidates = [
    { x: cam.x + Math.random() * VW, y: cam.y - margin },          // 위
    { x: cam.x + Math.random() * VW, y: cam.y + VH + margin },     // 아래
    { x: cam.x - margin,             y: cam.y + Math.random() * VH },// 왼쪽
    { x: cam.x + VW + margin,        y: cam.y + Math.random() * VH },// 오른쪽
  ].filter((p) => p.x >= 0 && p.x <= WORLD_W && p.y >= 0 && p.y <= WORLD_H);
  if (candidates.length === 0) return { x: cam.x + Math.random() * VW, y: cam.y - margin };   // 맵이 화면보다 작을 때 (안 생김)
  return candidates[Math.floor(Math.random() * candidates.length)];
}

// =====================================================================
// 1-1. 픽셀아트 그림 불러오기 (assets 폴더, Kenney "Tiny Dungeon" CC0)
//   SPRITES.ghost.normal = 원래 그림,  SPRITES.ghost.white = 흰색 실루엣 (맞았을 때 번쩍임용)
//   그림이 아직 안 불러와졌거나 파일이 없으면 ready 가 false → 대신 단색 원으로 그림
// =====================================================================
// 그림 주소에 붙일 버전: index.html 이 이 파일을 부를 때 붙인 ?v= 값을 그대로 씀 (올릴 때 index.html 의 ?v= 만 바꾸면 됨)
const ASSET_VERSION = new URL(document.currentScript.src).searchParams.get("v") || "";
const assetUrl = (name) => `assets/${name}.png${ASSET_VERSION ? `?v=${ASSET_VERSION}` : ""}`;
const SPRITE_NAMES = ["fx_slash", "fx_bolt", "fx_star", "fx_ray", "fx_flame", "fx_blast", "fx_fireball", "fx_claw", "fx_zap", "fx_parry", "fx_shock", "fx_firering", "fx_burn", "hazard_puddle1", "hazard_puddle2", "hazard_puddle3", "hero_mage", "hero_hunter", "hero_berserker", "hero_saint", "hero_armorer", "ghost", "bat", "cyclops", "spider", "wizard", "crab", "flower", "icewisp", "polarbear", "iceelem", "frostwight", "wendigo", "yeti", "hellhound", "muck", "chest", "chest_open", "mimic", "potion_green", "item_magnet", "item_wipe", "item_freeze",
                      "dagger", "axe", "spear", "firebomb", "staff", "shield",
                      "hammer", "shield_throw", "wand", "sword", "rock", "rock2", "bigsword",
                      "w_aura", "w_firewand", "w_rune", "w_lightning", "w_pentagram", "w_clock", "w_icebeam", "w_bloodsword", "w_shadow", "w_bone", "w_flames", "w_bomb", "boss_shuriken",
                      // 패시브 아이템 아이콘 (Kenney "1-Bit Pack" CC0)
                      "passive_might", "passive_armor", "passive_maxhp", "passive_regen", "passive_cooldown", "passive_area",
                      "passive_projspeed", "passive_duration", "passive_amount", "passive_move", "passive_magnet", "passive_luck",
                      "passive_growth", "passive_curse", "passive_revival", "passive_choices"];
// 난이도 테마 (어려움 = 얼음 동굴, 매우 어려움 = 용암 굴, 지옥 = 저주받은 어둠): 적 그림을 테마 색으로 바꾼 것. 예: bat_ice.png
//   파일이 없거나 아직 못 불러왔으면 원래 그림으로 그림 (drawEnemy 참고)
const THEME_KEYS = ["ice", "lava", "dark"];
const THEMED_SPRITES = ["bat", "crab", "spider", "ghost", "cyclops", "flower", "wizard"];
for (const theme of THEME_KEYS) for (const name of THEMED_SPRITES) SPRITE_NAMES.push(`${name}_${theme}`);
const SPRITES = {};
for (const name of SPRITE_NAMES) {
  const sprite = { ready: false, normal: new Image(), white: null };
  sprite.normal.onload = () => {
    // 흰색 실루엣 만들기: 그림을 그린 뒤, 그림이 있는 부분만 흰색으로 덮음
    const c = document.createElement("canvas");
    c.width = sprite.normal.width;
    c.height = sprite.normal.height;
    const cctx = c.getContext("2d");
    cctx.drawImage(sprite.normal, 0, 0);
    cctx.globalCompositeOperation = "source-in";
    cctx.fillStyle = "#fff";
    cctx.fillRect(0, 0, c.width, c.height);
    sprite.white = c;
    sprite.ready = true;
  };
  sprite.normal.src = assetUrl(name);
  SPRITES[name] = sprite;
}
ctx.imageSmoothingEnabled = false;   // 픽셀아트를 키워도 뿌옇게 번지지 않게

// =====================================================================
// 1-2. 던전 바닥 배경: 처음에 한 번만 큰 그림으로 만들어 두고, 매 프레임 그 한 장만 그림
//   (타일 수백 장을 매번 그리면 느려지므로)
// =====================================================================
const FLOOR_PLAIN = "floor_plain";                        // 민무늬 바닥 (대부분)
const FLOOR_EXTRAS = ["floor_holes", "floor_pebbles"];    // 구멍·자갈 바닥 (가끔 섞임)
const FLOOR_TILE_SIZE = 48;      // 바닥 타일 한 칸 크기 (16픽셀 그림을 3배로)
const FLOOR_EXTRA_CHANCE = 0.06; // 구멍·자갈 무늬가 나올 확률
const FLOOR_EXTRA_ALPHA = 0.30;  // 구멍·자갈 무늬의 진하기 (너무 또렷하면 물체처럼 보여서 옅게 얹음)
const BG_DIM = 0.62;             // 바닥을 어둡게 누르는 정도 (0~1). 올리면 공격·이펙트가 더 잘 보임

let background = null;           // 완성된 배경 그림 (준비 전에는 null → 단색 배경이 보임)
let vignetteLayer = null;        // 화면 가장자리를 어둡게 하는 막 (화면 크기, 한 번만 만듦)
const floorImages = {};
let floorLoaded = 0;
for (const name of [FLOOR_PLAIN, ...FLOOR_EXTRAS, "wall"]) {
  const img = new Image();
  img.onload = () => {
    floorLoaded += 1;
    if (floorLoaded === 2 + FLOOR_EXTRAS.length) buildBackground();   // 전부 불러와지면 배경 만들기
  };
  img.src = assetUrl(name);
  floorImages[name] = img;
}
// 난이도 테마용 바닥·벽 그림 (예: floor_plain_ice.png). 늦게 불러와져도 지금 테마의 그림이면 배경을 다시 만듦
let bgTheme = null;              // 지금 배경에 깔린 테마 (null = 기본 던전)
for (const theme of THEME_KEYS) {
  for (const name of [FLOOR_PLAIN, ...FLOOR_EXTRAS, "wall"]) {
    const img = new Image();
    img.onload = () => { if (bgTheme === theme) rebuildBackground(); };
    img.src = assetUrl(`${name}_${theme}`);
    floorImages[`${name}_${theme}`] = img;
  }
}
// 지금 테마의 바닥 그림 (없거나 아직 못 불러왔으면 기본 그림)
function floorImage(name) {
  const themed = bgTheme && floorImages[`${name}_${bgTheme}`];
  return themed?.complete && themed.naturalWidth > 0 ? themed : floorImages[name];
}
// 배경 테마 바꾸기 (판을 시작할 때, 시작 화면에서 난이도를 고를 때)
function setBackgroundTheme(theme) {
  if (bgTheme === (theme || null)) return;
  bgTheme = theme || null;
  if (floorLoaded >= 2 + FLOOR_EXTRAS.length) buildBackground();
}

// 구멍·자갈 무늬 자리를 정하는 씨앗: 배경을 다시 만들어도 같은 자리에 같은 무늬가 나오게 한 번만 뽑아 둠
const floorSeed = Math.floor(Math.random() * 2147483647) + 1;

function buildBackground() {
  const c = document.createElement("canvas");
  c.width = WORLD_W / BG_SCALE;
  c.height = WORLD_H / BG_SCALE;
  const b = c.getContext("2d");
  b.imageSmoothingEnabled = false;
  b.scale(1 / BG_SCALE, 1 / BG_SCALE);            // 아래는 전부 맵 좌표로 적고, 실제로는 1/3 크기로 그려짐
  let seed = floorSeed;
  const rand = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };   // 씨앗으로 만드는 0~1 난수

  // (1) 바닥 타일 깔기: 민무늬 + 가끔 옅은 구멍·자갈 무늬 + 바둑판 음영
  for (let y = 0; y < WORLD_H; y += FLOOR_TILE_SIZE) {
    for (let x = 0; x < WORLD_W; x += FLOOR_TILE_SIZE) {
      b.drawImage(floorImage(FLOOR_PLAIN), x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);

      // 가끔 구멍·자갈 무늬를 민무늬 위에 옅게 얹음
      if (rand() < FLOOR_EXTRA_CHANCE) {
        const name = FLOOR_EXTRAS[Math.floor(rand() * FLOOR_EXTRAS.length)];
        b.globalAlpha = FLOOR_EXTRA_ALPHA;
        b.drawImage(floorImage(name), x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
        b.globalAlpha = 1;
      }

      // 바둑판처럼 한 칸 걸러 아주 살짝 어둡게 → 타일 바닥 느낌
      if ((x / FLOOR_TILE_SIZE + y / FLOOR_TILE_SIZE) % 2 === 0) {
        b.fillStyle = "rgba(0, 0, 0, 0.10)";
        b.fillRect(x, y, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE);
      }
    }
  }

  // (2) 어두운 남색 막을 덮어 바닥을 차분하게 누름 → 공격·이펙트·구슬이 묻히지 않게
  b.fillStyle = `rgba(18, 18, 32, ${BG_DIM})`;
  b.fillRect(0, 0, WORLD_W, WORLD_H);

  // (3) 맵 경계 돌담: 가장자리에 한 줄 (여기가 맵 끝이라는 표시)
  const wall = floorImage("wall");
  if (wall) {
    for (let x = 0; x < WORLD_W; x += WALL_SIZE) {
      b.drawImage(wall, x, 0, WALL_SIZE, WALL_SIZE);
      b.drawImage(wall, x, WORLD_H - WALL_SIZE, WALL_SIZE, WALL_SIZE);
    }
    for (let y = 0; y < WORLD_H; y += WALL_SIZE) {
      b.drawImage(wall, 0, y, WALL_SIZE, WALL_SIZE);
      b.drawImage(wall, WORLD_W - WALL_SIZE, y, WALL_SIZE, WALL_SIZE);
    }
  }
  background = c;

  // (4) 비네트: 화면 크기로 따로 만들어 두고 매 프레임 맨 위에 덮음 (카메라가 움직여도 항상 화면 가장자리가 어둡게)
  const v = document.createElement("canvas");
  v.width = W;
  v.height = H;
  const vc = v.getContext("2d");
  const vignette = vc.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75);
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.55)");
  vc.fillStyle = vignette;
  vc.fillRect(0, 0, W, H);
  vignetteLayer = v;

  // 브라우저가 이 큰 그림을 지웠다가 되살리면(되살아난 그림은 빈 그림) 다시 만듦
  c.addEventListener("contextrestored", rebuildBackground);
}

// 휴대폰은 다른 앱에 갔다 오면 메모리를 아끼려고 큰 그림(맵 전체 배경)을 지워 버릴 수 있음 → 바닥이 사라짐
//   그래서 화면이 다시 보일 때마다 배경을 새로 만들고, 멈춰 있는 화면이면 한 번 다시 그림
function rebuildBackground() {
  if (floorLoaded < 2 + FLOOR_EXTRAS.length) return;   // 그림을 아직 다 못 불러왔으면 불러온 뒤에 알아서 만들어짐
  buildBackground();
  if (state !== "title" && state !== "intro" && state !== "playing") draw();   // 멈춘 화면은 저절로 다시 그려지지 않음
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") rebuildBackground();
});
