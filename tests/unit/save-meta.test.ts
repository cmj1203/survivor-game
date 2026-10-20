// 저장 데이터(meta) 읽기·정리, 판 끝 정산(금화·기록·퀘스트), 상점, 이어 하기 저장·불러오기
import { describe, expect, test } from "bun:test";
import { loadGame, startedGame } from "./game-env";

const META = "dungeon-survivor-meta";
const RUN = "dungeon-survivor-run";
const metaStore = (m: object) => ({ [META]: JSON.stringify({ version: 1, ...m }) });

describe("저장 데이터 읽기", () => {
  test("저장이 없으면 기본값", () => {
    const g = loadGame();
    expect(g.json("[meta.gold, meta.char, meta.diff, meta.fast, meta.stats.maxClearDiff, meta.quests, meta.chars]")).toEqual([0, "knight", 0, false, -1, [], []]);
  });

  test("이상한 값은 고쳐서 읽음 (음수·소수·문자열·상한 넘음·모르는 값)", () => {
    const g = loadGame(metaStore({
      gold: "123.9", upgrades: { might: 99, maxhp: -3, luck: "x", bogus: 4 },
      quests: ["q_time1", "q_time1", "없는 퀘스트"], chars: ["hunter", "hunter", "knight", "nobody"],
      char: "nobody", diff: 9, fast: "yes",
      stats: { kills: -5, runs: 2.7, maxClearDiff: 99, bestTime: "60" },
    }));
    const m = g.json<Record<string, unknown> & { upgrades: Record<string, number>; stats: Record<string, number> }>("meta");
    expect(m.gold).toBe(123);
    expect([m.upgrades.might, m.upgrades.maxhp, m.upgrades.luck, m.upgrades.bogus]).toEqual([5, 0, 0, undefined]);
    expect(m.quests).toEqual(["q_time1"]);
    expect(m.chars).toEqual(["hunter"]);                 // 값이 있는 캐릭터만, 한 번씩
    expect([m.char, m.diff, m.fast]).toEqual(["knight", 3, false]);
    expect([m.stats.kills, m.stats.runs, m.stats.maxClearDiff, m.stats.bestTime, m.stats.clears]).toEqual([0, 2, 3, 60, 0]);
  });

  test("캐릭터 구매가 생기기 전 저장(chars 없음)은 해금한 캐릭터를 산 것으로 침", () => {
    const g = loadGame(metaStore({ quests: ["q_time10", "q_diff1"] }));
    expect(g.json("meta.chars")).toEqual(["hunter", "saint"]);
  });

  test("깨진 저장은 기본값으로 시작하고 원래 글은 -broken 에 따로 보관", () => {
    const g = loadGame({ [META]: "{ 깨진" });
    expect(g.run("meta.gold")).toBe(0);
    expect(g.storage.get(`${META}-broken`)).toBe("{ 깨진");
  });

  test("저장했다 다시 읽으면 같은 값", () => {
    const g = loadGame(metaStore({ gold: 77, upgrades: { might: 2 }, quests: ["q_time1"] }));
    g.run("saveMeta()");
    const again = loadGame({ [META]: g.storage.get(META) ?? "" });
    expect(again.json("meta")).toEqual(g.json("meta"));
  });
});

