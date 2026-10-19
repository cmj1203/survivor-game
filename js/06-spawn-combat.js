// =====================================================================
// 6. 적 만들기: 지금 보이는 화면의 바깥 가장자리 아무 곳에서 등장
// =====================================================================
function spawnEnemy() {
  const { x, y } = randomEdgePosition(30);    // 화면 밖 30px 지점 (맵 안쪽 변만)
  const type = pickEnemyType();
  const e = makeEnemy(type, x, y);
  if (type.behavior === "pack") e.packLead = true;   // 지옥개: 한 마리로 와서 가까워지면 세 마리로 늘어남 (splitPack)
  enemies.push(e);
}

// 지옥개 증식: 가운데 개(e) 양옆으로 한 마리씩 갈라져 나와 세 마리가 됨. 양옆 개는 플레이어 옆쪽으로 비껴 달려 둘러쌈 (packSide -1 / 0 / 1)
//   갈라진 개는 가운데 개의 지금 능력치(엘리트면 엘리트 그대로)를 똑같이 가짐. 같은 무리는 packId 로 묶음 (엘리트 상자는 무리를 다 잡아야 나옴)
function splitPack(e, dirX, dirY) {
  e.packLead = false;
  e.packId = `p${e.id}_${Math.round(stats.time * 1000)}`;
  for (const side of [-1, 1]) {
    if (!e.elite && enemies.length >= MAX_ENEMIES) break;   // 엘리트는 상자 규칙 때문에 항상 세 마리
    const c = makeEnemy(findEnemyType("hellhound"), e.x - dirY * side * PACK_SPLIT_GAP, e.y + dirX * side * PACK_SPLIT_GAP);
    for (const k of ["r", "hp", "maxHp", "damage", "speed", "xp", "elite", "packId"]) c[k] = e[k];
    c.packSide = side;
    enemies.push(c);
    spawnParticles(c.x, c.y, "#ff7a3d", 10, 160);
  }
  spawnParticles(e.x, e.y, "#ffd60a", 14, 200);
}

// 지금 시각이 "몇 번째 몬스터 단계"인지 (0 = 박쥐만, 1 = 붉은 게까지, 2 = 거미까지 ... 5 = 박쥐 두 바퀴째 ...)
//   WAVE_START_TIMES 시간표에서 이미 지난 칸의 수로 정해짐
function enemyStage() {
  let stage = 0;
  while (stage + 1 < WAVE_START_TIMES.length && refTime() >= WAVE_START_TIMES[stage + 1]) stage += 1;
  return stage;
}

// 지금의 "주력" 적 종류 (마지막 종류가 끝나면 다시 처음부터)
function currentEnemyType() {
  const types = enemyTypes();
  return types[enemyStage() % types.length];
}

// 이번에 나올 적 종류 고르기: 새 몬스터 비율은 레벨업 후 서서히 늘어나고, 나머지는 기존 몬스터
function pickEnemyType() {
  const current = currentEnemyType();
  const stage = enemyStage();
  const types = enemyTypes();
  const unlocked = types.slice(0, Math.min(stage + 1, types.length));
  const olds = unlocked.filter((t) => t !== current);
  if (olds.length === 0) return current;             // 첫 단계: 박쥐뿐

  // 새 몬스터가 나올 확률 (레벨업 후 시간이 지날수록 커짐)
  if (Math.random() < newEnemyShare()) return current;

  // 기존 몬스터: 대부분은 바로 전 단계의 주력, 가끔 더 옛날 몬스터
  const len = types.length;
  const prevMain = types[(stage - 1 + len) % len];
  if (Math.random() < PREV_MAIN_CHANCE) return prevMain;
  return olds[Math.floor(Math.random() * olds.length)];
}

// 지금 새 몬스터가 차지하는 비율: 새 몬스터가 열린 직후 15% → 15초에 걸쳐 70% 로 서서히 증가
function newEnemyShare() {
  const sinceUnlock = stats.time - player.stageChangedAt;
  const t = Math.max(0, Math.min(sinceUnlock / NEW_ENEMY_RAMP_TIME, 1));   // 0 → 1
  return NEW_ENEMY_SHARE_START + (NEW_ENEMY_SHARE_MAX - NEW_ENEMY_SHARE_START) * t;
}

