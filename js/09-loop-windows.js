// =====================================================================
// 12. 게임 루프: 1초에 약 60번 update → draw 반복
// =====================================================================
// 히트스톱·화면 흔들림: 정예·보스를 잡거나 보스를 크게 때렸을 때 kickScreen 이 켬
const HIT_STOP_TIME = 0.04;   // 히트스톱 시간 (초, 실제 시간): 이 동안은 update 를 건너뛰고 그리기만 함
const SHAKE_TIME = 0.15;      // 화면 흔들림 시간 (초)
const SHAKE_PX = 3;           // 화면 흔들림 세기 (px, 점점 약해짐)
const REDUCE_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;   // 기기에서 '동작 줄이기'를 켰으면 흔들지 않음
let hitStop = 0;              // 남은 히트스톱 시간 (초)
let shakeUntil = 0;           // 화면 흔들림이 끝나는 시각 (performance.now, ms)
function kickScreen() {
  hitStop = HIT_STOP_TIME;
  if (!REDUCE_MOTION) shakeUntil = performance.now() + SHAKE_TIME * 1000;
}
// 지금 화면을 옮길 양 [x, y]. Math.random 대신 sin 을 써서 게임의 무작위 순서를 건드리지 않음 (자동 플레이 시험 기록이 그대로)
function shakeOffset() {
  const left = shakeUntil - performance.now();
  if (left <= 0) return [0, 0];
  const m = (SHAKE_PX * left) / (SHAKE_TIME * 1000), t = performance.now() / 16;
  return [Math.round(Math.sin(t * 7.1) * m), Math.round(Math.cos(t * 5.3) * m)];
}

const LOOP_ERROR_LIMIT = 3;   // 오류로 멈춘 뒤 계속하기를 눌러도 이만큼 연달아 오류가 나면 판을 접고 시작 화면으로
let loopErrors = 0;           // 연달아 오류가 난 프레임 수 (제대로 돈 프레임이 있으면 0)
function gameLoop(now) {
  if (state !== "playing") return;   // 게임오버·레벨업 중이면 멈춤

  // dt 계산: 첫 프레임은 0으로
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;   // 탭 전환 등으로 시간이 크게 뛰면 최대 0.1초로 제한

  try {
    // '1.5배속'(어려움 클리어로 열림, 일시정지 창에서 켜기): 한 프레임에 update 를 나눠서 여러 번 (1.5배면 dt 한 번 + dt 절반 한 번).
    //   dt 를 통째로 키우면 빠른 탄이 적을 뚫고 지나갈 수 있어서 한 번에 dt 보다 크게는 안 돌림. 중간에 레벨업·상자 창이 뜨면 거기서 멈춤
    if (hitStop > 0) hitStop = Math.max(0, hitStop - dt);   // 히트스톱: 큰 타격 직후 아주 잠깐 게임을 멈춤 (그리기는 계속)
    else for (let left = gameSpeed(); left > 0 && state === "playing"; left -= 1) update(dt * Math.min(1, left));
    draw();
    loopErrors = 0;
  } catch (err) {
    // 오류가 나도 화면이 말없이 굳지 않게 멈추고 알림. 계속하기를 눌러도 오류가 되풀이되면 판을 접고 깨진 이어 하기 저장도 지움
    console.error(err);
    loopErrors += 1;
    if (loopErrors >= LOOP_ERROR_LIMIT) { loopErrors = 0; toTitle(); clearRun(); return; }
    if (state === "playing") pauseGame("오류가 나서 멈췄어요");
    return;   // 멈췄으니 다음 프레임은 예약하지 않음 (계속하기를 누르면 resumeGame 이 다시 예약)
  }

  loopId = requestAnimationFrame(gameLoop);   // 다음 프레임 예약
}

// 멈췄던 게임 다시 돌리기 (레벨업 카드 고른 뒤)
function resumeGame() {
  for (const k in keys) keys[k] = false;   // 창 떠 있는 동안 눌린 키 초기화
  state = "playing";
  saveRun();                                // 다회차: 카드를 고른 직후처럼 멈췄다 풀릴 때 이어 하기 저장
  lastTime = null;                          // 멈춘 시간이 dt에 한꺼번에 들어오지 않게
  cancelAnimationFrame(loopId);             // 멈춘 직후 바로 재개하면 옛 루프 예약이 남아 있어 루프가 두 개 돌았음
  loopId = requestAnimationFrame(gameLoop);
}

