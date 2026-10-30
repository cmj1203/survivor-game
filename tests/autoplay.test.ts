// 자동 플레이 시험: 캐릭터 × 난이도마다 한 판씩, 무적 상태로 끝(보스 처치)까지 돌리고 에러가 없는지 봄
//   실행: bun test tests/   (맥에서. 브라우저 창은 안 뜸)
//   무작위 씨앗을 판마다 고정해서, 코드를 정리만 하고 동작을 안 바꿨다면 결과(시간·처치 수·레벨·무기)가 한 자리까지 같음
//   → tests/autoplay-baseline.json 과 비교. 게임 동작을 일부러 바꿨으면 UPDATE_BASELINE=1 bun test tests/ 로 다시 저장
import { afterAll, beforeAll, describe, expect, test } from "bun:test";

const ROOT = new URL("..", import.meta.url).pathname;
const BASELINE_FILE = `${ROOT}tests/autoplay-baseline.json`;
const CHARS = ["knight", "hunter", "berserker", "saint", "armorer"] as const;
const DIFF_COUNT = 4;
const STEP_DT = 1 / 30;
const MAX_STEPS = 30 * 60 * 30; // 게임 시간 30분이 넘도록 안 끝나면 실패

type RunSummary = {
  readonly state: string;
  readonly time: number;
  readonly kills: number;
  readonly level: number;
  readonly weapons: string;
  readonly errors: readonly string[];
};

// 페이지 안에 심는 코드: 무작위 고정, 실제 화면 루프 끄기(시험이 직접 update 를 부름), 잠금 풀기, 한 걸음씩 진행
const HARNESS = `
  window.__errs = [];
  addEventListener("error", (e) => __errs.push("async: " + e.message + " @" + e.lineno));
  addEventListener("unhandledrejection", (e) => __errs.push("promise: " + e.reason));
  let seed = __SEED__;
  Math.random = () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  requestAnimationFrame = () => 0;
  meta.stats.mask_story = 31;   // 전투 시험은 시작 스토리를 이미 본 저장 상태
  isCharUnlocked = () => true; isCharOwned = () => true; isDiffUnlocked = () => true; isWeaponLocked = () => false; isPassiveLocked = () => false;
  window.__step = (n) => {
    for (let i = 0; i < n; i++) {
      try {
        if (state === "playing") { player.invincible = 1e9; player.hp = player.maxHp; update(${STEP_DT}); if (i % 15 === 0) draw(); }
        else if (state === "levelup") { const b = choicesBox.querySelectorAll("button"); b[Math.floor(Math.random() * b.length)].click(); }
        else if (state === "chest") { finishChestRoll(); closeChest(); }
        else if (state === "candy") { const b = candyList.querySelectorAll("button"); b[Math.floor(Math.random() * b.length)].click(); }
        else if (state === "paused") resumeFromPause();
        else return state;
      } catch (err) { __errs.push(state + ": " + err.message + " | " + String(err.stack).split("\\n")[0]); return "error"; }
    }
    return state;
  };
  window.__summary = () => JSON.stringify({ state, time: Math.round(stats.time * 1000) / 1000, kills: stats.kills, level: player.level,
    weapons: player.weapons.map((w) => w.type + ":" + w.level).join(","), errors: __errs });
`;

function parseSummary(raw: unknown): RunSummary {
  if (typeof raw !== "string") throw new TypeError(`summary is not a string: ${String(raw)}`);
  const v: unknown = JSON.parse(raw);
  if (typeof v === "object" && v !== null && "state" in v && "time" in v && "kills" in v && "level" in v && "weapons" in v && "errors" in v) {
    const { state, time, kills, level, weapons, errors } = v;
    if (typeof state === "string" && typeof time === "number" && typeof kills === "number" && typeof level === "number"
      && typeof weapons === "string" && Array.isArray(errors) && errors.every((e): e is string => typeof e === "string")) {
      return { state, time, kills, level, weapons, errors };
    }
  }
  throw new TypeError(`summary has an unexpected shape: ${raw}`);
}

async function baselineFor(key: string): Promise<RunSummary | undefined> {
  const file = Bun.file(BASELINE_FILE);
  if (process.env.UPDATE_BASELINE === "1" || !(await file.exists())) return undefined;
  const all: unknown = await file.json();
  const saved: unknown = typeof all === "object" && all !== null ? Object.getOwnPropertyDescriptor(all, key)?.value : undefined;
  return saved === undefined ? undefined : parseSummary(JSON.stringify(saved));
}

let server: ReturnType<typeof Bun.serve>;
let view: Bun.WebView;
const results: Record<string, RunSummary> = {};

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      const file = Bun.file(`${ROOT}${path === "/" ? "index.html" : path.slice(1)}`);
      return (await file.exists()) ? new Response(file) : new Response("not found", { status: 404 });
    },
  });
  view = new Bun.WebView({ width: 800, height: 600 });
});

afterAll(async () => {
  view.close();
  await server.stop(true);
  if (process.env.UPDATE_BASELINE === "1") await Bun.write(BASELINE_FILE, `${JSON.stringify(results, null, 2)}\n`);
});

const page = (code: string): Promise<unknown> => view.evaluate(`(new Function(${JSON.stringify(code)}))()`);