// 적 하나 만들기: 종류 표의 값에 시간 보정을 곱함
//   isChild = true 면 거미에서 갈라져 나온 새끼 거미
function makeEnemy(type, x, y, isChild = false) {
  const minutes = refTime() / 60;                              // 지금까지 흐른 게임 시간 (분, 30분 기준으로 환산)
  const cycle = Math.floor(enemyStage() / ENEMY_TYPES.length);   // 몬스터 종류를 몇 바퀴 돌았는지
  const curse = curseLevel();                                  // 해골(패시브): 적이 더 튼튼하고 빠름
  const speedMul = Math.min(1 + ENEMY_SPEED_PER_MINUTE * minutes, ENEMY_SPEED_CAP) * (1 + P_CURSE_SPEED * curse);
  const lateMinutes = Math.max(0, refTime() - ENEMY_HP_TIME_START) / 60;
  const hpMul = DIFFICULTY * diffDef().hp * (1 + ENEMY_HP_PER_MINUTE_BASE * minutes) * (1 + ENEMY_HP_PER_MINUTE * lateMinutes) * (1 + P_CURSE_HP * curse);
  const damageMul = DIFFICULTY * diffDef().dmg * Math.min(1 + ENEMY_DAMAGE_PER_MINUTE * minutes, ENEMY_DAMAGE_CAP);

  const e = {
    id: nextEnemyId++,
    type: type.key,
    x, y,
    shape: type.shape,
    color: type.color,
    behavior: type.behavior,
    r: type.r,
    speed: type.speed * speedMul * diffDef().speed,
    hp: Math.max(1, Math.round(type.hp * hpMul)),   // 반올림 (약한 적이 초반부터 2배로 튼튼해지지 않게)
    damage: Math.round(type.damage * damageMul),
    xp: type.xp * (cycle + 1),          // 한 바퀴 돌 때마다 경험치 2배, 3배...
    splitInto: type.splitInto || 0,
    cd: {},                             // 무기별 재타격 대기시간
  };
  e.maxHp = e.hp;

  if (isChild) {
    // 새끼 거미: 작고 약하지만 빠름, 더 이상 갈라지지 않음
    e.r = Math.round(type.r / 2);
    e.hp = Math.max(1, Math.round(1 * hpMul));
    e.speed *= 1.15;
    e.damage = Math.ceil(e.damage / 2);   // 새끼는 피해도 절반 (수가 많아서 몰려 죽기 쉬움)
    e.xp = 1 * (cycle + 1);
    e.splitInto = 0;
  }
  if (e.behavior === "boss")    { e.shootTimer = BOSS_SHOT_INTERVAL; e.summonTimer = BOSS_SUMMON_INTERVAL; }
  if (e.behavior === "charger") { e.mode = "walk"; e.modeTimer = CHARGER_WALK_TIME; }
  if (e.behavior === "gallop")  e.gallop = 0;                                         // 북극곰: 질주한 시간
  if (e.behavior === "leaper")  e.leapTimer = LEAP_INTERVAL * (0.5 + Math.random());   // 웬디고: 첫 덮치기 박자를 적마다 다르게
  // 스테이지별 적의 특성 (STAGE_ENEMIES 표 참고)
  for (const k of ["knockback", "aura", "splitType", "splitGens", "killStat", "leavesHazard", "hazardQuest", "firePool", "fireTrail", "deathBlast", "fade", "regen"]) if (type[k]) e[k] = type[k];
  if (e.behavior === "slide") { e.vx = 0; e.vy = 0; }   // 얼음 원소: 지금 미끄러지는 속도
  if (e.firePool) e.poolTimer = FIRE_POOL_INTERVAL * (0.5 + Math.random());   // 불 원소: 첫 웅덩이 박자를 적마다 다르게

  // 난이도 테마: 그림을 테마 색으로 바꾸고, 적 종류마다 특성을 하나씩 붙임 (보통 난이도는 tier 0 이라 그대로)
  const tier = enemyTier(), theme = diffDef().theme;
  e.baseShape = type.shape;
  if (theme && THEMED_SPRITES.includes(type.shape)) e.shape = `${type.shape}_${theme}`;
  if (tier > 0) {
    if (type.key === "crab") e.shell = CRAB_SHELL[tier];                                            // 껍질: 공격을 몇 번 막음
    if (type.key === "spider" && !isChild) e.splitInto = SPIDER_SPLIT[tier];                        // 분열: 새끼가 더 많이
    if (type.key === "ghost") e.blinkTimer = GHOST_BLINK_INTERVAL[tier] * (0.5 + Math.random());   // 순간이동 (적마다 박자가 어긋나게)
    if (type.key === "cyclops") e.leavesHazard = true;                                              // 죽으면 위험한 자국
  }
  return e;
}

// 파편 뿌리기: (x, y)에서 count개가 사방으로 튀어 나감
function spawnParticles(x, y, color, count, speed) {
  for (let i = 0; i < count; i++) {
    if (particles.length >= PARTICLE_MAX) return;    // 너무 많으면 더 안 만듦
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);    // 파편마다 속도를 조금씩 다르게
    const life = 0.25 + Math.random() * 0.2;
    particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      size: 2 + Math.random() * 2,
      color,
      life, maxLife: life,
    });
  }
}

// 엘리트 몬스터 등장: 지금의 주력 몬스터를 크고 강하게 만들어 화면 가장자리에서 내보냄
function spawnElite() {
  const { x, y } = randomEdgePosition(50);
  const e = makeEnemy(currentEnemyType(), x, y);
  e.elite = true;
  e.r = Math.round(e.r * ELITE_SIZE);
  e.hp = Math.round(e.hp * ELITE_HP);
  e.damage = Math.round(e.damage * ELITE_DAMAGE);
  e.speed *= ELITE_SPEED;
  e.xp *= ELITE_XP;
  e.maxHp = e.hp;
  if (e.behavior === "pack") e.packLead = true;   // 엘리트 지옥개도 가까워지면 세 마리로 (상자는 셋 다 잡아야 하나)
  enemies.push(e);
  return e;
}

// 시간표의 한 칸이 실제로 시작되는 시각 (초): 게임 길이에 맞춰 줄이되, 첫 1분 안으로는 당겨지지 않게 함
function eventTime(ev) { return Math.max(Math.min(ev.time, 60), ev.time * TIMELINE_SCALE); }

// 몬스터 떼 등장: 화면 밖에서 출발해, 지금 플레이어가 있는 자리를 지나 반대편으로 날아감
//   typeKey: 몬스터 종류 ("bat", "ghost")   angle: 날아가는 방향   count: 마릿수 (없으면 시간에 따라 늘어나는 기본값)
function spawnSwarm(typeKey, angle, count) {
  const type = stageEnemyType(typeKey);                         // 스테이지마다 같은 자리의 적 (얼음 동굴의 "bat" = 얼음 정령)
  const dirX = Math.cos(angle), dirY = Math.sin(angle);          // 날아가는 방향
  if (!count) count = Math.min(SWARM_COUNT_MAX, Math.round(SWARM_COUNT + SWARM_COUNT_PER_MINUTE * (refTime() / 60)));
  for (let i = 0; i < count; i++) {
    const back = SWARM_START_DISTANCE + Math.random() * SWARM_LENGTH;   // 뒤쪽으로 길게 늘어섬
    const side = (Math.random() - 0.5) * SWARM_WIDTH;                   // 좌우로 흩어짐
    const e = makeEnemy(type, player.x - dirX * back - dirY * side, player.y - dirY * back + dirX * side);
    e.behavior = "swarm";
    e.vx = dirX * SWARM_SPEED;
    e.vy = dirY * SWARM_SPEED;
    e.life = SWARM_LIFETIME;
    enemies.push(e);
  }
}

