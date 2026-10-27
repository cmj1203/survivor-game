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

  test("첫 스토리 중에 전체 화면이 되면 게임이 시작될 때 전체 화면 안내", async () => {
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
    // Then: 스토리 중에는 안내를 아껴 두고, 게임이 시작되자마자 안내와 함께 멈춘 뒤 본 것으로 저장한다.
    expect(duringStory).toEqual(["story", null]);
    expect(await page("return [state, pauseBox.style.display, localStorage.getItem(FS_HINT_KEY)]")).toEqual(["paused", "flex", "1"]);
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
