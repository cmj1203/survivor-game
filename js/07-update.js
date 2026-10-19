// =====================================================================
// 10. 한 프레임 동안 세상을 움직이기 (dt = 지난 프레임 이후 흐른 초)
// =====================================================================
function update(dt) {
  stats.time += dt;
  metaTick(dt);                          // 다회차: 1초마다 퀘스트 확인, 15초마다 이어 하기 저장

  updatePlayer(dt);
  updateSpawning(dt);
  updateEvents(dt);
  const frozen = updateFreezeTimer(dt);
  updateEnemies(dt, frozen);
  updateBossMarks(dt);

  // --- 무기 발동 ---
  updateWeapons(dt);

  updateBullets(dt);
  updateBulletHits();
  updateZones(dt);
  updateEffects(dt);
  updatePlayerDamage(dt, frozen);
  updatePickups(dt);

  // 이번 프레임에 보스를 잡아 클리어됐으면 여기서 끝 (예전엔 아래 레벨업·상자가 클리어 창 위에 떠서, 카드를 고르면 클리어 창 뒤에서 게임이 계속 돌았음)
  if (state !== "playing") return;

  if (checkGameOver()) return;          // 상자보다 먼저: 같은 프레임에 죽으면서 상자에 닿아도 상자 창이 게임오버 창을 덮지 않게
  const openedChest = updateChests(dt);

  // --- 레벨업 확인 (한 프레임에 한 번만) ---
  if (openedChest) return;             // 상자 창이 떠 있으면 레벨업은 창을 닫은 다음 프레임에
  checkLevelUp();
}

// 플레이어 이동·식인꽃 밀어내기·카메라·무적 시간·회복
function updatePlayer(dt) {
  // --- 플레이어 이동 ---
  let mx = 0, my = 0;
  if (keys.w || keys.arrowup)    my -= 1;
  if (keys.s || keys.arrowdown)  my += 1;
  if (keys.a || keys.arrowleft)  mx -= 1;
  if (keys.d || keys.arrowright) mx += 1;
  const joy = joystickDir();                  // 휴대폰: 조이스틱 방향 (키보드보다 우선)
  if (joy) { mx = joy.x; my = joy.y; }

  if (mx !== 0) player.facingLeft = mx < 0;   // 마지막으로 움직인 좌우 방향을 바라봄
  if (mx !== 0 || my !== 0) {
    // 대각선일 때 속도가 빨라지지 않게 길이를 1로 맞춤
    const len = Math.hypot(mx, my);
    player.facingX = mx / len;                 // 바라보는 방향 기억
    player.facingY = my / len;
    // 난이도 테마: 외눈 거인의 자국을 밟고 있으면 느려짐 (맞아서 느려지는 건 없음 — 모든 난이도가 보통과 같음)
    //   얼음 정령·서리 망령·예티에게 맞으면 잠깐 느려짐 (chillTimer)
    const speed = player.speed * (player.puddleTimer > 0 ? HAZARD_SLOW_MUL[enemyTier()] : 1) * (player.chillTimer > 0 ? CHILL_SLOW_MUL : 1);
    player.x += (mx / len) * speed * dt;
    player.y += (my / len) * speed * dt;
  }
  if (player.slowTimer > 0) player.slowTimer -= dt;
  if (player.puddleTimer > 0) player.puddleTimer -= dt;
  if (player.chillTimer > 0) player.chillTimer -= dt;
  // 북극곰에게 부딪혀 밀려나는 중
  if (player.knockTimer > 0) {
    player.knockTimer -= dt;
    player.x += player.knockVX * dt;
    player.y += player.knockVY * dt;
  }
  // 식인꽃은 벽: 겹치면 플레이어를 꽃 바깥으로 밀어냄 (뚫고 지나갈 수 없음) + 닿은 값으로 피해
  for (const e of enemies) {
    if (e.behavior !== "ring" || e.dead) continue;
    const dx = player.x - e.x, dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const overlap = player.r + e.r - dist;
    if (overlap <= 0) continue;
    player.x += (dx / dist) * overlap;
    player.y += (dy / dist) * overlap;
    const harmless = e.wakeTimer > 0 || freezeTimer > 0 || e.frozenTimer > 0;
    if (player.invincible <= 0 && !harmless) hurtPlayer(e.damage);
  }
  // 맵 밖(돌담)으로 못 나가게 가둠 + 카메라가 따라옴
  player.x = Math.max(WALL_SIZE + player.r, Math.min(WORLD_W - WALL_SIZE - player.r, player.x));
  player.y = Math.max(WALL_SIZE + player.r, Math.min(WORLD_H - WALL_SIZE - player.r, player.y));
  // 퀘스트 '탐험가'용: 맵 구석(가로·세로 400 안)에 들어가면 그 구석을 가 본 것으로 기억
  if (run && (player.x < 400 || player.x > WORLD_W - 400) && (player.y < 400 || player.y > WORLD_H - 400)) run.corners |= 1 << ((player.x < 400 ? 0 : 1) + (player.y < 400 ? 0 : 2));
  updateCamera();

  // 무적 시간 줄이기
  if (player.invincible > 0) player.invincible -= dt;

  // 회복(패시브): 1초마다 레벨 × 0.2 만큼 체력 회복
  if (passiveLevel("regen") > 0 && player.hp < player.maxHp) {
    player.hp = Math.min(player.maxHp, player.hp + P_REGEN * passiveLevel("regen") * dt);
  }
}

// 일반 적 생성·몬스터 시간표 안내·엘리트 등장
function updateSpawning(dt) {
  // --- 적 생성 (시간이 갈수록 간격이 짧아짐) ---
  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    // 최소 간격에 도달한 뒤에는 한 번에 나오는 수가 계속 늘어남 (SPAWN_DOUBLE_TIME 마다 +1마리, 그 사이는 확률로)
    const extra = Math.max(0, (refTime() - SPAWN_RAMP_TIME) / SPAWN_DOUBLE_TIME);
    const burst = 1 + Math.floor(extra) + (Math.random() < extra % 1 ? 1 : 0);
    for (let i = 0; i < burst; i++) if (enemies.length < MAX_ENEMIES) spawnEnemy();

    // SPAWN_RAMP_TIME 초 동안 서서히 SPAWN_START → SPAWN_MIN 으로 줄어듦
    const progress = Math.min(refTime() / SPAWN_RAMP_TIME, 1);
    spawnTimer = (SPAWN_START - (SPAWN_START - SPAWN_MIN) * progress) / (1 + P_CURSE_SPAWN * curseLevel()) / DIFFICULTY;   // 해골: 더 자주
  }

  // --- 몬스터 시간표: 새 단계가 시작되는 순간, 새 몬스터가 서서히 늘어나기 시작 + 화면 위 안내 문구 ---
  const stage = enemyStage();
  if (stage !== player.enemyStage) {
    player.enemyStage = stage;
    player.stageChangedAt = stats.time;
    if (SHOW_BANNER) {
      const name = currentEnemyType().name;
      banner = { text: stage >= ENEMY_TYPES.length ? `더 강해진 적: ${name}` : `새로운 적: ${name}`, life: BANNER_TIME };   // 한 바퀴 돈 뒤에는 같은 종류가 더 강해져서 다시 나옴
    }
  }

  // --- 엘리트 등장 (1분마다). 보스가 나온 뒤에는 안 나옴 ---
  eliteTimer -= dt;
  if (eliteTimer <= 0) {
    if (!boss) spawnElite();
    eliteTimer = ELITE_INTERVAL * diffDef().elite;   // 난이도별 정예 간격
  }
}

