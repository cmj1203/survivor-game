// 플레이어 성장 계산: 레벨·경험치, 캐릭터·패시브·상점 배수, 무기 피해, 받는 피해, 부활
import { describe, expect, test } from "bun:test";
import { startedGame } from "./game-env";

// 상점 강화를 넣은 저장 (meta)
function metaWith(fields: object) {
  return { "dungeon-survivor-meta": JSON.stringify({ version: 1, ...fields }) };
}

describe("레벨·경험치", () => {
  test("필요 경험치는 10, 16, 24, 34 … (10 + 5n + n²)", () => {
    const g = startedGame();
    expect(g.json("[1, 2, 3, 4, 10, 50].map(xpNeedFor)")).toEqual([10, 16, 24, 34, 136, 2656]);
    expect(g.run("player.xpNeed")).toBe(10);
  });

  test("레벨업하면 넘친 경험치는 남고 카드 창이 뜸", () => {
    const g = startedGame();
    g.run("player.xp = 25; checkLevelUp()");
    expect(g.json("[player.level, player.xp, player.xpNeed]")).toEqual([2, 15, 16]);
    expect(g.run("state")).toBe("levelup");
    expect(g.run("choicesBox.children.length")).toBe(3);   // 기본 카드 3장
  });

  test("경험치가 모자라면 레벨업하지 않음", () => {
    const g = startedGame();
    g.run("player.xp = 9.99; checkLevelUp()");
    expect(g.json("[player.level, state]")).toEqual([1, "playing"]);
  });
});

describe("캐릭터별 시작 능력치", () => {
  // [캐릭터, 시작 무기, 최대 체력, 이동 속도, 카드 수]
  const cases = [
    ["knight", "wand", 138, 220, 3],
    ["hunter", "bullet", 102, 264, 4],
    ["berserker", "sword", 144, 209, 3],
    ["saint", "aura", 114, 220, 3],
    ["armorer", "wand", 120, 220, 3],
  ] as const;
  for (const [char, weapon, maxHp, speed, choices] of cases) {
    test(char, () => {
      const g = startedGame(metaWith({ char, chars: ["hunter", "berserker", "saint", "armorer"] }));
      expect(g.json("[player.weapons.map((w) => w.type), player.maxHp, player.hp, player.choices]")).toEqual([[weapon], maxHp, maxHp, choices]);
      expect(g.run<number>("player.speed")).toBeCloseTo(speed, 6);
    });
  }

  test("사지 않은 캐릭터를 골라 둔 저장은 견습 마법사로 시작", () => {
    const g = startedGame(metaWith({ char: "hunter", chars: [], quests: ["q_time10"] }));
    expect(g.json("[run.char, player.weapons[0].type]")).toEqual(["knight", "wand"]);
  });
});

describe("패시브·상점 배수", () => {
  test("최대 체력 = 120 × 튼튼함 × 상점 × 캐릭터 (반올림)", () => {
    const g = startedGame(metaWith({ upgrades: { maxhp: 2 } }));
    expect(g.run("player.maxHp")).toBe(152);              // 120 × 1.10 × 1.15 = 151.8
    g.run("gainPassive('maxhp'); gainPassive('maxhp'); gainPassive('maxhp')");
    expect(g.run("player.maxHp")).toBe(243);              // 120 × 1.6 × 1.10 × 1.15 = 242.88
  });

  test("최대 체력이 오르면 오른 만큼 현재 체력도 오르고, 내려가면 최대값으로 깎임", () => {
    const g = startedGame();
    g.run("player.hp = 50; gainPassive('maxhp')");         // 138 → 166
    expect(g.json("[player.maxHp, player.hp]")).toEqual([166, 78]);
    g.run("player.hp = 166; player.passives = []; recalcStats()");
    expect(g.json("[player.maxHp, player.hp]")).toEqual([138, 138]);
  });

  test("이동 속도·발동 간격·자석 범위·카드 수", () => {
    const g = startedGame(metaWith({ upgrades: { move: 2, magnet: 1, choices: 2 } }));
    g.run("gainPassive('move'); gainPassive('cooldown'); gainPassive('cooldown'); gainPassive('magnet')");
    expect(g.run<number>("player.speed")).toBeCloseTo(220 * 1.1 * 1.06, 6);
    expect(g.run<number>("player.attackSpeed")).toBeCloseTo(0.84, 6);
    expect(g.run<number>("player.pickupRadius")).toBeCloseTo(70 * 1.1, 6);
    expect(g.run("player.choices")).toBe(5);
  });

  test("경험치 배수 = 왕관 × 해골(게임 중 + 상점 저주) × 상점 경험치", () => {
    const g = startedGame(metaWith({ upgrades: { growth: 1, curse: 2 } }));
    g.run("gainPassive('growth'); gainPassive('curse')");
    expect(g.run<number>("xpMul()")).toBeCloseTo(1.12 * 1.24 * 1.04, 9);
    expect(g.run("curseLevel()")).toBe(3);
  });

  test("행운 배수 = 1 + 클로버 0.15/단계 + 상점 행운 0.10/단계", () => {
    const g = startedGame(metaWith({ upgrades: { luck: 2 } }));
    g.run("gainPassive('luck')");
    expect(g.run<number>("luckMul()")).toBeCloseTo(1.35, 9);
  });

  test("패시브는 레벨이 쌓이고 같은 칸을 다시 만들지 않음", () => {
    const g = startedGame();
    g.run("gainPassive('area'); gainPassive('area'); gainPassive('luck')");
    expect(g.json("player.passives")).toEqual([{ type: "area", level: 2 }, { type: "luck", level: 1 }]);
    expect(g.run<number>("areaMul()")).toBeCloseTo(1.2, 9);
  });
});

