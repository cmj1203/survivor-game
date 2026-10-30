// =====================================================================
// 15. 시작 화면: 게임을 켜면 가장 먼저 보이는 창. '게임 시작'(또는 Enter)을 누르면 resetGame 으로 진짜 게임 시작
// =====================================================================
//   배경은 캔버스에 계속 그림 (titleLoop): 던전 바닥이 느리게 흘러가고, 기사가 한가운데 서 있고, 몬스터들이 사방에서 몰려옴
//   제목·버튼은 HTML (#titleOverlay) 이 그 위에 얹힘
const TITLE_MONSTERS = ["bat", "crab", "spider", "ghost", "cyclops", "bat", "spider", "bat"];   // 시작 화면에 돌아다니는 몬스터 (박쥐가 많게)
const TITLE_MONSTER_COUNT = 22;
document.getElementById("titleVersion").textContent = ASSET_VERSION ? `v${ASSET_VERSION}` : "";   // 시작 화면 오른쪽 아래 버전 (index.html 의 ?v= 값)
let titleScene = null;      // { t, monsters[] }  시작 화면 애니메이션 상태
let titleLastTime = null;

// 제목 글자: 작은 캔버스에 16px 로 찍고 가장자리를 딱딱하게 자른 다음(안티에일리어싱 제거) 4배로 확대 → 진짜 픽셀 계단이 보임
//   큰 글자를 바로 그리면 바라우저가 가장자리를 부드럽게 뭉개서 픽셀 글꼴이어도 그냥 둥그런 글자처럼 보임
const TITLE_TEXT = "DUNGEON SURVIVOR";
const TITLE_FONT_PX = 20;      // 이 크기로 찍음. Tiny5 는 5px 격자 글꼴이라 5의 배수(15, 20, 25...)로 찍어야 픽셀 두께가 고릅다 (16 이면 들왟날왟)
const TITLE_SCALE = 4;         // 확대 배수
let titleTextDrawn = false;

function drawTitleText(family) {
  const font = `400 ${TITLE_FONT_PX}px ${family}`;   // Tiny5 는 굵기가 400 하나뿐
  const probe = document.createElement("canvas").getContext("2d");
  probe.font = font;
  const pad = 3;                                                     // 테두리(1) + 그림자(2) 자리
  const w0 = Math.ceil(probe.measureText(TITLE_TEXT).width) + pad * 2 + 1;   // 일단 넉넉히 찍을 크기 (+1 은 아래 '굵게' 처리가 오른쪽으로 1px 늨어나는 분). 아래에서 글자 범위만 잘라 쓰임
  const h0 = Math.ceil(TITLE_FONT_PX * 1.6) + pad * 2;

  // (1) 작은 캔버스에 흰색으로 찍고, 알파 50% 기준으로 "글자 픽셀인지" 마스크를 만듦
  const raw = document.createElement("canvas");
  raw.width = w0; raw.height = h0;
  const rc = raw.getContext("2d");
  rc.font = font; rc.textBaseline = "top"; rc.fillStyle = "#fff";
  rc.fillText(TITLE_TEXT, pad, pad);
  const src = rc.getImageData(0, 0, w0, h0).data;
  const m0 = new Uint8Array(w0 * h0);
  for (let i = 0; i < w0 * h0; i++) m0[i] = src[i * 4 + 3] >= 128 ? 1 : 0;
  // 굵게: 글자 픽셀을 오른쪽으로 1px 복제해 확 두께를 1 → 2px 로 (픽셀 게임에서 볼드 글자 만드는 방식). Tiny5 는 확이 1px 이라 그대로 키우면 가느다다
  for (let y = 0; y < h0; y++) for (let x = w0 - 1; x > 0; x--) if (m0[y * w0 + x - 1]) m0[y * w0 + x] = 1;
  // 글자가 실제로 차지하는 범위를 재서 위아래 믹 여백을 잘라냄 (글꼴이 잡는 줄 높이는 글자보다 훨씬 컬서, 안 자르면 글자가 작게 보임)
  let top = h0, bottom = -1, left = w0, right = -1;
  for (let y = 0; y < h0; y++) for (let x = 0; x < w0; x++) {
    if (!m0[y * w0 + x]) continue;
    if (y < top) top = y; if (y > bottom) bottom = y; if (x < left) left = x; if (x > right) right = x;
  }
  if (bottom < 0) return;                                            // 글꼴이 아직 안 있어서 아무것도 안 찍혔으면 그리지 않음
  const w = right - left + 1 + pad * 2, h = bottom - top + 1 + pad * 2;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = x - pad + left, sy = y - pad + top;
    if (sx < 0 || sy < 0 || sx >= w0 || sy >= h0) continue;
    mask[y * w + x] = m0[sy * w0 + sx];
  }
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const sc = small.getContext("2d");

  // (2) 마스크로 그림자(오른쪽 아래 2px, 검정) → 테두리(1px 팽창, 검정) → 글자(노랑) 순으로 찍음
  const out = sc.createImageData(w, h);
  const o = out.data;
  const put = (x, y, r, g, b) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const k = (y * w + x) * 4;
    o[k] = r; o[k + 1] = g; o[k + 2] = b; o[k + 3] = 255;
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) { put(x + 1, y + 1, 0, 0, 0); put(x + 2, y + 2, 0, 0, 0); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) put(x + dx, y + dy, 0, 0, 0);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x]) put(x, y, 255, 214, 10);
  sc.putImageData(out, 0, 0);

  // (3) 보여줄 캔버스에 네배로 확대 (부드럽게 만들기 금지 → 픽셀이 그대로 네모네모하게)
  titleText.width = w * TITLE_SCALE; titleText.height = h * TITLE_SCALE;
  const tc = titleText.getContext("2d");
  tc.imageSmoothingEnabled = false;
  tc.drawImage(small, 0, 0, titleText.width, titleText.height);
}

