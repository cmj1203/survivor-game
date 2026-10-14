// =====================================================================
// 6. 적 만들기: 지금 보이는 화면의 바깥 가장자리 아무 곳에서 등장
// =====================================================================
function spawnEnemy() {
  const { x, y } = randomEdgePosition(30);    // 화면 밖 30px 지점 (맵 안쪽 변만)
  enemies.push(makeEnemy(pickEnemyType(), x, y));
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
  return ENEMY_TYPES[enemyStage() % ENEMY_TYPES.length];
}

// 이번에 나올 적 종류 고르기: 새 몬스터 비율은 레벨업 후 서서히 늘어나고, 나머지는 기존 몬스터
function pickEnemyType() {
  const current = currentEnemyType();
  const stage = enemyStage();
  const unlocked = ENEMY_TYPES.slice(0, Math.min(stage + 1, ENEMY_TYPES.length));
  const olds = unlocked.filter((t) => t !== current);
  if (olds.length === 0) return current;             // 첫 단계: 박쥐뿐

  // 새 몬스터가 나올 확률 (레벨업 후 시간이 지날수록 커짐)
  if (Math.random() < newEnemyShare()) return current;

  // 기존 몬스터: 대부분은 바로 전 단계의 주력, 가끔 더 옛날 몬스터
  const len = ENEMY_TYPES.length;
  const prevMain = ENEMY_TYPES[(stage - 1 + len) % len];
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

  // 난이도 테마: 그림을 테마 색으로 바꾸고, 적 종류마다 특성을 하나씩 붙임 (보통 난이도는 tier 0 이라 그대로)
  const tier = enemyTier(), theme = diffDef().theme;
  e.baseShape = type.shape;
  if (theme && THEMED_SPRITES.includes(type.shape)) e.shape = `${type.shape}_${theme}`;
  if (tier > 0) {
    if (type.key === "crab") e.shell = CRAB_SHELL[tier];                                            // 껍질: 공격을 몇 번 막음
    if (type.key === "spider" && !isChild) e.splitInto = SPIDER_SPLIT[tier];                        // 분열: 새끼가 더 많이
    if (type.key === "ghost") e.blinkTimer = GHOST_BLINK_INTERVAL[tier] * (0.5 + Math.random());   // 순간이동 (적마다 박자가 어긋나게)
    if (type.key === "cyclops") e.leavesHazard = true;                                              // 죽으면 위험한 자국
    if (type.key === "bat") e.rush = true;                                                          // 가까이 오면 돌격
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
  enemies.push(e);
  return e;
}

// 시간표의 한 칸이 실제로 시작되는 시각 (초): 게임 길이에 맞춰 줄이되, 첫 1분 안으로는 당겨지지 않게 함
function eventTime(ev) { return Math.max(Math.min(ev.time, 60), ev.time * TIMELINE_SCALE); }

// 몬스터 떼 등장: 화면 밖에서 출발해, 지금 플레이어가 있는 자리를 지나 반대편으로 날아감
//   typeKey: 몬스터 종류 ("bat", "ghost")   angle: 날아가는 방향   count: 마릿수 (없으면 시간에 따라 늘어나는 기본값)
function spawnSwarm(typeKey, angle, count) {
  const type = ENEMY_TYPES.find((t) => t.key === typeKey);
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
  boss = makeEnemy(BOSS_TYPE, x, y);
  boss.boss = true;
  if (run) run.bossAt = stats.time;            // 퀘스트 '속전속결'용: 보스가 나온 시각
  boss.r = BOSS_TYPE.r; boss.hp = Math.round((BOSS_TYPE.hp + BOSS_HP_PER_LEVEL * player.level) * DIFFICULTY * diffDef().boss); boss.maxHp = boss.hp;
  boss.speed = BOSS_TYPE.speed; boss.damage = Math.round(BOSS_TYPE.damage * DIFFICULTY); boss.xp = 0;
  enemies.push(boss);
  spawnParticles(x, y, "#9b5de5", 30, 260);
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
  const names = buildUpgradePool(false).map((u) => u.title);   // 룰렛에 돌아갈 이름들
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
    const pick = pool[Math.floor(Math.random() * pool.length)];
    pick.apply();
    gains.push(pick);
  }
  if (gains.length === 0) {
    // 강화할 것이 하나도 없으면 룰렛 대신 고르는 창: 체력 전부 회복, 또는 금화 조금 (상자가 주려던 강화 개수만큼)
    showCards("보물 상자", "더 강화할 것이 없어요. 하나를 고르세요", null, maxedPicks(count * MAXED_GOLD));
    return gains;
  }

  startChestRoll(names, gains);
  return gains;
}

