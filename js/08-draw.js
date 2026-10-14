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
    // 던전 바닥: 맵 전체 그림에서 지금 화면에 보이는 부분만 잘라서 그림 (확대했을 때 가장자리가 비지 않게 올림)
    const sx = Math.round(cam.x), sy = Math.round(cam.y), vw = Math.ceil(VW), vh = Math.ceil(VH);
    ctx.drawImage(background, sx / BG_SCALE, sy / BG_SCALE, vw / BG_SCALE, vh / BG_SCALE, sx, sy, vw, vh);
  }
}

// 바닥에 깔리는 위험한 자국과 불바다 그리기
function drawFloorZones() {
  // 난이도 테마 · 위험한 자국 (외눈 거인이 죽은 자리): 테마 색 원. 준비 중엔 테두리만 깜빡이고, 그 뒤엔 속이 차서 일렁임
  for (const h of hazards) {
    const fade = Math.min(1, h.life / 0.6);                       // 사라지기 직전엔 옅어짐
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

  // 바닥 지역: 불바다 (일렁이는 주황 원)
  for (const z of zones) {
    const t = z.life / z.maxLife;
    if (z.kind === "shadow") {
      // 그림자 발톱의 흔적: 어두운 보라 원
      ctx.fillStyle = `rgba(60, 30, 90, ${0.55 * t})`;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2); ctx.fill();
      continue;
    }
    const flicker = 0.85 + Math.sin(stats.time * 18 + z.x) * 0.08;
    ctx.fillStyle = `rgba(255, 120, 30, ${0.30 * Math.min(1, t * 3)})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r * flicker, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 200, 80, ${0.35 * Math.min(1, t * 3)})`;
    ctx.beginPath();
    ctx.arc(z.x, z.y, z.r * 0.55 * flicker, 0, Math.PI * 2);
    ctx.fill();
  }
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
    if (f.kind === "chest") {
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
function drawSlashEffect(f, t) {
  // 장검: 방향 앞쪽에 굵은 호(弧)
  ctx.globalAlpha = t;
  ctx.strokeStyle = "#e8fdff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * (0.8 + 0.2 * (1 - t)), f.angle - 1.0, f.angle + 1.0);
  ctx.stroke();
  ctx.strokeStyle = "#7df9ff";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r * 0.7, f.angle - 0.8, f.angle + 0.8);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// 낙뢰 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
function drawBoltEffect(f, t) {
  // 낙뢰: 위에서 내려오는 지그재그 + 바닥 원
  ctx.globalAlpha = t;
  ctx.strokeStyle = "#f0feff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  const px = f.x, py = f.y - 220;
  ctx.moveTo(px, py);
  for (let i = 1; i <= 6; i++) {
    const ny = f.y - 220 + (220 * i) / 6;
    const nx = i === 6 ? f.x : f.x + Math.sin(f.seed * 40 + i * 2.3) * 18;
    ctx.lineTo(nx, ny);
  }
  ctx.stroke();
  ctx.fillStyle = "rgba(125, 249, 255, 0.35)";
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

// 별의 문양 오각별 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
function drawStarEffect(f, t) {
  // 별의 문양: 오각별
  ctx.globalAlpha = t;
  ctx.strokeStyle = "#ffd60a";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI * 2) / 5;    // 꼭짓점을 두 칸씩 건너뛰면 별이 됨
    const px = f.x + Math.cos(a) * f.r, py = f.y + Math.sin(a) * f.r;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// 화염 방사 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
function drawConeEffect(f, t) {
  // 화염 방사: 부채꼴 불길
  ctx.globalAlpha = t;
  ctx.fillStyle = "rgba(255, 140, 40, 0.5)";
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.arc(f.x, f.y, f.len, f.angle - f.half, f.angle + f.half);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255, 220, 120, 0.6)";
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.arc(f.x, f.y, f.len * 0.6, f.angle - f.half * 0.5, f.angle + f.half * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

// 빙결 광선 연출 (t: 1 → 0 으로 줄어드는 남은 시간 비율)
function drawRayEffect(f, t) {
  // 빙결 광선: 캐릭터에서 뻗어 나가는 하늘색 선
  ctx.globalAlpha = t;
  ctx.strokeStyle = "#7df9ff";
  ctx.lineWidth = f.half * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(f.x, f.y);
  ctx.lineTo(f.x + Math.cos(f.angle) * f.len, f.y + Math.sin(f.angle) * f.len);
  ctx.stroke();
  ctx.strokeStyle = "#f0feff";
  ctx.lineWidth = f.half * 0.6;
  ctx.stroke();
  ctx.lineCap = "butt";
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
      ctx.fillStyle = "#ff1744";
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
    ctx.fillText(`${BOSS_TYPE.name}  ${Math.ceil(boss.hp)} / ${boss.maxHp}`, W / 2, by - 8);
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
  const bob = Math.sin(stats.time * bobSpeed + e.id) * e.r * 0.12;

  // 보스: 보라색 큰 고리
  if (e.boss) {
    ctx.fillStyle = "rgba(155, 93, 229, 0.18)";
    ctx.strokeStyle = "#c77dff";
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
