// 확정 원문: docs/story/cutscene-storyboard.md. 게임 중에는 재생하지 않는다.
const STORIES = {
  "knight": [
    {
      "art": "mage_1",
      "text": "마법 학원 졸업 39년 11개월 차. 연금까지 딱 한 달 남았어요. 졸업장은 거실 벽, 가훈 옆에 걸려 있었지요. 가훈은 \"40년 일하면 400년 논다\"."
    },
    {
      "art": "mage_2",
      "text": "어느 밤, 박쥐가 졸업장을 물고 갔어요. 가훈은 두고 갔지요."
    },
    {
      "art": "mage_3",
      "text": "다음날 학회에서 통보가 왔어요. \"졸업장 미소지 상태로 7일 경과 시, 근속 기간이 초기화됩니다.\" \"39년 11개월 마법 썼는데요.\" \"다시 40년 채우시면 됩니다. 백스물두 살에 뵙겠습니다.\""
    },
    {
      "art": "mage_4",
      "text": "재발급 수수료는 금화 3억. 박쥐 잡는 게 더 쌌어요."
    },
    {
      "art": "mage_5",
      "text": "여든두 살 견습 마법사는 남은 6일을 들고 던전으로 출근했답니다."
    }
  ],
  "hunter": [
    {
      "art": "hunter_1",
      "text": "도시에서 영업만 12년. 눈치 보면서 싹싹 비는 건 이제 그만하고 싶어요. 어느 날 사표를 내고 귀농했지요."
    },
    {
      "art": "hunter_2",
      "text": "귀농 사흘 만에 깨달았어요. 농사는 몸도 아프고 실적도 안 나와요. 사냥이 더 쉬워 보였지요."
    },
    {
      "art": "hunter_3",
      "text": "문제는 월세였어요. 집주인이 사흘을 걸어와서 말했지요. \"이번 달까지 안 내면 법적 조치 들어갑니다. 밀린 3개월치 전부 내세요.\""
    },
    {
      "art": "hunter_4",
      "text": "활은 할부 심사에서 떨어졌어요. 신용 등급이 '귀농인'으로 내려가 있었거든요. 단검을 들고 던전에 들어갔어요. 월세 마감까지 19일. 몬스터로 채우기로 했답니다."
    }
  ],
  "berserker": [
    {
      "art": "berserker_1",
      "text": "툭하면 버럭. 어느 날 사냥꾼 친구가 찾아왔어요."
    },
    {
      "art": "berserker_2",
      "text": "친구가 입만 열었어요. \"야 나 어제 던전 가서—\" 광전사는 그 뒤로 들은 게 없었지요."
    },
    {
      "art": "berserker_3",
      "text": "내 친구를 이렇게 만든 던전은 용서할 수 없어요."
    },
    {
      "art": "berserker_4",
      "text": "다음 날 그는 혼자 던전 입구에 서 있었어요. 무기는 반려 검."
    }
  ],
  "saint": [
    {
      "art": "saint_1",
      "text": "협회에서 편지가 왔어요. 빨간 도장이 무려 세 개!\n\"이 정도면 공식적으로 인정받은 거네.\""
    },
    {
      "art": "saint_2",
      "text": "뜯어 볼 필요도 없었어요. 도장이 세 개나 있으니까요."
    },
    {
      "art": "saint_3",
      "text": "열흘 뒤, 두 번째 편지가 왔어요.\n\"성녀 협회 영구 제명 예정. 9일 내 소명 자료 미제출 시 즉시 제명 처리.\""
    },
    {
      "art": "saint_4",
      "text": "성녀는 곰곰이 생각했어요.\n\"제명까지 하겠다니… 나 없으면 협회가 안 돌아간다는 뜻이구나!\""
    },
    {
      "art": "saint_5",
      "text": "그래서 던전 정화 순례를 떠났어요. 더 큰 인정을 받으러요.\n첫 번째 편지는 여전히 안 뜯은 채로요."
    }
  ],
  "armorer": [
    {
      "art": "armorer_1",
      "text": "무기점 개업 30년."
    },
    {
      "art": "armorer_2",
      "text": "마지막 손님은 길을 묻던 사람이었어요."
    },
    {
      "art": "armorer_3",
      "text": "재고는 장검부터 운석까지 스무 가지가 넘어요. 없는 게 없어요. 팔린 것도 없어요. 창고 임대료가 무기 값보다 비싸요."
    },
    {
      "art": "armorer_4",
      "text": "은행에서 최종 통보가 왔어요. \"이번 달 이자까지 못 내면 가게 압류합니다.\""
    },
    {
      "art": "armorer_5",
      "text": "던전 입구에서 방송을 켰어요.\n\"자 왔습니다. 오늘이 진짜 마지막일 수도 있어요.\n이 검, 3년 동안 단 한 명도 안 사 가서 제가 던전에서 직접 테스트합니다.\n성능 구리면 여기서 그냥 죽을게요.\n구매 링크는 고정 댓글.\"\n시청자 0명이어도 상관없어요. 어차피 내일 문 닫을 수도 있거든요."
    }
  ]
};
const STORY_LOCK = 0.2;   // 한 번의 입력으로 두 컷이 넘어가지 않게
let storyScene = null;
// 그림을 못 받은 컷이 있으면 본 것으로 치지 않음 (다음 시작 때 다시 보여 줌). 그림을 다 받기 전에 넘긴 것은 본 것으로 침
endingImg.addEventListener("error", () => { if (storyScene) storyScene.seenAll = false; });

function showStory(char, onEnd = () => {}) {
  storyScene = { char, frames: STORIES[char], index: 0, seenAll: true, returnState: state, onEnd };
  state = "story";
  endJoystick();
  for (const key in keys) keys[key] = false;
  endingBox.classList.add("story");
  loadEnding(storyScene.frames[0]);
  showEnding();
}

function advanceStory() {
  storyScene.index += 1;
  if (storyScene.index < storyScene.frames.length) {
    loadEnding(storyScene.frames[storyScene.index]);
    endingShownAt = performance.now();
    return;
  }
  const finished = storyScene;
  storyScene = null;
  endingBox.classList.remove("show", "story");
  if (finished.seenAll) {
    meta.stats.mask_story |= 1 << Object.keys(CHARACTERS).indexOf(finished.char);
    saveMeta();
  }
  state = finished.returnState;
  finished.onEnd();
  if (state === "title" || state === "intro") {
    titleLastTime = null;
    requestAnimationFrame(titleLoop);
    (state === "intro" ? document.getElementById("metaClose") : startBtn).focus();
  }
}
