// 위젯: 배경, 이름 뽑기, 소음 측정(실제 마이크), 신호등
import { $, ic, esc, toast, confetti, openWin, closeWin, isWinOpen, timerSvg } from './ui.js';
import { FX, BELLS } from './sound.js';

let ctx = null; // app.js가 넘겨주는 { cfg(), save(), soundOn(), roster(), setLight(), bgImage(), setBgImage() }
export function initWidgets(c) { ctx = c; }
const fx = (name, ...a) => { if (ctx.soundOn()) FX[name](...a); };

/* ---------- 배경 ---------- */
const PATTERNS = [
  { id: 'grid', name: '모눈' }, { id: 'notebook', name: '공책' }, { id: 'chalk', name: '칠판' },
  { id: 'dots', name: '물방울' }, { id: 'solid', name: '단색' },
];
const svgUrl = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
function starSvg() {
  let st = ''; let x = 7;
  for (let i = 0; i < 90; i++) { x = (x * 9301 + 49297) % 233280; const a = x / 233280; x = (x * 9301 + 49297) % 233280; const b = x / 233280; st += `<circle cx='${(a * 1600).toFixed(0)}' cy='${(b * 600).toFixed(0)}' r='${(1 + (i % 3)).toFixed(1)}' fill='#fff' opacity='${(0.4 + (i % 5) / 8).toFixed(2)}'/>`; }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1B2350'/><stop offset='1' stop-color='#3B3F8F'/></linearGradient></defs><rect width='1600' height='900' fill='url(#g)'/>${st}<circle cx='1330' cy='170' r='70' fill='#FFF3C4'/><circle cx='1360' cy='150' r='62' fill='#252C63'/><path d='M0 760 Q400 680 800 740 T1600 720 V900 H0Z' fill='#262B5E'/></svg>`;
}
function booksSvg() {
  const cols = ['#E57373', '#64B5F6', '#81C784', '#FFD54F', '#BA68C8', '#4DB6AC', '#FF8A65', '#7986CB'];
  let b = ''; let x = 3;
  for (let row = 0; row < 4; row++) {
    let px = 40; const y = 60 + row * 210;
    while (px < 1560) { x = (x * 9301 + 49297) % 233280; const r = x / 233280; const w = 26 + Math.round(r * 30), h = 120 + Math.round(r * 50); b += `<rect x='${px}' y='${y + 170 - h}' width='${w}' height='${h}' rx='4' fill='${cols[Math.floor(r * 8)]}'/><rect x='${px + 5}' y='${y + 190 - h}' width='${w - 10}' height='6' rx='3' fill='#fff' opacity='.5'/>`; px += w + 4; }
    b += `<rect x='20' y='${y + 170}' width='1560' height='18' rx='4' fill='#A47148'/>`;
  }
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'><rect width='1600' height='900' fill='#F4E6D3'/>${b}</svg>`;
}
const ILLUST = {
  hills: { name: '언덕과 구름', css: () => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='s' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#8EC5FF'/><stop offset='1' stop-color='#E6F3FF'/></linearGradient></defs><rect width='1600' height='900' fill='url(#s)'/><g fill='#fff' opacity='.9'><ellipse cx='260' cy='170' rx='120' ry='40'/><ellipse cx='330' cy='150' rx='80' ry='45'/><ellipse cx='1180' cy='120' rx='140' ry='42'/><ellipse cx='1260' cy='100' rx='90' ry='48'/></g><circle cx='1400' cy='190' r='70' fill='#FFD54F'/><path d='M0 640 Q400 520 800 620 T1600 600 V900 H0Z' fill='#9BD47A'/><path d='M0 720 Q500 620 1000 720 T1600 700 V900 H0Z' fill='#6FBF5E'/></svg>`) },
  night: { name: '밤하늘', css: () => svgUrl(starSvg()) },
  books: { name: '책장', css: () => svgUrl(booksSvg()) },
  sea: { name: '바다', css: () => svgUrl(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1600 900' preserveAspectRatio='xMidYMid slice'><defs><linearGradient id='k' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#FFE0B2'/><stop offset='1' stop-color='#FFF8E1'/></linearGradient></defs><rect width='1600' height='900' fill='url(#k)'/><circle cx='800' cy='470' r='120' fill='#FFB74D'/><rect y='470' width='1600' height='430' fill='#4FC3F7'/><path d='M0 520 Q100 500 200 520 T400 520 T600 520 T800 520 T1000 520 T1200 520 T1400 520 T1600 520 V900 H0Z' fill='#29B6F6'/><path d='M0 760 Q400 700 800 760 T1600 750 V900 H0Z' fill='#FFE082'/></svg>`) },
};
const ILLUST_CREDIT = '그림: 우리 반 교실 보드 직접 제작 (자유 이용)';

function autoBg() {
  const h = new Date().getHours();
  if (h < 11) return 'linear-gradient(160deg,#CFE6FF,#F2F8FF)';
  if (h < 15) return 'linear-gradient(160deg,#D9F2E6,#F4FBF7)';
  return 'linear-gradient(160deg,#FFE3C7,#FFF6EC)';
}

export function applyBg() {
  const b = ctx.cfg().bg, el = $('#bg');
  el.className = ''; el.style.cssText = '';
  let credit = '';
  if (b.kind === 'pattern') {
    el.className = 'pat' + (b.value !== 'grid' ? ' bg-' + b.value : '');
    if (b.value === 'solid' || b.value === 'grid') el.style.backgroundColor = b.color || '#DCE8FB';
  } else if (b.kind === 'auto') {
    el.style.background = autoBg();
  } else if (b.kind === 'illust' && ILLUST[b.value]) {
    el.className = 'img'; el.style.backgroundImage = ILLUST[b.value].css(); credit = ILLUST_CREDIT;
  } else if (b.kind === 'url' && b.value) {
    el.className = 'img'; el.style.backgroundImage = `url("${encodeURI(b.value)}")`; credit = '사진: 선생님이 넣은 이미지 주소';
  } else if (b.kind === 'photo' && ctx.bgImage()) {
    el.className = 'img'; el.style.backgroundImage = `url("${ctx.bgImage()}")`; credit = '사진: 선생님이 올린 사진';
  } else { el.className = 'pat'; }
  $('#bgDim').style.opacity = (b.dim || 0) / 100;
  $('#credit').textContent = credit;
}

/** 올린 사진을 1920px 이하 JPEG로 줄여서 저장 공간을 아낌 */
function shrinkImage(file) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const s = Math.min(1, 1920 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      let q = 0.82, d = c.toDataURL('image/jpeg', q);
      while (d.length > 900000 && q > 0.4) { q -= 0.1; d = c.toDataURL('image/jpeg', q); }
      res(d);
    };
    im.onerror = rej; im.src = URL.createObjectURL(file);
  });
}

let bgTab = null;
export function openBg() {
  const cfg = ctx.cfg();
  bgTab = bgTab || ({ pattern: 'pattern', auto: 'auto', illust: 'illust', url: 'mine', photo: 'mine' }[cfg.bg.kind] || 'pattern');
  openWin('bg', '배경', 'image', '<div class="bgw"></div>', (w) => drawBg(w));
}
function drawBg(w) {
  const box = w.querySelector('.bgw'), b = ctx.cfg().bg;
  const tabs = [['auto', '자동'], ['nature', '자연'], ['class', '교실·책'], ['illust', '일러스트'], ['pattern', '단색·패턴'], ['mine', '내 사진·주소']];
  let body = '';
  if (bgTab === 'auto') body = `<p class="hint">시간에 따라 아침·낮·오후 색이 바뀌어요.</p><button class="btn" data-k="auto">자동 배경 쓰기</button>`;
  else if (bgTab === 'nature' || bgTab === 'class') body = `<p class="hint">저작권 걱정 없는 사진 모음은 다음 단계에서 추가될 예정이에요. 지금은 '일러스트'나 '내 사진·주소'를 써 주세요.</p>`;
  else if (bgTab === 'illust') body = `<div class="grid">${Object.entries(ILLUST).map(([k, v]) => `<button data-il="${k}" class="${b.kind === 'illust' && b.value === k ? 'sel' : ''}" style="background-image:${v.css().replace(/"/g, '&quot;')};color:#fff;text-shadow:0 1px 3px #000">${v.name}</button>`).join('')}</div><p class="hint">${ILLUST_CREDIT}</p>`;
  else if (bgTab === 'pattern') body = `<div class="grid">${PATTERNS.map((p) => `<button data-pt="${p.id}" class="${b.kind === 'pattern' && b.value === p.id ? 'sel' : ''}" style="${patPreview(p.id, b.color)}">${p.name}</button>`).join('')}</div>
      <label>색 고르기 (모눈·단색) <input type="color" data-r="color" value="${b.color || '#DCE8FB'}"></label>`;
  else body = `<label>내 컴퓨터 사진 <input type="file" accept="image/*" data-r="file"></label>
      <label>이미지 주소 <input type="url" data-r="url" placeholder="https://…" value="${b.kind === 'url' ? esc(b.value) : ''}"><button class="btn ghost" data-r="useurl">넣기</button></label>
      <p class="hint">사진은 로그인한 선생님 기록에만 저장돼요. 다른 사람이 만든 사진은 저작권을 확인하고 써 주세요.</p>`;
  box.innerHTML = `<div class="tabs">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${bgTab === k ? 'on' : ''}">${n}</button>`).join('')}</div>${body}
    <label>배경 어둡게 <input type="range" min="0" max="70" value="${b.dim || 0}" data-r="dim"> <span class="num">${b.dim || 0}%</span></label>`;
  const set = (patch) => { Object.assign(ctx.cfg().bg, patch); ctx.save(); applyBg(); drawBg(w); };
  box.querySelectorAll('[data-tab]').forEach((t) => { t.onclick = () => { bgTab = t.dataset.tab; drawBg(w); }; });
  box.querySelectorAll('[data-pt]').forEach((t) => { t.onclick = () => set({ kind: 'pattern', value: t.dataset.pt }); });
  box.querySelectorAll('[data-il]').forEach((t) => { t.onclick = () => set({ kind: 'illust', value: t.dataset.il }); });
  const a = box.querySelector('[data-k=auto]'); if (a) a.onclick = () => set({ kind: 'auto' });
  const col = box.querySelector('[data-r=color]'); if (col) col.onchange = () => set({ color: col.value, kind: 'pattern', value: ['grid', 'solid'].includes(b.value) && b.kind === 'pattern' ? b.value : 'solid' });
  const dim = box.querySelector('[data-r=dim]');
  dim.oninput = () => { ctx.cfg().bg.dim = +dim.value; $('#bgDim').style.opacity = dim.value / 100; dim.nextElementSibling.textContent = dim.value + '%'; };
  dim.onchange = () => ctx.save();
  const f = box.querySelector('[data-r=file]');
  if (f) f.onchange = async () => {
    const file = f.files[0]; if (!file) return;
    try { const d = await shrinkImage(file); ctx.setBgImage(d); set({ kind: 'photo' }); } catch (e) { toast('사진을 열지 못했어요. 다른 사진으로 해 주세요'); }
  };
  const u = box.querySelector('[data-r=useurl]');
  if (u) u.onclick = () => {
    const v = box.querySelector('[data-r=url]').value.trim();
    if (!/^https?:\/\//.test(v)) { toast('https:// 로 시작하는 이미지 주소를 넣어 주세요'); return; }
    const im = new Image(); im.onload = () => set({ kind: 'url', value: v }); im.onerror = () => toast('이미지를 불러오지 못했어요. 주소를 확인해 주세요'); im.src = v;
  };
}
function patPreview(id, color) {
  const c = color || '#DCE8FB';
  return {
    grid: `background:${c} linear-gradient(rgba(43,108,230,.15) 1px,transparent 1px) 0 0/12px 12px`,
    notebook: 'background:#FBFAF4 linear-gradient(transparent 11px,rgba(43,108,230,.3) 12px) 0 0/100% 12px',
    chalk: 'background:#2F4F43;color:#fff',
    dots: 'background:#EFE9FF radial-gradient(rgba(123,92,250,.35) 3px,transparent 4px) 0 0/14px 14px',
    solid: `background:${c}`,
  }[id];
}

/* ---------- 이름 뽑기 ---------- */
export function openPick() {
  const out = new Set();
  openWin('pick', '이름 뽑기', 'dice', `<div class="pick-name" data-r="pn">누구일까?</div>
     <div class="row"><button class="btn" data-r="go">뽑기</button><label class="chk"><input type="checkbox" data-r="ex" checked> 뽑힌 학생 빼고 뽑기</label><button class="btn ghost" data-r="rs">다시 시작</button></div>
     <div class="note" data-r="left"></div>`, (w) => {
    const q = (r) => w.querySelector(`[data-r=${r}]`);
    const names = () => ctx.roster();
    const upd = () => { q('left').textContent = `남은 학생 ${names().filter((x) => x).length - out.size}명`; };
    upd();
    let spinning = false;
    q('rs').onclick = () => { out.clear(); upd(); q('pn').textContent = '누구일까?'; q('pn').classList.remove('hit'); };
    q('go').onclick = () => {
      if (spinning) return;
      const n = names();
      const pool = n.map((_, i) => i).filter((i) => n[i] && (!q('ex').checked || !out.has(i)));
      if (!n.some((x) => x)) { toast('시간표 설정에서 학생 명단을 먼저 넣어 주세요'); return; }
      if (!pool.length) { toast('모두 뽑혔어요. 다시 시작을 눌러 주세요'); return; }
      const pn = q('pn'); pn.classList.remove('hit'); spinning = true;
      const target = pool[Math.floor(Math.random() * pool.length)];
      let delay = 40, steps = 0;
      const spin = () => {
        pn.textContent = n[pool[steps % pool.length]]; fx('tick', steps); steps++; delay *= 1.12;
        if (delay < 420) setTimeout(spin, delay);
        else { pn.textContent = `${target + 1}번 ${n[target]}`; pn.classList.add('hit'); out.add(target); upd(); confetti(); fx('win'); spinning = false; }
      };
      spin();
    };
  });
}

/* ---------- 신호등 ---------- */
export function openLight() {
  const L = ctx.cfg().light;
  openWin('light', '신호등', 'light', `<div class="lights"><button class="r">조용히</button><button class="y">작은 목소리</button><button class="g">자유롭게</button></div>
     <label class="chk"><input type="checkbox" data-r="lk" ${L.link ? 'checked' : ''}> 소음 측정기와 연동 (교실 소리에 따라 자동으로 바뀜)</label>`, (w) => {
    w.querySelectorAll('.lights button').forEach((b) => { b.onclick = () => { ctx.setLight(b.className.split(' ')[0], true); fx('light'); }; });
    ctx.setLight(L.state, false);
    w.querySelector('[data-r=lk]').onchange = (e) => {
      L.link = e.target.checked; ctx.save();
      if (L.link && !isWinOpen('noise')) { openNoise(); toast('소음 측정을 켰어요. 측정 창이 열려 있는 동안 신호등이 자동으로 바뀌어요'); }
    };
  });
}

/* ---------- 소음 측정 (브라우저에서 직접 마이크) ---------- */
let mic = null; // { stream, ac, raf }
function stopMic() {
  if (!mic) return;
  cancelAnimationFrame(mic.raf);
  mic.stream.getTracks().forEach((t) => t.stop());
  mic.ac.close().catch(() => {});
  mic = null;
}
const MIC_ERR = {
  NotAllowedError: '마이크 사용을 허락하지 않았어요. 주소창 왼쪽 자물쇠(또는 설정) 아이콘을 눌러 마이크를 "허용"으로 바꾼 뒤 다시 켜 주세요.',
  NotFoundError: '마이크를 찾지 못했어요. 노트북 마이크나 연결한 마이크가 있는지 확인해 주세요.',
  NotReadableError: '다른 프로그램이 마이크를 쓰고 있어요. 화상 수업 프로그램 등을 끈 뒤 다시 켜 주세요.',
  SecurityError: '이 주소에서는 마이크를 쓸 수 없어요. https 주소로 열어 주세요.',
};

export function openNoise() {
  const L = ctx.cfg().light;
  openWin('noise', '소음 측정', 'mic', `<div class="meter" data-r="mt">
       <div class="meter-bar"><div class="fill" data-r="mf"></div><div class="ln" data-r="ly" style="border-color:#E0A800"></div><div class="ln" data-r="lr" style="border-color:#E5484D"></div><div class="pk" data-r="mp"></div></div>
       <div class="meter-side"><div><b class="num" data-r="mv" style="font-size:34px">–</b> <span style="color:var(--muted)">/ 100</span></div>
         <label>노란불 기준 <span class="num" data-r="yv">${L.yellow}</span><input type="range" data-r="sy" min="5" max="95" value="${L.yellow}"></label>
         <label>빨간불 기준 <span class="num" data-r="rv">${L.red}</span><input type="range" data-r="sr" min="10" max="100" value="${L.red}"></label>
         <div style="color:var(--muted)">최근 최고값 <b class="num" data-r="mpk">–</b></div>
         <label class="chk"><input type="checkbox" data-r="lk" ${L.link ? 'checked' : ''}> 신호등과 연동</label></div></div>
     <div class="note" data-r="msg">마이크를 켜는 중이에요…</div>
     <div class="note">숫자는 교정된 소음계가 아니라 이 노트북 마이크로 잰 <b>상대적인 소리 크기</b>예요. 박수 한 번에는 바뀌지 않고, 1.5초 넘게 이어질 때 신호등 색이 바뀌어요.</div>`, (w) => startMic(w), stopMic);
}

async function startMic(w) {
  const q = (r) => w.querySelector(`[data-r=${r}]`);
  const L = ctx.cfg().light;
  const lines = () => { q('ly').style.bottom = L.yellow + '%'; q('lr').style.bottom = L.red + '%'; q('yv').textContent = L.yellow; q('rv').textContent = L.red; };
  lines();
  q('sy').oninput = () => { L.yellow = Math.min(+q('sy').value, L.red - 5); q('sy').value = L.yellow; lines(); };
  q('sr').oninput = () => { L.red = Math.max(+q('sr').value, L.yellow + 5); q('sr').value = L.red; lines(); };
  q('sy').onchange = q('sr').onchange = () => ctx.save();
  q('lk').onchange = (e) => { L.link = e.target.checked; ctx.save(); };
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { q('msg').textContent = MIC_ERR.SecurityError; return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) { q('msg').textContent = MIC_ERR[e.name] || `마이크를 켜지 못했어요. (${e.name})`; return; }
  if (!w.isConnected) { stream.getTracks().forEach((t) => t.stop()); return; }
  const ac = new (window.AudioContext || window.webkitAudioContext)();
  const an = ac.createAnalyser(); an.fftSize = 1024;
  ac.createMediaStreamSource(stream).connect(an);
  const buf = new Float32Array(an.fftSize);
  mic = { stream, ac, raf: 0 };
  q('msg').textContent = '마이크가 켜졌어요. 창을 닫으면 마이크도 꺼져요.';
  let sm = 0, peak = 0, peakAt = 0, pending = null, since = 0, last = performance.now();
  const loop = (t) => {
    const dt = (t - last) / 1000; last = t;
    an.getFloatTimeDomainData(buf);
    let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
    const rms = Math.sqrt(s / buf.length);
    const level = Math.max(0, Math.min(100, ((20 * Math.log10(rms + 1e-9)) + 60) / 50 * 100)); // -60dB → 0, -10dB → 100
    sm += (level - sm) * Math.min(1, dt * 2.5); // 부드럽게 (약 0.4초)
    if (sm > peak || t - peakAt > 4000) { peak = sm; peakAt = t; }
    const c = sm >= L.red ? 'r' : sm >= L.yellow ? 'y' : 'g';
    q('mf').style.height = sm + '%';
    q('mf').style.background = c === 'r' ? 'var(--red)' : c === 'y' ? 'var(--yellow)' : 'var(--green)';
    q('mp').style.bottom = peak + '%';
    q('mv').textContent = Math.round(sm); q('mpk').textContent = Math.round(peak);
    if (L.link) {
      if (c !== pending) { pending = c; since = 0; } else since += dt;
      if (since >= 1.5 && c !== L.state) ctx.setLight(c, false); // 잠깐 머문 뒤 바뀜
    }
    q('mt').classList.toggle('alarm', L.state === 'r');
    mic.raf = requestAnimationFrame(loop);
  };
  mic.raf = requestAnimationFrame(loop);
}

/* ---------- 타이머 (떠 있는 창, 크기 자유) ---------- */
// 타이머 상태는 창을 닫아도 남아 있고(돌던 타이머는 계속 감), 같은 선생님 계정의 다른 화면과 연동돼요.
// endAt은 실제 시각(ms)이라 휴대폰에서 시작해도 TV에서 같은 시각에 끝나요.
const fmt = (sec) => { sec = Math.max(0, Math.ceil(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? `${h}:${String(m).padStart(2, '0')}` : String(m).padStart(2, '0')) + ':' + String(s).padStart(2, '0'); };
let T = { total: 0, left: 0, running: false, endAt: 0, iv: 0, ringing: 0, done: false };
let TW = null; // 열린 타이머 창
const tnow = () => Date.now();
export function openTimer() {
  const c = ctx.cfg();
  c.timer = { type: 'hour', bell: 0, h: 0, m: 5, s: 0, ...(c.timer || {}) };
  openWin('timer', '타이머', 'clock', `<div class="tmr">
      <div class="tmr-vis" data-r="vis"></div>
      <div class="tmr-set" data-r="set">
        <label><input type="number" min="0" max="23" data-u="h" value="${c.timer.h}" inputmode="numeric"><span>시</span></label>
        <label><input type="number" min="0" max="59" data-u="m" value="${c.timer.m}" inputmode="numeric"><span>분</span></label>
        <label><input type="number" min="0" max="59" data-u="s" value="${c.timer.s}" inputmode="numeric"><span>초</span></label>
      </div>
      <div class="row tmr-pre" data-r="pre">${[[30, '30초'], [60, '1분'], [180, '3분'], [300, '5분'], [600, '10분']].map(([v, n]) => `<button class="btn ghost" data-p="${v}">${n}</button>`).join('')}</div>
      <div class="row tmr-adj" data-r="adj" hidden>${[[-60, '−1분'], [-30, '−30초'], [30, '+30초'], [60, '+1분'], [300, '+5분']].map(([v, n]) => `<button class="btn ghost ${v < 0 ? 'minus' : ''}" data-adj="${v}">${n}</button>`).join('')}</div>
      <div class="row tmr-go"><button class="btn" data-a="go">시작</button><button class="btn ghost" data-a="reset">다시</button><span class="sp"></span>
        <div class="seg sm">${[['hour', '모래시계'], ['pie', '부채꼴'], ['num', '숫자만']].map(([k, n]) => `<button data-t="${k}" class="${c.timer.type === k ? 'sel' : ''}">${n}</button>`).join('')}</div></div>
      <label class="chk tmr-bell">끝날 때 소리 <select data-r="bell">${BELLS.map((b, i) => `<option value="${i}" ${i === c.timer.bell ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select><button class="btn ghost" data-a="test">들어 보기</button></label>
    </div>`, (w) => bindTimer(w), () => { TW = null; });
}
function setSec() { const t = ctx.cfg().timer || {}; return (+t.h || 0) * 3600 + (+t.m || 0) * 60 + (+t.s || 0); }
const share = () => { if (ctx.timerSync) ctx.timerSync({ total: T.total, left: T.left, running: T.running, endAt: T.endAt, done: T.done, type: ctx.cfg().timer.type, bell: ctx.cfg().timer.bell, v: tnow() }); };
function tDraw() {
  if (!TW) return;
  const w = TW, q = (r) => w.querySelector(`[data-r=${r}]`), a = (r) => w.querySelector(`[data-a=${r}]`), c = ctx.cfg();
  const f = T.total ? T.left / T.total : 0, type = c.timer.type, done = T.done;
  q('vis').className = 'tmr-vis t-' + type + (done ? ' done' : '');
  q('vis').innerHTML = (type === 'num' ? '' : `<div class="tmr-svg">${timerSvg(type, f)}</div>`) + `<div class="tmr-num num">${done ? '시간 끝!' : fmt(T.left)}</div>`;
  a('go').textContent = T.running ? '일시 정지' : done ? '소리 끄기' : T.left < T.total ? '계속' : '시작';
  q('set').classList.toggle('lock', T.running);
  // 진행 중(멈춤·끝 포함)에는 '시간 더하기·빼기' 버튼, 처음에는 시간 고르기 버튼
  const busy = T.running || done || (T.total && T.left < T.total);
  q('pre').hidden = !!busy; q('adj').hidden = !busy;
  w.querySelectorAll('[data-t]').forEach((x) => x.classList.toggle('sel', x.dataset.t === type));
}
function tLoop() {
  if (!T.running) return;
  T.left = Math.max(0, (T.endAt - tnow()) / 1000);
  tDraw();
  if (T.left <= 0) { T.running = false; clearInterval(T.iv); tFinish(); }
}
function tRun() { clearInterval(T.iv); if (T.running) { T.iv = setInterval(tLoop, 200); tLoop(); } else tDraw(); }
function tFinish() {
  T.done = true; tDraw();
  const c = ctx.cfg(); const ring = () => import('./sound.js').then((m) => m.ringBell(c.timer.bell, []));
  clearInterval(T.ringing); ring(); let n = 1; T.ringing = setInterval(() => { if (n++ >= 3) clearInterval(T.ringing); ring(); }, 2600);
  toast('타이머 시간이 끝났어요');
  if (!TW) openTimer(); // 창을 닫아 두었어도 끝나면 다시 띄움
}
function tReset() { clearInterval(T.ringing); clearInterval(T.iv); T.running = false; T.done = false; T.total = T.left = setSec(); tDraw(); }
function tStart(sec) { clearInterval(T.ringing); T.done = false; if (sec) T.total = T.left = sec; T.running = true; T.endAt = tnow() + T.left * 1000; tRun(); }

/** 다른 화면에서 바뀐 타이머를 그대로 따라감 (창이 닫혀 있으면 엶) */
export function applyRemoteTimer(st) {
  const c = ctx.cfg(); c.timer = { type: 'hour', bell: 0, h: 0, m: 5, s: 0, ...(c.timer || {}), type: st.type || 'hour', bell: st.bell ?? 0 };
  const wasDone = T.done;
  T.total = st.total; T.running = !!st.running; T.endAt = st.endAt; T.done = !!st.done;
  T.left = T.running ? Math.max(0, (T.endAt - tnow()) / 1000) : st.left;
  if (!T.done) clearInterval(T.ringing);
  if (!TW && (T.running || T.done)) openTimer();
  tRun();
  if (T.done && !wasDone && !st.running) { /* 저쪽에서 끝남: 이쪽도 이미 끝났거나 곧 끝남 */ }
}
function bindTimer(w) {
  TW = w;
  const c = ctx.cfg(), q = (r) => w.querySelector(`[data-r=${r}]`), a = (r) => w.querySelector(`[data-a=${r}]`);
  if (!T.total && !T.running) { T.total = T.left = setSec(); }
  w.querySelectorAll('[data-u]').forEach((inp) => {
    inp.oninput = () => { const max = inp.dataset.u === 'h' ? 23 : 59; c.timer[inp.dataset.u] = Math.max(0, Math.min(max, Math.floor(+inp.value || 0))); if (!T.running) tReset(); };
    inp.onchange = () => { inp.value = c.timer[inp.dataset.u]; ctx.save(); share(); };
  });
  w.querySelectorAll('[data-p]').forEach((b) => { b.onclick = () => { const v = +b.dataset.p; c.timer.h = Math.floor(v / 3600); c.timer.m = Math.floor(v / 60) % 60; c.timer.s = v % 60; w.querySelectorAll('[data-u]').forEach((i) => { i.value = c.timer[i.dataset.u]; }); ctx.save(); tReset(); share(); }; });
  w.querySelectorAll('[data-t]').forEach((b) => { b.onclick = () => { c.timer.type = b.dataset.t; ctx.save(); tDraw(); share(); }; });
  q('bell').onchange = () => { c.timer.bell = +q('bell').value; ctx.save(); };
  a('test').onclick = () => import('./sound.js').then((m) => m.ringBell(c.timer.bell, []));
  a('reset').onclick = () => { tReset(); share(); };
  // 진행 중에 시간 더하기·빼기: 남은 시간과 전체 시간을 같이 바꿔서 모래시계·부채꼴 양도 따라 바뀜
  w.querySelectorAll('[data-adj]').forEach((b) => {
    b.onclick = () => {
      const v = +b.dataset.adj;
      if (T.done) { if (v > 0) { tStart(v); share(); } return; } // 끝난 뒤 더하면 그 시간만큼 다시 시작
      const left = T.running ? Math.max(0, (T.endAt - tnow()) / 1000) : T.left;
      if (v < 0 && left <= 1) return;
      const nl = Math.max(1, left + v);
      T.total = Math.max(nl, T.total + (nl - left));
      T.left = nl;
      if (T.running) T.endAt = tnow() + nl * 1000;
      b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump');
      tDraw(); share();
    };
  });
  a('go').onclick = () => {
    if (T.done) { tReset(); share(); return; }
    if (T.running) { T.left = Math.max(0, (T.endAt - tnow()) / 1000); T.running = false; tRun(); share(); return; }
    if (!T.total) { toast('시간을 먼저 정해 주세요'); return; }
    tStart(); share();
  };
  tRun();
}