describe("판 끝 정산", () => {
  test("금화 = (시간/20 + √처치 × 0.6 + 첫 판 40) × 배수, 끝낸 퀘스트 금화는 절반", () => {
    const g = startedGame();
    g.run("stats.time = 600; stats.kills = 400; player.level = 12");
    g.run("finishRun(false)");
    // 30 + 12 + 40 = 82, 퀘스트 '첫 걸음'(2분) 금화 30 → 15 ('7분 버티기'는 무기 보상이라 금화 없음)
    expect(g.json("[meta.gold, meta.quests]")).toEqual([97, ["q_time1", "q_time5"]]);
    expect(g.json("[meta.stats.runs, meta.stats.kills, meta.stats.bestTime, meta.stats.bestLevel, meta.stats.clears]")).toEqual([1, 400, 600, 12, 0]);
    expect(g.run("finishRun(false)")).toBe("");   // 같은 판을 두 번 정산하지 않음
  });

  test("난이도·상점 금화·저주 배수와 보너스 금화", () => {
    const g = startedGame(metaStore({ diff: 2, upgrades: { greed: 2, curse: 3 }, stats: { runs: 5, maxClearDiff: 1 }, quests: ["q_time1"] }));
    g.run("stats.time = 200; stats.kills = 100; run.bonusGold = 20; finishRun(false)");
    expect(g.run("meta.gold")).toBe(Math.round((10 + 6) * 1.6 * 1.2 * 1.15) + 20);
  });

  test("클리어하면 클리어 기록·다음 난이도가 열리고, 난이도별 시간이 남음", () => {
    const g = startedGame(metaStore({ diff: 1, stats: { runs: 3, maxClearDiff: 0 } }));
    g.run("stats.time = 1200.7; stats.kills = 0");
    const html = g.run<string>("finishRun(true)");
    expect(g.json("[meta.stats.clears, meta.stats.clear_knight, meta.stats.maxClearDiff, meta.stats.time_d1, isDiffUnlocked(2), isDiffUnlocked(3)]"))
      .toEqual([1, 1, 1, 1200, true, false]);
    expect(html).toContain("새 난이도 '매우 어려움' 열림");
    expect(g.json("meta.quests")).toEqual(expect.arrayContaining(["q_clear", "q_diff1"]));   // 사신 퇴치·더 어둡게
    expect(g.run("isWeaponLocked('victory')")).toBe(false);
  });

  test("'매우 어려움'을 처음 클리어하면 상점에 1.5배속이 열림", () => {
    const g = startedGame(metaStore({ diff: 2, stats: { runs: 3, maxClearDiff: 1 } }));
    expect(g.run("shopLocked('speed15')")).toBe(true);
    const html = g.run<string>("finishRun(true)");
    expect(html).toContain("1.5배속");
    expect(g.run("shopLocked('speed15')")).toBe(false);
  });

  test("한 판 기록 퀘스트: 맞은 횟수·상점 강화 여부·지옥 캐릭터 비트", () => {
    const g = startedGame(metaStore({ diff: 3, upgrades: { curse: 1 }, stats: { runs: 3, maxClearDiff: 2 } }));
    g.run("run.hits = 3; finishRun(true)");
    // 저주는 '맨몸' 셈에서 빠짐 → 맨몸 클리어. 3번 맞음 → 무결점. 견습 마법사 = 비트 1
    expect(g.json("[meta.stats.n_naked, meta.stats.n_fewhit, meta.stats.mask_hell]")).toEqual([1, 1, 1]);
  });
});

describe("퀘스트 진행 값", () => {
  test("누적 값은 지금 판까지 더하고, 최고 기록은 큰 쪽", () => {
    const g = startedGame(metaStore({ stats: { kills: 900, bestTime: 100 } }));
    g.run("stats.kills = 150; stats.time = 110");
    const v = (id: string) => g.run<number>(`questValue(QUESTS.find((q) => q.id === '${id}'), true, false)`);
    expect([v("q_kill500"), v("q_time5")]).toEqual([1050, 110]);
    g.run("stats.time = 90");
    expect(v("q_time5")).toBe(100);
    g.run("checkQuests(false)");
    expect(g.json("[isQuestDone('q_kill500'), isWeaponLocked('hammer'), run.newQuests]")).toEqual([true, false, ["q_kill500"]]);
  });

  test("'무기고'는 연 무기 수 + 만든 진화 종류(최대 10)", () => {
    const g = startedGame(metaStore({ quests: ["q_level10", "q_time5"], stats: { mask_evo: 0b111 } }));
    expect(g.run("questValue(QUESTS.find((q) => q.id === 'q_armory'), false)")).toBe(5);
    expect(g.run("QUESTS.find((q) => q.id === 'q_armory').goal")).toBe(g.run<number>("QUESTS.filter((q) => q.weapon).length") + 10);
  });
});

