# 캐릭터 컷신 스토리보드

- 견습 마법사: 게임을 처음 시작할 때 (5장)
- 사냥꾼·광전사: 캐릭터를 산 직후 (4장씩)
- 성녀·무기상: 캐릭터를 산 직후 (5장씩)
- 매우 어려움 클리어 엔딩: 캐릭터마다 1장 (그 캐릭터로 매우 어려움을 처음 깼을 때)
- 게임 중에는 대사를 넣지 않는다. 글은 컷신 자막에만 쓴다.
- 말투: 담담하게 말하다가 끝에서 비튼다. 헛소리는 진지한 얼굴로.

## GPT에 맡기는 방법

1. 새 대화에 아래 '공통 스타일'을 먼저 붙여 넣는다.
2. 그 캐릭터의 게임 그림을 첨부한다: `assets/hero_mage.png`, `hero_hunter.png`, `hero_berserker.png`, `hero_saint.png`, `hero_armorer.png`.
3. 장면 지시문을 한 장씩 보낸다. 같은 캐릭터 컷신은 한 대화에서 이어서 만들어야 얼굴이 같게 나온다.
4. 자막은 그림에 넣지 않는다. 게임이 그림 아래에 따로 띄운다.

저장 이름: `assets/story/<캐릭터>_<번호>.webp` (예: `assets/story/mage_1.webp`, `assets/story/hunter_end.webp`) — PNG 원본은 `cwebp -q 82` 로 변환

## 공통 스타일 (GPT에 먼저 보낼 것)

```
You will draw a series of cutscene illustrations for a comedic pixel-art roguelike survival game.
Style rules for every image:
- 16-bit pixel art, chunky visible pixels, clean 1-pixel dark outlines (dark plum #3b2027), limited palette.
- Palette close to the attached character sprite: warm skin tones, teal/green, purple, rust brown, steel grey, deep navy and dark plum backgrounds.
- The main character must match the attached sprite exactly (same outfit, colors, hair, beard, helmet).
- Landscape 1536x1024. Keep the important action inside the middle 16:9 area so it can be cropped.
- Gag comic tone: exaggerated expressions, deadpan faces in absurd situations, comedic timing. Not grim, not gory.
- NO text, NO letters, NO numbers, NO speech bubbles, NO UI anywhere in the image. Signs, papers and screens must be blank or use simple symbols only.
- One clear moment per image, simple readable composition.
Reply "ready" and wait for each scene.
```

## 캐릭터 생김새 (게임 그림 기준)

| 캐릭터 | 생김새 |
|---|---|
| 견습 마법사 | 흰 긴 수염 할아버지. 초록 고깔모자에 청록 띠, 초록 로브 |
| 사냥꾼 | 갈색 머리에 청록 머리띠, 갈색 수염, 초록 웃옷 |
| 광전사 | 뿔 달린 은색 투구, 주황빛 콧수염, 은색 갑옷 |
| 성녀 | 긴 적갈색 머리에 꽃 장식, 보라색 드레스 |
| 무기상 | 긴 회색 머리, 갈색 가죽 앞치마 |

---

## 견습 마법사 · 게임 첫 시작 (5장)