// =====================================================================
// 13. 레벨업: 게임을 멈추고 카드 보여주기 (기본 3장, 상점의 '선택의 폭'으로 최대 5장)
// =====================================================================
function levelUp() {
  playSfx("levelup");
  player.level += 1;
  player.xp -= player.xpNeed;
  player.xpNeed = xpNeedFor(player.level);

  showCards("레벨 업!", `Lv.${player.level} 도달!`, null);   // 새 몬스터는 레벨이 아니라 시간표로 열림 (update 의 '몬스터 시간표' 참고)
}

// 번개 오라는 그림 파일이 없어서, 보유 목록과 같은 번개 모양을 SVG 그림으로 만들어 씀
// 무기 종류 → 카드에 넣을 그림 주소
function weaponIconUrl(type) {
  const def = WEAPONS[type];
  return `assets/${def.icon}.png`;
}

// 패시브 종류 → 카드에 넣을 그림 주소
function passiveIconUrl(key) {
  return `assets/${PASSIVES[key].icon}.png`;
}

// 카드·결과 줄에 그림 넣기 (그림이 없으면 빈칸으로 둠 → 글자 줄은 그대로 맞춰짐)
function setIcon(element, iconUrl) {
  element.style.backgroundImage = iconUrl ? `url("${iconUrl}")` : "none";
}

// 레벨업 카드의 진화 짝 표시: 이 카드(무기 또는 아이템)와 진화 짝이 되는 것을 지금 갖고 있으면 금색 줄로 알려 줌
//   kind = "weapon" 이면 key 는 무기 종류, "passive" 이면 아이템 종류. 짝이 둘이면 줄도 둘
function evoPairLine(kind, key) {
  let html = "";
  for (const base in EVOLUTIONS) {
    const evo = EVOLUTIONS[base];
    if (kind === "passive" && evo.needs === key && player.weapons.some((w) => w.type === base)) {
      html += `<small class="evo">★ 진화 짝: <img src="${weaponIconUrl(base)}" alt="">${WEAPONS[base].name} → ${WEAPONS[evo.to].name}</small>`;
    }
    if (kind === "weapon" && base === key && passiveLevel(evo.needs) > 0) {
      html += `<small class="evo">★ 진화 짝: <img src="${passiveIconUrl(evo.needs)}" alt="">${PASSIVES[evo.needs].name} → ${WEAPONS[evo.to].name}</small>`;
    }
  }
  return html;
}

// 봉인: 한 판에 BANISH_PER_RUN 번. 봉인한 새 무기·새 아이템(키 "w:무기" / "p:아이템")은 그 판에 다시 카드로 안 나옴
const BANISH_PER_RUN = 2;
function isBanished(key) { return run.banished.includes(key); }

// 강화 후보 목록 만들기 (레벨업 카드와 보물 상자가 같이 씀)
//   includeNewWeapons = false 면 '새 무기'·'새 아이템'은 빼고, 이미 가진 무기·패시브 강화만 (보물 상자용)
function buildUpgradePool(includeNewWeapons) {
  const pool = [];
  const passiveSlotsUsed = player.passives.filter((p) => !PASSIVES[p.type].noSlot).length;
  for (const key in PASSIVES) {
    const def = PASSIVES[key];
    const owned = player.passives.find((p) => p.type === key);
    if (!owned) {
      if (!includeNewWeapons || isPassiveLocked(key)) continue;           // 보물 상자에서는 새 아이템이 나오지 않음. 잠긴 아이템(퀘스트로 해금)도 안 나옴
      if (!def.noSlot && passiveSlotsUsed >= PASSIVE_MAX_SLOTS) continue;  // 패시브 슬롯이 다 찼으면 새 아이템 없음
      if (isBanished(`p:${key}`)) continue;                                // 이번 판에 봉인한 아이템
      pool.push({
        title: `새 아이템: ${def.name}`,
        iconUrl: passiveIconUrl(key),
        desc: def.desc,
        isNew: true, isPassive: true,
        banishKey: `p:${key}`,
        evoLine: evoPairLine("passive", key),
        apply: () => gainPassive(key),
      });
    } else if (owned.level < def.maxLevel) {
      pool.push({
        title: `강화: ${def.name} Lv${owned.level} → Lv${owned.level + 1}`,
        iconUrl: passiveIconUrl(key),
        desc: def.desc,
        isPassive: true,
        evoLine: evoPairLine("passive", key),
        apply: () => gainPassive(key),
      });
    }
  }
  // 사탕 상자 (원작 Candybox): 무기 슬롯이 남아 있으면 가끔 나오는 카드. 고르면 원하는 무기를 직접 선택
  if (includeNewWeapons && player.weapons.length < MAX_WEAPONS && candyChoices().length > 0) {
    pool.push({ title: "무기 상자", desc: "원하는 무기를 직접 골라 장착합니다", iconUrl: "assets/chest.png", isNew: true, isCandy: true, apply: openCandyBox });
  }
  for (const type in WEAPONS) {
    const def = WEAPONS[type];
    if (def.evolved || isWeaponLocked(type)) continue;   // 잠긴 무기(퀘스트로 해금)와 진화 무기는 카드로 안 나옴. 진화 무기는 카드로 나오지 않음 (상자에서 진화로만)
    const owned = player.weapons.find((w) => w.type === type);
    if (!owned) {
      if (!includeNewWeapons) continue;        // 보물 상자에서는 새 무기가 나오지 않음
      if (player.weapons.length >= MAX_WEAPONS) continue;   // 무기 슬롯이 다 찼으면 새 무기 없음
      if (player.weapons.some((w) => WEAPONS[w.type].evoOf === type)) continue;   // 이미 진화한 무기의 원본은 다시 안 나옴
      if (isBanished(`w:${type}`)) continue;                               // 이번 판에 봉인한 무기
      pool.push({
        title: `새 무기: ${def.name}`,
        iconUrl: weaponIconUrl(type),
        desc: def.desc,                            // 무기가 어떻게 공격하는지 한 줄 설명
        isNew: true,
        banishKey: `w:${type}`,
        evoLine: evoPairLine("weapon", type),
        apply: () => player.weapons.push({ type, level: 1, timer: 0 }),
      });
    } else if (owned.level < WEAPON_MAX_LEVEL) {
      pool.push({
        title: `강화: ${def.name} Lv${owned.level} → Lv${owned.level + 1}`,
        iconUrl: weaponIconUrl(type),
        desc: def.upgradeDesc,
        evoLine: evoPairLine("weapon", type),
        apply: () => { owned.level += 1; },
      });
    }
  }
  return pool;
}

