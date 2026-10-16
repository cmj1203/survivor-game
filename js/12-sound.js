// =====================================================================
// 15-4. 소리: 배경 음악(작게)과 효과음. Web Audio 로 재생 (효과음이 많이 겹쳐도 가볍게)
//   - 휴대폰·브라우저는 화면을 한 번 누르거나 키를 누르기 전에는 소리를 못 냄 → 첫 입력 때 소리 장치를 켬
//   - 소리 켜기/끄기: 왼쪽 위 스피커 버튼 또는 M 키. 설정은 저장됨
//   - 음악·효과음: Juhani Junkala (CC0, OpenGameArt). 출처는 assets/LICENSE.txt
// =====================================================================
const MUSIC_VOLUME = 0.18;   // 배경 음악 크기 (사용자 요청: 작게). 효과음보다 확실히 작게
const SFX_VOLUME = 0.2;      // 효과음 전체 크기 (사용자 요청: 배경 음악만큼 작게)
const SOUND_KEY = "dungeon-survivor-sound";
// 효과음 목록. gap = 같은 소리를 다시 낼 수 있는 최소 간격(초): 너무 자주 나는 소리(타격·구슬)가 시끄럽지 않게
//              vol = 소리마다 크기 (SFX_VOLUME 에 곱함)
const SFX = {
  hit:       { gap: 0.08, vol: 0.25 },
  kill:      { gap: 0.06, vol: 0.4 },
  gem:       { gap: 0.05, vol: 0.3 },
  levelup:   { gap: 0.3,  vol: 0.8 },
  chest:     { gap: 0.3,  vol: 0.8 },
  evolve:    { gap: 0.3,  vol: 0.9 },
  item:      { gap: 0.2,  vol: 0.7 },
  hurt:      { gap: 0.3,  vol: 0.6 },
  gameover:  { gap: 1,    vol: 0.8 },
  explode:   { gap: 0.15, vol: 0.6 },
  button:    { gap: 0.05, vol: 0.5 },
  pause_in:  { gap: 0.1,  vol: 0.6 },
  pause_out: { gap: 0.1,  vol: 0.6 },
  quest:     { gap: 0.5,  vol: 0.8 },
};
let soundOn = true;
try { soundOn = localStorage.getItem(SOUND_KEY) !== "0"; } catch {}
let audioCtx = null, masterGain = null, musicGain = null, sfxGain = null;
const audioBuffers = {};     // 파일 이름 → 풀어 둔 소리
const audioLoading = {};     // 파일 이름 → 불러오는 중인 약속(Promise)
const sfxLastAt = {};        // 효과음 이름 → 마지막으로 낸 시각
let musicSource = null;      // 지금 나오는 배경 음악
let musicNow = null;         // 지금 틀기로 한 곡 이름
let musicWant = null;        // 틀어야 할 곡 이름 (소리 장치가 켜지기 전에도 기억)

