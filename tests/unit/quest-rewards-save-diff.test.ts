// 퀘스트 보상 종류별 적용, 저장 내보내기 → 불러오기 왕복, 난이도 해금 규칙
import { describe, expect, test } from "bun:test";
import { type Game, loadGame, startedGame } from "./game-env";

const META = "dungeon-survivor-meta";
const metaStore = (m: object) => ({ [META]: JSON.stringify({ version: 1, ...m }) });
const quest = (id: string) => `QUESTS.find((q) => q.id === '${id}')`;

describe("퀘스트 보상 종류별 적용", () => {
  test("무기(weapon): 끝내면 잠금이 풀리고 레벨업 카드에 나오며, 금화는 없음", () => {
    const g = startedGame();
    const cards = () => g.json<string[]>("buildUpgradePool(true).map((u) => u.title)");
    const card = `새 무기: ${g.run<string>("WEAPONS.spear.name")}`;   // 관통 창
    expect(g.run("isWeaponLocked('spear')")).toBe(true);
    expect(cards()).not.toContain(card);
    g.run("player.level = 15; checkQuests(false)");   // '성장' = 레벨 15 → 창
    expect(g.json("[meta.quests, meta.gold, isWeaponLocked('spear')]")).toEqual([["q_level10"], 0, false]);
    expect(cards()).toContain(card);
    expect(g.run(`rewardText(${quest("q_level10")})`)).toBe("무기 '관통 창' 해금");
  });

  test("캐릭터(char): 끝내면 해금만 되고, 고르려면 금화로 따로 사야 함", () => {
    const g = startedGame();
    expect(g.json("[isCharUnlocked('hunter'), isCharOwned('hunter')]")).toEqual([false, false]);
    g.run("stats.time = 720; checkQuests(false)");   // '12분 버티기' → 사냥꾼 (2분·7분 퀘스트도 같이 끝남)
    expect(g.json("meta.quests")).toEqual(expect.arrayContaining(["q_time10"]));
    expect(g.json("[isCharUnlocked('hunter'), isCharOwned('hunter')]")).toEqual([true, false]);
    expect(g.run(`rewardText(${quest("q_time10")})`)).toBe("캐릭터 '사냥꾼' 해금");
  });

  test("상점(shop): 끝내면 그 상점 항목이 열림", () => {
    const g = startedGame(metaStore({ stats: { clears: 5 } }));   // '던전 단골' = 5번 클리어 → 상점 저주
    g.run("meta.quests = []");   // 판을 시작할 때 이미 끝난 것으로 들어가지 않았는지 확인하려고 비움
    expect(g.run("shopLocked('curse')")).toBe(true);
    g.run("checkQuests(false)");
    expect(g.json("meta.quests")).toContain("q_clear3");
    expect(g.run("shopLocked('curse')")).toBe(false);
    expect(g.run(`rewardText(${quest("q_clear3")})`)).toBe("상점 '저주' 열림");
  });

  test("아이템(passive): 끝내면 그 아이템이 레벨업 카드 후보에 들어감", () => {
    const g = startedGame(metaStore({ stats: { kills: 99_999 } }));
    const cards = () => g.json<string[]>("buildUpgradePool(true).map((u) => u.title)");
    expect(g.run("isPassiveLocked('curse')")).toBe(true);
    expect(cards()).not.toContain("새 아이템: 해골");
    g.run("stats.kills = 1; checkQuests(false)");   // 누적 10만 마리 → 아이템 해골
    expect(g.json("meta.quests")).toContain("q_kill50k");
    expect(g.run("isPassiveLocked('curse')")).toBe(false);
    expect(cards()).toContain("새 아이템: 해골");
    expect(g.run(`rewardText(${quest("q_kill50k")})`)).toBe("아이템 '해골' 해금");
  });

  test("금화(gold): 표의 금화 × 0.5 를 바로 받고, 안내 문구도 같은 값", () => {
    const g = startedGame();
    g.run("stats.time = 120; checkQuests(false)");   // '첫 걸음' 금화 30 → 15
    expect(g.json("[meta.quests, meta.gold]")).toEqual([["q_time1"], 15]);
    expect(g.run(`rewardText(${quest("q_time1")})`)).toBe("금화 15");
    expect(g.json("run.newQuests")).toEqual(["q_time1"]);
    expect(JSON.parse(g.storage.get(META) ?? "{}").gold).toBe(15);   // 바로 저장됨
  });

  test("끝낸 퀘스트는 다시 보상을 주지 않음", () => {
    const g = startedGame();
    g.run("stats.time = 120; checkQuests(false); checkQuests(false)");
    expect(g.json("[meta.quests, meta.gold]")).toEqual([["q_time1"], 15]);
  });

  test("모든 퀘스트의 보상은 다섯 종류 중 정확히 하나", () => {
    const kinds = startedGame().json<string[][]>("QUESTS.map((q) => ['weapon', 'char', 'shop', 'passive', 'gold'].filter((k) => q[k] !== undefined))");
    expect(kinds.filter((k) => k.length !== 1)).toEqual([]);
    expect([...new Set(kinds.map((k) => k[0]))].sort()).toEqual(["char", "gold", "passive", "shop", "weapon"]);
  });
});