// 더 강화할 것이 없을 때의 선택지: 체력 전부 회복, 또는 금화 (금화는 판이 끝날 때 받는 금화에 그대로 더해짐)
const MAXED_GOLD = 10;            // 레벨업 = 금화 10
const MAXED_CHEST_GOLD = [10, 30]; // 보물 상자 = 금화 10~30 중 아무 값 (행운과 상관없이 완전 랜덤)
function maxedChestGold() { return MAXED_CHEST_GOLD[0] + Math.floor(Math.random() * (MAXED_CHEST_GOLD[1] - MAXED_CHEST_GOLD[0] + 1)); }
function maxedPicks(gold) {
  return [
    { title: "체력 전부 회복", desc: "더 강화할 것이 없습니다", iconUrl: "assets/potion_green.png", apply: () => { player.hp = player.maxHp; } },
    { title: `금화 +${gold}`, gold, desc: "판이 끝날 때 받는 금화에 더해집니다", iconUrl: "assets/coin.png",
      apply: () => {
        run.bonusGold = (run.bonusGold || 0) + gold;
        floatTexts.push({ x: player.x, y: player.y - 34, text: `금화 +${gold}`, color: "#ffd60a", life: 1.2, maxLife: 1.2 });
      } },
  ];
}

// 게임을 멈추고 강화 카드 창 띄우기
//   bannerText : 카드를 고른 뒤 화면 위에 잠깐 띄울 문구 (없으면 null)
//   fixedPicks : 정해 둔 카드 목록 (상자에서 더 강화할 게 없을 때의 '회복 / 금화'). 주면 뽑기·다시 뽑기·건너뛰기 없이 이 카드만 보여 줌
function showCards(title, text, bannerText, fixedPicks) {
  state = "levelup";
  levelTitle.textContent = title;
  levelText.textContent = text;

  let banishing = false;   // 봉인 버튼을 누른 뒤: 다음에 누르는 카드는 고르지 않고 봉인
  let current = [];        // 지금 보여 주는 카드

  // 카드 버튼 만들기
  function render(picks) {
    current = picks;
    choicesBox.innerHTML = "";
    choicesBox.classList.toggle("wide", picks.length >= 5);   // 5장부터는 두 줄로
    for (const card of picks) {
      const btn = document.createElement("button");
      btn.className = `card${card.isNew ? (card.isPassive ? " passive-new" : " weapon-new") : ""}${card.banishKey ? " banishable" : ""}`;   // banishable = 봉인할 수 있는 카드
      btn.innerHTML = `${card.title}<small>${card.desc}</small>${card.evoLine || ""}`;   // 진화 짝이면 금색 줄이 붙음
      setIcon(btn, card.iconUrl);           // 무기 카드면 왼쪽에 무기 그림
      btn.addEventListener("click", () => {
        if (banishing) { if (card.banishKey) banish(card); return; }   // 봉인 중: 고르지 않고 봉인 (봉인할 수 없는 카드는 그대로)
        card.apply();
        levelupBox.style.display = "none";
        if (SHOW_BANNER && bannerText) banner = { text: bannerText, life: BANNER_TIME };   // 재개 직후 화면 위에 잠깐 안내
        if (state === "candy") return;                  // 사탕 상자: 무기 고르기 창이 떠 있으므로 아직 재개하지 않음
        resumeGame();
      });
      choicesBox.appendChild(btn);
    }
  }

  // 카드 나눠 주기. avoid = 방금 보여준 카드들 (다시 뽑을 때 같은 카드가 또 나오지 않게 뒤로 미룸)
  function deal(avoid) {
    const pool = buildUpgradePool(true);
    // 섞어서 앞에서부터 player.choices장 (기본 3장, 최대 5장)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    pool.sort((a, b) => (avoid.includes(a.title) ? 1 : 0) - (avoid.includes(b.title) ? 1 : 0));
    let picks = fixedPicks || pool.slice(0, player.choices);
    // 무기상: 무기 상자 카드가 안 뽑혔으면 candyBonus 확률로 마지막 카드를 무기 상자로 바꿈
    const candy = pool.find((c) => c.isCandy);
    if (!fixedPicks && candy && !picks.includes(candy) && charDef().candyBonus && Math.random() < charDef().candyBonus) picks = [...picks.slice(0, -1), candy];
    if (picks.length === 0) {
      // 무기·아이템이 전부 만렙이면 고를 게 없으므로 체력 회복이나 금화 조금 중에 고르게 함 (창이 비어 멈추는 것 방지)
      picks = maxedPicks(MAXED_GOLD);
    }

    render(picks);
    return { picks, poolSize: pool.length };
  }

  // 다시 뽑기: 상점에서 산 횟수(0~2)만큼, 레벨업 한 번마다. 안 샀으면 버튼이 아예 안 보임
  //   바꿀 다른 카드가 없으면(후보가 보여준 장수 이하) 꺼 둠. 이미 보여 준 카드는 뒤로 미뤄서 새 카드가 먼저 나오게 함
  const first = deal([]);
  let rerollsLeft = upLevel("reroll");
  const shown = first.picks.map((c) => c.title);
  const refreshReroll = () => {
    rerollBtn.style.display = upLevel("reroll") > 0 && !fixedPicks ? "" : "none";
    rerollBtn.textContent = `다시 뽑기 (${rerollsLeft}번 남음)`;
    rerollBtn.disabled = rerollsLeft <= 0 || first.poolSize <= first.picks.length;
  };
  refreshReroll();
  // 건너뛰기: 상점에서 샀을 때만. 카드를 고르지 않고 창을 닫는 대신 체력을 SKIP_HEAL 만큼 회복 (최대 체력까지만)
  skipBtn.style.display = upLevel("skip") > 0 && !fixedPicks ? "" : "none";
  skipBtn.textContent = `건너뛰기 (체력 +${SKIP_HEAL})`;
  skipBtn.onclick = () => {
    player.hp = Math.min(player.maxHp, player.hp + SKIP_HEAL);
    floatTexts.push({ x: player.x, y: player.y - 34, text: `체력 +${SKIP_HEAL}`, color: "#7dffb0", life: 1.2, maxLife: 1.2 });
    levelupBox.style.display = "none";
    if (SHOW_BANNER && bannerText) banner = { text: bannerText, life: BANNER_TIME };
    resumeGame();
  };
  rerollBtn.onclick = () => {
    if (rerollsLeft <= 0) return;
    rerollsLeft -= 1;
    for (const c of deal(shown).picks) shown.push(c.title);
    refreshReroll();
    setBanishing(false);
  };
  // 봉인 버튼: 누른 뒤 고른 카드(새 무기·새 아이템)는 이번 판 후보에서 빠지고, 그 자리만 다른 카드로 바뀜
  const refreshBanish = () => {
    const left = BANISH_PER_RUN - run.banished.length;
    banishBtn.style.display = fixedPicks ? "none" : "";
    banishBtn.textContent = banishing ? "봉인 취소" : `봉인 (${left}번 남음)`;
    banishBtn.disabled = !banishing && (left <= 0 || !current.some((c) => c.banishKey));
  };
  const setBanishing = (on) => { banishing = on; levelupBox.classList.toggle("banishing", on); refreshBanish(); };
  function banish(card) {
    run.banished.push(card.banishKey);
    const pool = buildUpgradePool(true).filter((c) => !current.some((it) => it.title === c.title));
    const next = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
    let picks = current.flatMap((c) => (c !== card ? [c] : next ? [next] : []));
    if (picks.length === 0) picks = maxedPicks(MAXED_GOLD);
    if (next) shown.push(next.title);
    render(picks);
    setBanishing(false);
  }
  banishBtn.onclick = () => setBanishing(!banishing);
  setBanishing(false);
  levelupBox.style.display = "flex";
}

