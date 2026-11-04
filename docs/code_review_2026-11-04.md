# 코드 검토 2026-11-04

대상: `js/` 전체 (01-setup ~ 13-start), 기준 커밋 `9f25d3d`(main).
형식: `파일:줄` · 증상 · 재현 · 고칠 안. 끝의 [높음/중간/낮음]은 확실도다.
이번 작업에서는 biome 경고 4건 말고는 제품 코드를 고치지 않았다. 아래 항목은 모두 그대로 남아 있다.

## 1. 버그 의심

1. `js/01-setup.js:278` · 스토리 화면(`state === "story"`)에서 배경을 다시 만들면 `draw()`를 부르는데, 판이 없으면 TypeError가 난다. 오류는 `js/08-draw.js:8`의 `ctx.save()` 다음에 나므로 `restore`도 불리지 않는다 · 재현: 새 저장에서 첫 시작을 누른다. 그러면 `js/10-title.js:226`의 `showStory`가 판을 만들기 전에 돈다. 이때 휴대폰 앱을 바꿨다가 돌아오면 visibilitychange가 `rebuildBackground`를 부르고, `js/08-draw.js:55`의 `for (const h of hazards)`에서 멈춘다. 가짜 브라우저(tests/unit/game-env)에서 `floorLoaded = 99; state = "story"; rebuildBackground()`를 돌려 `undefined is not an object (evaluating 'h of hazards')`를 확인했다 · 고칠 안: 조건을 '판이 있는 상태' 목록으로 바꾸거나, 앞에 `if (!player) return;`을 넣는다 [높음]

2. `js/06-spawn-combat.js:118-123` · 난이도 테마 특성(게 껍질, 거미 분열 수, 유령 순간이동, 외눈 거인 자국)이 게임 중에는 한 번도 붙지 않는다 · 재현: `tier > 0`인 난이도 셋은 모두 `theme`이 ice·lava·dark이고(`js/11-meta-save.js:31-33`), 세 테마 모두 `STAGE_ENEMIES`에 표가 있다. 그 표에는 crab·spider·ghost·cyclops가 없다. 떼 이벤트의 "bat"·"ghost"는 `stageEnemyType`이 테마 적으로 바꾸고, 보스 부하(`summon`)도 icewisp·imp·crow다. 그래서 `js/06-spawn-combat.js:589-595`(껍질), `:633-638`(외눈 거인 자국), `js/07-update.js:619-628`(유령 순간이동), `js/08-draw.js:928`(껍질 테두리)에는 도달하지 않는다. 쓰는 곳 없이 내려받는 테마 그림 `bat_*`·`crab_*`·`spider_*`·`ghost_*`·`cyclops_*`·`wizard_*`도 같은 이유로 생긴 것으로 보인다(`js/01-setup.js:115-116`) · 고칠 안: 예전 방식의 흔적이면 표(`js/04-passives-enemies.js:195-204`)·코드·그림 목록을 지운다. 살릴 생각이면 key 대신 자리 번호로 특성을 붙인다. 단위 시험 '난이도 특성: 게 껍질·거미 분열 수'는 `makeEnemy`에 기본 적을 직접 넣어서 통과하므로, 실제 판에서도 이렇게 되는지는 보지 못한다 [높음]

3. `js/07-update.js:168` · `updateEnemies`가 이미 죽은 적(`e.dead`)도 건너뛰지 않고 한 프레임 더 움직이고 행동한다 · 재현: 죽은 적은 `js/07-update.js:724`에서 걸러지는데, 그보다 뒤인 `updatePlayerDamage`(승리의 검 반격, 진화 방패)와 `updatePickups`(해골 아이템 전멸)에서 죽은 적은 다음 프레임에 그대로 행동한다. 예를 들어 뛰어오른 웬디고가 전멸로 죽은 다음 프레임에 착지하면 `:595`의 `hurtPlayer`가 불린다. 300px 바로 밖에서 죽은 지옥개 우두머리에게 다가가면 시체에서 `splitPack`(`:563`)이 산 개 2마리를 만든다 · 고칠 안: `:168` 루프 첫 줄에 `if (e.dead) continue;`를 넣는다 [경로는 높음, 얼마나 자주 일어나는지는 중간]

