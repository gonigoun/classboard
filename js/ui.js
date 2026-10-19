// 공통 화면 도구: 아이콘, 알림, 꽃가루, 확인 창, 떠 있는 위젯 창

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const ic = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(t, ms = 2600) {
  document.querySelectorAll('.toast').forEach((x) => x.remove()); // 안내가 겹쳐 보이지 않게 새 안내만
  const e = document.createElement('div'); e.className = 'toast'; e.textContent = t;
  document.body.appendChild(e); setTimeout(() => e.remove(), ms);
}

/**
 * 축하 꽃가루: 화면 양쪽 아래에서 터져 오르고 위에서 흩날려요.
 * 리본(앞뒤로 뒤집히며 반짝), 동그라미, 별, 꼬불 리본 — 어울리는 색 묶음으로
 */
const CONF_PAL = [
  ['#FF5D73', '#FFB3C1', '#FFD166', '#06D6A0', '#4CC9F0', '#7B61FF', '#F7F7FF'], // 축제
  ['#F9C74F', '#F9844A', '#F94144', '#90BE6D', '#43AA8B', '#577590', '#FFF3B0'], // 가을 들판
  ['#FFADAD', '#FFD6A5', '#FDFFB6', '#CAFFBF', '#9BF6FF', '#A0C4FF', '#BDB2FF'], // 파스텔
];
let confCanvas = null, confParts = [], confRaf = 0;
export function confetti(opts = {}) {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const W = innerWidth, H = innerHeight, pal = CONF_PAL[Math.floor(Math.random() * CONF_PAL.length)];
  if (!confCanvas) {
    confCanvas = document.createElement('canvas'); confCanvas.className = 'confetti-cv';
    document.body.appendChild(confCanvas);
  }
  const d = Math.min(2, devicePixelRatio || 1); confCanvas.width = W * d; confCanvas.height = H * d;
  const cx = confCanvas.getContext('2d'); cx.setTransform(d, 0, 0, d, 0, 0);
  const n = reduce ? 40 : Math.round((opts.count || 150) * Math.min(1.2, Math.max(0.55, W / 1400)));
  const shapes = ['rib', 'rib', 'rib', 'dot', 'star', 'curl'];
  const add = (x, y, ang, sp) => {
    const a = ang + (Math.random() - 0.5) * 0.9, v = sp * (0.55 + Math.random() * 0.6);
    confParts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: pal[Math.floor(Math.random() * pal.length)],
      t: shapes[Math.floor(Math.random() * shapes.length)], s: 6 + Math.random() * 8, r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.3,
      flip: Math.random() * 6.28, vf: 0.08 + Math.random() * 0.14, sway: Math.random() * 6.28, life: 0 });
  };
  const sp = Math.max(13, H / 42);
  for (let i = 0; i < n * 0.38; i++) add(-10, H * 0.92, -Math.PI / 3.1, sp);             // 왼쪽 아래 폭죽
  for (let i = 0; i < n * 0.38; i++) add(W + 10, H * 0.92, -Math.PI + Math.PI / 3.1, sp); // 오른쪽 아래 폭죽
  for (let i = 0; i < n * 0.24; i++) { const p = { x: Math.random() * W, y: -20 - Math.random() * H * 0.4 }; add(p.x, p.y, Math.PI / 2, 2); }       // 위에서 흩날림
  if (confRaf) return;
  const star = (r) => { cx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, rr = i % 2 ? r * 0.45 : r; cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } cx.closePath(); cx.fill(); };
  const step = () => {
    cx.clearRect(0, 0, W, H);
    confParts = confParts.filter((p) => p.y < H + 40 && p.life < 420);
    for (const p of confParts) {
      p.life++; p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985; if (p.vy > 4.2) p.vy = 4.2 + (p.vy - 4.2) * 0.9; // 공기 저항: 천천히 떨어짐
      p.sway += 0.05; p.x += p.vx + Math.sin(p.sway) * 0.8; p.y += p.vy; p.r += p.vr; p.flip += p.vf;
      const k = Math.cos(p.flip); // 앞뒤로 뒤집히는 느낌
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.min(1, (420 - p.life) / 60);
      cx.fillStyle = p.c; cx.strokeStyle = p.c;
      if (p.t === 'rib') { cx.scale(1, k); cx.fillRect(-p.s * 0.35, -p.s * 0.8, p.s * 0.7, p.s * 1.6); if (k > 0.85) { cx.fillStyle = 'rgba(255,255,255,.55)'; cx.fillRect(-p.s * 0.35, -p.s * 0.8, p.s * 0.25, p.s * 1.6); } }
      else if (p.t === 'dot') { cx.scale(1, 0.6 + Math.abs(k) * 0.4); cx.beginPath(); cx.arc(0, 0, p.s * 0.42, 0, 6.28); cx.fill(); }
      else if (p.t === 'star') { cx.scale(Math.abs(k) * 0.6 + 0.4, 1); star(p.s * 0.65); }
      else { cx.lineWidth = 2.6; cx.lineCap = 'round'; cx.beginPath(); for (let i = 0; i <= 12; i++) { const yy = -p.s + i * p.s / 6, xx = Math.sin(i * 0.9 + p.flip) * p.s * 0.35; i ? cx.lineTo(xx, yy) : cx.moveTo(xx, yy); } cx.stroke(); }
      cx.restore();
    }
    if (confParts.length) confRaf = requestAnimationFrame(step);
    else { confRaf = 0; cx.clearRect(0, 0, W, H); }
  };
  confRaf = requestAnimationFrame(step);
}