// 부활(패시브): 체력 전부 회복, 잠깐 무적, 주변 적을 밀어냄
function revivePlayer() {
  player.revivesUsed += 1;
  player.hp = player.maxHp;
  player.invincible = P_REVIVE_INVINCIBLE;
  for (const e of enemies) if (!e.dead && inView(e.x, e.y)) pushEnemy(e, player.x, player.y, 120);
  enemyBullets = [];
  bossMarks = [];
  effects.push({ x: player.x, y: player.y, r: Math.hypot(W, H) * 0.5, life: 0.5, maxLife: 0.5 });
  spawnParticles(player.x, player.y, "#ffd60a", 20, 220);
  floatTexts.push({ x: player.x, y: player.y - 34, text: "부활!", color: "#ffd60a", life: 1.5, maxLife: 1.5 });
}

// =====================================================================
// 14. 게임오버 처리
// =====================================================================
function gameOver() {
  state = "gameover";
  resultText.innerHTML = endStat("w_clock", `생존 시간 ${formatTime(stats.time)}`) + endStat("item_wipe", `처치 ${stats.kills}마리`);
  resultDmg.innerHTML = dmgTableHtml();       // 무기별 피해 표
  endJoystick();                            // 판이 끝나면 누르던 조이스틱도 놓은 것으로
  setMusic(null);
  playSfx("gameover");
  runReward.innerHTML = finishRun(false);   // 다회차: 금화·해금 정산
  gameoverBox.style.display = "flex";
}

