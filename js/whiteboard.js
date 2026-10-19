// 판서: 펜·음영(네온)·글자·지우개·선택, 그림 붙여 넣기·크기 조절, 크게 보기
// 좌표는 '가로 1400칸' 기준으로 저장해서 TV·노트북·휴대폰 어디서 봐도 같은 모양이에요.
// 선생님 계정으로 여러 화면을 열면 선·글자가 서로 연동돼요 (그림은 그 화면에만).
import { ic, toast } from './ui.js';

const PEN = ['#1E2433', '#E5484D', '#2B6CE6', '#22A86B', '#7B5CFA', '#FF8A00'];
const PASTEL = ['#FFF176', '#FFCCBC', '#C8E6C9', '#B3E5FC', '#E1BEE7', '#F8BBD0'];
// 음영: 글자를 끌어서 고른 부분에만 네온색 바탕
const NEON = [['#F4FF2E', '네온 노랑'], ['#3DFF8B', '네온 초록'], ['#FF4FD8', '네온 분홍'], ['#36E7FF', '네온 하늘'], ['#FF9F1C', '네온 주황']];
/** 글자 상자 내용 정리: 글자·줄바꿈·바탕색(음영)만 남김 */
function cleanHTML(html) {
  const t = document.createElement('template'); t.innerHTML = html;
  const okColor = (v) => /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i.test(v) && !/rgba\([^)]*,\s*0\s*\)/.test(v);
  const esc = (x) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const walk = (n) => [...n.childNodes].map((c) => {
    if (c.nodeType === 3) return esc(c.textContent);
    if (c.nodeType !== 1) return '';
    const tag = c.tagName, inner = walk(c);
    if (tag === 'BR') return '<br>';
    if (tag === 'DIV' || tag === 'P') return `<div>${inner || '<br>'}</div>`;
    const bg = (c.style && c.style.backgroundColor || '').trim();
    if (bg && okColor(bg) && inner) return `<span style="background-color:${bg}">${inner}</span>`;
    return inner;
  }).join('');
  return walk(t.content);
}
const LW = 1400; // 기준 가로 칸 수 (교실 TV 판서 폭쯤: 글자 크기 140이 TV에서 대략 140px)
const WB = { tool: 'text', pen: { c: PEN[0], w: 4 }, hl: { c: PASTEL[0], w: 28 }, shade: { c: NEON[0][0] }, erase: { w: 40 }, txt: { size: 110, bold: false, c: PEN[0] }, strokes: [], hist: [], sel: null, scale: 1, tvAr: 0 };
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
    o.querySelector('.del').onpointerdown = (e) => { e.preventDefault(); e.stopPropagation(); removeObj(o, true); };
    o.querySelector('.grip').onpointerdown = (e) => drag(e, o, 'move');
    o.addEventListener('pointerdown', (e) => {
      if (WB.tool !== 'select' && WB.tool !== 'text' && WB.tool !== 'shade') return;
      select(o);
      if (o.classList.contains('img') && !e.target.closest('.hd,.del')) drag(e, o, 'move');
    });
    return o;
  }
  function removeObj(o, send) {
    o.remove(); if (WB.sel === o) select(null);
    if (send && sync && o._t) sync.del(o._id);
  }
  function drag(e, o, mode) {
    e.preventDefault(); e.stopPropagation(); select(o);
    const k = WB.scale, sx = e.clientX, sy = e.clientY, g0 = { ...o._g, w: o.offsetWidth / k, h: o.offsetHeight / k }, ratio = g0.w / g0.h;
    const mv = (ev) => {
      const dx = (ev.clientX - sx) / k, dy = (ev.clientY - sy) / k;
      if (mode === 'move') { o._g.x = g0.x + dx; o._g.y = g0.y + dy; }
      else if (mode === 'e') o._g.w = Math.max(40, g0.w + dx);
      else if (mode === 's') o._g.h = Math.max(30, g0.h + dy);
      else { const d = Math.abs(dx) > Math.abs(dy * ratio) ? dx : dy * ratio; o._g.w = Math.max(40, g0.w + d); o._g.h = o._g.w / ratio; }
      place(o);
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); sendTxt(o); };
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
    const t = data ? { size: data.size, bold: data.bold, c: data.c } : { ...WB.txt };
    const o = makeObj('txt', x, data ? y : y - t.size * 0.6, data && data.id); o._t = t;
    const ed = document.createElement('div'); ed.contentEditable = 'true'; o.appendChild(ed);
    // 테두리 둘레 어디를 잡아도 옮길 수 있게 (위·아래·왼쪽·오른쪽 띠)
    ['t', 'r', 'b', 'l'].forEach((k) => { const g = document.createElement('span'); g.className = 'edge ' + k; g.title = '끌어서 옮기기'; g.onpointerdown = (e) => drag(e, o, 'move'); o.appendChild(g); });
    if (data) { if (data.html) ed.innerHTML = cleanHTML(data.html); else ed.textContent = data.text || ''; }
    place(o);
    ed.addEventListener('paste', (e) => { const s = e.clipboardData.getData('text/plain'); if (s) { e.preventDefault(); document.execCommand('insertText', false, s); } });
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
    sync.put({ id: o._id, k: 't', x: Math.round(o._g.x), y: Math.round(o._g.y), size: o._t.size, bold: !!o._t.bold, c: o._t.c, text, html, at: o._at || (o._at = Date.now()) });
  }
  function applyTxt(o) { const ed = o.querySelector('[contenteditable]'), t = o._t; ed.style.fontSize = t.size * WB.scale + 'px'; ed.style.fontWeight = t.bold ? 900 : 500; ed.style.color = t.c; }
  function applySel() { if (WB.sel && WB.sel.classList.contains('txt')) { WB.sel._t = { ...WB.txt }; applyTxt(WB.sel); sendTxt(WB.sel); } }
  function select(o) {
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
      if (!o) { o = addText(d.x, d.y, d); o._synced = true; o._at = d.at; return; }
      o._synced = true;
      const ed = o.querySelector('[contenteditable]');
      if (document.activeElement === ed || pendingIds.has(d.id)) return; // 내가 쓰는 중이면 그대로
      o._g.x = d.x; o._g.y = d.y; o._t = { size: d.size, bold: d.bold, c: d.c };
      if (d.html) { const h = cleanHTML(d.html); if (cleanHTML(ed.innerHTML) !== h) ed.innerHTML = h; }
      else if (ed.innerText.replace(/\n$/, '') !== d.text || /<(span|div|br)\b/i.test(ed.innerHTML)) ed.textContent = d.text;
      place(o);
    });
  };

  /** 고른 글자에 음영 넣기(c) 또는 지우기(null). 고른 글자가 없으면 안내 */
  function shadeSel(c) {
    const sel = window.getSelection();
    const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
    const node = r && (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement);
    const ed = node && node.closest('.obj.txt [contenteditable]');
    if (!r || r.collapsed || !ed || !wbEl.contains(ed)) { toast('글자 상자 안에서 음영을 넣을 글자를 끌어서 고른 뒤 색을 눌러요'); return false; }
    document.execCommand('styleWithCSS', false, true);
    document.execCommand('hiliteColor', false, c || 'transparent');
    const html = cleanHTML(ed.innerHTML); if (html !== ed.innerHTML) ed.innerHTML = html; // 음영 말고 다른 꾸밈은 빼고 정리
    sendTxt(ed.closest('.obj'));
    return true;
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
    else if (t === 'shade') h = NEON.map(([c, n]) => `<button class="neo ${c === WB.shade.c ? 'sel' : ''}" data-neo="${c}" title="${n}" style="--n:${c}"><i></i></button>`).join('')
      + `<button class="tb" data-r="unshade" title="고른 글자의 음영 지우기">${ic('eraser')}<span>음영 지우기</span></button><span class="hint shade-hint">글자를 끌어서 고른 뒤 색을 눌러요</span>`;
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
    box.querySelectorAll('[data-neo]').forEach((b) => { b.onpointerdown = (e) => { e.preventDefault(); WB.shade.c = b.dataset.neo; if (shadeSel(WB.shade.c)) renderOpts(); else { box.querySelectorAll('[data-neo]').forEach((x) => x.classList.toggle('sel', x === b)); } }; });
    const us = box.querySelector('[data-r="unshade"]'); if (us) us.onpointerdown = (e) => { e.preventDefault(); shadeSel(null); };
    const tb = box.querySelector('[data-r="txBold"]'); if (tb) tb.onpointerdown = (e) => { e.preventDefault(); WB.txt.bold = !WB.txt.bold; applySel(); renderOpts(); };
  }
  wbEl.querySelectorAll('[data-tool]').forEach((b) => { b.onclick = () => setTool(b.dataset.tool); });
  q('undo').onclick = () => {
    let h;
    while ((h = WB.hist.pop())) {
      if (h.k === 's') { const i = WB.strokes.findIndex((s) => s.id === h.id); if (i < 0) continue; WB.strokes.splice(i, 1); redraw(); if (sync) sync.del(h.id); return; }
      if (h.el.isConnected) { removeObj(h.el, true); return; }
    }
  };
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
  WB.del = () => { if (WB.sel) removeObj(WB.sel, true); };
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
  if ((e.key === 'Delete' || e.key === 'Backspace') && !editing && WB.sel && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); WB.del(); }
});
document.addEventListener('paste', (e) => {
  if (!wbEl || !wbEl.isConnected) return;
  const it = [...((e.clipboardData && e.clipboardData.items) || [])].find((i) => i.type.startsWith('image/'));
  if (!it) return; e.preventDefault(); WB.addImage(URL.createObjectURL(it.getAsFile()));
});