| # | 자막 | 장면 |
|---|---|---|
| 1 | 마법 학원 졸업 39년 11개월 차. 연금까지 딱 한 달 남았어요. 졸업장은 거실 벽, 가훈 옆에 걸려 있었지요. 가훈은 "40년 일하면 400년 논다". | 거실 벽에 액자 두 개. 하나는 졸업장, 하나는 가훈 액자. 할아버지 마법사가 달력 날짜에 X를 하나씩 그으며 싱글벙글한다. 한 달 뒤 연금날에는 금화 모양 동그라미. 구석에는 벌써 사 둔 해먹, 낚싯대, 여행 가방 |
| 2 | 어느 밤, 박쥐가 졸업장을 물고 갔어요. 가훈은 두고 갔지요. | 박쥐가 졸업장을 물고 창밖으로 날아간다. 가훈 액자는 멀쩡히 남아 있다. 마법사는 잠옷 차림으로 입을 벌린다 |
| 3 | 다음날 학회에서 통보가 왔어요. "졸업장 미소지 상태로 7일 경과 시, 근속 기간이 초기화됩니다." "39년 11개월 마법 썼는데요." "다시 40년 채우시면 됩니다. 백스물두 살에 뵙겠습니다." | 마법 학회 창구. 무표정한 접수원이 빨간 도장이 찍힌 통보서를 내밀고 도장을 쾅 찍는다. 마법사가 창구에 매달려 항의한다 |
| 4 | 재발급 수수료는 금화 3억. 박쥐 잡는 게 더 쌌어요. | 접수원이 내민 종이 위로 금화 산이 하늘까지 쌓여 있는 그림. 마법사가 그걸 올려다보며 얼어붙는다 |
| 5 | 여든두 살 견습 마법사는 남은 6일을 들고 던전으로 출근했답니다. | 던전 입구. 마법사가 도시락 가방과 날짜 여섯 칸 남은 달력을 들고, 마법봉을 옆구리에 낀 채 출근하듯 걸어 들어간다. 어둠 속에 빨간 눈이 가득하다 |

```
Scene 1: A cozy living room. On the wall hang two frames side by side: a blank diploma with a red ribbon seal, and a family motto frame (blank). The old wizard (white long beard, green pointed hat with teal band, green robe) happily crosses off days on a wall calendar with big X marks, grinning like a kid before vacation. One day near the end of the month is circled with a gold coin symbol. In the corner, retirement gear already bought and waiting: a rolled-up hammock, a fishing rod, a packed travel suitcase.
```
```
Scene 2: Night. A small brown bat flies out through the window carrying the diploma in its mouth. The motto frame is left untouched on the wall next to an empty frame. The old wizard in pajamas and nightcap stares with his mouth wide open.
```
```
Scene 3: A stuffy magic guild reception desk with towering paper stacks. A bored, expressionless clerk pushes forward an official notice with a big red seal (blank paper, no letters) and slams a rubber stamp (simple circle mark). The old wizard clings to the edge of the desk, protesting dramatically.
```
```
Scene 4: The clerk holds up a paper. Above it, a cartoon thought-image of a gold coin pile so tall it reaches the clouds. The old wizard looks up at it, frozen, his beard standing on end.
```
```
Scene 5: The dark stone entrance of a dungeon. The old wizard walks in like a commuter going to work: lunch box in one hand, a small tear-off calendar with six blank pages left in the other, magic wand tucked under his arm, calm resigned face. Inside the darkness dozens of red monster eyes glow.
```

## 사냥꾼 · 캐릭터를 산 직후 (4장)

| # | 자막 | 장면 |
|---|---|---|
| 1 | 도시에서 영업만 12년. 눈치 보면서 싹싹 비는 건 이제 그만하고 싶어요. 어느 날 사표를 내고 귀농했지요. | 영업 사무실. 넥타이를 맨 사냥꾼이 처음으로 허리를 쫙 펴고 부장 책상에 사표 봉투를 탁 내려놓는다. 바닥에는 12년 동안 고개 숙여 인사한 자리만 반질반질 닳아 있다 |
| 2 | 귀농 사흘 만에 깨달았어요. 농사는 몸도 아프고 실적도 안 나와요. 사냥이 더 쉬워 보였지요. | 시든 밭 한가운데서 허리를 붙잡고 괭이를 든 사냥꾼. 싹 하나 안 난 밭. 옆으로 토끼가 여유롭게 지나간다. 사냥꾼의 눈이 토끼를 따라간다 |
| 3 | 문제는 월세였어요. 집주인이 사흘을 걸어와서 말했지요. "이번 달까지 안 내면 법적 조치 들어갑니다. 밀린 3개월치 전부 내세요." | 오두막 문 앞에 지쳐 쓰러지기 직전인 집주인이 지팡이를 짚고 빨간 도장이 찍힌 통지서를 내민다. 신발은 해져 있다. 사냥꾼은 문틈으로 얼굴만 내민다 |
| 4 | 활은 할부 심사에서 떨어졌어요. 신용 등급이 '귀농인'으로 내려가 있었거든요. 단검을 들고 던전에 들어갔어요. 월세 마감까지 19일. 몬스터로 채우기로 했답니다. | 던전 입구. 사냥꾼이 작은 단검 한 자루를 들고 결연하게 들어간다. 다른 손에는 큰 X가 찍힌 할부 거절 종이가 구겨져 있다. 어둠 속 몬스터들이 사냥꾼 눈에는 금화로 보인다 |