// 게임오버·클리어 창의 기록 한 칸 (HUD 와 같은 아이콘 + 글)
function endStat(icon, text) {
  return `<span class="end-stat">${icon ? `<img src="assets/${icon}.png" alt="">` : ""}${text}</span>`;
}

// 게임오버·클리어 창의 무기별 피해 표: 이번 판에 피해를 많이 준 무기부터 DMG_TABLE_ROWS 줄 (그림 · 이름 · 피해 · 비율)
const DMG_TABLE_ROWS = 6;
const resultDmg = document.getElementById("resultDmg");
const clearDmg = document.getElementById("clearDmg");
function dmgTableHtml() {
  const rows = Object.entries(run.dmgByWeapon).filter(([type, v]) => WEAPONS[type] && v >= 1).sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((sum, [, v]) => sum + v, 0);
  return rows.slice(0, DMG_TABLE_ROWS).map(([type, v]) =>
    `<div class="dmg-row"><img src="${weaponIconUrl(type)}" alt=""><span>${WEAPONS[type].name}</span><b>${Math.round(v).toLocaleString("ko-KR")}</b><small>${Math.round((v / total) * 100)}%</small></div>`).join("");
}

// 초 → "12분 34초"
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

// 클리어: 게임을 멈추고 화면 가운데에 STAGE CLEAR → 잠시 뒤 결과 창 (매우 어려움에서 그 캐릭터의 엔딩을 아직 안 봤으면 엔딩부터)
const STAGE_CLEAR_TIME = 1.8;   // STAGE CLEAR 글자만 보여 주는 시간 (초)
function gameClear() {
  state = "clear";
  spawnParticles(player.x, player.y, "#ffd60a", 40, 260);
  clearText.innerHTML = endStat("w_clock", `걸린 시간 ${formatTime(stats.time)}`) + endStat("item_wipe", `처치 ${stats.kills}마리`) + endStat(null, `Lv.${player.level}`);
  clearDmg.innerHTML = dmgTableHtml();
  endJoystick();
  setMusic("ending");
  clearReward.innerHTML = finishRun(true);
  const ending = run.diff === 3 && !(meta.stats.mask_ending & charBit()) ? ENDINGS[run.char] : null;
  if (ending) loadEnding(ending);   // STAGE CLEAR 가 떠 있는 동안 그림을 미리 받아 둠
  stageClear.classList.add("show");
  setTimeout(() => {
    stageClear.classList.remove("show");
    if (state !== "clear") return;   // 그 사이 시작 화면으로 나갔으면 창을 안 띄움
    if (ending) showEnding();
    else clearBox.style.display = "flex";
  }, STAGE_CLEAR_TIME * 1000);
}