4. `js/06-spawn-combat.js:662`, `js/07-update.js:682-697` · 순간이동으로 사라진(`vanished`) 죽음의 기사가 피해 없이 탄을 먹는다 · 재현: 사라진 동안에도 `e.x/e.y`는 떠난 자리에 그대로 있다. `findNearestEnemy`는 450px 안의 보스를 먼저 고르므로 자동 조준 무기가 빈 자리를 쏜다. `updateBulletHits`는 닿기만 하면 `damageEnemy`를 부르고, `damageEnemy`는 vanished라서 그냥 돌아온다(`js/06-spawn-combat.js:586`). 그런데 그 뒤 `pierce -= 1`과 `b.dead = true`는 그대로 실행되어 탄이 사라진다 · 고칠 안: `findNearestEnemy`·`findBestLine`·`updateBulletHits`(`:683`)에서 `e.vanished`인 적을 뺀다 [높음]

5. `js/03-weapons.js:459` · 별의 문양 Lv1~4는 일반 적을 `e.dead = true`로 지우기만 하고 `damageEnemy`의 처치 처리를 건너뛴다. 미믹은 elite가 아니어서(`js/06-spawn-combat.js:291`) 이 길로 간다 · 재현: Lv4 이하 별의 문양이 화면 안의 미믹을 지우면, 반드시 떨어져야 할 진짜 상자(`js/06-spawn-combat.js:616-617`)가 나오지 않는다. 얼음 원소의 `killStat`("껍질 까기" 퀘스트)과 성녀의 처치 회복도 오르지 않는다 · 고칠 안: 미믹은 elite처럼 `damageEnemy`로 보낸다. 또는 '구슬 없이 처치'하는 함수를 따로 만들어 상자·퀘스트 처리만 돌린다 [미믹 상자는 높음, 퀘스트를 일부러 뺐는지는 낮음]

6. `js/03-weapons.js:896`, `:915` · 연쇄 폭탄 파편 6개와 운석 불바다에 `src`가 없다. 둘 다 `updateWeapons` 밖에서 생기므로 `js/06-spawn-combat.js:734-735`의 `src ??=`도 붙지 않는다 · 재현: cherry 진화나 larobba 진화로 싸우고 결과 창의 무기별 피해 표를 보면, 파편·불바다 피해가 빠져 있다(`js/07-update.js:715`에서 `dmgSource`가 null). 지옥불(`js/03-weapons.js:828`)은 `src: b.src`를 넣어서 이 문제가 없다 · 고칠 안: 두 곳에 `src: bomb.src`, `src: rock.src`를 넣는다 [높음]

7. `js/03-weapons.js:763-765` · `isMoving()`은 키가 눌렸는지만 본다. 실제 이동(`js/07-update.js:40-45`)에서는 반대 방향 키끼리 상쇄된다 · 재현: W와 S를 같이 누르면 캐릭터는 서 있는데 `isMoving()`은 true다. 그래서 그림자 발톱이 터지지 않고, 질풍검 배수가 쌓이고, 뼈 간격도 짧아진다 · 고칠 안: `updatePlayer`가 이번 프레임에 실제로 움직였는지를 `player.moving`에 남기고, `isMoving`은 그 값을 돌려준다 [높음]

