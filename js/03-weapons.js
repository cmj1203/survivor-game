// =====================================================================
// 2-1. 무기 목록 (새 무기를 추가하려면 여기에 항목 하나 더)
//   name        : 카드에 보이는 이름
//   desc        : '새 무기' 카드에 보이는 한 줄 설명 (어떻게 공격하는지)
//   interval    : 발동 간격 (초). 0이면 "항상 켜짐"
//   upgradeDesc : 강화 카드 설명
//   fire(w)     : 간격마다 한 번 실행 (탄환 쏘기 등)
//   update(w,dt): 매 프레임 실행 (회전 도끼처럼 계속 움직이는 것)
//   draw(w)     : 화면에 그리기 (플레이어에 붙어 있는 무기용)
//   icon        : 보유 목록·카드에 표시할 그림 이름 (assets 폴더. 몬스터·무기는 Tiny Dungeon, 나머지는 1-Bit Pack 에 색을 입힘)
//   w.level     : 이 무기의 현재 레벨 (1~WEAPON_MAX_LEVEL, 원작처럼 8)
// =====================================================================
// 운석: 불타는 운석 그림. 보스(악마) 운석과 구분되게 파란색(fx_meteor_p = fx_meteor 색만 바꿈). 32px 그림을 72px 로 그려 점 하나가 캐릭터와 같은 2.25px.
//   튕길 때마다 작은 파란 폭발 + 흙먼지 (그림: fx_fireburst_p, fx_landdust)
const METEOR_SIZE = 72;
function meteorImpactFx(b) {
  effects.push({ x: b.x, y: b.y, r: b.r * 1.4, life: 0.4, maxLife: 0.4, fx: "fx_fireburst_p" });
  effects.push({ x: b.x, y: b.y + 6, r: b.r * 1.6, life: 0.45, maxLife: 0.45, fx: "fx_landdust" });
}