```
Scene 1: A city sales office. The hunter (brown hair, teal headband, brown beard, green tunic) wears an office necktie over his tunic. For the first time he stands perfectly straight and slaps a resignation envelope (blank) onto the boss's desk. On the floor in front of the desk, a shiny worn-out spot from twelve years of deep apologetic bowing. The boss stares, stunned.
```
```
Scene 2: A sad withered crop field on a sunny day, not a single sprout. The hunter holds a hoe with one hand and his aching lower back with the other, sweating. A rabbit hops casually past him. His eyes follow the rabbit, a new idea forming.
```
```
Scene 3: The hunter's countryside cabin. An exhausted elderly landlord with a walking stick and worn-out shoes stands at the door holding out an official notice with a red stamp mark (blank paper, no letters). The hunter peeks out through a narrow door gap, only his face visible, sweating.
```
```
Scene 4: The dark stone entrance of a dungeon. The hunter walks in with grim determination holding one small plain dagger. In his other hand, a crumpled rejected loan paper marked with a big red X (no letters). Inside the darkness, the monsters' silhouettes appear as gold coin shapes in his eyes.
```

## 광전사 · 캐릭터를 산 직후 (4장)

| # | 자막 | 장면 |
|---|---|---|
| 1 | 툭하면 버럭. 어느 날 사냥꾼 친구가 찾아왔어요. | 광전사의 집. 벽에 주먹 자국, 반쪽 난 식탁, 다리 하나 없는 의자. 광전사가 문을 열자 반창고를 붙이고 옷이 조금 찢어진 사냥꾼 친구가 멋쩍게 손을 흔든다. 손에는 작은 선물 자루 |
| 2 | 친구가 입만 열었어요. "야 나 어제 던전 가서—" 광전사는 그 뒤로 들은 게 없었지요. | 식탁에 마주 앉은 둘. 사냥꾼은 신나게 손짓하며 말하고 있다. 광전사의 눈은 하얗게 비어 있고 귀에서 김이 새기 시작한다 |
| 3 | 내 친구를 이렇게 만든 던전은 용서할 수 없어요. | 광전사가 벌떡 일어나며 의자가 뒤로 날아간다. 투구에서 빨간 김이 뿜어져 나온다. 사냥꾼은 말하던 손 모양 그대로 굳어 있다 |
| 4 | 다음 날 그는 혼자 던전 입구에 서 있었어요. 무기는 반려 검. | 새벽 던전 입구. 광전사가 리본 달린 목줄을 맨 검을 반려동물처럼 품에 안고 서 있다. 눈은 이글이글, 투구에서 빨간 김이 계속 뿜어져 나온다 |

```
Scene 1: The berserker's house, clearly owned by someone with anger issues: fist dents in the walls, a table broken in half, a chair missing one leg. The berserker (horned silver helmet, orange mustache, silver armor) opens the front door. Outside stands his friend the hunter (brown hair, teal headband, brown beard, green tunic) looking a bit rough: a bandage on his cheek, a slightly torn tunic, waving sheepishly, holding a small gift sack.
```
```
Scene 2: The two sit facing each other at a patched-up table. The hunter is talking excitedly with big hand gestures. The berserker's eyes have gone completely blank white, and thin steam starts leaking from the ear holes of his helmet.
```
```
Scene 3: The berserker shoots up from his seat, the chair flying backward behind him. Red steam blasts out of his helmet. The hunter is frozen mid-gesture with his mouth still open.
```
```
Scene 4: Dawn at the dark stone entrance of a dungeon. The berserker stands alone, hugging his sword like a beloved pet: the sword wears a little collar with a ribbon. His eyes blaze, red steam keeps pouring out of his helmet.
```