// 룰렛 연출: 이름이 빠르게 바뀌다가 멈추고, 결과가 하나씩 나타난 뒤 '받기' 버튼이 켜짐
function startChestRoll(names, gains) {
  cancelChestRoll();
  chestSlot.textContent = "";
  chestList.innerHTML = "";
  chestOk.disabled = true;
  chestBox.style.display = "flex";

  chestRoll = { gains, shown: 0, timers: [] };
  if (names.length === 0) names = gains.map((g) => g.title);   // 더 강화할 게 없으면(전부 만렙) 실제로 받을 보상 이름을 돌림 (예전엔 "?" 가 보였음)
  if (names.length === 0) names = ["보물"];
  const spin = setInterval(() => {
    chestSlot.textContent = names[Math.floor(Math.random() * names.length)];
  }, 70);
  chestRoll.timers.push(spin);
  chestRoll.timers.push(setTimeout(() => {
    clearInterval(spin);
    chestSlot.textContent = `강화 ${gains.length}개!`;
    gains.forEach((g, i) => {
      chestRoll.timers.push(setTimeout(() => showChestGain(g), 250 * i));
    });
    chestRoll.timers.push(setTimeout(() => { chestOk.disabled = false; }, 250 * gains.length));
  }, CHEST_ROLL_TIME * 1000));
}

// 강화 결과 한 줄을 창에 추가
function showChestGain(g) {
  const row = document.createElement("div");
  row.className = `gain${g.evolved ? " evolved" : ""}`;
  row.innerHTML = `${g.title}<small>${g.desc}</small>`;
  setIcon(row, g.iconUrl);
  chestList.appendChild(row);
  if (chestRoll) chestRoll.shown += 1;
}

// 룰렛 연출을 건너뛰고 결과를 전부 보여줌 (자동 시험기 tests/autoplay.test.ts 에서 씀)
function finishChestRoll() {
  if (!chestRoll) return;
  for (const t of chestRoll.timers) { clearInterval(t); clearTimeout(t); }
  chestRoll.timers = [];
  chestSlot.textContent = `강화 ${chestRoll.gains.length}개!`;
  for (let i = chestRoll.shown; i < chestRoll.gains.length; i++) showChestGain(chestRoll.gains[i]);
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
    // 화면의 적 전멸. 엘리트는 죽지 않고 최대 체력의 일부만 깎임
    for (const e of enemies) {
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
  if (e.dead) return;
  // 난이도 테마 · 붉은 게의 껍질: 남아 있으면 이번 공격은 껍질만 깨고 끝 (피해 없음)
  if (e.shell > 0) {
    e.shell -= 1;
    if (run) run.shells += 1;                    // 퀘스트 '껍질 까기'용
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
    if (charDef().healEvery && stats.kills % charDef().healEvery === 0) player.hp = Math.min(player.maxHp, player.hp + charDef().heal);   // 성녀: 처치할 때마다 조금씩 회복
    if (e.boss) { gameClear(); return; }                                // 보스를 잡으면 클리어
    spawnGem(e.x, e.y, e.xp);
    if (e.type === "mimic") {
      spawnChest(e.x, e.y, true);                                  // 미믹을 잡으면 진짜 상자를 반드시 떨어뜨림
    } else if (e.elite) {
      spawnChest(e.x, e.y);                                        // 엘리트를 잡으면 상자를 반드시 떨어뜨림 (20레벨부터는 미믹일 수도)
      if (run) run.elites += 1;                                    // 퀘스트 '정예 사냥꾼'용
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
        hazards.push({ x: e.x, y: e.y, r: CYCLOPS_HAZARD_RADIUS * (e.elite ? 1.4 : 1), life, maxLife: life, arm: HAZARD_ARM_TIME });
      }
    }

    // 거미(분열): 죽은 자리 양옆에 작은 적이 갈라져 나옴
    // (적 목록을 도는 중일 수 있어서 바로 넣지 않고 pendingSpawns에 모아둠)
    for (let i = 0; i < e.splitInto; i++) {
      const angle = (Math.PI * 2 * i) / e.splitInto + Math.random();
      const type = ENEMY_TYPES.find((t) => t.key === e.type);
      pendingSpawns.push(makeEnemy(type, e.x + Math.cos(angle) * 14, e.y + Math.sin(angle) * 14, true));
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
