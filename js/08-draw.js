// =====================================================================
// 11. 화면에 그리기
// =====================================================================
function draw() {
  ctx.clearRect(0, 0, W, H);   // 이전 프레임 지우기

  // --- 여기부터는 월드 좌표: 카메라 위치만큼 옮겨서 그림 ---
  ctx.save();
  ctx.scale(ZOOM, ZOOM);                                   // 휴대폰: 확대 (PC 는 1배라 그대로)
  ctx.translate(-Math.round(cam.x), -Math.round(cam.y));
  drawBackground();
  drawFloorZones();
  drawPickups();
  drawEffects();
  drawProjectiles();
  drawEnemyLayer();
  drawPlayer();
  drawFloatTexts();

  // 체력·경험치바 (캐릭터 머리 위를 따라다님)
  drawPlayerBars();

  ctx.restore();
  // --- 여기부터는 화면 좌표 (카메라와 상관없이 항상 같은 자리) ---

  if (vignetteLayer) ctx.drawImage(vignetteLayer, 0, 0);   // 화면 가장자리 어둡게

  // 보유한 무기·방어구 목록 (화면 오른쪽에 아이콘으로 세로 나열)
  drawOwnedList();

  // 화면 밖에 있는 보물 상자를 가리키는 화살표 (화면 가장자리에)
  drawChestArrows();

  drawBossBar();
  drawBanner();

  updateHudStats();
}

// 던전 바닥 그림 그리기 (지금 화면에 보이는 부분만)
function drawBackground() {
  if (background) {
    // 던전 바닥: 지금 화면에 보이는 부분만 그림 (확대했을 때 가장자리가 비지 않게 올림) + 보이는 가장자리 돌담
    const sx = Math.round(cam.x), sy = Math.round(cam.y), vw = Math.ceil(VW), vh = Math.ceil(VH);
    drawFloor(sx, sy, vw, vh, sx, sy);
    drawWalls(sx, sy, vw, vh);
  }
}