describe("자동 플레이", () => {
  CHARS.forEach((char, ci) => {
    for (let diff = 0; diff < DIFF_COUNT; diff++) {
      const key = `${char}-${diff}`;
      test(`${key}: 끝까지 에러 없이 클리어`, async () => {
        // Given: 저장소를 비운 새 페이지, 판마다 고정된 무작위 씨앗
        await view.navigate(`${server.url.href}?autoplay=${key}`);
        await page("localStorage.clear()");                         // 앞 판의 금화·퀘스트가 남지 않게 비우고 다시 엶
        await view.navigate(`${server.url.href}?autoplay=${key}&fresh`);
        await page(HARNESS.replace("__SEED__", String(ci * DIFF_COUNT + diff + 1)));
        await page(`clearRun(); meta.char = "${char}"; meta.diff = ${diff}; startGame(true);`);

        // When: 끝날 때까지 진행
        for (let done = 0; done < MAX_STEPS; done += 3000) {
          const st = await page("return __step(3000)");
          if (st !== "playing" && st !== "levelup" && st !== "chest" && st !== "candy") break;
        }
        const s = parseSummary(await page("return __summary()"));
        results[key] = s;

        // Then: 에러 없이 클리어, 기준 기록이 있으면 결과가 그대로
        expect(s.errors).toEqual([]);
        expect(s.state).toBe("clear");
        const saved = await baselineFor(key);
        if (saved !== undefined) expect(s).toEqual(saved);
      }, 60_000);
    }
  });
});

describe("엔딩 감상 기록", () => {
  const cases = [
    { name: "미리 받은 그림을 닫으면 저장", event: "load", showBeforeLoad: false, closeBeforeLoad: false, mask: 3 },
    { name: "그림 로드에 실패하면 미감상 유지", event: "error", showBeforeLoad: true, closeBeforeLoad: false, mask: 1 },
    { name: "창을 띄운 뒤 그림을 받아도 저장", event: "load", showBeforeLoad: true, closeBeforeLoad: false, mask: 3 },
    { name: "그림을 받기 전에 닫으면 미감상 유지", event: "load", showBeforeLoad: true, closeBeforeLoad: true, mask: 1 },
  ] as const;

  for (const scenario of cases) {
    test(scenario.name, async () => {
      // Given: 마법사 엔딩만 본 상태에서 사냥꾼 엔딩을 연다. 소리는 끈다.
      await view.navigate(`${server.url.href}?ending=${encodeURIComponent(scenario.name)}`);
      await page(HARNESS.replace("__SEED__", "1"));
      await page(`
        setMusic = () => {}; playSfx = () => {};
        clearRun(); meta = defaultMeta(); meta.char = "hunter"; meta.diff = 3; meta.stats.mask_story = 31;
        startGame(true); state = "clear"; meta.stats.mask_ending = 1; saveMeta();
      `);

      // When: 실제 이미지의 load/error 이벤트와 창 닫기를 지정된 순서로 실행한다.
      const masks = await page(`
        return new Promise((resolve, reject) => {
          const controller = new AbortController();
          const finishAllText = () => {
            for (let i = 0; i < 100 && endingBox.classList.contains("show"); i++) {
              endingShownAt = performance.now() - ENDING_LOCK * 1000;
              closeEnding();
            }
            if (endingBox.classList.contains("show")) throw new Error("엔딩 대사가 끝나지 않음");
          };
          const deadline = setTimeout(() => {
            controller.abort();
            reject(new Error("엔딩 그림 이벤트 시간 초과"));
          }, 5000);
          const finish = (event) => {
            clearTimeout(deadline);
            controller.abort();
            if (event.type !== ${JSON.stringify(scenario.event)}) {
              reject(new Error("예상과 다른 엔딩 그림 이벤트: " + event.type));
              return;
            }
            if (!${scenario.showBeforeLoad}) showEnding();
            if (!${scenario.closeBeforeLoad}) {
              finishAllText();
            }
            resolve([meta.stats.mask_ending, loadMeta().stats.mask_ending]);
          };
          endingImg.addEventListener("load", finish, { once: true, signal: controller.signal });
          endingImg.addEventListener("error", finish, { once: true, signal: controller.signal });
          loadEnding(${scenario.event === "error" ? '{ ...ENDINGS.hunter, art: "__missing_ending__" }' : "ENDINGS.hunter"});
          if (${scenario.showBeforeLoad}) showEnding();
          if (${scenario.closeBeforeLoad}) {
            finishAllText();
          }
        });
      `);

      // Then: 현재 판과 저장 데이터 모두 기존 감상 기록을 보존하며 올바르게 갱신된다.
      expect(masks).toEqual([scenario.mask, scenario.mask]);
    }, 15_000);
  }
});

async function storyImage(action: string, expectedEvent = "load"): Promise<unknown> {
  return page(`
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const deadline = setTimeout(() => { controller.abort(); reject(new Error("스토리 그림 시간 초과")); }, 5000);
      const finish = (event) => {
        clearTimeout(deadline);
        controller.abort();
        if (event.type === ${JSON.stringify(expectedEvent)}) resolve(true);
        else reject(new Error("스토리 그림 로드 실패"));
      };
      endingImg.addEventListener("load", finish, { once: true, signal: controller.signal });
      endingImg.addEventListener("error", finish, { once: true, signal: controller.signal });
      ${action}
    });
  `);
}

