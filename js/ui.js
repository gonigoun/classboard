// 공통 화면 도구: 아이콘, 알림, 꽃가루, 확인 창, 떠 있는 위젯 창

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const ic = (id) => `<svg class="i"><use href="#i-${id}"/></svg>`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function toast(t, ms = 2600) {
  const e = document.createElement('div'); e.className = 'toast'; e.textContent = t;
  document.body.appendChild(e); setTimeout(() => e.remove(), ms);
}

export function confetti() {
  const cs = ['#2B6CE6', '#FFC72C', '#FF6B4A', '#22A86B', '#7B5CFA'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('i'); c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = cs[i % 5];
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's'; c.style.animationDelay = Math.random() * 0.4 + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 4000);
  }
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
    const sx = e.clientX - w.offsetLeft, sy = e.clientY - w.offsetTop; h.setPointerCapture(e.pointerId);
    h.onpointermove = (ev) => { w.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - sx)) + 'px'; w.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - sy)) + 'px'; };
    h.onpointerup = () => { h.onpointermove = null; remember(); };
  };
  const rs = w.querySelector('.win-rs');
  rs.onpointerdown = (e) => {
    e.preventDefault(); const sx = e.clientX, sy = e.clientY, W0 = w.offsetWidth, H0 = w.offsetHeight; rs.setPointerCapture(e.pointerId);
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
