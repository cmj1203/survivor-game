// 적 능력치·등장 순서와 전투 판정 (적이 맞고 죽을 때 일어나는 일)
import { describe, expect, test } from "bun:test";
import { type Game, startedGame } from "./game-env";

function gameOnDiff(diff: number) {
  return startedGame({ "dungeon-survivor-meta": JSON.stringify({ version: 1, diff, stats: { maxClearDiff: 3 } }) });
}
// 적 하나를 플레이어 옆에 만들어 목록에 넣고 그 번호를 돌려줌
function addEnemy(g: Game, typeExpr: string, extra = "") {
  return g.run<number>(`(() => { const e = makeEnemy(${typeExpr}, player.x + 50, player.y); ${extra}; enemies.push(e); return enemies.length - 1; })()`);
}

describe("적 능력치", () => {
  test("시작 시각(보통): 체력·피해는 전체 난이도 1.5배, 속도는 그대로", () => {
    const g = startedGame();
    expect(g.json("(({ hp, maxHp, damage, speed, xp, r }) => ({ hp, maxHp, damage, speed, xp, r }))(makeEnemy(ENEMY_TYPES[4], 0, 0))"))
      .toEqual({ hp: 12, maxHp: 12, damage: 27, speed: 40, xp: 4, r: 20 });
    expect(g.run("makeEnemy(ENEMY_TYPES[0], 0, 0).hp")).toBe(2);   // 박쥐 1 × 1.5 → 반올림 2
  });

  test("시간이 지나면 체력·피해·속도가 오르고, 속도·피해는 상한에서 멈춤", () => {
    const g = startedGame();
    g.run("stats.time = 400");   // 30분 기준으로 600초 = 10분
    const e = g.json<{ hp: number; damage: number; speed: number }>("makeEnemy(ENEMY_TYPES[4], 0, 0)");
    expect(e.hp).toBe(46);       // 8 × 1.5 × 2.4 × 1.6
    expect(e.damage).toBe(43);   // 18 × 1.5 × 1.6
    expect(e.speed).toBeCloseTo(52, 9);   // 40 × 1.3 (상한)
    g.run("stats.time = 1199");
    const late = g.json<{ damage: number; speed: number }>("makeEnemy(ENEMY_TYPES[4], 0, 0)");
    expect(late.damage).toBe(54);         // 피해 상한 2배
    expect(late.speed).toBeCloseTo(52, 9);
  });

  test("난이도 배수와 상점 저주가 적에게 곱해짐", () => {
    const g = startedGame({ "dungeon-survivor-meta": JSON.stringify({ version: 1, diff: 3, upgrades: { curse: 2 }, stats: { maxClearDiff: 2 } }) });
    const e = g.json<{ hp: number; damage: number; speed: number; shape: string }>("makeEnemy(ENEMY_TYPES[4], 0, 0)");
    expect(e.hp).toBe(22);                // 8 × 1.5 × 1.6 × 1.12 = 21.504 → 22
    expect(e.damage).toBe(35);            // 18 × 1.5 × 1.3
    expect(e.speed).toBeCloseTo(40 * 1.06 * 1.12, 9);
    expect(e.shape).toBe("cyclops_dark"); // 테마 색 그림
  });

  test("새끼 거미는 반 크기, 체력 기본, 피해 절반(올림), 1.15배 빠름, 다시 안 갈라짐", () => {
    const g = startedGame();
    expect(g.json("(({ r, hp, damage, speed, xp, splitInto }) => ({ r, hp, damage, speed, xp, splitInto }))(makeEnemy(ENEMY_TYPES[2], 0, 0, true))"))
      .toEqual({ r: 7, hp: 2, damage: 8, speed: 55 * 1.15, xp: 1, splitInto: 0 });
  });

  test("난이도 특성: 게 껍질·거미 분열 수가 단계마다 다름", () => {
    expect(startedGame().json("[makeEnemy(ENEMY_TYPES[1], 0, 0).shell, makeEnemy(ENEMY_TYPES[2], 0, 0).splitInto]")).toEqual([null, 2]);   // 보통: 껍질 없음
    expect(gameOnDiff(3).json("[makeEnemy(ENEMY_TYPES[1], 0, 0).shell, makeEnemy(ENEMY_TYPES[2], 0, 0).splitInto]")).toEqual([2, 4]);
  });

  test("엘리트는 크기 1.8배·체력 12배·피해 1.5배·속도 0.9배·경험치 5배", () => {
    const g = startedGame();
    const e = g.json<Record<string, number | boolean>>("spawnElite()");
    expect(e).toMatchObject({ elite: true, r: 20, hp: 24, maxHp: 24, damage: 18, xp: 5 });
    expect(e.speed).toBeCloseTo(72, 9);
  });
});