8. `js/11-meta-save.js:644` · '전부 환불'을 누르면, 잠금 퀘스트를 깨기 전에 사 둔 상점 항목이 다시 잠긴다 · 재현: q_lowhp를 깨지 않았고 부활을 1단계 가진 저장(예전 버전에서 산 것)에서 전부 환불을 누른다. `upLevel("revival")`이 0이 되면서 `shopLocked`가 true로 바뀌어 다시 살 수 없다. `:159` 주석 '이미 사 둔 사람은 그대로 쓸 수 있게'와 어긋난다 · 고칠 안: 환불할 때 `SHOP_LOCKS`에 걸린 항목은 건너뛴다. 또는 '산 적 있음' 표시를 따로 저장한다 [높음]

9. `js/11-meta-save.js:439`, `:449`, `:457` · 이어 하기 저장을 확인할 때 `stats.kills`·`xp`·`xpNeed`·`diff`가 제대로 된 값인지 보지 않는다 · 재현: `stats.kills`가 빠진 저장으로 이어 하면 처치 수가 NaN이 되고, `finishRun`의 금화도 NaN이 된다. `meta.gold`는 JSON에 null로 저장되고, 다시 불러오면 0이 된다. 또 `diff: -1`이면 `isDiffUnlocked(-1)`이 true라 그대로 남고, `:542`의 `DIFFS[meta.diff].name`에서 TypeError가 난다 · 고칠 안: `loadRun`의 검사에 kills·xp·xpNeed를 넣고, diff는 `Math.max(0, …)`로 막는다. 손으로 고쳤거나 망가진 저장에서만 일어난다 [동작 원리는 높음]

10. `js/11-meta-save.js:683-698`, `:459` · 기록을 불러와도 예전 이어 하기 저장을 지우지 않는다. 이어 하기는 그 캐릭터를 샀는지 다시 확인하지 않는다 · 재현: 사냥꾼을 산 기록에서 사냥꾼 판을 하다 남긴 채로, 사냥꾼을 사지 않은 파일을 불러온 뒤 이어 한다. `startRun`이 `meta.char`를 knight로 돌려놓지만, `Object.assign(run, snap.run)`이 `run.char`를 hunter로 덮어쓴다 · 고칠 안: 불러오기 뒤에 `clearRun()`을 부르고, `continueRun`에서 `run.char`·`run.diff`를 다시 확인한다 [중간]

11. `js/09-loop-windows.js:45` · 루프 오류가 3번 나서 시작 화면으로 돌아오면, 저장이 없는데도 '이어 하기' 버튼이 보인다 · 재현: `toTitle()`이 `saveRun()`을 하고(state가 아직 "playing") `refreshTitleMenu()`가 그 저장을 보고 버튼을 켠다. 그 뒤 `clearRun()`이 저장을 지운다. 버튼을 누르면 아무 일 없이 버튼만 사라진다 · 고칠 안: `toTitle()` 전에 `clearRun()`을 부르거나, `clearRun()` 뒤에 `refreshTitleMenu()`를 한 번 더 부른다 [높음]

12. `js/09-loop-windows.js:24`, `:44` · 오류 횟수 `loopErrors`가 새 판을 시작해도 0으로 돌아가지 않는다 · 재현: 오류로 2번 멈춘 뒤 시작 화면으로 나가서 새 판을 시작한다. 그러면 첫 오류 한 번에 판이 접히고 저장도 지워진다 · 고칠 안: `resetGame`이나 `continueRun`에서 `loopErrors = 0` [높음]

13. `js/11-meta-save.js:651-652` · 캐릭터를 사고 스토리를 다 봐도, 창을 다시 열기 전까지 스토리 다시보기(책) 버튼이 나오지 않는다 · 재현: 구매 뒤 `renderPanel()`을 먼저 부르고 `showStory`를 띄운다. 스토리를 다 보면 `mask_story`가 켜지지만 패널은 다시 그리지 않는다 · 고칠 안: `showStory(key, renderPanel)`처럼 다 본 뒤 다시 그린다 [높음]