const STORY_NEXT = `
  endingShownAt = performance.now() - endingInputLock * 1000;
  endingBox.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
`;
const STORY_SETUP = `
  requestAnimationFrame = () => 0; setMusic = () => {}; playSfx = () => {};
  clearRun(); meta = defaultMeta(); meta.quests = QUESTS.map(q => q.id); meta.gold = 100000; saveMeta();
`;

async function readCaptionPages(): Promise<string> {
  await page("return document.fonts.ready");
  const image = await page("return endingImg.src");
  const bounds = await page("const r = endingImg.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];");
  const parts: string[] = [];
  for (let i = 0; i < 100; i++) {
    const text = await page("return endingText.textContent");
    if (typeof text !== "string") throw new TypeError("대사가 문자열이 아님");
    expect(text.trim().length).toBeGreaterThan(0);
    parts.push(text);
    const lines = await page(`
      const style = getComputedStyle(endingText);
      return Math.round((endingText.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight));
    `);
    expect(lines).toBeGreaterThan(0);
    expect(lines).toBeLessThanOrEqual(3);
    expect(await page("return endingImg.src")).toBe(image);
    expect(await page("const r = endingImg.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];")).toEqual(bounds);
    if (await page("return endingWordEnd === endingWords.length")) return parts.join(" ").replace(/\s+/g, " ").trim();
    await page(STORY_NEXT);
  }
  throw new Error("대사 페이지가 끝나지 않음");
}

