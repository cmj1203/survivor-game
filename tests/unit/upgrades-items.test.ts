// 레벨업 카드 후보, 보물 상자(강화·진화·금화), 바닥 아이템
import { describe, expect, test } from "bun:test";
import { type Game, startedGame } from "./game-env";

const titles = (g: Game, includeNew: boolean) => g.json<string[]>(`buildUpgradePool(${includeNew}).map((u) => u.title)`);

describe("레벨업 카드 후보", () => {
  test("처음: 잠기지 않은 새 무기·새 아이템·무기 상자와 가진 무기 강화", () => {
    const g = startedGame();
    const t = titles(g, true);
    expect(t).toContain("강화: 마법봉 Lv1 → Lv2");
    expect(t).toContain("새 무기: 단검");
    expect(t).toContain("새 아이템: 힘");
    expect(t).toContain("무기 상자");
    expect(t).not.toContain("새 무기: 창");          // 퀘스트로 여는 무기
    expect(t).not.toContain("새 아이템: 해골");      // 퀘스트로 여는 아이템
    expect(t.some((x) => x.includes("성스러운 봉"))).toBe(false);   // 진화 무기는 카드로 안 나옴
  });

  test("상자용 후보(새 것 빼고)는 가진 것의 강화만", () => {
    const g = startedGame();
    g.run("gainPassive('might')");
    expect(titles(g, false)).toEqual(["강화: 힘 Lv1 → Lv2", "강화: 마법봉 Lv1 → Lv2"]);
  });

  test("최대 레벨이면 강화 카드가 없고, 무기 6개·아이템 6칸이 차면 새 카드가 없음", () => {
    const g = startedGame();
    g.run(`player.weapons = ["wand", "bullet", "sword", "aura", "orb", "bomb"].map((type) => ({ type, level: 8, timer: 0 }));
           for (const k of ["might", "armor", "maxhp", "regen", "cooldown", "area"]) for (let i = 0; i < PASSIVES[k].maxLevel; i++) gainPassive(k);`);
    expect(titles(g, true)).toEqual([]);
  });

  test("이미 진화한 무기의 원본은 새 무기로 다시 안 나옴", () => {
    const g = startedGame();
    g.run("player.weapons = [{ type: 'bullet_evo', level: 8, timer: 0 }]");
    expect(titles(g, true)).not.toContain("새 무기: 단검");
    expect(g.json<string[]>("candyChoices()")).not.toContain("bullet");
  });

  test("카드를 고르면 효과가 적용되고 게임이 다시 돌아감", () => {
    const g = startedGame();
    g.run("player.choices = 99; player.xp = 10; checkLevelUp()");   // 후보를 전부 보여 줌
    g.run("choicesBox.children.find((b) => b.innerHTML.includes('강화: 마법봉')).click()");
    expect(g.json("[player.weapons[0].level, state]")).toEqual([2, "playing"]);
  });

  test("더 강화할 것이 없으면 '체력 전부 회복 / 금화 +10' 두 장", () => {
    const g = startedGame();
    g.run(`player.weapons = ["wand", "bullet", "sword", "aura", "orb", "bomb"].map((type) => ({ type, level: 8, timer: 0 }));
           for (const k of ["might", "armor", "maxhp", "regen", "cooldown", "area"]) for (let i = 0; i < PASSIVES[k].maxLevel; i++) gainPassive(k);
           player.xp = 10; checkLevelUp();`);
    expect(g.json("choicesBox.children.map((b) => b.innerHTML.replace(/<.*/, ''))")).toEqual(["체력 전부 회복", "금화 +10"]);
    g.run("choicesBox.children[1].click()");
    expect(g.run("run.bonusGold")).toBe(10);
  });

  test("상점 '건너뛰기'를 샀으면 카드를 안 고르고 체력 30 회복", () => {
    const g = startedGame({ "dungeon-survivor-meta": JSON.stringify({ version: 1, upgrades: { skip: 1 } }) });
    g.run("player.hp = 100; player.xp = 10; checkLevelUp(); skipBtn.onclick()");
    expect(g.json("[player.hp, player.weapons[0].level, state, skipBtn.style.display]")).toEqual([130, 1, "playing", ""]);
  });
});