14. `js/01-setup.js:157-161` · 기본 바닥 그림 4장이 모두 `onload`되어야 배경을 만들고, `onerror` 처리가 없다. `buildBackground`는 쓰지도 않는 wall까지 기다린다 · 재현: wall.png 하나만 받지 못해도 `floorLoaded`가 3에서 멈추고 바닥이 그려지지 않는다 · 고칠 안: wall은 기다리지 않고, onerror도 세서 기본 색으로 칠한다 [중간]

15. `js/09-loop-windows.js:413-428` · 엔딩·스토리 자막에서 첫 단어 하나가 이미 3줄 높이를 넘으면 다음으로 넘어가지 못한다 · 재현: 창이 아주 좁으면 반복이 `end === endingWordStart`에서 멈추고, 같은 자리를 계속 '다음 쪽'으로 그린다 · 고칠 안: `if (end === endingWordStart) end++`로 적어도 한 단어는 넘긴다 [중간, 극단적으로 좁은 창에서만]

## 2. 경계 조건

16. `js/11-meta-save.js:247` · `isDiffUnlocked(i)`가 범위를 보지 않는다. `maxClearDiff`가 3이면 `isDiffUnlocked(4)`가 true다 · 재현: 지금은 단추가 0~3만 만들어져 실제로는 일어나지 않는다. `data-key`가 4인 클릭이 들어오면 `meta.diff = 4`가 되고, `DIFFS[4].theme`에서 TypeError가 난다 · 고칠 안: `i >= 0 && i < DIFFS.length &&`를 붙인다 [높음, 영향은 낮음]

17. `js/11-meta-save.js:252` · 저장된 난이도가 잠겨 있으면, 열린 가장 높은 난이도가 아니라 쉬움(0)으로 돌아간다 · 재현: `diff: 3, maxClearDiff: 0`인 저장으로 시작하면 보통(1)이 열려 있어도 쉬움이 된다. 단위 시험 '저장된 난이도가 잠겨 있으면…'이 지금 동작을 고정해 둔다 · 고칠 안: 의도에 따라 `Math.min(meta.diff, meta.stats.maxClearDiff + 1)`로 바꾼다 [의도인지 모름]

18. `js/04-passives-enemies.js:144` · `stageEnemyType`은 다른 테마의 적 이름을 받으면 바꾸지 않고 그 적을 그대로 돌려준다. 어둠에서 `"polarbear"`를 넣으면 북극곰이 나온다 · 재현: 지금 부르는 곳(`js/06-spawn-combat.js:188`)은 "bat"·"ghost"만 넣어서 문제가 없다. 주석에 '없는 이름이면 그 이름의 적'이라고 적혀 있어 의도로 보이고, 단위 시험이 이 동작을 고정해 둔다 · 고칠 안: 테마 간 섞임을 막으려면 `findEnemyType` 단계를 지금 테마 목록 안에서만 찾게 한다 [낮음]

19. `js/09-story.js:132`, `js/10-title.js:225`, `js/11-meta-save.js:608` · `1 << Object.keys(CHARACTERS).indexOf(char)`를 세 곳에서 따로 계산하고 -1을 막지 않는다. 모르는 캐릭터면 `1 << -1`이 되어 부호 비트가 켜진다. `charBit()`(`:270`)는 `Math.max(0, …)`로 막는다 · 고칠 안: `charBit(key)` 하나로 합친다 [높음]

20. `js/05-state-input.js:64` · `CHARACTERS[meta.char].weapon`에 기본값이 없다. 바로 뒤 `startRun`(`js/11-meta-save.js:261`)이 `charDef().weapon`으로 다시 덮어쓴다 · 재현: `normalizeMeta`가 캐릭터를 검사하므로 지금은 터지지 않는다. 검사를 거치지 않은 `meta.char`가 들어오면 `startRun`의 보정보다 먼저 TypeError가 난다 · 고칠 안: 이 줄은 `weapons: []`로 두고 `startRun`에만 맡긴다 [중복은 높음, 터질 가능성은 낮음]