## 성녀 · 캐릭터를 산 직후 (5장)

| # | 자막 | 장면 |
|---|---|---|
| 1 | 협회에서 편지가 왔어요. 빨간 도장이 무려 세 개!<br>"이 정도면 공식적으로 인정받은 거네." | 집배원이 빨간 도장 세 개가 찍힌 봉투를 건넨다. 집배원은 눈을 피한다. 성녀는 봉투를 받아 들고 감동한 얼굴로 반짝인다 |
| 2 | 뜯어 볼 필요도 없었어요. 도장이 세 개나 있으니까요. | 성녀가 뜯지 않은 봉투를 금빛 액자에 넣어 거실 한가운데 벽에 걸고 뿌듯하게 바라본다. 액자 위에 작은 조명까지 달았다 |
| 3 | 열흘 뒤, 두 번째 편지가 왔어요.<br>"성녀 협회 영구 제명 예정. 9일 내 소명 자료 미제출 시 즉시 제명 처리." | 같은 집배원이 이번엔 빨간 도장이 잔뜩 찍힌 두 번째 봉투를 멀찍이서 막대기 끝에 매달아 내민다. 성녀가 펼친 편지를 읽는다 |
| 4 | 성녀는 곰곰이 생각했어요.<br>"제명까지 하겠다니… 나 없으면 협회가 안 돌아간다는 뜻이구나!" | 성녀가 편지를 든 채 눈을 감고 진지하게 고개를 끄덕인다 |
| 5 | 그래서 던전 정화 순례를 떠났어요. 더 큰 인정을 받으러요.<br>첫 번째 편지는 여전히 안 뜯은 채로요. | 순례 짐을 메고 집을 나서는 성녀. 벽에는 뜯지 않은 첫 번째 편지가 든 액자가 그대로 걸려 있다. 열린 문 너머로 던전 입구가 보인다 |

```
Scene 1: In front of a white stone temple. A nervous mail carrier hands the saint (long auburn hair with a flower ornament, purple dress) an envelope with three big red stamp marks (no letters), avoiding eye contact. The saint receives it with sparkling, deeply moved eyes, as if it were an award.
```
```
Scene 2: The saint's living room. She proudly hangs a fancy gold picture frame on the most visible central wall. Inside the frame is the unopened sealed envelope with three red stamp marks. A small spotlight lamp is mounted above the frame. She admires it with a satisfied smile.
```
```
Scene 3: The same nervous mail carrier, standing as far away as possible, holds out a second envelope covered in many red stamp marks dangling from the end of a long stick. The saint reads the unfolded letter (blank paper, no letters).
```
```
Scene 4: The saint holds the letter, eyes closed, nodding seriously with total confidence.
```
```
Scene 5: The saint leaves her house with a pilgrim's pack and staff, ready for a journey. On the wall behind her, the framed, still-unopened first envelope hangs as before. Through the open door, a dark dungeon entrance is visible in the distance.
```

## 무기상 · 캐릭터를 산 직후 (5장)