describe("시작 스토리", () => {
  const characters = [
    ["knight", "견습 마법사", 5],
    ["hunter", "사냥꾼", 4],
    ["berserker", "광전사", 4],
    ["saint", "성녀", 5],
    ["armorer", "무기상", 5],
  ] as const;

  for (const [char, name, count] of characters) {
    test(`${char}: 시작·구매 직후 확정 자막을 끝까지 재생`, async () => {
      // Given: 새 저장 데이터와 확정 스토리보드의 자막.
      await view.navigate(`${server.url.href}?story=${char}`);
      await page(STORY_SETUP);
      const document = await Bun.file(`${ROOT}docs/story/cutscene-storyboard.md`).text();
      const section = document.split(`## ${name} ·`)[1]?.split("\n## ")[0];
      if (!section) throw new Error(`스토리보드에 ${name} 없음`);
      const captions = section.split("\n").filter(line => /^\| \d+ \|/.test(line))
        .map(line => line.split("|")[2]?.trim().replaceAll("<br>", " ").replace(/\s+/g, " "));
      const seen: unknown[] = [];

      // When: 실제 시작·구매 버튼과 컷신 pointerup 경로로 모든 컷을 넘긴다.
      if (char === "knight") await storyImage("startBtn.click();");
      else {
        await page('openPanel("select");');
        await storyImage(`metaBody.querySelector('[data-act="charbuy"][data-key="${char}"]').click();`);
      }
      for (let i = 0; i < count; i++) {
        expect(await page("return state")).toBe("story");
        seen.push(await readCaptionPages());
        if (i + 1 < count) await storyImage(STORY_NEXT);
        else await page(STORY_NEXT);
      }

      // Then: 원문과 동일한 자막, 올바른 복귀·저장, 다시 시작할 때 중복 재생 없음.
      expect(seen).toEqual(captions);
      expect(await page(`return [state, !!(loadMeta().stats.mask_story & (1 << Object.keys(CHARACTERS).indexOf("${char}"))), meta.stats.mask_ending, endingBox.classList.contains("show")];`))
        .toEqual([char === "knight" ? "playing" : "intro", true, 0, false]);
      if (char !== "knight") expect(await page(`return [meta.chars.includes("${char}"), meta.gold];`))
        .toEqual([true, 100000 - Number(await page(`return CHARACTERS["${char}"].price`))]);
      await page(`toTitle(); meta.char = "${char}"; startGame(true);`);
      expect(await page("return storyScene")).toBeNull();
    }, 20_000);
  }

  test("반복 키와 도움말 키가 스토리를 건너뛰거나 게임을 시작하지 않음", async () => {
    // Given: 첫 컷이 로드되고 입력 잠금이 끝난 상태.
    await view.navigate(`${server.url.href}?story=keys`);
    await page(STORY_SETUP);
    await storyImage("startBtn.click();");
    await page("endingShownAt = performance.now() - STORY_LOCK * 1000;");
    // When: 누르고 있는 Enter와 도움말 키를 보낸다.
    await page('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", repeat: true })); window.dispatchEvent(new KeyboardEvent("keydown", { key: "h" }));');
    // Then: 첫 컷을 유지하고 일반 Enter 한 번은 다음 컷만 연다.
    expect(await page("return [state, storyScene.index]")).toEqual(["story", 0]);
    await readCaptionPages();
    await page("endingShownAt = performance.now() - endingInputLock * 1000;");
    await storyImage('window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));');
    expect(await page("return [state, storyScene.index]")).toEqual(["story", 1]);
  });

  test("그림을 못 받은 스토리는 감상 완료로 저장하지 않음", async () => {
    // Given: 첫 그림만 404를 반환하는 새 게임.
    await view.navigate(`${server.url.href}?story=missing`);
    await page(STORY_SETUP);
    await page('STORIES.knight[0].art = "__missing_story__";');
    await storyImage("startBtn.click();", "error");
    // When: 나머지 네 컷을 실제로 받아 끝까지 넘긴다.
    for (let i = 1; i < 5; i++) {
      await readCaptionPages();
      await storyImage(STORY_NEXT);
    }
    await readCaptionPages();
    await page(STORY_NEXT);
    // Then: 게임은 시작하지만 다음 시작 때 스토리를 다시 볼 수 있다.
    expect(await page("return [state, loadMeta().stats.mask_story]")).toEqual(["playing", 0]);
    await page('toTitle(); STORIES.knight[0].art = "mage_1";');
    await storyImage("startGame(true);");
    expect(await page("return [state, storyScene.index]")).toEqual(["story", 0]);
  });

  test("첫 스토리 중에 전체 화면이 되면 안내 창은 스토리 위에서 끝나고, 게임은 멈추지 않고 시작", async () => {
    // Given: 전체 화면 안내를 본 적 없는 새 저장으로 첫 스토리를 연다.
    await view.navigate(`${server.url.href}?story=fullscreen-hint`);
    await page(STORY_SETUP);
    await page("localStorage.removeItem(FS_HINT_KEY); fsHintShownThisPage = false;");
    await storyImage("startBtn.click();");
    // When: 스토리 도중 (안드로이드) 전체 화면 전환이 끝나고, 스토리를 끝까지 넘긴다.
    await page("pauseForFullscreenHint();");
    const duringStory = await page("return [state, localStorage.getItem(FS_HINT_KEY)]");
    for (let i = 0; i < 5; i++) {
      await readCaptionPages();
      if (i < 4) await storyImage(STORY_NEXT);
      else await page(STORY_NEXT);
    }
    // Then: 안드로이드 안내 창은 스토리를 넘기기 전에 닫히므로 본 것으로 저장하고, 게임은 0초에 멈추지 않고 바로 시작한다.
    expect(duringStory).toEqual(["story", "1"]);
    expect(await page("return [state, pauseBox.style.display === \"flex\", localStorage.getItem(FS_HINT_KEY)]")).toEqual(["playing", false, "1"]);
  });

  test("스토리 없이 바로 시작한 판에서 처음 전체 화면이 되면 멈추고 안내 ('0초 버팀' 없이)", async () => {
    await view.navigate(`${server.url.href}?story=fullscreen-direct`);
    await page(STORY_SETUP);
    const result = await page(`
      localStorage.removeItem(FS_HINT_KEY); fsHintShownThisPage = false;
      meta.stats.mask_story = 31; saveMeta(); startGame(true);
      pauseForFullscreenHint();
      return [state, pauseText.textContent, localStorage.getItem(FS_HINT_KEY)];
    `);
    expect(result).toEqual(["paused", "전체 화면 안내 창이 뜨면 '확인'을 누른 뒤 계속하기를 눌러 주세요", "1"]);
  });

  test("그림을 다 받기 전에 넘겨도 스토리는 본 것으로 저장", async () => {
    // Given: 새 저장으로 첫 스토리를 연다.
    await view.navigate(`${server.url.href}?story=fast-skip`);
    await page(STORY_SETUP);
    // When: 그림 받기가 끝나기 전에 (한 번의 동기 실행 안에서) 대사와 그림을 끝까지 넘긴다.
    const result = await page(`
      startBtn.click();
      for (let i = 0; i < 100 && storyScene; i++) {
        endingShownAt = performance.now() - endingInputLock * 1000;
        closeEnding();
      }
      return [state, endingImg.classList.contains("loaded"), loadMeta().stats.mask_story];
    `);
    // Then: 그림을 못 받은 것은 아니므로 게임이 시작되고 스토리는 본 것으로 저장된다.
    expect(result).toEqual(["playing", false, 1]);
  });
});

test("스토리와 엔딩 28컷은 고정된 그림 안에 대사 창을 표시", async () => {
  // Given: 짧은 자막과 긴 자막이 섞인 스토리·엔딩 전체.
  await view.navigate(`${server.url.href}?cutscene-layout`);
  await page(STORY_SETUP);
  let imageBounds: unknown;
  for (let i = 0; i < 28; i++) {
    // When: 실제 그림과 자막을 공통 컷신 화면에 표시한다.
    await storyImage(`
      endingBox.classList.toggle("story", ${i < 23});
      loadEnding([...Object.values(STORIES).flat(), ...Object.values(ENDINGS)][${i}]);
      showEnding();
    `);
    await readCaptionPages();
    const bounds = await page("const r = endingImg.getBoundingClientRect(); return [r.x, r.y, r.width, r.height];");
    if (i === 0) imageBounds = bounds;
    // Then: 자막 길이와 종류에 관계없이 그림 위치·크기가 같고 대사 창은 그림 안에 있다.
    expect(bounds).toEqual(imageBounds);
    expect(await page(`
      const image = endingImg.getBoundingClientRect(), text = endingText.getBoundingClientRect();
      return image.width > 0 && image.height > 0 &&
        text.left >= image.left && text.right <= image.right &&
        text.top >= image.top && text.bottom <= image.bottom &&
        endingText.scrollHeight <= endingText.clientHeight;
    `)).toBe(true);
  }
}, 20_000);

