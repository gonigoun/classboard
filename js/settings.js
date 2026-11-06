// 설정 창: 요일별 시간표 · 오늘만 바꾸기 · 학생 명단 · 소리 · 초기화
import { ic, esc, toast, confirmBox } from './ui.js';
import { WEEKDAYS, clone, sampleConfig, toSec, morningPeriod, isMorning, lunchPeriod, isLunch, isSpecial, SLOTS, MAX_PERIODS, LUNCH_AFTER } from './data.js';
import { BELLS, ringBell, setVolume } from './sound.js';

let ctx = null; // { cfg(), day(), todayWd(), saveCfg(), saveDay(), applyAll(), guest(), resetAll() }
export function initSettings(c) { ctx = c; }

let tab = 'table', dayKey = null, draft = null, dirty = false, modal = null;
let pick = -1; // 시간표에서 고른 칸 (교시 추가는 이 칸 바로 뒤에)

export function openSettings(start = 'table') {
  if (modal) return;
  tab = start; dirty = false; allow = null;
  const wd = ctx.todayWd();
  dayKey = wd >= 1 && wd <= 5 ? 'today' : '1';
  loadDraft();
  modal = document.createElement('div'); modal.className = 'modal';
  modal.innerHTML = '<div class="set"></div>';
  document.body.appendChild(modal);
  modal.addEventListener('pointerdown', (e) => { if (e.target === modal) close(); });
  draw();
}

function loadDraft() {
  draft = clone(dayKey === 'today' ? (ctx.day() ? ctx.day().table : []) : (ctx.cfg().weekTables[dayKey] || []));
  draft.sort((a, b) => toSec(a.start) - toSec(b.start)); // 시간 순서대로 보여야 끌어서 옮기기가 헷갈리지 않아요
  pick = -1;
}

async function close() {
  if (dirty && !(await confirmBox('저장하지 않고 닫을까요?', '바꾼 시간표가 저장되지 않아요.', '닫기'))) return;
  modal.remove(); modal = null;
}