// 이벤트 시간표(몬스터 떼·꽃 울타리)와 마지막 보스 등장
function updateEvents(dt) {
  // --- 이벤트 시간표 (몬스터 떼·꽃 울타리): 시각이 되면 확률을 굴려 시작하고, repeat 번을 delay 간격으로 내보냄 ---
  while (eventIndex < EVENT_SCHEDULE.length && stats.time >= eventTime(EVENT_SCHEDULE[eventIndex])) {
    const ev = EVENT_SCHEDULE[eventIndex++];
    if (stats.time - eventTime(ev) > 5) continue;                 // 이미 한참 지난 칸은 건너뜀
    if (Math.random() < (ev.chance ?? 1)) eventQueue.push({ ev, left: ev.repeat || 1, timer: 0, angle: Math.random() * Math.PI * 2 });
  }
  for (const q of eventQueue) {
    q.timer -= dt;
    if (q.timer > 0) continue;
    if (!boss) {
      if (q.ev.kind === "flower") spawnFlowerRing();
      else spawnSwarm(q.ev.type, (q.ev.delay || 0) < 3 ? q.angle + (Math.random() - 0.5) * 0.25 : Math.random() * Math.PI * 2, q.ev.count);
    }
    q.left -= 1;
    q.timer = q.ev.delay || 0;
  }
  eventQueue = eventQueue.filter((q) => q.left > 0);

  // --- 마지막 보스: BOSS_TIME(20분)에 등장 (문구 없이 조용히. 화면 위 보스 체력바로 알 수 있음) ---
  if (!boss && stats.time >= BOSS_TIME) spawnBoss();
}

// 빙결 시간 줄이기. 이번 프레임이 빙결 중이었는지 돌려줌
function updateFreezeTimer(dt) {
  // --- 빙결 시간 줄이기 (눈꽃 아이템) ---
  const frozen = freezeTimer > 0;
  if (frozen) freezeTimer -= dt;
  return frozen;
}

// 적 이동(행동 방식별)과 무기별 재타격 대기시간 줄이기
function updateEnemies(dt, frozen) {
  // --- 적 이동 (행동 방식별) + 무기별 재타격 대기시간 줄이기 ---
  for (const e of enemies) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const len = Math.hypot(dx, dy) || 1;
    const dirX = dx / len;    // 플레이어 쪽 방향 (길이 1)
    const dirY = dy / len;

    // 몬스터 떼: 수명이 다하면 사라짐 (구슬·처치 수 없음). 화면 안에서 사라질 때만 파편
    if (e.life !== undefined) {
      e.life -= dt;
      if (e.life <= 0) { e.dead = true; if (inView(e.x, e.y)) spawnParticles(e.x, e.y, e.color, 4, 90); continue; }
    }

    if ((frozen || e.frozenTimer > 0) && !e.boss) {
      // 빙결 중(눈꽃 아이템 전체 빙결, 또는 빙결 광선에 맞은 개별 빙결): 움직이지도, 쏘지도, 돌진하지도 않음
      if (e.frozenTimer > 0) e.frozenTimer -= dt;
    } else if (e.wakeTimer > 0) {
      // 막 정체를 드러낸 미믹: 잠깐 제자리에 있음
      e.wakeTimer -= dt;
    } else if (e.behavior === "boss") {
      updateBossEnemy(e, dirX, dirY, dt);
    } else if (e.behavior === "charger") {
      updateChargerEnemy(e, dirX, dirY, dt);
    } else if (e.behavior === "gallop") {
      updateGallopEnemy(e, dirX, dirY, len, dt);
    } else if (e.behavior === "leaper") {
      updateLeaperEnemy(e, dirX, dirY, len, dt);
    } else if (e.behavior === "slide") {
      updateSlideEnemy(e, dirX, dirY, dt);
    } else if (e.behavior === "pack") {
      updatePackEnemy(e, dirX, dirY, len, dt);
    } else if (e.behavior === "runner") {
      updateRunnerEnemy(e, dirX, dirY, len, dt);
    } else if (e.behavior === "swarm") {
      // 박쥐 떼: 플레이어를 쫓지 않고 처음 정해진 방향으로 곧장 날아감
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    } else if (e.behavior === "ring") {
      // 식인꽃(울타리): 플레이어가 아니라 울타리 중심 쪽으로 천천히 조여 오다가, FLOWER_MIN_RADIUS 까지 오면 시들어 사라짐 (구슬·처치 수 없음)
      const rx = e.ringX - e.x, ry = e.ringY - e.y;
      const dist = Math.hypot(rx, ry);
      if (dist > FLOWER_MIN_RADIUS) {
        e.x += (rx / dist) * e.speed * dt;
        e.y += (ry / dist) * e.speed * dt;
      } else {
        e.dead = true;
        if (inView(e.x, e.y)) spawnParticles(e.x, e.y, e.color, 4, 90);
      }
    } else {
      updateChaseEnemy(e, dirX, dirY, len, dt);
    }
    // 스테이지별 적 특성 (불 웅덩이·불꽃 꼬리·회복): 얼어 있으면 멈춤
    if (!((frozen || e.frozenTimer > 0) && !e.boss)) updateEnemyTraits(e, dt);

    for (const k in e.cd) if (e.cd[k] > 0) e.cd[k] -= dt;
    if (e.hitFlash > 0) e.hitFlash -= dt;
  }
}

// 보스 한 마리: 쫓아오기·탄환(난이도마다 패턴이 다름)·부하 소환
function updateBossEnemy(e, dirX, dirY, dt) {
  if (e.pattern === "yeti") {
    updateYetiBoss(e, dirX, dirY, dt);
  } else if (e.pattern === "demon") {
    updateDemonBoss(e, dirX, dirY, dt);
  } else if (e.pattern === "deathknight") {
    updateKnightBoss(e, dirX, dirY, dt);
  } else {
    // 사신 마법사: 플레이어를 계속 쫓아오며 탄환을 쏨 (난이도마다 패턴이 다름)
    e.x += dirX * e.speed * dt;
    e.y += dirY * e.speed * dt;
    const pattern = BOSS_PATTERNS[enemyTier()];
    if (pattern) updateBossShots(e, Math.atan2(dirY, dirX), pattern, dt);   // 보통 난이도는 공격 없음
  }
  // 주기적으로 부하 소환 (summon 이 있으면 그 종류, 없으면 지금 주력 몬스터)
  e.summonTimer -= dt;
  if (e.summonTimer <= 0) {
    const type = e.summon ? findEnemyType(e.summon) : currentEnemyType();
    for (let i = 0; i < BOSS_SUMMON_COUNT; i++) {
      const a = (Math.PI * 2 * i) / BOSS_SUMMON_COUNT;
      if (enemies.length < MAX_ENEMIES) pendingSpawns.push(makeEnemy(type, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70));
    }
    e.summonTimer = BOSS_SUMMON_INTERVAL;
    spawnParticles(e.x, e.y, e.color, 16, 200);
  }
}