describe("상점", () => {
  // 시작 화면 패널의 단추 누르기를 흉내 냄
  const press = (g: ReturnType<typeof loadGame>, act: string, key = "") =>
    g.run(`metaBody.dispatch("click", { target: { closest: () => ({ disabled: false, dataset: { act: "${act}", key: "${key}" } }) } })`);

  test("값은 base × (지금 단계 + 1), 상한까지만 사고 금화가 모자라면 못 삼", () => {
    const g = loadGame(metaStore({ gold: 200 }));
    press(g, "buy", "might");
    press(g, "buy", "might");
    expect(g.json("[meta.upgrades.might, meta.gold]")).toEqual([2, 20]);   // 60 + 120
    press(g, "buy", "might");
    expect(g.json("[meta.upgrades.might, meta.gold]")).toEqual([2, 20]);
    expect(JSON.parse(g.storage.get(META) ?? "{}").upgrades.might).toBe(2);   // 바로 저장됨
  });

  test("전부 환불하면 쓴 금화를 모두 돌려받음", () => {
    const g = loadGame(metaStore({ gold: 0, upgrades: { might: 3, luck: 2, curse: 2 } }));
    press(g, "refund");
    expect(g.json("[meta.gold, meta.upgrades.might, meta.upgrades.luck, meta.upgrades.curse]")).toEqual([60 * 6 + 120 * 3, 0, 0, 0]);
  });

  test("퀘스트로 여는 항목은 잠겨 있으면 못 사고, 이미 단계가 있으면 잠기지 않음", () => {
    const g = loadGame(metaStore({ gold: 1000 }));
    expect(g.run("shopLocked('skip')")).toBe(true);
    press(g, "buy", "skip");
    expect(g.json("[meta.upgrades.skip, meta.gold]")).toEqual([0, 1000]);
    expect(loadGame(metaStore({ upgrades: { skip: 1 } })).run("shopLocked('skip')")).toBe(false);
    expect(loadGame(metaStore({ quests: ["q_chest30"] })).run("shopLocked('skip')")).toBe(false);
  });

  test("저주는 공짜로 올리고 내림", () => {
    const g = loadGame(metaStore({ gold: 0, quests: ["q_clear3"] }));
    press(g, "buy", "curse");
    press(g, "buy", "curse");
    press(g, "lower", "curse");
    expect(g.json("[meta.upgrades.curse, meta.gold]")).toEqual([1, 0]);
  });

  test("캐릭터는 해금된 뒤에만 사고, 산 캐릭터만 고를 수 있음", () => {
    const g = loadGame(metaStore({ gold: 1000 }));
    press(g, "charbuy", "hunter");
    press(g, "char", "hunter");
    expect(g.json("[meta.gold, meta.chars, meta.char]")).toEqual([1000, [], "knight"]);
    g.run("meta.quests.push('q_time10')");
    press(g, "charbuy", "hunter");
    press(g, "char", "hunter");
    expect(g.json("[meta.gold, meta.chars, meta.char]")).toEqual([700, ["hunter"], "hunter"]);
  });

  test("1.5배속은 산 뒤 켰을 때만 게임 속도 1.5", () => {
    const g = loadGame(metaStore({ upgrades: { speed15: 1 } }));
    expect(g.run("gameSpeed()")).toBe(1);
    g.run("toggleFast()");
    expect(g.json("[meta.fast, gameSpeed()]")).toEqual([true, 1.5]);
    const notBought = loadGame(metaStore({ fast: true }));
    expect(notBought.run("gameSpeed()")).toBe(1);
  });
});