// 픽셀 글꼴이 온 뒤에 그림. 3초 안에 안 오면(오프라인 등) 기본 글꼴로라도 그림
function prepareTitleText() {
  if (titleTextDrawn) return;
  titleTextDrawn = true;
  const family = '"Tiny5"';
  const fallback = new Promise((resolve) => setTimeout(() => resolve("timeout"), 3000));
  drawTitleText("sans-serif");                                        // 우선 기본 글꼴로 한 번 (번짓하게 보이는 것보단 낫다)
  Promise.race([document.fonts.load(`400 ${TITLE_FONT_PX}px ${family}`), fallback])
    .then((r) => { if (r !== "timeout") drawTitleText(family); })
    .catch(() => {});
}

function showTitle() {
  state = "title";
  helpBtn.style.display = "none";          // 게임이 없으니 ? 버튼도 숨김 (무기 보유 표시가 플레이어 정보를 쓰기 때문)
  titleOverlay.classList.remove("intro", "panel");
  titleOverlay.style.display = "flex";
  pauseBtn.style.display = "none";
  hudStats.style.display = "none";
  soundBtn.style.left = "16px";
  refreshSpeedBtn(false);                  // 시작 화면에서는 배속 버튼 숨김
  setMusic("title");
  setBackgroundTheme((DIFFS[meta.diff] || DIFFS[0]).theme);   // 시작 화면 배경 = 고른 난이도의 장소
  refreshTitleMenu();
  prepareTitleText();
  titleScene = { t: 0, monsters: [] };
  for (let i = 0; i < TITLE_MONSTER_COUNT; i++) titleScene.monsters.push(newTitleMonster(true));
  titleLastTime = null;
  requestAnimationFrame(titleLoop);
}

// 몬스터 하나 만들기: 화면 바깥 가장자리에서 한가운데(기사) 쪽으로 느리게 기어옴. 기사 근처까지 오면 사라지고 다시 바깥에서 나옴
//   scatter = true 이면 처음부터 화면 여기저기 흩어진 상태로 시작 (처음 화면이 훑하지 않게)
function newTitleMonster(scatter) {
  const type = TITLE_MONSTERS[Math.floor(Math.random() * TITLE_MONSTERS.length)];
  const a = Math.random() * Math.PI * 2;
  const far = Math.hypot(W, H) * 0.55;
  const dist = scatter ? 220 + Math.random() * (far - 220) : far;
  return {
    type, a, dist,
    speed: 28 + Math.random() * 30,                        // 화보면 오는 속도 (느릿하게)
    size: type === "cyclops" ? 30 : type === "bat" ? 16 : 20,
    wobble: Math.random() * Math.PI * 2,
  };
}