// 예티(얼음 동굴 보스): 쫓아오다가 땅 내리치기(제자리) · 얼음덩이 던지기(플레이어 자리), 체력 절반 이하면 고드름 비까지
function updateYetiBoss(e, dirX, dirY, dt) {
  if (e.mode === "windup") {                     // 땅 내리치기 준비: 제자리에서 번쩍이며 경고 원이 참
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) e.mode = null;
    return;
  }
  e.x += dirX * e.speed * dt;
  e.y += dirY * e.speed * dt;
  e.slamTimer -= dt;
  e.rockTimer -= dt;
  if (e.slamTimer <= 0) {
    e.slamTimer = YETI_SLAM_INTERVAL;
    e.mode = "windup";
    e.modeTimer = YETI_SLAM_WINDUP;
    bossMarks.push({ x: e.x, y: e.y, r: YETI_SLAM_RADIUS, time: YETI_SLAM_WINDUP, maxTime: YETI_SLAM_WINDUP, damage: YETI_SLAM_DAMAGE, chill: true, spikes: true, fx: "fx_frostnova" });
  } else if (e.rockTimer <= 0) {
    e.rockTimer = YETI_ROCK_INTERVAL;
    bossMarks.push({ x: player.x, y: player.y, r: YETI_ROCK_RADIUS, time: YETI_ROCK_FALL, maxTime: YETI_ROCK_FALL, damage: YETI_ROCK_DAMAGE, shards: YETI_SHARD_COUNT, fx: "fx_iceshatter", fall: "rock" });
  }
  if (e.hp > e.maxHp / 2) return;
  e.icicleTimer -= dt;
  if (e.icicleTimer <= 0) {
    e.icicleTimer = YETI_ICICLE_INTERVAL;
    for (let i = 0; i < YETI_ICICLE_COUNT; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : 60 + Math.random() * (YETI_ICICLE_SPREAD - 60);   // 첫 고드름은 플레이어 자리
      const time = YETI_ICICLE_FALL + i * 0.08;                                  // 차례로 떨어지게 조금씩 어긋나게
      bossMarks.push({ x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d, r: YETI_ICICLE_RADIUS, time, maxTime: time, damage: YETI_ICICLE_DAMAGE, fx: "fx_icehit", fall: "icicle", warn: "fx_circleice" });
    }
  }
}

// 악마(용암 굴 보스): 쫓아오다가 불기둥(플레이어 근처) · 화염 돌진(멈춰서 방향 띠 → 직선 돌진, 지나간 자리에 불길), 체력 절반 이하면 운석까지
function updateDemonBoss(e, dirX, dirY, dt) {
  if (e.mode === "windup") {                     // 돌진 준비: 제자리에서 번쩍이며 방향 띠가 참
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) { e.mode = "dash"; e.modeTimer = DEMON_CHARGE_TIME; e.trailDist = 0; }
    return;
  }
  if (e.mode === "dash") {                       // 돌진: 정해 둔 방향으로 곧장, DEMON_TRAIL_GAP 마다 불길
    const step = DEMON_CHARGE_SPEED * dt;
    e.x += e.dashX * step;
    e.y += e.dashY * step;
    e.trailDist += step;
    if (e.trailDist >= DEMON_TRAIL_GAP) {
      e.trailDist = 0;
      enemyFires.push({ kind: "trail", x: e.x, y: e.y, r: DEMON_TRAIL_RADIUS, life: DEMON_TRAIL_LIFE, maxLife: DEMON_TRAIL_LIFE, arm: DEMON_TRAIL_ARM, damage: Math.round(DEMON_TRAIL_DAMAGE * DIFFICULTY) });
    }
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) {
      e.mode = null;
      effects.push({ x: e.x + e.dashX * (e.r + 20), y: e.y + e.dashY * (e.r + 20), r: DEMON_TRAIL_RADIUS * 1.8, life: BOSS_BURST_LIFE, maxLife: BOSS_BURST_LIFE, fx: "fx_fireburst", scale: BOSS_BURST_SCALE });   // 돌진 끝에서 불꽃이 터짐
    }
    return;
  }
  e.x += dirX * e.speed * dt;
  e.y += dirY * e.speed * dt;
  e.pillarTimer -= dt;
  e.chargeTimer -= dt;
  if (e.chargeTimer <= 0) {
    e.chargeTimer = DEMON_CHARGE_INTERVAL;
    e.mode = "windup";
    e.modeTimer = DEMON_CHARGE_WINDUP;
    e.dashX = dirX;                              // 이 순간의 방향으로 돌진 (띠 밖으로 비키면 빗나감)
    e.dashY = dirY;
    const half = (DEMON_CHARGE_SPEED * DEMON_CHARGE_TIME) / 2;
    bossMarks.push({ shape: "band", x: e.x + dirX * half, y: e.y + dirY * half, angle: Math.atan2(dirY, dirX), len: half + e.r, half: e.r * 0.8,
                     time: DEMON_CHARGE_WINDUP, maxTime: DEMON_CHARGE_WINDUP, damage: 0, rgb: DEMON_RGB, warn: "arrows" });   // 피해는 돌진하는 몸과 불길이 줌
  } else if (e.pillarTimer <= 0) {
    e.pillarTimer = DEMON_PILLAR_INTERVAL;
    for (let i = 0; i < DEMON_PILLAR_COUNT; i++) {
      const a = Math.random() * Math.PI * 2, d = i === 0 ? 0 : 60 + Math.random() * (DEMON_PILLAR_SPREAD - 60);   // 첫 불기둥은 플레이어 자리
      bossMarks.push({ x: player.x + Math.cos(a) * d, y: player.y + Math.sin(a) * d, r: DEMON_PILLAR_RADIUS, time: DEMON_PILLAR_TIME, maxTime: DEMON_PILLAR_TIME, damage: DEMON_PILLAR_DAMAGE, rgb: DEMON_RGB, fx: "fx_pillar", fxLife: DEMON_PILLAR_FX_LIFE, warn: "fx_circlefire" });
    }
  }
  if (e.hp > e.maxHp / 2) return;
  e.meteorTimer -= dt;
  if (e.meteorTimer <= 0) {
    e.meteorTimer = DEMON_METEOR_INTERVAL;
    for (let i = 0; i < DEMON_METEOR_COUNT; i++) {
      const time = DEMON_METEOR_TIME + i * DEMON_METEOR_STAGGER;   // 차례로 떨어지게
      const x = i === 0 ? player.x : cam.x + 40 + Math.random() * (VW - 80), y = i === 0 ? player.y : cam.y + 40 + Math.random() * (VH - 80);   // 화면 여기저기 (첫 운석은 플레이어 자리)
      bossMarks.push({ x, y, r: DEMON_METEOR_RADIUS, time, maxTime: time, damage: DEMON_METEOR_DAMAGE, rgb: DEMON_RGB, fx: "fx_fireburst", fxLife: BOSS_BURST_LIFE, fxScale: BOSS_BURST_SCALE, fall: "meteor" });
    }
  }
}

