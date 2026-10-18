// 설정 창: 요일별 시간표 · 오늘만 바꾸기 · 학생 명단 · 소리 · 초기화
import { ic, esc, toast, confirmBox } from './ui.js';
import { WEEKDAYS, clone, sampleConfig, toSec } from './data.js';
import { BELLS, ringBell, setVolume } from './sound.js';

let ctx = null; // { cfg(), day(), todayWd(), saveCfg(), saveDay(), applyAll(), guest(), resetAll() }
export function initSettings(c) { ctx = c; }

let tab = 'table', dayKey = null, draft = null, dirty = false, modal = null;

export function openSettings(start = 'table') {
  if (modal) return;
  tab = start; dirty = false;
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
}

async function close() {
  if (dirty && !(await confirmBox('저장하지 않고 닫을까요?', '바꾼 시간표가 저장되지 않아요.', '닫기'))) return;
  modal.remove(); modal = null;
}

function draw() {
  const box = modal.querySelector('.set');
  const tabs = [['table', '시간표·과제'], ['roster', '학생 명단'], ['sound', '소리'], ['reset', '초기화']];
  box.innerHTML = `<div class="set-h"><h2>설정</h2><div class="seg">${tabs.map(([k, n]) => `<button data-t="${k}" class="${tab === k ? 'sel' : ''}">${n}</button>`).join('')}</div><button class="x" data-a="close">${ic('x')}</button></div>
    <div class="set-b">${tab === 'table' ? tableBody() : tab === 'roster' ? rosterBody() : tab === 'sound' ? soundBody() : resetBody()}</div>
    ${tab === 'table' ? `<div class="set-f"><button class="btn ghost" data-a="addp">${ic('cal')} 교시 추가</button><span class="sp"></span>
       ${ctx.guest() ? '<span class="hint">게스트 모드에서는 저장되지 않아요</span>' : ''}<button class="btn" data-a="savet">저장</button></div>` : ''}`;
  box.querySelector('[data-a=close]').onclick = close;
  box.querySelectorAll('.seg [data-t]').forEach((b) => {
    b.onclick = async () => {
      if (dirty && !(await confirmBox('저장하지 않고 넘어갈까요?', '바꾼 시간표가 저장되지 않아요.', '넘어가기'))) return;
      dirty = false; tab = b.dataset.t; loadDraft(); draw();
    };
  });
  if (tab === 'table') bindTable(box);
  if (tab === 'roster') bindRoster(box);
  if (tab === 'sound') bindSound(box);
  if (tab === 'reset') bindReset(box);
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
    ${draft.length ? draft.map((p, i) => periodRow(p, i)).join('') : '<p class="hint">교시가 없어요. 아래 \'교시 추가\'를 눌러 주세요.</p>'}`;
}
function listUI(arr, kind, i) {
  return `<div class="tlist" data-list="${kind}" data-i="${i}">${arr.map((t, k) => `<div class="it"><span>${k + 1}</span><input type="text" value="${esc(t)}" data-k="${k}">
      <button class="mini" data-mv="-1" data-k="${k}" title="위로">${ic('up')}</button><button class="mini rm" data-del="${k}" title="삭제">${ic('x')}</button></div>`).join('')}
    <button class="addbtn" data-add="1">+ ${kind === 'tasks' ? '과제 추가' : '준비물 추가'}</button></div>`;
}
function periodRow(p, i) {
  return `<div class="prow" data-i="${i}"><div class="top">
      <label>이름<input type="text" data-f="name" value="${esc(p.name)}"></label>
      <label>시작<input type="time" data-f="start" value="${esc(p.start)}"></label>
      <label>끝<input type="time" data-f="end" value="${esc(p.end)}"></label>
      <label>과목<input type="text" data-f="subject" value="${esc(p.subject)}"></label>
      <button class="mini rm" data-delp="${i}" title="교시 삭제">${ic('trash')}</button></div>
    <div class="lists"><div><label>교과서·준비물</label>${listUI(p.items || [], 'items', i)}</div><div><label>과제 (정류장)</label>${listUI(p.tasks || [], 'tasks', i)}</div></div></div>`;
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
    row.querySelectorAll('[data-f]').forEach((inp) => { inp.oninput = () => { draft[i][inp.dataset.f] = inp.value; mark(); }; });
    row.querySelector('[data-delp]').onclick = () => { draft.splice(i, 1); mark(); draw(); };
    row.querySelectorAll('.tlist').forEach((tl) => {
      const kind = tl.dataset.list, arr = draft[i][kind] = draft[i][kind] || [];
      tl.querySelectorAll('input[data-k]').forEach((inp) => { inp.oninput = () => { arr[+inp.dataset.k] = inp.value; mark(); }; });
      tl.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => { arr.splice(+b.dataset.del, 1); mark(); draw(); }; });
      tl.querySelectorAll('[data-mv]').forEach((b) => { b.onclick = () => { const k = +b.dataset.k; if (k > 0) { [arr[k - 1], arr[k]] = [arr[k], arr[k - 1]]; mark(); draw(); } }; });
      tl.querySelector('[data-add]').onclick = () => { arr.push(''); mark(); draw(); const ins = modal.querySelectorAll(`.prow[data-i="${i}"] .tlist[data-list="${kind}"] input`); ins[ins.length - 1].focus(); };
    });
  });
  box.querySelector('[data-a=addp]').onclick = () => {
    const last = draft[draft.length - 1];
    const fmt = (s) => `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}`;
    const st = last ? toSec(last.end) + 600 : 9 * 3600;
    draft.push({ name: `${draft.length + 1}교시`, start: fmt(st), end: fmt(st + 2400), subject: '', items: [], tasks: [] });
    mark(); draw();
    const b = modal.querySelector('.set-b'); b.scrollTop = b.scrollHeight;
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
function rosterBody() {
  return `<div class="set-grid"><div class="set-sec"><h3>학생 명단</h3>
      <textarea data-r="roster" rows="16" placeholder="한 줄에 한 명씩, 1번부터 순서대로">${esc(ctx.cfg().roster.join('\n'))}</textarea>
      <p class="note">한 줄에 한 명씩 적으면 순서대로 1번, 2번… 번호가 붙어요. 이름은 로그인한 선생님 기록에만 저장되고, 공개 저장소에는 올라가지 않아요.</p>
      <div class="row end"><button class="btn" data-a="saver">저장</button></div></div>
    <div class="set-sec"><h3>도움말</h3><p class="note">학생 수가 바뀌면 과제 정류장 이름표도 바로 바뀌어요. 이미 지난 날짜 기록에는 그날의 명단이 그대로 남아요.</p></div></div>`;
}
function bindRoster(box) {
  box.querySelector('[data-a=saver]').onclick = () => {
    const list = box.querySelector('[data-r=roster]').value.split('\n').map((s) => s.trim()).filter(Boolean);
    ctx.cfg().roster = list; ctx.saveCfg(); ctx.saveDay(); ctx.applyAll();
    toast(`학생 ${list.length}명을 저장했어요`);
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