// 꽃 울타리 등장: 지금 플레이어 자리를 중심으로 식인꽃을 둥글게 심음
//   꽃 수는 원둘레에 맞춰 자동 계산 (틈이 FLOWER_GAP 이 되게). 맵 밖(돌담)에 걸리는 자리는 건너뜀 → 거긴 돌담이 막아 줌
//   MAX_ENEMIES 제한은 받지 않음 (한 송이라도 빠지면 울타리에 구멍이 나므로)
function spawnFlowerRing() {
  const cx = player.x, cy = player.y;
  const count = Math.floor((Math.PI * 2 * FLOWER_RING_RADIUS) / (FLOWER_TYPE.r * 2 + FLOWER_GAP));
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count;
    const x = cx + Math.cos(a) * FLOWER_RING_RADIUS;
    const y = cy + Math.sin(a) * FLOWER_RING_RADIUS;
    if (x < WALL_SIZE || x > WORLD_W - WALL_SIZE || y < WALL_SIZE || y > WORLD_H - WALL_SIZE) continue;
    const e = makeEnemy(FLOWER_TYPE, x, y);
    e.speed = FLOWER_TYPE.speed;        // 조여 오는 속도는 레벨 보정 없이 고정 (빨라지면 피할 틈이 없음)
    e.ringX = cx; e.ringY = cy;         // 울타리의 중심 (플레이어를 따라오지 않고 이 자리로 조여 옴)
    e.wakeTimer = FLOWER_WAKE_TIME;
    enemies.push(e);
  }
}

// 마지막 보스 등장: 화면 밖에서 나타남. 시간·레벨 보정 없이 BOSS_TYPE 의 고정 능력치
function spawnBoss() {
  const { x, y } = randomEdgePosition(80);
  const bt = bossType();                       // 스테이지마다 다른 보스 (표가 없으면 사신 마법사)
  boss = makeEnemy(bt, x, y);
  boss.boss = true;
  boss.name = bt.name; boss.pattern = bt.pattern; boss.summon = bt.summon; boss.ring = bt.ring;
  if (bt.pattern === "yeti") { boss.slamTimer = YETI_SLAM_INTERVAL / 2; boss.rockTimer = YETI_ROCK_INTERVAL; boss.icicleTimer = 0; }
  if (bt.pattern === "demon") { boss.pillarTimer = DEMON_PILLAR_INTERVAL / 2; boss.chargeTimer = DEMON_CHARGE_INTERVAL / 2; boss.meteorTimer = 0; }
  if (bt.pattern === "deathknight") { boss.slashTimer = KNIGHT_SLASH_INTERVAL / 2; boss.teleTimer = KNIGHT_TELE_INTERVAL / 2; boss.crossTimer = 0; }
  if (run) run.bossAt = stats.time;            // 퀘스트 '속전속결'용: 보스가 나온 시각
  boss.r = bt.r; boss.hp = Math.round((bt.hp + BOSS_HP_PER_LEVEL * player.level) * DIFFICULTY * diffDef().boss); boss.maxHp = boss.hp;
  boss.speed = bt.speed; boss.damage = Math.round(bt.damage * DIFFICULTY); boss.xp = 0;
  enemies.push(boss);
  spawnParticles(x, y, bt.color, 30, 260);
  return boss;
}

// 경험치 구슬 떨어뜨리기 (적이 죽은 자리에). value = 이 구슬의 경험치
function spawnGem(x, y, value = 1) {
  const r = GEM_RADIUS + (value >= 2 ? 2 : 0) + (value >= 4 ? 1 : 0);   // 값진 구슬은 조금 큼
  gems.push({ x, y, r, value });
}

// 경험치 구슬 그림: 도트로 찍은 초록 마름모. 네 면의 밝기를 다르게 해서 입체로 보이게 함 (빛은 왼쪽 위에서 옴)
//   점 하나 = 화면 2px (캐릭터·무기 그림의 도트 크기와 비슷하게). 테두리는 연한 초록 (다른 그림처럼 진한 #3F2631 로 했다가 연하게 바꿈)
//   구슬이 화면에 수백 개 깔리므로, 크기·상태별로 작은 그림을 한 번만 만들어 두고 계속 다시 씀
const GEM_DOT = 2;
const GEM_OUTLINE = "#2f9163";
const GEM_FACETS = ["#b9ffd9", "#4be391", "#27c06b", "#128546"];          // 왼쪽 위 · 오른쪽 위 · 왼쪽 아래 · 오른쪽 아래 면
const GEM_FACETS_PULLED = ["#e6fff1", "#a6ffcd", "#7df5b2", "#4fd691"];   // 끌려오는 중: 전체가 밝아짐
const gemImages = {};
function gemImage(r, pulled) {
  const key = r + (pulled ? "p" : "");
  if (gemImages[key]) return gemImages[key];
  const step = r >= GEM_RADIUS + 3 ? 2 : r >= GEM_RADIUS + 2 ? 1 : 0;    // 구슬 크기 3단계: 가로×세로 7×9, 9×11, 11×13 점
  const hw = 3 + step, hh = 4 + step;                                    // 가운데에서 끝까지의 점 수 (가로·세로)
  const inside = (dx, dy) => Math.abs(dy) <= hh && Math.abs(dx) <= Math.round(hw * (1 - Math.abs(dy) / hh));
  const col = pulled ? GEM_FACETS_PULLED : GEM_FACETS;
  const c = document.createElement("canvas");
  c.width = (hw * 2 + 1) * GEM_DOT;
  c.height = (hh * 2 + 1) * GEM_DOT;
  const g = c.getContext("2d");
  for (let dy = -hh; dy <= hh; dy++) {
    for (let dx = -hw; dx <= hw; dx++) {
      if (!inside(dx, dy)) continue;
      const edge = !inside(dx - 1, dy) || !inside(dx + 1, dy) || !inside(dx, dy - 1) || !inside(dx, dy + 1);
      const shine = dx === -1 && dy === -Math.floor(hh / 2);             // 반짝이는 점 하나
      g.fillStyle = edge ? GEM_OUTLINE : shine ? "#ffffff" : col[(dy > 0 ? 2 : 0) + (dx > 0 ? 1 : 0)];
      g.fillRect((dx + hw) * GEM_DOT, (dy + hh) * GEM_DOT, GEM_DOT, GEM_DOT);
    }
  }
  gemImages[key] = c;
  return c;
}