test("대사는 한 번에 세 줄 이하이며 클릭하면 같은 그림의 다음 대사 표시", async () => {
  // Given: 여러 줄인 무기상 대사를 실제 화면에 연다.
  await view.navigate(`${server.url.href}?caption-pages`);
  await page(STORY_SETUP);
  await page('run = { char: "armorer" }; state = "clear";');
  await storyImage("loadEnding(STORIES.armorer[4]); showEnding();");
  await page("return document.fonts.ready");
  const first = await page("return endingText.textContent");
  const image = await page("return endingImg.src");
  // When: 현재 페이지의 줄 수를 확인하고 한 번 누른다.
  expect(await page(`
    const style = getComputedStyle(endingText);
    return Math.round((endingText.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)) / parseFloat(style.lineHeight));
  `)).toBeLessThanOrEqual(3);
  await page('endingShownAt = performance.now() - ENDING_LOCK * 1000; endingBox.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));');
  // Then: 그림과 창은 그대로이고 대사만 바뀌며 감상 완료는 아직 저장하지 않는다.
  expect(await page("return endingImg.src")).toBe(image);
  expect(await page("return endingText.textContent")).not.toBe(first);
  expect(await page('return [endingBox.classList.contains("show"), meta.stats.mask_ending];')).toEqual([true, 0]);
});

describe("엔딩 대사 페이지", () => {
  CHARS.forEach((char, index) => {
    test(`${char}: 마지막 대사를 넘긴 뒤에만 클리어 창 표시`, async () => {
      // Given: 해당 캐릭터의 엔딩을 보지 않은 저장 상태.
      await view.navigate(`${server.url.href}?ending-pages=${char}`);
      await page(STORY_SETUP);
      await page(`run = { char: "${char}" }; state = "clear";`);
      await storyImage(`loadEnding(ENDINGS["${char}"]); showEnding();`);
      const original = await page(`return ENDINGS["${char}"].text`);
      if (typeof original !== "string") throw new TypeError("엔딩 원문이 문자열이 아님");
      // When: 한 그림의 대사를 한 페이지씩 읽는다.
      const displayed = await readCaptionPages();
      // Then: 원문 전체를 표시하고 마지막 클릭 전에는 완료로 저장하지 않는다.
      expect(displayed).toBe(original.replace(/\s+/g, " ").trim());
      expect(await page('return [endingBox.classList.contains("show"), meta.stats.mask_ending];')).toEqual([true, 0]);
      await page(STORY_NEXT);
      expect(await page('return [endingBox.classList.contains("show"), clearBox.style.display, loadMeta().stats.mask_ending];'))
        .toEqual([false, "flex", 1 << index]);
    });
  });
});

describe("죽음 기록", () => {
  test("기본 보스(사신 마법사)한테 죽으면 보스한테 죽은 횟수는 한 번만 셈", async () => {
    // Given: 스토리를 이미 본 새 저장으로 쉬움(기본 보스) 판을 시작한다.
    await view.navigate(`${server.url.href}?death=boss`);
    await page(STORY_SETUP);
    await page("meta.stats.mask_story = 31; saveMeta(); startGame(true);");
    expect(await page("return state")).toBe("playing");
    // When: 기본 보스한테 맞아 체력이 0 이 되고 게임이 끝난다.
    await page("player.invincible = 0; hurtPlayer(player.maxHp * 10, BOSS_TYPE.key); checkGameOver();");
    // Then: 죽음 1번, 보스한테 죽음도 1번으로 저장된다.
    expect(await page("const s = loadMeta().stats; return [state, s.deaths, s.death_boss];")).toEqual(["gameover", 1, 1]);
  });
});

// 스토리를 이미 본 저장으로 판 시작 (소리·화면 루프 끔, 퀘스트 전부 끝낸 상태)
const RUN_START = `${STORY_SETUP} meta.stats.mask_story = 31; saveMeta(); startGame(true);`;
// n걸음 진행 (카드 창은 첫 카드, 상자 창은 받기). 오류가 나면 그 메시지를 돌려줌
const RUN_STEPS = (n: number) => `
  player.invincible = 1e9;
  for (let i = 0; i < ${n}; i++) {
    try {
      if (state === "playing") { player.hp = player.maxHp; update(1 / 30); }
      else if (state === "levelup") choicesBox.querySelector("button.card").click();
      else if (state === "chest") { finishChestRoll(); closeChest(); }
      else if (state === "candy") candyList.querySelector("button").click();
      else return state;
    } catch (err) { return "error: " + err.message; }
  }
  return state;
`;