// 시작 화면 몬스터 그림: 고른 난이도(장소)의 같은 자리 적 (얼음 동굴이면 박쥐 자리 = 얼음 정령). 전용 적이 없는 장소는 테마 색 그림
//   그릴 때마다 정하므로 난이도를 바꾸면 돌아다니던 몬스터도 바로 바뀜
function titleMonsterSprite(baseKey) {
  const theme = (DIFFS[meta.diff] || DIFFS[0]).theme;
  const stage = STAGE_ENEMIES[theme];
  if (stage) return stage[ENEMY_TYPES.findIndex((t) => t.key === baseKey)].shape;
  return theme && SPRITES[`${baseKey}_${theme}`]?.ready ? `${baseKey}_${theme}` : baseKey;
}

function titleLoop(now) {
  if (state !== "title" && state !== "intro") return;   // 게임이 시작되면 이 루프는 조용히 종료
  if (titleLastTime === null) titleLastTime = now;
  let dt = (now - titleLastTime) / 1000;
  titleLastTime = now;
  if (dt > 0.1) dt = 0.1;
  titleScene.t += dt;

  for (const m of titleScene.monsters) {
    m.dist -= m.speed * dt;
    m.wobble += dt * 3;
    if (m.dist < 150) Object.assign(m, newTitleMonster(false));   // 기사 앞까지 오면 바깥에서 다시 등장
  }
  drawTitleScene();
  requestAnimationFrame(titleLoop);
}

function drawTitleScene() {
  const t = titleScene.t;
  const cx = W / 2, cy = H / 2 - 10;   // 기사 자리: 제목(위)과 버튼(아래) 사이 한가운데
  ctx.clearRect(0, 0, W, H);

  // (1) 던전 바닥: 맵 한가운데를 느리게 대각선으로 흘러가게 보여줌 (단순히 짜르는 위치만 움직임)
  if (background) {
    const sx = (WORLD_W - W) / 2 + Math.sin(t * 0.15) * 120;
    const sy = (WORLD_H - H) / 2 + Math.cos(t * 0.11) * 80;
    drawFloor(sx, sy, W, H, 0, 0);
  }

  // (2) 몰려오는 몬스터 (기사보다 어둡게, 멀수록 더 어둡게 → 기사가 돋보임)
  for (const m of titleScene.monsters) {
    const x = cx + Math.cos(m.a) * m.dist;
    const y = cy + Math.sin(m.a) * m.dist + Math.sin(m.wobble) * (m.type === "bat" ? 8 : 3);
    const far = Math.hypot(W, H) * 0.55;
    ctx.globalAlpha = 0.45 + 0.4 * (1 - m.dist / far);
    drawSprite(titleMonsterSprite(m.type), x, y, m.size * SPRITE_SCALE, { flip: x > cx });
  }
  ctx.globalAlpha = 1;

  // (3) 가운데 밝은 원: 몬스터와 기사 사이에 공간감 (연한 금색 바닥무늬)
  const glow = ctx.createRadialGradient(cx, cy + 10, 10, cx, cy + 10, 200);
  glow.addColorStop(0, "rgba(255, 214, 10, 0.16)");
  glow.addColorStop(1, "rgba(255, 214, 10, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(cx, cy + 10, 200, 0, Math.PI * 2); ctx.fill();

  // (4) 기사: 한가운데에 크게. 숨 쉬듯 위아래로 살짝 움직임. 발밑에 그림자
  const bob = Math.sin(t * 2.2) * 4;
  ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
  ctx.beginPath(); ctx.ellipse(cx, cy + 54, 40, 11, 0, 0, Math.PI * 2); ctx.fill();
  drawSprite(CHARACTERS[meta.char].sprite, cx, cy + bob, 56, { flip: Math.sin(t * 0.7) < 0 });

  // (5) 기사 주위를 도는 무기 3개 (게임 안의 도끼 무기처럼). 기사(반지름 56)에 맞춰 절반 조금 넘는 크기
  //   그림이 기사와 겹치지 않게: 기사 56 + 무기 32 = 88 이상 떨어져야 함 → 굤도의 가장 가까운 지점(위·아래, 세로 반지름)이 딱 88
  const orbit = ["sword", "axe", "wand"];
  const ORBIT_RX = 160, ORBIT_RY = 88;
  for (let i = 0; i < orbit.length; i++) {
    const a = t * 1.6 + (Math.PI * 2 * i) / orbit.length;
    drawSprite(orbit[i], cx + Math.cos(a) * ORBIT_RX, cy + Math.sin(a) * ORBIT_RY, 32, { angle: a + Math.PI / 2 });
  }

  // (6) 가장자리 어둡게 + 위아래 띠(글자 자리)는 더 어둡게
  if (vignetteLayer) ctx.drawImage(vignetteLayer, 0, 0);
  const band = ctx.createLinearGradient(0, 0, 0, H);
  band.addColorStop(0, "rgba(0, 0, 0, 0.72)");
  band.addColorStop(0.30, "rgba(0, 0, 0, 0.12)");
  band.addColorStop(0.60, "rgba(0, 0, 0, 0.12)");
  band.addColorStop(1, "rgba(0, 0, 0, 0.80)");
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, W, H);
}