// 보물 상자 떨어뜨리기
//   realOnly = true 면 절대 미믹이 아님 (미믹을 잡고 받는 진짜 상자용)
function spawnChest(x, y, realOnly = false) {
  // 맵 경계 밖에서 죽은 적이 떨어뜨려도 주울 수 있게 맵 안쪽으로 밀어 넣음
  const cx = Math.max(CHEST_RADIUS, Math.min(WORLD_W - CHEST_RADIUS, x));
  const cy = Math.max(CHEST_RADIUS, Math.min(WORLD_H - CHEST_RADIUS, y));
  const mimic = !realOnly && player.level >= MIMIC_MIN_LEVEL && Math.random() < MIMIC_CHANCE;
  chests.push({ x: cx, y: cy, r: CHEST_RADIUS, life: CHEST_LIFETIME, mimic, seed: Math.random() * 10 });
}

// 미믹 상자에 닿았을 때: 보상 대신 몬스터로 변함
function wakeMimic(chest) {
  chest.dead = true;
  const e = makeEnemy(MIMIC_TYPE, chest.x, chest.y);
  e.wakeTimer = MIMIC_WAKE_TIME;       // 잠깐 제자리에서 번쩍이다가 덤벼듦 (도망칠 틈)
  enemies.push(e);
  floatTexts.push({ x: chest.x, y: chest.y - 20, text: "미믹!", color: "#ff1744", life: 1.2, maxLife: 1.2 });
  spawnParticles(chest.x, chest.y, "#ff1744", 10, 160);
}

// weight 가 있는 목록에서 하나 뽑기 (weight 가 클수록 잘 나옴)
function pickWeighted(list) {
  const total = list.reduce((sum, r) => sum + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of list) {
    roll -= r.weight;
    if (roll < 0) return r;
  }
  return list[0];
}

// 진화 조건: 무기가 최대 레벨이고, 짝이 되는 패시브도 최대 레벨
function canEvolve(w) {
  const d = WEAPONS[w.type];
  if (!d.evolvesTo || w.level < WEAPON_MAX_LEVEL) return false;
  return passiveLevel(d.needs) >= PASSIVES[d.needs].maxLevel;
}

// 상자 열기: 게임을 멈추고, 가진 무기·능력을 1·3·5개 자동 강화한 뒤 룰렛 연출을 보여줌
//   forcedCount 를 주면 그 개수만큼 강화 (테스트용)
function openChest(chest, forcedCount) {
  chest.dead = true;
  state = "chest";
  run.chests += 1;
  playSfx("chest");                     // 다회차: 퀘스트용 상자 수
  effects.push({ kind: "chest", x: chest.x, y: chest.y, life: 0.8, maxLife: 0.8 });
  spawnParticles(chest.x, chest.y, "#ffd60a", 12, 160);

  // 강화는 여는 순간 바로 적용하고, 화면에는 룰렛이 끝난 뒤에 보여줌
  // 클로버(패시브): 3개·5개가 나올 비중이 행운만큼 커짐
  const counts = CHEST_COUNTS.map((c) => ({ count: c.count, weight: c.count > 1 ? c.weight * luckMul() : c.weight }));
  const count = forcedCount || pickWeighted(counts).count;
  const icons = buildUpgradePool(false).map((u) => u.iconUrl);   // 구슬 슬롯에서 돌아갈 그림들
  const gains = [];

  // 진화: 최대 레벨 무기 + 짝 패시브가 있으면 상자 하나당 하나씩 진화 (원작과 같음)
  const evolvable = player.weapons.find((w) => canEvolve(w));
  if (evolvable) {
    const from = WEAPONS[evolvable.type], to = WEAPONS[from.evolvesTo];
    run.evoMask |= 1 << Math.max(0, Object.keys(EVOLUTIONS).indexOf(evolvable.type));   // 퀘스트 '진화 도감'용: 어떤 무기를 진화시켰는지
    evolvable.type = from.evolvesTo;
    run.evos += 1;
    playSfx("evolve");                     // 다회차: 퀘스트용 진화 수
    evolvable.level = WEAPON_MAX_LEVEL;
    evolvable.timer = 0;
    gains.push({ title: `진화! ${from.name} → ${to.name}`, desc: to.desc, iconUrl: weaponIconUrl(evolvable.type), evolved: true });
    spawnParticles(player.x, player.y, "#ffd60a", 30, 240);
  }
  for (let i = gains.length; i < count; i++) {
    const pool = buildUpgradePool(false);        // 새 무기는 안 나옴. 가진 것만 강화
    if (pool.length === 0) break;
    const pick = pool[Math.floor(Math.random() * pool.length)];   // 강화할 게 남아 있으면 금화는 안 나옴
    pick.apply();
    gains.push(pick);
  }
  if (gains.length === 0) {
    // 강화할 것이 하나도 없으면 금화만 (10~30 랜덤). 룰렛은 그대로 돌고 결과로 금화 한 줄이 나옴
    const gold = maxedPicks(maxedChestGold())[1];
    gold.apply();
    gains.push(gold);
  }

  startChestRoll(icons, gains);
  return gains;
}

