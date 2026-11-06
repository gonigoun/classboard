// 판서: 펜·음영(네온)·글자·지우개·선택, 그림 붙여 넣기·크기 조절, 크게 보기
// 좌표는 '가로 1400칸' 기준으로 저장해서 TV·노트북·휴대폰 어디서 봐도 같은 모양이에요.
// 선생님 계정으로 여러 화면을 열면 선·글자가 서로 연동돼요 (그림은 그 화면에만).
import { ic, toast } from './ui.js';

// 펜·글자 색: 고운 선생님이 고른 톤 (진한 밤색이 기본)
const PEN = ['#3F1D0B', '#1B4965', '#2B7A78', '#4D96FF', '#FF6B6B', '#FFD93D'];
const PASTEL = ['#FFF176', '#FFCCBC', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD0'];
// 음영: 색을 고르고 글자 위를 끌면 바로 네온색 바탕
const NEON = [['#F4FF2E', '네온 노랑'], ['#3DFF8B', '네온 초록'], ['#FF4FD8', '네온 분홍'], ['#36E7FF', '네온 하늘'], ['#FF9F1C', '네온 주황']];
// 판서 글씨체 (손글씨 느낌). [이름표, 글꼴, 보이는 이름]
const FONTS = [
  ['kyobo', "'KyoboHandwriting2025lyb', 'Noto Sans KR', sans-serif", '교보 손글씨 이유빈'],
  ['poor', "'Poor Story', 'Noto Sans KR', sans-serif", '서툰이야기'],
  ['gaegu', "'Gaegu', 'Noto Sans KR', sans-serif", '개구쟁이'],
  ['pen', "'Nanum Pen Script', 'Nanum Pen', 'Noto Sans KR', sans-serif", '나눔 손글씨 펜'],
  ['single', "'Single Day', 'Noto Sans KR', sans-serif", '싱글데이'],
  ['dokrip', "'Dokrip', 'Noto Sans KR', sans-serif", '윤독립체'],
  ['basic', "'Noto Sans KR', system-ui, sans-serif", '반듯한 글씨 (예전)'],
];
const DEF_FONT = 'kyobo'; // 대표 글꼴: 교보 손글씨 2025 이유빈 · 굵게 없음 · 진한 밤색
const fontOf = (f) => (FONTS.find((x) => x[0] === f) || FONTS.find((x) => x[0] === DEF_FONT))[1];
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* 저장 안 돼도 괜찮음 */ } };

/** 글자 상자 내용 정리: 글자·줄바꿈과 꾸밈(음영·색·크기·굵기)만 남기고,
 *  꾸밈은 글자 조각마다 한 겹으로 펴서 저장해요 (겹겹이 쌓이지 않게) */
const okColor = (v) => /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i.test(v) && !/rgba\([^)]*,\s*0\s*\)/.test(v);
const ratioOf = (fs) => { const m = /var\(--fs\)\s*\*\s*([\d.]+)/.exec(fs || ''); return m ? Math.max(0.2, Math.min(5, +m[1])) : null; };
function styleStr(st) {
  const a = [];
  if (st.bg) a.push(`background-color:${st.bg}`);
  if (st.c) a.push(`color:${st.c}`);
  if (st.r && Math.abs(st.r - 1) > 0.004) a.push(`font-size:calc(var(--fs) * ${+st.r.toFixed(3)})`);
  if (st.b === 1) a.push('font-weight:900'); else if (st.b === 0) a.push('font-weight:500');
  return a.join(';');
}
function cleanHTML(html, keepMark) {
  const t = document.createElement('template'); t.innerHTML = html;
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const styleOf = (el, inh) => {
    const st = { ...inh }, cs = el.style, tag = el.tagName;
    if (tag === 'B' || tag === 'STRONG') st.b = 1;
    if (tag === 'FONT' && okColor(el.getAttribute('color') || '')) st.c = el.getAttribute('color');
    if (cs) {
      const bg = cs.backgroundColor.trim(); if (bg) st.bg = okColor(bg) ? bg : null; // 투명 = 음영 지우기
      const c = cs.color.trim(); if (c && okColor(c)) st.c = c;
      const r = ratioOf(cs.fontSize); if (r) st.r = r;
      const w = cs.fontWeight; if (w) st.b = /bold|[6-9]00/.test(w) ? 1 : 0;
    }
    if (keepMark && el.hasAttribute('data-m')) st.m = 1;
    return st;
  };
  // 글자 조각들로 펴기 → 같은 꾸밈끼리 이어 붙이기
  const walk = (n, st) => {
    let out = '', run = null;
    const flush = () => { if (!run) return; const css = styleStr(run.st); out += css || run.st.m ? `<span${css ? ` style="${css}"` : ''}${run.st.m ? ' data-m="1"' : ''}>${run.h}</span>` : run.h; run = null; };
    const leaf = (h, s2) => { const key = styleStr(s2) + (s2.m ? '|m' : ''); if (run && run.key === key) run.h += h; else { flush(); run = { key, st: s2, h }; } };
    const go = (node, s1) => {
      [...node.childNodes].forEach((c) => {
        if (c.nodeType === 3) { if (c.textContent) leaf(esc(c.textContent), s1); return; }
        if (c.nodeType !== 1) return;
        if (c.tagName === 'BR') { flush(); out += '<br>'; return; }
        if (c.tagName === 'DIV' || c.tagName === 'P') { flush(); const inner = walk(c, styleOf(c, s1)); out += `<div>${inner || '<br>'}</div>`; return; }
        go(c, styleOf(c, s1));
      });
    };
    go(n, st); flush();
    return out;
  };
  return walk(t.content, {});
}
const LW = 1400; // 기준 가로 칸 수 (교실 TV 판서 폭쯤: 글자 크기 140이 TV에서 대략 140px)
const WB = { tool: 'text', pen: { c: PEN[0], w: 4 }, hl: { c: PASTEL[0], w: 28 }, shade: { c: NEON[0][0] }, erase: { w: 40 }, txt: { size: 110, bold: false, c: PEN[0], f: lsGet('wbFont3') || DEF_FONT }, range: null, rangeEd: null, marked: null, strokes: [], hist: [], sel: null, scale: 1, tvAr: 0 };
const TXT_SIZES = [24, 32, 48, 64, 80, 100, 110, 140, 180, 240];
let wbEl = null, wbWidgets = [], sync = null, pendingRemote = null;
const fullCbs = [];
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
export const isPhone = () => matchMedia('(max-width:760px), (max-height:500px)').matches;