describe("등장 순서", () => {
  test("몬스터 단계는 30분 기준 시간표(0, 90, 240 … 초)로 바뀜", () => {
    const g = startedGame();
    const stageAt = (t: number) => g.run<number>(`stats.time = ${t}; enemyStage()`);
    expect([0, 59.9, 60, 160, 1080, 1200].map(stageAt)).toEqual([0, 0, 1, 2, 9, 9]);
  });

  test("주력 적은 스테이지 테마의 같은 자리 적이고, 다섯 단계마다 처음으로 돌아감", () => {
    const g = startedGame();
    expect(g.run("stats.time = 60; currentEnemyType().key")).toBe("crab");
    expect(g.run("stats.time = 600; currentEnemyType().key")).toBe("bat");   // 5단계 = 두 바퀴째 박쥐
    expect(gameOnDiff(1).run("stats.time = 60; currentEnemyType().key")).toBe("polarbear");
    expect(gameOnDiff(2).run("bossType().key")).toBe("demon");
  });

  test("새 몬스터 비율은 열린 직후 15%에서 15초 동안 70%까지 오름", () => {
    const g = startedGame();
    const share = (t: number) => g.run<number>(`stats.time = ${t}; player.stageChangedAt = 100; newEnemyShare()`);
    expect(share(100)).toBeCloseTo(0.15, 9);
    expect(share(107.5)).toBeCloseTo(0.425, 9);
    expect(share(200)).toBeCloseTo(0.7, 9);
  });

  test("두 바퀴째 적은 경험치가 2배", () => {
    const g = startedGame();
    expect(g.run("stats.time = 600; makeEnemy(ENEMY_TYPES[3], 0, 0).xp")).toBe(6);
  });
});