// 상자 창 연출 (뱀서식): 큰 상자가 흔들리다 열리면 빛기둥이 솟고 금화·반짝이가 튀고, 보상 구슬이 상자에서 날아올라
//   슬롯처럼 그림이 돌다가 하나씩 멈춤. 아래 칸에는 고른 구슬의 이름·설명 (구슬을 누르면 바뀜). 다 멈추면 '받기' 버튼이 켜짐
//   연출 도중에 상자 무대를 누르면 바로 끝까지 넘어감. 꾸미기에는 Math.random 을 안 씀 (자동 시험기의 고정 난수 순서가 안 바뀌게)
const CHEST_STAGE_W = 340, CHEST_STAGE_H = 260;   // 상자 무대 크기 (style.css 의 #chestStage 와 같게)
const CHEST_MOUTH_Y = 78;                          // 상자 입구 높이 (무대 위에서부터 %). 구슬·금화가 여기서 나옴
const CHEST_ORB_SPOTS = [                          // 보상 개수별 구슬 자리 (무대 안 % 좌표). 원작처럼 1개 = 가운데, 3개 = V자, 5개 = X자
  [],
  [[50, 30]],
  [[30, 30], [70, 30]],
  [[22, 22], [50, 40], [78, 22]],
  [[22, 18], [78, 18], [22, 48], [78, 48]],
  [[18, 16], [82, 16], [50, 32], [22, 50], [78, 50]],
];
const CHEST_SHAKE_TIME = 0.6;   // 닫힌 상자가 흔들리는 시간 (초). 그 뒤 열리고 구슬 그림이 돌다가 CHEST_ROLL_TIME 에 첫 구슬이 멈춤
const CHEST_STOP_GAP = 0.3;     // 구슬이 하나씩 멈추는 간격 (초)
const CHEST_NOTES = [0, 4, 7, 12, 16];   // 구슬이 멈출 때마다 내는 코인 소리의 음 (반음 단위: 도·미·솔·높은 도·높은 미). 많이 나올수록 높이 올라감 (뱀서처럼)
const CHEST_NOTE_VOL = 0.7;

function startChestRoll(icons, gains) {
  cancelChestRoll();
  const n = Math.min(5, gains.length);
  if (icons.length === 0) icons = gains.map((g) => g.iconUrl);   // 더 강화할 게 없으면(전부 만렙) 실제로 받을 보상 그림을 돌림
  chestRoll = { gains, icons, shown: 0, timers: [], orbs: [], opened: false, gold: gains.reduce((sum, g) => sum + (g.gold || 0), 0) };
  chestOrbs.innerHTML = "";
  chestCoins.innerHTML = "";
  chestInfo.innerHTML = "";
  chestGold.style.visibility = "hidden";                      // 금화 칸 자리는 늘 잡아 둠 (나타날 때 창이 늘어나 제목이 움직이지 않게)
  chestImg.src = "assets/chest.png";
  chestStage.className = `n${n} shaking`;                     // n1·n3·n5: 빛기둥 색 (1개 흰빛, 3개 하늘색, 5개 무지개)
  chestOk.disabled = true;
  chestBox.style.display = "flex";

  CHEST_ORB_SPOTS[n].forEach(([x, y], i) => {
    const orb = document.createElement("button");
    orb.type = "button";
    orb.className = "chest-orb";
    orb.style.left = `${x}%`;
    orb.style.top = `${y}%`;
    orb.style.setProperty("--fx", `${((50 - x) / 100) * CHEST_STAGE_W}px`);              // 상자 입구에서 날아오르게: 입구까지의 거리
    orb.style.setProperty("--fy", `${((CHEST_MOUTH_Y - y) / 100) * CHEST_STAGE_H}px`);
    orb.innerHTML = `<img alt="">`;
    orb.addEventListener("click", () => { if (orb.classList.contains("landed")) showChestInfo(i); });
    chestOrbs.appendChild(orb);
    chestRoll.orbs.push(orb);
  });

  chestRoll.timers.push(setTimeout(openChestFx, CHEST_SHAKE_TIME * 1000));
  for (let i = 0; i < n; i++) chestRoll.timers.push(setTimeout(() => { landChestOrb(i); playSfxPitch("gem", CHEST_NOTES[i], CHEST_NOTE_VOL); }, (CHEST_ROLL_TIME + CHEST_STOP_GAP * i) * 1000));
  chestRoll.timers.push(setTimeout(() => { chestOk.disabled = false; }, (CHEST_ROLL_TIME + CHEST_STOP_GAP * (n - 1)) * 1000 + 200));
}

// 상자가 열리는 순간: 열린 상자 그림 + 별 터짐·빛기둥, 금화(금화가 섞였으면)·반짝이가 튀고, 구슬이 날아올라 그림이 돌기 시작
function openChestFx() {
  if (!chestRoll || chestRoll.opened) return;
  chestRoll.opened = true;
  chestImg.src = "assets/chest_open.png";
  chestStage.className = chestStage.className.replace("shaking", "open");
  const coin = chestRoll.gold > 0;
  for (let i = 0; i < 18; i++) {
    const a = i * 2.39996;                             // 황금각으로 퍼뜨려서 고르게 (난수 대신)
    const p = document.createElement("i");
    p.className = coin ? "coin" : "spark";
    p.style.setProperty("--dx", `${Math.cos(a) * (60 + (i % 5) * 22)}px`);
    p.style.setProperty("--up", `${-90 - (i % 4) * 30}px`);
    p.style.setProperty("--down", `${30 + (i % 3) * 25}px`);
    p.style.animationDelay = `${(i % 6) * 0.04}s`;
    chestCoins.appendChild(p);
  }
  for (const orb of chestRoll.orbs) orb.classList.add("out");
  let k = 0;
  const reel = setInterval(() => {                     // 슬롯처럼 그림 돌리기 (아직 안 멈춘 구슬만)
    chestRoll.orbs.forEach((orb, i) => {
      if (!orb.classList.contains("landed")) orb.firstChild.src = chestRoll.icons[(k + i * 3) % chestRoll.icons.length];
    });
    k += 1;
  }, 70);
  chestRoll.timers.push(reel);
  if (coin) {                                           // 위쪽 금화 숫자가 0 에서 올라감
    chestGold.style.visibility = "";
    const total = chestRoll.gold, start = performance.now(), span = (CHEST_ROLL_TIME - CHEST_SHAKE_TIME + CHEST_STOP_GAP * chestRoll.orbs.length) * 1000;
    const count = setInterval(() => {
      const t = Math.min(1, (performance.now() - start) / span);
      chestGoldNum.textContent = Math.round(total * t);
      if (t >= 1) clearInterval(count);
    }, 40);
    chestRoll.timers.push(count);
  }
}

