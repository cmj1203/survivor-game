// 무기 발동 주기·발사체, 키보드 입력과 일시정지, 게임오버 화면
import { describe, expect, test } from "bun:test";
import { startedGame } from "./game-env";

describe("무기 발동", () => {
  test("단검: 레벨 수만큼 바라보는 방향으로 나란히, 피해는 weaponDamage", () => {
    const g = startedGame();
    g.run("player.weapons = [{ type: 'bullet', level: 3, timer: 0 }]; player.facingX = 0; player.facingY = -1; updateWeapons(0.01)");
    expect(g.json("bullets.map((b) => [b.x - player.x, b.y - player.y, b.vx, b.vy])")).toEqual([[-12, 0, 0, -450], [0, 0, 0, -450], [12, 0, 0, -450]]);
    expect(g.run<number>("bullets[0].damage")).toBeCloseTo(g.run<number>("weaponDamage(player.weapons[0])"), 9);
  });

  test("발동 뒤 다음 발동까지 = 무기 간격 × 빠른 공격 배수", () => {
    const g = startedGame();
    g.run("player.weapons = [{ type: 'bullet', level: 1, timer: 0 }]; gainPassive('cooldown'); updateWeapons(0.01)");
    expect(g.run<number>("player.weapons[0].timer")).toBeCloseTo(0.35 * 0.92, 9);
    g.run("updateWeapons(0.3)");
    expect(g.run("bullets.length")).toBe(1);
    g.run("updateWeapons(0.03)");
    expect(g.run("bullets.length")).toBe(2);
  });

  test("마법봉 간격은 Lv2·4·6·8 마다 10% 줄어듦", () => {
    const g = startedGame();
    const interval = (lv: number) => g.run<number>(`WEAPONS.wand.getInterval({ level: ${lv} })`);
    expect(interval(1)).toBeCloseTo(0.65, 9);
    expect(interval(2)).toBeCloseTo(0.585, 9);
    expect(interval(8)).toBeCloseTo(0.65 * 0.9 ** 4, 9);
  });

  test("팔보호대는 새로 쏜 발사체 속도만 키움", () => {
    const g = startedGame();
    g.run("player.weapons = [{ type: 'bullet', level: 1, timer: 0 }]; gainPassive('projspeed'); gainPassive('projspeed'); updateWeapons(0.01)");
    expect(g.run<number>("bullets[0].vx")).toBeCloseTo(540, 9);
  });

  test("복제기 Lv1: 세 번째 발동마다 0.12초 뒤 한 번 더", () => {
    const g = startedGame();
    g.run("player.weapons = [{ type: 'bullet', level: 1, timer: 0 }]; gainPassive('amount')");
    const fire = () => g.run<number>("player.weapons[0].timer = 0; updateWeapons(0.01); bullets.length");
    expect([fire(), fire(), fire()]).toEqual([1, 2, 3]);
    expect(g.run("updateWeapons(0.1); bullets.length")).toBe(3);    // 추가 발사는 0.12초 뒤
    expect(g.run("updateWeapons(0.02); bullets.length")).toBe(4);
  });

  test("마법봉은 적이 없으면 쏘지 않음", () => {
    const g = startedGame();
    g.run("updateWeapons(0.01)");
    expect(g.run("bullets.length")).toBe(0);
  });
});

describe("키보드", () => {
  test("WASD 는 키 위치로 읽어서 한글 입력 상태에서도 움직임", () => {
    const g = startedGame();
    g.keydown({ code: "KeyW", key: "ㅈ" });
    g.keydown({ code: "ArrowLeft", key: "ArrowLeft" });
    expect(g.json("[keys.w, keys.arrowleft, isMoving()]")).toEqual([true, true, true]);
    g.keyup({ code: "KeyW", key: "ㅈ" });
    g.keyup({ code: "ArrowLeft", key: "ArrowLeft" });
    expect(g.run("isMoving()")).toBe(false);
  });

  test("Cmd/Ctrl 과 함께 누르면 눌린 키를 모두 풀어 줌", () => {
    const g = startedGame();
    g.keydown({ code: "KeyD", key: "d" });
    g.keydown({ code: "KeyA", key: "a", metaKey: true });
    expect(g.json("[keys.d, keys.a ?? false]")).toEqual([false, false]);
  });

  test("Esc 로 일시정지(그때 이어 하기 저장), 다시 Esc 로 재개", () => {
    const g = startedGame();
    g.run("stats.time = 75");
    g.keydown({ code: "Escape", key: "Escape" });
    expect(g.json("[state, pauseBox.style.display, pauseText.textContent]")).toEqual(["paused", "flex", "일시정지 · 1분 15초 버팀"]);
    expect(g.storage.has("dungeon-survivor-run")).toBe(true);
    g.keydown({ code: "Escape", key: "Escape" });
    expect(g.json("[state, pauseBox.style.display]")).toEqual(["playing", "none"]);
  });

  test("한 프레임(update) 끝에 경험치가 차 있으면 레벨업 창, 상자를 연 프레임에는 상자 창이 먼저", () => {
    const g = startedGame();
    g.run("player.xp = 999; update(1 / 30)");
    expect(g.run("state")).toBe("levelup");
    const g2 = startedGame();
    g2.run("player.xp = 999; spawnChest(player.x, player.y, true); update(1 / 30)");
    expect(g2.json("[state, player.level]")).toEqual(["chest", 1]);
  });
});

describe("게임오버 화면", () => {
  test("시간 표시는 '분 초', 1분 미만이면 초만", () => {
    const g = startedGame();
    expect(g.json("[formatTime(0), formatTime(59.9), formatTime(754)]")).toEqual(["0초", "59초", "12분 34초"]);
  });

  test("체력이 0 이 된 프레임에 게임오버 창과 정산 결과가 뜸", () => {
    const g = startedGame();
    g.run("stats.time = 130; stats.kills = 3; player.hp = -1; update(1 / 30)");
    expect(g.run("state")).toBe("gameover");
    expect(g.run("resultText.innerHTML")).toContain("생존 시간 2분 10초");
    expect(g.run("runReward.innerHTML")).toContain("퀘스트 '첫 걸음' 완료 → 금화 15");
  });
});