// 죽음의 기사(저주받은 어둠 보스): 쫓아오다가 베기(부채꼴) · 순간이동 내리찍기(플레이어 뒤쪽), 체력 절반 이하면 십자 어둠 파동 (4분의 1 이하면 대각선도)
function updateKnightBoss(e, dirX, dirY, dt) {
  if (e.mode === "windup") {                     // 베기 준비: 제자리에서 번쩍이며 부채꼴이 참
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) e.mode = null;
    return;
  }
  if (e.mode === "vanish") {                     // 사라진 동안: 나타날 자리에 경고 원. 다 차면 그 자리에 나타나며 내리찍음 (원 피해는 updateBossMarks)
    e.modeTimer -= dt;
    if (e.modeTimer <= 0) {
      e.mode = null;
      e.vanished = false;
      e.x = e.teleX;
      e.y = e.teleY;
      spawnParticles(e.x, e.y, `rgb(${KNIGHT_RGB})`, 16, 220);
    }
    return;
  }
  e.x += dirX * e.speed * dt;
  e.y += dirY * e.speed * dt;
  e.slashTimer -= dt;
  e.teleTimer -= dt;
  if (e.teleTimer <= 0) {
    e.teleTimer = KNIGHT_TELE_INTERVAL;
    e.mode = "vanish";
    e.vanished = true;
    e.modeTimer = KNIGHT_TELE_TIME;
    e.teleX = player.x - player.facingX * KNIGHT_TELE_BEHIND;   // 플레이어가 바라보는 쪽의 반대편 (등 뒤)
    e.teleY = player.y - player.facingY * KNIGHT_TELE_BEHIND;
    effects.push({ x: e.x, y: e.y + 10, r: KNIGHT_CLOUD_SIZE / FX_BURST_SIZE, life: KNIGHT_CLOUD_LIFE, maxLife: KNIGHT_CLOUD_LIFE, fx: "fx_cursecloud" });   // 떠난 자리에 저주 연기
    bossMarks.push({ x: e.teleX, y: e.teleY, r: KNIGHT_TELE_RADIUS, time: KNIGHT_TELE_TIME, maxTime: KNIGHT_TELE_TIME, damage: KNIGHT_TELE_DAMAGE, rgb: KNIGHT_RGB, fx: "fx_darkburst", fxLife: BOSS_BURST_LIFE, fxScale: BOSS_BURST_SCALE, warn: "fx_castcircle" });
  } else if (e.slashTimer <= 0) {
    e.slashTimer = KNIGHT_SLASH_INTERVAL;
    e.mode = "windup";
    e.modeTimer = KNIGHT_SLASH_WINDUP;
    bossMarks.push({ shape: "cone", x: e.x, y: e.y, angle: Math.atan2(dirY, dirX), spread: KNIGHT_SLASH_SPREAD, r: KNIGHT_SLASH_RANGE,
                     time: KNIGHT_SLASH_WINDUP, maxTime: KNIGHT_SLASH_WINDUP, damage: KNIGHT_SLASH_DAMAGE, rgb: KNIGHT_RGB, warn: "swords" });
  }
  if (e.hp > e.maxHp / 2) return;
  e.crossTimer -= dt;
  if (e.crossTimer <= 0) {
    e.crossTimer = KNIGHT_CROSS_INTERVAL;
    const angles = e.hp > e.maxHp / 4 ? [0, Math.PI / 2] : [0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4];
    for (const angle of angles) {
      bossMarks.push({ shape: "band", x: e.x, y: e.y, angle, len: KNIGHT_CROSS_LEN, half: KNIGHT_CROSS_HALF, time: KNIGHT_CROSS_TIME, maxTime: KNIGHT_CROSS_TIME, damage: KNIGHT_CROSS_DAMAGE, rgb: KNIGHT_RGB, center: true, warn: "arrows" });
    }
  }
}