21. `js/06-spawn-combat.js:18`, `js/07-update.js:248` · 적 수 상한(`MAX_ENEMIES`)을 셀 때 `pendingSpawns`를 넣지 않는다. 분열(`js/06-spawn-combat.js:647-651`)과 합치기(`js/07-update.js:727`)에는 상한 검사가 없다 · 재현: `enemies.length`가 2999일 때 보스 부하 4마리가 모두 들어간다 · 고칠 안: `enemies.length + pendingSpawns.length`로 센다 [높음, 영향은 낮음]

22. `js/06-spawn-combat.js:94`, `:99` · 새끼 거미의 `maxHp`가 어미 체력 기준으로 남는다(`maxHp`를 먼저 정하고 `hp`만 줄임) · 재현: 지금은 `maxHp`를 쓰는 곳(엘리트 체력바, 재생, 전멸의 엘리트 피해)에 새끼가 해당하지 않아 드러나지 않는다 · 고칠 안: `isChild` 블록 끝에 `e.maxHp = e.hp`를 넣는다 [높음, 영향은 낮음]

23. `js/03-weapons.js:482`, `:877` · 빙결 광선(과 진화)은 `w.dir`을 먼저 올리고 쓰므로, 첫 광선이 0°가 아니라 30° 쪽으로 나간다 · 고칠 안: 쓴 다음에 올린다 [높음, 영향은 작음]

## 3. 중복 코드

24. `js/07-update.js:724-725` · `enemies = enemies.filter((e) => !e.dead);`가 똑같이 두 줄 있다 · 고칠 안: 한 줄을 지운다 [높음]

25. `js/03-weapons.js:846`, `:874-877`, `:883` · 진화 무기가 기본 무기의 계산을 복사해 쓴다. `staff_evo.getHalfWidth`는 `22 * 1.3 ** (lv-1)`을 다시 쓰고, `fire`는 `findBestLine`(`js/06-spawn-combat.js:688`)을 가로·세로 따로 다시 구현했다. `clock_evo`·`hammer_evo`·`spear_evo`도 마찬가지다 · 재현: 기본 무기 수치만 바꾸면 진화 무기는 예전 값으로 남는다(지금 값은 같다) · 고칠 안: `WEAPONS.staff.getHalfWidth(w) * 2`처럼 기본 무기를 불러 쓴다 [높음]

26. `js/11-meta-save.js:185`, `js/07-update.js:878` · 부활할 수 있는지 보는 조건이 두 곳에 똑같이 있다. 한쪽만 바꾸면 '부활' 기록과 실제 부활이 어긋난다 · 고칠 안: `canRevive()` 하나로 합친다 [높음]

27. `js/06-spawn-combat.js:72`, `js/07-update.js:119` vs `js/06-spawn-combat.js:38-39` · 몬스터 단계가 몇 바퀴째인지를 한쪽은 `ENEMY_TYPES.length`로, 다른 쪽은 `enemyTypes().length`로 센다 · 재현: 지금은 둘 다 5라 같다. 테마 적 수가 달라지면 두 바퀴째 경험치 배수와 '더 강해진 적' 안내가 어긋난다 · 고칠 안: `enemyTypes().length` 하나로 맞춘다 [중간]

28. `js/07-update.js:563` → `js/06-spawn-combat.js:22` · `splitPack`이 `enemies`를 `for…of`로 도는 중에 바로 `push`한다. `:646` 주석의 원칙('도는 중일 수 있어서 pendingSpawns에 모아 둠')과 다르다. 새 개 2마리가 같은 프레임에 한 번 더 움직인다 · 고칠 안: `pendingSpawns`에 넣는다 [중간]

29. `js/08-draw.js:719-723` · 상자 화살표가 피할 영역을 `drawOwnedList`(`:691-693`)와 따로 상수로 계산한다. `? 버튼` 영역에는 `canvasUi.scale`을 곱하지 않는다 · 고칠 안: 슬롯 크기·간격 상수를 하나로 빼서 같이 쓴다 [낮음]