describe("적이 맞을 때", () => {
  test("체력이 남으면 살아 있고, 0 이하가 되면 죽어서 처치 수 +1, 그 자리에 구슬", () => {
    const g = startedGame();
    const i = addEnemy(g, "ENEMY_TYPES[4]");
    g.run(`damageEnemy(enemies[${i}], 11)`);
    expect(g.json(`[enemies[${i}].hp, !!enemies[${i}].dead, stats.kills]`)).toEqual([1, false, 0]);
    g.run(`damageEnemy(enemies[${i}], 1)`);
    expect(g.json(`[!!enemies[${i}].dead, stats.kills, gems.length, gems[0].value]`)).toEqual([true, 1, 1, 4]);
    g.run(`damageEnemy(enemies[${i}], 100)`);   // 이미 죽은 적은 다시 세지 않음
    expect(g.run("stats.kills")).toBe(1);
  });

  test("게 껍질은 공격을 피해 없이 막고 하나씩 깨짐", () => {
    const g = gameOnDiff(3);
    const i = addEnemy(g, "ENEMY_TYPES[1]");
    const hp = g.run<number>(`enemies[${i}].hp`);
    g.run(`damageEnemy(enemies[${i}], 999); damageEnemy(enemies[${i}], 999)`);
    expect(g.json(`[enemies[${i}].hp, enemies[${i}].shell, !!enemies[${i}].dead]`)).toEqual([hp, 0, false]);
    g.run(`damageEnemy(enemies[${i}], 999)`);
    expect(g.run(`!!enemies[${i}].dead`)).toBe(true);
  });

  test("거미는 죽으면 새끼 2마리가 다음 프레임 목록(pendingSpawns)에 생김", () => {
    const g = startedGame();
    const i = addEnemy(g, "ENEMY_TYPES[2]");
    g.run(`damageEnemy(enemies[${i}], 999)`);
    expect(g.json("pendingSpawns.map((e) => [e.type, e.r, e.splitInto])")).toEqual([["spider", 7, 0], ["spider", 7, 0]]);
  });

  test("검은 진흙은 두 번까지 갈라지고 갈라질 때마다 작아지며 체력은 절반", () => {
    const g = gameOnDiff(3);
    const i = addEnemy(g, "findEnemyType('muck')");
    g.run(`damageEnemy(enemies[${i}], 999)`);
    const kids = g.json<{ gen: number; r: number; maxHp: number; splitInto: number }[]>("pendingSpawns");
    expect(kids.map((k) => [k.gen, k.r, k.splitInto])).toEqual([[1, 12, 2], [1, 12, 2]]);
    expect(kids[0].maxHp).toBe(Math.round(g.run<number>(`enemies[${i}].maxHp`) / 2));
    g.run("enemies.push(...pendingSpawns); pendingSpawns = []; damageEnemy(enemies[enemies.length - 1], 999)");
    expect(g.json("pendingSpawns.map((e) => [e.gen, e.r, e.splitInto])")).toEqual([[2, 8, 0], [2, 8, 0]]);
  });

  test("엘리트를 잡으면 상자가 반드시 떨어지고 정예 처치 기록 +1", () => {
    const g = startedGame();
    g.run("const e = spawnElite(); damageEnemy(e, 999)");
    expect(g.json("[chests.length, chests[0].mimic, run.elites]")).toEqual([1, false, 1]);
  });

  test("엘리트 지옥개 무리는 마지막 한 마리를 잡을 때만 상자가 떨어짐", () => {
    const g = gameOnDiff(2);
    g.run("stats.time = 60; const lead = spawnElite(); splitPack(lead, 1, 0)");
    expect(g.json("enemies.map((e) => [e.type, e.elite, e.packSide ?? 0])")).toEqual([["hellhound", true, 0], ["hellhound", true, -1], ["hellhound", true, 1]]);
    g.run("damageEnemy(enemies[0], 9999); damageEnemy(enemies[1], 9999)");
    expect(g.run("chests.length")).toBe(0);
    g.run("damageEnemy(enemies[2], 9999)");
    expect(g.json("[chests.length, run.elites]")).toEqual([1, 1]);
  });

  test("성녀는 8마리 잡을 때마다 체력 2 회복", () => {
    const g = startedGame({ "dungeon-survivor-meta": JSON.stringify({ version: 1, char: "saint", chars: ["saint"] }) });
    g.run("player.hp = 50; for (let i = 0; i < 7; i++) damageEnemy(makeEnemy(ENEMY_TYPES[0], 0, 0), 99)");
    expect(g.run("player.hp")).toBe(50);
    g.run("damageEnemy(makeEnemy(ENEMY_TYPES[0], 0, 0), 99)");
    expect(g.run("player.hp")).toBe(52);
  });

  test("보스를 잡으면 클리어", () => {
    const g = startedGame();
    g.run("spawnBoss(); damageEnemy(boss, 1e9)");
    expect(g.json("[state, meta.stats.clears]")).toEqual(["clear", 1]);
  });
});

describe("목표 찾기·충돌", () => {
  test("가장 가까운 살아 있는 적을 고르고, 사정거리 안의 보스는 먼저 노림", () => {
    const g = startedGame();
    g.run(`
      const far = makeEnemy(ENEMY_TYPES[0], player.x + 300, player.y);
      const near = makeEnemy(ENEMY_TYPES[0], player.x - 100, player.y);
      const dead = makeEnemy(ENEMY_TYPES[0], player.x + 10, player.y); dead.dead = true;
      enemies.push(far, near, dead);`);
    expect(g.run("findNearestEnemy() === enemies[1]")).toBe(true);
    g.run("spawnBoss(); boss.x = player.x + 200; boss.y = player.y");
    expect(g.run("findNearestEnemy() === boss")).toBe(true);
  });

  test("두 원은 중심 거리가 반지름 합보다 작을 때만 닿음", () => {
    const g = startedGame();
    expect(g.json("[circlesTouch({ x: 0, y: 0, r: 5 }, { x: 9.9, y: 0, r: 5 }), circlesTouch({ x: 0, y: 0, r: 5 }, { x: 6, y: 8, r: 5 })]")).toEqual([true, false]);
  });

  test("밀어내기: 엘리트는 절반만, 보스는 안 밀림", () => {
    const g = startedGame();
    expect(g.json("(() => { const e = { x: 10, y: 0 }; pushEnemy(e, 0, 0, 30); const el = { x: 0, y: 10, elite: true }; pushEnemy(el, 0, 0, 30); const b = { x: 10, y: 0, boss: true }; pushEnemy(b, 0, 0, 30); return [e.x, el.y, b.x]; })()"))
      .toEqual([40, 25, 10]);
  });
});