// 경고 모양 안에 플레이어가 있는지 (원 / band: 가운데 (x, y)에서 angle 방향 양쪽으로 len, 두께 절반 half / cone: (x, y)에서 angle 쪽 부채꼴)
function markHitsPlayer(m) {
  const dx = player.x - m.x, dy = player.y - m.y;
  if (m.shape === "band") {
    const c = Math.cos(m.angle), s = Math.sin(m.angle);
    return Math.abs(dx * c + dy * s) < m.len + player.r && Math.abs(-dx * s + dy * c) < m.half + player.r;
  }
  const d = Math.hypot(dx, dy);
  if (m.shape === "cone") {
    const diff = Math.abs(((Math.atan2(dy, dx) - m.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return d < m.r + player.r && (d < player.r || diff < m.spread / 2);
  }
  return d < m.r + player.r;
}

// 보스 공격 경고 원: 시간이 다 되면 그 자리에서 터짐 (원 안에 있으면 피해. chill = 느려짐, shards = 사방으로 파편)
//   final = 이미 난이도 배수를 곱한 피해 (용암 골렘 폭발), damage 0 = 경고만 (악마 돌진 띠)
function updateBossMarks(dt) {
  for (const m of bossMarks) {
    m.time -= dt;
    if (m.time > 0) continue;
    m.done = true;
    if (m.damage > 0 && markHitsPlayer(m) && player.invincible <= 0) {
      hurtPlayer(m.final ? m.damage : Math.round(m.damage * DIFFICULTY));
      if (m.chill) chillPlayer(CHILL_TIME * 2);
    }
    const fxLife = m.fxLife || YETI_FX_LIFE;
    if (m.fx) effects.push({ x: m.x, y: m.y, r: m.r, life: fxLife, maxLife: fxLife, fx: m.fx, scale: m.fxScale });   // 터지는 그림 (공격마다 다름, 위 bossMarks.push 의 fx)
    else if (m.shape === "cone") effects.push({ kind: "darkslash", x: m.x, y: m.y, r: m.r, angle: m.angle, life: KNIGHT_SLASH_FX_LIFE, maxLife: KNIGHT_SLASH_FX_LIFE });   // 죽음의 기사 베기: 보라 초승달
    else if (m.center) {                         // 십자 파동: 가운데에서 띠를 따라 바깥으로 어둠 폭발이 차례로
      const life = KNIGHT_WAVE_PUFF + m.len / KNIGHT_WAVE_SPEED;
      effects.push({ kind: "darkwave", x: m.x, y: m.y, angle: m.angle, len: m.len, life, maxLife: life });
    }
    if (m.spikes) effects.push({ kind: "icespikes", x: m.x, y: m.y, r: m.r, life: 0.35, maxLife: 0.35 });   // 둘레 얼음 가시가 옅어지며 사라짐
    for (let i = 0; i < (m.shards || 0); i++) {
      const a = (Math.PI * 2 * i) / m.shards;
      enemyBullets.push({ x: m.x, y: m.y, vx: Math.cos(a) * YETI_SHARD_SPEED, vy: Math.sin(a) * YETI_SHARD_SPEED, r: ENEMY_BULLET_RADIUS, damage: Math.round(YETI_SHARD_DAMAGE * DIFFICULTY), color: "#bfefff" });
    }
  }
  bossMarks = bossMarks.filter((m) => !m.done);
}

// 보스 탄환 패턴. aim = 플레이어 쪽 각도
//   fan: 플레이어 쪽 부채꼴 / ring: 사방 원형 / spiral: 빙글 도는 나선 줄기 + 가끔 부채꼴
function updateBossShots(e, aim, pattern, dt) {
  e.shootTimer -= dt;
  switch (pattern) {
    case "fan":
      if (e.shootTimer <= 0) { bossFan(e, aim); e.shootTimer = BOSS_SHOT_INTERVAL; }
      break;
    case "ring":
      if (e.shootTimer <= 0) {
        const start = Math.random() * Math.PI * 2;      // 매번 틈의 자리가 달라지게
        for (let i = 0; i < BOSS_RING_COUNT; i++) bossBullet(e, start + (Math.PI * 2 * i) / BOSS_RING_COUNT);
        e.shootTimer = BOSS_RING_INTERVAL;
      }
      break;
    case "spiral":
      e.spiralTimer = (e.spiralTimer || 0) - dt;
      if (e.spiralTimer <= 0) {
        e.spiralAngle = (e.spiralAngle || 0) + BOSS_SPIRAL_TURN;
        for (let k = 0; k < BOSS_SPIRAL_ARMS; k++) bossBullet(e, e.spiralAngle + (Math.PI * 2 * k) / BOSS_SPIRAL_ARMS);
        e.spiralTimer = BOSS_SPIRAL_INTERVAL;
      }
      if (e.shootTimer <= 0) { bossFan(e, aim); e.shootTimer = BOSS_SPIRAL_FAN_INTERVAL; }
      break;
    default:
      throw new Error(`알 수 없는 보스 패턴: ${pattern}`);
  }
}

// 플레이어 쪽 부채꼴 (BOSS_SHOT_COUNT 발)
function bossFan(e, aim) {
  for (let i = 0; i < BOSS_SHOT_COUNT; i++) bossBullet(e, aim + (i - (BOSS_SHOT_COUNT - 1) / 2) * 0.22);
}

// 보스 탄환(빨간 회전 표창) 한 발을 a 방향으로
function bossBullet(e, a) {
  enemyBullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * BOSS_BULLET_SPEED, vy: Math.sin(a) * BOSS_BULLET_SPEED, r: ENEMY_BULLET_RADIUS, damage: Math.round(BOSS_BULLET_DAMAGE * DIFFICULTY), sprite: "boss_shuriken", spin: 12, size: 14 });
}

// 돌진하는 적 한 마리: 걷기 → 번쩍 → 돌진
function updateChargerEnemy(e, dirX, dirY, dt) {
  // 붉은 게(돌진): 걷기(walk) → 멈춰서 번쩍(windup) → 돌진(dash) 반복
  e.modeTimer -= dt;
  if (e.mode === "walk") {
    e.x += dirX * e.speed * dt;
    e.y += dirY * e.speed * dt;
    if (e.modeTimer <= 0) {
      e.mode = "windup";
      e.modeTimer = CHARGER_WINDUP_TIME;
      e.dashX = dirX;       // 이 순간의 방향으로 돌진 (그 사이 피하면 빗나감)
      e.dashY = dirY;
    }
  } else if (e.mode === "windup") {
    if (e.modeTimer <= 0) { e.mode = "dash"; e.modeTimer = CHARGER_DASH_TIME; }
  } else {
    e.x += e.dashX * CHARGER_DASH_SPEED * dt;
    e.y += e.dashY * CHARGER_DASH_SPEED * dt;
    if (e.modeTimer <= 0) { e.mode = "walk"; e.modeTimer = CHARGER_WALK_TIME; }
  }
}

// 미끄러지는 적 (얼음 원소): 빙판 위처럼 속도가 천천히 바뀜 → 플레이어가 비키면 지나쳤다가 돌아옴
function updateSlideEnemy(e, dirX, dirY, dt) {
  const max = e.speed * SLIDE_MAX_MUL, k = Math.min(1, SLIDE_GRIP * dt);
  e.vx += (dirX * max - e.vx) * k;
  e.vy += (dirY * max - e.vy) * k;
  e.x += e.vx * dt;
  e.y += e.vy * dt;
}

// 들이박는 적 (악몽마): aim(준비) → run(일직선 돌진, RUSH_DIST 만큼) → rest(숨 고르기) → aim ...
//   e.runX/runY = 돌진 방향 (그림도 이쪽을 바라봄)   e.rushT = 지금 동작에서 지난 시간   e.rushLeft = 남은 돌진 거리
function updateRunnerEnemy(e, dirX, dirY, len, dt) {
  if (!e.rush) e.rush = "rest", e.rushT = RUSH_REST_TIME * Math.random(), e.runX = dirX, e.runY = dirY;   // 처음엔 박자를 적마다 다르게
  e.rushT += dt;
  if (e.rush === "rest") {
    if (e.rushT >= RUSH_REST_TIME) { e.rush = "aim"; e.rushT = 0; e.runX = dirX; e.runY = dirY; }   // 이 순간 캐릭터 쪽으로 방향을 정함
    else if (inView(e.x, e.y) && Math.floor((e.rushT - dt) / 0.6) !== Math.floor(e.rushT / 0.6)) spawnParticles(e.x + e.runX * e.r, e.y - e.r * 0.3, "#c9c4d8", 2, 40);   // 거친 숨
  } else if (e.rush === "aim") {
    if (inView(e.x, e.y) && Math.floor((e.rushT - dt) / 0.15) !== Math.floor(e.rushT / 0.15)) spawnParticles(e.x - e.runX * e.r * 0.4, e.y + e.r * 0.8, "#5b5470", 2, 70);   // 발 구르며 흙먼지
    if (e.rushT >= RUSH_AIM_TIME) { e.rush = "run"; e.rushT = 0; e.rushLeft = RUSH_DIST; }
  } else {
    const step = Math.min(e.rushLeft, e.speed * RUSH_SPEED_MUL * dt);
    e.x += e.runX * step;
    e.y += e.runY * step;
    e.rushLeft -= step;
    if (inView(e.x, e.y) && Math.floor((e.rushT - dt) / 0.08) !== Math.floor(e.rushT / 0.08)) spawnParticles(e.x - e.runX * e.r, e.y + e.r * 0.7, "#5b5470", 2, 60);   // 뒤로 날리는 먼지
    if (e.rushLeft <= 0) { e.rush = "rest"; e.rushT = 0; }
  }
}

// 스테이지별 적 특성: 불 원소 웅덩이, 불타는 해골 꼬리, 미라 회복
function updateEnemyTraits(e, dt) {
  if (e.firePool) {
    e.poolTimer -= dt;
    if (e.poolTimer <= 0) {
      e.poolTimer = FIRE_POOL_INTERVAL;
      if (inView(e.x, e.y) && enemyFires.filter((f) => f.kind === "pool").length < FIRE_POOL_MAX) {
        const life = FIRE_POOL_LIFE + FIRE_POOL_ARM;
        enemyFires.push({ kind: "pool", x: e.x, y: e.y, r: FIRE_POOL_RADIUS * (e.elite ? 1.4 : 1), life, maxLife: life, arm: FIRE_POOL_ARM, damage: Math.max(1, Math.round(e.damage * FIRE_POOL_DAMAGE_MUL)) });
      }
    }
  }
  if (e.fireTrail) {
    e.trailTimer = (e.trailTimer || 0) - dt;
    if (e.trailTimer <= 0) {
      e.trailTimer = FIRE_TRAIL_INTERVAL;
      if (inView(e.x, e.y, 40) && enemyFires.filter((f) => f.kind === "trail").length < FIRE_TRAIL_MAX) {
        enemyFires.push({ kind: "trail", x: e.x, y: e.y, r: e.r * 0.6, life: FIRE_TRAIL_LIFE, maxLife: FIRE_TRAIL_LIFE, arm: FIRE_TRAIL_ARM, damage: Math.max(1, Math.round(e.damage * FIRE_TRAIL_DAMAGE_MUL)) });
      }
    }
  }
  if (e.regen && e.hp < e.maxHp && stats.time - (e.hurtAt ?? -Infinity) > REGEN_DELAY) {
    e.hp = Math.min(e.maxHp, e.hp + e.maxHp * REGEN_RATE * dt);
    e.regenFx = (e.regenFx || 0) - dt;
    if (e.regenFx <= 0) { e.regenFx = 0.3; spawnParticles(e.x, e.y - e.r * 0.4, "#7dff8a", 3, 50); }   // 초록 반짝임
  }
}

// 무리 짓는 적 (지옥개): 한 마리로 오다가 PACK_SPLIT_DIST 안에서 세 마리로 늘어남. 가운데 개는 곧장, 양옆 개는 플레이어 옆쪽으로 비껴 달리다가 가까워지면 곧장 → 집게처럼 둘러쌈
function updatePackEnemy(e, dirX, dirY, len, dt) {
  if (e.packLead && len < PACK_SPLIT_DIST) splitPack(e, dirX, dirY);   // 가까워지면 세 마리로 늘어남
  let mx = dirX, my = dirY;
  if (e.packSide && len > PACK_CLOSE_DIST) {
    const turn = e.packSide * PACK_FLANK_ANGLE * Math.min(1, (len - PACK_CLOSE_DIST) / 250);   // 멀수록 크게 비껴 달림
    const c = Math.cos(turn), s = Math.sin(turn);
    mx = dirX * c - dirY * s;
    my = dirX * s + dirY * c;
  }
  const speed = e.speed * (e.packSide ? PACK_FLANK_SPEED : 1);
  e.x += mx * speed * dt;
  e.y += my * speed * dt;
}

// 질주하는 적 (북극곰): 멀리서는 어슬렁, GALLOP_RANGE 안으로 들어오면 네 발로 달리며 점점 빨라짐 (멀어지면 다시 어슬렁)
function updateGallopEnemy(e, dirX, dirY, len, dt) {
  e.gallop = len < GALLOP_RANGE ? e.gallop + dt : 0;
  const mul = e.gallop > 0 ? Math.min(GALLOP_MAX, GALLOP_AMBLE + GALLOP_ACCEL * e.gallop) : GALLOP_AMBLE;
  e.x += dirX * e.speed * mul * dt;
  e.y += dirY * e.speed * mul * dt;
}

// 덮치는 적 (웬디고): 느리게 다가오다가 가끔 플레이어가 있던 자리로 뛰어오름. 착지하면 그 자리에 피해 + 얼음 장판
function updateLeaperEnemy(e, dirX, dirY, len, dt) {
  if (e.leap) {                                   // 공중: 출발점 → 착지점으로 LEAP_TIME 동안 이동 (그림은 포물선, drawEnemy 참고)
    const L = e.leap;
    L.t += dt;
    const k = Math.min(1, L.t / LEAP_TIME);
    e.x = L.sx + (L.tx - L.sx) * k;
    e.y = L.sy + (L.ty - L.sy) * k;
    if (k < 1) return;
    e.leap = null;
    const r = LEAP_RADIUS * (e.elite ? 1.4 : 1);
    if (Math.hypot(player.x - e.x, player.y - e.y) < r + player.r && player.invincible <= 0) hurtPlayer(e.damage);
    effects.push({ x: e.x, y: e.y, r, life: LEAP_DUST_LIFE, maxLife: LEAP_DUST_LIFE, fx: "fx_landdust" });   // 착지 흙먼지
    spawnParticles(e.x, e.y, "#e0f7ff", 10, 200);
    if (hazards.length < CYCLOPS_HAZARD_MAX) {
      const life = CYCLOPS_HAZARD_LIFE[enemyTier()] + HAZARD_ARM_TIME;
      hazards.push({ x: e.x, y: e.y, r, life, maxLife: life, arm: HAZARD_ARM_TIME, quest: !!e.hazardQuest });
    }
    return;
  }
  e.x += dirX * e.speed * dt;
  e.y += dirY * e.speed * dt;
  e.leapTimer -= dt;
  if (e.leapTimer <= 0 && len < LEAP_RANGE && inView(e.x, e.y)) {
    e.leapTimer = LEAP_INTERVAL - LEAP_TIME;   // 땅에 있을 때만 줄어드므로 공중 시간을 빼서, 덮치기 시작 간격이 LEAP_INTERVAL
    e.leap = { sx: e.x, sy: e.y, tx: player.x, ty: player.y, t: 0 };
  }
}

// 기본 적 한 마리: 플레이어 쪽으로 곧장 (유령 순간이동 포함)
function updateChaseEnemy(e, dirX, dirY, len, dt) {
  // 기본(chase): 플레이어 쪽으로 곧장
  e.x += dirX * e.speed * dt;
  e.y += dirY * e.speed * dt;
  //   난이도 테마 · 유령 '순간이동': 몇 초마다 플레이어 쪽으로 훌쩍 다가옴 (화면 안에 있고 아직 멀 때만)
  if (e.blinkTimer !== undefined) {
    e.blinkTimer -= dt;
    if (e.blinkTimer <= 0 && len > GHOST_BLINK_MIN && inView(e.x, e.y)) {
      spawnParticles(e.x, e.y, themeColor(1), 6, 120);            // 떠난 자리
      e.x += dirX * GHOST_BLINK_DIST;
      e.y += dirY * GHOST_BLINK_DIST;
      effects.push({ kind: "ring", x: e.x, y: e.y, r: e.r, color: themeColor(1), life: 0.3, maxLife: 0.3 });   // 나타난 자리
      e.blinkTimer = GHOST_BLINK_INTERVAL[enemyTier()];
    }
  }
}

// 발사체 이동(중력·되돌아오기·튕김·수명)과 화면 밖 발사체 제거
function updateBullets(dt) {
  // --- 발사체 이동 (속성에 따라: 중력, 되돌아오기, 튕김, 수명) ---
  for (const b of bullets) {
    // 촛대(공격 범위): 날아가는 투사체도 그만큼 커짐. 맞는 범위(r)와 그림 크기(size)를 처음 한 번만 키움
    if (!b.sized) { b.sized = true; const m = areaMul(); b.r *= m; if (b.sprite) b.size = (b.size || 16) * m; }
    if (b.life !== undefined) { b.life -= dt; if (b.life <= 0) { if (b.onExpire) b.onExpire(b); b.dead = true; continue; } }
    if (b.gravity) b.vy += b.gravity * dt;                           // 던지는 망치: 포물선
    if (b.ax !== undefined) {                                        // 던지는 방패: 되돌아옴
      b.vx += b.ax * dt;
      b.vy += b.ay * dt;
      // 방향이 뒤집히는 순간, 돌아오는 길에 다시 때릴 수 있게 맞은 목록을 비움
      if (!b.turned && b.vx * b.startDirX + b.vy * b.startDirY < 0) { b.turned = true; b.hitIds.clear(); }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // 화면 가장자리에서 튕김 (마법 구슬, 튕기는 칼). 튕기면 맞은 목록을 비워서 같은 적을 다시 때릴 수 있음
    if (b.bounces > 0) {
      let bounced = false;
      if (b.x < cam.x + b.r && b.vx < 0) { b.x = cam.x + b.r; b.vx = -b.vx; bounced = true; }
      if (b.x > cam.x + VW - b.r && b.vx > 0) { b.x = cam.x + VW - b.r; b.vx = -b.vx; bounced = true; }
      if (b.y < cam.y + b.r && b.vy < 0) { b.y = cam.y + b.r; b.vy = -b.vy; bounced = true; }
      if (b.y > cam.y + VH - b.r && b.vy > 0) { b.y = cam.y + VH - b.r; b.vy = -b.vy; bounced = true; }
      if (bounced) { b.bounces -= 1; if (b.hitIds) b.hitIds.clear(); if (b.onBounce) b.onBounce(b); }
    }

    // 화염병: 목표 지점에 도착하면 바닥에 불바다
    //   느린 휴대폰에서는 한 프레임에 많이 움직여 8px 안에 안 들어오고 지나칠 수 있어서, 목표를 지나쳤어도 도착으로 침
    if (b.kind === "bomb") {
      const rx = b.targetX - b.x, ry = b.targetY - b.y;
      if (Math.hypot(rx, ry) < 8 || rx * b.vx + ry * b.vy <= 0) {
        b.x = b.targetX; b.y = b.targetY;
        zones.push({ kind: "fire", x: b.x, y: b.y, r: b.zoneRadius, life: b.zoneLife, maxLife: b.zoneLife, tick: 0, interval: 0.25, damage: b.damage, follow: b.zoneFollow });
        effects.push({ x: b.x, y: b.y, r: b.zoneRadius * 0.8, life: 0.25, maxLife: 0.25, rgb: "255, 140, 40", fx: "fx_fireball" });
        b.dead = true;
      }
    }
  }
  // 화면 밖으로 나간 발사체 제거 (여유는 발사체마다 다를 수 있음: 망치는 위로 높이 올라감)
  bullets = bullets.filter((b) => !b.dead && inView(b.x, b.y, b.margin || 40));
}

// 발사체가 적에 닿으면 피해 (관통·폭발 처리)
function updateBulletHits() {
  // --- 충돌: 발사체 ↔ 적 ---
  for (const b of bullets) {
    if (b.noHit) continue;                       // 화염병은 닿아도 안 터지고 목표까지 감
    for (const e of enemies) {
      if (e.dead || !circlesTouch(b, e)) continue;
      if (b.hitIds) {
        if (b.hitIds.has(e.id)) continue;        // 관통 중 같은 적은 한 번만
        b.hitIds.add(e.id);
      }
      if (b.onHit) { b.onHit(b); break; }        // 닿으면 터지는 것 (폭탄)
      damageEnemy(e, b.damage);
      if (b.pierce > 0) {
        b.pierce -= 1;                           // 관통: 계속 날아감
      } else {
        b.dead = true;                           // 단검·마법탄: 적 하나 맞고 사라짐
        break;
      }
    }
  }
  bullets = bullets.filter((b) => !b.dead);
}

// 불바다 피해, 죽은 적 정리, 새로 생긴 적 합치기
function updateZones(dt) {
  // --- 바닥 지역(불바다): 안에 있는 적에게 주기적으로 피해 ---
  for (const z of zones) {
    z.life -= dt;
    z.tick -= dt;
    if (z.follow) {                                 // 진화한 불바다: 플레이어 쪽으로 천천히 따라옴
      const dx = player.x - z.x, dy = player.y - z.y, len = Math.hypot(dx, dy) || 1;
      if (len > 30) { z.x += (dx / len) * 60 * dt; z.y += (dy / len) * 60 * dt; }
    }
    if (z.tick <= 0) {
      z.tick = z.interval;
      for (const e of enemies) {
        if (!e.dead && Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) damageEnemy(e, z.damage);
      }
    }
  }
  zones = zones.filter((z) => z.life > 0);

  enemies = enemies.filter((e) => !e.dead);
  enemies = enemies.filter((e) => !e.dead);
  if (pendingSpawns.length > 0) {          // 거미에서 갈라져 나온 새끼 합치기
    enemies = enemies.concat(pendingSpawns);
    pendingSpawns = [];
  }
}

// 폭발·고리 연출과 파편 움직이기
function updateEffects(dt) {
  // --- 폭발·고리 연출 시간 줄이기 ---
  for (const f of effects) f.life -= dt;
  effects = effects.filter((f) => f.life > 0);

  // --- 파편 이동: 날아가면서 점점 느려지고 사라짐 ---
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.92;
    p.vy *= 0.92;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
}

// 플레이어가 받는 것: 적과 부딪힘, 끈적한 자국, 적 탄환
function updatePlayerDamage(dt, frozen) {
  // --- 충돌: 적 ↔ 플레이어 ---
  if (player.invincible <= 0) {
    for (const e of enemies) {
      if ((frozen || e.frozenTimer > 0) && !e.boss) continue; // 빙결 광선으로 얼린 적도 닿아도 안전 (보스는 안 얼음)
      if (e.wakeTimer > 0) continue;   // 깨어나는 중인 미믹은 아직 피해를 주지 않음
      if (e.leap) continue;            // 뛰어오른 웬디고는 착지할 때만 피해 (updateLeaperEnemy)
      if (e.vanished) continue;        // 순간이동으로 사라진 죽음의 기사
      if (circlesTouch(e, player)) {
        hurtPlayer(e.damage);
        if (e.knockback) { knockPlayer(e); e.gallop = 0; }   // 북극곰: 밀려남, 곰은 질주를 멈추고 처음부터

        break;               // 한 프레임에 한 번만 맞음
      }
    }
  }

  // --- 서리 망령의 찬 기운: 둘레(AURA_RADIUS) 안에 있으면 느려짐 (빙결 중에는 기운도 멈춤) ---
  if (!frozen) for (const e of enemies) if (e.aura && !e.dead && !(e.frozenTimer > 0) && Math.hypot(player.x - e.x, player.y - e.y) < auraRadius(e)) { chillPlayer(0.25); break; }

  // --- 난이도 테마 · 끈적한 자국: 시간이 지나면 사라지고, 준비 시간이 끝난 뒤 밟고 있으면 느려짐 (피해는 없음) ---
  for (const h of hazards) {
    h.life -= dt;
    if (h.arm > 0) { h.arm -= dt; continue; }
    if (circlesTouch(h, player)) {
      player.puddleTimer = 0.25;                                  // 밟는 동안 계속 느림, 벗어나면 0.25초 뒤 풀림
      player.slowTimer = Math.max(player.slowTimer || 0, 0.25);   // 발밑 고리 표시용
      if (!h.stepped) { h.stepped = true; if (run && h.quest) run.puddles += 1; }   // 퀘스트 '끈적끈적'용 (웬디고의 얼음 장판만): 장판 하나당 한 번만 셈
    }
  }
  hazards = hazards.filter((h) => h.life > 0);

  // --- 적이 남긴 불 (불 원소 웅덩이·불타는 해골 꼬리·악마 돌진 불길): 켜진 뒤 밟으면 피해 (무적 시간 규칙은 똑같이 적용) ---
  for (const f of enemyFires) {
    f.life -= dt;
    if (f.arm > 0) { f.arm -= dt; continue; }
    if (player.invincible <= 0 && circlesTouch(f, player)) hurtPlayer(f.damage);
  }
  enemyFires = enemyFires.filter((f) => f.life > 0);

  // --- 적 탄환: 이동 → 플레이어에 닿으면 피해 (무적 시간 규칙은 똑같이 적용) ---
  for (const b of enemyBullets) {
    // 탄환은 보스만 쏘고, 보스는 빙결에 안 얼므로 빙결 중에도 탄환은 그대로 날아감 (예전엔 공중에서 멈춰서 보스 공격이 끊겼음)
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (circlesTouch(b, player)) {
      b.dead = true;
      if (player.invincible <= 0) hurtPlayer(b.damage);
    }
  }
  enemyBullets = enemyBullets.filter((b) => !b.dead && inView(b.x, b.y, 40));
}

// 안내 문구·구슬 줍기·떠오르는 글씨·바닥 아이템
function updatePickups(dt) {
  // --- 안내 문구 시간 줄이기 ---
  if (banner) {
    banner.life -= dt;
    if (banner.life <= 0) banner = null;
  }

  // --- 구슬 끌어당기기 + 줍기 ---
  const pickupArea = { x: player.x, y: player.y, r: player.pickupRadius };
  for (const g of gems) {
    // 매 프레임 "지금 범위 안인지"를 새로 판정 (상자의 자석 보상을 받은 구슬은 거리와 상관없이 끌려옴)
    if (g.magnet || circlesTouch(pickupArea, g)) {
      // 범위 안: 플레이어 쪽으로 이동, 점점 빨라짐 (막 들어왔으면 시작 속도부터)
      g.speed = (g.speed || GEM_PULL_SPEED) + GEM_PULL_ACCEL * dt;
      const dx = player.x - g.x;
      const dy = player.y - g.y;
      const len = Math.hypot(dx, dy) || 1;
      const move = Math.min(g.speed * dt, len);   // 플레이어를 지나쳐 가지 않게
      g.x += (dx / len) * move;
      g.y += (dy / len) * move;
    } else {
      g.speed = 0;   // 범위 밖: 그 자리에 멈춤 (다시 들어오면 처음 속도부터)
    }

    // 플레이어 몸에 닿으면 획득
    if (circlesTouch(player, g)) {
      g.dead = true;
      player.xp += g.value * xpMul();
      playSfx("gem");   // 왕관(패시브): 경험치 배수
    }
  }
  gems = gems.filter((g) => !g.dead);

  // --- 떠오르는 글씨: 위로 올라가며 사라짐 ---
  for (const f of floatTexts) { f.y -= 30 * dt; f.life -= dt; }
  floatTexts = floatTexts.filter((f) => f.life > 0);

  // --- 바닥 아이템: 시간이 지나면 사라지고, 몸이 닿으면 바로 발동 ---
  for (const it of items) {
    it.life -= dt;
    if (it.life <= 0) { it.dead = true; continue; }
    if (circlesTouch(player, it)) useItem(it);
  }
  items = items.filter((it) => !it.dead);
}

// 보물 상자 확인. 이번 프레임에 상자를 열었는지 돌려줌
function updateChests(dt) {
  // --- 보물 상자: 시간이 지나면 사라지고, 몸이 닿으면 열림 ---
  let openedChest = false;
  for (const c of chests) {
    c.life -= dt;
    if (c.life <= 0) { c.dead = true; continue; }
    if (!c.dead && circlesTouch(player, c)) {
      if (c.mimic) { wakeMimic(c); continue; }
      openChest(c);
      openedChest = true;              // 상자 창이 떴으니 이번 프레임은 여기까지
      break;
    }
  }
  chests = chests.filter((c) => !c.dead);
  return openedChest;
}

// 게임오버 확인. 게임이 끝났으면 true 를 돌려줌
function checkGameOver() {
  // --- 게임오버 확인 (부활 패시브가 남아 있으면 대신 부활) ---
  if (player.hp <= 0) {
    if (player.revivesUsed < passiveLevel("revival") + upLevel("revival")) {   // 부활(게임 중) + 상점 '부활'
      revivePlayer();
    } else {
      player.hp = 0;
      gameOver();
      return true;
    }
  }
  return false;
}

// 경험치가 다 찼으면 레벨업
function checkLevelUp() {
  if (player.xp >= player.xpNeed) {
    levelUp();
  }
}