const WEAPONS = {
  // --- 단검: 바라보는 방향으로 빠르게 연사 (원작 Knife). 레벨 = 단검 개수 ---
  bullet: {
    name: "단검",
    desc: "바라보는 방향으로 강한 단검을 연사. 적 2마리까지 관통",
    icon: "dagger",
    interval: 0.35,
    damageMul: 3,
    upgradeDesc: "단검 +1자루, 피해 +20%",
    fire(w) {
      const dirX = player.facingX, dirY = player.facingY;
      const count = w.level;
      for (let i = 0; i < count; i++) {
        // 여러 자루면 진행 방향의 옆으로 나란히 (12px 간격)
        const side = (i - (count - 1) / 2) * 12;
        bullets.push({
          kind: "bullet", sprite: "dagger", size: 16,
          x: player.x - dirY * side, y: player.y + dirX * side,
          vx: dirX * BULLET_SPEED, vy: dirY * BULLET_SPEED,
          r: BULLET_RADIUS,
          damage: weaponDamage(w),
          pierce: 1, hitIds: new Set(),        // 앞의 적 하나에 전부 막히지 않게 두 마리까지
        });
      }
    },
  },

  // --- 마법봉: 가장 가까운 적에게 마법탄 (원작 Magic Wand). Lv3·5·7 마법탄 +1, Lv2·4·6·8 간격 -10% ---
  wand: {
    name: "마법봉",
    desc: "가장 가까운 적에게 마법탄을 자동 발사",
    icon: "wand",
    interval: 0.65,
    damageMul: 2,
    upgradeDesc: "마법탄 +1 / 간격 -10% (번갈아), 피해 +20%",
    getInterval(w) { return this.interval * 0.9 ** Math.floor(w.level / 2); },
    fire(w) {
      const target = findNearestEnemy();
      if (!target) return;
      const count = 1 + Math.floor((w.level - 1) / 2);
      w.pending = w.pending || [];
      for (let i = 0; i < count; i++) {
        w.pending.push({ delay: i * 0.08 });
      }
    },
    update(w, dt) {
      if (!w.pending) return;
      for (const p of w.pending) {
        p.delay -= dt;
        if (p.delay > 0) continue;
        p.done = true;
        // 삼연발 마법탄의 역할을 합침: 한 발씩 다시 조준해서, 앞의 적이 죽어도 헛쏘지 않음.
        const target = findNearestEnemy();
        if (!target) continue;
        const angle = Math.atan2(target.y - player.y, target.x - player.x);
        bullets.push({
          kind: "magic", color: "#7df9ff", trail: true,
          x: player.x, y: player.y,
          vx: Math.cos(angle) * 420 * projSpeedMul(), vy: Math.sin(angle) * 420 * projSpeedMul(),
          r: 6,
          damage: weaponDamage(w, 0.5),
        });
      }
      w.pending = w.pending.filter((p) => !p.done);
    },
  },

  // --- 장검: 앞을 베고 밀어냄. Lv2 뒤쪽, Lv4 위쪽 베기 추가. Lv3·5·7 범위 +20% ---
  sword: {
    name: "장검",
    desc: "바라보는 방향 앞을 크게 베고 적을 밀어냄",
    icon: "sword",
    interval: 0.9,
    damageMul: 1.3,
    upgradeDesc: "Lv2 뒤쪽·Lv4 위쪽 베기 추가, Lv3·5·7 범위 +20%, 피해 +20%",
    noAmount: true,                                  // 복제기 영향 없음 (원작과 같음)
    getRadius(w) { return 85 * 1.2 ** Math.floor((w.level - 1) / 2) * areaMul(); },
    fire(w) {
      const strikes = w.level >= 4 ? 3 : w.level >= 2 ? 2 : 1;
      const f = { x: player.facingX, y: player.facingY };
      const dirs = [f, { x: -f.x, y: -f.y }, { x: 0, y: -1 }];        // 앞 → 뒤 → 위
      this.slash(w, dirs[0]);                                       // 첫 베기는 바로
      w.pending = w.pending || [];
      for (let i = 1; i < strikes; i++) w.pending.push({ delay: i * 0.15, dir: dirs[i] });   // 나머지는 0.15초씩 뒤에
    },
    update(w, dt) {
      if (!w.pending) return;
      for (const p of w.pending) {
        p.delay -= dt;
        if (p.delay <= 0) { this.slash(w, p.dir); p.done = true; }
      }
      w.pending = w.pending.filter((p) => !p.done);
    },
    // 한 방향으로 실제로 베기: 그 방향 앞쪽 반원 안의 적에게 피해 + 밀어냄
    slash(w, dir) {
      const r = this.getRadius(w);
      for (const e of enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x, dy = e.y - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist < r + e.r && dx * dir.x + dy * dir.y > 0) {
          damageEnemy(e, weaponDamage(w, 1));
          pushEnemy(e, player.x, player.y, 30);
        }
      }
      effects.push({ kind: "slash", x: player.x, y: player.y, angle: Math.atan2(dir.y, dir.x), r, life: 0.2, maxLife: 0.2 });
    },
  },

  // --- 회전 도끼: 플레이어 주위를 도는 양날 도끼, 레벨 = 도끼 개수 ---
  orb: {
    name: "수호 도끼",
    desc: "몸 가까이 도는 도끼가 적을 때리고 살짝 밀어냄",
    icon: "axe",
    interval: 0,
    damageMul: 1.4,
    upgradeDesc: "도끼 +1개, 피해 +20% (Lv3·5·7 회전 +20%)",
    orbitRadius: 48,       // 몸에 붙은 적도 닿도록 궤도를 가깝게 둠
    orbRadius: 16,         // 촛대는 궤도가 아니라 이 타격 범위를 넓힘 (안쪽 사각지대 방지)
    rotateSpeed: 3,        // 1초에 도는 각도 (라디안). Lv3·5·7 에서 +20%
    hitCooldown: 0.25,     // 같은 적을 다시 때리기까지 시간
    update(w, dt) {
      w.angle = (w.angle || 0) + this.rotateSpeed * 1.2 ** Math.floor((w.level - 1) / 2) * projSpeedMul() * dt;
      for (const pos of this.positions(w)) {
        for (const e of enemies) {
          if (e.dead || (e.cd.orb || 0) > 0) continue;
          if (circlesTouch({ x: pos.x, y: pos.y, r: this.orbRadius * areaMul() }, e)) {
            damageEnemy(e, weaponDamage(w));
            pushEnemy(e, player.x, player.y, 8);
            e.cd.orb = this.hitCooldown;
          }
        }
      }
    },
    // 도끼 위치 (360도를 개수만큼 균등 분할). 개수 = 레벨 + 복제기, 거리는 고정
    positions(w) {
      const list = [];
      const count = w.level + extraAmount() + (this.extraCount || 0);   // 진화하면 extraCount 만큼 더
      const radius = this.orbitRadius;
      for (let i = 0; i < count; i++) {
        const a = (w.angle || 0) + (Math.PI * 2 * i) / count;
        list.push({ x: player.x + Math.cos(a) * radius,
                    y: player.y + Math.sin(a) * radius });
      }
      return list;
    },
    draw(w) {
      const spin = stats.time * 10;            // 도끼가 제자리에서 빙글빙글 도는 각도
      for (const pos of this.positions(w)) {
        // 하늘색 빛 (내 공격 표시)
        ctx.fillStyle = "rgba(125, 249, 255, 0.22)";
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.orbRadius * areaMul() * 1.5, 0, Math.PI * 2);
        ctx.fill();
        if (!drawSprite("axe", pos.x, pos.y, 16 * areaMul(), { angle: spin })) {
          ctx.fillStyle = "#caf0f8";           // 그림이 없을 때: 하늘색 원
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, this.orbRadius * areaMul(), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    },
  },

  // --- 관통 창: 직선으로 날아가며 적을 뚫고 지나감, 레벨↑ = 발사 간격↓ ---
  spear: {
    name: "관통 창",
    desc: "가장 가까운 적 쪽으로 적을 뚫고 지나가는 창",
    icon: "spear",
    interval: 1.25,
    damageMul: 1.2,
    upgradeDesc: "발사 간격 -15%, 피해 +20%",
    getInterval(w) { return this.interval * 0.85 ** (w.level - 1); },
    fire(w) {
      const target = findNearestEnemy();
      if (!target) return;
      const dx = target.x - player.x, dy = target.y - player.y;
      const len = Math.hypot(dx, dy) || 1;
      bullets.push({
        kind: "spear", sprite: "spear", size: 21,
        x: player.x, y: player.y,
        vx: (dx / len) * 600, vy: (dy / len) * 600,
        r: 6,
        damage: weaponDamage(w, 1),
        pierce: 99,               // 계속 뚫고 지나감
        hitIds: new Set(),        // 이미 때린 적 번호 (같은 적 두 번 안 때림)
      });
    },
  },

  // --- 번개 오라: 플레이어 주변 원 안의 적에게 주기적으로 피해, 레벨↑ = 반경↑ ---
  aura: {
    name: "번개 오라",
    desc: "주변 원 안의 적에게 계속 피해를 주고 살짝 밀어냄",
    icon: "w_aura",
    interval: 0.5,
    damageMul: 0.8,
    upgradeDesc: "범위 +16, 피해 +20%",
    noAmount: true,                                  // 복제기 영향 없음 (원작과 같음)
    getRadius(w) { return (60 + 16 * (w.level - 1)) * areaMul(); },
    fire(w) {
      const r = this.getRadius(w);
      for (const e of enemies) {
        if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < r + e.r) {
          damageEnemy(e, weaponDamage(w));
          pushEnemy(e, player.x, player.y, 10);   // 살짝 밀어냄 (원작 Garlic 의 넉백)
        }
      }
      w.flash = 0.15;   // 번쩍이는 연출용 (초)
    },
    update(w, dt) {
      if (w.flash > 0) w.flash -= dt;
      // 번개 줄기 모양을 0.08초마다 새로 만듦 (지직거리는 느낌)
      w.boltTimer = (w.boltTimer || 0) - dt;
      if (w.boltTimer <= 0) {
        w.boltTimer = 0.08;
        w.bolts = [];
        const r = this.getRadius(w);
        for (let i = 0; i < 5; i++) {
          const a = Math.random() * Math.PI * 2;
          const points = [];
          for (let step = 0; step <= 4; step++) {
            const dist = r * (0.3 + 0.7 * (step / 4));
            const jitter = a + (Math.random() - 0.5) * 0.7;
            points.push({ dx: Math.cos(jitter) * dist, dy: Math.sin(jitter) * dist });
          }
          w.bolts.push(points);
        }
      }
    },
    draw(w) {
      const r = this.getRadius(w);
      const active = w.flash > 0;              // 피해를 준 직후엔 더 밝게
      ctx.fillStyle = active ? "rgba(120, 200, 255, 0.30)" : "rgba(120, 200, 255, 0.10)";
      ctx.strokeStyle = active ? "rgba(125, 249, 255, 0.9)" : "rgba(125, 249, 255, 0.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 번개 줄기
      ctx.strokeStyle = active ? "rgba(225, 252, 255, 0.95)" : "rgba(200, 245, 255, 0.45)";
      ctx.lineWidth = active ? 2 : 1;
      for (const points of w.bolts || []) {
        ctx.beginPath();
        points.forEach((pt, i) => {
          if (i === 0) ctx.moveTo(player.x + pt.dx, player.y + pt.dy);
          else ctx.lineTo(player.x + pt.dx, player.y + pt.dy);
        });
        ctx.stroke();
      }
    },
  },

  // --- 화염병: 무작위 적 근처에 던져 바닥에 불바다를 남김 (원작 Santa Water). Lv3·5·7 병 +1, Lv2·4·6·8 크기·시간 +20% ---
  bomb: {
    name: "화염병",
    desc: "적 근처에 던져 바닥에 불바다를 남김",
    icon: "firebomb",
    interval: 3.0,
    upgradeDesc: "불바다 크기·시간 +20% (짝수 레벨), 병 +1 (Lv4·7), 피해 +20%",
    getScale(w) { return 1.2 ** Math.floor(w.level / 2); },
    fire(w) {
      const count = 1 + Math.floor((w.level - 1) / 3);          // 병: Lv1~3 1개, Lv4~6 2개, Lv7~8 3개
      const targets = enemies.filter((e) => !e.dead && inView(e.x, e.y));
      for (let i = 0; i < count; i++) {
        // 목표: 화면 안 무작위 적 근처 (적이 없으면 플레이어 근처 아무 데나)
        const t = targets.length ? targets[Math.floor(Math.random() * targets.length)] : { x: player.x + (Math.random() - 0.5) * 300, y: player.y + (Math.random() - 0.5) * 300 };
        const tx = t.x + (Math.random() - 0.5) * 40, ty = t.y + (Math.random() - 0.5) * 40;
        const dx = tx - player.x, dy = ty - player.y;
        const len = Math.hypot(dx, dy) || 1;
        bullets.push({
          kind: "bomb", sprite: "firebomb", size: 16, spin: 14, noHit: true, trail: true,
          x: player.x, y: player.y,
          vx: (dx / len) * 300, vy: (dy / len) * 300,
          r: 7,
          targetX: tx, targetY: ty,                  // 여기 도착하면 불바다
          zoneRadius: 55 * this.getScale(w) * areaMul(),
          zoneLife: 3 * this.getScale(w) * durationMul(),
          damage: weaponDamage(w) * 0.3,             // 0.25초마다 이만큼 (불바다는 겹치므로 낮게)
        });
      }
    },
  },

  // --- 던지는 망치: 위로 던져 포물선을 그리며 떨어짐. Lv3·5·7 망치 +1, 짝수 레벨 피해 +25% ---
  hammer: {
    name: "던지는 망치",
    desc: "위로 던져 떨어지는 관통 망치. 피해가 큼",
    icon: "hammer",
    interval: 1.8,
    damageMul: 1.2,
    upgradeDesc: "망치 +1 / 피해 +25% (번갈아), 피해 +20%",
    fire(w) {
      const count = 1 + Math.floor((w.level - 1) / 2);
      const bonus = 1.25 ** Math.floor(w.level / 2);
      for (let i = 0; i < count; i++) {
        bullets.push({
          kind: "hammer", sprite: "hammer", size: 17, spin: 10, margin: 260,
          x: player.x, y: player.y,
          vx: player.facingX * 140 + (i - (count - 1) / 2) * 90 + (Math.random() - 0.5) * 40,
          vy: -540 - Math.random() * 60,
          gravity: 900,                              // 아래로 떨어짐
          r: 12,
          damage: weaponDamage(w) * 2 * bonus,
          pierce: 99, hitIds: new Set(),
        });
      }
    },
  },

  // --- 던지는 방패: 가장 가까운 적 쪽으로 날아갔다 부메랑처럼 돌아옴, 관통 (원작 Cross). Lv3·5·7 방패 +1, Lv2·4·6·8 속도 +20% ---
  cross: {
    name: "던지는 방패",
    desc: "가장 가까운 적 쪽으로 날아갔다 부메랑처럼 돌아옴",
    icon: "shield_throw",
    interval: 2.2,
    upgradeDesc: "방패 +1 / 속도 +20% (번갈아), 피해 +20%",
    fire(w) {
      const target = findNearestEnemy();
      if (!target) return;
      const count = 1 + Math.floor((w.level - 1) / 2);
      const speed = 500 * 1.2 ** Math.floor(w.level / 2);
      const base = Math.atan2(target.y - player.y, target.x - player.x);
      for (let i = 0; i < count; i++) {
        const a = base + (i - (count - 1) / 2) * 0.35;
        bullets.push({
          kind: "cross", sprite: "shield_throw", size: 15, spin: 12, margin: 500,
          x: player.x, y: player.y,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
          ax: -Math.cos(a) * 900, ay: -Math.sin(a) * 900,   // 던진 반대쪽으로 계속 당겨져서 되돌아옴
          startDirX: Math.cos(a), startDirY: Math.sin(a),
          r: 10,
          damage: weaponDamage(w, 1),
          pierce: 99, hitIds: new Set(),
        });
      }
    },
  },

  // --- 화염 지팡이: 무작위 적에게 큰 화염구, 관통 (원작 Fire Wand). Lv2·4·6·8 피해 +30%, Lv3·5·7 화염구 +1 ---
  firewand: {
    name: "화염 지팡이",
    desc: "무작위 적에게 큰 화염구. 적을 뚫고 지나감",
    icon: "w_firewand",
    interval: 2.4,
    upgradeDesc: "피해 +30% / 화염구 +1 (번갈아), 피해 +20%",
    fire(w) {
      const targets = enemies.filter((e) => !e.dead && inView(e.x, e.y));
      if (targets.length === 0) return;
      const count = 1 + Math.floor((w.level - 1) / 2);
      const bonus = 1.3 ** Math.floor(w.level / 2);
      for (let i = 0; i < count; i++) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        const dx = t.x - player.x, dy = t.y - player.y;
        const len = Math.hypot(dx, dy) || 1;
        bullets.push({
          kind: "fireball", color: "#ff8c42", glow: "#ffd166",
          x: player.x, y: player.y,
          vx: (dx / len) * 380, vy: (dy / len) * 380,
          r: 10,
          damage: weaponDamage(w) * 3 * bonus,
          pierce: 99, hitIds: new Set(),
        });
      }
    },
  },

  // --- 마법 구슬: 관통하며 화면 가장자리에 튕겨 다니는 구슬 (원작 Runetracer). Lv3·5·7 구슬 +1, Lv2·4·6·8 지속 +1초 ---
  rune: {
    name: "마법 구슬",
    desc: "첫 구슬은 가까운 적을 조준. 벽에 튕기며 다시 관통",
    icon: "w_rune",
    interval: 1.8,
    damageMul: 1.15,
    upgradeDesc: "구슬 +1 / 지속 +1초 (번갈아), 피해 +20%",
    fire(w) {
      const count = 1 + Math.floor((w.level - 1) / 2);
      const target = findNearestEnemy();
      for (let i = 0; i < count; i++) {
        const a = i === 0 && target ? Math.atan2(target.y - player.y, target.x - player.x) : Math.random() * Math.PI * 2;
        bullets.push({
          kind: "rune", color: "#caf0f8", glow: "#7df9ff",
          x: player.x, y: player.y,
          vx: Math.cos(a) * 420, vy: Math.sin(a) * 420,
          r: 8,
          damage: weaponDamage(w, 1),
          pierce: 99, hitIds: new Set(),
          bounces: 99,                                // 화면 가장자리에서 튕김 (튕기면 같은 적을 다시 때릴 수 있음)
          life: (3 + Math.floor(w.level / 2)) * durationMul(),
        });
      }
    },
  },

  // --- 낙뢰: 무작위 적 머리 위에 번개 (원작 Lightning Ring). Lv3·5·7 낙뢰 +1, Lv2·4·6·8 범위 +20% ---
  lightning: {
    name: "낙뢰",
    desc: "무작위 적 머리 위에 번개. 주변 적도 함께 피해",
    icon: "w_lightning",
    interval: 1.7,
    upgradeDesc: "낙뢰 +1 / 범위 +20% (번갈아), 피해 +20%",
    fire(w) {
      const targets = enemies.filter((e) => !e.dead && inView(e.x, e.y));
      if (targets.length === 0) return;
      const count = 1 + Math.floor((w.level - 1) / 2);
      const radius = 45 * 1.2 ** Math.floor(w.level / 2) * areaMul();
      for (let i = 0; i < count; i++) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        for (const e of enemies) {
          if (!e.dead && Math.hypot(e.x - t.x, e.y - t.y) < radius + e.r) damageEnemy(e, weaponDamage(w, 1));
        }
        effects.push({ kind: "bolt", x: t.x, y: t.y, r: radius, life: 0.25, maxLife: 0.25, seed: Math.random() });
      }
    },
  },

  // --- 별의 문양: 긴 간격으로 화면의 적을 전부 지움 (원작 Pentagram). 구슬은 안 나옴(Lv5부터 나옴). 간격 -15%/레벨 ---
  pentagram: {
    name: "별의 문양",
    desc: "긴 간격으로 화면의 적을 전부 지움 (Lv5부터 경험치 구슬이 나옴)",
    icon: "w_pentagram",
    interval: 25,
    upgradeDesc: "간격 -15% (Lv5: 지운 적도 경험치 구슬을 남김)",
    noAmount: true,                                  // 복제기 영향 없음 (원작과 같음)
    getInterval(w) { return this.interval * 0.85 ** (w.level - 1); },
    fire(w) {
      let erased = 0;
      for (const e of enemies) {
        if (e.dead || !inView(e.x, e.y)) continue;
        if (e.boss) {
          damageEnemy(e, Math.ceil(e.maxHp * 0.1));    // 보스는 10%만
        } else if (e.elite) {
          damageEnemy(e, Math.ceil(e.maxHp * 0.5));    // 엘리트는 체력 절반만
        } else if (w.level >= 5) {
          damageEnemy(e, e.hp);                        // Lv5: 보통 처치와 같음 (구슬 나옴)
        } else {
          e.dead = true;                               // 그냥 지움: 구슬·아이템·파편 없음
          stats.kills += 1;
        }
        erased += 1;
      }
      if (erased > 0) enemyBullets = enemyBullets.filter((b) => !inView(b.x, b.y));
      effects.push({ kind: "flash", life: 0.4, maxLife: 0.4 });
      effects.push({ kind: "star", x: player.x, y: player.y, r: 90, life: 0.6, maxLife: 0.6 });
    },
  },

  // --- 빙결 광선: 12방향을 차례로 돌며 광선, 맞은 적만 얼림 (원작 Clock Lancet). 피해 없음. 얼리는 시간 +0.5초/레벨, Lv3부터 반대쪽도 ---
  clock: {
    name: "빙결 광선",
    desc: "12방향을 차례로 도는 광선. 맞은 적을 얼림 (피해 없음)",
    icon: "w_icebeam",
    interval: 1.5,
    noAttack: true,                                  // 얼리기만 함 → 병기공 시작 무기 목록에서 뺌
    upgradeDesc: "얼리는 시간 +0.5초 (Lv3: 반대쪽 광선 추가)",
    noAmount: true,                                  // 복제기 영향 없음 (원작과 같음)
    rayLength: 1500,
    rayHalf: 18,                 // 광선 폭의 절반 (촛대로 넓어짐)
    fire(w) {
      w.dir = ((w.dir || 0) + 1) % 12;
      const angles = [(w.dir / 12) * Math.PI * 2];
      if (w.level >= 3) angles.push(angles[0] + Math.PI);
      const freezeFor = (3.5 + 0.5 * (w.level - 1)) * durationMul();
      for (const a of angles) {
        const ux = Math.cos(a), uy = Math.sin(a);
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          const along = dx * ux + dy * uy;                     // 광선 방향으로 얼마나 앞에 있는지
          const across = Math.abs(dx * uy - dy * ux);          // 광선에서 옆으로 얼마나 벗어났는지
          if (!e.boss && along > 0 && along < this.rayLength && across < this.rayHalf * areaMul() + e.r) e.frozenTimer = freezeFor;
        }
        effects.push({ kind: "ray", x: player.x, y: player.y, angle: a, len: this.rayLength, half: this.rayHalf * areaMul(), life: 0.3, maxLife: 0.3 });
      }
    },
  },


  // --- 마법 지팡이: 가로줄이나 세로줄 중 적이 가장 많은 줄에 화면을 가로지르는 광선, 레벨↑ = 광선 폭↑ ---
  staff: {
    name: "광선",
    desc: "적이 가장 많은 가로·세로줄에 화면을 가로지르는 광선",
    icon: "staff",
    interval: 2.0,
    damageMul: 1.5,
    upgradeDesc: "광선 폭 +30%, 피해 +20%",
    noAmount: true,                                  // 복제기 영향 없음 (원작과 같음)
    getHalfWidth(w) { return 22 * 1.3 ** (w.level - 1) * areaMul(); },   // 광선 두께의 절반 (22 → 29 → 37 → 48 → 63)
    fire(w) {
      const half = this.getHalfWidth(w);
      const line = findBestLine(half);
      if (!line) return;                         // 화면에 적이 없으면 쏘지 않음
      for (const e of enemies) {
        if (!e.dead && isInLine(e, line, half)) damageEnemy(e, weaponDamage(w, 1));
      }
      effects.push({ kind: "beam", horizontal: line.horizontal, pos: line.pos, half, life: 0.35, maxLife: 0.35 });
    },
  },

  // --- 보호막: 공격을 한 번 막아 주고, 시간이 지나면 다시 생김. 레벨↑ = 재충전 시간↓ ---
  shield: {
    name: "보호막",
    desc: "공격을 한 번 막아 주고, 시간이 지나면 다시 생김",
    icon: "shield",
    interval: 0,
    noAttack: true,                                  // 적을 해치지 못함 → 병기공 시작 무기 목록에서 뺌 (이것만 들고 시작하면 적을 못 잡아 레벨업도 못 함)
    upgradeDesc: "재충전 시간 -1.1초 (최소 2.5초)",
    getRecharge(w) { return Math.max(2.5, 10 - 1.1 * (w.level - 1)) / durationMul(); },   // 처음 10초 → 최소 2.5초 (주문서로 더 짧아짐)
    update(w, dt) {
      if (w.ready === undefined) w.ready = true;           // 처음 얻으면 바로 켜진 상태
      if (!w.ready) {
        w.recharge -= dt;
        if (w.recharge <= 0) w.ready = true;
      }
    },
    // 공격을 막았을 때 호출됨 (hurtPlayer 에서)
    breakShield(w) {
      w.ready = false;
      w.recharge = this.getRecharge(w);
      spawnParticles(player.x, player.y, "#7df9ff", 14, 200);
      effects.push({ kind: "ring", x: player.x, y: player.y, r: player.r * 1.9, color: "#7df9ff", life: 0.3, maxLife: 0.3, fx: "fx_zap" });
      floatTexts.push({ x: player.x, y: player.y - 34, text: "막음!", color: "#7df9ff", life: 0.9, maxLife: 0.9 });
    },
    draw(w) {
      const r = player.r * 1.9;
      if (w.ready) {
        // 켜져 있을 때: 캐릭터를 감싸는 하늘색 방울
        ctx.fillStyle = "rgba(125, 249, 255, 0.12)";
        ctx.strokeStyle = "rgba(125, 249, 255, 0.95)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(player.x, player.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      // 재충전 중에는 캐릭터 주변에 아무것도 그리지 않음 (남은 시간은 오른쪽 보유 목록에 표시)
    },
  },

  // =================== 2·3단계 무기 (원작에서 가져온 것 중 이 게임의 그림으로 살릴 수 있는 것만) ===================


  // --- 폭탄: 닿으면 터지고 벽에서도 가끔 폭발. Lv3·5·7 폭탄 +1, 짝수 레벨 폭발 확률 +10% ---
  cherry: {
    name: "폭탄", icon: "w_bomb",
    desc: "적에 닿으면 터지고, 벽에 튕기면 가끔 터지며, 2.5초가 지나면 반드시 터짐",
    interval: 2.4,
    upgradeDesc: "폭탄 +1 / 폭발 확률 +10% (번갈아), 피해 +20%",
    fire(w) {
      const count = 1 + Math.floor((w.level - 1) / 2);
      const chance = 0.6 + 0.1 * Math.floor(w.level / 2);
      const explode = (b) => {
        const r = 90 * areaMul();
        for (const e of enemies) if (!e.dead && Math.hypot(e.x - b.x, e.y - b.y) < r + e.r) damageEnemy(e, b.damage);
        effects.push({ x: b.x, y: b.y, r, life: 0.3, maxLife: 0.3, rgb: "255, 140, 40", fx: "fx_blast" });
        b.dead = true;
      };
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        bullets.push({
          kind: "cherry", sprite: "w_bomb", size: 15, spin: 9, onHit: explode,
          x: player.x, y: player.y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340, r: 8,
          damage: weaponDamage(w, 1) * 1.6, bounces: 99, life: 2.5 * durationMul(),
          onBounce(b) { if (Math.random() < chance) explode(b); },
          onExpire: explode,
        });
      }
    },
  },

  // --- 운석: 바위가 위에서 떨어져 튕김 (원작 La Robba 의 가구를 던전 분위기에 맞게 운석으로 바꿈). Lv3·5 바위 +1, Lv2·4 튕김 +1 ---
  larobba: {
    name: "운석", icon: "w_meteor",
    desc: "적 머리 위로 운석을 떨어뜨림. 튕기며 여러 번 관통",
    interval: 2.5,
    upgradeDesc: "운석 +1 / 튕김 +1 (번갈아), 피해 +20%",
    fire(w) {
      const count = 1 + Math.floor((w.level - 1) / 2);
      const targets = enemies.filter((e) => !e.dead && inView(e.x, e.y));
      if (!targets.length) return;
      for (let i = 0; i < count; i++) {
        const t = targets[Math.floor(Math.random() * targets.length)];
        bullets.push({
          kind: "rock", sprite: "fx_meteor_p", meteor: true, color: "#7df9ff", size: METEOR_SIZE, margin: 500,
          x: t.x + (Math.random() - 0.5) * 60, y: t.y - 220, vx: (Math.random() - 0.5) * 60, vy: 60,
          gravity: 900, r: 18, damage: weaponDamage(w, 1) * 1.5, pierce: 99, hitIds: new Set(),
          bounces: 2 + Math.floor(w.level / 2), life: 5 * durationMul(),
          onBounce: meteorImpactFx,
        });
      }
    },
  },

  // =================== 3단계 무기 ===================

  // --- 그림자 발톱: 움직이면 바닥에 그림자 흔적, 멈추면 그 자리에서 폭발 (원작 Shadow Pinion). Lv2·4 흔적 +20%, Lv3·5 폭발 +1 ---
  shadow: {
    name: "그림자 발톱", icon: "w_shadow",
    desc: "움직이는 동안 그림자 흔적이 피해를 주고, 멈추면 그 자리에서 폭발",
    interval: 0,
    upgradeDesc: "흔적 범위 +20% / 폭발 +1 (번갈아), 피해 +20%",
    update(w, dt) {
      if (isMoving()) {
        w.stopped = 0; w.exploded = false;
        w.trailT = (w.trailT || 0) - dt;
        if (w.trailT <= 0) {
          w.trailT = 0.15;
          zones.push({ kind: "shadow", x: player.x, y: player.y, r: 18 * 1.2 ** Math.floor(w.level / 2) * areaMul(), life: 1.5 * durationMul(), maxLife: 1.5 * durationMul(), tick: 0, interval: 0.3, damage: weaponDamage(w) * 0.5 });
        }
      } else {
        w.stopped = (w.stopped || 0) + dt;
        if (w.stopped >= 0.3 && !w.exploded) {
          w.exploded = true;
          const blasts = 1 + Math.floor((w.level - 1) / 2);
          const r = 80 * areaMul();
          for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < r + e.r) damageEnemy(e, weaponDamage(w, 1) * blasts);
          effects.push({ x: player.x, y: player.y, r, life: 0.35, maxLife: 0.35, rgb: "80, 40, 120", fx: "fx_claw" });
        }
      }
    },
  },

  // --- 질풍검: 장검와 같지만 계속 움직일수록 세지고 치명타 (원작 Vento Sacro). Lv 치명타 +5%, 범위 +20% ---
  vento: {
    name: "질풍검", icon: "bigsword",
    desc: "앞뒤로 베며, 5초 움직이면 피해 2배. 멈추면 서서히 약해짐",
    interval: 1.0,
    upgradeDesc: "치명타 +5% / 범위 +20% (번갈아), 피해 +20%",
    getRadius(w) { return 75 * 1.2 ** Math.floor(w.level / 2) * areaMul(); },
    update(w, dt) { w.moveTime = isMoving() ? Math.min((w.moveTime || 0) + dt, 5) : Math.max(0, (w.moveTime || 0) - dt * 2); },
    fire(w) {
      const r = this.getRadius(w);
      const crit = 0.05 * (1 + Math.floor((w.level - 1) / 2));
      const power = 1 + 0.2 * (w.moveTime || 0);          // 5초 계속 움직이면 2배. 잠깐 방향을 고쳐도 전부 잃지 않음
      const f = { x: player.facingX, y: player.facingY };
      for (const dir of [f, { x: -f.x, y: -f.y }]) {
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          if (Math.hypot(dx, dy) < r + e.r && dx * dir.x + dy * dir.y > 0) {
            const isCrit = Math.random() < crit;
            damageEnemy(e, weaponDamage(w, 1) * power * (isCrit ? 2 : 1));
            if (isCrit) floatTexts.push({ x: e.x, y: e.y - 20, text: "치명타!", color: "#ffd60a", life: 0.6, maxLife: 0.6 });
            pushEnemy(e, player.x, player.y, 20);
          }
        }
        effects.push({ kind: "slash", x: player.x, y: player.y, angle: Math.atan2(dir.y, dir.x), r, life: 0.2, maxLife: 0.2 });
      }
    },
  },

  // --- 뼈: 튕기는 뼈를 던짐, 움직이면 더 자주 (원작 Celestial Dusting). Lv3·5 뼈 +1, Lv2·4 튕김 +1 ---
  //     2026-10-12 에 꽃가루에서 이름·그림만 바꿈. 키 dusting · kind petal 은 예전 이름 그대로 둠
  dusting: {
    name: "망자의 뼈", icon: "w_bone",
    desc: "튕겨 다니는 뼈를 던짐. 움직이는 동안은 더 자주 던짐",
    interval: 1.4,
    upgradeDesc: "뼈 +1 / 튕김 +1 (번갈아), 피해 +20%",
    update(w, dt) { if (isMoving()) w.timer -= dt * 0.6; },   // 움직이면 간격이 1.6배 빨리 줄어듦
    fire(w) {
      const count = 2 + Math.floor((w.level - 1) / 2);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2;
        bullets.push({
          kind: "petal", sprite: "w_bone", size: 18, spin: 8, spinOffset: a, color: "#efe6d0",   // spinOffset: 뼈마다 도는 각도가 다르게 (던진 방향을 시작 각도로 씀)
          x: player.x, y: player.y, vx: Math.cos(a) * 300, vy: Math.sin(a) * 300, r: 7,
          damage: weaponDamage(w, 1), pierce: 99, hitIds: new Set(), bounces: 3 + Math.floor(w.level / 2), life: 3 * durationMul(),
        });
      }
    },
  },

  // --- 승리의 검: 가장 가까운 적을 연속 콤보로 벰, 맞으면 반격 (원작 Victory Sword). Lv3·5 콤보 +1, Lv2·4 피해 +30% ---
  victory: {
    name: "승리의 검", icon: "bigsword", iconMark: "v",
    desc: "가까운 적을 3연속 콤보로 베고, 내가 맞으면 주위를 반격",
    interval: 1.3, range: 170,
    upgradeDesc: "콤보 +1 / 피해 +30% (번갈아), 피해 +20%",
    fire(w) {
      const t = findNearestEnemy();
      if (!t || Math.hypot(t.x - player.x, t.y - player.y) > this.range * areaMul()) return;
      const hits = 3 + Math.floor((w.level - 1) / 2);
      w.pending = w.pending || [];
      for (let i = 0; i < hits; i++) w.pending.push({ delay: i * 0.12, target: t });
    },
    update(w, dt) {
      if (!w.pending) return;
      const bonus = 1.3 ** Math.floor(w.level / 2);
      for (const p of w.pending) {
        p.delay -= dt;
        if (p.delay <= 0) {
          p.done = true;
          const t = p.target.dead ? findNearestEnemy() : p.target;
          if (!t || Math.hypot(t.x - player.x, t.y - player.y) > this.range * areaMul() + 40) continue;
          damageEnemy(t, weaponDamage(w, 1) * bonus);
          effects.push({ kind: "slash", x: t.x, y: t.y, angle: Math.random() * Math.PI * 2, r: 22, life: 0.15, maxLife: 0.15 });
        }
      }
      w.pending = w.pending.filter((p) => !p.done);
    },
    // 반격: 플레이어가 맞았을 때 hurtPlayer 에서 호출
    retaliate(w) {
      const r = 90 * areaMul();
      for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < r + e.r) { damageEnemy(e, weaponDamage(w, 1)); pushEnemy(e, player.x, player.y, 25); }
      effects.push({ kind: "ring", x: player.x, y: player.y, r: 20, color: "#f0feff", life: 0.3, maxLife: 0.3, fx: "fx_parry" });
    },
  },

  // --- 화염 방사: 바라보는 방향으로 부채꼴 불길. Lv3 뒤쪽 불길 추가, 짝수 레벨 범위 +20% ---
  flames: {
    name: "화염 방사", icon: "w_flames",
    desc: "바라보는 방향으로 부채꼴 불길을 내뿜음",
    interval: 0.75, range: 180, halfAngle: 0.65,
    damageMul: 1.2,
    upgradeDesc: "Lv3 뒤쪽 불길 추가, 짝수 레벨 범위 +20%, 피해 +20%",
    fire(w) {
      const range = this.range * 1.2 ** Math.floor(w.level / 2) * areaMul();
      const cones = w.level >= 3 ? 2 : 1;
      const f = { x: player.facingX, y: player.facingY };
      for (let c = 0; c < cones; c++) {
        const dir = c === 0 ? f : { x: -f.x, y: -f.y };
        const angle = Math.atan2(dir.y, dir.x);
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          const dist = Math.hypot(dx, dy);
          if (dist > range + e.r) continue;
          let diff = Math.atan2(dy, dx) - angle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          if (Math.abs(diff) < this.halfAngle) damageEnemy(e, weaponDamage(w, 1));
        }
        effects.push({ kind: "cone", x: player.x, y: player.y, angle, len: range, half: this.halfAngle, life: 0.3, maxLife: 0.3 });
      }
    },
  },

};