export function getWB(headHTML) {
  if (!wbEl) buildWB();
  wbEl.querySelector('.wb-head').innerHTML = headHTML;
  return wbEl;
}
export function setWbHead(headHTML) { if (wbEl) wbEl.querySelector('.wb-head').innerHTML = headHTML; }
export function fitWB() { if (WB.fit) WB.fit(); }
export function wbIsFull() { return !!(wbEl && wbEl.classList.contains('full')); }
export const onWbFull = (cb) => fullCbs.push(cb);

/** 크게 보기일 때 판서 막대에 띄울 위젯 버튼: [[아이콘, 이름, 여는 함수], …] */
export function setWbWidgets(list) { wbWidgets = list || []; if (wbEl) drawWbWidgets(); }
function drawWbWidgets() {
  const g = wbEl.querySelector('[data-r="wx"]');
  g.innerHTML = wbWidgets.map(([i, l], k) => `<button class="tb" data-wx="${k}" title="${l}">${ic(i)}<span>${l}</span></button>`).join('');
  g.querySelectorAll('[data-wx]').forEach((b) => { b.onclick = () => wbWidgets[+b.dataset.wx][2](); });
}

/** 판서 크게 보기에서도 보이는 집중 종 버튼 */
let bellFn = null;
export function setWbBell(fn) { bellFn = fn; }
export function ringWbBell() { const b = wbEl && wbEl.querySelector('.wb-bell'); if (b) { b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); } }

/** 여러 화면 연동: s = { put(item), del(id), clear() } — 내가 그린 것을 보냄 */
export function setWbSync(s) { sync = s; }
/** 큰 화면(TV)의 세로/가로 비율: 휴대폰에 'TV 화면 끝' 선을 그려 줌 */
export function setTvRatio(ar) { WB.tvAr = ar || 0; if (WB.fit) WB.fit(); }
export function myRatio() { return WB.W ? WB.H / WB.W : 0; }
export const wbScale = () => WB.scale;