// 구슬 하나가 멈춤: 실제 보상 그림으로 바뀌며 톡 튀고, 아래 칸에 그 보상 설명
function landChestOrb(i) {
  const orb = chestRoll.orbs[i], g = chestRoll.gains[i];
  orb.firstChild.src = g.iconUrl;
  orb.classList.add("landed");
  if (g.evolved) orb.classList.add("evolved");
  if (g.gold) orb.classList.add("gold");
  chestRoll.shown = Math.max(chestRoll.shown, i + 1);
  showChestInfo(i);
}

// 아래 칸: 고른 보상의 이름·설명 + 몇 번째인지 (예: 2/3)
function showChestInfo(i) {
  const g = chestRoll.gains[i];
  chestRoll.orbs.forEach((orb, j) => { orb.classList.toggle("sel", j === i); });
  const row = document.createElement("div");
  row.className = `gain${g.evolved ? " evolved" : ""}`;
  row.innerHTML = `${g.title}<small>${g.desc}</small>`;
  setIcon(row, g.iconUrl);
  chestInfo.innerHTML = "";
  chestInfo.appendChild(row);
  if (chestRoll.orbs.length > 1) chestInfo.insertAdjacentHTML("beforeend", `<span class="pager">${i + 1}/${chestRoll.orbs.length}</span>`);
}

// 연출을 건너뛰고 결과를 전부 보여줌 (상자 무대를 누를 때, 자동 시험기 tests/autoplay.test.ts)
function finishChestRoll() {
  if (!chestRoll) return;
  for (const t of chestRoll.timers) { clearInterval(t); clearTimeout(t); }
  chestRoll.timers = [];
  openChestFx();
  for (const t of chestRoll.timers) { clearInterval(t); clearTimeout(t); }   // 방금 연 것의 그림 돌리기·금화 세기도 멈춤
  chestRoll.timers = [];
  for (let i = chestRoll.shown; i < chestRoll.orbs.length; i++) landChestOrb(i);
  if (chestRoll.gold > 0) chestGoldNum.textContent = chestRoll.gold;
  chestOk.disabled = false;
}

function cancelChestRoll() {
  if (chestRoll) for (const t of chestRoll.timers) { clearInterval(t); clearTimeout(t); }
  chestRoll = null;
}

// '받기' 버튼: 창을 닫고 게임 재개
function closeChest() {
  if (state !== "chest" || chestOk.disabled) return;
  cancelChestRoll();
  chestBox.style.display = "none";
  resumeGame();
}

// ---------------------------------------------------------------------
// 바닥 아이템 (물약)
// ---------------------------------------------------------------------
function spawnItem(x, y, forcedKey) {
  let type = ITEM_TYPES.find((t) => t.key === forcedKey);
  if (!type) {
    // 뽑기: 난이도가 높으면 모든 아이템의 몫이 줄고, 줄어든 만큼은 '꽝'(아무것도 안 떨어짐)
    const total = ITEM_TYPES.reduce((sum, t) => sum + t.weight, 0);
    let roll = Math.random() * total;
    for (const t of ITEM_TYPES) {
      const w = t.weight * (diffDef().item || 1);
      if (roll < w) { type = t; break; }
      roll -= w;
    }
    if (!type) return;
  }
  const ix = Math.max(ITEM_RADIUS, Math.min(WORLD_W - ITEM_RADIUS, x));
  const iy = Math.max(ITEM_RADIUS, Math.min(WORLD_H - ITEM_RADIUS, y));
  items.push({ x: ix, y: iy, r: ITEM_RADIUS, life: ITEM_LIFETIME, type });
}

// 아이템에 닿았을 때: 종류에 따라 바로 발동
function useItem(item) {
  item.dead = true;
  if (run) run.items += 1;                       // 퀘스트 '줍줍'용
  const type = item.type;
  floatTexts.push({ x: item.x, y: item.y - 16, text: type.text, color: type.color, life: 1.4, maxLife: 1.4 });
  spawnParticles(item.x, item.y, type.color, 8, 140);
  playSfx(type.key === "wipe" ? "explode" : "item");   // 해골(화면 적 전멸)은 폭발음

  if (type.key === "heal") {
    player.hp = Math.min(player.maxHp, player.hp + ITEM_HEAL);
  } else if (type.key === "magnet") {
    // 화면의 모든 구슬이 거리와 상관없이 끌려옴
    for (const g of gems) { g.magnet = true; g.speed = Math.max(g.speed || 0, 400); }
  } else if (type.key === "wipe") {
    // 화면의 적 전멸 (화면 밖 적은 그대로). 엘리트는 죽지 않고 최대 체력의 일부만 깎임
    for (const e of enemies) {
      if (e.dead || !inView(e.x, e.y, e.r)) continue;
      damageEnemy(e, e.boss ? Math.ceil(e.maxHp * 0.1) : e.elite ? Math.ceil(e.maxHp * CROSS_ELITE_DAMAGE) : e.hp);
    }
    enemyBullets = [];
    effects.push({ x: player.x, y: player.y, r: Math.hypot(W, H), life: 0.35, maxLife: 0.35 });
  } else if (type.key === "freeze") {
    freezeTimer = FREEZE_TIME * durationMul();   // 주문서(패시브)로 더 길게
  }
}

// 레벨업에 필요한 경험치 (레벨이 높을수록 가파르게 늘어남)
function xpNeedFor(level) {
  const n = level - 1;
  return XP_BASE + XP_GROWTH * n + XP_CURVE * n * n;
}

