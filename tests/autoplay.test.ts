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