function draw() {
  const box = modal.querySelector('.set');
  // 다시 그려도 보던 자리(스크롤)가 그대로 있게
  const oldB = box.querySelector('.set-b'), keep = oldB && oldB.dataset.tab === tab ? oldB.scrollTop : 0;
  const tabs = [['table', '시간표·과제'], ['roster', '학생 명단'], ['sound', '소리'], ['reset', '초기화'], ...(ctx.isAdmin() ? [['allow', '허용할 선생님']] : [])];
  box.innerHTML = `<div class="set-h"><h2>설정</h2><div class="seg">${tabs.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'sel' : ''}">${n}</button>`).join('')}</div><button class="x" data-a="close">${ic('x')}</button></div>
    <div class="set-b" data-tab="${tab}">${tab === 'table' ? tableBody() : tab === 'roster' ? rosterBody() : tab === 'sound' ? soundBody() : tab === 'allow' ? allowBody() : resetBody()}</div>
    ${tab === 'table' ? `<div class="set-f"><button class="btn ghost" data-a="addp">${ic('cal')} ${pick >= 0 && draft[pick] ? `${esc(draft[pick].name)} 뒤에 교시 추가` : '교시 추가'}</button>${draft.some(isMorning) ? '' : `<button class="btn ghost" data-a="addam">${ic('sunny')} 아침 시간 추가</button>`}${draft.some(isLunch) ? '' : `<button class="btn ghost" data-a="addlu">${ic('star')} 점심시간 추가</button>`}<span class="sp"></span>
       ${ctx.guest() ? '<span class="hint">게스트 모드에서는 저장되지 않아요</span>' : ''}<button class="btn" data-a="savet">저장</button></div>` : ''}`;
  box.querySelector('[data-a=close]').onclick = close;
  box.querySelectorAll('.seg [data-t]').forEach((b) => {
    b.onclick = async () => {
      if (dirty && !(await confirmBox('저장하지 않고 넘어갈까요?', '바꾼 시간표가 저장되지 않아요.', '넘어가기'))) return;
      dirty = false; tab = b.dataset.t; loadDraft(); draw();
    };
  });
  box.querySelector('.set-b').scrollTop = keep;
  if (tab === 'table') bindTable(box);
  if (tab === 'roster') bindRoster(box);
  if (tab === 'sound') bindSound(box);
  if (tab === 'reset') bindReset(box);
  if (tab === 'allow') bindAllow(box);
}

/* ---------- 시간표 ---------- */
function tableBody() {
  const wd = ctx.todayWd();
  const days = [['today', `오늘만 (${WEEKDAYS[wd]})`], ...[1, 2, 3, 4, 5].map((d) => [String(d), `${WEEKDAYS[d]}요일 기본`])];
  const note = dayKey === 'today'
    ? '오늘 하루만 바뀌어요. 요일 기본 시간표는 그대로예요.'
    : `매주 ${WEEKDAYS[+dayKey]}요일에 쓰는 기본 시간표예요.${+dayKey === wd && !(ctx.day() && ctx.day().custom) ? ' 오늘 시간표에도 바로 반영돼요.' : ''}`;
  return `<div class="days">${days.map(([k, n]) => `<button data-d="${k}" class="${dayKey === k ? 'sel' : ''} ${k === 'today' ? 'today' : ''}">${n}</button>`).join('')}</div>
    <p class="hint">${note} 과제는 적은 순서대로 정류장이 돼요.</p>
    <p class="hint">${ic('grip')} 손잡이를 끌면 교시(과목·과제)나 과제·준비물 순서를 옮길 수 있어요. 교시를 누르고 <b>교시 추가</b>를 누르면 그 바로 뒤에 들어가요. 시간은 정해진 칸에 저절로 맞춰져요.</p>
    <p class="hint slots">${ic('clock')} ${slotList()}</p>
    ${offSlots() ? `<div class="offslot">${ic('clock')}<span>정해진 시간과 다른 칸이 <b>${offSlots()}개</b> 있어요.</span><button class="btn ghost" data-a="fix">정해진 시간으로 맞추기</button></div>` : ''}
    ${draft.length ? draft.map((p, i) => periodRow(p, i)).join('') : '<p class="hint">교시가 없어요. 아래 \'교시 추가\'를 눌러 주세요.</p>'}`;
}
function listUI(arr, kind, i) {
  return `<div class="tlist" data-list="${kind}" data-i="${i}">${arr.map((t, k) => `<div class="it" data-k="${k}"><button class="dnd" data-grip="it" title="끌어서 옮기기" aria-label="끌어서 옮기기">${ic('grip')}</button><span>${k + 1}</span><input type="text" value="${esc(t)}" data-k="${k}">
      <button class="mini" data-mv="-1" data-k="${k}" title="위로">${ic('up')}</button><button class="mini rm" data-del="${k}" title="삭제">${ic('x')}</button></div>`).join('')}
    <button class="addbtn" data-add="1">+ ${kind === 'tasks' ? '과제 추가' : '준비물 추가'}</button></div>`;
}
/** 시·분 고르기 (분은 5분 단위, 이미 다른 값이면 그 값도 목록에 남김) */
function timeSel(f, v) {
  const [h, m] = String(v || '09:00').split(':').map(Number);
  const hs = []; for (let x = 6; x <= 18; x++) hs.push(x); if (!hs.includes(h)) hs.push(h);
  const ms = []; for (let x = 0; x < 60; x += 5) ms.push(x); if (!ms.includes(m)) ms.push(m);
  const o = (arr, cur, suf) => arr.sort((a, b) => a - b).map((x) => `<option value="${x}" ${x === cur ? 'selected' : ''}>${String(x).padStart(2, '0')}${suf}</option>`).join('');
  return `<span class="tsel" data-tf="${f}"><select data-part="h" aria-label="시">${o(hs, h, '시')}</select><b>:</b><select data-part="m" aria-label="분">${o(ms, m, '분')}</select></span>`;
}
function periodRow(p, i) {
  const am = isSpecial(p), lu = isLunch(p);
  return `<div class="prow ${am ? 'am' : ''} ${lu ? 'lu' : ''} ${pick === i ? 'pick' : ''}" data-i="${i}"><div class="top">
      ${am ? '<span class="dnd off"></span>' : `<button class="dnd big" data-grip="p" title="끌어서 교시 옮기기" aria-label="끌어서 교시 옮기기">${ic('grip')}</button>`}
      <label>이름<input type="text" data-f="name" value="${esc(p.name)}"></label>
      <label>시작${timeSel('start', p.start)}</label>
      <label>끝${timeSel('end', p.end)}</label>
      <label>${am ? '활동' : '과목'}<input type="text" data-f="subject" value="${esc(p.subject)}"></label>
      <button class="mini rm" data-delp="${i}" title="${am ? `${esc(p.name)} 삭제` : '교시 삭제'}">${ic('trash')}</button></div>
    ${lu ? '<p class="note">점심시간: 교시가 아닌 시간이에요. 아침 시간처럼 과제 현황과 판서를 쓸 수 있고, 화면에 남은 시간과 다음 수업이 보여요.</p>' : am ? '<p class="note">아침 시간: 1교시 전 시간이에요. 과제 현황과 판서를 쓸 수 있고, 시작할 때 종은 울리지 않아요.</p>' : ''}
    <div class="lists"><div><label>교과서·준비물</label>${listUI(p.items || [], 'items', i)}</div><div><label>과제</label>
      <div class="mode row"><select data-f="mode"><option value="seq" ${p.mode !== 'pick' ? 'selected' : ''}>순서대로 (정류장)</option><option value="pick" ${p.mode === 'pick' ? 'selected' : ''}>골라서 하기</option></select>
        ${p.mode === 'pick' ? `<label class="need">완료 기준 <input type="number" min="1" max="${Math.max(1, (p.tasks || []).length)}" data-f="need" value="${esc(p.need || (p.tasks || []).length || 1)}">개</label>` : ''}</div>
      ${listUI(p.tasks || [], 'tasks', i)}</div></div></div>`;
}
const SLOT = ['name', 'start', 'end', 'morning', 'lunch']; // 칸(시간 자리)에 붙어 있는 것. 나머지(과목·준비물·과제·방식)는 끌면 따라 움직여요
const content = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => !SLOT.includes(k)));
const slotOf = (p) => Object.fromEntries(Object.entries(p).filter(([k]) => SLOT.includes(k)));
/** 'n교시' 이름은 시간 순서대로 다시 번호 매김 (직접 바꾼 이름은 그대로) */
function renumber() {
  let n = 0;
  draft.forEach((p) => { if (isSpecial(p)) return; n++; if (/^\d+교시$/.test(p.name)) p.name = `${n}교시`; });
}

/** 정해진 칸 순서로 줄 세우고 시간을 맞춤: 아침 → 1~5교시 → 점심 → 6교시 */
function fixed(list) {
  const am = list.filter(isMorning), lu = list.filter(isLunch), reg = list.filter((p) => !isSpecial(p));
  let n = 0;
  reg.forEach((p) => { n++; if (/^\d+교시$/.test(p.name)) p.name = `${n}교시`; const t = SLOTS[Math.min(n, MAX_PERIODS)]; p.start = t[0]; p.end = t[1]; });
  am.forEach((p) => { [p.start, p.end] = SLOTS.am; });
  lu.forEach((p) => { [p.start, p.end] = SLOTS.lu; });
  const at = Math.min(LUNCH_AFTER, reg.length);
  return [...am, ...reg.slice(0, at), ...lu, ...reg.slice(at)];
}
function fixTimes() { const keep = draft[pick]; draft = fixed(draft); pick = keep ? draft.indexOf(keep) : -1; }
/** 정해진 시간과 다른 칸 수 */
function offSlots() {
  const c = fixed(clone(draft));
  return draft.filter((p, k) => !c[k] || c[k].start !== p.start || c[k].end !== p.end || c[k].name !== p.name).length;
}
const slotList = () => `아침 ${SLOTS.am.join('~')} · ${[1, 2, 3, 4, 5].map((n) => `${n}교시 ${SLOTS[n][0]}`).join(' · ')} · 점심 ${SLOTS.lu.join('~')} · 6교시 ${SLOTS[6][0]}`;

/** 고른 칸 바로 뒤(안 고르면 맨 뒤)에 교시를 넣고, 정해진 시간에 맞춰요 */
function addPeriod(i) {
  const reg = draft.filter((p) => !isSpecial(p));
  if (reg.length >= MAX_PERIODS) { toast(`${MAX_PERIODS}교시까지만 넣을 수 있어요. 필요 없는 교시를 지우거나 끌어서 바꿔 주세요`, 4000); return false; }
  const base = i >= 0 ? draft[i] : null;
  // 몇 번째 교시 자리에 들어갈지: 고른 칸까지(포함) 있는 교시 수
  const pos = base ? draft.slice(0, i + 1).filter((p) => !isSpecial(p)).length : reg.length;
  const item = { name: '0교시', start: '', end: '', subject: '', items: [], tasks: [] };
  reg.splice(pos, 0, item);
  draft = fixed([...draft.filter(isSpecial), ...reg]);
  pick = draft.indexOf(item); draw();
  const row = modal.querySelector(`.prow[data-i="${pick}"]`); if (row) { row.classList.add('new'); row.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  const moved = reg.length - 1 - pos;
  toast(`${base ? `${base.name} 뒤에 ` : ''}${item.name}(${item.start}~${item.end})를 넣었어요${moved > 0 ? `. 뒤 ${moved}개 교시는 한 칸씩 밀려 정해진 시간에 맞췄어요` : ''}`, 4200);
  return true;
}

/* ---------- 끌어서 옮기기 (마우스·터치 모두) ---------- */
function dragStart(e, label, onMove, onDrop) {
  if (e.button > 0) return;
  e.preventDefault();
  const h = e.currentTarget, scroller = modal.querySelector('.set-b');
  const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.textContent = label;
  document.body.appendChild(ghost);
  const line = document.createElement('div'); line.className = 'dropline';
  let x = e.clientX, y = e.clientY, raf = 0, done = false;
  const place = () => { ghost.style.transform = `translate(${x + 14}px, ${y - 18}px)`; onMove(x, y, line); };
  const tick = () => { // 창 위·아래 끝에 가까우면 저절로 넘겨요
    const r = scroller.getBoundingClientRect(), edge = 60;
    const v = y < r.top + edge ? -Math.ceil((r.top + edge - y) / 4) : y > r.bottom - edge ? Math.ceil((y - r.bottom + edge) / 4) : 0;
    if (v) { scroller.scrollTop += v; place(); }
    raf = requestAnimationFrame(tick);
  };
  const end = (ok) => {
    if (done) return; done = true;
    cancelAnimationFrame(raf); ghost.remove(); line.remove(); document.body.classList.remove('dragging');
    h.removeEventListener('pointermove', mv); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', cc); removeEventListener('keydown', esc_);
    if (ok) onDrop();
  };
  const mv = (ev) => { x = ev.clientX; y = ev.clientY; place(); };
  const up = () => end(true), cc = () => end(false), esc_ = (ev) => { if (ev.key === 'Escape') end(false); };
  try { h.setPointerCapture(e.pointerId); } catch (_) { /* 무시 */ }
  h.addEventListener('pointermove', mv); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', cc); addEventListener('keydown', esc_);
  document.body.classList.add('dragging');
  place(); raf = requestAnimationFrame(tick);
}
/** 위에서부터 보아 가운데가 y보다 아래인 첫 줄 앞 (없으면 맨 뒤) */
const slotAt = (els, y) => { const k = els.findIndex((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 > y; }); return k < 0 ? els.length : k; };

function dragPeriod(e, box, row, mark) {
  const from = +row.dataset.i, src = draft[from];
  let ins = null;
  row.classList.add('lifted');
  dragStart(e, `${src.name} · ${src.subject || '과목 없음'}`, (x, y, line) => {
    const rows = [...box.querySelectorAll('.prow')];
    ins = slotAt(rows, y);
    if (ins < rows.length) rows[ins].before(line); else rows[rows.length - 1].after(line);
  }, () => {
    row.classList.remove('lifted');
    if (ins === null) return;
    const R = draft.map((p, k) => k).filter((k) => !isSpecial(draft[k]));
    const fromPos = R.indexOf(from);
    let toPos = R.filter((k) => k < ins && k !== from).length;
    if (fromPos < 0 || toPos === fromPos) { draw(); return; }
    const C = R.map((k) => content(draft[k]));
    const [c] = C.splice(fromPos, 1); C.splice(toPos, 0, c);
    R.forEach((k, n) => { draft[k] = { ...slotOf(draft[k]), ...C[n] }; });
    pick = R[toPos]; mark(); draw();
    const r = modal.querySelector(`.prow[data-i="${pick}"]`); if (r) r.classList.add('new');
    toast(`${src.subject || '내용'}을(를) ${draft[pick].name}(${draft[pick].start}~${draft[pick].end})로 옮겼어요`);
  });
  if (!document.body.classList.contains('dragging')) row.classList.remove('lifted');
}

function dragItem(e, box, it, mark) {
  const tl = it.closest('.tlist'), kind = tl.dataset.list, fromI = +tl.dataset.i, fromK = +it.dataset.k;
  const val = (draft[fromI][kind] || [])[fromK] || '';
  let to = null; // { i, k }
  it.classList.add('lifted');
  dragStart(e, val || '(빈 칸)', (x, y, line) => {
    const lists = [...box.querySelectorAll(`.tlist[data-list="${kind}"]`)];
    const hit = lists.find((l) => { const r = l.getBoundingClientRect(); return x >= r.left - 20 && x <= r.right + 20 && y >= r.top - 14 && y <= r.bottom + 14; });
    if (!hit) return;
    const its = [...hit.querySelectorAll(':scope > .it')];
    const k = slotAt(its, y);
    to = { i: +hit.dataset.i, k };
    if (k < its.length) its[k].before(line); else hit.querySelector(':scope > [data-add]').before(line);
  }, () => {
    it.classList.remove('lifted');
    if (!to) return;
    const a = draft[fromI][kind] = draft[fromI][kind] || [], b = draft[to.i][kind] = draft[to.i][kind] || [];
    let k = to.k;
    if (a === b && k > fromK) k--;
    if (a === b && k === fromK) { draw(); return; }
    const [v] = a.splice(fromK, 1); b.splice(k, 0, v);
    mark(); draw();
    if (to.i !== fromI) toast(`${draft[to.i].name}(으)로 옮겼어요`);
  });
}

function bindTable(box) {
  const mark = () => { dirty = true; };
  box.querySelectorAll('[data-d]').forEach((b) => {
    b.onclick = async () => {
      if (dirty && !(await confirmBox('저장하지 않고 넘어갈까요?', '바꾼 시간표가 저장되지 않아요.', '넘어가기'))) return;
      dirty = false; dayKey = b.dataset.d; loadDraft(); draw();
    };
  });
  box.querySelectorAll('.prow').forEach((row) => {
    const i = +row.dataset.i;
    // 칸을 누르면 고른 칸이 돼요 (교시 추가 버튼 글자도 바뀜)
    row.addEventListener('pointerdown', (e) => {
      if (e.target.closest('[data-grip],[data-delp]') || pick === i) return;
      pick = i; box.querySelectorAll('.prow.pick').forEach((x) => x.classList.remove('pick')); row.classList.add('pick');
      const b = box.querySelector('[data-a=addp]'); if (b) b.innerHTML = `${ic('cal')} ${esc(draft[i].name)} 뒤에 교시 추가`;
    });
    row.querySelectorAll('[data-f]').forEach((inp) => {
      inp.oninput = () => { draft[i][inp.dataset.f] = inp.dataset.f === 'need' ? Math.max(1, +inp.value || 1) : inp.value; mark(); if (inp.dataset.f === 'mode') draw(); };
    });
    row.querySelectorAll('[data-tf]').forEach((ts) => {
      const sel = (k) => ts.querySelector(`[data-part=${k}]`);
      ts.querySelectorAll('select').forEach((x) => { x.onchange = () => { draft[i][ts.dataset.tf] = `${String(sel('h').value).padStart(2, '0')}:${String(sel('m').value).padStart(2, '0')}`; mark(); draw(); }; });
    });
    row.querySelector('[data-delp]').onclick = () => {
      const was = draft[i]; draft.splice(i, 1); pick = -1;
      draft = fixed(draft); mark(); draw();
      if (!isSpecial(was)) toast(`${was.name}${was.subject ? `(${was.subject})` : ''}를 지우고 뒤 교시를 한 칸씩 당겼어요`);
    };
    row.querySelectorAll('.tlist').forEach((tl) => {
      const kind = tl.dataset.list, arr = draft[i][kind] = draft[i][kind] || [];
      tl.querySelectorAll('input[data-k]').forEach((inp) => { inp.oninput = () => { arr[+inp.dataset.k] = inp.value; mark(); }; });
      tl.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { arr.splice(+b.dataset.del, 1); mark(); draw(); }; });
      tl.querySelectorAll('[data-mv]').forEach((b) => { b.onclick = () => { const k = +b.dataset.k; if (k > 0) { [arr[k - 1], arr[k]] = [arr[k], arr[k - 1]]; mark(); draw(); } }; });
      tl.querySelector('[data-add]').onclick = () => { arr.push(''); mark(); draw(); const ins = modal.querySelectorAll(`.prow[data-i="${i}"] .tlist[data-list="${kind}"] input`); ins[ins.length - 1].focus(); };
    });
  });
  box.querySelectorAll('[data-grip=p]').forEach((g) => { g.onpointerdown = (e) => dragPeriod(e, box, g.closest('.prow'), mark); });
  box.querySelectorAll('[data-grip=it]').forEach((g) => { g.onpointerdown = (e) => dragItem(e, box, g.closest('.it'), mark); });
  box.querySelector('[data-a=addp]').onclick = () => { if (addPeriod(pick >= 0 && draft[pick] ? pick : -1)) mark(); };
  const fx = box.querySelector('[data-a=fix]');
  if (fx) fx.onclick = () => { const n = offSlots(); fixTimes(); mark(); draw(); toast(`${n}개 칸을 정해진 시간으로 맞췄어요. 저장을 눌러야 반영돼요`, 3500); };
  const am = box.querySelector('[data-a=addam]');
  if (am) am.onclick = () => {
    draft.unshift(morningPeriod()); fixTimes(); mark();
    draw(); modal.querySelector('.set-b').scrollTop = 0;
  };
  const lu = box.querySelector('[data-a=addlu]');
  if (lu) lu.onclick = () => {
    const item = lunchPeriod(); draft.push(item); fixTimes(); mark(); draw();
    const at = draft.indexOf(item), row = modal.querySelector(`.prow[data-i="${at}"]`); if (row) { row.classList.add('new'); row.scrollIntoView({ block: 'nearest' }); }
    toast(`점심시간(${item.start}~${item.end})을 ${LUNCH_AFTER}교시 뒤에 넣었어요`);
  };
  box.querySelector('[data-a=savet]').onclick = () => {
    const bad = draft.find((p) => !p.start || !p.end || toSec(p.end) <= toSec(p.start));
    if (bad) { toast(`${bad.name || '교시'}의 시작·끝 시간을 확인해 주세요`); return; }
    const clean = draft.map((p) => ({ ...p, items: (p.items || []).map((x) => x.trim()).filter(Boolean), tasks: (p.tasks || []).map((x) => x.trim()).filter(Boolean) }))
      .sort((a, b) => toSec(a.start) - toSec(b.start));
    if (dayKey === 'today') {
      if (!ctx.day()) { toast('오늘 시간표를 아직 불러오지 못했어요'); return; }
      ctx.day().table = clean; ctx.day().custom = true; ctx.saveDay();
    } else {
      ctx.cfg().weekTables[dayKey] = clean; ctx.saveCfg();
      if (+dayKey === ctx.todayWd() && ctx.day() && !ctx.day().custom) { ctx.day().table = clone(clean); ctx.saveDay(); }
    }
    dirty = false; draft = clone(clean); ctx.applyAll(); draw();
    toast(ctx.guest() ? '게스트 모드라서 화면에만 반영됐어요' : '시간표를 저장했어요');
  };
}

/* ---------- 학생 명단 ---------- */
/** '번호 이름' 줄 → 번호 순 배열 (빈 번호는 '') */
export function parseRoster(text) {
  const out = [], used = new Set(), errs = []; let next = 1;
  text.split('\n').map((s) => s.trim()).filter(Boolean).forEach((line) => {
    const m = line.match(/^(\d{1,3})\s*(?:번)?[\s.,):·-]+\s*(.+)$/);
    let n, name;
    if (m) { n = +m[1]; name = m[2].trim(); } else { while (used.has(next)) next++; n = next; name = line; }
    if (n < 1 || n > 99) { errs.push(`${line} (번호는 1~99)`); return; }
    if (used.has(n)) { errs.push(`${n}번이 두 번 있어요`); return; }
    used.add(n); next = Math.max(next, n + 1); out[n - 1] = name;
  });
  for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = '';
  return { list: out, errs };
}
const rosterText = (r) => r.map((n, i) => (n ? `${i + 1} ${n}` : '')).filter(Boolean).join('\n');
function rosterBody() {
  return `<div class="set-grid"><div class="set-sec"><h3>학생 명단</h3>
      <textarea data-r="roster" rows="16" placeholder="번호와 이름을 한 줄에 한 명씩\n1 김하늘\n2 이서준\n4 최지우">${esc(rosterText(ctx.cfg().roster))}</textarea>
      <p class="note"><b>번호 이름</b> 순서로 한 줄에 한 명씩 적어요 (예: <b>3 박도윤</b>). 번호를 빼고 이름만 적으면 앞 번호 다음으로 붙어요. 비는 번호(전학 등)는 그냥 빼면 돼요.</p>
      <div class="row end"><button class="btn" data-a="saver">저장</button></div></div>
    <div class="set-sec"><h3>학생 입장과 이름</h3><p class="note">학생은 폰에서 학급 코드와 <b>여기 적은 이름</b>을 넣어야 들어올 수 있어요(띄어쓰기는 상관없음). 번호는 여기 적은 번호로 저절로 정해져요.</p>
      <p class="note">같은 이름이 두 명이면 '김민준A', '김민준B'처럼 다르게 적고 학생에게 알려 주세요.</p>
      <p class="note">이름은 로그인한 선생님 기록에만 저장돼요. 학급 코드에는 이름 대신 알아볼 수 없는 지문만 올라가요. 이미 지난 날짜 기록에는 그날의 명단이 그대로 남아요.</p></div></div>`;
}
function bindRoster(box) {
  box.querySelector('[data-a=saver]').onclick = async () => {
    const { list, errs } = parseRoster(box.querySelector('[data-r=roster]').value);
    if (errs.length) { toast('확인해 주세요: ' + errs.slice(0, 2).join(', '), 4000); return; }
    ctx.cfg().roster = list; ctx.saveCfg(); ctx.saveDay(); ctx.applyAll();
    box.querySelector('[data-r=roster]').value = rosterText(list);
    const dup = await ctx.rosterChanged();
    toast(dup && dup.length ? `저장했어요. 같은 이름(${dup.join(', ')})은 폰으로 들어올 수 없어요. 다르게 적어 주세요` : `학생 ${list.filter((x) => x).length}명을 저장했어요`, dup && dup.length ? 5000 : 2600);
  };
}

/* ---------- 소리 ---------- */
function soundBody() {
  const s = ctx.cfg().sound;
  const all = [...BELLS.map((b) => b.name), ...s.custom.map((c) => `${c.name} (추가한 음원)`)];
  return `<div class="set-grid"><div class="set-sec"><h3>집중 종</h3>
      <select data-r="bell">${all.map((n, i) => `<option value="${i}" ${i === s.bell ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <div class="row"><button class="btn ghost" data-a="test">${ic('bell')} 들어 보기</button></div>
      <label class="chk">음량 <input type="range" min="0" max="100" value="${Math.round(s.volume * 100)}" data-r="vol" style="flex:1"> <span class="num" data-r="volv">${Math.round(s.volume * 100)}</span></label>
      <p class="note">집중 종은 '소리 끔' 상태에서도 울려요.</p></div>
    <div class="set-sec"><h3>자동 소리</h3>
      <label class="chk"><input type="checkbox" data-r="on" ${s.on ? 'checked' : ''}> 소리 켬 (효과음 전체)</label>
      <label class="chk"><input type="checkbox" data-r="auto" ${s.auto ? 'checked' : ''}> 자동 종소리 (수업 시작 · 2분 전 · 쉬는 시간 시작)</label>
      <p class="note">이름표 이동, 이름 뽑기, 신호등 누름 소리는 '소리 켬'일 때만 나요.</p></div>
    <div class="set-sec"><h3>음원 주소 추가</h3>
      <input type="text" data-r="cname" placeholder="이름 (예: 우리 반 종)">
      <input type="url" data-r="curl" placeholder="https://… .mp3" style="margin-top:6px">
      <div class="row"><button class="btn ghost" data-a="cadd">추가</button></div>
      ${s.custom.map((c, i) => `<div class="row"><span style="flex:1">${esc(c.name)}</span><button class="mini rm" data-cdel="${i}">${ic('x')}</button></div>`).join('')}
      <p class="note">재생이 안 되는 주소면 기본 종소리가 대신 울려요. 저작권 걱정 없는(CC0 등) 음원을 써 주세요.</p></div></div>`;
}
function bindSound(box) {
  const s = ctx.cfg().sound, q = (r) => box.querySelector(`[data-r=${r}]`);
  q('bell').onchange = () => { s.bell = +q('bell').value; ctx.saveCfg(); ctx.applyAll(); };
  box.querySelector('[data-a=test]').onclick = () => ringBell(+q('bell').value, s.custom);
  q('vol').oninput = () => { s.volume = q('vol').value / 100; setVolume(s.volume); q('volv').textContent = q('vol').value; };
  q('vol').onchange = () => ctx.saveCfg();
  q('on').onchange = () => { s.on = q('on').checked; ctx.saveCfg(); ctx.applyAll(); };
  q('auto').onchange = () => { s.auto = q('auto').checked; ctx.saveCfg(); };
  box.querySelector('[data-a=cadd]').onclick = () => {
    const name = q('cname').value.trim(), url = q('curl').value.trim();
    if (!name || !/^https?:\/\//.test(url)) { toast('이름과 https:// 로 시작하는 주소를 넣어 주세요'); return; }
    s.custom.push({ name, url }); ctx.saveCfg(); ctx.applyAll(); draw();
  };
  box.querySelectorAll('[data-cdel]').forEach((b) => {
    b.onclick = () => { s.custom.splice(+b.dataset.cdel, 1); if (s.bell >= BELLS.length + s.custom.length) s.bell = 0; ctx.saveCfg(); ctx.applyAll(); draw(); };
  });
}

/* ---------- 초기화 ---------- */
function resetBody() {
  return `<div class="set-grid"><div class="set-sec"><h3>예시 데이터로 되돌리기</h3>
      <p class="note">요일별 시간표·과제와 학생 명단을 처음 예시(5학년 1~4교시, 학생 10명)로 바꿔요. 배경·소리 설정과 지난 기록은 그대로예요.</p>
      <div class="row"><button class="btn ghost" data-a="sample">예시 데이터로 되돌리기</button></div></div>
    <div class="set-sec"><h3>모든 설정 초기화</h3>
      <p class="note">시간표, 명단, 배경, 소리, 위젯 위치를 모두 처음 상태로 되돌려요. 지난 기록(날짜별 과제 결과)은 남아요.</p>
      <div class="row"><button class="btn danger" data-a="all">모든 설정 초기화</button></div></div></div>`;
}
function bindReset(box) {
  box.querySelector('[data-a=sample]').onclick = async () => {
    if (!(await confirmBox('예시 데이터로 되돌릴까요?', '지금 시간표와 학생 명단이 예시 데이터로 바뀌어요. 되돌릴 수 없어요.', '되돌리기'))) return;
    const s = sampleConfig(); const c = ctx.cfg();
    c.weekTables = s.weekTables; c.roster = s.roster; ctx.saveCfg();
    if (ctx.day()) { ctx.day().table = clone(c.weekTables[ctx.todayWd()] || []); ctx.day().custom = false; ctx.saveDay(); }
    ctx.applyAll(); toast('예시 데이터로 되돌렸어요');
  };
  box.querySelector('[data-a=all]').onclick = async () => {
    if (!(await confirmBox('모든 설정을 초기화할까요?', '시간표, 명단, 배경, 소리 설정이 모두 처음 상태로 돌아가요. 되돌릴 수 없어요.', '초기화'))) return;
    await ctx.resetAll(); modal.remove(); modal = null; toast('모든 설정을 초기화했어요');
  };
}

/* ---------- 허용할 선생님 (관리자만) ---------- */
let allow = null, reqs = [];
function allowBody() {
  if (allow === null) return '<p class="hint">목록을 불러오는 중…</p>';
  return `<div class="set-grid"><div class="set-sec"><h3>권한 요청 ${reqs.length ? `<span class="badge">${reqs.length}</span>` : ''}</h3>
      ${reqs.length ? reqs.map((r, i) => `<div class="req"><div><b>${esc(r.name)}</b> ${r.school ? `· ${esc(r.school)}` : ''}<br><small>${esc(r.email)} · ${new Date(r.at).toLocaleDateString('ko-KR')}</small>${r.note ? `<p class="note">${esc(r.note)}</p>` : ''}</div>
        <div class="row"><button class="btn" data-ok="${i}">승인</button><button class="btn ghost" data-no="${i}">거절</button></div></div>`).join('') : '<p class="hint">새 권한 요청이 없어요.</p>'}
      <p class="note">선생님이 시작 화면에서 '선생님'을 고르고 Google로 로그인하면 여기로 요청이 와요. 승인하면 바로 자기 반 보드를 쓸 수 있어요.</p></div>
    <div class="set-sec"><h3>허용한 선생님</h3>
      <p class="note">여기 있는 Google 계정만 선생님 보드를 저장할 수 있어요. 선생님마다 시간표·명단·기록은 따로예요. 고운 선생님(관리자) 계정은 항상 허용돼요.</p>
      <div class="row"><input type="text" data-r="em" placeholder="teacher@gmail.com" style="flex:1"><button class="btn" data-a="add">추가</button></div>
      ${allow.length ? allow.map((e, i) => `<div class="row"><span style="flex:1">${esc(e)}</span><button class="mini rm" data-rm="${i}" title="허용 취소">${ic('x')}</button></div>`).join('') : '<p class="hint">아직 허용한 선생님이 없어요.</p>'}
      <p class="note">허용을 취소하면 그 선생님은 다음부터 게스트 모드로만 쓸 수 있어요. 저장한 기록은 남아 있다가 다시 허용하면 그대로 보여요.</p></div></div>`;
}
function bindAllow(box) {
  if (allow === null) {
    Promise.all([ctx.loadAllow(), ctx.listRequests().catch(() => [])]).then(([l, r]) => { allow = l; reqs = r.sort((a, b) => a.at - b.at); draw(); })
      .catch(() => { allow = []; toast('목록을 불러오지 못했어요. 보안 규칙이 게시됐는지 확인해 주세요'); draw(); });
    return;
  }
  const save = async () => {
    try { await ctx.saveAllow(allow); toast('허용 목록을 저장했어요'); } catch (e) { toast('저장하지 못했어요. 보안 규칙이 게시됐는지 확인해 주세요'); }
    draw();
  };
  box.querySelector('[data-a=add]').onclick = () => {
    const e = box.querySelector('[data-r=em]').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { toast('이메일 주소를 확인해 주세요'); return; }
    if (allow.includes(e)) { toast('이미 허용된 계정이에요'); return; }
    allow.push(e); save();
  };
  box.querySelectorAll('[data-rm]').forEach((b) => {
    b.onclick = async () => {
      const e = allow[+b.dataset.rm];
      if (!(await confirmBox('허용을 취소할까요?', `${e} 계정은 다음부터 선생님 보드를 저장할 수 없어요.`, '허용 취소'))) return;
      allow.splice(+b.dataset.rm, 1); save();
    };
  });
  box.querySelectorAll('[data-ok]').forEach((b) => {
    b.onclick = async () => {
      const r = reqs[+b.dataset.ok];
      try { allow = await ctx.approveRequest(r, allow); reqs.splice(+b.dataset.ok, 1); toast(`${r.name} 선생님을 승인했어요`); } catch (e) { toast('승인하지 못했어요'); }
      draw();
    };
  });
  box.querySelectorAll('[data-no]').forEach((b) => {
    b.onclick = async () => {
      const r = reqs[+b.dataset.no];
      if (!(await confirmBox('요청을 거절할까요?', `${r.name}(${r.email})의 요청을 지워요. 다시 요청할 수 있어요.`, '거절'))) return;
      try { await ctx.denyRequest(r.id); reqs.splice(+b.dataset.no, 1); } catch (e) { toast('거절하지 못했어요'); }
      draw();
    };
  });
}
