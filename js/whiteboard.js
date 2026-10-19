// 판서: 펜·형광펜·글자·지우개·선택, 그림 붙여 넣기·크기 조절, 크게 보기 (판서는 저장하지 않음)
import { ic } from './ui.js';

const PEN = ['#1E2433', '#E5484D', '#2B6CE6', '#22A86B', '#7B5CFA', '#FF8A00'];
const PASTEL = ['#FFF176', '#FFCCBC', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD0'];
const WB = { tool: 'pen', pen: { c: PEN[0], w: 4 }, hl: { c: PASTEL[0], w: 28 }, erase: { w: 40 }, txt: { size: 140, bold: false, c: PEN[0] }, strokes: [], hist: [], sel: null };
let wbEl = null, wbWidgets = [];
const TXT_SIZES = [24, 32, 48, 64, 80, 100, 140, 180, 240];

/** 크게 보기일 때 판서 막대에 띄울 위젯 버튼: [[아이콘, 이름, 여는 함수], …] */
export function setWbWidgets(list) { wbWidgets = list || []; if (wbEl) drawWbWidgets(); }
function drawWbWidgets() {
  const g = wbEl.querySelector('[data-r="wx"]');
  g.innerHTML = wbWidgets.map(([i, l], k) => `<button class="tb" data-wx="${k}" title="${l}">${ic(i)}${l}</button>`).join('');
  g.querySelectorAll('[data-wx]').forEach((b) => { b.onclick = () => wbWidgets[+b.dataset.wx][2](); });
}

export function getWB(headHTML) {
  if (!wbEl) buildWB();
  wbEl.querySelector('.wb-head').innerHTML = headHTML;
  return wbEl;
}
export function fitWB() { if (WB.fit) WB.fit(); }
export function wbIsFull() { return !!(wbEl && wbEl.classList.contains('full')); }

function buildWB() {
  wbEl = document.createElement('div'); wbEl.className = 'wb-wrap pop';
  wbEl.innerHTML = `<div class="wb-head"></div>
   <div class="wb-bar">
     <div class="grp">${[['pen', 'pen', '펜'], ['hl', 'marker', '형광펜'], ['text', 'text', '글자'], ['erase', 'eraser', '지우개'], ['select', 'cursor', '선택']].map(([t, i, l]) => `<button class="tb" data-tool="${t}">${ic(i)}${l}</button>`).join('')}</div>
     <div class="grp" data-r="opts"></div>
     <div class="grp">
       <button class="tb" data-r="undo" title="되돌리기">${ic('undo')}</button>
       <button class="tb" data-r="img" title="그림 파일 넣기">${ic('image')}그림</button>
       <button class="tb" data-r="clear" title="모두 지우기">${ic('trash')}</button>
       <button class="tb" data-r="full">${ic('full')}<span>크게 보기</span></button>
       <input type="file" data-r="file" accept="image/*" hidden>
     </div>
     <div class="grp wb-wx" data-r="wx"></div>
   </div>
   <div class="wb-canvas">
     <div class="wb-objs"></div><canvas class="base"></canvas><canvas class="live"></canvas>
     <div class="paste-hint">그림은 Ctrl+V로 붙여 넣거나 끌어다 놓아요 · 판서는 저장되지 않아요</div>
   </div>`;
  const q = (r) => wbEl.querySelector(`[data-r="${r}"]`);
  const area = wbEl.querySelector('.wb-canvas'), objs = area.querySelector('.wb-objs'), base = area.querySelector('.base'), live = area.querySelector('.live');
  const bx = base.getContext('2d'), lx = live.getContext('2d');
  let W = 0, H = 0;

  // 캔버스를 실제 화면 크기 × 화면 배율로 맞추고, 크기가 바뀌면 저장된 선으로 다시 그림
  function fit() {
    const r = area.getBoundingClientRect(); if (!r.width || !r.height) return;
    W = r.width; H = r.height; const d = window.devicePixelRatio || 1;
    [base, live].forEach((c) => { c.width = Math.round(W * d); c.height = Math.round(H * d); c.getContext('2d').setTransform(d, 0, 0, d, 0, 0); });
    redraw();
  }
  WB.fit = fit; new ResizeObserver(fit).observe(area);
  function redraw() { bx.clearRect(0, 0, W, H); WB.strokes.forEach((s) => stroke(bx, s)); }
  function stroke(ctx, s) {
    const p = s.pts; ctx.save();
    if (s.t === 'erase') { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
    else { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = s.c; ctx.globalAlpha = s.t === 'hl' ? 0.5 : 1; }
    ctx.lineWidth = s.w; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]);
    if (p.length < 3) ctx.lineTo(p[p.length - 1][0] + 0.01, p[p.length - 1][1]);
    else {
      for (let i = 1; i < p.length - 1; i++) { const mx = (p[i][0] + p[i + 1][0]) / 2, my = (p[i][1] + p[i + 1][1]) / 2; ctx.quadraticCurveTo(p[i][0], p[i][1], mx, my); }
      const l = p[p.length - 1]; ctx.lineTo(l[0], l[1]);
    }
    ctx.stroke(); ctx.restore();
  }
  const pt = (e) => { const r = base.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };

  // 그리기: 펜 하나만 따라가고, 빠르게 그어도 중간 점을 모두 받아 부드러운 곡선으로
  let cur = null, pid = null;
  area.addEventListener('pointerdown', (e) => {
    const t = WB.tool;
    if (t === 'text') { if (e.target.closest('.obj')) return; e.preventDefault(); const [x, y] = pt(e); addText(x, y); return; }
    if (t === 'select') { if (!e.target.closest('.obj')) select(null); return; }
    if (cur || e.button > 0) return;
    e.preventDefault(); pid = e.pointerId; area.setPointerCapture(pid); select(null);
    const o = WB[t]; cur = { t, c: o.c, w: o.w, pts: [pt(e)] };
    if (t === 'erase') eraseSeg(cur.pts[0], cur.pts[0]); else renderLive();
  });
  area.addEventListener('pointermove', (e) => {
    if (!cur || e.pointerId !== pid) return;
    const evs = (e.getCoalescedEvents && e.getCoalescedEvents().length) ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = pt(ev), l = cur.pts[cur.pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 0.8) continue;
      if (cur.t === 'erase') eraseSeg(l, p);
      cur.pts.push(p);
    }
    if (cur.t !== 'erase') renderLive();
  });
  const end = (e) => {
    if (!cur || e.pointerId !== pid) return;
    WB.strokes.push(cur); WB.hist.push({ k: 's' });
    if (cur.t !== 'erase') { lx.clearRect(0, 0, W, H); stroke(bx, cur); }
    cur = null; pid = null;
  };
  area.addEventListener('pointerup', end); area.addEventListener('pointercancel', end);
  function renderLive() { lx.clearRect(0, 0, W, H); stroke(lx, cur); }
  function eraseSeg(a, b) { bx.save(); bx.globalCompositeOperation = 'destination-out'; bx.lineCap = 'round'; bx.lineWidth = WB.erase.w; bx.beginPath(); bx.moveTo(a[0], a[1]); bx.lineTo(b[0] + 0.01, b[1]); bx.stroke(); bx.restore(); }

  // 글자·그림 상자
  function makeObj(cls, x, y) {
    const o = document.createElement('div'); o.className = 'obj ' + cls; o.style.left = x + 'px'; o.style.top = y + 'px';
    o.insertAdjacentHTML('beforeend', `<div class="grip">${ic('cursor')}옮기기</div><button class="del" title="지우기">${ic('x')}</button>`);
    objs.appendChild(o); WB.hist.push({ k: 'o', el: o });
    o.querySelector('.del').onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); o.remove(); select(null); };
    o.querySelector('.grip').onpointerdown = (e) => drag(e, o, 'move');
    o.addEventListener('pointerdown', (e) => {
      if (WB.tool !== 'select' && WB.tool !== 'text') return;
      select(o);
      if (o.classList.contains('img') && !e.target.closest('.hd,.del')) drag(e, o, 'move');
    });
    return o;
  }
  function drag(e, o, mode) {
    e.preventDefault(); e.stopPropagation(); select(o);
    const sx = e.clientX, sy = e.clientY, L = o.offsetLeft, T = o.offsetTop, W0 = o.offsetWidth, H0 = o.offsetHeight, ratio = W0 / H0;
    const mv = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (mode === 'move') { o.style.left = L + dx + 'px'; o.style.top = T + dy + 'px'; }
      else if (mode === 'e') o.style.width = Math.max(40, W0 + dx) + 'px';
      else if (mode === 's') o.style.height = Math.max(30, H0 + dy) + 'px';
      else { const d = Math.abs(dx) > Math.abs(dy * ratio) ? dx : dy * ratio; const w = Math.max(40, W0 + d); o.style.width = w + 'px'; o.style.height = w / ratio + 'px'; }
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function addImage(src) {
    const im = new Image();
    im.onload = () => {
      const w = Math.min(im.naturalWidth, W * 0.45), h = w * im.naturalHeight / im.naturalWidth;
      const o = makeObj('img', (W - w) / 2, Math.max(16, (H - h) / 2)); o.style.width = w + 'px'; o.style.height = h + 'px';
      o.insertAdjacentHTML('afterbegin', `<img src="${src}" alt="">`);
      o.insertAdjacentHTML('beforeend', '<span class="hd se" title="비율 유지"></span><span class="hd e"></span><span class="hd s"></span>');
      o.querySelectorAll('.hd').forEach((hd) => { hd.onpointerdown = (e) => drag(e, o, hd.classList[1]); });
      setTool('select'); select(o);
    };
    im.src = src;
  }
  WB.addImage = addImage;
  function addText(x, y) {
    const o = makeObj('txt', x, y - WB.txt.size * 0.6); o._t = { ...WB.txt };
    const ed = document.createElement('div'); ed.contentEditable = 'true'; o.appendChild(ed); applyTxt(o);
    ed.addEventListener('paste', (e) => { const t = e.clipboardData.getData('text/plain'); if (t) { e.preventDefault(); document.execCommand('insertText', false, t); } });
    ed.addEventListener('blur', () => { if (!ed.textContent.trim()) { o.remove(); if (WB.sel === o) select(null); } });
    ed.addEventListener('focus', () => select(o));
    select(o); setTimeout(() => ed.focus(), 0);
  }
  function applyTxt(o) { const ed = o.querySelector('[contenteditable]'), t = o._t; ed.style.fontSize = t.size + 'px'; ed.style.fontWeight = t.bold ? 900 : 500; ed.style.color = t.c; }
  function applySel() { if (WB.sel && WB.sel.classList.contains('txt')) { WB.sel._t = { ...WB.txt }; applyTxt(WB.sel); } }
  function select(o) {
    if (WB.sel && WB.sel !== o) WB.sel.classList.remove('sel');
    WB.sel = o;
    if (o) { o.classList.add('sel'); if (o._t && WB.tool === 'text') { WB.txt = { ...o._t }; renderOpts(); } }
  }

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
    else if (t === 'erase') h = sz([20, 40, 80], WB.erase.w, '#C5CCDA');
    else if (t === 'text') h = `<label class="txsz" title="글자 크기: 직접 적거나 목록에서 골라요"><input type="number" data-r="txSize" min="10" max="400" step="1" list="wbTxSizes" value="${WB.txt.size}"><datalist id="wbTxSizes">${TXT_SIZES.map((s) => `<option value="${s}">`).join('')}</datalist></label>
        <button class="tb ${WB.txt.bold ? 'sel' : ''}" data-r="txBold" style="font-weight:900">굵게</button>` + sw(PEN, WB.txt.c);
    else h = '<span class="hint">그림·글자를 끌어 옮기고, 모서리 네모를 끌어 크기를 바꿔요</span>';
    box.innerHTML = h;
    box.querySelectorAll('[data-c]').forEach((s) => { s.onpointerdown = (e) => { e.preventDefault(); (t === 'text' ? WB.txt : WB[t]).c = s.dataset.c; if (t === 'text') applySel(); renderOpts(); }; });
    box.querySelectorAll('[data-w]').forEach((s) => { s.onclick = () => { WB[t].w = +s.dataset.w; renderOpts(); }; });
    const ts = box.querySelector('[data-r="txSize"]');
    if (ts) {
      const setSize = (fix) => { const v = Math.round(+ts.value); if (!v) return; const c = Math.max(10, Math.min(400, v)); WB.txt.size = c; if (fix) ts.value = c; applySel(); };
      ts.oninput = () => setSize(false);
      ts.onchange = () => setSize(true);
      ts.onkeydown = (e) => { if (e.key === 'Enter') { setSize(true); ts.blur(); } e.stopPropagation(); };
    }
    const tb = box.querySelector('[data-r="txBold"]'); if (tb) tb.onpointerdown = (e) => { e.preventDefault(); WB.txt.bold = !WB.txt.bold; applySel(); renderOpts(); };
  }
  wbEl.querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
  q('undo').onclick = () => {
    let h;
    while ((h = WB.hist.pop())) {
      if (h.k === 's') { WB.strokes.pop(); redraw(); return; }
      if (h.el.isConnected) { h.el.remove(); if (WB.sel === h.el) select(null); return; }
    }
  };
  q('clear').onclick = () => { WB.strokes = []; WB.hist = []; objs.innerHTML = ''; select(null); redraw(); };
  q('img').onclick = () => q('file').click();
  q('file').onchange = (e) => { const f = e.target.files[0]; if (f) addImage(URL.createObjectURL(f)); e.target.value = ''; };
  q('full').onclick = () => setWbFull(!wbEl.classList.contains('full'));
  area.addEventListener('dragover', (e) => e.preventDefault());
  area.addEventListener('drop', (e) => { e.preventDefault(); const f = [...e.dataTransfer.files].find((x) => x.type.startsWith('image/')); if (f) addImage(URL.createObjectURL(f)); });
  WB.del = () => { if (WB.sel) { WB.sel.remove(); select(null); } };
  drawWbWidgets();
  setTool('pen');
}

export function setWbFull(on) {
  if (!wbEl) return;
  wbEl.classList.toggle('full', on);
  document.body.classList.toggle('wb-full', on);
  wbEl.querySelector('[data-r="full"] span').textContent = on ? '원래 크기' : '크게 보기';
  try {
    if (on && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {});
  } catch (e) { /* 전체 화면을 지원하지 않는 브라우저 */ }
}
document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && wbIsFull()) setWbFull(false); });
document.addEventListener('keydown', (e) => {
  if (!wbEl || !wbEl.isConnected) return;
  const editing = document.activeElement && document.activeElement.isContentEditable;
  if (e.key === 'Escape' && wbIsFull()) setWbFull(false);
  if ((e.key === 'Delete' || e.key === 'Backspace') && !editing && WB.sel && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); WB.del(); }
});
document.addEventListener('paste', (e) => {
  if (!wbEl || !wbEl.isConnected) return;
  const it = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.type.startsWith('image/'));
  if (!it) return; e.preventDefault(); WB.addImage(URL.createObjectURL(it.getAsFile()));
});