// 매우 어려움 클리어 엔딩: 그 캐릭터로 매우 어려움을 깨면 STAGE CLEAR 다음에 엔딩 그림 + 자막. 캐릭터마다 한 번 (본 엔딩은 meta.stats.mask_ending)
//   그림 = assets/story/<art>.webp (PNG 57MB를 6MB로 줄인 것. 장면 설명은 docs/story/cutscene-storyboard.md). 아무 곳이나 누르거나 Enter·Space·Esc → 클리어 창
const ENDINGS = {
  knight:    { art: "mage_end",      text: "졸업장을 되찾았어요. 한 달 뒤, 첫 연금이 들어왔지요.\n이제 가훈대로 400년 놀 거예요.\n졸업장은 금고에 넣었답니다." },
  hunter:    { art: "hunter_end",    text: "월세를 내고도 몬스터 고기가 잔뜩 남아서 고깃집을 차렸어요.\n한 번 먹은 손님은 끊지를 못해요. 오늘도 오고, 내일도 와요.\n집주인도 고기 먹으러 오늘도 사흘을 걸어왔답니다." },
  berserker: { art: "berserker_end", text: "던전을 끝까지 쓸어버리고 돌아왔어요. 친구가 그제야 말을 끝냈지요.\n\"…던전 가서 고기 잔뜩 잡았거든. 같이 먹자고.\"\n반려 검은 조용히 칼집으로 들어갔답니다." },
  saint:     { art: "saint_end",     text: "협회에서 세 번째 편지가 왔어요. 이번엔 금색 도장이었지요.\n\"던전 정화 공로로 제명 취소.\"\n이제 제명할 가치도 없는 사람이 됐다는 뜻으로 해석했어요.\n빨간 도장 세 개 받던 시절이 좋았답니다." },
  armorer:   { art: "armorer_end",   text: "시청자가 처음으로 천 명을 넘었어요. 30년 장사 인생 최고의 날이었지요.\n\"자, 바로 이 검으로 보스를—\" 그 순간 방송이 끊겼어요. 사유: 폭력적인 콘텐츠.\n칼 파는 방송에서 칼을 쓰면 안 되는 줄은 몰랐답니다." },
};
const ENDING_LOCK = 1.2;   // 엔딩이 뜬 뒤 이 시간(초) 동안은 눌러도 안 넘어감: 보스를 잡던 손가락·키에 바로 넘어가지 않게 (▼ 표시도 이때부터, style.css)
const CAPTION_LINES = 3;
let endingShownAt = 0;
let endingInputLock = ENDING_LOCK;
let endingWords = [];
let endingWordStart = 0;
let endingWordEnd = 0;

function loadEnding(ending) {
  endingImg.classList.remove("loaded");
  endingImg.src = assetUrl(`story/${ending.art}`, "webp");
  endingWords = ending.text.match(/\S+\s*/gu);
  endingWordStart = 0;
  endingWordEnd = 0;
  endingText.textContent = "";
  renderEndingText();
}
endingImg.addEventListener("load", () => endingImg.classList.add("loaded"));   // 그림이 늦게 받아져도 받아지는 대로 나타남

function renderEndingText() {
  if (!endingBox.classList.contains("show")) return;
  const style = getComputedStyle(endingText);
  const maxHeight = Math.ceil(parseFloat(style.lineHeight) * CAPTION_LINES + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom));
  let text = "", end = endingWordStart, sentenceEnd = endingWordStart, sentenceText = "";
  for (; end < endingWords.length; end++) {
    const candidate = text + endingWords[end];
    endingText.textContent = candidate.trim();
    if (endingText.scrollHeight > maxHeight) break;
    text = candidate;
    if (/[.!?…]["'”’]?\s*$|\n\s*$/u.test(endingWords[end])) {
      sentenceEnd = end + 1;
      sentenceText = text;
    }
  }
  if (end < endingWords.length && sentenceEnd > endingWordStart) {
    end = sentenceEnd;
    text = sentenceText;
  }
  endingText.textContent = text.trim();
  endingWordEnd = end;
}
const endingTextResize = new ResizeObserver(renderEndingText);
endingTextResize.observe(endingText.parentElement);
document.fonts.addEventListener("loadingdone", renderEndingText);

function showEnding() {
  endingShownAt = performance.now();
  endingInputLock = storyScene ? STORY_LOCK : ENDING_LOCK;
  endingBox.classList.add("show");
  renderEndingText();
  endingBox.focus({ preventScroll: true });
}