describe("실시간 구슬 정리", () => {
  test("먼 구슬을 합쳐도 경험치와 가까운 구슬·끌려오는 구슬은 보존됨", async () => {
    // Given: 먼 구슬 5,000개와 화면 안 구슬, 자석으로 끌려오는 구슬을 만든다.
    await view.navigate(`${server.url.href}?gems=compact`);
    await page(RUN_START);
    const result = await page(`
      for (let i = 0; i < 5000; i++) spawnGem(100 + (i % 100) * 12, 100 + Math.floor(i / 100) * 12, 1 + i % 3);
      spawnGem(cam.x + 30.25, cam.y + 40.75, 2);
      const nearby = gems.at(-1), position = [nearby.x, nearby.y];
      spawnGem(450.5, 600.25, 7);
      const pulled = gems.at(-1); pulled.magnet = true; pulled.speed = 400;
      const total = gems.reduce((sum, g) => sum + g.value, 0);
      // When: 실제 갱신 경로로 정리 주기를 지난다.
      stats.time = 1;
      updatePickups(1 / 30);
      return [gems.length < 200, gems.reduce((sum, g) => sum + g.value, 0) + player.xp === total,
        gems.includes(nearby), nearby.x === position[0] && nearby.y === position[1],
        gems.includes(pulled), pulled.magnet, pulled.x > 450.5];
    `);
    // Then: 개수만 줄고 경험치·화면 안 위치·자석 이동은 유지된다.
    expect(result).toEqual([true, true, true, true, true, true, true]);
  });

  test("반복해서 합친 구슬은 저장·이어 하기 뒤 자석으로 경험치를 전부 얻음", async () => {
    // Given: 새로 떨어지는 구슬을 여러 번 정리할 만큼 쌓는다.
    await view.navigate(`${server.url.href}?gems=collect`);
    await page(RUN_START);
    const expected = await page(`
      let total = 0;
      for (let batch = 1; batch <= 3; batch++) {
        for (let i = 0; i < 1200; i++) {
          const value = 1 + i % 4; total += value;
          spawnGem(200 + i % 30, 200 + Math.floor(i / 30), value);
        }
        stats.time = batch;
        updatePickups(1 / 30);
      }
      return total;
    `);
    const packed = await page("return gems.length < 200");
    // When: 저장을 불러온 뒤 실제 자석 아이템으로 모든 구슬을 끌어온다.
    const result = await page(`
      pauseGame("일시정지"); toTitle(); continueRun(); resumeFromPause();
      spawnItem(player.x, player.y, "magnet");
      useItem(items.at(-1));
      for (let step = 0; step < 1800 && gems.length; step++) {
        stats.time += 1 / 30;
        updatePickups(1 / 30);
      }
      return [gems.length, player.xp];
    `);
    // Then: 합치기·저장·흡수 과정에서 경험치가 사라지거나 중복되지 않는다.
    expect(packed).toBe(true);
    expect(result).toEqual([0, expected]);
  });

  test("화면 밖 구슬만 그리지 않고 가장자리에 걸친 구슬은 그림", async () => {
    // Given: 화면 안, 왼쪽 가장자리에 한 픽셀 걸친 곳, 먼 곳에 하나씩 둔다.
    await view.navigate(`${server.url.href}?gems=cull`);
    await page(RUN_START);
    const result = await page(`
      const image = gemImage(gemRadius(1), false);
      spawnGem(player.x, player.y);
      spawnGem(cam.x - image.width / 2 + 1, player.y);
      spawnGem(100, 100);
      let drawn = 0;
      const original = ctx.drawImage;
      ctx.drawImage = function (...args) { if (args[0] === image) drawn++; return original.apply(this, args); };
      // When: 카메라 변환을 포함한 실제 화면을 그리고 구슬 그림 호출만 센다.
      try { draw(); } finally { ctx.drawImage = original; }
      return [drawn, gems.length];
    `);
    // Then: 보이는 두 개만 그리고 게임 상태의 구슬 세 개는 모두 남는다.
    expect(result).toEqual([2, 3]);
  });
});