## 4. 주석·문서와 코드가 다른 곳

30. `js/11-meta-save.js:74` · '보상: weapon / char / gold'에 shop·passive가 빠져 있다(README 28행은 이번에 고침).
31. `js/06-spawn-combat.js:222` · '시간·레벨 보정 없이 고정 능력치'라고 쓰여 있지만, `:233`은 `BOSS_HP_PER_LEVEL * player.level`을 더한다.
32. `js/04-passives-enemies.js:206` · `BOSS_PATTERNS[1..3]`("fan"·"ring"·"spiral")은 쓰이지 않는다. tier 1~3은 테마 보스가 각자 패턴을 쓴다.
33. `js/03-weapons.js:276` · 화염병 주석은 'Lv3·5·7 병 +1'인데, 코드(`:285`)와 설명문은 Lv4·7이다. `:593` 운석 주석에는 Lv6~8 몫이 빠져 있다.
34. `js/02-rules.js:16-17` · '두 마리씩 나올 확률이 천천히 올라감'이라고 쓰여 있지만, 실제로는 5분마다 +1마리씩 최대 5마리까지 늘어난다(`:21`, `js/07-update.js:103-104`가 맞다).
35. `js/05-state-input.js:27` · state 값 목록에 "paused"가 없다.
36. `js/11-meta-save.js:4` · '몬스터·탄환은 저장하지 않음'이라고 쓰여 있지만, `saveRun`(`:408`)은 적·적 탄환·상자를 저장한다(`:393` 주석이 맞다).
37. `js/11-meta-save.js:41`, `:356` · '상점 전체 6000'은 SHOP 표로 계산한 값과 다르다(1.5배속을 빼면 7560).
38. `js/11-meta-save.js:90` · '위 13개'라고 쓰여 있지만 76~89행의 퀘스트는 14개다.
39. `js/10-title.js:4`, `:12` · '기사가 한가운데'라고 쓰여 있지만 실제로는 고른 캐릭터를 그린다. '16px로 찍고'라고 쓰여 있지만 `TITLE_FONT_PX`는 20이다.
40. `js/09-loop-windows.js:75` · '번개 오라는 그림 파일이 없어서 SVG로'라고 쓰여 있지만, aura에도 `icon: "w_aura"`가 있다.
41. `js/08-draw.js:575` · '서리 망령의 얼음 화살'이라고 쓰여 있지만, 적 탄환은 보스 표창(`js/07-update.js:473`)과 예티 파편(`:431`)뿐이다.
42. `js/03-weapons.js:871-872` · 별의 심판 설명은 '지운 적의 구슬이 빨려옴'인데, 코드는 맵의 모든 구슬에 magnet을 켠다(어느 쪽이 의도인지 모름).
43. `README.md` 폴더 표 · `tests/`를 '자동 플레이 시험'이라고만 적었다. 지금은 `tests/unit` 단위 시험도 있다.

## 5. 시험 쪽에서 본 것

- `tests/unit/upgrades-items.test.ts:15` · `not.toContain("새 무기: 창")`이었는데 실제 이름은 '관통 창'이어서 늘 통과했다. 이번에 '관통 창'으로 고쳤다.
- 확실도가 낮아 본문에서 뺀 것: `js/12-sound.js:35-41`의 `WEAPON_SFX`에 orb·shield·shadow가 없어 그 무기는 소리가 없다(일부러 뺐을 수 있음). `js/08-draw.js:864`의 `!e.wakeTimer`는 깨어난 뒤 음수가 남으면 false가 된다(지금은 해당 그림이 없어 드러나지 않음). `js/08-draw.js:381`, `:507`의 화면 전체 섬광이 흔들림 오프셋을 빼지 않아 가장자리에 1~3px 띠가 남을 수 있다.

## 6. 자동 플레이 기준 기록 armorer-3 (git bisect)

(아래에 채움)