function closeEnding() {
  if (!endingBox.classList.contains("show") || performance.now() - endingShownAt < endingInputLock * 1000) return;
  if (endingWordEnd < endingWords.length) {
    endingWordStart = endingWordEnd;
    renderEndingText();
    endingShownAt = performance.now();
    endingInputLock = STORY_LOCK;
    return;
  }
  if (storyScene) { advanceStory(); return; }
  if (endingImg.classList.contains("loaded")) {
    meta.stats.mask_ending |= charBit();   // 그림을 받은 엔딩을 닫았을 때만 본 것으로 저장
    saveMeta();
  }
  endingBox.classList.remove("show");
  if (state === "clear") clearBox.style.display = "flex";
}
endingBox.addEventListener("pointerup", closeEnding);   // click 대신: 휴대폰에서는 게임 화면이 touchstart 를 막아서 click 이 안 옴
window.addEventListener("keydown", (e) => {
  if (!endingBox.classList.contains("show") || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === "Enter" || e.key === " " || e.key === "Escape") { e.preventDefault(); closeEnding(); }
});

// =====================================================================
// 14-1. ? 도움말: 무기 조합(진화)표, 무기 설명, 아이템 설명. 열려 있는 동안 게임이 멈춤
// =====================================================================
let helpTab = "combo";
let helpReturnState = "playing";   // 닫을 때 돌아갈 상태 (레벨업 창 위에서 열었으면 레벨업으로)

function toggleHelp() {
  if (state === "help") {
    helpBox.style.display = "none";
    if (helpReturnState === "playing") resumeGame();
    else state = helpReturnState;
    return;
  }
  if (state === "gameover" || state === "clear") return;
  helpReturnState = state;                                  // 레벨업·사탕 상자 창 위에서 열었으면 닫을 때 그 창으로 돌아감
  state = "help";
  renderHelp();
  helpBox.style.display = "flex";
}

function renderHelp() {
  for (const tab of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".help-tab"))) tab.classList.toggle("active", tab.dataset.tab === helpTab);
  helpList.innerHTML = "";
  if (helpTab === "combo") renderComboTab();
  else if (helpTab === "weapons") renderListTab(Object.keys(WEAPONS).filter((k) => !WEAPONS[k].evolved && !isWeaponLocked(k)), WEAPONS, (k) => weaponIconUrl(k), (k) => player.weapons.find((w) => w.type === k || WEAPONS[w.type].evoOf === k));
  else renderListTab(Object.keys(PASSIVES).filter((k) => !isPassiveLocked(k)), PASSIVES, (k) => passiveIconUrl(k), (k) => player.passives.find((p) => p.type === k));
}

// 조합표: [무기] + [패시브] → [진화 무기]. 가진 것은 밝게, 조건이 갖춰지면 금색, 이미 진화했으면 주황
//   아직 퀘스트로 안 열린 무기·아이템이 들어간 조합은 보여 주지 않음
function renderComboTab() {
  for (const base in EVOLUTIONS) {
    if (isWeaponLocked(base) || isPassiveLocked(EVOLUTIONS[base].needs)) continue;
    const from = WEAPONS[base], to = WEAPONS[EVOLUTIONS[base].to], need = PASSIVES[EVOLUTIONS[base].needs];
    const ownedW = player.weapons.find((w) => w.type === base);
    const done = player.weapons.some((w) => w.type === EVOLUTIONS[base].to);
    const pLv = passiveLevel(EVOLUTIONS[base].needs), pMax = need.maxLevel;
    const hasP = pLv > 0;
    const ready = !done && ownedW && canEvolve(ownedW);
    const row = document.createElement("div");
    row.className = `combo${done ? " done" : ready ? " ready" : ""}`;
    row.innerHTML =
      `<span class="piece${ownedW || done ? "" : " dim"}"><img src="${weaponIconUrl(base)}">${from.name}${ownedW ? ` Lv${ownedW.level}/${WEAPON_MAX_LEVEL}` : ` (Lv${WEAPON_MAX_LEVEL} 필요)`}</span>` +
      `<span class="arrow">+</span>` +
      `<span class="piece${hasP ? "" : " dim"}"><img src="${passiveIconUrl(EVOLUTIONS[base].needs)}">${need.name}${hasP ? ` Lv${pLv}/${pMax}` : ` (Lv${pMax} 필요)`}</span>` +
      `<span class="arrow">→</span>` +
      `<span class="piece result${done ? "" : " dim"}"><img src="${weaponIconUrl(EVOLUTIONS[base].to)}"><span>${to.name}<small>${to.desc}</small></span></span>` +
      (done ? `<span class="tag">진화 완료</span>` : ready ? `<span class="tag">다음 상자에서 진화!</span>` : "");
    helpList.appendChild(row);
  }
  const note = document.createElement("p");
  note.style.cssText = "margin: 6px 0 0; color: #aaa; font-size: 13px;";
  note.textContent = `무기와 짝이 되는 아이템을 둘 다 최대 레벨까지 올린 채 보물 상자를 열면 진화합니다. 진화한 무기는 더 강화되지 않습니다.`;
  helpList.appendChild(note);
}