// 바닥에 깔리는 위험한 자국과 불바다 그리기
function drawFloorZones() {
  // 난이도 테마 · 위험한 자국 (외눈 거인이 죽은 자리): 테마 색 원. 준비 중엔 테두리만 깜빡이고, 그 뒤엔 속이 차서 일렁임
  //   자리를 잡은 뒤에는 웅덩이 그림(Ian926 "Pixel Art Puddles", 회색으로 바꿔 둔 것)을 테마의 보색으로 칠해 깔음
  for (const h of hazards) {
    const fade = Math.min(1, h.life / 0.6);                       // 사라지기 직전엔 옅어짐
    const puddle = h.arm > 0 ? null : puddleImage(1 + (Math.floor(Math.abs(h.x + h.y)) % 3));
    if (puddle) {
      const w = h.r * 2 * HAZARD_PUDDLE_WIDTH, ph = (w * puddle.height) / puddle.width;
      ctx.globalAlpha = HAZARD_PUDDLE_ALPHA * fade;
      ctx.drawImage(puddle, h.x - w / 2, h.y - ph / 2, w, ph);
      ctx.globalAlpha = 1;
      continue;
    }
    ctx.lineWidth = 3;
    ctx.strokeStyle = themeColor(0.9 * fade);
    ctx.beginPath();
    ctx.arc(h.x, h.y, h.r, 0, Math.PI * 2);
    if (h.arm > 0) {
      if (Math.floor(h.arm * 12) % 2 === 0) ctx.stroke();
    } else {
      ctx.fillStyle = themeColor((0.28 + 0.1 * Math.sin(stats.time * 8 + h.x)) * fade);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 보스(예티) 공격 경고 원: 얼음색 원 + 안에서 차오르는 원 (다 차면 그 자리에서 터짐). 웬디고의 빨간 원과 구분되게
  //   땅 내리치기(spikes)는 테두리 대신 원 둘레에 얼음 가시가 차례로 솟음
  for (const m of bossMarks) {
    const p = 1 - Math.max(0, m.time) / m.maxTime;
    ctx.fillStyle = "rgba(160, 230, 255, 0.15)";
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
    ctx.fill();
    if (!m.spikes) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(190, 240, 255, 0.7)";
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(160, 230, 255, 0.28)";
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.r * p, 0, Math.PI * 2);
    ctx.fill();
    if (m.spikes) drawIceSpikes(m.x, m.y, m.r, p, 1);
  }

  // 웬디고가 떨어질 자리: 빨간 원 (안쪽 원이 다 차면 착지) + 가운데 빨간 발톱 자국
  for (const e of enemies) {
    if (!e.leap) continue;
    const r = LEAP_RADIUS * (e.elite ? 1.4 : 1), p = Math.min(1, e.leap.t / LEAP_TIME);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 70, 70, 0.9)";
    ctx.fillStyle = "rgba(255, 70, 70, 0.12)";
    ctx.beginPath();
    ctx.arc(e.leap.tx, e.leap.ty, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "rgba(255, 70, 70, 0.28)";
    ctx.beginPath();
    ctx.arc(e.leap.tx, e.leap.ty, r * p, 0, Math.PI * 2);
    ctx.fill();
    if (SPRITES.fx_leapclaw.ready) {
      const s = (LEAP_CLAW_SIZE * r) / LEAP_RADIUS;
      ctx.drawImage(SPRITES.fx_leapclaw.normal, e.leap.tx - s / 2, e.leap.ty - s / 2, s, s);
    }
  }

  // 바닥 지역: 불바다 (일렁이는 주황 원)
  for (const z of zones) {
    const t = z.life / z.maxLife;
    if (z.kind === "shadow") {
      // 그림자 발톱의 흔적: 어두운 보라 원
      ctx.fillStyle = `rgba(60, 30, 90, ${0.55 * t})`;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    // 불바다: 가장자리에 불꽃 고리(Fire Ring) + 안쪽에 바닥 불꽃(Burning Ground) 몇 개. 둘 다 계속 일렁임
    ctx.globalAlpha = 0.9 * Math.min(1, t * 3);
    const ring = z.r * FX_BURST_SIZE;
    drawFxFrame("fx_firering", fxLoopFrame("fx_firering", z.x), z.x, z.y, ring, ring);
    const flames = Math.max(2, Math.round(z.r / 25));
    for (let k = 0; k < flames; k++) {
      const a = (k / flames) * Math.PI * 2 + z.x, d = z.r * 0.4;
      drawFxFrame("fx_burn", fxLoopFrame("fx_burn", z.y + k * 5), z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, z.r * 0.9, z.r * 0.9);
    }
    ctx.globalAlpha = 1;
  }
}

// 외눈 거인 자국 웅덩이: 회색 그림에 테마의 보색을 곱해 칠한 것 (테마·모양마다 한 번만 만들어 둠)
const HAZARD_PUDDLE_WIDTH = 1.1;   // 웅덩이 그림 너비 = 자국 지름 × 이 값 (그림이 가로로 길쭉함)
const HAZARD_PUDDLE_ALPHA = 0.5;   // 웅덩이 진하기 (바닥이 비쳐 보이게)
// 웅덩이 색: 바닥에서 잘 보이게 테마 색의 보색을 진하게 (용암 주황 → 파랑, 어둠 보라 → 연두). 얼음 동굴은 웬디고의 얼음 장판이라 밝은 얼음색
const HAZARD_PUDDLE_COLORS = { ice: "185, 240, 255", lava: "30, 120, 255", dark: "110, 230, 30" };
const puddleCache = {};
function puddleImage(n) {
  const sp = SPRITES[`hazard_puddle${n}`];
  if (!sp.ready) return null;
  const key = `${diffDef().theme}-${n}`;
  if (!puddleCache[key]) {
    const c = document.createElement("canvas");
    c.width = sp.normal.width;
    c.height = sp.normal.height;
    const g = c.getContext("2d");
    g.drawImage(sp.normal, 0, 0);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = `rgb(${HAZARD_PUDDLE_COLORS[diffDef().theme] || "255, 255, 255"})`;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "destination-in";    // 칠한 색을 그림 모양으로 다시 잘라냄
    g.drawImage(sp.normal, 0, 0);
    puddleCache[key] = c;
  }
  return puddleCache[key];
}

// 바닥에 떨어진 것 그리기 (경험치 구슬, 아이템, 보물 상자)
function drawPickups() {
  // 경험치 구슬 (도트로 찍은 입체 초록 마름모, 끌려오는 중이면 밝아짐 → gemImage)
  for (const g of gems) {
    const im = gemImage(g.r, g.speed > 0);
    ctx.drawImage(im, Math.round(g.x - im.width / 2), Math.round(g.y - im.height / 2));
  }

  // 바닥 아이템 (어두운 원판 + 그림. 사라지기 직전엔 깜빡임)
  //   경험치 구슬보다 나중에 그려서, 구슬 더미에 묻히지 않고 항상 위에 보이게 함 (보물 상자도 마찬가지)
  for (const it of items) {
    const blinkOff = it.life < CHEST_BLINK_TIME && Math.floor(it.life * 6) % 2 === 0;
    if (blinkOff) continue;
    ctx.fillStyle = "rgba(18, 14, 26, 0.88)";          // 어두운 원판: 밝은 구슬 더미 위에서도 그림이 또렷하게 보임
    ctx.strokeStyle = it.type.color;                   // 테두리는 아이템 색 (회복 초록, 자석 빨강, 전멸 흰색, 빙결 하늘색)
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(it.x, it.y, it.r * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (!drawSprite(it.type.sprite, it.x, it.y, it.r * SPRITE_SCALE)) {
      ctx.fillStyle = it.type.color;                   // 그림이 없을 때: 색깔 원
      ctx.beginPath();
      ctx.arc(it.x, it.y, it.r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 보물 상자 (금빛 테두리 원 위에 상자 그림. 사라지기 직전엔 깜빡임)
  for (const c of chests) {
    const blinkOff = c.life < CHEST_BLINK_TIME && Math.floor(c.life * 6) % 2 === 0;
    if (blinkOff) continue;
    ctx.fillStyle = "rgba(255, 214, 10, 0.18)";
    ctx.strokeStyle = "rgba(255, 214, 10, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 미믹 상자는 2.5초에 한 번씩 0.3초 동안 살짝 떨림 (눈썰미가 좋으면 구별 가능)
    let shake = 0;
    if (c.mimic) {
      const phase = (stats.time + c.seed) % 2.5;
      if (phase < 0.3) shake = Math.sin(phase * 70) * 1.5;
    }
    if (!drawSprite("chest", c.x + shake, c.y, c.r * SPRITE_SCALE)) {
      ctx.fillStyle = "#c8793f";                       // 그림이 없을 때: 갈색 네모
      ctx.fillRect(c.x - c.r, c.y - c.r * 0.7, c.r * 2, c.r * 1.4);
    }
  }
}

// 연출 그리기 (종류마다 맞는 함수로 나눠 그림)
function drawEffects() {
  // 연출: 폭발(주황 원이 점점 옅어짐) / 처치 고리(바깥으로 퍼지며 옅어짐)
  for (const f of effects) {
    const t = f.life / f.maxLife;          // 1 → 0 으로 줄어듦
    if (f.fx) {
      // 그림으로 그리는 폭발·고리 (fx = 그림 이름). 고리는 예전처럼 r 보다 조금 크게 퍼진 크기로
      const size = (f.kind === "ring" ? f.r + 22 : f.r) * FX_BURST_SIZE;
      drawFxSprite(f.fx, f.x, f.y, size, size, t);
    } else if (f.kind === "icespikes") {
      drawIceSpikes(f.x, f.y, f.r, 1, t);   // 예티 땅 내리치기 뒤 둘레 가시가 옅어짐
    } else if (f.kind === "chest") {
      // 열린 상자가 잠깐 남았다가 옅어지며 사라짐
      ctx.globalAlpha = t;
      drawSprite("chest_open", f.x, f.y, CHEST_RADIUS * SPRITE_SCALE);
      ctx.globalAlpha = 1;
    } else if (f.kind === "slash") {
      drawSlashEffect(f, t);
    } else if (f.kind === "bolt") {
      drawBoltEffect(f, t);
    } else if (f.kind === "flash") {
      // 별의 문양: 화면 전체가 하얗게 번쩍
      ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * t})`;
      ctx.fillRect(cam.x, cam.y, W, H);
    } else if (f.kind === "star") {
      drawStarEffect(f, t);
    } else if (f.kind === "cone") {
      drawConeEffect(f, t);
    } else if (f.kind === "ray") {
      drawRayEffect(f, t);
    } else if (f.kind === "beam") {
      drawBeamEffect(f, t);
    } else if (f.kind === "ring") {
      ctx.globalAlpha = t;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r + (1 - t) * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(${f.rgb || "144, 224, 239"}, ${0.55 * t})`;   // 기본은 하늘색, 화염병은 주황색
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 장검 휘두르기 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
//   그림: assets/fx_slash.png = IceMaan "Pixel VFX Essentials" Slash Right (32×32 6프레임, 오른쪽을 향한 초승달)
const FX_SLASH_FRAMES = 6;
const FX_SLASH_REACH = 15 / 32;   // 그림 한 변 대비 가운데에서 초승달 바깥 끝까지의 거리 → 이 끝이 공격 범위(r)에 닿게 크기를 맞춤
const FX_SLASH_THIN = 0.5;        // 초승달 두께 배수: 휘두르는 방향(반지름 쪽)으로만 눌러 얇게. 길이는 그대로
function drawSlashEffect(f, t) {
  const sp = SPRITES.fx_slash;
  if (!sp.ready) return;
  const frame = Math.min(FX_SLASH_FRAMES - 1, Math.floor((1 - t) * FX_SLASH_FRAMES));
  const size = f.r / FX_SLASH_REACH;
  ctx.save();
  ctx.translate(f.x, f.y);
  ctx.rotate(f.angle);
  ctx.translate(f.r * (1 - FX_SLASH_THIN), 0);   // 누른 만큼 앞으로 밀어서 바깥 끝이 그대로 r 에 닿게
  ctx.scale(FX_SLASH_THIN, 1);
  ctx.drawImage(sp.normal, frame * 32, 0, 32, 32, -size / 2, -size / 2, size, size);
  ctx.restore();
}

// IceMaan "Pixel VFX Essentials" 효과 그림(32×32 프레임 가로 띠) 한 장면 그리기. 남은 시간 비율 t(1 → 0)에 맞춰 앞 프레임부터 차례로
//   w, h = 그릴 크기, angle = 돌릴 각도, (ax, ay) = 그림에서 (x, y) 자리에 놓일 점 (0~1, 기본은 가운데)
function drawFxSprite(name, x, y, w, h, t, angle = 0, ax = 0.5, ay = 0.5) {
  const sp = SPRITES[name];
  if (!sp.ready) return;
  const frames = sp.normal.width / 32;
  drawFxFrame(name, Math.min(frames - 1, Math.floor((1 - t) * frames)), x, y, w, h, angle, ax, ay);
}
// 계속 반복되는 효과(불바다 등)의 지금 프레임. phase 로 같은 그림끼리 박자를 어긋나게 함
const FX_LOOP_FPS = 12;
function fxLoopFrame(name, phase) {
  const sp = SPRITES[name];
  return sp.ready ? Math.floor(stats.time * FX_LOOP_FPS + Math.abs(phase)) % (sp.normal.width / 32) : 0;
}
// 효과 그림의 frame 번째 칸 하나 그리기
function drawFxFrame(name, frame, x, y, w, h, angle = 0, ax = 0.5, ay = 0.5) {
  const sp = SPRITES[name];
  if (!sp.ready) return;
  ctx.save();
  ctx.translate(x, y);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(sp.normal, frame * 32, 0, 32, 32, -w * ax, -h * ay, w, h);
  ctx.restore();
}
const FX_BURST_SIZE = (2 * 32) / 30;   // 둥근 효과(폭발·고리·별): 그림 속 원(지름 약 30px)이 반지름 r 에 닿게
const LEAP_CLAW_SIZE = 48;             // 웬디고 착지점 발톱 자국 크기 (16px 그림 3배, 정예는 원 크기에 맞춰 커짐)

// 예티 땅 내리치기 경고: 원 둘레에 얼음 가시(fx_icespikes.png, 16px 3칸 = 작은 → 큰 가시)가 한 바퀴 돌며 차례로 솟음
//   p = 경고 진행(0 → 1), alpha = 투명도 (터진 뒤 옅어질 때)
const ICE_SPIKE_COUNT = 20;
const ICE_SPIKE_SIZE = 48;
function drawIceSpikes(x, y, r, p, alpha) {
  const sp = SPRITES.fx_icespikes;
  if (!sp.ready) return;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < ICE_SPIKE_COUNT; i++) {
    const show = p * 1.25 - (i / ICE_SPIKE_COUNT) * 0.25;
    if (show <= 0) continue;
    const frame = show < 0.45 ? 0 : show < 0.8 ? 1 : 2;
    const a = (i / ICE_SPIKE_COUNT) * Math.PI * 2;
    // 가시 밑동이 원 둘레에 오도록 그림을 위로 올려 그림
    ctx.drawImage(sp.normal, frame * 16, 0, 16, 16, x + Math.cos(a) * r - ICE_SPIKE_SIZE / 2, y + Math.sin(a) * r - ICE_SPIKE_SIZE + 8, ICE_SPIKE_SIZE, ICE_SPIKE_SIZE);
  }
  ctx.globalAlpha = 1;
}
const FX_BEAM_THICK = 8;               // 광선 그림의 띠 두께 (32px 중 가운데 8px)

// 낙뢰: Thunder Impact (번개가 떨어져 터짐). 터지는 원(반지름 11px, 그림 속 (17, 21))이 공격 범위 r 에 맞게
function drawBoltEffect(f, t) {
  const size = (f.r * 32) / 11;
  drawFxSprite("fx_bolt", f.x, f.y, size, size, t, 0, 17 / 32, 21 / 32);
}

// 별의 문양: Star Burst (금색 별이 터짐)
function drawStarEffect(f, t) {
  drawFxSprite("fx_star", f.x, f.y, f.r * FX_BURST_SIZE, f.r * FX_BURST_SIZE, t);
}

// 화염 방사: Flamethrower. 캐릭터에서 len 만큼 뻗음. 부채꼴 폭에 맞춰 세로로만 늘리면 픽셀이 뭉개져서 가로세로 같은 비율로 키우고,
//   불길이 적을 가리지 않게 조금 비치게 그림
const FX_FLAME_ALPHA = 0.8;
function drawConeEffect(f, t) {
  ctx.globalAlpha = FX_FLAME_ALPHA;
  drawFxSprite("fx_flame", f.x, f.y, f.len, f.len, t, f.angle, 0, 16.5 / 32);
  ctx.globalAlpha = 1;
}

// 빙결 광선: Laser Beam 을 하늘색으로 바꾼 그림. 캐릭터에서 len 만큼 뻗음. 끝으로 갈수록 옅어짐
function drawRayEffect(f, t) {
  ctx.globalAlpha = Math.min(1, t * 2);
  drawFxSprite("fx_ray", f.x, f.y, f.len, (f.half * 2 * 32) / FX_BEAM_THICK, t, f.angle, 0, 0.5);
  ctx.globalAlpha = 1;
}

// 마법 지팡이 광선 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
function drawBeamEffect(f, t) {
  // 마법 지팡이 광선: 화면을 가로지르는 하늘색 띠 + 가운데 흰 심. 시간이 지나며 가늘어지고 옅어짐
  const outer = f.half * (0.4 + 0.6 * t);
  const inner = outer * 0.35;
  for (const [halfWidth, color] of [[outer, `rgba(125, 249, 255, ${0.45 * t})`], [inner, `rgba(240, 254, 255, ${0.9 * t})`]]) {
    ctx.fillStyle = color;
    if (f.horizontal) ctx.fillRect(cam.x, f.pos - halfWidth, W, halfWidth * 2);
    else ctx.fillRect(f.pos - halfWidth, cam.y, halfWidth * 2, H);
  }
}

// 플레이어가 쏜 발사체 그리기
function drawProjectiles() {
  // 발사체 (그림이 있으면 그림, 없으면 빛나는 구슬. 꼬리 선은 trail: true 인 탄만 — 2026-10-12 부터 마법봉·화염병만)
  for (const b of bullets) {
    const heading = Math.atan2(b.vy, b.vx) + Math.PI / 2;   // 그림은 위쪽을 향해 그려져 있어서 90도 보정
    const color = b.color || "#7df9ff";

    // 꼬리: 날아온 방향으로 옅은 선
    if (b.trail) {
      const trailTime = BULLET_TRAIL * 1.4;
      ctx.globalAlpha = 0.4;
      ctx.strokeStyle = color;
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * trailTime, b.y - b.vy * trailTime);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = "butt";
    }

    let drew = false;
    if (b.sprite) {
      // 그림: spin 이 있으면 빙글빙글 (spinOffset 이 있으면 탄마다 시작 각도가 다름), 없으면 날아가는 방향으로
      drew = drawSprite(b.sprite, b.x, b.y, b.size || 16, { angle: b.spin ? stats.time * b.spin + (b.spinOffset || 0) : heading });
    }
    if (!drew) {
      // 빛나는 구슬 (마법탄, 화염구, 마법 구슬): 바깥 빛 + 밝은 속
      ctx.fillStyle = b.glow ? `${b.glow}59` : "rgba(125, 249, 255, 0.35)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = b.color ? color : "#e8fdff";
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.85, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// 적, 파편, 적 탄환 그리기
function drawEnemyLayer() {
  // 적 (종류별로 모양·색이 다름)
  for (const e of enemies) drawEnemy(e);

  // 파편 (작은 네모, 시간이 지나면 옅어짐)
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // 적 탄환 (회전 표창 — 빨간 표창이 빙글빙글 날아감)
  for (const b of enemyBullets) {
    const heading = Math.atan2(b.vy, b.vx);
    const angle = b.spin ? stats.time * b.spin : heading;
    if (!b.sprite || !drawSprite(b.sprite, b.x, b.y, b.size || 16, { angle })) {
      ctx.fillStyle = b.color || "#ff1744";       // 서리 망령의 얼음 화살·예티의 얼음 파편은 하늘색
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }
}

// 플레이어와 몸에 붙은 무기, 느려짐 고리 그리기
function drawPlayer() {
  // 플레이어에 붙어 있는 무기 (오라, 회전 도끼, 지팡이, 보호막)
  for (const w of player.weapons) {
    const def = WEAPONS[w.type];
    if (def.draw) def.draw(w);
  }

  // 난이도 테마: 외눈 거인의 자국을 밟아 느려진 동안 발밑에 테마 색 고리 (남은 시간만큼 옅어짐)
  if (player.slowTimer > 0) {
    ctx.strokeStyle = themeColor(0.8 * Math.min(1, player.slowTimer / 0.4));
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + player.r * 0.9, player.r * 1.3, player.r * 0.55, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 플레이어 (기사 그림, 무적 중엔 깜빡임)
  const blink = player.invincible > 0 && Math.floor(player.invincible * 20) % 2 === 0;
  const drewKnight = drawSprite(charDef().sprite, player.x, player.y, player.r * SPRITE_SCALE, {
    flip: player.facingLeft,
    white: blink,                      // 무적 중엔 흰색으로 깜빡임
  });
  if (!drewKnight) {
    // 그림을 못 불러왔을 때: 예전처럼 파란 원
    ctx.fillStyle = blink ? "#a8dadc" : "#4a90e2";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

// 떠오르는 글씨 그리기 (월드 좌표)
function drawFloatTexts() {
  // 떠오르는 글씨 (상자 보상 이름)
  for (const f of floatTexts) {
    ctx.globalAlpha = Math.min(f.life / (f.maxLife * 0.5), 1);
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
}

// 보스 체력바 그리기 (화면 좌표)
function drawBossBar() {
  // 보스 체력바 (화면 위 가운데, 보스가 살아 있는 동안)
  if (boss && !boss.dead) {
    const bw = 520, bh = 16, bx = (W - bw) / 2, by = 48;
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(bx - 4, by - 26, bw + 8, bh + 34);
    ctx.fillStyle = "#222";
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = "#c77dff";
    ctx.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.maxHp), bh);
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, bw, bh);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${boss.name || BOSS_TYPE.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, W / 2, by - 8);
    ctx.textAlign = "left";
  }
}

// 안내 문구 그리기 (화면 좌표)
function drawBanner() {
  // 안내 문구 (화면 위 가운데, 서서히 사라짐)
  if (banner) {
    ctx.fillStyle = `rgba(255, 214, 10, ${Math.min(banner.life, 1)})`;
    ctx.font = "bold 22px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(banner.text, W / 2, 90);
    ctx.textAlign = "left";
  }
}

// 지난 시간(분:초)과 처치 수 글자 갱신. 값이 바뀐 때만 화면 글자를 고침
let hudShownTime = "", hudShownKills = -1;
function updateHudStats() {
  const sec = Math.floor(stats.time);
  const t = `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  if (t !== hudShownTime) { hudShownTime = t; hudTime.textContent = t; }
  if (stats.kills !== hudShownKills) { hudShownKills = stats.kills; hudKills.textContent = stats.kills; }
}

// ---------------------------------------------------------------------
// 픽셀아트 그림 그리기
//   판정(맞는 범위)은 여전히 반지름 r 인 원이고, 그림은 그 위에 얹는 "겉모습"일 뿐
// ---------------------------------------------------------------------
const SPRITE_SCALE = 1.35;   // 그림 크기 = 반지름 × 이 값 × 2 (그림 가장자리에 여백이 있어서 조금 크게)

// 보유한 무기·방어구를 화면 오른쪽에 아이콘으로 세로 나열 (얻은 순서대로)
//   칸마다: 어두운 네모 + 무기 그림 + 오른쪽 아래에 레벨. 보호막은 재충전 중일 때 어둡게 덮이며 차오름
function drawOwnedList() {
  const size = 40, gap = 6;
  const weaponX = W - 16 - size;             // 오른쪽 끝 열: 무기
  const passiveX = weaponX - size - gap;     // 그 왼쪽 열: 패시브 아이템
  drawSlotColumn(player.weapons, WEAPONS, weaponX, size, gap, (w) => w.level >= WEAPON_MAX_LEVEL);
  // 패시브: 슬롯을 차지하는 것 먼저, '선택의 폭'처럼 자리를 안 차지하는 것은 맨 아래
  const passives = [...player.passives].sort((a, b) => (PASSIVES[a.type].noSlot ? 1 : 0) - (PASSIVES[b.type].noSlot ? 1 : 0));
  drawSlotColumn(passives, PASSIVES, passiveX, size, gap, (p) => p.level >= PASSIVES[p.type].maxLevel);
  ctx.textAlign = "left";
}

// 화면 밖 보물 상자 안내: 상자 쪽 화면 가장자리에 작은 상자 그림 + 금색 화살표
//   상자가 화면 안에 들어오면 사라짐. 상자가 사라지기 직전엔 화살표도 같이 깜빡임 (미믹도 똑같이 보임)
const CHEST_ARROW_MARGIN = 48;       // 화면 가장자리에서 얼마나 안쪽에 그릴지
function drawChestArrows() {
  for (const c of chests) {
    if (inView(c.x, c.y, c.r)) continue;
    if (c.life < CHEST_BLINK_TIME && Math.floor(c.life * 6) % 2 === 0) continue;

    // 화면 한가운데에서 상자 쪽으로 뻗은 선이 화면 가장자리(안쪽 여백)와 만나는 점
    const dx = (c.x - cam.x) * ZOOM - W / 2;           // 월드 좌표 → 화면 좌표 (휴대폰은 확대된 만큼 곱함)
    const dy = (c.y - cam.y) * ZOOM - H / 2;
    const scale = Math.min((W / 2 - CHEST_ARROW_MARGIN) / (Math.abs(dx) || 1), (H / 2 - CHEST_ARROW_MARGIN) / (Math.abs(dy) || 1));
    let x = W / 2 + dx * scale;
    const y = H / 2 + dy * scale;
    const angle = Math.atan2(dy, dx);

    // 오른쪽 위 보유 아이콘 줄과 겹치면 그 왼쪽 옆으로, 왼쪽 위 ? 버튼과 겹치면 그 오른쪽 옆으로 비켜 그림
    const reach = 36;                                  // 원 + 세모가 차지하는 반경
    const slot = 40 + 6;                               // 보유 아이콘 한 칸 (크기 + 간격. drawOwnedList 와 같은 값)
    const iconsLeft = W - 16 - 40 - (player.passives.length > 0 ? slot : 0);
    const iconsBottom = 16 + Math.max(player.weapons.length, player.passives.length) * slot;
    if (x > iconsLeft - reach && y < iconsBottom + reach) x = iconsLeft - reach;
    if (x < 64 + reach && y < 60 + reach) x = 64 + reach;

    // 작은 상자 그림 (금빛 원 위에)
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    drawSprite("chest", x, y, 11);

    // 상자 방향을 가리키는 세모 (원 바깥쪽에 붙음)
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = "#ffd60a";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 0);
    ctx.lineTo(20, -8);
    ctx.lineTo(20, 8);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }
}

// 보유 목록 한 열 그리기 (무기 열과 패시브 열이 같이 씀)
//   list : 보유 항목 [{type, level, ...}]   defs : WEAPONS 또는 PASSIVES   isMax(item) : 최대 레벨이면 금색 테두리
function drawSlotColumn(list, defs, x, size, gap, isMax) {
  list.forEach((item, i) => {
    const def = defs[item.type];
    const y = 16 + i * (size + gap);

    // 칸 배경
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(x, y, size, size);

    // 그림
    const cx = x + size / 2, cy = y + size / 2;
    drawSprite(def.icon, cx, cy, 17);

    // 보호막 재충전 중: 위에서부터 어둡게 덮고, 찰수록 걷힘
    if (item.type === "shield" && defs === WEAPONS && item.ready === false) {
      const remain = Math.max(0, Math.min(1, item.recharge / def.getRecharge(item)));
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(x, y, size, size * remain);
    }

    // 테두리 (최대 레벨이면 금색)
    ctx.strokeStyle = def.evolved ? "#ff8c42" : isMax(item) ? "#ffd60a" : "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, size, size);

    // 레벨 숫자 (오른쪽 아래)
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "right";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    const label = def.evolved ? "MAX" : `Lv${item.level}`;
    ctx.strokeText(label, x + size - 3, y + size - 4);
    ctx.fillStyle = def.evolved ? "#ffd60a" : "#fff";
    ctx.fillText(label, x + size - 3, y + size - 4);
  });
}

// 캐릭터 머리 위 체력바(위) + 경험치바(아래)
function drawPlayerBars() {
  const barW = 48;
  const hpH = 5;
  const xpH = 3;
  const x = Math.round(player.x - barW / 2);

  // 캐릭터(보호막 방울) 바로 위. 화면 맨 위에 붙어서 바가 잘릴 것 같으면 캐릭터 아래로 옮김
  let y = Math.round(player.y - player.r * 1.55 - 12);
  if (y < 4) y = Math.round(player.y + player.r * 1.55 + 6);

  // 체력바: 남은 체력에 따라 초록 → 노랑 → 빨강
  const hpRatio = Math.max(0, player.hp / player.maxHp);
  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, barW, hpH);
  ctx.fillStyle = hpRatio > 0.5 ? "#2ecc71" : hpRatio > 0.25 ? "#ffd60a" : "#ff1744";
  ctx.fillRect(x, y, barW * hpRatio, hpH);

  // 경험치바 (파란색)
  const xpRatio = Math.min(player.xp / player.xpNeed, 1);
  ctx.fillStyle = "#222";
  ctx.fillRect(x, y + hpH + 1, barW, xpH);
  ctx.fillStyle = "#4a90e2";
  ctx.fillRect(x, y + hpH + 1, barW * xpRatio, xpH);

  // 두 바를 감싸는 검은 테두리
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, barW + 1, hpH + xpH + 2);
}

// 그림 하나 그리기. 그렸으면 true, 그림이 준비 안 됐으면 false
//   half  : 그림 절반 크기 (가운데에서 가장자리까지)
//   flip  : 좌우 뒤집기      white : 흰색 실루엣으로 그리기 (맞았을 때)
//   angle : 돌리는 각도 (라디안). 무기 그림을 날아가는 방향으로 돌릴 때 씀
function drawSprite(name, x, y, half, { flip = false, white = false, angle = 0 } = {}) {
  const sprite = SPRITES[name];
  if (!sprite?.ready) return false;
  const img = white ? sprite.white : sprite.normal;
  const size = Math.round(half * 2);

  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  if (angle) ctx.rotate(angle);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
  return true;
}

// 적 하나 그리기
function drawEnemy(e) {
  // 붉은 게는 돌진 직전에 흰색으로 번쩍임 (피하라는 신호)
  const flashing = e.mode === "windup" && Math.floor(e.modeTimer * 16) % 2 === 0;
  const hit = e.hitFlash > 0;                       // 방금 맞았으면 흰색으로 번쩍
  const waking = e.wakeTimer > 0 && Math.floor(e.wakeTimer * 16) % 2 === 0;   // 막 깨어난 미믹
  const white = flashing || hit || waking;

  // 살아 있는 느낌: 위아래로 살짝 들썩임 (박쥐는 빠르게 파닥파닥)
  const bobSpeed = e.baseShape === "bat" ? 18 : 7;
  const bob = Math.sin(stats.time * bobSpeed + e.id) * e.r * 0.12
    - (e.leap ? Math.sin(Math.PI * Math.min(1, e.leap.t / LEAP_TIME)) * LEAP_HEIGHT : 0);   // 뛰어오른 웬디고는 포물선으로 떠오름

  // 서리 망령: 둘레의 찬 기운 (이 원 안에 들어가면 느려짐)
  if (e.aura) {
    ctx.fillStyle = "rgba(160, 230, 255, 0.10)";
    ctx.strokeStyle = "rgba(160, 230, 255, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, auraRadius(e), 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 보스: 큰 고리 (사신 마법사는 보라색, 다른 보스는 ring 색)
  if (e.boss) {
    ctx.fillStyle = `rgba(${e.ring || "155, 93, 229"}, 0.18)`;
    ctx.strokeStyle = e.ring ? `rgb(${e.ring})` : "#c77dff";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // 엘리트: 금색 고리로 표시 (잡으면 상자를 주는 몬스터)
  if (e.elite) {
    ctx.fillStyle = "rgba(255, 214, 10, 0.15)";
    ctx.strokeStyle = "#ffd60a";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 1.6, 0, Math.PI * 2);      // 그림보다 크게 그려야 가려지지 않음
    ctx.fill();
    ctx.stroke();
  }

  // 난이도 테마 그림(예: bat_ice)을 아직 못 불러왔으면 원래 그림으로
  const shape = SPRITES[e.shape] && SPRITES[e.shape].ready ? e.shape : e.baseShape;
  const drew = drawSprite(shape, e.x, e.y + bob, e.r * SPRITE_SCALE, {
    flip: e.behavior === "swarm" ? e.vx < 0 : player.x < e.x,   // 플레이어가 있는 쪽을 바라봄 (박쥐 떼는 날아가는 쪽)
    white,
  });

  // 난이도 테마 · 붉은 게의 껍질: 남아 있는 동안 테마 색 테두리 (두 겹이면 두 줄)
  for (let i = 0; i < (e.shell || 0); i++) {
    ctx.strokeStyle = themeColor(0.85);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r * 1.25 + i * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // 빙결 중: 옅은 하늘색으로 덮음
  if ((freezeTimer > 0 || e.frozenTimer > 0) && !e.boss) {   // 보스는 안 얼므로 얼음 색도 안 덮음
    ctx.fillStyle = "rgba(125, 249, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 엘리트는 머리 위에 체력바 (얼마나 남았는지 알 수 있게)
  if (e.elite) {
    const w = e.r * 2, x = e.x - e.r, y = e.y - e.r * 1.6 - 10;
    ctx.fillStyle = "#222";
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = "#ffd60a";
    ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 4);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, 5);
  }

  if (!drew) {
    // 그림을 못 불러왔을 때: 단색 원 + 검은 테두리
    ctx.fillStyle = white ? "#fff" : e.color;
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