// 적에게 피해 주기. 죽으면 처치 수 +1, 구슬 떨어뜨림 (모든 무기가 이 함수를 씀)
function damageEnemy(e, dmg) {
  if (e.dead || e.vanished) return;   // 순간이동으로 사라진 죽음의 기사는 맞지 않음
  e.hurtAt = stats.time;              // 미라 회복: 마지막으로 맞은 시각
  // 난이도 테마 · 붉은 게의 껍질: 남아 있으면 이번 공격은 껍질만 깨고 끝 (피해 없음)
  if (e.shell > 0) {
    e.shell -= 1;
    e.hitFlash = HIT_FLASH_TIME;
    playSfx("hit");
    spawnParticles(e.x, e.y, themeColor(1), 6, 160);
    return;
  }
  e.hp -= dmg;

  // 피격 이펙트: 흰색으로 번쩍 + 작은 불꽃
  e.hitFlash = HIT_FLASH_TIME;
  if (e.hp > 0) playSfx("hit");
  spawnParticles(e.x, e.y, "#ffffff", HIT_SPARKS, 120);

  if (e.hp <= 0) {
    e.dead = true;
    stats.kills += 1;
    playSfx("kill");
    if (run && e.killStat) run[e.killStat] += 1;   // 퀘스트용 (얼음 원소 → '껍질 까기')
    if (charDef().healEvery && stats.kills % charDef().healEvery === 0) player.hp = Math.min(player.maxHp, player.hp + charDef().heal);   // 성녀: 처치할 때마다 조금씩 회복
    if (e.boss) { gameClear(); return; }                                // 보스를 잡으면 클리어
    spawnGem(e.x, e.y, e.xp);
    if (e.type === "mimic") {
      spawnChest(e.x, e.y, true);                                  // 미믹을 잡으면 진짜 상자를 반드시 떨어뜨림
    } else if (e.elite) {
      // 엘리트를 잡으면 상자를 반드시 떨어뜨림 (20레벨부터는 미믹일 수도). 세 마리로 늘어난 엘리트 지옥개는 마지막 한 마리를 잡을 때만
      if (!e.packId || !enemies.some((o) => o !== e && !o.dead && o.packId === e.packId)) {
        spawnChest(e.x, e.y);
        if (run) run.elites += 1;                                  // 퀘스트 '정예 사냥꾼'용
      }
    } else if (Math.random() < ITEM_DROP_CHANCE * luckMul()) {          // 클로버(패시브)가 있으면 더 자주
      spawnItem(e.x, e.y);                                         // 일반 몬스터: 낮은 확률로 바닥 아이템
    }

    // 처치 이펙트: 적 색깔 파편이 사방으로 퍼짐 + 바깥으로 퍼지는 고리
    spawnParticles(e.x, e.y, e.color, DEATH_PARTICLES, 180);
    effects.push({ kind: "ring", x: e.x, y: e.y, r: e.r, color: e.color, life: 0.25, maxLife: 0.25 });

    // 난이도 테마 · 외눈 거인: 죽은 자리에 가끔 끈적한 자국을 남김 (잠깐 뒤부터 밟으면 크게 느려짐. 피해는 없음)
    if (e.leavesHazard) {
      const life = CYCLOPS_HAZARD_LIFE[enemyTier()] + HAZARD_ARM_TIME;
      if ((e.elite || Math.random() < CYCLOPS_HAZARD_CHANCE[enemyTier()]) && hazards.length < CYCLOPS_HAZARD_MAX) {
        hazards.push({ x: e.x, y: e.y, r: CYCLOPS_HAZARD_RADIUS * (e.elite ? 1.4 : 1), life, maxLife: life, arm: HAZARD_ARM_TIME, quest: !!e.hazardQuest });
      }
    }

    // 용암 골렘: 죽은 자리에 주황 경고 원이 차오른 뒤 폭발 (원 안이면 몸 피해만큼. final = 이미 난이도 배수를 곱한 피해)
    if (e.deathBlast) {
      bossMarks.push({ x: e.x, y: e.y, r: GOLEM_BLAST_RADIUS * (e.elite ? 1.4 : 1), time: GOLEM_BLAST_TIME, maxTime: GOLEM_BLAST_TIME, damage: e.damage, final: true, rgb: DEMON_RGB, fx: "fx_blast" });
    }

    // 거미(분열): 죽은 자리 양옆에 작은 적이 갈라져 나옴. splitType 이 있으면(얼음 원소) 그 종류가 제 크기로 나옴
    // (적 목록을 도는 중일 수 있어서 바로 넣지 않고 pendingSpawns에 모아둠)
    for (let i = 0; i < e.splitInto; i++) {
      const angle = (Math.PI * 2 * i) / e.splitInto + Math.random();
      const type = findEnemyType(e.splitType || e.type);
      if (e.splitGens) { pendingSpawns.push(makeSplitChild(e, type, angle)); continue; }
      pendingSpawns.push(makeEnemy(type, e.x + Math.cos(angle) * 14, e.y + Math.sin(angle) * 14, !e.splitType));
    }
  }
}

// =====================================================================
// 7. 목표 찾기
// =====================================================================
// 가장 가까운 적
function findNearestEnemy() {
  // 보스전: 보스가 사정거리(BOSS_FOCUS_RANGE) 안에 있으면 부하보다 보스를 먼저 노림
  if (boss && !boss.dead && Math.hypot(boss.x - player.x, boss.y - player.y) < BOSS_FOCUS_RANGE) return boss;

  let nearest = null;
  let nearestDist = Infinity;

  for (const e of enemies) {
    if (e.dead) continue;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = dx * dx + dy * dy;   // 제곱근은 생략해도 비교에는 문제 없음
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = e;
    }
  }
  return nearest;
}

// 적 e 가 광선 줄 안에 들어 있는지 (가로줄이면 y, 세로줄이면 x 를 비교)
function isInLine(e, line, half) {
  const offset = line.horizontal ? e.y - line.pos : e.x - line.pos;
  return Math.abs(offset) < half + e.r;
}

// 가로줄·세로줄 가운데 적이 가장 많이 걸리는 줄 찾기 (마법 지팡이 목표용)
//   각 적의 위치를 줄의 중심 후보로 놓고, 그 줄에 걸리는 적 수를 세서 가장 많은 것을 고름
function findBestLine(half) {
  const onScreen = enemies.filter((e) => !e.dead && inView(e.x, e.y));
  let best = null;
  for (const horizontal of [true, false]) {
    for (const center of onScreen) {
      const line = { horizontal, pos: horizontal ? center.y : center.x };
      let count = 0;
      for (const e of onScreen) if (isInLine(e, line, half)) count++;
      if (!best || count > best.count) best = { ...line, count };
    }
  }
  return best;
}