| # | 자막 | 장면 |
|---|---|---|
| 1 | 무기점 개업 30년. | 먼지 쌓인 무기점. 문이 열리고 종이 울리자 무기상이 두 팔을 벌리고 반갑게 뛰어나간다. 도시락 가방을 든 견습 마법사가 들어오는 중 |
| 2 | 마지막 손님은 길을 묻던 사람이었어요. | 같은 가게. 마법사가 지도를 펼쳐 던전 쪽을 가리키며 길을 묻는다. 무기상은 팔을 벌린 채 굳어 웃음이 무너진다 |
| 3 | 재고는 장검부터 운석까지 스무 가지가 넘어요. 없는 게 없어요. 팔린 것도 없어요. 창고 임대료가 무기 값보다 비싸요. | 천장까지 쌓인 온갖 무기 더미. 장검, 단검, 회전 도끼, 창, 망치, 방패, 마법봉, 지팡이, 마법 구슬, 폭탄, 화염병, 번개 병, 얼음 수정, 뼈, 발톱 장갑이 뒤섞여 있고, 꼭대기에 운석 하나가 박혀 연기를 피운다. 무기상은 그 아래서 바닥까지 늘어진 임대료 청구서를 들고 있다 |
| 4 | 은행에서 최종 통보가 왔어요. "이번 달 이자까지 못 내면 가게 압류합니다." | 가게 문 앞에 무표정한 은행원이 빨간 도장이 찍힌 통보서를 내민다. 뒤에는 압류 딱지 뭉치를 든 직원 둘. 무기상은 카운터를 끌어안고 있다 |
| 5 | 던전 입구에서 방송을 켰어요.<br>"자 왔습니다. 오늘이 진짜 마지막일 수도 있어요.<br>이 검, 3년 동안 단 한 명도 안 사 가서 제가 던전에서 직접 테스트합니다.<br>성능 구리면 여기서 그냥 죽을게요.<br>구매 링크는 고정 댓글."<br>시청자 0명이어도 상관없어요. 어차피 내일 문 닫을 수도 있거든요. | 던전 입구. 막대기에 꽂은 수정 구슬(방송 장비)을 향해 무기상이 검을 들어 보이며 쇼호스트처럼 열정적으로 말한다. 수정 구슬 옆 시청자 표시는 텅 빈 눈 모양. 어둠 속에서 몬스터들이 구경한다 |

```
Scene 1: A dusty weapon shop. The door opens and the bell rings. The armorer (long grey hair, brown leather apron) rushes out excitedly with his arms open to welcome a visitor. The old apprentice wizard (white long beard, green pointed hat with teal band, green robe) is entering with a lunch box.
```
```
Scene 2: The same weapon shop, with the same furniture layout and characters as Scene 1. The old apprentice wizard unfolds a map and points toward the dungeon, asking for directions. The armorer freezes with his arms still open, his welcoming smile collapsing in disappointment.
```
```
Scene 3: A cramped warehouse packed to the ceiling with every kind of weapon imaginable, all mixed in one chaotic pile: long swords, daggers, spinning axes, spears, throwing hammers, round shields, magic wands, wizard staffs, fire staffs, glowing magic orbs, round bombs, fire bottles, glass jars crackling with lightning, ice crystals, bones, claw gauntlets. Show as many different weapon types as possible, no two alike. At the very top, a smoking meteor rock is stuck in the pile. Below, the armorer holds a rent bill so long it unrolls all the way across the floor (blank paper, no letters), staring at it blankly.
```
```
Scene 4: The front door of the weapon shop. An expressionless banker in a dark suit holds out an official notice with a big red stamp mark (blank paper, no letters). Behind him two assistants carry stacks of blank seizure stickers. The armorer hugs his shop counter desperately.
```
```
Scene 5: The dark stone entrance of a dungeon. The armorer holds up a sword toward a crystal ball mounted on a stick (a fantasy livestream camera), talking passionately like a home-shopping host. Next to the crystal ball floats a small viewer icon: an empty eye symbol, no numbers. In the darkness, monsters peek out, curiously watching the show.
```

---

## 매우 어려움 클리어 엔딩 (캐릭터마다 1장, 그 캐릭터로 매우 어려움을 처음 깼을 때)