/** 확인 단계: 되돌리기 어려운 작업 전에 묻기 */
export function confirmBox(title, msg, okText = '확인', danger = true) {
  return new Promise((res) => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="dialog"><h3>${esc(title)}</h3><p>${esc(msg)}</p>
      <div class="row end"><button class="btn ghost" data-a="no">취소</button><button class="btn ${danger ? 'danger' : ''}" data-a="ok">${esc(okText)}</button></div></div>`;
    document.body.appendChild(m);
    m.onclick = (e) => { const a = e.target.closest('[data-a]'); if (!a && e.target !== m) return; m.remove(); res(!!a && a.dataset.a === 'ok'); };
  });
}

/** 알림 창: 확인 버튼 하나 */
export function alertBox(title, msg) {
  return new Promise((res) => {
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<div class="dialog"><h3>${esc(title)}</h3><p>${esc(msg)}</p><div class="row end"><button class="btn" data-a="ok">확인</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('[data-a=ok]').onclick = () => { m.remove(); res(); };
  });
}

/* ---------- 떠 있는 위젯 창 ---------- */
const wins = {};
let saveWin = () => {};
let getWin = () => null;
export function setWinStore(get, save) { getWin = get; saveWin = save; }
export function isWinOpen(key) { return !!wins[key]; }

export function openWin(key, title, icon, body, init, onClose) {
  if (wins[key]) { closeWin(key); return null; }
  const w = document.createElement('div'); w.className = 'win';
  const mobile = matchMedia('(max-width:760px)').matches;
  const saved = getWin(key);
  const n = Object.keys(wins).length;
  if (saved && !mobile) {
    w.style.left = Math.min(saved.x, innerWidth - 120) + 'px'; w.style.top = Math.min(saved.y, innerHeight - 60) + 'px';
    if (saved.w) w.style.width = saved.w + 'px'; if (saved.h) w.style.height = saved.h + 'px';
  } else { w.style.left = (140 + n * 60) + 'px'; w.style.top = (170 + n * 40) + 'px'; }
  w.innerHTML = `<div class="win-h">${ic(icon)}<span>${esc(title)}</span><span class="x"><button data-a="min" title="작게">${ic('min')}</button><button data-a="x" title="닫기">${ic('x')}</button></span></div><div class="win-b">${body}</div><span class="win-rs" title="크기 조절"></span>`;
  document.body.appendChild(w); wins[key] = { el: w, onClose };
  document.querySelectorAll(`.w[data-w="${key}"]`).forEach((b) => b.classList.add('on'));
  const remember = () => { if (!mobile) saveWin(key, { x: w.offsetLeft, y: w.offsetTop, w: w.style.width ? w.offsetWidth : 0, h: w.style.height ? w.offsetHeight : 0 }); };
  const h = w.querySelector('.win-h');
  h.onpointerdown = (e) => {
    if (e.target.closest('button') || mobile) return;
    const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop; try { h.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    h.onpointermove = (ev) => { w.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - sx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - sy)) + 'px'; };
    h.onpointerup = () => { h.onpointermove = null; remember(); };
  };
  const rs = w.querySelector('.win-rs');
  rs.onpointerdown = (e) => {
    e.preventDefault(); const sx = e.clientX, sy = e.clientY, W0 = w.offsetWidth, H0 = w.offsetHeight; try { rs.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    rs.onpointermove = (ev) => { w.style.width = Math.max(240, W0 + ev.clientX - sx) + 'px'; w.style.height = Math.max(150, H0 + ev.clientY - sy) + 'px'; };
    rs.onpointerup = () => { rs.onpointermove = null; remember(); };
  };
  w.querySelector('[data-a=min]').onclick = () => w.classList.toggle('min');
  w.querySelector('[data-a=x]').onclick = () => closeWin(key);
  if (init) init(w);
  return w;
}
export function closeWin(key) {
  const o = wins[key]; if (!o) return;
  o.el.remove(); delete wins[key];
  document.querySelectorAll(`.w[data-w="${key}"]`).forEach((b) => b.classList.remove('on'));
  if (o.onClose) o.onClose();
}

/** 타이머 그림: 모래시계(hour) 또는 부채꼴(pie). f = 남은 비율 0~1 */
export function timerSvg(type, f) {
  f = Math.max(0, Math.min(1, f));
  if (type === 'pie') {
    const a = f * 2 * Math.PI, r = 90, x = 100 + r * Math.sin(a), y = 100 - r * Math.cos(a), big = f > 0.5 ? 1 : 0;
    const path = f >= 0.999 ? '<circle cx="100" cy="100" r="90" fill="#FF5A4A"/>' : f <= 0.001 ? '' : `<path d="M100 100 L100 10 A90 90 0 ${big} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" fill="#FF5A4A"/>`;
    let ticks = ''; for (let i = 0; i < 12; i++) { const t = i / 12 * 2 * Math.PI; ticks += `<line x1="${100 + 96 * Math.sin(t)}" y1="${100 - 96 * Math.cos(t)}" x2="${100 + 86 * Math.sin(t)}" y2="${100 - 86 * Math.cos(t)}" stroke="#1E2433" stroke-width="3" stroke-linecap="round"/>`; }
    return `<svg viewBox="0 0 200 200" data-r="tv"><circle cx="100" cy="100" r="98" fill="#fff" stroke="#1E2433" stroke-width="4"/>${path}${ticks}<circle cx="100" cy="100" r="7" fill="#1E2433"/></svg>`;
  }
  const top = 70 * f, bot = 70 * (1 - f), id = 'g' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="0 0 200 200" data-r="tv"><defs><clipPath id="${id}"><path d="M55 25 H145 C145 70 108 88 104 100 C108 112 145 130 145 175 H55 C55 130 92 112 96 100 C92 88 55 70 55 25Z"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect x="40" y="${98 - top}" width="120" height="${top}" fill="#FFB020"/><rect x="40" y="${175 - bot}" width="120" height="${bot}" fill="#FFB020"/>${f > 0 && f < 1 ? '<rect x="98.5" y="98" width="3" height="77" fill="#FFB020"/>' : ''}</g>
    <path d="M55 25 H145 C145 70 108 88 104 100 C108 112 145 130 145 175 H55 C55 130 92 112 96 100 C92 88 55 70 55 25Z" fill="none" stroke="#1E2433" stroke-width="5" stroke-linejoin="round"/>
    <rect x="44" y="14" width="112" height="12" rx="6" fill="#FF6B4A"/><rect x="44" y="174" width="112" height="12" rx="6" fill="#FF6B4A"/></svg>`;
}