function loadSound(name) {
  if (!audioLoading[name]) {
    audioLoading[name] = fetch(`assets/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((b) => audioCtx.decodeAudioData(b))
      .then((buf) => { audioBuffers[name] = buf; return buf; })
      .catch(() => null);                 // 파일이 없거나 못 풀어도 게임은 계속
  }
  return audioLoading[name];
}

// 첫 클릭·터치·키 입력 때 소리 장치를 켬 (이미 켜져 있으면, 멈춰 있을 때 다시 깨움)
function unlockAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;                      // 소리를 못 내는 브라우저: 조용히 넘어감
    audioCtx = new AC();
    masterGain = audioCtx.createGain(); masterGain.gain.value = soundOn ? 1 : 0; masterGain.connect(audioCtx.destination);
    musicGain = audioCtx.createGain(); musicGain.gain.value = MUSIC_VOLUME; musicGain.connect(masterGain);
    sfxGain = audioCtx.createGain(); sfxGain.gain.value = SFX_VOLUME; sfxGain.connect(masterGain);
    for (const k in SFX) loadSound(`sfx_${k}`);
    const want = musicWant; musicNow = null;
    if (want) setMusic(want);
  }
  if (audioCtx.state === "suspended" && document.visibilityState === "visible") audioCtx.resume().catch(() => {});
}
for (const ev of ["pointerdown", "touchend", "keydown"]) window.addEventListener(ev, unlockAudio, { capture: true });

// 효과음 한 번 내기 (소리가 꺼져 있거나 아직 안 불러왔으면 그냥 넘어감)
function playSfx(key) {
  if (!soundOn || !audioCtx || audioCtx.state !== "running") return;
  const def = SFX[key], buf = audioBuffers[`sfx_${key}`];
  if (!def || !buf) return;
  const now = audioCtx.currentTime;
  if (now - (sfxLastAt[key] ?? -1) < def.gap) return;
  sfxLastAt[key] = now;
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  const g = audioCtx.createGain(); g.gain.value = def.vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

// 같은 효과음을 음 높이만 바꿔 냄 (semitones: 반음 단위, 12 = 한 옥타브 위). 간격 제한 없음 → 상자 구슬처럼 차례로 올라가는 음에 씀
function playSfxPitch(key, semitones, vol) {
  if (!soundOn || !audioCtx || audioCtx.state !== "running") return;
  const def = SFX[key], buf = audioBuffers[`sfx_${key}`];
  if (!def || !buf) return;
  const src = audioCtx.createBufferSource(); src.buffer = buf;
  src.playbackRate.value = 2 ** (semitones / 12);
  const g = audioCtx.createGain(); g.gain.value = vol ?? def.vol;
  src.connect(g).connect(sfxGain);
  src.start();
}

// 배경 음악 바꾸기 (name = "title", "stage1".."stage3", "boss", "ending", null = 끄기). 같은 곡이면 그대로 이어서 틂
function setMusic(name) {
  musicWant = name;
  if (!audioCtx || musicNow === name) return;
  if (musicSource) {                      // 앞 곡은 짧게 줄이며 끔
    const old = musicSource, t = audioCtx.currentTime;
    try { old.fade.gain.setTargetAtTime(0, t, 0.15); old.stop(t + 0.6); } catch {}
    musicSource = null;
  }
  musicNow = name;
  if (!name) return;
  loadSound(`music_${name}`).then((buf) => {
    if (!buf || musicNow !== name || musicSource) return;   // 불러오는 사이에 곡이 바뀌었으면 틀지 않음
    const src = audioCtx.createBufferSource(); src.buffer = buf; src.loop = true;
    const fade = audioCtx.createGain(); fade.gain.value = 1;
    src.connect(fade).connect(musicGain);
    src.fade = fade;
    src.start();
    musicSource = src;
  });
}

// 난이도 테마(장소)마다 따로 트는 곡: 게임 중 내내 stage 곡, 보스가 나오면 boss 곡 (assets/music_<이름>.mp3, 출처는 assets/LICENSE.txt)
const THEME_MUSIC = {
  ice:  { stage: "ice",  boss: "boss_ice" },    // 얼음 동굴: Fields of Ice / Boss Battle #3
  lava: { stage: "lava", boss: "boss_lava" },   // 용암 굴: Fire Level (원곡) / Great Boss
  dark: { stage: "dark", boss: "boss_dark" },   // 저주받은 어둠: Spooky Dungeon / Boss Battle #1
};

// 게임 중 배경 음악: 던전은 0~7분 / 7~14분 / 14분~ 곡이 바뀌고, 다른 장소는 그 장소 곡. 보스가 나오면 보스 곡
function updateRunMusic() {
  if (!run || run.done) return;
  const theme = THEME_MUSIC[diffDef().theme];
  const want = boss && !boss.dead ? (theme ? theme.boss : "boss")
    : theme ? theme.stage : stats.time < 420 ? "stage1" : stats.time < 840 ? "stage2" : "stage3";
  if (want !== musicWant) setMusic(want);
}

// 소리 켜기/끄기 버튼 (왼쪽 위, 일시정지 버튼 옆. 시작 화면에서는 왼쪽 위 구석)
const soundBtn = document.getElementById("soundBtn");
function refreshSoundBtn() {
  soundBtn.querySelector("img").src = soundOn ? "assets/sound_on.png" : "assets/sound_off.png";
  soundBtn.title = soundOn ? "소리 끄기 (M)" : "소리 켜기 (M)";
}
function toggleSound() {
  soundOn = !soundOn;
  try { localStorage.setItem(SOUND_KEY, soundOn ? "1" : "0"); } catch {}
  unlockAudio();
  if (masterGain) masterGain.gain.value = soundOn ? 1 : 0;
  refreshSoundBtn();
}
soundBtn.addEventListener("click", toggleSound);
refreshSoundBtn();

// 버튼 누르는 소리 (스피커·일시정지 버튼은 각자 소리가 따로 있어서 뺌)
document.addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b && b !== soundBtn && b !== pauseBtn) playSfx("button");
});

// 앱을 내리거나 다른 탭으로 가면 소리를 멈춤 (돌아와서 화면을 누르면 다시 남)
document.addEventListener("visibilitychange", () => {
  if (!audioCtx) return;
  if (document.visibilityState === "hidden") audioCtx.suspend().catch(() => {});
  else audioCtx.resume().catch(() => {});
});