// =====================================================================
// 8. 무기 발동: 매 프레임 모든 무기의 타이머를 돌림
// =====================================================================
function updateWeapons(dt) {
  for (const w of player.weapons) {
    const def = WEAPONS[w.type];

    // 매 프레임 실행되는 것 (회전 도끼 움직임, 보호막 재충전 등)
    if (def.update) def.update(w, dt);

    // 간격마다 실행되는 것 (탄환, 창, 오라, 폭탄)
    if (def.fire && def.interval > 0) {
      w.timer -= dt;
      if (w.timer <= 0) {
        fireWeapon(w, def);
        const base = def.getInterval ? def.getInterval(w) : def.interval;
        w.timer = base * player.attackSpeed;
        // 복제기: Lv1은 3회, Lv2는 2회마다 한 번 더. 빠른 무기도 앞서 예약한 발사를 지우지 않음.
        w.volleyCount = (w.volleyCount || 0) + 1;
        if (!def.noAmount && extraAmount() > 0 && w.volleyCount % (4 - extraAmount()) === 0) {
          w.refire = w.refire || [];
          w.refire.push(0.12);
        }
      }
    }
    // 복제기로 예약된 추가 발사
    if (w.refire?.length) {
      w.refire = w.refire.map((t) => t - dt);
      while (w.refire.length && w.refire[0] <= 0) { w.refire.shift(); fireWeapon(w, def); }
    }
  }
}

// 무기 한 번 발사 + 이번에 새로 생긴 발사체에 팔보호대(패시브) 속도 배수 적용
function fireWeapon(w, def) {
  const before = bullets.length;
  def.fire(w);
  const m = projSpeedMul();
  if (m === 1) return;
  for (let i = before; i < bullets.length; i++) {
    const b = bullets[i];
    b.vx *= m; b.vy *= m;
    if (b.ax) { b.ax *= m; b.ay *= m; }
  }
}

// 무기 한 방의 피해 = (기본 공격력 + 무기 고유 보너스) × 무기 레벨 보정
//   기본 공격력은 '강한 공격' 카드로, 레벨 보정은 그 무기를 강화할 때마다 +20%
function weaponDamage(w, bonus = 0) {
  return (player.damage + bonus) * (1 + WEAPON_LEVEL_DAMAGE * (w.level - 1)) * damageMul() * (WEAPONS[w.type]?.damageMul || 1);   // 힘(패시브) 배수 × 진화 배수
}

// 적을 (fromX, fromY) 반대쪽으로 power 픽셀만큼 밀어냄 (엘리트는 절반만)
function pushEnemy(e, fromX, fromY, power) {
  if (e.boss) return;                                   // 보스는 밀리지 않음
  const dx = e.x - fromX, dy = e.y - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const p = e.elite ? power * 0.5 : power;
  e.x += (dx / len) * p;
  e.y += (dy / len) * p;
}

// 검은 진흙(여러 번 분열): 갈라질 때마다 작아지고(SPLIT_SHRINK) 체력·경험치는 절반, 조금 빨라짐. splitGens 번째 조각은 더 안 갈라짐
function makeSplitChild(parent, type, angle) {
  const c = makeEnemy(type, parent.x + Math.cos(angle) * parent.r * 0.8, parent.y + Math.sin(angle) * parent.r * 0.8);
  c.gen = (parent.gen || 0) + 1;
  c.r = Math.round(parent.r * SPLIT_SHRINK);
  c.hp = c.maxHp = Math.max(1, Math.round(parent.maxHp / 2));
  c.xp = Math.max(1, Math.round(parent.xp / 2));
  c.speed = parent.speed * 1.15;
  c.damage = Math.ceil(parent.damage * 0.75);
  c.splitInto = c.gen < parent.splitGens ? parent.splitInto : 0;
  return c;
}

// 서리 망령의 찬 기운·예티의 땅 내리치기: 잠깐 느려지게 함 (발밑에 테마 색 고리)
function chillPlayer(time = CHILL_TIME) {
  player.chillTimer = Math.max(player.chillTimer || 0, time);
  player.slowTimer = Math.max(player.slowTimer || 0, time);
}

// 북극곰: 부딪힌 적의 반대쪽으로 잠깐 밀려남 (돌담 밖으로는 안 나감 — updatePlayer 가 가둠)
function knockPlayer(e) {
  const dx = player.x - e.x, dy = player.y - e.y, len = Math.hypot(dx, dy) || 1;
  player.knockVX = (dx / len) * KNOCKBACK_SPEED;
  player.knockVY = (dy / len) * KNOCKBACK_SPEED;
  player.knockTimer = KNOCKBACK_TIME;
}

// 플레이어가 피해를 입을 때 (적에게 닿음, 적 탄환에 맞음). 보호막이 켜져 있으면 대신 막아 줌
function hurtPlayer(amount) {
  playSfx("hurt");
  if (run) { run.hits += 1; run.noHit = 0; }   // 퀘스트용: 맞은 횟수, '안 맞고 버틴 시간'은 처음부터 다시
  const shield = player.weapons.find((w) => (w.type === "shield" || w.type === "shield_evo") && w.ready);
  const victory = player.weapons.find((w) => w.type === "victory");
  if (victory) WEAPONS.victory.retaliate(victory);          // 승리의 검: 맞으면 반격
  if (shield) {
    WEAPONS[shield.type].breakShield(shield);
  } else {
    player.hp -= Math.max(1, amount - passiveLevel("armor") - upLevel("armor"));   // 갑옷(게임 중) + 상점 '방어': 단계당 -1, 최소 1
  }
  player.invincible = INVINCIBLE_TIME;   // 막았을 때도 잠깐 무적 (연달아 맞지 않게)
}

// =====================================================================
// 9. 두 원이 닿았는지 검사 (충돌 판정)
// =====================================================================
function circlesTouch(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy) < a.r + b.r;
}
