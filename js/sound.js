// 소리: 인터넷 없이 울리는 기본 종소리(직접 합성) + 선생님이 추가한 음원 주소

let AC = null, MASTER = null;
let volume = 0.8;
const LIVE = new Set(); // 지금 울리는(또는 곧 울릴) 소리 — 알람 멈추기용
let urlAudio = null;
/** 울리고 있는 소리를 모두 바로 멈춤 */
export function stopSounds() {
  LIVE.forEach((o) => { try { o.stop(); } catch (e) { /* 이미 끝남 */ } }); LIVE.clear();
  if (urlAudio) { try { urlAudio.pause(); } catch (e) { /* 무시 */ } urlAudio = null; }
}

function ac() {
  if (!AC) {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    const comp = AC.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 6; comp.ratio.value = 8; comp.attack.value = 0.002; comp.release.value = 0.2;
    MASTER = AC.createGain(); MASTER.gain.value = 1.4 * volume;
    MASTER.connect(comp).connect(AC.destination);
  }
  if (AC.state === 'suspended') AC.resume();
  return AC;
}

export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (MASTER) MASTER.gain.value = 1.4 * volume;
}

/** 브라우저는 첫 클릭 전에는 소리를 막아서, 첫 클릭 때 소리 장치를 깨움 */
export function unlockAudio() { try { ac(); } catch (e) { /* 소리 장치 없음 */ } }

function tone(freq, dur, type = 'sine', gain = 0.25, delay = 0) {
  try {
    ac();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    const t = AC.currentTime + delay;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(MASTER); o.start(t); o.stop(t + dur + 0.05);
    LIVE.add(o); o.onended = () => LIVE.delete(o);
  } catch (e) { /* 소리 장치 없음 */ }
}

/** 금속 종 한 번 치기: 고르지 않은 배음 + 짧은 '탁' 소리 */
function hit(f, delay = 0, vol = 0.6, len = 1.2) {
  [[1, 1], [2.4, 0.55], [3.9, 0.35], [5.95, 0.22], [8.2, 0.12]].forEach(([r, a]) => tone(f * r, len / Math.sqrt(r), 'sine', vol * a, delay));
  tone(f * 1.5, 0.05, 'square', vol * 0.25, delay);
}

export const BELLS = [
  { name: '학교 종 (땡땡땡)', play: () => { for (let i = 0; i < 8; i++) hit(880, i * 0.16, 0.7, 0.5); } },
  { name: '딩동댕동', play: () => { [659, 523, 587, 392].forEach((f, i) => { hit(f, i * 0.42, 0.75, 1.1); tone(f, 0.9, 'triangle', 0.35, i * 0.42); }); } },
  { name: '호출벨 (띵띵띵!)', play: () => { hit(1568, 0, 0.8, 0.9); hit(1568, 0.22, 0.8, 0.9); hit(2093, 0.5, 0.85, 1.3); } },
  { name: '트라이앵글 연타', play: () => { for (let i = 0; i < 14; i++) hit(2637, i * 0.07, 0.45 + (i % 2) * 0.15, 0.35); } },
  { name: '실로폰 짜잔', play: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => { tone(f, 0.25, 'square', 0.22, i * 0.07); hit(f, i * 0.07, 0.35, 0.4); }); [1047, 1319, 1568].forEach((f) => { tone(f, 0.9, 'square', 0.18, 0.42); hit(f, 0.42, 0.4, 1); }); } },
];

/** 선생님이 추가한 음원 주소 재생. 실패하면 기본 종소리로 대신 */
function playUrl(url) {
  return new Promise((resolve) => {
    try {
      const a = new Audio(url); urlAudio = a;
      a.volume = volume;
      a.play().then(() => resolve(true)).catch(() => resolve(false));
      a.onerror = () => resolve(false);
    } catch (e) { resolve(false); }
  });
}

/** 집중 종: 소리 끔 상태에서도 울림. idx가 BELLS 길이 이상이면 사용자 음원 */
export async function ringBell(idx, custom = []) {
  if (idx < BELLS.length) { BELLS[idx].play(); return; }
  const c = custom[idx - BELLS.length];
  if (!c || !(await playUrl(c.url))) BELLS[0].play();
}

// 자동 효과음 ('소리 켬'일 때만 호출됨)
export const FX = {
  classStart: () => { [784, 659, 698, 523].forEach((f, i) => { hit(f, i * 0.5, 0.7, 1.2); tone(f, 1, 'triangle', 0.3, i * 0.5); }); }, // 수업 시작 학교 종
  soon: () => { hit(1175, 0, 0.6, 0.8); hit(1175, 0.25, 0.6, 0.8); },                    // 2분 전 짧은 종
  breakStart: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.3, i * 0.1)); }, // 쉬는 시간 시작
  move: (up) => tone(up ? 880 : 520, 0.08, 'triangle', 0.14),                                // 이름표 이동
  tick: (n) => tone(600 + n * 10, 0.04, 'triangle', 0.12),                                   // 이름 뽑기
  win: () => { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.25, i * 0.08)); },
  light: () => tone(700, 0.06, 'triangle', 0.14),                                            // 신호등 누름
  celebrate: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.4, 'triangle', 0.25, i * 0.09)); },
};