describe("보물 상자", () => {
  test("진화 조건: 무기 Lv8 + 짝 아이템 최대 레벨", () => {
    const g = startedGame();
    g.run("player.weapons[0].level = 7; for (let i = 0; i < 5; i++) gainPassive('cooldown')");
    expect(g.run("canEvolve(player.weapons[0])")).toBe(false);
    g.run("player.weapons[0].level = 8");
    expect(g.run("canEvolve(player.weapons[0])")).toBe(true);
    g.run("player.passives[0].level = 4");
    expect(g.run("canEvolve(player.weapons[0])")).toBe(false);
  });

  test("진화할 무기가 있으면 상자가 진화시키고 진화 기록을 남김", () => {
    const g = startedGame();
    g.run("player.weapons[0].level = 8; for (let i = 0; i < 5; i++) gainPassive('cooldown'); openChest({ x: 0, y: 0 }, 1)");
    expect(g.json("[player.weapons[0].type, player.weapons[0].level, run.evos, run.evoMask, run.chests, state]"))
      .toEqual(["wand_evo", 8, 1, 2, 1, "chest"]);   // 마법봉은 EVOLUTIONS 의 두 번째 → 비트 2
  });

  test("상자는 정한 개수만큼 가진 것을 강화", () => {
    const g = startedGame();
    g.setRandom(0);   // 후보 목록의 첫 번째를 고름
    const gains = g.json<{ title: string }[]>("openChest({ x: 0, y: 0 }, 3)");
    expect(gains.map((x) => x.title)).toEqual(["강화: 마법봉 Lv1 → Lv2", "강화: 마법봉 Lv2 → Lv3", "강화: 마법봉 Lv3 → Lv4"]);
    expect(g.run("player.weapons[0].level")).toBe(4);
  });

  test("강화할 것이 없으면 금화 10~30 (보너스 금화로 쌓임)", () => {
    const g = startedGame();
    g.run("player.weapons[0].level = 8");
    g.setRandom(0.5);   // 10 + floor(0.5 × 21) = 20
    expect(g.json("openChest({ x: 0, y: 0 }, 1).map((x) => x.title)")).toEqual(["금화 +20"]);
    expect(g.run("run.bonusGold")).toBe(20);
  });

  test("상자 개수 뽑기: 무게 75/20/5, 행운이 3·5개 쪽 무게를 키움", () => {
    const g = startedGame();
    const pick = (r: number) => { g.setRandom(r); return g.run<number>("pickWeighted(CHEST_COUNTS).count"); };
    expect([0, 0.749, 0.75, 0.949, 0.95, 0.999].map(pick)).toEqual([1, 1, 3, 3, 5, 5]);
  });

  test("레벨 20부터 상자의 25%는 미믹 (미믹을 잡아 나온 상자는 진짜)", () => {
    const g = startedGame();
    g.setRandom(0.2);
    g.run("spawnChest(100, 100); player.level = 20; spawnChest(100, 100); spawnChest(100, 100, true)");
    expect(g.json("chests.map((c) => c.mimic)")).toEqual([false, true, false]);
    g.setRandom(0.25);
    g.run("spawnChest(100, 100)");
    expect(g.run("chests[3].mimic")).toBe(false);
  });

  test("맵 밖에서 떨어진 상자는 맵 안으로 들어옴", () => {
    const g = startedGame();
    g.run("spawnChest(-50, WORLD_H + 50)");
    expect(g.json("[chests[0].x, chests[0].y === WORLD_H - CHEST_RADIUS]")).toEqual([14, true]);
  });
});

describe("바닥 아이템", () => {
  test("뽑기 무게(회복 45·자석 30·전멸 4·빙결 10)는 난이도가 높을수록 줄고 줄어든 만큼 꽝", () => {
    const normal = startedGame();
    const hard = startedGame({ "dungeon-survivor-meta": JSON.stringify({ version: 1, diff: 1, stats: { maxClearDiff: 0 } }) });
    const drop = (g: Game, r: number) => { g.setRandom(r); g.run("items = []; spawnItem(100, 100)"); return g.run<string | null>("items[0] ? items[0].type.key : null"); };
    expect([0, 0.6, 0.86, 0.9].map((r) => drop(normal, r))).toEqual(["heal", "magnet", "wipe", "freeze"]);
    expect([0, 0.6, 0.9].map((r) => drop(hard, r))).toEqual(["heal", "magnet", null]);
  });

  test("회복은 30 (최대 체력까지), 빙결은 10초 × 주문서", () => {
    const g = startedGame();
    g.run("player.hp = 100; spawnItem(0, 0, 'heal'); useItem(items[0])");
    expect(g.json("[player.hp, run.items]")).toEqual([130, 1]);
    g.run("useItem({ x: 0, y: 0, type: ITEM_TYPES[0] })");
    expect(g.run("player.hp")).toBe(138);
    g.run("gainPassive('duration'); useItem({ x: 0, y: 0, type: ITEM_TYPES[3] })");
    expect(g.run<number>("freezeTimer")).toBeCloseTo(11.5, 9);
  });

  test("전멸은 화면 안의 일반 적만 죽이고, 엘리트는 최대 체력의 30%, 화면 밖은 그대로", () => {
    const g = startedGame();
    g.run(`updateCamera();
      enemies.push(makeEnemy(ENEMY_TYPES[4], player.x + 100, player.y));
      const el = spawnElite(); el.x = player.x - 100; el.y = player.y;
      enemies.push(makeEnemy(ENEMY_TYPES[4], player.x + 2000, player.y));
      enemyBullets.push({ x: 0, y: 0 });
      useItem({ x: 0, y: 0, type: ITEM_TYPES[2] });`);
    expect(g.json("[!!enemies[0].dead, enemies[1].hp, enemies[1].maxHp, !!enemies[2].dead, enemyBullets.length]")).toEqual([true, 24 - 8, 24, false, 0]);   // 엘리트 박쥐 24 - ceil(24 × 0.3)
  });
});