describe("이어 하기", () => {
  test("저장한 판을 불러오면 캐릭터·위치·레벨·무기·아이템·시간·적이 돌아오고 일시정지 상태", () => {
    const g = startedGame(metaStore({ diff: 1, stats: { maxClearDiff: 0 } }));
    g.run(`player.x = 1234; player.y = 2345; player.level = 7; player.xp = 5; player.xpNeed = xpNeedFor(7);
           player.weapons[0].level = 3; player.weapons.push({ type: 'bullet', level: 2, timer: 0.3 });
           gainPassive('maxhp'); gainPassive('luck'); player.hp = 40;
           stats.time = 321.5; stats.kills = 99; run.chests = 2; run.hits = 4;
           enemies.push(makeEnemy(ENEMY_TYPES[0], 10, 20)); spawnItem(50, 60, 'freeze'); spawnGem(70.6, 80.2, 3);
           saveRun();`);
    const saved = g.storage.get(RUN);
    expect(saved).toBeDefined();

    const g2 = loadGame({ [META]: g.storage.get(META) ?? "", [RUN]: saved ?? "" });
    g2.run("continueRun()");
    expect(g2.json(`({ state, diff: run.diff, x: player.x, y: player.y, level: player.level, xp: player.xp, hp: player.hp, maxHp: player.maxHp,
                       weapons: player.weapons.map((w) => [w.type, w.level]), passives: player.passives,
                       time: stats.time, kills: stats.kills, chests: run.chests, hits: run.hits,
                       enemies: enemies.map((e) => e.type), item: items[0].type.key, gem: [gems[0].x, gems[0].y, gems[0].value] })`))
      .toEqual({ state: "paused", diff: 1, x: 1234, y: 2345, level: 7, xp: 5, hp: 40, maxHp: 166,
                 weapons: [["wand", 3], ["bullet", 2]], passives: [{ type: "maxhp", level: 1 }, { type: "luck", level: 1 }],
                 time: 321.5, kills: 99, chests: 2, hits: 4, enemies: ["bat"], item: "freeze", gem: [71, 80, 3] });
  });

  test("카드·상자 창이 떠 있을 때는 저장하지 않고, 새 판을 시작하면 이전 이어 하기를 지움", () => {
    const g = startedGame();
    g.run("player.xp = 10; checkLevelUp(); saveRun()");
    expect(g.storage.has(RUN)).toBe(false);
    g.run("state = 'playing'; saveRun()");
    expect(g.storage.has(RUN)).toBe(true);
    g.run("resetGame()");
    expect(g.storage.has(RUN)).toBe(false);
  });

  test("판 버전이 다르거나 시간 정보가 없는 저장은 없는 것으로 봄", () => {
    const old = loadGame({ [RUN]: JSON.stringify({ v: 0, player: {}, stats: {} }) });
    const broken = loadGame({ [RUN]: JSON.stringify({ v: 1, player: {} }) });
    expect([old.run("loadRun()"), broken.run("loadRun()")]).toEqual([null, null]);
  });

  test("저장에 모르는 무기·아이템이 있으면 빼고, 체력은 1 ~ 최대 체력으로 맞춤", () => {
    const run = { v: 1, char: "knight", diff: 0, stats: { time: 10, kills: 0 },
      player: { x: 1, y: 2, hp: 9999, level: 2, xp: 0, xpNeed: 16, revivesUsed: 0, stageChangedAt: 0, enemyStage: 0,
        passives: [{ type: "없는것", level: 1 }, { type: "area", level: 2 }], weapons: [{ type: "없는무기", level: 3 }, { type: "orb", level: 4 }] } };
    const g = loadGame({ [RUN]: JSON.stringify(run) });
    g.run("continueRun()");
    expect(g.json("[player.weapons.map((w) => [w.type, w.level]), player.passives, player.hp]")).toEqual([[["orb", 4]], [{ type: "area", level: 2 }], 138]);
  });
});
