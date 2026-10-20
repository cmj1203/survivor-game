// 브라우저 없이 게임 코드를 불러오는 시험 도구
//   실행: bun test tests/unit   (맥·리눅스·윈도 어디서나. 브라우저 필요 없음)
//   js/ 파일들은 한 페이지에서 차례로 불러오는 전역 스크립트라 import 할 수 없음
//   → node:vm 의 한 영역(context)에 가짜 document·localStorage 등을 넣고 01~12 파일을 index.html 과 같은 순서로 실행함
//     (13-start.js 는 시작 화면 애니메이션만 돌리므로 뺌). 같은 영역에서 실행한 스크립트끼리는 const·let·function 을 같이 씀
//   소리: AudioContext 를 주지 않으므로 소리 장치가 켜지지 않고 playSfx 는 아무것도 안 함
//   난수: Math.random 은 늘 setRandom 으로 정한 고정 값 (처음 0.5). 시간: requestAnimationFrame·setTimeout 은 실행하지 않음
//   네트워크: fetch 를 부르면 바로 에러
import { readdirSync, readFileSync } from "node:fs";
import vm from "node:vm";

const JS_DIR = new URL("../../js/", import.meta.url).pathname;
const GAME_FILES = readdirSync(JS_DIR).filter((f) => /^\d\d-.*\.js$/.test(f) && f !== "13-start.js").sort();
const SCRIPTS = GAME_FILES.map((f) => new vm.Script(readFileSync(`${JS_DIR}${f}`, "utf8"), { filename: `js/${f}` }));

// 무엇을 부르거나 읽어도 에러 없이 자기 자신을 돌려주는 값 (캔버스 붓처럼 결과를 안 보는 것에 씀)
function anything(): unknown {
  const target = () => {};
  const proxy: unknown = new Proxy(target, {
    get: (_t, key) => (key === Symbol.toPrimitive ? () => 0 : key === "then" ? undefined : proxy),
    set: () => true,
    apply: () => proxy,
    construct: () => proxy as object,
  });
  return proxy;
}

type Listener = (e: unknown) => unknown;

class FakeClassList {
  private readonly names = new Set<string>();
  add(...n: string[]) { for (const x of n) this.names.add(x); }
  remove(...n: string[]) { for (const x of n) this.names.delete(x); }
  toggle(n: string, force?: boolean) { const on = force ?? !this.names.has(n); if (on) this.names.add(n); else this.names.delete(n); return on; }
  contains(n: string) { return this.names.has(n); }
}

class FakeElement {
  id = "";
  style: Record<string, unknown> = { setProperty() {}, removeProperty() {} };
  classList = new FakeClassList();
  dataset: Record<string, string> = {};
  children: FakeElement[] = [];
  private html = "";
  get innerHTML() { return this.html; }
  set innerHTML(v: string) { this.html = v; if (v === "") this.children = []; }   // 비우면 자식도 사라짐
  textContent = "";
  className = "";
  title = "";
  value = "";
  disabled = false;
  width = 1280;
  height = 720;
  scrollTop = 0;
  files: unknown[] = [];
  readonly listeners: Record<string, Listener[]> = {};
  addEventListener(type: string, fn: Listener) { this.listeners[type] = [...(this.listeners[type] ?? []), fn]; }
  removeEventListener() {}
  dispatch(type: string, event: object = {}) { for (const fn of this.listeners[type] ?? []) fn({ target: this, preventDefault() {}, ...event }); }
  click() { this.dispatch("click"); }
  appendChild(c: FakeElement) { this.children.push(c); return c; }
  remove() {}
  focus() {}
  setAttribute() {}
  getAttribute() { return null; }
  closest() { return null; }
  querySelector() { return new FakeElement(); }
  querySelectorAll() { return this.children; }
  getContext() { return anything(); }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.width, height: this.height }; }
}

export type Game = ReturnType<typeof loadGame>;

// 새 게임 영역 하나를 만듦. storage = 미리 넣어 둘 localStorage 내용 (저장 불러오기 시험용)
export function loadGame(storage: Record<string, string> = {}) {
  const elements = new Map<string, FakeElement>();
  const byId = (id: string) => {
    let el = elements.get(id);
    if (!el) { el = new FakeElement(); el.id = id; elements.set(id, el); }
    return el;
  };
  const store = new Map(Object.entries(storage));
  let randomValue = 0.5;
  const windowListeners: Record<string, Listener[]> = {};
  const documentElement = new FakeElement();

  const sandbox: Record<string, unknown> = {
    document: {
      getElementById: byId,
      createElement: () => new FakeElement(),
      querySelectorAll: () => [],
      querySelector: () => new FakeElement(),
      addEventListener() {},
      currentScript: { src: "http://localhost/js/01-setup.js?v=test" },
      visibilityState: "visible",
      documentElement,
      body: new FakeElement(),
      fonts: anything(),
    },
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k) : null),
      setItem: (k: string, v: string) => { store.set(k, String(v)); },
      removeItem: (k: string) => { store.delete(k); },
    },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    screen: { width: 1920, height: 1080 },
    innerWidth: 1280,
    innerHeight: 720,
    Image: class { onload: (() => void) | null = null; src = ""; complete = false; naturalWidth = 0; width = 16; height = 16; },
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0,
    clearTimeout: () => {},
    fetch: () => { throw new Error("시험 중에는 네트워크를 쓰지 않음"); },
    confirm: () => true,
    alert: () => {},
    URL,
    console,
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = (type: string, fn: Listener) => { windowListeners[type] = [...(windowListeners[type] ?? []), fn]; };
  const context = vm.createContext(sandbox);
  vm.runInContext("Math.random = () => globalThis.__random();", context);
  sandbox.__random = () => randomValue;
  for (const s of SCRIPTS) s.runInContext(context);

  return {
    // 게임 영역 안에서 식을 실행해 값을 돌려받음 (게임의 const·let·function 을 그대로 쓸 수 있음)
    run<T = unknown>(code: string): T { return vm.runInContext(code, context) as T; },
    // 영역 밖과 비교하기 쉽게 JSON 으로 바꿔 받음 (배열·객체를 toEqual 로 비교할 때)
    json<T = unknown>(code: string): T { return JSON.parse(vm.runInContext(`JSON.stringify(${code})`, context)) as T; },
    setRandom(v: number) { randomValue = v; },
    el: byId,
    storage: store,
    keydown(event: object) { for (const fn of windowListeners.keydown ?? []) fn({ preventDefault() {}, repeat: false, ...event }); },
    keyup(event: object) { for (const fn of windowListeners.keyup ?? []) fn({ preventDefault() {}, ...event }); },
  };
}

// 새 판을 시작한 게임 (보통 난이도·견습 마법사). 상점 강화 없음
export function startedGame(storage: Record<string, string> = {}) {
  const g = loadGame(storage);
  g.run("resetGame()");
  return g;
}