// 내보내기는 Blob 으로 만든 글을 받아 두고, 불러오기는 파일 고르기 창의 change 처리를 직접 부름
function exportText(g: Game): string {
  g.run(`
    globalThis.Blob = class { constructor(parts) { globalThis.__exported = parts.join(""); } };
    globalThis.URL = { createObjectURL: () => "blob:test", revokeObjectURL() {} };
    exportSave();
  `);
  return g.run<string>("__exported");
}
async function importText(g: Game, text: string, { answer = true, size = text.length } = {}) {
  g.run(`globalThis.__alerts = []; globalThis.alert = (m) => __alerts.push(String(m)); globalThis.confirm = () => ${answer};`);
  const input = g.el("importFile");
  input.files = [{ size, text: async () => text }];
  const onChange = input.listeners.change?.[0];
  if (!onChange) throw new Error("불러오기 처리가 없음");
  await onChange({ target: input });
  return g.json<string[]>("__alerts");
}

describe("저장 내보내기 → 불러오기 왕복", () => {
  const saved = {
    gold: 1234, upgrades: { might: 3, curse: 2 }, quests: ["q_time1", "q_time10", "q_clear3"], chars: ["hunter"],
    char: "hunter", diff: 1, fast: true, showDamage: false,
    stats: { runs: 12, clears: 5, kills: 54321, maxClearDiff: 1, bestTime: 1300, clear_hunter: 2, mask_story: 3, death_bat: 4 },
  };

  test("내보낸 파일을 다른 브라우저(빈 저장)에서 불러오면 기록이 똑같아지고 바로 저장됨", async () => {
    const from = loadGame(metaStore(saved));
    const text = exportText(from);
    const to = loadGame();
    expect(await importText(to, text)).toEqual(["불러왔어요"]);
    expect(to.json("meta")).toEqual(from.json("meta"));
    // 두 쪽이 같은 식으로 잘못 읽는 경우도 잡도록 원래 값과도 비교
    expect(to.json("[meta.gold, meta.upgrades.might, meta.upgrades.curse, meta.quests, meta.chars, meta.char, meta.diff, meta.fast, meta.showDamage]"))
      .toEqual([1234, 3, 2, ["q_time1", "q_time10", "q_clear3"], ["hunter"], "hunter", 1, true, false]);
    expect(to.json("[meta.stats.runs, meta.stats.kills, meta.stats.maxClearDiff, meta.stats.clear_hunter, meta.stats.mask_story, meta.stats.death_bat]"))
      .toEqual([12, 54321, 1, 2, 3, 4]);
    expect(JSON.parse(to.storage.get(META) ?? "{}")).toEqual(from.json("meta"));
  });

  test("불러오기 확인 창에서 취소하면 지금 기록을 그대로 둠", async () => {
    const text = exportText(loadGame(metaStore(saved)));
    const to = loadGame(metaStore({ gold: 5 }));
    expect(await importText(to, text, { answer: false })).toEqual([]);
    expect(to.run("meta.gold")).toBe(5);
  });

  test("이 게임 저장이 아니거나, 더 새 버전이거나, 깨졌거나, 너무 크면 바꾸지 않음", async () => {
    const to = loadGame(metaStore({ gold: 5 }));
    expect(await importText(to, "{}")).toEqual(["불러오기 실패: 이 게임의 저장 파일이 아니에요"]);
    expect(await importText(to, JSON.stringify({ ...saved, version: 2 }))).toEqual(["불러오기 실패: 이 게임의 저장 파일이 아니에요"]);
    expect(await importText(to, JSON.stringify({ quests: [], stats: [] }))).toEqual(["불러오기 실패: 이 게임의 저장 파일이 아니에요"]);
    expect((await importText(to, "{ 깨진"))[0]).toStartWith("불러오기 실패: ");
    expect(await importText(to, JSON.stringify(saved), { size: 64 * 1024 + 1 })).toEqual(["불러오기 실패: 파일이 너무 커요"]);
    expect(to.run("meta.gold")).toBe(5);
  });
});