function buildWB() {
  wbEl = document.createElement('div'); wbEl.className = 'wb-wrap pop';
  wbEl.innerHTML = `<div class="wb-top"><div class="wb-head"></div><button class="wb-close" data-r="close">${ic('x')}판서 닫기</button></div>
   <div class="wb-bar">
     <div class="grp tools">${[['pen', 'pen', '펜'], ['shade', 'marker', '음영'], ['text', 'text', '글자'], ['erase', 'eraser', '지우개'], ['select', 'cursor', '선택']].map(([t, i, l]) => `<button class="tb" data-tool="${t}" title="${l}">${ic(i)}<span>${l}</span></button>`).join('')}</div>
     <div class="grp" data-r="opts"></div>
     <div class="grp acts">
       <button class="tb" data-r="undo" title="되돌리기">${ic('undo')}</button>
       <button class="tb" data-r="img" title="그림 파일 넣기">${ic('image')}<span>그림</span></button>
       <button class="tb" data-r="clear" title="모두 지우기">${ic('trash')}</button>
       <button class="tb" data-r="full">${ic('full')}<span>크게 보기</span></button>
       <input type="file" data-r="file" accept="image/*" hidden>
     </div>
     <div class="grp wb-wx" data-r="wx"></div>
   </div>
   <div class="wb-canvas">
     <div class="wb-objs"></div><canvas class="base"></canvas><canvas class="live"></canvas><div class="tv-edge" hidden><span>TV 화면 끝<em> · 휴대폰을 가로로 돌리면 넓게 써요</em></span></div>
     <button class="wb-bell" data-r="bell" title="집중 종">${ic('bell')}<span>집중</span></button>
     <div class="paste-hint">그림은 Ctrl+V로 붙여 넣거나 끌어다 놓아요 · 판서는 다음 날 지워져요</div>
   </div>`;
  const q = (r) => wbEl.querySelector(`[data-r="${r}"]`);
  const area = wbEl.querySelector('.wb-canvas'), objs = area.querySelector('.wb-objs'), base = area.querySelector('.base'), live = area.querySelector('.live');
  const bx = base.getContext('2d'), lx = live.getContext('2d');
  let W = 0, H = 0;

  // 캔버스를 실제 화면 크기 × 화면 배율로 맞추고, 크기가 바뀌면 저장된 선으로 다시 그림
  function fit() {
    // 열릴 때 움직임(확대 효과) 중에도 정확하도록 실제 배치 크기를 씀
    if (!area.clientWidth || !area.clientHeight) return;
    W = area.clientWidth; H = area.clientHeight; WB.W = W; WB.H = H; WB.scale = W / LW; const d = window.devicePixelRatio || 1;
    [base, live].forEach((c) => { c.width = Math.round(W * d); c.height = Math.round(H * d); c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); });
    objs.querySelectorAll('.obj').forEach(place);
    const edge = area.querySelector('.tv-edge'), ey = WB.tvAr * W;
    edge.hidden = !(isPhone() && WB.tvAr && ey < H - 4);
    if (!edge.hidden) edge.style.top = ey + 'px';
    redraw();
  }
  WB.fit = fit; new ResizeObserver(fit).observe(area);
  function redraw() { bx.clearRect(0, 0, W, H); WB.strokes.forEach((s) => stroke(bx, s)); }
  function stroke(ctx, s) {
    const p = s.pts, k = WB.scale; ctx.save();
    if (s.t === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = s.c; ctx.globalAlpha = s.t === 'hl' ? 0.5 : 1; }
    ctx.lineWidth = Math.max(s.t === 'erase' ? 6 : 1.2, s.w * k); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(p[0] * k, p[1] * k);
    const n = p.length / 2;
    if (n < 3) ctx.lineTo(p[p.length - 2] * k + 0.01, p[p.length - 1] * k);
    else {
      for (let i = 1; i < n - 1; i++) { const x = p[i * 2], y = p[i * 2 + 1], mx = (x + p[i * 2 + 2]) / 2, my = (y + p[i * 2 + 3]) / 2; ctx.quadraticCurveTo(x * k, y * k, mx * k, my * k); }
      ctx.lineTo(p[p.length - 2] * k, p[p.length - 1] * k);
    }
    ctx.stroke(); ctx.restore();
  }
  // 화면 위치 → 기준 좌표
  const pt = (e) => { const r = base.getBoundingClientRect(), z = r.width ? W / r.width : 1; return [(e.clientX - r.left) * z / WB.scale, (e.clientY - r.top) * z / WB.scale]; };

  // 그리기: 손가락·펜 하나만 따라가고, 빠르게 그어도 중간 점을 모두 받아 부드러운 곡선으로
  let cur = null, pid = null;
  area.addEventListener('pointerdown', (e) => {
    const t = WB.tool;
    if (t === 'text') { if (e.target.closest('.obj')) return; e.preventDefault(); const [x, y] = pt(e); addText(x, y); return; }
    if (t === 'shade') { if (!e.target.closest('.obj.txt')) { select(null); window.getSelection().removeAllRanges(); } return; } // 음영: 글자 상자 안에서 끌어서 고르기만
    if (t === 'select') { if (!e.target.closest('.obj')) select(null); return; }
    if (cur || e.button > 0) return;
    e.preventDefault(); pid = e.pointerId; try { area.setPointerCapture(pid); } catch (er) { /* 손가락을 놓친 경우에도 그리기는 계속 */ } select(null);
    const o = WB[t]; const p = pt(e); cur = { id: uid(), t, c: o.c, w: o.w, pts: [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10] };
    if (t === 'erase') eraseSeg(p, p); else renderLive();
  });
  area.addEventListener('pointermove', (e) => {
    if (!cur || e.pointerId !== pid) return;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pt(ev), l = [cur.pts[cur.pts.length - 2], cur.pts[cur.pts.length - 1]];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) * WB.scale < 0.8) continue;
      if (cur.t === 'erase') eraseSeg(l, p);
      cur.pts.push(Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10);
    }
    if (cur.t !== 'erase') renderLive();
  });
  const end = (e) => {
    if (!cur || e.pointerId !== pid) return;
    cur.at = Date.now();
    WB.strokes.push(cur); WB.hist.push({ k: 's', id: cur.id });
    if (cur.t !== 'erase') { lx.clearRect(0, 0, W, H); stroke(bx, cur); }
    if (sync) sync.put({ id: cur.id, k: 's', t: cur.t, c: cur.c || '', w: cur.w, pts: cur.pts, at: cur.at });
    cur = null; pid = null;
  };
  area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  // 음영: 글자 위를 끌어서 손을 떼면 바로 음영이 들어가요
  let ptrDown = false;
  area.addEventListener('pointerdown', () => { ptrDown = true; }, true);
  addEventListener('pointerup', (e) => {
    if (!ptrDown) return; ptrDown = false;
    if (WB.tool === 'shade' && e.pointerType !== 'touch') setTimeout(shadeNow, 0);
  }, true);
  function renderLive() { lx.clearRect(0, 0, W, H); stroke(lx, cur); }
  function eraseSeg(a, b) { const k = WB.scale; bx.save(); bx.globalCompositeOperation = 'destination-out'; bx.lineCap = 'round'; bx.lineWidth = Math.max(6, WB.erase.w * k); bx.beginPath(); bx.moveTo(a[0] * k, a[1] * k); bx.lineTo(b[0] * k + 0.01, b[1] * k); bx.stroke(); bx.restore(); }

  // 글자·그림 상자 (위치·크기는 기준 좌표 o._g = {x,y,w,h})
  function place(o) {
    const g = o._g, k = WB.scale;
    o.style.left = g.x * k + 'px'; o.style.top = g.y * k + 'px';
    if (g.w) o.style.width = g.w * k + 'px'; if (g.h) o.style.height = g.h * k + 'px';
    if (o._t && !g.w) o.style.maxWidth = Math.max(60, (LW - g.x) * k) + 'px'; // 판서 오른쪽 끝(기준 폭)에서 줄바꿈 — 휴대폰·TV 같은 자리
    if (o._t) applyTxt(o);
  }
  function makeObj(cls, x, y, id) {
    const o = document.createElement('div'); o.className = 'obj ' + cls; o._id = id || uid(); o._g = { x, y };
    o.insertAdjacentHTML('beforeend', `<div class="grip">${ic('cursor')}옮기기</div><button class="del" title="지우기">${ic('x')}</button>`);
    objs.appendChild(o); WB.hist.push({ k: 'o', el: o });
    o.querySelector('.del').onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); deleteObj(o); };
    o.querySelector('.grip').onpointerdown = (e) => drag(e, o, 'move');
    o.addEventListener('pointerdown', (e) => {
      if (WB.tool !== 'select' && WB.tool !== 'text' && WB.tool !== 'shade') return;
      select(o);
      if (o.classList.contains('img') && !e.target.closest('.hd,.del')) drag(e, o, 'move');
    });
    return o;
  }
  /* ---------- 되돌리기 기록 ----------
   * s: 그은 선 · o: 새로 만든 상자 · t: 상자를 바꾸기 전 모습(글자·꾸밈·크기·자리) · d: 지운 상자 */
  function stateOf(o) {
    const ed = o._t && o.querySelector('[contenteditable]');
    return { g: { ...o._g }, t: o._t ? { ...o._t } : null, html: ed ? cleanHTML(ed.innerHTML) : null };
  }
  /** 바꾸기 직전에 부름. 같은 종류를 잇달아 바꾸면(글자 치기·크기 칸 입력) 한 번으로 묶어요 */
  function snap(o, tag) {
    if (!o || !o.isConnected) return;
    const last = WB.hist[WB.hist.length - 1], now = Date.now();
    if (tag && last && last.k === 't' && last.el === o && last.tag === tag && now - last.at < 1500) { last.at = now; return; }
    WB.hist.push({ k: 't', el: o, tag, at: now, ...stateOf(o) });
  }
  function restore(o, st) {
    o._g = { ...st.g }; if (st.t) o._t = { ...st.t };
    if (st.html != null) { const ed = o.querySelector('[contenteditable]'); ed.innerHTML = st.html; }
    if (WB.sel === o) forget();
    place(o);
    if (WB.sel === o && o._t && WB.tool === 'text') { WB.txt = { ...o._t }; renderOpts(); }
    sendTxt(o);
  }
  function undo() {
    // 크기 칸에 적던 값이 되돌린 뒤에 다시 들어가지 않게 (칸에서 나갈 때 한 번 더 적용되는 것 막기)
    const ae = document.activeElement;
    if (ae && ae.dataset && ae.dataset.r === 'txSize') { ae.onchange = null; ae.blur(); }
    let h;
    while ((h = WB.hist.pop())) {
      if (h.k === 's') { const i = WB.strokes.findIndex((s) => s.id === h.id); if (i < 0) continue; WB.strokes.splice(i, 1); redraw(); if (sync) sync.del(h.id); return true; }
      if (h.k === 'o') { if (!h.el.isConnected) continue; removeObj(h.el, true); return true; }
      if (h.k === 'd') { if (h.el.isConnected) continue; objs.appendChild(h.el); place(h.el); h.el._at = Date.now(); sendTxt(h.el); return true; }
      if (h.k === 't') {
        if (!h.el.isConnected) continue;
        const cur = stateOf(h.el);
        if (JSON.stringify(cur) === JSON.stringify({ g: h.g, t: h.t, html: h.html })) continue; // 바뀐 게 없으면 하나 더 되돌림
        if (h.html != null && !h.html.replace(/<[^>]+>/g, '').trim()) { removeObj(h.el, true); return true; } // 빈 상자로 돌아가면 상자를 지움
        restore(h.el, h); return true;
      }
    }
    toast('더 되돌릴 게 없어요');
    return false;
  }
  WB.undo = undo;
  /** 사용자가 상자를 지움 (되돌리기로 살릴 수 있게) */
  function deleteObj(o) { if (!o || !o.isConnected) return; WB.hist.push({ k: 'd', el: o }); removeObj(o, true); }

  function removeObj(o, send) {
    o.remove(); if (WB.sel === o) select(null);
    if (send && sync && o._t) sync.del(o._id);
  }
  function drag(e, o, mode) {
    e.preventDefault(); e.stopPropagation(); select(o);
    const k = WB.scale, sx = e.clientX, sy = e.clientY, g0 = { ...o._g, w: o.offsetWidth / k, h: o.offsetHeight / k }, ratio = g0.w / g0.h, s0 = o._t && o._t.size;
    const mv = (ev) => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if (mode === 'move') { o._g.x = g0.x + dx; o._g.y = g0.y + dy; }
      else if (mode === 'fs') { // 글상자 모서리: 글자 전체 크기를 한꺼번에 (고른 글자 크기 비율은 그대로)
        const f = Math.max(0.1, Math.max((g0.w + dx) / g0.w, (g0.h + dy) / g0.h));
        o._t.size = Math.max(10, Math.min(400, Math.round(s0 * f)));
        if (WB.sel === o && WB.tool === 'text') { WB.txt.size = o._t.size; showSize(); }
      }
      else if (mode === 'e') o._g.w = Math.max(40, g0.w + dx);
      else if (mode === 's') o._g.h = Math.max(30, g0.h + dy);
      else { const d = Math.abs(dx) > Math.abs(dy * ratio) ? dx : dy * ratio; o._g.w = Math.max(40, g0.w + d); o._g.h = o._g.w / ratio; }
      place(o);
    };
    const before = stateOf(o);
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (JSON.stringify(stateOf(o)) !== JSON.stringify(before)) WB.hist.push({ k: 't', el: o, at: Date.now(), ...before });
      sendTxt(o);
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function addImage(src) {
    const im = new Image();
    im.onload = () => {
      const w = Math.min(im.naturalWidth / WB.scale, LW * 0.45), h = w * im.naturalHeight / im.naturalWidth;
      const o = makeObj('img', (LW - w) / 2, Math.max(16, (H / WB.scale - h) / 2)); o._g.w = w; o._g.h = h;
      o.insertAdjacentHTML('afterbegin', `<img src="${src}" alt="">`);
      o.insertAdjacentHTML('beforeend', '<span class="hd se" title="비율 유지"></span><span class="hd e"></span><span class="hd s"></span>');
      o.querySelectorAll('.hd').forEach((hd) => { hd.onpointerdown = (e) => drag(e, o, hd.classList[1]); });
      place(o); setTool('select'); select(o);
    };
    im.src = src;
  }
  WB.addImage = addImage;
  function addText(x, y, data) {
    const t = data ? { size: data.size, bold: data.bold, c: data.c, f: data.f || 'basic' } : { ...WB.txt };
    const o = makeObj('txt', x, data ? y : y - t.size * 0.6, data && data.id); o._t = t;
    const ed = document.createElement('div'); ed.contentEditable = 'true';
    // 맞춤법·띄어쓰기 빨간 밑줄과 자동 고침은 판서에서 끔 (화면이 지저분해 보여서)
    ed.spellcheck = false; ed.setAttribute('autocorrect', 'off'); ed.setAttribute('autocapitalize', 'off'); ed.setAttribute('autocomplete', 'off');
    o.appendChild(ed);
    // 테두리 둘레 어디를 잡아도 옮길 수 있게 (위·아래·왼쪽·오른쪽 띠)
    ['t', 'r', 'b', 'l'].forEach((k) => { const g = document.createElement('span'); g.className = 'edge ' + k; g.title = '끌어서 옮기기'; g.onpointerdown = (e) => drag(e, o, 'move'); o.appendChild(g); });
    const hd = document.createElement('span'); hd.className = 'hd se fs'; hd.title = '끌어서 글자 전체 크기 바꾸기'; hd.onpointerdown = (e) => drag(e, o, 'fs'); o.appendChild(hd);
    if (data) { if (data.html) ed.innerHTML = cleanHTML(data.html); else ed.textContent = data.text || ''; }
    place(o);
    ed.addEventListener('paste', (e) => { const s = e.clipboardData.getData('text/plain'); if (s) { e.preventDefault(); document.execCommand('insertText', false, s); } });
    // 글자 치기: 잠깐(1.5초) 쉬었다 다시 치면 그때마다 되돌릴 자리를 하나씩 남겨요 (새 상자의 첫 묶음은 '상자 만들기'로 되돌림)
    if (!data) o._fresh = true;
    ed.addEventListener('beforeinput', (e) => {
      if (/^history/.test(e.inputType)) { e.preventDefault(); return; }
      const now = Date.now();
      if (!o._typeAt || now - o._typeAt > 1500) { if (o._fresh) o._fresh = false; else snap(o); }
      o._typeAt = now;
    });
    ed.addEventListener('input', () => { clearTimeout(o._tm); o._tm = setTimeout(() => sendTxt(o), 600); });
    ed.addEventListener('blur', () => { if (!ed.textContent.trim()) removeObj(o, true); else sendTxt(o); });
    ed.addEventListener('focus', () => select(o));
    if (!data) { select(o); setTimeout(() => ed.focus(), 0); }
    return o;
  }
  function sendTxt(o) {
    if (!sync || !o._t || !o.isConnected) return;
    // 줄바꿈(엔터)까지 그대로 보냄: 글자만 보내면 두 줄이 한 줄로 붙어 버려요
    const ed = o.querySelector('[contenteditable]'), text = ed.innerText.replace(/\n$/, '');
    if (!text.trim()) return;
    const html = /<(span|div|br|p)\b/i.test(ed.innerHTML) ? cleanHTML(ed.innerHTML) : '';
    sync.put({ id: o._id, k: 't', x: Math.round(o._g.x), y: Math.round(o._g.y), size: o._t.size, bold: !!o._t.bold, c: o._t.c, f: o._t.f || DEF_FONT, text, html, at: o._at || (o._at = Date.now()) });
  }
  function applyTxt(o) {
    const ed = o.querySelector('[contenteditable]'), t = o._t;
    ed.style.setProperty('--fs', t.size * WB.scale + 'px'); ed.style.fontSize = 'var(--fs)';
    ed.style.fontFamily = fontOf(t.f); ed.style.fontWeight = t.bold ? 900 : 500; ed.style.color = t.c;
  }
  function applySel(tag) { if (WB.sel && WB.sel.classList.contains('txt')) { snap(WB.sel, tag || 'box'); WB.sel._t = { ...WB.txt }; applyTxt(WB.sel); sendTxt(WB.sel); } }

  /* ---------- 끌어서 고른 글자만 꾸미기 (크기·색·굵기·음영) ---------- */
  const edOf = (node) => { const el = node && (node.nodeType === 1 ? node : node.parentElement); const ed = el && el.closest('.obj.txt [contenteditable]'); return ed && wbEl.contains(ed) ? ed : null; };
  const hasRange = () => !!(WB.range && WB.rangeEd && WB.rangeEd.isConnected && !WB.range.collapsed && WB.range.toString().trim());
  function clearMarks() {
    if (WB.marked) WB.marked.forEach((m) => { m.removeAttribute('data-m'); if (!m.getAttribute('style') && m.isConnected) m.replaceWith(...m.childNodes); });
    WB.marked = null;
  }
  function forget() { clearMarks(); WB.range = null; WB.rangeEd = null; showSize(); }
  let selfSel = false;
  document.addEventListener('selectionchange', () => {
    if (selfSel || !wbEl.isConnected) return;
    const sel = window.getSelection(); if (!sel.rangeCount) return;
    const r = sel.getRangeAt(0), ed = edOf(r.commonAncestorContainer);
    if (!ed) return; // 크기 칸 등 다른 곳을 눌러도 고른 글자는 기억해 둬요
    const ae = document.activeElement; if (ae && ae !== ed && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(ae.tagName)) return;
    clearMarks();
    if (r.collapsed) { WB.range = null; WB.rangeEd = null; } else { WB.range = r.cloneRange(); WB.rangeEd = ed; }
    showSize();
    if (WB.tool === 'shade' && !ptrDown) { clearTimeout(WB.shTm); WB.shTm = setTimeout(shadeNow, 700); } // 휴대폰: 손잡이로 고르기를 마치면
  });
  /** 고른 글자에 꾸밈 넣기: { r: 크기 비율, c: 색, b: 굵게 1/0, bg: 음영(null=지우기) } */
  function styleRange(props) {
    const css = (sp) => {
      if ('r' in props) sp.style.fontSize = `calc(var(--fs) * ${+props.r.toFixed(3)})`;
      if ('c' in props) sp.style.color = props.c;
      if ('b' in props) sp.style.fontWeight = props.b ? 900 : 500;
      if ('bg' in props) sp.style.backgroundColor = props.bg || 'transparent';
    };
    const ed = WB.rangeEd, o = ed && ed.closest('.obj');
    if (WB.marked && WB.marked.length && WB.marked.every((m) => m.isConnected)) { WB.marked.forEach(css); sendTxt(o); return true; }
    if (!hasRange()) return false;
    snap(o);
    const r = WB.range, sc = r.startContainer, so = r.startOffset, ec = r.endContainer, eo = r.endOffset;
    const tw = document.createTreeWalker(ed, NodeFilter.SHOW_TEXT), nodes = [];
    for (let n = tw.nextNode(); n; n = tw.nextNode()) if (n.length && r.intersectsNode(n)) nodes.push(n);
    nodes.forEach((n) => {
      let a = 0, b = n.length; if (n === sc) a = so; if (n === ec) b = eo; if (a >= b) return;
      let t = n; if (b < t.length) t.splitText(b); if (a > 0) t = t.splitText(a);
      const sp = document.createElement('span'); sp.setAttribute('data-m', '1'); t.parentNode.insertBefore(sp, t); sp.appendChild(t); css(sp);
    });
    ed.innerHTML = cleanHTML(ed.innerHTML, true); // 한 겹으로 정리 (고른 부분 표시는 남김)
    WB.marked = [...ed.querySelectorAll('[data-m]')];
    if (WB.marked.length) {
      const nr = document.createRange(); nr.setStartBefore(WB.marked[0]); nr.setEndAfter(WB.marked[WB.marked.length - 1]);
      WB.range = nr;
      if (document.activeElement === ed) { selfSel = true; const s2 = window.getSelection(); s2.removeAllRanges(); s2.addRange(nr.cloneRange()); setTimeout(() => { selfSel = false; }, 0); }
    }
    sendTxt(o);
    return true;
  }
  /** 고른 글자의 지금 꾸밈 (첫 글자 기준) */
  function rangeStyle() {
    if (!hasRange()) return null;
    const tw = document.createTreeWalker(WB.rangeEd, NodeFilter.SHOW_TEXT);
    let n = tw.nextNode(); while (n && !(n.length && WB.range.intersectsNode(n) && !(n === WB.range.startContainer && WB.range.startOffset >= n.length))) n = tw.nextNode();
    if (!n) return null;
    const el = n.parentElement, cs = getComputedStyle(el), base = WB.rangeEd.closest('.obj')._t;
    let r = 1; for (let x = el; x && x !== WB.rangeEd; x = x.parentElement) { const v = ratioOf(x.style.fontSize); if (v) { r = v; break; } }
    return { size: Math.round(base.size * r), r, bold: +cs.fontWeight >= 700 };
  }
  /** 글자 크기 칸과 '고른 글자 / 상자 전체' 표시 맞추기 */
  function showSize() {
    const box = q('opts'), inp = box && box.querySelector('[data-r="txSize"]'), lab = box && box.querySelector('.txscope');
    if (!inp) return;
    const rs = WB.tool === 'text' && WB.sel && hasRange() && WB.sel.contains(WB.rangeEd) ? rangeStyle() : null;
    if (document.activeElement !== inp) inp.value = rs ? rs.size : WB.txt.size;
    if (lab) { lab.textContent = rs ? '고른 글자' : '상자 전체'; lab.classList.toggle('on', !!rs); }
  }
  /** 음영 도구: 고른 글자에 바로 음영 (지우개 모드면 지우기) */
  function shadeNow() {
    clearTimeout(WB.shTm);
    if (WB.tool !== 'shade' || !hasRange()) return;
    styleRange({ bg: WB.shade.c });
    forget(); window.getSelection().removeAllRanges(); // 고른 표시를 걷어 내야 음영이 바로 보여요
  }
  function select(o) {
    if (WB.sel !== o) forget();
    if (WB.sel && WB.sel !== o) WB.sel.classList.remove('sel');
    WB.sel = o;
    if (o) { o.classList.add('sel'); if (o._t && WB.tool === 'text') { WB.txt = { ...o._t }; renderOpts(); } }
  }

  /** 다른 화면에서 온 선·글자 목록으로 맞춤 (내가 방금 그린 건 그대로 둠) */
  WB.applyRemote = (list, pendingIds) => {
    const S = list.filter((d) => d.k === 's').sort((a, b) => (a.at - b.at) || (a.id < b.id ? -1 : 1));
    const ids = new Set(S.map((d) => d.id));
    const keepLocal = WB.strokes.filter((s) => !ids.has(s.id) && pendingIds.has(s.id));
    WB.strokes = [...S.map((d) => ({ id: d.id, t: d.t, c: d.c, w: d.w, pts: d.pts, at: d.at })), ...keepLocal];
    const have = new Set(WB.strokes.map((s) => s.id));
    WB.hist = WB.hist.filter((h) => h.k !== 's' || have.has(h.id));
    redraw();
    const T = list.filter((d) => d.k === 't'), tids = new Set(T.map((d) => d.id));
    objs.querySelectorAll('.obj.txt').forEach((o) => { if (!tids.has(o._id) && !pendingIds.has(o._id) && o._synced) removeObj(o, false); });
    T.forEach((d) => {
      let o = [...objs.querySelectorAll('.obj.txt')].find((x) => x._id === d.id);
      if (!o) { o = addText(d.x, d.y, d); WB.hist = WB.hist.filter((h) => h.el !== o); o._synced = true; o._at = d.at; return; }
      o._synced = true;
      const ed = o.querySelector('[contenteditable]');
      if (document.activeElement === ed || pendingIds.has(d.id)) return; // 내가 쓰는 중이면 그대로
      o._g.x = d.x; o._g.y = d.y; o._t = { size: d.size, bold: d.bold, c: d.c, f: d.f || 'basic' };
      if (d.html) { const h = cleanHTML(d.html); if (cleanHTML(ed.innerHTML) !== h) ed.innerHTML = h; }
      else if (ed.innerText.replace(/\n$/, '') !== d.text || /<(span|div|br)\b/i.test(ed.innerHTML)) ed.textContent = d.text;
      place(o);
    });
  };

  // 도구와 세부 설정
  function setTool(t) {
    WB.tool = t; area.dataset.tool = t;
    wbEl.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('sel', b.dataset.tool === t));
    if (t !== 'select' && t !== 'text') select(null);
    renderOpts();
  }
  function renderOpts() {
    const t = WB.tool, box = q('opts');
    const sw = (arr, c) => arr.map((x) => `<span class="sw ${x === c ? 'sel' : ''}" data-c="${x}" style="background:${x}"></span>`).join('');
    const sz = (arr, w, col) => arr.map((x) => `<button class="sz ${x === w ? 'sel' : ''}" data-w="${x}" title="${x}"><i style="width:${Math.min(x, 30)}px;height:${Math.min(x, 30)}px;background:${col}"></i></button>`).join('');
    let h = '';
    if (t === 'pen') h = sw(PEN, WB.pen.c) + sz([2, 4, 8, 14], WB.pen.w, WB.pen.c);
    else if (t === 'hl') h = sw(PASTEL, WB.hl.c) + sz([16, 28, 44], WB.hl.w, WB.hl.c);
    else if (t === 'shade') h = NEON.map(([c, n]) => `<button class="neo ${c === WB.shade.c ? 'sel' : ''}" data-neo="${c}" title="${n}" style="--n:${c}"><i></i></button>`).join('')
      + `<button class="tb ${WB.shade.c ? '' : 'sel'}" data-r="unshade" title="끌어서 음영 지우기">${ic('eraser')}<span>음영 지우기</span></button><span class="hint shade-hint">${WB.shade.c ? '색을 고르고 글자 위를 끌면 바로 칠해져요' : '음영 위를 끌면 지워져요'}</span>`;
    else if (t === 'erase') h = sz([20, 40, 80], WB.erase.w, '#C5CCDA');
    else if (t === 'text') h = `<label class="txsz" title="글자 크기: 글자를 끌어서 고르면 고른 글자만, 안 고르면 상자 전체가 바뀌어요"><input type="number" data-r="txSize" min="10" max="400" step="1" list="wbTxSizes" value="${WB.txt.size}"><datalist id="wbTxSizes">${TXT_SIZES.map((s) => `<option value="${s}">`).join('')}</datalist><span class="txscope">상자 전체</span></label>
        <button class="tb ${WB.txt.bold ? 'sel' : ''}" data-r="txBold" style="font-weight:900">굵게</button>` + sw(PEN, WB.txt.c) + `<select data-r="txFont" title="글씨체" style="font-family:${fontOf(WB.txt.f).replace(/"/g, '')}">${FONTS.map(([k, f, n]) => `<option value="${k}" ${k === WB.txt.f ? 'selected' : ''} style="font-family:${f.replace(/"/g, '')}">${n}</option>`).join('')}</select>`;
    else h = '<span class="hint">그림·글자를 끌어 옮기고, 모서리 네모를 끌어 크기를 바꿔요</span>';
    box.innerHTML = h;
    box.querySelectorAll('[data-c]').forEach((s) => {
      s.onpointerdown = (e) => {
        e.preventDefault();
        if (t === 'text' && WB.sel && hasRange() && WB.sel.contains(WB.rangeEd)) { styleRange({ c: s.dataset.c }); return; } // 고른 글자만
        (t === 'text' ? WB.txt : WB[t]).c = s.dataset.c; if (t === 'text') applySel(); renderOpts();
      };
    });
    box.querySelectorAll('[data-w]').forEach((s) => { s.onclick = () => { WB[t].w = +s.dataset.w; renderOpts(); }; });
    const ts = box.querySelector('[data-r="txSize"]');
    if (ts) {
      const setSize = (fix) => {
        const v = Math.round(+ts.value); if (!v) return; const c = Math.max(10, Math.min(400, v)); if (fix) ts.value = c;
        if (WB.sel && hasRange() && WB.sel.contains(WB.rangeEd)) { styleRange({ r: c / WB.sel._t.size }); return; } // 고른 글자만
        WB.txt.size = c; applySel('size');
      };
      ts.oninput = () => setSize(false);
      ts.onchange = () => setSize(true);
      ts.onkeydown = (e) => { if (e.key === 'Enter') { setSize(true); ts.blur(); } if (!(e.ctrlKey || e.metaKey)) e.stopPropagation(); }; // Ctrl+Z는 판서 되돌리기로
    }
    // 음영 색 고르기 (이미 고른 글자가 있으면 바로 칠함)
    box.querySelectorAll('[data-neo]').forEach((b) => { b.onpointerdown = (e) => { e.preventDefault(); WB.shade.c = b.dataset.neo; shadeNow(); renderOpts(); }; });
    const us = box.querySelector('[data-r="unshade"]'); if (us) us.onpointerdown = (e) => { e.preventDefault(); WB.shade.c = null; shadeNow(); renderOpts(); };
    const tb = box.querySelector('[data-r="txBold"]');
    if (tb) tb.onpointerdown = (e) => {
      e.preventDefault();
      if (WB.sel && hasRange() && WB.sel.contains(WB.rangeEd)) { const rs = rangeStyle(); styleRange({ b: rs && rs.bold ? 0 : 1 }); return; }
      WB.txt.bold = !WB.txt.bold; applySel(); renderOpts();
    };
    const tf = box.querySelector('[data-r="txFont"]');
    if (tf) tf.onchange = () => { WB.txt.f = tf.value; lsSet('wbFont3', tf.value); if (WB.sel && WB.sel._t) { snap(WB.sel); WB.sel._t.f = tf.value; applyTxt(WB.sel); sendTxt(WB.sel); } renderOpts(); };
    showSize();
  }
  wbEl.querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
  q('undo').onpointerdown = (e) => e.preventDefault(); // 글자를 쓰던 중에 눌러도 글자 상자가 닫히지 않게
  q('undo').onclick = () => undo();
  WB.clearLocal = () => { WB.strokes = []; WB.hist = []; objs.innerHTML = ''; select(null); redraw(); };
  q('clear').onclick = () => { WB.clearLocal(); if (sync) sync.clear(); };
  q('img').onclick = () => q('file').click();
  q('file').onchange = (e) => { const f = e.target.files[0]; if (f) addImage(URL.createObjectURL(f)); e.target.value = ''; };
  q('full').onclick = () => setWbFull(!wbEl.classList.contains('full'));
  q('close').onclick = () => setWbFull(false);
  q('bell').addEventListener('pointerdown', (e) => e.stopPropagation()); // 종을 눌러도 그림·글자가 생기지 않게
  q('bell').onclick = (e) => { e.stopPropagation(); if (bellFn) bellFn(); else ringWbBell(); };
  area.addEventListener('dragover', (e) => e.preventDefault());
  area.addEventListener('drop', (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) addImage(URL.createObjectURL(f)); });
  WB.del = () => { if (WB.sel) deleteObj(WB.sel); };
  drawWbWidgets();
  setTool('text'); // 판서를 열면 글자 쓰기부터 (교사용 노트북·휴대폰 모두)
  if (pendingRemote) { const [l, p] = pendingRemote; pendingRemote = null; WB.applyRemote(l, p || new Set()); }
}