// 휴대폰: 주소창을 없애고 화면을 가로로 고정 (안드로이드 크롬만 됨. 아이폰 사파리는 지원 안 해서 조용히 넘어감)
//   버튼을 누른 순간에만 부를 수 있음. 다른 앱에 갔다 오면 전체 화면이 풀리므로 '이어 하기'·'계속하기'에서도 다시 부름
function enterFullscreen() {
  if (IS_TOUCH && document.documentElement.requestFullscreen && !document.fullscreenElement) {
    document.documentElement.requestFullscreen()
      .then(() => { pauseForFullscreenHint(); return screen.orientation?.lock?.("landscape"); })
      .catch(() => {});
  }
}

// force = true 면 경고 없이 바로 시작 (경고 창에서 '새로 시작'을 눌렀을 때)
function startGame(force) {
  if (storyScene) return;
  const saved = force === true ? null : loadRun();
  if (saved) {
    // 하던 판이 있으면 바로 시작하지 않고 먼저 물어봄 (새로 시작하면 그 판이 지워지므로)
    const who = (CHARACTERS[saved.char] || CHARACTERS.knight).name, where = (DIFFS[saved.diff | 0] || DIFFS[0]).name;
    document.getElementById("newGameText").textContent = `하던 판이 있어요: ${who} · ${where} · ${formatTime(saved.stats.time)} 버팀. 새로 시작하면 이 판은 사라져요.`;
    newGameBox.style.display = "flex";
    return;
  }
  newGameBox.style.display = "none";
  enterFullscreen();
  const storyBit = 1 << Object.keys(CHARACTERS).indexOf(meta.char);
  if (!(meta.stats.mask_story & storyBit)) showStory(meta.char, beginRun);
  else beginRun();   // 이미 본 스토리는 다시 띄우지 않음. 중간에 닫거나 그림을 못 받은 스토리는 다음 시작 때 재생
}

// 안드로이드는 처음 전체 화면이 될 때 "전체 화면 모드 · 확인" 창을 띄우는데, '확인'을 누를 때까지 게임을 가림
//   → 이 기기에서 처음 전체 화면이 될 때 게임이 돌고 있으면 멈추고 안내 (한 번 본 뒤로는 멈추지 않음. 저장이 막힌 브라우저는 페이지마다 한 번)
//   시작 스토리를 보는 중이면 그 창은 스토리 위에 뜨고, 스토리를 넘기려면 먼저 '확인'을 눌러야 하므로 게임이 시작될 때 다시 멈추지 않음
//   (첫 판이 0초에 안내로 멈추지 않게. 이어 하기는 원래 멈춘 채로 시작함)
const FS_HINT_KEY = "dungeon-survivor-fs-hint";
let fsHintShownThisPage = false;
function pauseForFullscreenHint() {
  let seen = fsHintShownThisPage;
  try { seen = seen || localStorage.getItem(FS_HINT_KEY) === "1"; localStorage.setItem(FS_HINT_KEY, "1"); } catch {}
  fsHintShownThisPage = true;
  if (!seen) pauseGame("전체 화면 안내 창이 뜨면 '확인'을 누른 뒤 계속하기를 눌러 주세요");
}

function openIntro() {
  state = "intro";
  titleOverlay.classList.add("intro");       // 제목·버튼 대신 설명판이 보임 (배경 애니메이션은 계속)
}

function closeIntro() {
  state = "title";
  titleOverlay.classList.remove("intro", "panel");
  refreshTitleMenu();
}

startBtn.addEventListener("click", () => startGame());
const newGameBox = document.getElementById("newGameBox");
document.getElementById("newGameYes").addEventListener("click", () => startGame(true));
document.getElementById("newGameNo").addEventListener("click", () => { newGameBox.style.display = "none"; });
document.getElementById("newGameContinue").addEventListener("click", () => { newGameBox.style.display = "none"; continueRun(); });
introBtn.addEventListener("click", openIntro);
introClose.addEventListener("click", closeIntro);