describe("무기 피해", () => {
  test("피해 = (공격력 + 보너스) × (1 + 0.2 × (레벨 - 1)) × 힘·상점·캐릭터 × 무기 배수", () => {
    const g = startedGame(metaWith({ upgrades: { might: 1 } }));
    expect(g.run<number>("weaponDamage(player.weapons[0])")).toBeCloseTo(1 * 1.05 * 1.1 * 2, 9);   // 마법봉 Lv1
    g.run("player.weapons[0].level = 3; gainPassive('might'); gainPassive('might')");
    expect(g.run<number>("weaponDamage(player.weapons[0], 1)")).toBeCloseTo(2 * 1.4 * 1.24 * 1.05 * 1.1 * 2, 9);
  });

  test("광전사는 체력이 절반 이하일 때만 공격력 ×1.6", () => {
    const g = startedGame(metaWith({ char: "berserker", chars: ["berserker"] }));
    expect(g.run("charDamageMul()")).toBe(1);
    g.run("player.hp = player.maxHp / 2");
    expect(g.run("charDamageMul()")).toBe(1.6);
  });
});

describe("받는 피해", () => {
  test("갑옷(게임 중)과 상점 방어력이 피해를 줄이되 최소 1은 받음", () => {
    const g = startedGame(metaWith({ upgrades: { armor: 2 } }));
    g.run("gainPassive('armor'); hurtPlayer(10)");
    expect(g.run("player.maxHp - player.hp")).toBe(7);
    g.run("hurtPlayer(2)");
    expect(g.run("player.maxHp - player.hp")).toBe(8);
    expect(g.json("[player.invincible, run.hits, run.noHit]")).toEqual([0.8, 2, 0]);
  });

  test("켜진 보호막이 있으면 체력 대신 보호막이 깨짐", () => {
    const g = startedGame();
    g.run("player.weapons.push({ type: 'shield', level: 1, timer: 0, ready: true }); hurtPlayer(30)");
    expect(g.json("[player.hp === player.maxHp, player.weapons[1].ready, player.invincible]")).toEqual([true, false, 0.8]);
    g.run("hurtPlayer(30)");
    expect(g.run("player.maxHp - player.hp")).toBe(30);
  });

  test("부활이 남아 있으면 체력을 채워 되살아나고, 다 쓰면 게임오버", () => {
    const g = startedGame(metaWith({ upgrades: { revival: 1 } }));
    g.run("player.hp = -5");
    expect(g.run("checkGameOver()")).toBe(false);
    expect(g.json("[player.hp === player.maxHp, player.revivesUsed, player.invincible, state]")).toEqual([true, 1, 2, "playing"]);
    g.run("player.hp = 0");
    expect(g.run("checkGameOver()")).toBe(true);
    expect(g.json("[player.hp, state]")).toEqual([0, "gameover"]);
  });
});