/** 다른 화면에서 온 판서 목록 반영 (판서를 아직 안 열었으면 열 때 반영) */
export function applyRemote(list, pendingIds) {
  if (wbEl && WB.applyRemote) WB.applyRemote(list, pendingIds || new Set());
  else pendingRemote = [list, pendingIds];
}

export function setWbFull(on) {
  if (!wbEl) return;
  wbEl.classList.toggle('full', on);
  document.body.classList.toggle('wb-full', on);
  wbEl.querySelector('[data-r="full"] span').textContent = on ? (isPhone() ? '판서 닫기' : '원래 크기') : '크게 보기';
  try {
    if (on && !document.fullscreenElement && !isPhone()) document.documentElement.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) { /* 전체 화면을 지원하지 않는 브라우저 */ }
  requestAnimationFrame(() => { fitWB(); fullCbs.forEach((cb) => cb(on)); });
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && wbIsFull() && !isPhone()) setWbFull(false); });
document.addEventListener('keydown', (e) => {
  if (!wbEl || !wbEl.isConnected) return;
  const editing = document.activeElement && document.activeElement.isContentEditable;
  if (e.key === 'Escape' && wbIsFull()) setWbFull(false);
  // Ctrl+Z (맥은 ⌘+Z): 판서 되돌리기 — 글자를 쓰는 중에도 판서 기록으로 되돌려요
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === 'z' || e.key === 'Z' || e.code === 'KeyZ') && wbEl.getClientRects().length) {
    const ae = document.activeElement;
    if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) && !wbEl.contains(ae)) return; // 설정 창 등 다른 입력 칸은 원래대로
    e.preventDefault(); WB.undo();
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && !editing && WB.sel && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); WB.del(); }
});
document.addEventListener('paste', (e) => {
  if (!wbEl || !wbEl.isConnected) return;
  const it = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.type.startsWith('image/'));
  if (!it) return; e.preventDefault(); WB.addImage(URL.createObjectURL(it.getAsFile()));
});