| 캐릭터 | 자막 | 장면 |
|---|---|---|
| 견습 마법사 | 졸업장을 되찾았어요. 한 달 뒤, 첫 연금이 들어왔지요.<br>이제 가훈대로 400년 놀 거예요.<br>졸업장은 금고에 넣었답니다. | 햇살 좋은 마당. 해먹에 누워 낚싯대를 드리운 마법사. 옆에는 거대한 금고가 사슬과 자물쇠로 꽁꽁 묶여 있다. 박쥐가 금고 위에 거꾸로 매달려 아쉬운 눈으로 본다 |
| 사냥꾼 | 월세를 내고도 몬스터 고기가 잔뜩 남아서 고깃집을 차렸어요.<br>한 번 먹은 손님은 끊지를 못해요. 오늘도 오고, 내일도 와요.<br>집주인도 고기 먹으러 오늘도 사흘을 걸어왔답니다. | 손님으로 꽉 찬 몬스터 고깃집. 앞치마를 두른 사냥꾼이 카운터에 발을 올리고 기대앉아 꼬치를 흔든다. 소용돌이 눈으로 침을 흘리며 빈 접시를 들고 매달리는 손님들, 문밖까지 늘어선 줄. 구석의 집주인도 고기를 끌어안고 침을 흘린다 |
| 광전사 | 던전을 끝까지 쓸어버리고 돌아왔어요. 친구가 그제야 말을 끝냈지요.<br>"…던전 가서 고기 잔뜩 잡았거든. 같이 먹자고."<br>반려 검은 조용히 칼집으로 들어갔답니다. | 사냥꾼 친구의 집 식탁. 친구가 그때 들고 왔던 선물 자루를 열어 고기를 가득 꺼내 보이며 웃는다. 광전사는 먼지와 그을음을 뒤집어쓴 채 굳어 있고, 품속의 검은 칼집으로 슬그머니 들어간다 |
| 성녀 | 협회에서 세 번째 편지가 왔어요. 이번엔 금색 도장이었지요.<br>"던전 정화 공로로 제명 취소."<br>이제 제명할 가치도 없는 사람이 됐다는 뜻으로 해석했어요.<br>빨간 도장 세 개 받던 시절이 좋았답니다. | 성녀 거실(saint_5와 같은 방, 빨간 도장 액자 하나). 성녀가 금색 도장 편지를 펼쳐 들고 울상이 되어 눈물을 흘린다. 문 앞의 집배원은 이마를 짚는다 |
| 무기상 | 시청자가 처음으로 천 명을 넘었어요. 30년 장사 인생 최고의 날이었지요.<br>"자, 바로 이 검으로 보스를—" 그 순간 방송이 끊겼어요. 사유: 폭력적인 콘텐츠.<br>칼 파는 방송에서 칼을 쓰면 안 되는 줄은 몰랐답니다. | 보스를 쓰러뜨린 던전. 무기상이 수정 구슬 방송 앞에서 쇼호스트처럼 검을 들어 올리지만, 구슬 화면엔 빨간 금지 표시만 남고 시청자 눈 아이콘들이 비눗방울처럼 터져 사라진다. 무기상은 웃는 얼굴 그대로 굳어 있다 |

```
Ending (mage): A sunny backyard. The old wizard (white long beard, green pointed hat with teal band, green robe) lies in a hammock with a fishing rod, totally relaxed, eyes half closed. Next to him stands a huge iron safe wrapped in chains and padlocks. The small brown bat hangs upside down from the top of the safe, staring at it longingly.
```
```
Ending (hunter): A packed monster-meat restaurant. The hunter in an apron leans back with his feet on the counter, lazily waving a skewer. Customers with swirly eyes drool and cling with empty plates, a line stretches out the door, and in the corner the landlord hugs a piece of meat, drooling too.
```
```
Ending (berserker): The hunter's kitchen table. The hunter cheerfully opens the same small gift sack from before, pulling out a huge pile of meat to share, smiling. The berserker (horned silver helmet, orange mustache, silver armor) stands frozen, covered in dungeon dust and soot, and the sword he is hugging slowly slides back into its sheath by itself.
```
```
Ending (saint): The saint's living room (same room as saint_5, one frame with three red seals). The saint holds the gold-sealed letter open in both hands, comically sad with teary eyes. At the door, the mail carrier facepalms.
```
```
Ending (armorer): The dungeon right after the boss falls. The armorer raises a sword like a home-shopping host in front of his crystal-ball livestream, but the ball shows only a red prohibition sign and the floating viewer-eye icons pop like soap bubbles. He freezes with his smile still on.
```

## 나중에 게임에 넣을 때 정할 것

- 컷신 재생 방식: 그림 한 장 + 자막, 누르면 다음 장, 건너뛰기 버튼.
- 견습 마법사 컷신: 처음 시작할 때 한 번만. 다시 보기 버튼이 필요한지.
- 구매 컷신: 상점에서 캐릭터를 산 직후 한 번. 다시 보기를 어디서 할지.
- 매우 어려움 클리어 엔딩: 그 캐릭터로 매우 어려움을 처음 깼을 때.