describe("이어 하기·불러오기·퀘스트 창", () => {
  test("이어 하기 저장은 먼 구슬을 합쳐도 경험치 합이 같고, 불러온 판이 계속 진행됨", async () => {
    // Given: 판을 시작하고 화면에서 먼 곳에 구슬 5,000개, 플레이어 곁에 10개를 깐다.
    await view.navigate(`${server.url.href}?save=gems`);
    await page(RUN_START);
    const before = await page(`
      for (let i = 0; i < 5000; i++) spawnGem(200 + (i % 100) * 25, 200 + Math.floor(i / 100) * 50, 1 + (i % 3));
      for (let i = 0; i < 10; i++) spawnGem(player.x + 60 + i * 6, player.y, 2);
      return gems.reduce((s, g) => s + g.value, 0);
    `);
    // When: 일시정지로 저장하고, 시작 화면으로 나간 뒤 이어 하기를 누른다.
    const saved = await page('pauseGame("일시정지"); const s = localStorage.getItem(RUN_KEY); return [s.length < 100000, JSON.parse(s).world.gems.length <= 200];');
    await page("toTitle(); continueRun();");
    const after = await page("return [state, gems.reduce((s, g) => s + g.value, 0)]");
    await page("resumeFromPause();");
    // Then: 저장은 작고, 경험치 합은 그대로이며, 300걸음을 오류 없이 진행한다.
    expect(saved).toEqual([true, true]);
    expect(after).toEqual(["paused", before]);
    expect(await page(RUN_STEPS(300))).toBe("playing");
  });

  test("이어 하기 저장이 안 되면 예전 저장을 지우고 일시정지 창에 알림", async () => {
    // Given: 이어 하기 저장이 하나 있는 판에서, 이제부터 이어 하기 저장만 저장 공간 부족으로 실패한다.
    await view.navigate(`${server.url.href}?save=full`);
    await page(RUN_START);
    await page('pauseGame("일시정지"); resumeFromPause();');
    const hadSave = await page("return localStorage.getItem(RUN_KEY) !== null");
    // When: 다시 일시정지해서 저장한다.
    const result = await page(`
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) { if (key === RUN_KEY) throw new DOMException("full", "QuotaExceededError"); return original.call(this, key, value); };
      try { pauseGame("일시정지"); } finally { Storage.prototype.setItem = original; }
      return [pauseText.textContent.endsWith(" · 이어 하기 저장 안 됨"), localStorage.getItem(RUN_KEY)];
    `);
    // Then: 지난 시점의 저장이 되살아나지 않게 지워지고, 일시정지 창에 알린다.
    expect(hadSave).toBe(true);
    expect(result).toEqual([true, null]);
  });

  test("모양 번호가 다른 이어 하기 저장은 불러오지 않음", async () => {
    await view.navigate(`${server.url.href}?save=version`);
    await page(RUN_START);
    const result = await page(`
      pauseGame("일시정지");
      const same = loadRun() !== null;
      const snap = JSON.parse(localStorage.getItem(RUN_KEY)); snap.v = RUN_SAVE_VERSION + 1;
      localStorage.setItem(RUN_KEY, JSON.stringify(snap));
      return [same, loadRun()];
    `);
    expect(result).toEqual([true, null]);
  });

  test("불러오기는 이 게임의 기록 파일만 받음", async () => {
    await view.navigate(`${server.url.href}?save=import`);
    await page(RUN_START);
    const result = await page(`
      pauseGame("일시정지");
      const runSave = JSON.parse(localStorage.getItem(RUN_KEY));
      const exported = JSON.parse(JSON.stringify(meta));
      return [validImportData({}), validImportData(runSave), validImportData({ ...exported, version: SAVE_VERSION + 1 }), validImportData(exported)];
    `);
    expect(result).toEqual([false, false, false, true]);
  });

  test("데미지 숫자는 처음엔 켜져 있고, 기록·저장 창에서 끄면 저장됨", async () => {
    await view.navigate(`${server.url.href}?save=damage`);
    await page(STORY_SETUP);
    const result = await page(`
      const first = [defaultMeta().showDamage, normalizeMeta({ quests: [], stats: {} }).showDamage];
      openPanel("save");
      metaBody.querySelector('[data-act="damage"]').click();
      return [...first, meta.showDamage, loadMeta().showDamage, metaBody.querySelector('[data-act="damage"]').textContent];
    `);
    expect(result).toEqual([true, true, false, false, "꺼짐"]);
  });

  test("퀘스트 창은 해금 보상·금화 보상·완료로 나누고, 거의 다 된 것을 위에 보여 줌", async () => {
    await view.navigate(`${server.url.href}?save=quests`);
    await page(STORY_SETUP);
    const result = await page(`
      meta = defaultMeta(); meta.quests = [QUESTS[0].id]; meta.stats.kills = 3000; meta.stats.runs = 7; meta.stats.chests = 30; saveMeta();
      openPanel("quests");
      const heads = [...metaBody.querySelectorAll(".meta-head")];
      const ratio = (name) => { const q = QUESTS.find((it) => it.name === name); return Math.min(q.goal, Math.max(0, questValue(q, false))) / q.goal; };
      const sorted = heads.slice(0, 2).every((h) => {
        const names = [];
        for (let el = h.nextElementSibling; el && !el.classList.contains("meta-head"); el = el.nextElementSibling) names.push(el.querySelector("b").textContent);
        return names.length > 1 && names.every((n, i) => i === 0 || ratio(names[i - 1]) >= ratio(n));
      });
      return [heads.map((h) => h.textContent), sorted, metaBody.querySelectorAll(".meta-row.done").length];
    `);
    expect(result).toEqual([["해금 보상", "금화 보상", "완료"], true, 1]);
  });
});

describe("게임 루프 오류", () => {
  test("한 프레임에서 오류가 나면 멈추고 알린 뒤, 계속하기로 이어 감", async () => {
    await view.navigate(`${server.url.href}?loop=once`);
    await page(RUN_START);
    const result = await page(`
      const original = update, quiet = console.error;
      let once = true;
      update = (dt) => { if (once) { once = false; throw new Error("시험용 오류"); } return original(dt); };
      console.error = () => {};
      try {
        gameLoop(1000);
        const paused = [state, pauseText.textContent];
        resumeFromPause(); gameLoop(2000); gameLoop(2033);
        return [...paused, state, stats.time > 0];
      } finally { update = original; console.error = quiet; }
    `);
    expect(result).toEqual(["paused", "오류가 나서 멈췄어요", "playing", true]);
  });

  test("계속하기를 눌러도 오류가 되풀이되면 판을 접고 시작 화면으로, 깨진 이어 하기 저장은 지움", async () => {
    await view.navigate(`${server.url.href}?loop=always`);
    await page(RUN_START);
    const result = await page(`
      const original = update, quiet = console.error;
      update = () => { throw new Error("시험용 오류"); };
      console.error = () => {};
      try {
        for (let i = 0; i < 3; i++) { if (state === "paused") resumeFromPause(); gameLoop(1000 + i * 16); }
        return [state, localStorage.getItem(RUN_KEY)];
      } finally { update = original; console.error = quiet; }
    `);
    expect(result).toEqual(["title", null]);
  });
});