// 무기·아이템 설명 목록
function renderListTab(keys_, defs, iconOf, ownedOf) {
  for (const k of keys_) {
    const def = defs[k]; const owned = ownedOf(k);
    const row = document.createElement("div");
    row.className = "combo";
    row.innerHTML = `<span class="piece${owned ? "" : " dim"}" style="min-width: 150px"><img src="${iconOf(k)}">${def.name}${owned ? ` Lv${owned.level}` : ""}</span><span class="result" style="color:#ccc">${def.desc || def.upgradeDesc || ""}</span>`;
    helpList.appendChild(row);
  }
}

helpBtn.addEventListener("click", toggleHelp);
helpClose.addEventListener("click", toggleHelp);
document.getElementById("candyHelp").addEventListener("click", () => { helpTab = "combo"; toggleHelp(); });   // 사탕 상자 창에서 조합표 바로 열기
for (const tab of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(".help-tab"))) tab.addEventListener("click", () => { helpTab = tab.dataset.tab; renderHelp(); });

// =====================================================================
// 14-2. 사탕 상자: 원하는 무기를 직접 고르는 창 (레벨업 카드 '사탕 상자'를 고르면 뜸)
// =====================================================================
// 고를 수 있는 무기: 진화 무기가 아니고, 아직 없고, 그 진화형도 없는 것
function candyChoices() {
  return Object.keys(WEAPONS).filter((k) => !WEAPONS[k].evolved && !isWeaponLocked(k) && !player.weapons.some((w) => w.type === k || WEAPONS[w.type].evoOf === k));
}

// startPick = true 면 '시작 무기 고르기' (병기공): 이미 연 무기 전부에서 하나를 골라 그 무기로 판을 시작
function openCandyBox(startPick) {
  startPick = startPick === true;
  state = "candy";
  candyList.innerHTML = "";
  candyTitle.textContent = startPick ? "시작 무기 고르기" : "무기 상자";
  if (startPick) player.weapons = [];                // 기본 무기를 빼 두어야 그 무기도 목록에 나옴
  for (const k of candyChoices()) {
    const def = WEAPONS[k];
    if (startPick && def.noAttack) continue;        // 시작 무기는 적을 잡을 수 있는 것만
    const btn = document.createElement("button");
    btn.className = "card weapon-new";
    // 진화 조합 한 줄: 이 무기 + [짝 아이템] → [진화 무기]. 진화가 없는 무기는 줄이 없음
    const evo = EVOLUTIONS[k];
    const evoLine = evo && !startPick   // 시작 무기 고르기에서는 진화 줄(파란 글씨)을 뺌
      ? `<small class="evo${passiveLevel(evo.needs) > 0 ? " have" : ""}">진화: <img src="${passiveIconUrl(evo.needs)}">${PASSIVES[evo.needs].name} → ${WEAPONS[evo.to].name}</small>`
      : "";
    btn.innerHTML = `${def.name}<small>${def.desc || ""}</small>${evoLine}`;
    setIcon(btn, weaponIconUrl(k));
    btn.addEventListener("click", () => {
      player.weapons.push({ type: k, level: 1, timer: 0 });
      candyBox.style.display = "none";
      resumeGame();
    });
    candyList.appendChild(btn);
  }
  candyBox.style.display = "flex";
}

// 새 판 시작 (게임 시작·다시 시작 공통). 병기공이면 게임이 돌기 전에 시작 무기부터 고름. '이어 하기'는 이 함수를 안 거침
function beginRun() {
  resetGame();
  if (charDef().pick) { draw(); openCandyBox(true); }   // 창 뒤에 던전이 보이게 한 번 그린 뒤 고르기 창
}

restartBtn.addEventListener("click", beginRun);
chestOk.addEventListener("click", closeChest);
chestStage.addEventListener("click", () => { if (chestRoll && chestOk.disabled) finishChestRoll(); });   // 연출 도중 상자 무대를 누르면 바로 끝까지