describe("난이도 해금 규칙", () => {
  const open = (g: Game) => g.json<boolean[]>("DIFFS.map((_, i) => isDiffUnlocked(i))");

  test("처음엔 쉬움만, 클리어한 가장 높은 난이도의 바로 위까지 열림", () => {
    expect(open(loadGame())).toEqual([true, false, false, false]);
    expect(open(loadGame(metaStore({ stats: { maxClearDiff: 0 } })))).toEqual([true, true, false, false]);
    expect(open(loadGame(metaStore({ stats: { maxClearDiff: 2 } })))).toEqual([true, true, true, true]);
  });

  test("지거나 더 낮은 난이도를 클리어해도 열린 난이도는 줄지 않음", () => {
    const g = startedGame(metaStore({ diff: 0, stats: { runs: 3, maxClearDiff: 2 } }));
    g.run("finishRun(true)");
    expect(g.run("meta.stats.maxClearDiff")).toBe(2);
    const lost = startedGame(metaStore({ diff: 1, stats: { runs: 3, maxClearDiff: 0 } }));
    lost.run("finishRun(false)");
    expect(open(lost)).toEqual([true, true, false, false]);
  });

  test("다음 난이도는 바로 아래 난이도를 클리어해야 열림", () => {
    const g = startedGame(metaStore({ diff: 1, stats: { runs: 3, maxClearDiff: 0 } }));
    const html = g.run<string>("finishRun(true)");
    expect(html).toContain("새 난이도 '어려움' 열림");
    expect(open(g)).toEqual([true, true, true, false]);
  });

  test("맨 위 난이도를 처음 클리어하면 '새 난이도' 안내는 없음", () => {
    const g = startedGame(metaStore({ diff: 3, stats: { runs: 3, maxClearDiff: 2 } }));
    const html = g.run<string>("finishRun(true)");
    expect(g.run("meta.stats.maxClearDiff")).toBe(3);
    expect(html).not.toContain("새 난이도");
  });

  test("저장된 난이도가 잠겨 있으면 판을 시작할 때 쉬움으로 바뀜", () => {
    const g = startedGame(metaStore({ diff: 3, stats: { maxClearDiff: 0 } }));
    expect(g.json("[meta.diff, run.diff]")).toEqual([0, 0]);
  });

  test("시작 화면에서 잠긴 난이도 단추는 눌러도 바뀌지 않음", () => {
    const g = loadGame(metaStore({ stats: { maxClearDiff: 0 } }));
    const press = (key: number) =>
      g.run(`metaBody.dispatch("click", { target: { closest: () => ({ disabled: false, dataset: { act: "diff", key: "${key}" } }) } })`);
    press(2);
    expect(g.run("meta.diff")).toBe(0);
    press(1);
    expect(g.run("meta.diff")).toBe(1);
  });
});