describe("손맛: 무기별 피해·데미지 숫자·히트스톱", () => {
  test("무기가 준 피해는 그 무기로 쌓이고, 데미지 숫자는 설정을 끄면 안 뜸", async () => {
    await view.navigate(`${server.url.href}?feel=tally`);
    await page(RUN_START);
    await page("const e = makeEnemy(ENEMY_TYPES[0], player.x + 40, player.y); e.hp = e.maxHp = 1e7; e.speed = 0; enemies.push(e);");
    await page(RUN_STEPS(120));
    const on = await page("return [run.dmgByWeapon[player.weapons[0].type] > 0, floatTexts.filter((f) => f.small).length > 0]");
    await page("meta.showDamage = false; floatTexts = [];");
    await page(RUN_STEPS(60));
    const off = await page("return floatTexts.filter((f) => f.small).length");
    expect(on).toEqual([true, true]);
    expect(off).toBe(0);
  });

  test("같은 적이 연달아 맞으면 숫자를 더하고, 한꺼번에 많이 떠도 DMG_TEXT_MAX 개까지만", async () => {
    await view.navigate(`${server.url.href}?feel=numbers`);
    await page(RUN_START);
    const result = await page(`
      floatTexts = [];
      const one = makeEnemy(ENEMY_TYPES[0], player.x + 50, player.y); one.hp = one.maxHp = 1e6; enemies.push(one);
      damageEnemy(one, 5); damageEnemy(one, 7);
      const merged = floatTexts.filter((f) => f.small).map((f) => f.text);
      for (let i = 0; i < 200; i++) { const e = makeEnemy(ENEMY_TYPES[0], player.x + 60 + i, player.y); e.hp = e.maxHp = 1e6; enemies.push(e); damageEnemy(e, 5); }
      return [merged, floatTexts.filter((f) => f.small).length === DMG_TEXT_MAX];
    `);
    expect(result).toEqual([["12"], true]);
  });

  test("보스가 크게 맞으면 아주 잠깐 멈췄다가(히트스톱) 다시 움직이고, 작은 타격에는 안 멈춤", async () => {
    await view.navigate(`${server.url.href}?feel=hitstop`);
    await page(RUN_START);
    const result = await page(`
      const b = spawnBoss();
      damageEnemy(b, 1);
      const small = hitStop;
      damageEnemy(b, b.maxHp * 0.05);
      const big = hitStop > 0, t0 = stats.time;
      lastTime = 1000; gameLoop(1016);
      const frozen = stats.time === t0;
      gameLoop(1100); gameLoop(1133);
      return [small, big, frozen, stats.time > t0];
    `);
    expect(result).toEqual([0, true, true, true]);
  });
});

describe("레벨업 봉인·결과 창 피해 표", () => {
  test("봉인한 새 무기·아이템은 그 판에 다시 안 나오고, 한 판에 두 번까지", async () => {
    await view.navigate(`${server.url.href}?banish=1`);
    await page(RUN_START);
    const result = await page(`
      levelUp();
      const titles = () => [...choicesBox.querySelectorAll("button.card")].map((b) => b.firstChild.textContent);
      const before = titles(), label0 = banishBtn.textContent;
      banishBtn.click();
      const label1 = banishBtn.textContent;
      const target = choicesBox.querySelector("button.card.banishable"), name = target.firstChild.textContent;
      target.click();
      const after = titles(), stillOpen = state === "levelup";
      const gone = !buildUpgradePool(true).some((c) => c.title === name);
      banishBtn.click(); choicesBox.querySelector("button.card.banishable").click();
      const label2 = banishBtn.textContent, disabled = banishBtn.disabled;
      [...choicesBox.querySelectorAll("button.card")].find((b) => !b.textContent.includes("무기 상자")).click();
      return [label0, label1, before.includes(name), after.includes(name), after.length === before.length, stillOpen, gone, run.banished.length, label2, disabled, state];
    `);
    expect(result).toEqual(["봉인 (2번 남음)", "봉인 취소", true, false, true, true, true, 2, "봉인 (0번 남음)", true, "playing"]);
  });

  test("게임오버 창에 무기별 피해를 많이 준 순서로 비율과 함께 보여 줌", async () => {
    await view.navigate(`${server.url.href}?dmgtable=1`);
    await page(RUN_START);
    const result = await page(`
      const [a, b] = Object.keys(WEAPONS).filter((k) => !WEAPONS[k].evolved);
      run.dmgByWeapon = { [b]: 500, [a]: 1500, other: 99 };
      player.invincible = 0; player.hp = 0; checkGameOver();
      const rows = [...resultDmg.querySelectorAll(".dmg-row")].map((r) => [r.querySelector("span").textContent, r.querySelector("b").textContent, r.querySelector("small").textContent]);
      return [state, rows, [WEAPONS[a].name, WEAPONS[b].name]];
    `);
    if (!Array.isArray(result)) throw new TypeError("결과가 배열이 아님");
    const [state, rows, names] = result;
    expect(state).toBe("gameover");
    expect(rows).toEqual([[names[0], "1,500", "75%"], [names[1], "500", "25%"]]);
  });
});