// 지금 이동 키를 누르고 있는지 (그림자 발톱, 질풍검, 뼈가 씀)
function isMoving() {
  return !!(keys.w || keys.a || keys.s || keys.d || keys.arrowup || keys.arrowdown || keys.arrowleft || keys.arrowright || joystickDir());
}

// =====================================================================
// 2-1-1. 진화: 무기가 최대 레벨이고 짝이 되는 패시브도 최대 레벨인 채 보물 상자를 열면 진화
//   EVOLUTIONS[기본 무기] = { to: 진화 무기, needs: 패시브 }  ← 무기 만렙 + 그 패시브 만렙이어야 함
//   진화 무기는 레벨이 없고(항상 최대), 더 강화되지 않으며, '새 무기' 카드로는 나오지 않음
//   진화 무기 정의는 기본 무기를 복사한 뒤 일부만 덮어씀 (같은 그림을 씀)
// =====================================================================
const EVOLUTIONS = {
  sword:     { to: "sword_evo",     needs: "maxhp" },
  wand:      { to: "wand_evo",      needs: "cooldown" },
  bullet:    { to: "bullet_evo",    needs: "projspeed" },
  hammer:    { to: "hammer_evo",    needs: "area" },
  cross:     { to: "cross_evo",     needs: "luck" },
  orb:       { to: "orb_evo",       needs: "duration" },
  firewand:  { to: "firewand_evo",  needs: "might" },
  aura:      { to: "aura_evo",      needs: "regen" },
  bomb:      { to: "bomb_evo",      needs: "magnet" },
  rune:      { to: "rune_evo",      needs: "armor" },
  lightning: { to: "lightning_evo", needs: "amount" },
  pentagram: { to: "pentagram_evo", needs: "growth" },
  staff:     { to: "staff_evo",     needs: "curse" },
  clock:     { to: "clock_evo",     needs: "revival" },
  shield:    { to: "shield_evo",    needs: "move" },
  spear:     { to: "spear_evo",     needs: "move" },
  // 전투 패시브는 15종이라 일부는 함께 씀. 같은 패시브는 무기 두 종까지만 연결.
  cherry:    { to: "cherry_evo",    needs: "luck" },
  larobba:   { to: "larobba_evo",   needs: "area" },
  shadow:    { to: "shadow_evo",    needs: "duration" },
  flames:    { to: "flames_evo",    needs: "might" },
};
function evolvedDef(base, overrides) {
  return Object.assign({}, WEAPONS[base], { evolved: true, evoOf: base }, overrides);
}
Object.assign(WEAPONS, {
  sword_evo: evolvedDef("sword", { name: "피의 검", icon: "w_bloodsword", desc: "3연속 베기. 벨 때마다 체력 1 회복", damageMul: 2.0,
    fire(w) { this.slash(w, { x: player.facingX, y: player.facingY }); w.pending = [{ delay: 0.12, dir: { x: -player.facingX, y: -player.facingY } }, { delay: 0.24, dir: { x: 0, y: -1 } }]; },
    slash(w, dir) {
      const r = this.getRadius(w); let hits = 0;
      for (const e of enemies) { if (e.dead) continue; const dx = e.x - player.x, dy = e.y - player.y; if (Math.hypot(dx, dy) < r + e.r && dx * dir.x + dy * dir.y > 0) { damageEnemy(e, weaponDamage(w, 1)); pushEnemy(e, player.x, player.y, 30); hits++; } }
      if (hits > 0) player.hp = Math.min(player.maxHp, player.hp + 1);
      effects.push({ kind: "slash", x: player.x, y: player.y, angle: Math.atan2(dir.y, dir.x), r, life: 0.2, maxLife: 0.2 });
    } }),
  wand_evo: evolvedDef("wand", { name: "성스러운 봉", desc: "쉬지 않고 마법탄을 쏨", interval: 0.3, damageMul: 2.4 }),
  bullet_evo: evolvedDef("bullet", { name: "천 개의 칼날", desc: "단검이 폭포처럼 쏟아짐", interval: 0.16 }),
  hammer_evo: evolvedDef("hammer", { name: "죽음의 나선", desc: "망치 8개가 사방으로 회전하며 날아감", interval: 1.3,
    fire(w) { for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8 + stats.time; bullets.push({ kind: "hammer", sprite: "hammer", size: 17, spin: 10, margin: 200, x: player.x, y: player.y, vx: Math.cos(a) * 330, vy: Math.sin(a) * 330, r: 12, damage: weaponDamage(w) * 2 * 1.25 ** Math.floor(w.level / 2), pierce: 99, hitIds: new Set(), life: 2.5 }); } } }),
  cross_evo: evolvedDef("cross", { name: "수호자의 방패", desc: "더 많이, 더 빠르게 돌아오는 방패", interval: 1.4, damageMul: 1.8 }),
  orb_evo: evolvedDef("orb", { name: "회오리 도끼", desc: "도끼 +2개가 더 빠르게 돎", extraCount: 2, rotateSpeed: 4.5, damageMul: 2.4 }),
  firewand_evo: evolvedDef("firewand", { name: "지옥불", desc: "거대한 화염구를 연달아 쏨", interval: 1.6, damageMul: 1.6 }),
  aura_evo: evolvedDef("aura", { name: "영혼 포식자", desc: "더 넓은 오라. 맞힌 적마다 체력 0.5 회복 (발동당 최대 2)", damageMul: 1.4,
    getRadius(w) { return WEAPONS.aura.getRadius(w) * 1.25; },
    fire(w) { const r = this.getRadius(w); let hits = 0; for (const e of enemies) { if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < r + e.r) { damageEnemy(e, weaponDamage(w)); pushEnemy(e, player.x, player.y, 10); hits++; } } if (hits) player.hp = Math.min(player.maxHp, player.hp + Math.min(2, 0.5 * hits)); w.flash = 0.15; } }),
  bomb_evo: evolvedDef("bomb", { name: "불바다", desc: "불바다가 더 크고 오래가며 나를 따라옴", damageMul: 1.2,
    fire(w) { const before = bullets.length; WEAPONS.bomb.fire.call(this, w); for (let i = before; i < bullets.length; i++) { bullets[i].zoneRadius *= 1.25; bullets[i].zoneLife *= 1.5; bullets[i].zoneFollow = true; } } }),
  rune_evo: evolvedDef("rune", { name: "파열구", desc: "구슬이 오래 튕기고, 튕길 때마다 폭발", damageMul: 1.5,
    fire(w) { const before = bullets.length; WEAPONS.rune.fire.call(this, w); for (let i = before; i < bullets.length; i++) { const b = bullets[i]; b.life *= 2; b.onBounce = (x) => { const r = 60 * areaMul(); for (const e of enemies) if (!e.dead && Math.hypot(e.x - x.x, e.y - x.y) < r + e.r) damageEnemy(e, x.damage); effects.push({ x: x.x, y: x.y, r, life: 0.25, maxLife: 0.25, fx: "fx_shock" }); }; } } }),
  lightning_evo: evolvedDef("lightning", { name: "뇌우", desc: "번개가 두 번씩 내리침", damageMul: 1.3,
    fire(w) { WEAPONS.lightning.fire.call(this, w); w.pending = [{ delay: 0.2 }]; },
    update(w, dt) { if (!w.pending) return; for (const p of w.pending) { p.delay -= dt; if (p.delay <= 0) { p.done = true; WEAPONS.lightning.fire.call(this, w); } } w.pending = w.pending.filter((p) => !p.done); } }),
  pentagram_evo: evolvedDef("pentagram", { name: "별의 심판", desc: "자주 발동하고, 지운 적의 경험치 구슬이 전부 빨려옴", interval: 6, getInterval() { return this.interval; },
    fire(w) { WEAPONS.pentagram.fire.call(this, w); for (const g of gems) { g.magnet = true; g.speed = Math.max(g.speed || 0, 400); } } }),
  staff_evo: evolvedDef("staff", { name: "마나의 폭풍", desc: "가로줄과 세로줄에 동시에 두 배 굵은 광선", damageMul: 2,
    getHalfWidth(w) { return 22 * 1.3 ** (w.level - 1) * 2 * areaMul(); },
    fire(w) { const half = this.getHalfWidth(w); const onScreen = enemies.filter((e) => !e.dead && inView(e.x, e.y)); for (const horizontal of [true, false]) { let best = null; for (const c of onScreen) { const line = { horizontal, pos: horizontal ? c.y : c.x }; let count = 0; for (const e of onScreen) if (isInLine(e, line, half)) count++; if (!best || count > best.count) best = { ...line, count }; } if (!best) continue; for (const e of enemies) if (!e.dead && isInLine(e, best, half)) damageEnemy(e, weaponDamage(w, 1)); effects.push({ kind: "beam", horizontal: best.horizontal, pos: best.pos, half, life: 0.35, maxLife: 0.35 }); } } }),
  clock_evo: evolvedDef("clock", { name: "빙결 십자", desc: "4방향 광선. 얼린 적의 체력을 30% 깎음", interval: 1.2,
    fire(w) { w.dir = ((w.dir || 0) + 1) % 12; const freezeFor = (3.5 + 0.5 * (w.level - 1)) * durationMul(); for (let k = 0; k < 4; k++) { const a = (w.dir / 12) * Math.PI * 2 + (k * Math.PI) / 2; const ux = Math.cos(a), uy = Math.sin(a); for (const e of enemies) { if (e.dead || e.boss) continue; const dx = e.x - player.x, dy = e.y - player.y; const along = dx * ux + dy * uy, across = Math.abs(dx * uy - dy * ux); if (along > 0 && along < this.rayLength && across < this.rayHalf * areaMul() + e.r) { e.frozenTimer = freezeFor; damageEnemy(e, Math.ceil(e.maxHp * 0.3)); } } effects.push({ kind: "ray", x: player.x, y: player.y, angle: a, len: this.rayLength, half: this.rayHalf * areaMul(), life: 0.3, maxLife: 0.3 }); } } }),
  shield_evo: evolvedDef("shield", { name: "푸른 장막", desc: "2초마다 다시 생기고, 깨질 때 주위 적을 밀어내며 피해",
    getRecharge() { return 2 / durationMul(); },
    breakShield(w) { WEAPONS.shield.breakShield.call(this, w); const r = 120; for (const e of enemies) if (!e.dead && Math.hypot(e.x - player.x, e.y - player.y) < r + e.r) { damageEnemy(e, 20 * damageMul()); pushEnemy(e, player.x, player.y, 60); } } }),
  spear_evo: evolvedDef("spear", { name: "폭풍의 창", desc: "더 강한 창 3개를 더 빠르게 던짐", damageMul: 1.7,
    getInterval(w) { return WEAPONS.spear.getInterval.call(this, w) * 0.7; },
    fire(w) { const target = findNearestEnemy(); if (!target) return; const base = Math.atan2(target.y - player.y, target.x - player.x); for (let i = -1; i <= 1; i++) { const a = base + i * 0.25; bullets.push({ kind: "spear", sprite: "spear", size: 21, x: player.x, y: player.y, vx: Math.cos(a) * 600, vy: Math.sin(a) * 600, r: 6, damage: weaponDamage(w, 1), pierce: 99, hitIds: new Set() }); } } }),
  // 폭탄이 터진 자리에서 작은 파편 여섯 개가 퍼짐. 파편은 다시 갈라지지 않음.
  cherry_evo: evolvedDef("cherry", { name: "연쇄 폭탄", desc: "폭발할 때 관통 파편 6개가 사방으로 퍼짐", interval: 2.0, damageMul: 1.15,
    fire(w) {
      const before = bullets.length;
      WEAPONS.cherry.fire.call(this, w);
      for (const b of bullets.slice(before)) {
        const originalBlast = b.onHit;
        const burst = (bomb) => {
          if (bomb.dead) return;
          originalBlast(bomb);
          for (let i = 0; i < 6; i++) {
            const a = stats.time + Math.PI * 2 * i / 6;
            bullets.push({ kind: "cherry", sprite: this.icon, size: 10, spin: 12,
              x: bomb.x, y: bomb.y, vx: Math.cos(a) * 320 * projSpeedMul(), vy: Math.sin(a) * 320 * projSpeedMul(),
              r: 6, damage: bomb.damage * 0.5, pierce: 2, hitIds: new Set(), life: 1.2 * durationMul() });
          }
        };
        b.onHit = burst; b.onExpire = burst; b.onBounce = burst;
      }
    } }),
  // 운석은 적이나 벽에 닿으면 터지고, 그 자리에 불바다를 남겨 길목을 막음.
  larobba_evo: evolvedDef("larobba", { name: "분화구 운석", desc: "운석이 폭발하고 떨어진 자리에 불바다를 남김", interval: 2.1, damageMul: 1.2,
    fire(w) {
      const before = bullets.length;
      WEAPONS.larobba.fire.call(this, w);
      for (const b of bullets.slice(before)) {
        const impact = (rock) => {
          if (rock.dead) return;
          rock.dead = true;
          const r = 75 * areaMul(), life = 3 * durationMul();
          for (const e of enemies) if (!e.dead && Math.hypot(e.x - rock.x, e.y - rock.y) < r + e.r) damageEnemy(e, rock.damage * 2);
          zones.push({ kind: "fire", x: rock.x, y: rock.y, r, life, maxLife: life, tick: 0, interval: 0.3, damage: rock.damage * 0.3 });
          effects.push({ x: rock.x, y: rock.y, r, life: 0.35, maxLife: 0.35, rgb: "255, 120, 40", fx: "fx_blast" });
        };
        b.onHit = impact; b.onBounce = impact; b.onExpire = impact;
      }
    } }),
  // 이동 중 남긴 흔적을 모았다가, 멈출 때 가까운 적에게 관통 발톱으로 날림.
  shadow_evo: evolvedDef("shadow", { name: "밤의 행진", desc: "오래 남는 그림자 흔적. 멈추면 흔적 6개가 적을 향해 날아감", damageMul: 1.5,
    update(w, dt) {
      const before = zones.length, wasExploded = w.exploded;
      WEAPONS.shadow.update.call(this, w, dt);
      w.trails = (w.trails || []).filter((z) => z.life > 0);
      for (const z of zones.slice(before)) {
        z.life *= 1.4; z.maxLife = z.life;
        w.trails.push(z);
      }
      if (!wasExploded && w.exploded) {
        const target = findNearestEnemy();
        if (!target) return;
        for (const z of w.trails.slice(-6)) {
          const a = Math.atan2(target.y - z.y, target.x - z.x);
          bullets.push({ kind: "shadow", sprite: this.icon, size: 18,
            x: z.x, y: z.y, vx: Math.cos(a) * 500 * projSpeedMul(), vy: Math.sin(a) * 500 * projSpeedMul(),
            r: 9, damage: weaponDamage(w, 1) * 1.5, pierce: 99, hitIds: new Set(), life: 1.5 * durationMul() });
          z.life = 0;                       // 날아간 흔적은 바닥에 남지 않음
        }
      }
    } }),
  // 바라보는 방향과 상관없이 네 갈래 불길이 회전하며 사방의 적을 훑음.
  flames_evo: evolvedDef("flames", { name: "화염 소용돌이", desc: "네 갈래 불길이 빙글 돌며 사방의 적을 태움", interval: 0.85, damageMul: 1.4,
    update(w, dt) { w.angle = (w.angle || 0) + dt * 0.8; },
    fire(w) {
      const range = this.range * 1.2 ** Math.floor(w.level / 2) * areaMul();
      for (let i = 0; i < 4; i++) {
        const angle = (w.angle || 0) + Math.PI * i / 2;
        for (const e of enemies) {
          if (e.dead) continue;
          const dx = e.x - player.x, dy = e.y - player.y;
          const diff = Math.atan2(Math.sin(Math.atan2(dy, dx) - angle), Math.cos(Math.atan2(dy, dx) - angle));
          if (Math.hypot(dx, dy) < range + e.r && Math.abs(diff) < this.halfAngle) damageEnemy(e, weaponDamage(w, 1));
        }
        effects.push({ kind: "cone", x: player.x, y: player.y, angle, len: range, half: this.halfAngle, life: 0.3, maxLife: 0.3 });
      }
    } }),
});
for (const base in EVOLUTIONS) { WEAPONS[base].evolvesTo = EVOLUTIONS[base].to; WEAPONS[base].needs = EVOLUTIONS[base].needs; }
