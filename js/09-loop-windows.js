// =====================================================================
// 12. 게임 루프: 1초에 약 60번 update → draw 반복
// =====================================================================
function gameLoop(now) {
  if (state !== "playing") return;   // 게임오버·레벨업 중이면 멈춤

  // dt 계산: 첫 프레임은 0으로
  if (lastTime === null) lastTime = now;
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.1) dt = 0.1;   // 탭 전환 등으로 시간이 크게 뛰면 최대 0.1초로 제한

  // '1.5배속'(매우 어려움 클리어로 열림, 일시정지 창에서 켜기): 한 프레임에 update 를 나눠서 여러 번 (1.5배면 dt 한 번 + dt 절반 한 번).
  //   dt 를 통째로 키우면 빠른 탄이 적을 뚫고 지나갈 수 있어서 한 번에 dt 보다 크게는 안 돌림. 중간에 레벨업·상자 창이 뜨면 거기서 멈춤
  for (let left = gameSpeed(); left > 0 && state === "playing"; left -= 1) update(dt * Math.min(1, left));
  draw();

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
      pool.push({
        title: `새 아이템: ${def.name}`,
        iconUrl: passiveIconUrl(key),
        desc: def.desc,
        isNew: true, isPassive: true,
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
      pool.push({
        title: `새 무기: ${def.name}`,
        iconUrl: weaponIconUrl(type),
        desc: def.desc,                            // 무기가 어떻게 공격하는지 한 줄 설명
        isNew: true,
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

    // 카드 버튼 만들기
    choicesBox.innerHTML = "";
    choicesBox.classList.toggle("wide", picks.length >= 5);   // 5장부터는 두 줄로
    for (const card of picks) {
      const btn = document.createElement("button");
      btn.className = `card${card.isNew ? (card.isPassive ? " passive-new" : " weapon-new") : ""}`;
      btn.innerHTML = `${card.title}<small>${card.desc}</small>${card.evoLine || ""}`;   // 진화 짝이면 금색 줄이 붙음
      setIcon(btn, card.iconUrl);           // 무기 카드면 왼쪽에 무기 그림
      btn.addEventListener("click", () => {
        card.apply();
        levelupBox.style.display = "none";
        if (SHOW_BANNER && bannerText) banner = { text: bannerText, life: BANNER_TIME };   // 재개 직후 화면 위에 잠깐 안내
        if (state === "candy") return;                  // 사탕 상자: 무기 고르기 창이 떠 있으므로 아직 재개하지 않음
        resumeGame();
      });
      choicesBox.appendChild(btn);
    }
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
  };
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
  resultText.textContent =
    `생존 시간 ${formatTime(stats.time)} · 처치 ${stats.kills}마리`;
  endJoystick();                            // 판이 끝나면 누르던 조이스틱도 놓은 것으로
  setMusic(null);
  playSfx("gameover");
  runReward.innerHTML = finishRun(false);   // 다회차: 금화·해금 정산
  gameoverBox.style.display = "flex";
}

// 초 → "12분 34초"
function formatTime(sec) {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return m > 0 ? `${m}분 ${s}초` : `${s}초`;
}

// 클리어: 게임을 멈추고 화면 가운데에 STAGE CLEAR → 잠시 뒤 결과 창
const STAGE_CLEAR_TIME = 1.8;   // STAGE CLEAR 글자만 보여 주는 시간 (초)
function gameClear() {
  state = "clear";
  spawnParticles(player.x, player.y, "#ffd60a", 40, 260);
  clearText.innerHTML = `걸린 시간 ${formatTime(stats.time)} · 처치 ${stats.kills}마리 · Lv.${player.level}`;
  endJoystick();
  setMusic("ending");
  clearReward.innerHTML = finishRun(true);
  stageClear.classList.add("show");
  setTimeout(() => {
    stageClear.classList.remove("show");
    if (state === "clear") clearBox.style.display = "flex";   // 그 사이 시작 화면으로 나갔으면 창을 안 띄움
  }, STAGE_CLEAR_TIME * 1000);
}

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
  for (const tab of document.querySelectorAll(".help-tab")) tab.classList.toggle("active", tab.dataset.tab === helpTab);
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
for (const tab of document.querySelectorAll(".help-tab")) tab.addEventListener("click", () => { helpTab = tab.dataset.tab; renderHelp(); });

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
